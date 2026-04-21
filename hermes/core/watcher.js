const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { publish } = require('./events');
const { parseTaskFile, parseWarzoneFile } = require('./archive');

const WORK_DIR = process.env.WORK_DIR;

// Build pipeline files: <slug>-Plan.md, <slug>-Build-Log.md, <slug>-Build-Feedback.md.
// Warzone discussion file: <slug>-WarZone.md.
// All globs are top-level only — Build-History/ and WarZone-History/ are excluded.
const PLAN_GLOB           = path.join(WORK_DIR, '*-Plan.md');
const BUILD_LOG_GLOB      = path.join(WORK_DIR, '*-Build-Log.md');
const BUILD_FEEDBACK_GLOB = path.join(WORK_DIR, '*-Build-Feedback.md');
const WARZONE_GLOB        = path.join(WORK_DIR, '*-WarZone.md');

const ITERATION_PATTERN   = /^### Iteration/m;
// Accept both `**Audit Grade:** A` and `**Audit Grade:** [A]` — auditors have written
// both variants depending on how they interpret the prompt template.
const GRADE_PATTERN       = /\*\*Audit Grade:\*\*\s*\[?([ABCF])\]?/;
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
        : [PLAN_GLOB, BUILD_LOG_GLOB, BUILD_FEEDBACK_GLOB];

    seedExistingFiles(mode === 'warzone'
        ? (name) => parseWarzoneFile(name) !== null
        : (name) => parseTaskFile(name) !== null);

    const watcher = chokidar.watch(filesToWatch, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
    });

    const handleBuildFile = (filePath) => {
        const filename = path.basename(filePath);
        const parsed = parseTaskFile(filename);
        if (!parsed) return; // unexpected — glob matched something we don't parse

        const current = readFile(filePath);
        const previous = lastContent.get(filePath) || '';
        if (current === previous) return;

        const delta = getNewContent(current, previous);
        lastContent.set(filePath, current);

        if (parsed.base === 'Plan.md') {
            // Planner overwrites their plan file. Content-change + pattern-match = ready.
            // awaitWriteFinish coalesces multi-chunk writes, so single-fire is guaranteed.
            if (PLAN_STATUS_PATTERN.test(current)) {
                console.log(`[watcher] ${filename} — plan ready`);
                publish('plan.completed', { file: filename });
            }
            return;
        }

        if (parsed.base === 'Build-Log.md') {
            if (delta && ITERATION_PATTERN.test(delta)) {
                console.log(`[watcher] ${filename} — new iteration appended`);
                publish('agent.completed', { role: 'build', file: filename });
            }
            return;
        }

        if (parsed.base === 'Build-Feedback.md') {
            if (!delta) return;
            const match = delta.match(GRADE_PATTERN);
            if (match) {
                console.log(`[watcher] ${filename} — grade: ${match[1]}`);
                publish('grade.received', { grade: match[1], file: filename });
            }
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
        : '*-Plan.md + *-Build-Log.md + *-Build-Feedback.md';
    console.log(`[watcher:${mode}] Watching ${watchLabel}`);
    return watcher;
}

module.exports = { startWatcher };
