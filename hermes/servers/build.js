require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const { connectNATS, subscribe } = require('../core/events');
const { startWatcher } = require('../core/watcher');
const { startWorkflow, submitTask, sendApproval, getState, setBroadcast } = require('../workflows/build');
const { getHistory, sweepStaleRunningTasks, logEvent } = require('../core/db');
const { corsMiddleware, authMiddleware, wsAuth } = require('../core/auth');
const { ensureRoleDocs } = require('../core/role-docs');
const { listProjectFolders, listBuildHistory, readBuildHistory, isValidTaskSlug, buildFileTree } = require('../core/archive');
const { validateEnv } = require('../core/env');

validateEnv('build', {
    required: ['WORK_DIR'],
});

const PORT = process.env.BUILD_PORT || 3002;
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

const app = express();
// POST /task carries a task description (typically a few hundred chars). 64 KB is
// ~20x that and still small enough to reject accidental multi-MB payloads without
// parsing them. Explicit cap replaces Express' permissive 100 KB default and
// makes the limit a deliberate, reviewable decision.
app.use(express.json({ limit: '64kb' }));
app.use(corsMiddleware);
app.use(authMiddleware);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const logBuffer = [];
const LOG_BUFFER_SIZE = 100;

function broadcast(payload) {
    const msg = JSON.stringify(payload);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
}

setBroadcast(broadcast);

wss.on('connection', (ws, req) => {
    if (!wsAuth(req)) {
        ws.close(1008, 'Unauthorized');
        return;
    }
    ws.send(JSON.stringify({ type: 'state', ...getState() }));
    if (logBuffer.length > 0) {
        ws.send(JSON.stringify({ type: 'log_replay', lines: logBuffer }));
    }
    ws.send(JSON.stringify({ type: 'history', items: getHistory() }));
});

app.post('/task', (req, res) => {
    const { description, mode, slug, autoApprove, autoApproveCap, planReview } = req.body;
    if (!description || !description.trim()) {
        return res.status(400).json({ error: 'description required' });
    }
    const submitMode = mode === 'continue' ? 'continue' : 'new';
    if (submitMode === 'continue') {
        if (!slug || typeof slug !== 'string' || !slug.trim()) {
            return res.status(400).json({ error: 'continue mode requires a slug' });
        }
        if (!isValidTaskSlug(slug.trim())) {
            return res.status(400).json({ error: 'invalid slug format (must be lowercase kebab-case, ≤50 chars)' });
        }
    }

    // Auto-approve validation. Reject hard-typed bad values; clamp soft out-of-range
    // (UI-supplied caps are user input, can be anything). 20 is the hard ceiling: even
    // if the caller explicitly asks for 999, we cap to prevent a typo from running away.
    let auto = false;
    let cap = 10;
    if (autoApprove !== undefined) {
        if (typeof autoApprove !== 'boolean') {
            return res.status(400).json({ error: 'autoApprove must be boolean' });
        }
        auto = autoApprove;
    }
    if (auto) {
        const requestedCap = Number(autoApproveCap);
        if (!Number.isFinite(requestedCap) || requestedCap < 1) {
            cap = 10;
        } else if (requestedCap > 20) {
            cap = 20;
            logEvent('autocap_clamped', { received: requestedCap, clamped: 20 }, null);
        } else {
            cap = Math.floor(requestedCap);
        }
    }

    // planReview: optional boolean. Reject hard-typed bad values (string "yes" etc.).
    if (planReview !== undefined && typeof planReview !== 'boolean') {
        return res.status(400).json({ error: 'planReview must be boolean' });
    }
    const review = planReview === true;

    try {
        logBuffer.length = 0;
        submitTask(description.trim(), {
            mode: submitMode,
            slug: submitMode === 'continue' ? slug.trim() : undefined,
            autoApprove: auto,
            autoApproveCap: cap,
            planReview: review,
        });
        res.json({ ok: true });
    } catch (err) {
        // Workflow throws "A task is already running" (conflict) and "project folder not
        // found" (bad request). 400 fits the latter; 409 fits the former. Pick by message.
        const status = /not found|requires/.test(err.message) ? 400 : 409;
        res.status(status).json({ error: err.message });
    }
});

// GET /projects — list <slug>/ deliverable folders in WORK_DIR so the Build UI can
// offer "Continue: <slug>" options. Filters out system folders and dotfiles.
app.get('/projects', (req, res) => {
    res.json({ projects: listProjectFolders() });
});

// GET /files — full WORK_DIR tree for the UI file browser. Depth-capped and
// excludes system folders. Polled every few seconds by the sidebar; keep cheap.
app.get('/files', (req, res) => {
    res.json({ root: process.env.WORK_DIR || '', tree: buildFileTree() });
});

// GET /files/content?path=<rel> — returns the requested file as text so the UI
// can preview it. Strict path safety: resolves the final absolute path and
// rejects anything that escapes WORK_DIR. 500KB cap and a null-byte heuristic
// prevent us from shipping a 100MB binary into a browser modal.
const FILE_PREVIEW_MAX_BYTES = 500_000;
app.get('/files/content', (req, res) => {
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    if (!rel) return res.status(400).json({ error: 'path query param required' });

    const WORK_DIR = path.resolve(process.env.WORK_DIR || '');
    if (!WORK_DIR) return res.status(500).json({ error: 'WORK_DIR not configured' });

    const full = path.resolve(WORK_DIR, rel);
    const withinRoot = full === WORK_DIR || full.startsWith(WORK_DIR + path.sep);
    if (!withinRoot) {
        return res.status(403).json({ error: 'path escapes WORK_DIR' });
    }

    let stat;
    try {
        stat = fs.statSync(full);
    } catch {
        return res.status(404).json({ error: 'file not found' });
    }
    if (!stat.isFile()) return res.status(400).json({ error: 'not a file' });

    if (stat.size > FILE_PREVIEW_MAX_BYTES) {
        return res.status(413).json({
            error: `file too large (${stat.size} bytes > ${FILE_PREVIEW_MAX_BYTES} cap)`,
            size: stat.size,
        });
    }

    let buf;
    try {
        buf = fs.readFileSync(full);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    // Binary heuristic: a null byte in the first 8KB is a strong signal.
    // Not perfect (UTF-16 would false-positive) but good enough for source files.
    const sample = buf.subarray(0, 8192);
    if (sample.includes(0)) {
        return res.json({ binary: true, size: stat.size, mtime: stat.mtimeMs });
    }

    res.json({ content: buf.toString('utf8'), size: stat.size, mtime: stat.mtimeMs });
});

// GET /history/builds — list archived build folders (newest first) for the Archive viewer.
app.get('/history/builds', (req, res) => {
    res.json({ builds: listBuildHistory() });
});

// GET /history/builds/:slug — read all three meta files for one archived build.
// Returns 404 if the slug folder doesn't exist or fails the safe-slug regex.
app.get('/history/builds/:slug', (req, res) => {
    const data = readBuildHistory(req.params.slug);
    if (!data) {
        return res.status(404).json({ error: 'archive not found' });
    }
    res.json(data);
});

app.post('/approval', (req, res) => {
    const { action, feedback } = req.body;
    const allowed = ['approve', 'skip', 'retry', 'abort', 'approve_plan', 'request_plan_changes'];
    if (!allowed.includes(action)) {
        return res.status(400).json({ error: 'invalid action' });
    }

    // request_plan_changes carries user feedback that gets injected into Claude's
    // next planning prompt. Validate as a non-empty string under 4 KB to prevent
    // both empty payloads and prompt-injection footguns.
    if (action === 'request_plan_changes') {
        if (typeof feedback !== 'string' || !feedback.trim()) {
            return res.status(400).json({ error: 'feedback required for request_plan_changes' });
        }
        if (feedback.length > 4096) {
            return res.status(400).json({ error: 'feedback too long (max 4096 chars)' });
        }
    }

    // Clear the live log buffer when starting a new build/audit cycle (approve, approve_plan).
    // Keep buffer on plan-revision so the user sees prior planner output during iteration.
    if (action === 'approve' || action === 'approve_plan') logBuffer.length = 0;

    sendApproval(action, { feedback });
    res.json({ ok: true });
});

app.post('/stop', (req, res) => {
    sendApproval('abort');
    logBuffer.length = 0;
    res.json({ ok: true });
});

app.get('/state', (req, res) => {
    res.json(getState());
});

app.get('/history', (req, res) => {
    res.json(getHistory());
});

(async () => {
    ensureRoleDocs();
    // Mark any tasks still RUNNING from a prior crash/restart as STALE. Build server
    // is the canonical owner of the tasks table — sweeping here (not in chat/warzone
    // boot) keeps the responsibility scoped to the process that creates tasks.
    sweepStaleRunningTasks();
    await connectNATS();

    subscribe('build.output', (payload) => {
        const entry = { agent: payload.agent, line: payload.line };
        logBuffer.push(entry);
        if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
        broadcast({ type: 'output', ...entry });
    });

    // Topic-scoped: only build-pipeline starts reach this subscriber. Warzone and chat
    // publish to their own <pipeline>.agent.started topics so they don't cross-contaminate.
    subscribe('build.agent.started', (payload) => {
        broadcast({ type: 'state', ...getState(), agentStarted: payload });
    });

    startWatcher('build');
    startWorkflow();

    server.listen(PORT, BIND_HOST, () => {
        console.log(`[build] Running at http://${BIND_HOST}:${PORT}`);
    });
})();
