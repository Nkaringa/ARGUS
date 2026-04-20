require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const { connectNATS, subscribe } = require('../core/events');
const { startWatcher } = require('../core/watcher');
const { startWorkflow, submitTask, sendApproval, getState, setBroadcast } = require('../workflows/build');
const { getHistory, sweepStaleRunningTasks } = require('../core/db');
const { corsMiddleware, authMiddleware, wsAuth } = require('../core/auth');
const { ensureRoleDocs } = require('../core/role-docs');
const { listProjectFolders, listBuildHistory, readBuildHistory, isValidTaskSlug } = require('../core/archive');
const { validateEnv } = require('../core/env');

validateEnv('build', {
    required: ['WORK_DIR'],
    recommend: ['CLAUDE_SESSION_ID', 'CODEX_SESSION_ID', 'GEMINI_SESSION_ID'],
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
    const { description, mode, slug } = req.body;
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
    try {
        logBuffer.length = 0;
        submitTask(description.trim(), {
            mode: submitMode,
            slug: submitMode === 'continue' ? slug.trim() : undefined,
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
    const { action } = req.body;
    if (!['approve', 'skip', 'retry', 'abort'].includes(action)) {
        return res.status(400).json({ error: 'invalid action' });
    }
    if (action === 'approve') logBuffer.length = 0;
    sendApproval(action);
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
