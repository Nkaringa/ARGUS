const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { publish } = require('./events');

const WORK_DIR = process.env.WORK_DIR;
const PLAN_FILE          = path.join(WORK_DIR, 'Plan.md');
const BUILD_LOG_FILE     = path.join(WORK_DIR, 'Build-Log.md');
const BUILD_FEEDBACK_FILE = path.join(WORK_DIR, 'Build-Feedback.md');
const WARZONE_FILE       = path.join(WORK_DIR, 'WarZone.md');

const ITERATION_PATTERN        = /^### Iteration/m;
const GRADE_PATTERN            = /\*\*Audit Grade:\*\*\s*([ABCF])/;
const PLAN_STATUS_PATTERN      = /\*\*Plan Status:\*\*\s*READY/;

// Warzone three-phase markers
const CLAUDE_PLAN_DONE_PATTERN  = /\*\*Planner Status:\*\*\s*DONE/;
const GEMINI_BUILD_DONE_PATTERN = /\*\*Builder Status:\*\*\s*DONE/;
const CODEX_AUDIT_DONE_PATTERN  = /\*\*Auditor Status:\*\*\s*READY TO BUILD/;

// Track last known content — not byte offsets.
// Agents may rewrite entire files (read-modify-write), which breaks byte-offset deltas.
// By storing the full content, we can always compute the true new portion,
// even if the file was rewritten with the same prefix.
let lastPlanContent = '';
let lastBuildLogContent = '';
let lastBuildFeedbackContent = '';
let lastWarzoneContent = '';

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
}

// Extract the new content by stripping the known prefix.
// If the file was rewritten and old content changed (different prefix),
// fall back to scanning from the first point of difference.
function getNewContent(current, lastKnown) {
    if (current === lastKnown) return '';
    if (current.startsWith(lastKnown)) {
        return current.slice(lastKnown.length);
    }
    // File was rewritten — find where old and new diverge.
    // Only scan from the divergence point forward.
    let i = 0;
    const minLen = Math.min(current.length, lastKnown.length);
    while (i < minLen && current[i] === lastKnown[i]) i++;
    return current.slice(i);
}

// mode: 'build'   → watches Plan.md + Build-Log.md + Build-Feedback.md
// mode: 'warzone' → watches WarZone.md only
function startWatcher(mode = 'build') {
    const filesToWatch = mode === 'warzone'
        ? [WARZONE_FILE]
        : [PLAN_FILE, BUILD_LOG_FILE, BUILD_FEEDBACK_FILE];

    // Seed with current content so we only process content written after startup.
    // Plan.md is deleted by submitTask before each task — so at steady state this
    // seed is '', and any subsequent Claude write is unambiguously a new plan.
    if (fs.existsSync(PLAN_FILE))           lastPlanContent          = readFile(PLAN_FILE);
    if (fs.existsSync(BUILD_LOG_FILE))      lastBuildLogContent      = readFile(BUILD_LOG_FILE);
    if (fs.existsSync(BUILD_FEEDBACK_FILE)) lastBuildFeedbackContent = readFile(BUILD_FEEDBACK_FILE);
    if (fs.existsSync(WARZONE_FILE))        lastWarzoneContent       = readFile(WARZONE_FILE);

    const watcher = chokidar.watch(filesToWatch, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
    });

    const handleBuildFile = (filePath) => {
        const current = readFile(filePath);

        if (filePath === PLAN_FILE && current !== lastPlanContent) {
            lastPlanContent = current;
            // Plan.md is deleted before each task by submitTask and then written fresh
            // by the planner. Content-change + pattern-match = the plan is ready.
            // awaitWriteFinish coalesces multi-chunk writes, so single-fire is guaranteed.
            if (PLAN_STATUS_PATTERN.test(current)) {
                console.log('[watcher] Plan.md — plan ready');
                publish('plan.completed', {});
            }
        }

        if (filePath === BUILD_LOG_FILE && current !== lastBuildLogContent) {
            const delta = getNewContent(current, lastBuildLogContent);
            lastBuildLogContent = current;
            if (delta && ITERATION_PATTERN.test(delta)) {
                console.log('[watcher] Build-Log.md — new iteration appended');
                publish('agent.completed', { role: 'build' });
            }
        }

        if (filePath === BUILD_FEEDBACK_FILE && current !== lastBuildFeedbackContent) {
            const delta = getNewContent(current, lastBuildFeedbackContent);
            lastBuildFeedbackContent = current;
            if (delta) {
                const match = delta.match(GRADE_PATTERN);
                if (match) {
                    console.log(`[watcher] Build-Feedback.md — grade: ${match[1]}`);
                    publish('grade.received', { grade: match[1] });
                }
            }
        }
    };

    const handleWarzoneFile = (filePath) => {
        const current = readFile(filePath);
        if (current === lastWarzoneContent) return;
        const delta = getNewContent(current, lastWarzoneContent);
        lastWarzoneContent = current;
        if (!delta) return;
        // Order matters — check from most-advanced phase to earliest.
        // A single write may contain multiple markers; prefer the latest one.
        if (CODEX_AUDIT_DONE_PATTERN.test(delta)) {
            console.log('[watcher] WarZone.md — Codex audit done (discussion complete)');
            publish('discuss.complete', {});
            return;
        }
        if (GEMINI_BUILD_DONE_PATTERN.test(delta)) {
            console.log('[watcher] WarZone.md — Gemini build take done');
            publish('discuss.gemini_done', {});
            return;
        }
        if (CLAUDE_PLAN_DONE_PATTERN.test(delta)) {
            console.log('[watcher] WarZone.md — Claude plan done');
            publish('discuss.claude_done', {});
        }
    };

    // 'add' fires when a file is created after watching starts
    // 'change' fires for subsequent edits
    watcher.on('add',    (fp) => fp === WARZONE_FILE ? handleWarzoneFile(fp) : handleBuildFile(fp));
    watcher.on('change', (fp) => fp === WARZONE_FILE ? handleWarzoneFile(fp) : handleBuildFile(fp));

    const watchLabel = mode === 'warzone'
        ? 'WarZone.md'
        : 'Plan.md + Build-Log.md + Build-Feedback.md';
    console.log(`[watcher:${mode}] Watching ${watchLabel}`);
    return watcher;
}

module.exports = { startWatcher };
