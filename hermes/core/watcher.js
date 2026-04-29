const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { publish } = require('./events');
const { parseTaskFile, parseWarzoneFile } = require('./archive');

// Resolve WORK_DIR to its canonical on-disk case. macOS APFS is case-insensitive but
// case-preserving: `cd` and fs.readFile find the dir regardless of case, but fsevents
// reports paths with the real on-disk case, and chokidar's glob matcher is case-SENSITIVE.
// If .env says `/path/Karinga.dev` but disk has `karinga.dev`, every event gets silently
// dropped and the pipeline hangs. realpathSync collapses this class of bug before the
// glob pattern is ever built. Falls back to the raw value if resolution fails — the env
// validator in servers/*.js reports the missing dir separately.
const WORK_DIR = (() => {
    const raw = process.env.WORK_DIR;
    if (!raw) return raw;
    try {
        const resolved = fs.realpathSync(raw);
        if (resolved !== raw) {
            console.log(`[watcher] WORK_DIR normalized to canonical case: "${raw}" → "${resolved}"`);
        }
        return resolved;
    } catch {
        return raw;
    }
})();

// Build pipeline files: <slug>-Plan.md only — the Build-Log.md and Build-Feedback.md
// canonicals are now Hermes-owned and chmod 0o444 between iteration appends, so the
// watcher has no role for them. Build/audit completion is driven directly by the workflow
// from runAgent's resolve handler in workflows/build.js.
// Warzone discussion file: <slug>-WarZone.md.
// All globs are top-level only — Build-History/ and WarZone-History/ are excluded.
const PLAN_GLOB           = path.join(WORK_DIR, '*-Plan.md');
const WARZONE_GLOB        = path.join(WORK_DIR, '*-WarZone.md');

const PLAN_STATUS_PATTERN = /\*\*Plan Status:\*\*\s*READY/;

const CLAUDE_PLAN_DONE_PATTERN  = /\*\*Planner Status:\*\*\s*DONE/;
const GEMINI_BUILD_DONE_PATTERN = /\*\*Builder Status:\*\*\s*DONE/;
const CODEX_AUDIT_DONE_PATTERN  = /\*\*Auditor Status:\*\*\s*READY TO BUILD/;

// Per-file content tracking. Keyed by absolute filepath. Shared across build + warzone watchers.
// Agents may rewrite entire files (read-modify-write), which breaks byte-offset deltas;
// storing full content lets us compute the true new portion regardless.
const lastContent = new Map();

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
}

function getNewContent(current, lastKnown) {
    if (current === lastKnown) return '';
    if (current.startsWith(lastKnown)) {
        return current.slice(lastKnown.length);
    }
    let i = 0;
    const minLen = Math.min(current.length, lastKnown.length);
    while (i < minLen && current[i] === lastKnown[i]) i++;
    return current.slice(i);
}

// Seed last-known content for any matching files already on disk at startup.
// Live workspace should normally be empty (submitTask archives before invoking the planner;
// newDiscussion archives before the next warzone slug is created), but a mid-task restart
// could leave files in place — this prevents replay of pre-existing content.
function seedExistingFiles(matchPredicate) {
    let entries;
    try {
        entries = fs.readdirSync(WORK_DIR);
    } catch {
        return;
    }
    for (const name of entries) {
        if (!matchPredicate(name)) continue;
        const fp = path.join(WORK_DIR, name);
        lastContent.set(fp, readFile(fp));
    }
}

function startWatcher(mode = 'build') {
    const filesToWatch = mode === 'warzone'
        ? [WARZONE_GLOB]
        : [PLAN_GLOB];

    seedExistingFiles(mode === 'warzone'
        ? (name) => parseWarzoneFile(name) !== null
        : (name) => {
            const parsed = parseTaskFile(name);
            return parsed !== null && parsed.base === 'Plan.md';
        });

    // Ignore high-churn subtrees. fsevents on macOS reports events for the ENTIRE
    // WORK_DIR subtree (not just our top-level glob), so when WORK_DIR is pointed at
    // a real project root, node_modules/.next/.git activity can flood fsevents into
    // coalesced mode — new `*-Plan.md` / `*-WarZone.md` creations then get lost in
    // the noise and the watcher never fires. Dropping these paths at chokidar's
    // input layer keeps the queue responsive to the events that actually matter.
    const IGNORED_SUBTREES = /(?:^|[\\/])(?:node_modules|\.next|\.git|\.DS_Store|dist|build|\.turbo|\.vercel|coverage|\.cache)(?:[\\/]|$)/;

    const watcher = chokidar.watch(filesToWatch, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
        ignored: IGNORED_SUBTREES,
    });

    const handleBuildFile = (filePath) => {
        const filename = path.basename(filePath);
        const parsed = parseTaskFile(filename);
        // Build-Log.md / Build-Feedback.md no longer drive state transitions — they are
        // Hermes-owned canonicals appended under chmod control by the workflow's assemble
        // step. Only Plan.md remains a watched file-signal.
        if (!parsed || parsed.base !== 'Plan.md') return;

        const current = readFile(filePath);
        const previous = lastContent.get(filePath) || '';
        if (current === previous) return;
        lastContent.set(filePath, current);

        // Planner overwrites their plan file. Content-change + pattern-match = ready.
        // awaitWriteFinish coalesces multi-chunk writes, so single-fire is guaranteed.
        if (PLAN_STATUS_PATTERN.test(current)) {
            console.log(`[watcher] ${filename} — plan ready`);
            publish('plan.completed', { file: filename });
        }
    };

    const handleWarzoneFile = (filePath) => {
        const filename = path.basename(filePath);
        const slug = parseWarzoneFile(filename);
        if (!slug) return;

        const current = readFile(filePath);
        const previous = lastContent.get(filePath) || '';
        if (current === previous) return;

        const delta = getNewContent(current, previous);
        lastContent.set(filePath, current);
        if (!delta) return;

        // Order matters — check from most-advanced phase to earliest.
        if (CODEX_AUDIT_DONE_PATTERN.test(delta)) {
            console.log(`[watcher] ${filename} — Codex audit done (discussion complete)`);
            publish('discuss.complete', { file: filename });
            return;
        }
        if (GEMINI_BUILD_DONE_PATTERN.test(delta)) {
            console.log(`[watcher] ${filename} — Gemini build take done`);
            publish('discuss.gemini_done', { file: filename });
            return;
        }
        if (CLAUDE_PLAN_DONE_PATTERN.test(delta)) {
            console.log(`[watcher] ${filename} — Claude plan done`);
            publish('discuss.claude_done', { file: filename });
        }
    };

    const dispatch = (fp) => {
        const name = path.basename(fp);
        if (parseWarzoneFile(name)) return handleWarzoneFile(fp);
        if (parseTaskFile(name)) return handleBuildFile(fp);
    };
    watcher.on('add', dispatch);
    watcher.on('change', dispatch);
    // When a matched file is removed (archive move, manual delete), drop its stale
    // lastContent entry. Without this, if the same path is recreated later (e.g. a
    // continuation task after archival), the next delta is computed against the
    // old file's content, which can strip the iteration/grade marker out of the
    // delta and silently hang the pipeline in building/auditing.
    watcher.on('unlink', (fp) => { lastContent.delete(fp); });

    const watchLabel = mode === 'warzone'
        ? '*-WarZone.md'
        : '*-Plan.md';
    console.log(`[watcher:${mode}] Watching ${watchLabel}`);
    return watcher;
}

module.exports = { startWatcher };
