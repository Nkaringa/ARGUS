#!/usr/bin/env node
/*
 * Argus first-run env bootstrap.
 *
 * Called from scripts/dev.js as the very first step of main(). On true first
 * run (or when WORK_DIR is unset/empty/the literal placeholder), this:
 *   1. Copies hermes/.env.example → hermes/.env if .env doesn't exist
 *   2. Prompts the user for WORK_DIR (default: ../argus-workspace)
 *   3. Resolves the answer to an absolute path, mkdirs it if missing
 *   4. Writes WORK_DIR back to hermes/.env (surgical line replace)
 *
 * On returning runs (.env exists and WORK_DIR points at a real-looking value),
 * this is a silent no-op — hermes/core/env.js validates the actual path.
 *
 * On non-TTY callers (CI, docker -d, systemd) needing a prompt, fails fast
 * with an instructional error rather than hanging on stdin.
 *
 * Zero-dependency by design (matches dev.js): node builtins only, so this
 * works even if `npm install` half-succeeded.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const PLACEHOLDER = '/absolute/path/to/argus/your-project-folder';
const DEFAULT_REL = '../argus-workspace';
const MAX_PROMPT_RETRIES = 3;

const ROOT = path.resolve(__dirname, '..');

const COLOR = {
    green:  (s) => `\u001b[32m${s}\u001b[0m`,
    red:    (s) => `\u001b[31m${s}\u001b[0m`,
    yellow: (s) => `\u001b[33m${s}\u001b[0m`,
    bold:   (s) => `\u001b[1m${s}\u001b[0m`,
};
const ok   = (msg) => console.log(`${COLOR.green('✔')} ${msg}`);
const fail = (msg) => console.log(`${COLOR.red('✗')} ${msg}`);

// Returns 'needs-prompt' if WORK_DIR is unset/empty/the literal placeholder,
// 'real-looking' otherwise. We don't validate the path here — env.js does.
function classifyWorkDir(envContents) {
    const match = envContents.match(/^WORK_DIR=(.*)$/m);
    if (!match) return 'needs-prompt';
    const value = match[1].trim();
    if (value === '' || value === PLACEHOLDER) return 'needs-prompt';
    return 'real-looking';
}

// Surgical line-replace, atomic via tmp + rename. Preserves comments, blank
// lines, every other variable. Appends WORK_DIR= line if missing.
function writeWorkDir(envPath, absoluteWorkDir) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    let found = false;
    const next = lines.map((line) => {
        if (/^WORK_DIR=/.test(line)) {
            found = true;
            return `WORK_DIR=${absoluteWorkDir}`;
        }
        return line;
    });
    if (!found) next.push(`WORK_DIR=${absoluteWorkDir}`);
    const tmp = envPath + '.tmp';
    fs.writeFileSync(tmp, next.join('\n'));
    fs.renameSync(tmp, envPath);
}

// Resolve user-typed input to an absolute path. Empty → default.
// Tilde-expand. Relative → resolved against NK-Base itself (matches the
// shell intuition of "I ran npm run dev from this directory"). The default
// `../argus-workspace` therefore lands as a sibling to the argus clone.
function resolveUserPath(input) {
    const trimmed = input.trim() || DEFAULT_REL;
    let expanded = trimmed;
    if (expanded === '~') expanded = os.homedir();
    else if (expanded.startsWith('~/')) expanded = path.join(os.homedir(), expanded.slice(2));

    if (path.isAbsolute(expanded)) return path.resolve(expanded);
    return path.resolve(ROOT, expanded);
}

// Validate a resolved path. Returns null if usable; error string otherwise.
function validateWorkDir(resolved) {
    if (resolved === ROOT) {
        return `that's the argus clone itself — pick a separate folder`;
    }
    try {
        const st = fs.statSync(resolved);
        if (!st.isDirectory()) return `${resolved} exists but is a file, not a directory`;
        return null;
    } catch (err) {
        if (err.code === 'ENOENT') return null;
        return `unable to access ${resolved}: ${err.message}`;
    }
}

// readline prompt loop. Up to MAX_PROMPT_RETRIES on validation failure.
async function promptForWorkDir() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((res) => rl.question(q, res));
    try {
        for (let attempt = 0; attempt < MAX_PROMPT_RETRIES; attempt++) {
            const input = await ask(`Where should agents read, write, and build? [${DEFAULT_REL}]\n> `);
            const resolved = resolveUserPath(input);
            const err = validateWorkDir(resolved);
            if (err) { fail(err); continue; }
            return resolved;
        }
        throw new Error(
            `Could not pick a WORK_DIR after ${MAX_PROMPT_RETRIES} attempts. ` +
            `Set WORK_DIR manually in hermes/.env and re-run.`
        );
    } finally {
        rl.close();
    }
}

async function bootstrapEnv() {
    const envPath = path.join(ROOT, 'hermes', '.env');
    const examplePath = path.join(ROOT, 'hermes', '.env.example');

    // Step 1: ensure .env exists.
    if (!fs.existsSync(envPath)) {
        if (!fs.existsSync(examplePath)) {
            fail(`Cannot bootstrap: ${examplePath} is missing. Did the clone complete?`);
            process.exit(1);
        }
        fs.copyFileSync(examplePath, envPath);
    }

    // Step 2: classify WORK_DIR.
    const contents = fs.readFileSync(envPath, 'utf8');
    const status = classifyWorkDir(contents);
    if (status === 'real-looking') return; // silent — env.js validates the actual path

    // Step 3: needs prompt. Bail loud if non-TTY.
    if (!process.stdin.isTTY) {
        fail(`[setup] WORK_DIR is unset and stdin is non-interactive — cannot prompt.`);
        console.log(`  Set WORK_DIR in hermes/.env, e.g.:`);
        console.log(`    WORK_DIR=/absolute/path/to/your-project`);
        console.log(`  Or run npm run dev from a terminal to be prompted.\n`);
        process.exit(1);
    }

    // Step 4: prompt + mkdir + persist.
    console.log(`\n${COLOR.bold('First-run setup')}\n`);
    const resolved = await promptForWorkDir();

    if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
        ok(`Created ${resolved}`);
    }

    writeWorkDir(envPath, resolved);
    ok(`Saved WORK_DIR to hermes/.env`);
    console.log('');
}

module.exports = { bootstrapEnv, classifyWorkDir, resolveUserPath, validateWorkDir, writeWorkDir };

if (require.main === module) {
    bootstrapEnv().catch((err) => {
        fail(err.message || String(err));
        process.exit(1);
    });
}
