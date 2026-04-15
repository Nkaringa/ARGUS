require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const { connectNATS, subscribe } = require('../core/events');
const { startWatcher } = require('../core/watcher');
const { startWorkflow, submitTask, sendApproval, getState, setBroadcast } = require('../workflows/build');
const { getHistory } = require('../core/db');
const { corsMiddleware, authMiddleware, wsAuth } = require('../core/auth');

const PORT = process.env.BUILD_PORT || 3002;
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

const app = express();
app.use(express.json());
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
    const { description } = req.body;
    if (!description || !description.trim()) {
        return res.status(400).json({ error: 'description required' });
    }
    try {
        logBuffer.length = 0;
        submitTask(description.trim());
        res.json({ ok: true });
    } catch (err) {
        res.status(409).json({ error: err.message });
    }
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
    await connectNATS();

    subscribe('build.output', (payload) => {
        const entry = { agent: payload.agent, line: payload.line };
        logBuffer.push(entry);
        if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
        broadcast({ type: 'output', ...entry });
    });

    subscribe('agent.started', (payload) => {
        broadcast({ type: 'state', ...getState(), agentStarted: payload });
    });

    startWatcher('build');
    startWorkflow();

    server.listen(PORT, BIND_HOST, () => {
        console.log(`[build] Running at http://${BIND_HOST}:${PORT}`);
    });
})();
