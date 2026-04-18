require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const { connectNATS, subscribe } = require('../core/events');
const { startWatcher } = require('../core/watcher');
const { startWarzoneWorkflow, submitDiscuss, sendDiscussApproval, getWarzoneState, setWarzoneBroadcast } = require('../workflows/warzone');
const { corsMiddleware, authMiddleware, wsAuth } = require('../core/auth');

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

app.post('/stop', (req, res) => {
    sendDiscussApproval('abort');
    logBuffer.length = 0;
    res.json({ ok: true });
});

app.get('/state', (req, res) => {
    res.json(getWarzoneState());
});

// Serve the raw WarZone.md so the UI can render the final discussion markdown
// after all three agents finish. Intentionally simple — no caching, no parsing here;
// the frontend owns parsing + markdown rendering.
app.get('/warzone.md', (req, res) => {
    const filePath = path.join(process.env.WORK_DIR, 'WarZone.md');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'WarZone.md does not exist yet' });
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.type('text/markdown').send(content);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

(async () => {
    await connectNATS();

    subscribe('warzone.output', (payload) => {
        const entry = { agent: payload.agent, line: payload.line };
        logBuffer.push(entry);
        if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
        broadcast({ type: 'output', ...entry });
    });

    startWatcher('warzone');
    startWarzoneWorkflow();

    server.listen(PORT, BIND_HOST, () => {
        console.log(`[warzone] Running at http://${BIND_HOST}:${PORT}`);
    });
})();
