const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { publish } = require('./events');

const AGENTS_CONFIG = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'agents.json'), 'utf8')
);
const WORK_DIR = process.env.WORK_DIR;

// Wrap str in single quotes for safe shell interpolation.
// Single quotes prevent all shell expansion ($(), backticks, globbing).
// Embedded single quotes are escaped as: ' → '\''
function shellEscape(str) {
    return "'" + str.replace(/'/g, "'\\''") + "'";
}

function buildCommand(agentKey, task) {
    const agent = AGENTS_CONFIG[agentKey];
    if (!agent) throw new Error(`Unknown agent: ${agentKey}`);

    const cmd = agent.command
        .replace('"{task}"', shellEscape(task))
        .replace('{CLAUDE_SESSION_ID}', process.env.CLAUDE_SESSION_ID || '')
        .replace('{CODEX_SESSION_ID}', process.env.CODEX_SESSION_ID || '')
        .replace('{GEMINI_SESSION_ID}', process.env.GEMINI_SESSION_ID || '')
        .replace('{WORK_DIR}', WORK_DIR || '');

    return { cmd, agent };
}

function runAgent(agentKey, task, { outputTopic = 'agent.output', cwd } = {}) {
    const { cmd, agent } = buildCommand(agentKey, task);

    console.log(`[agents] Running ${agent.name}: ${cmd}`);
    publish('agent.started', { agent: agent.name, role: agent.role });

    const noiseRegexes = (agent.noisePatterns || []).map((p) => new RegExp(p));
    const isNoise = (line) => noiseRegexes.some((re) => re.test(line));

    return new Promise((resolve, reject) => {
        const proc = spawn('/bin/zsh', ['-c', cmd], {
            cwd: cwd || WORK_DIR,
            env: { ...process.env },
        });

        const timeout = setTimeout(() => {
            proc.kill();
            reject(new Error(`${agent.name} timed out after ${agent.timeout}ms`));
        }, agent.timeout);

        proc.stdout.on('data', (data) => {
            const line = data.toString().trim();
            if (line && !isNoise(line)) publish(outputTopic, { agent: agent.name, line });
        });

        if (!agent.suppressStderr) {
            proc.stderr.on('data', (data) => {
                const line = data.toString().trim();
                if (line && !isNoise(line)) publish(outputTopic, { agent: agent.name, line });
            });
        }

        proc.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve({ agent: agent.name, role: agent.role });
            } else {
                reject(new Error(`${agent.name} exited with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

module.exports = { runAgent, AGENTS_CONFIG };
