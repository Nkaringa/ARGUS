const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { publish } = require('./events');

const AGENTS_CONFIG = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'agents.json'), 'utf8')
);
const WORK_DIR = process.env.WORK_DIR;

// Per-line size cap on agent stdout/stderr. Lines longer than this are truncated and
// suffixed with a marker. Defends against pathological agents that flush megabytes of
// text without newlines (rare but possible — e.g. minified JSON, large stack traces).
// 4 KB is generous: typical lines are 100-200 chars; the cap only trips on outliers.
const MAX_LINE_BYTES = 4 * 1024;

// Grace period between SIGTERM and SIGKILL when a timeout fires. CLIs that catch
// SIGTERM and clean up get a chance; CLIs that ignore it get killed for sure.
const KILL_GRACE_MS = 2000;

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
        .replace('{WORK_DIR}', WORK_DIR || '');

    return { cmd, agent };
}

function truncateLine(line) {
    if (line.length <= MAX_LINE_BYTES) return line;
    const head = line.slice(0, MAX_LINE_BYTES);
    const dropped = line.length - MAX_LINE_BYTES;
    return `${head} …(truncated, ${dropped} more chars)`;
}

// (1) spawn — child process only. No event wiring. Returns the process handle.
// Uses /bin/sh: POSIX-guaranteed on every Unix system; the previous /bin/zsh
// hardcode broke Linux distros that don't ship zsh by default. All commands in
// agents.json use plain POSIX `-c` syntax (no zsh-specific globbing or expansions),
// so /bin/sh is a strictly more portable choice with no functional regression.
function spawnAgent(cmd, cwd) {
    return spawn('/bin/sh', ['-c', cmd], {
        cwd: cwd || WORK_DIR,
        env: { ...process.env },
    });
}

// (2) output stream — readline interface for both stdout and stderr (when not suppressed).
// Each `line` event carries one actual line (Node's readline handles the buffering and
// newline detection). Per-line size cap defends against no-newline mega-chunks.
// Returns a teardown function that detaches the readline interfaces — used by the timeout
// path to stop publishing for an aborted task whose process refuses to die.
function attachOutputStream(proc, agent, outputTopic, isNoise) {
    const interfaces = [];

    const wireStream = (stream) => {
        if (!stream) return;
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        rl.on('line', (raw) => {
            const line = truncateLine(raw);
            if (line && !isNoise(line)) {
                publish(outputTopic, { agent: agent.name, line });
            }
        });
        interfaces.push(rl);
    };

    wireStream(proc.stdout);
    if (!agent.suppressStderr) {
        wireStream(proc.stderr);
    }

    return function teardown() {
        for (const rl of interfaces) {
            try { rl.removeAllListeners(); rl.close(); } catch { /* ignore */ }
        }
        try { proc.stdout && proc.stdout.removeAllListeners(); } catch { /* ignore */ }
        try { proc.stderr && proc.stderr.removeAllListeners(); } catch { /* ignore */ }
    };
}

// (3) lifecycle events — start + completed events go to a per-pipeline NATS topic so
// build/warzone/chat events don't cross-contaminate consumers. Pipeline-prefixed topics
// mirror the existing build.output / warzone.output / chat.output convention. Falls back
// to the global `agent.started` if no pipeline is provided (defensive default).
function publishStart(pipeline, agent) {
    const topic = pipeline ? `${pipeline}.agent.started` : 'agent.started';
    publish(topic, { agent: agent.name, role: agent.role });
}

function publishCompleted(pipeline, agent, durationMs, exitCode) {
    const topic = pipeline ? `${pipeline}.agent.completed` : 'agent.completed';
    publish(topic, { agent: agent.name, role: agent.role, durationMs, exitCode });
}

// (4) timeout — SIGTERM, then SIGKILL after grace, with explicit listener teardown so
// a child that ignores SIGTERM stops polluting NATS once the state machine has moved on.
// Returns a `clear` function the close handler calls to cancel both timers.
function attachTimeout(proc, agent, teardownStreams) {
    let killed = false;
    const sigtermTimer = setTimeout(() => {
        killed = true;
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
        // Stop publishing immediately — the state machine is about to be told this
        // call timed out; further stdout for this dead-from-state-machine call is noise.
        teardownStreams();
        sigkillTimer = setTimeout(() => {
            if (proc.exitCode === null && proc.signalCode === null) {
                console.warn(`[agents] ${agent.name} ignored SIGTERM; sending SIGKILL`);
                try { proc.kill('SIGKILL'); } catch { /* ignore */ }
            }
        }, KILL_GRACE_MS);
    }, agent.timeout);

    let sigkillTimer = null;

    return {
        clear: () => {
            clearTimeout(sigtermTimer);
            if (sigkillTimer) clearTimeout(sigkillTimer);
        },
        wasKilled: () => killed,
    };
}

// runAgent — orchestrator. The four helpers above each own one responsibility; this
// function just wires them together and exposes a Promise<{agent, role}> to the caller.
//
// opts:
//   - outputTopic   per-pipeline NATS subject for stdout/stderr lines (default 'agent.output')
//   - pipeline      'build' | 'warzone' | 'chat' — namespaces start/completed events
//   - cwd           override for child process working directory
function runAgent(agentKey, task, { outputTopic = 'agent.output', pipeline, cwd } = {}) {
    const { cmd, agent } = buildCommand(agentKey, task);

    console.log(`[agents] Running ${agent.name}: ${cmd}`);
    publishStart(pipeline, agent);

    const noiseRegexes = (agent.noisePatterns || []).map((p) => new RegExp(p));
    const isNoise = (line) => noiseRegexes.some((re) => re.test(line));

    const startedAt = Date.now();
    const proc = spawnAgent(cmd, cwd);
    const teardownStreams = attachOutputStream(proc, agent, outputTopic, isNoise);
    const timeout = attachTimeout(proc, agent, teardownStreams);

    return new Promise((resolve, reject) => {
        proc.on('close', (code) => {
            timeout.clear();
            const durationMs = Date.now() - startedAt;
            publishCompleted(pipeline, agent, durationMs, code);
            if (timeout.wasKilled()) {
                // Streams were already torn down when the timeout fired.
                reject(new Error(`${agent.name} timed out after ${agent.timeout}ms`));
                return;
            }
            teardownStreams();
            if (code === 0) {
                resolve({ agent: agent.name, role: agent.role });
            } else {
                reject(new Error(`${agent.name} exited with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            timeout.clear();
            teardownStreams();
            reject(err);
        });
    });
}

module.exports = { runAgent, AGENTS_CONFIG };
