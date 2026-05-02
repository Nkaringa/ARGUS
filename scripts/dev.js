#!/usr/bin/env node
/*
 * Argus dev orchestrator.
 *
 * What this does (in order):
 *   1. Preflight checks — verify nats-server is installed, inspect port 4222.
 *   2. Start nats-server ourselves, OR reuse an existing one already on 4222.
 *   3. Wait until port 4222 is accepting connections before spawning hermes.
 *   4. Spawn chat / build / warzone / ui via `concurrently`, streaming their
 *      output with colored prefixes.
 *   5. Forward SIGINT/SIGTERM so Ctrl+C tears the whole tree down cleanly.
 *
 * This script is intentionally zero-dependency (only uses node builtins + the
 * already-present `concurrently` + `nats` packages). Keeping it dependency-free
 * means `npm install` doesn't need to succeed before `npm run dev` can diagnose
 * environment problems.
 */

const { spawn, spawnSync } = require('child_process');
const net = require('net');
const path = require('path');
const { bootstrapEnv } = require('./setup-env');

const NATS_PORT = 4222;
const NATS_HOST = '127.0.0.1';
const WAIT_TIMEOUT_MS = 10000;
const CHECK_INTERVAL_MS = 100;

const ROOT = path.resolve(__dirname, '..');

const COLOR = {
    green: (s) => `\u001b[32m${s}\u001b[0m`,
    red:   (s) => `\u001b[31m${s}\u001b[0m`,
    gray:  (s) => `\u001b[90m${s}\u001b[0m`,
    bold:  (s) => `\u001b[1m${s}\u001b[0m`,
};

const ok = (msg) => console.log(`${COLOR.green('✔')} ${msg}`);
const fail = (msg) => console.log(`${COLOR.red('✗')} ${msg}`);
const banner = (msg) => console.log(`\n${COLOR.bold(msg)}\n`);

// Check whether a binary is resolvable on PATH. `where` on Windows, `which`
// elsewhere. spawnSync is portable; we check stdout for a real path rather
// than trusting exit code alone (some shells return 0 with empty output).
function isBinaryInstalled(name) {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(cmd, [name], { encoding: 'utf8' });
    return result.status === 0 && result.stdout.trim().length > 0;
}

// Probe a TCP port. Resolves with:
//   { state: 'free' }                 — nothing listening
//   { state: 'nats' }                 — something listening that speaks NATS
//   { state: 'other', data: '...' }   — something listening that doesn't
//
// NATS servers send an INFO frame immediately on connect. We read up to 256 bytes
// or 500ms and check if the response starts with `INFO `. That's enough to
// distinguish NATS from an unrelated service (HTTP server, redis, etc.).
function probePort(host, port) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host, port });
        let chunks = '';
        let done = false;

        const finish = (result) => {
            if (done) return;
            done = true;
            try { socket.destroy(); } catch { /* ignore */ }
            resolve(result);
        };

        socket.setTimeout(500);

        socket.on('connect', () => {
            // Connected; now wait briefly for the server's greeting.
            // NATS sends INFO immediately; HTTP servers usually send nothing
            // until we send a request, which will trip the timeout below.
        });
        socket.on('data', (buf) => {
            chunks += buf.toString('utf8');
            if (chunks.length >= 5) {
                finish(chunks.startsWith('INFO ')
                    ? { state: 'nats' }
                    : { state: 'other', data: chunks.slice(0, 80) });
            }
        });
        socket.on('timeout', () => {
            // Connected but no greeting — probably not NATS (or a slow/misconfigured one).
            if (chunks.length === 0) {
                finish({ state: 'other', data: '(no greeting)' });
            } else {
                finish({ state: 'other', data: chunks.slice(0, 80) });
            }
        });
        socket.on('error', (err) => {
            // ECONNREFUSED means nothing's listening. Any other error we treat as
            // "port unusable" — the user will see the message and investigate.
            if (err.code === 'ECONNREFUSED') {
                finish({ state: 'free' });
            } else {
                finish({ state: 'other', data: err.code });
            }
        });
    });
}

// Poll a port until it accepts a NATS-speaking connection or the timeout hits.
async function waitForNats(host, port, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const probe = await probePort(host, port);
        if (probe.state === 'nats') return;
        await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
    }
    throw new Error(`Timed out waiting for NATS on ${host}:${port} (${timeoutMs}ms)`);
}

function printInstallHelp() {
    console.log(`
${COLOR.bold('Install nats-server:')}
  macOS:          brew install nats-server
  Linux (Go):     go install github.com/nats-io/nats-server/v2@latest
  Linux (binary): https://nats.io/download — drop into /usr/local/bin
  Windows:        scoop install nats-server   (or choco install nats-server)
  Docker:         docker run -d -p 4222:4222 nats:latest

Then run: npm run dev
`);
}

async function main() {
    await bootstrapEnv();
    banner('Checking environment...');

    // (1) Is nats-server installed?
    if (!isBinaryInstalled('nats-server')) {
        fail('nats-server not found in PATH');
        printInstallHelp();
        process.exit(1);
    }
    ok('NATS binary found');

    // (2) What's on port 4222?
    const probe = await probePort(NATS_HOST, NATS_PORT);

    const children = [];
    const killChildren = (signal = 'SIGTERM') => {
        for (const c of children) {
            if (!c.killed) { try { c.kill(signal); } catch { /* ignore */ } }
        }
    };
    // Single shared shutdown path for Ctrl+C, SIGTERM, and uncaught errors.
    // concurrently handles its own children; we just need to stop nats-server
    // and concurrently itself.
    process.on('SIGINT',  () => { killChildren('SIGINT');  });
    process.on('SIGTERM', () => { killChildren('SIGTERM'); });

    if (probe.state === 'nats') {
        ok(`Port ${NATS_PORT} in use (existing NATS detected) → reusing`);
    } else if (probe.state === 'free') {
        ok(`Port ${NATS_PORT} free → starting NATS`);

        const nats = spawn('nats-server', ['-p', String(NATS_PORT)], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        children.push(nats);

        // Surface nats failures immediately — without this, a crash inside NATS
        // would just hang waitForNats() until the timeout.
        nats.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                fail(`nats-server exited with code ${code}`);
                killChildren('SIGTERM');
                process.exit(1);
            }
        });
        nats.on('error', (err) => {
            fail(`Failed to spawn nats-server: ${err.message}`);
            process.exit(1);
        });

        try {
            await waitForNats(NATS_HOST, NATS_PORT, WAIT_TIMEOUT_MS);
        } catch (err) {
            fail(err.message);
            killChildren('SIGTERM');
            process.exit(1);
        }
        ok('NATS ready');
    } else {
        fail(`Port ${NATS_PORT} is in use by a non-NATS process (${probe.data})`);
        console.log(`  Stop that process or change NATS's port, then re-run.\n`);
        process.exit(1);
    }

    // (3) Hand off to concurrently for the rest.
    banner('Starting Argus...');

    const concurrentlyBin = path.join(ROOT, 'node_modules', '.bin',
        process.platform === 'win32' ? 'concurrently.cmd' : 'concurrently');

    const concurrentlyArgs = [
        '-n', 'chat,build,warzone,ui',
        '--prefix-colors', 'cyan,green,yellow,magenta',
        '--kill-others-on-fail',
        'node hermes/servers/chat.js',
        'node hermes/servers/build.js',
        'node hermes/servers/warzone.js',
        'npm run dev --workspace argus-ui',
    ];

    const servers = spawn(concurrentlyBin, concurrentlyArgs, {
        stdio: 'inherit',
        cwd: ROOT,
    });
    children.push(servers);

    servers.on('exit', (code, signal) => {
        killChildren('SIGTERM');
        // Propagate the exit code so CI or parent shells see the right status.
        process.exit(code ?? (signal ? 1 : 0));
    });
}

main().catch((err) => {
    console.error(COLOR.red('\nFatal error in dev orchestrator:'), err);
    process.exit(1);
});
