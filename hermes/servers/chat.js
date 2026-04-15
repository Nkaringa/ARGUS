require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const fs = require('fs');
const path = require('path');

const { connectNATS, subscribe } = require('../core/events');
const { runAgent } = require('../core/agents');
const { corsMiddleware, authMiddleware, wsAuth } = require('../core/auth');

const PORT = process.env.CHAT_PORT || 3001;
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';
const WORK_DIR = process.env.WORK_DIR;
// Gemini runs in CHAT_DIR — separate from WORK_DIR so it doesn't load the build GEMINI.md
// We write our own GEMINI.md here with project context (but no logging instructions)
const CHAT_DIR = process.env.CHAT_DIR || os.homedir();

function ensureChatGeminiMd() {
    const geminiDir = path.join(CHAT_DIR, '.gemini');
    const geminiMd = path.join(geminiDir, 'GEMINI.md');
    fs.mkdirSync(geminiDir, { recursive: true });
    fs.writeFileSync(geminiMd, `# Argus — Chat Mode

You are in direct chat mode. You are NOT in a build pipeline.

**Project root:** ${WORK_DIR}

## Project layout
- \`hermes/\` — orchestration engine (Node.js)
  - \`core/\` — shared infra (NATS, agents, DB, watcher)
  - \`workflows/\` — XState state machines (build, warzone)
  - \`servers/\` — Express + WebSocket servers (chat:3001, build:3002, warzone:3003)
- \`argus-ui/\` — frontend (React + TypeScript + Vite, port 5173)
- \`Plan.md\` — Claude's plan for the current task (overwritten per task)
- \`Build-Log.md\` — Gemini's iteration log
- \`Build-Feedback.md\` — Codex's audit feedback
- \`WarZone.md\` — three-agent discussion log

## Rules
- When the user asks about files or code, look in the project root above
- Do NOT write to Plan.md, Build-Log.md, Build-Feedback.md, or WarZone.md
- Do NOT modify anything in hermes/
`);
    console.log(`[chat] Wrote project context to ${geminiMd}`);
}

const app = express();
app.use(express.json());
app.use(corsMiddleware);
app.use(authMiddleware);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    if (!wsAuth(req)) {
        ws.close(1008, 'Unauthorized');
    }
});

function broadcast(payload) {
    const msg = JSON.stringify(payload);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
}

// POST /chat — send a message to an agent
// Body: { agent, prompt, history?: Array<{ role: 'user'|'agent', text: string }> }
app.post('/chat', (req, res) => {
    const { agent, prompt, history = [] } = req.body;
    if (!agent || !prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'agent and prompt required' });
    }
    if (!['builder', 'planner', 'codex_auditor'].includes(agent)) {
        return res.status(400).json({ error: 'agent must be builder, planner, or codex_auditor' });
    }

    // Build a prompt that includes recent conversation history for context
    const recentHistory = history.slice(-10);
    const historyText = recentHistory
        .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.text}`)
        .join('\n');
    const fullPrompt = historyText.length > 0
        ? `${historyText}\n\nHuman: ${prompt.trim()}`
        : prompt.trim();

    // Gemini runs in CHAT_DIR (no .gemini/ there = won't log to Build-Log.md)
    // Claude + Codex run in WORK_DIR (sessions are project-scoped — must match where session was created)
    const agentCwd = agent === 'builder' ? CHAT_DIR : process.env.WORK_DIR;

    res.json({ ok: true });
    runAgent(agent, fullPrompt, {
        outputTopic: 'chat.output',
        cwd: agentCwd,
    }).catch((err) => {
        broadcast({ type: 'chat_output', agent, line: `[error] ${err.message}` });
    });
});

(async () => {
    ensureChatGeminiMd();
    await connectNATS();

    subscribe('chat.output', (payload) => {
        const agentKey =
            payload.agent === 'Gemini' ? 'builder' :
            payload.agent === 'Claude' ? 'planner' :
            payload.agent === 'Codex'  ? 'codex_auditor' :
            null;
        if (!agentKey) return;
        broadcast({ type: 'chat_output', agent: agentKey, line: payload.line });
    });

    server.listen(PORT, BIND_HOST, () => {
        console.log(`[chat] Running at http://${BIND_HOST}:${PORT}`);
        console.log(`[chat] Agent cwd: ${CHAT_DIR}`);
    });
})();
