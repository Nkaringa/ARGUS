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
const { validateEnv } = require('../core/env');

validateEnv('chat', {
    required: ['WORK_DIR'],
});

const PORT = process.env.CHAT_PORT || 3001;
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';
const WORK_DIR = process.env.WORK_DIR;
// Gemini runs in CHAT_DIR — separate from WORK_DIR so it doesn't load the build GEMINI.md
// We write our own GEMINI.md here with project context (but no logging instructions).
// Default to a dedicated tmp dir rather than os.homedir() — the previous homedir fallback
// would clobber the user's real ~/.gemini/GEMINI.md (the one Gemini CLI loads for every
// unscoped invocation). If CHAT_DIR is explicitly set to homedir, refuse to boot.
const CHAT_DIR = process.env.CHAT_DIR || path.join('/tmp', 'argus-chat');
if (path.resolve(CHAT_DIR) === path.resolve(os.homedir())) {
    console.error(
        `[chat] Refusing to start: CHAT_DIR is set to the home directory (${CHAT_DIR}).\n` +
        '       That would overwrite your global ~/.gemini/GEMINI.md. ' +
        'Set CHAT_DIR to a dedicated path (e.g. /tmp/argus-chat).',
    );
    process.exit(1);
}

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
- \`<slug>/\` — deliverable folder per project (HTML, CSS, JS, code Gemini wrote). One folder per slug.
- \`<slug>-Plan.md\` — Claude's plan for the active task (one per task; slug chosen by Claude or set by the user via "Continue: <slug>")
- \`<slug>-Build-Log.md\` — Gemini's iteration log for the active task
- \`<slug>-Build-Feedback.md\` — Codex's audit feedback for the active task
- \`<slug>-WarZone.md\` — three-agent discussion log for the active warzone topic
- \`Build-History/\` — archive of past build tasks' meta files; each subfolder is one completed or aborted task
- \`WarZone-History/\` — archive of past discussion topics; each subfolder is one closed discussion

## Rules
- ANSWER THE USER'S QUESTION DIRECTLY. This is casual chat, not a task assignment. Keep responses concise and conversational.
- Do NOT read project files proactively. Only read files when the user explicitly names a specific file or folder in the project and asks you to examine it. General questions ("what do you think about X") are answered from your own knowledge, not from project files — even if the project contains files related to X.
- Do NOT write to any \`*-Plan.md\`, \`*-Build-Log.md\`, \`*-Build-Feedback.md\`, or \`*-WarZone.md\` file.
- Do NOT touch the Build-History/ or WarZone-History/ folders.
- Do NOT modify anything in hermes/.

## Examples
- User: "what is prompt caching?" → answer from your own knowledge. Do not read any files.
- User: "what's in my landing-page project?" → the user named a specific folder. Read \`landing-page/\` and summarize.
- User: "look at the plan for token-optimization" → the user named a specific file context. Read the relevant file and report on it.
`);
    console.log(`[chat] Wrote project context to ${geminiMd}`);
}

const app = express();
// POST /chat includes a prompt + recent history (last 10 messages, each typically a
// few hundred chars). 256 KB is ~5x the expected worst case and still small enough
// to reject runaway payloads.
app.use(express.json({ limit: '256kb' }));
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

    // Build a prompt that includes recent conversation history for context.
    // Filter out prior error broadcasts (lines like `[error] Gemini exited with code 42`)
    // — those were UI breadcrumbs, not actual agent turns. Including them would have
    // Gemini "see" itself errored and respond to its own prior failure as if it were real.
    const recentHistory = history
        .filter((m) => !(m.role === 'agent' && typeof m.text === 'string' && m.text.startsWith('[error]')))
        .slice(-10);
    const historyText = recentHistory
        .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.text}`)
        .join('\n');
    const fullPrompt = historyText.length > 0
        ? `${historyText}\n\nHuman: ${prompt.trim()}`
        : prompt.trim();

    // Gemini chat runs in CHAT_DIR (not WORK_DIR) so it loads a chat-specific
    // .gemini/GEMINI.md — the build-mode role doc tells Gemini to log every turn
    // to Build-Log.md, which would corrupt the build pipeline's files if chat used it.
    // The dedicated `chat_builder` agent key exists so we can route here cleanly.
    // Claude and Codex don't need the split — their cwd is WORK_DIR and their role
    // docs already handle chat-vs-build context.
    const agentKey = agent === 'builder' ? 'chat_builder' : agent;
    const agentCwd = agent === 'builder' ? CHAT_DIR : process.env.WORK_DIR;

    res.json({ ok: true });
    runAgent(agentKey, fullPrompt, {
        outputTopic: 'chat.output',
        pipeline: 'chat',
        cwd: agentCwd,
        // Chat has no task concept. Pass null explicitly so chat.agent.completed
        // rows are unattributed by design (not by accident). Unify later.
        taskId: null,
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
