require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const { connectNATS, subscribe } = require('../core/events');
const { startWatcher } = require('../core/watcher');
const { startWarzoneWorkflow, submitDiscuss, sendDiscussApproval, newDiscussion, getWarzoneState, setWarzoneBroadcast } = require('../workflows/warzone');
const { corsMiddleware, authMiddleware, wsAuth } = require('../core/auth');
const { ensureRoleDocs } = require('../core/role-docs');
const { listDiscussionHistory, readDiscussionHistory } = require('../core/archive');

const PORT = process.env.WARZONE_PORT || 3003;
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

const app = express();
app.use(express.json());
app.use(corsMiddleware);
app.use(authMiddleware);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const logBuffer = [];
const LOG_BUFFER_SIZE = 200;

function broadcast(payload) {
    const msg = JSON.stringify(payload);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
}

setWarzoneBroadcast(broadcast);

wss.on('connection', (ws, req) => {
    if (!wsAuth(req)) {
        ws.close(1008, 'Unauthorized');
        return;
    }
    ws.send(JSON.stringify({ type: 'state', ...getWarzoneState() }));
    if (logBuffer.length > 0) {
        ws.send(JSON.stringify({ type: 'log_replay', lines: logBuffer }));
    }
});

app.post('/discuss', (req, res) => {
    const { idea } = req.body;
    if (!idea || !idea.trim()) {
        return res.status(400).json({ error: 'idea required' });
    }
    try {
        logBuffer.length = 0;
        submitDiscuss(idea.trim());
        res.json({ ok: true });
    } catch (err) {
        res.status(409).json({ error: err.message });
    }
});

app.post('/discuss/approval', (req, res) => {
    const { action } = req.body;
    if (!['approve', 'abort'].includes(action)) {
        return res.status(400).json({ error: 'invalid action' });
    }
    sendDiscussApproval(action);
    res.json({ ok: true });
});

// POST /warzone/new-discussion — archive the current <slug>-WarZone.md and reset state
// so the next submit starts a fresh discussion topic (Claude picks a new slug).
// Only valid from idle or awaiting_discuss_approval — workflow throws otherwise.
app.post('/warzone/new-discussion', (req, res) => {
    try {
        newDiscussion();
        logBuffer.length = 0;
        res.json({ ok: true });
    } catch (err) {
        res.status(409).json({ error: err.message });
    }
});

app.post('/stop', (req, res) => {
    sendDiscussApproval('abort');
    logBuffer.length = 0;
    res.json({ ok: true });
});

app.get('/state', (req, res) => {
    res.json(getWarzoneState());
});

// GET /history/discussions — list archived discussions (newest first) for the Archive viewer.
app.get('/history/discussions', (req, res) => {
    res.json({ discussions: listDiscussionHistory() });
});

// GET /history/discussions/:slug — read the WarZone.md for one archived discussion.
app.get('/history/discussions/:slug', (req, res) => {
    const data = readDiscussionHistory(req.params.slug);
    if (!data) {
        return res.status(404).json({ error: 'archive not found' });
    }
    res.json(data);
});

// Serve the raw <slug>-WarZone.md for the active discussion so the UI can render
// the final discussion markdown after all three agents finish. The slug is the
// workflow's source of truth — we never scan the disk here.
// Intentionally simple — no caching, no parsing; the frontend owns parsing + rendering.
app.get('/warzone.md', (req, res) => {
    const { slug } = getWarzoneState();
    if (!slug) {
        return res.status(404).json({ error: 'No discussion in flight' });
    }
    const filePath = path.join(process.env.WORK_DIR, `${slug}-WarZone.md`);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `${slug}-WarZone.md does not exist yet` });
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.type('text/markdown').send(content);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

(async () => {
    ensureRoleDocs();
    await connectNATS();

    subscribe('warzone.output', (payload) => {
        const entry = { agent: payload.agent, line: payload.line };
        logBuffer.push(entry);
        if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
        broadcast({ type: 'output', ...entry });
    });

    // Topic-scoped agent-started events for the warzone pipeline. Mirrors the build server
    // pattern so the Warzone tab can reflect agent activity in real time without picking up
    // cross-pipeline noise.
    subscribe('warzone.agent.started', (payload) => {
        broadcast({ type: 'state', ...getWarzoneState(), agentStarted: payload });
    });

    startWatcher('warzone');
    startWarzoneWorkflow();

    server.listen(PORT, BIND_HOST, () => {
        console.log(`[warzone] Running at http://${BIND_HOST}:${PORT}`);
    });
})();
