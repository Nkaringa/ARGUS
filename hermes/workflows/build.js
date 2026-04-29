const fs = require('fs');
const path = require('path');
const { createMachine, createActor } = require('xstate');
const { subscribe, publish } = require('../core/events');
const { runAgent } = require('../core/agents');
const { archiveLiveFiles, isValidTaskSlug } = require('../core/archive');
const { logEvent, createTask, completeTask, getHistory } = require('../core/db');
const { assembleAndAppend, lockCanonical, MetaFileError } = require('../core/meta-files');

// Approval state has historically blocked indefinitely — if the user steps away after a B/C/F,
// the pipeline waits forever. Configurable safety net so the state machine self-aborts and
// archives the partial work instead of hanging. Default 30 minutes; override via env for ops.
const APPROVAL_TIMEOUT_MS = Number(process.env.APPROVAL_TIMEOUT_MS) || 30 * 60 * 1000;
const WORK_DIR = process.env.WORK_DIR;

let currentTaskId = null;
let currentTask = null;
let currentSlug = null;
// 'new' = Claude picks the slug (set by plan.completed). 'continue' = slug pre-set
// from the UI selector before the planner is invoked. Drives prompt branching and
// the slug-mismatch drift safeguard in the plan.completed handler.
let currentMode = 'new';
let retryCount = 0;
let iterationCount = 0;
let lastGrade = null;
let broadcastFn = null;

function setBroadcast(fn) {
    broadcastFn = fn;
}

function broadcast(state, extra = {}) {
    if (broadcastFn) {
        broadcastFn({ type: 'state', state, task: currentTask, iteration: iterationCount, ...extra });
    }
}

// Forward declaration — closures capture `service` by reference; it is assigned before
// service.start() is ever called, so this is always resolved by the time actions fire.
let service;

function launchPlanner() {
    if (!currentTask) return;
    logEvent('agent.started', { role: 'plan', task: currentTask, mode: currentMode, slug: currentSlug }, currentTaskId);

    let plannerPrompt;
    if (currentMode === 'continue' && currentSlug) {
        const planFile = `${currentSlug}-Plan.md`;
        plannerPrompt = `You are the PLANNER in the Argus build pipeline. Read .claude/CLAUDE.md for your role spec. Task: ${currentTask}

This is a CONTINUATION of the existing project \`${currentSlug}\`. Do NOT pick a new slug. The slug is fixed: \`${currentSlug}\`.

1. Read the existing files inside \`${currentSlug}/\` to understand what's already built.
2. Write your plan to \`${planFile}\` at the project root (overwrite if it exists from a prior iteration).
3. List "Files to Touch" as paths inside \`${currentSlug}/\` (e.g. \`${currentSlug}/index.html\`). Reference existing files when modifying them; new files also go inside \`${currentSlug}/\`.
4. End the file with the exact line \`**Plan Status:** READY\` — Hermes watches for that line to advance the pipeline.

Scope rules:
- You may only plan work inside \`${currentSlug}/\` for deliverables. Meta files (\`${planFile}\`, \`${currentSlug}-Build-Log.md\`, \`${currentSlug}-Build-Feedback.md\`) live at the project root.
- Do NOT propose changes to anything outside it — including hermes/, argus-ui/, landing/, any role-doc folder (.claude/, .gemini/, .codex/), Build-History/, or any parent/sibling directory. Those are argus's own codebase, not the user's project.
- Do NOT write code — Gemini will implement from your plan.`;
    } else {
        plannerPrompt = `You are the PLANNER in the Argus build pipeline. Read .claude/CLAUDE.md for your role spec. Task: ${currentTask}

This is a NEW project. First, choose a SLUG describing what you're building. Rules:
- Lowercase kebab-case (alphanumeric and hyphens only)
- Max 50 characters
- Concise — 2 to 4 words is ideal
- Examples: a landing-page task → slug \`landing-page\`; a portfolio site → slug \`portfolio\`; a CLI for ticket triage → slug \`ticket-triage-cli\`

Write your plan to \`<slug>-Plan.md\` at the project root. Gemini will create a \`<slug>/\` subfolder and treat it as the project root for this task — list "Files to Touch" as paths inside that subfolder (e.g. \`<slug>/index.html\`, not \`index.html\`). End the file with the line \`**Plan Status:** READY\` — Hermes watches for that line to advance the pipeline.

Scope rules:
- You may only plan work inside the new \`<slug>/\` subfolder for deliverables. Meta files (\`<slug>-Plan.md\`, \`<slug>-Build-Log.md\`, \`<slug>-Build-Feedback.md\`) live at the project root.
- Do NOT propose changes to anything outside the project root — including hermes/, argus-ui/, landing/, any role-doc folder (.claude/, .gemini/, .codex/), Build-History/, or any parent/sibling directory. Those are argus's own codebase, not the user's project.
- Do NOT write code — Gemini will implement from your plan.`;
    }

    runAgent('planner', plannerPrompt, { outputTopic: 'build.output', pipeline: 'build', taskId: currentTaskId })
        .catch((err) => {
            console.error('[workflow] Plan failed:', err.message);
            logEvent('agent.failed', { role: 'plan', error: err.message }, currentTaskId);
            service.send({ type: 'PLAN_FAILED' });
        });
}

// Best-effort cleanup of a stale scratch file from a prior aborted run. If a scratch with
// the same name exists when we launch an agent, the agent might silently inherit it (no
// write needed → assemble would attribute the prior agent's content to this iteration).
// Loud failure: log if delete fails for any reason other than ENOENT, but don't halt — the
// agent's own write will overwrite it on success path; on failure path, scratch validation
// will surface whatever's there.
function clearStaleScratch(scratchPath) {
    try {
        fs.unlinkSync(scratchPath);
        console.log(`[workflow] Cleared stale scratch ${path.basename(scratchPath)}`);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.warn(`[workflow] Could not clear stale scratch ${scratchPath}: ${err.message}`);
        }
    }
}

function launchBuilder() {
    if (!currentTask) return;
    if (!currentSlug) {
        // Shouldn't happen — plan.completed sets slug before BUILD transition.
        // Surface loudly rather than build with literal "null-Build-Log.md".
        console.error('[workflow] launchBuilder called without currentSlug');
        logEvent('agent.failed', { role: 'build', error: 'currentSlug missing' }, currentTaskId);
        service.send({ type: 'BUILD_FAILED' });
        return;
    }
    iterationCount++;
    // Capture mutable workflow state at launch so the runAgent.then handler logs and assembles
    // for the right task even if abort + new submit happens before the agent process exits.
    const builderIteration = iterationCount;
    const builderTaskId = currentTaskId;
    const builderSlug = currentSlug;
    logEvent('agent.started', { role: 'build', task: currentTask, iteration: builderIteration }, builderTaskId);

    const planFile     = `${currentSlug}-Plan.md`;
    const buildLogFile = `${currentSlug}-Build-Log.md`;
    const feedbackFile = `${currentSlug}-Build-Feedback.md`;
    const scratchFile  = `${currentSlug}-iter.md`;
    const canonicalPath = path.join(WORK_DIR, buildLogFile);
    const scratchPath   = path.join(WORK_DIR, scratchFile);

    clearStaleScratch(scratchPath);
    // Defensive lock — should already be locked from the prior assemble. New install or
    // manual edit could leave it writable; lockCanonical is a no-op if file doesn't exist.
    try { lockCanonical(canonicalPath); } catch (err) {
        console.warn(`[workflow] Defensive lock of ${buildLogFile} failed: ${err.message}`);
    }

    const revisionNote = builderIteration > 1
        ? ` This is revision ${builderIteration}. Read ${feedbackFile} — find the latest audit entry and fix every issue listed under "Instructions for Gemini". Do not re-do work that already passed.`
        : ` Read ${planFile} first — that is Claude's implementation plan. Follow it.`;
    const buildPrompt = `You are the BUILDER in the Argus build pipeline. Your current working directory is the project root for this task.

This is iteration ${builderIteration}. When done, write your iteration entry as a single fresh markdown file at \`${scratchFile}\` (project root). Hermes will read it, inject the canonical iteration number and timestamp, and append it to \`${buildLogFile}\` for you.

Scratch file shape — write exactly this structure:

\`\`\`md
## <short title for this iteration>
- **Status:** COMPLETED
- **Task:** <one sentence describing what was asked>
- **Files Created/Modified:**
  - \`${currentSlug}/path/to/file\` — <what changed>
- **Audit Grade:** [Pending]
- **Notes:** <judgment calls + plan deviations — required, see role doc>
\`\`\`

DO NOT include a \`### Iteration N\` heading or a \`**Timestamp:**\` line — Hermes injects both. DO NOT write to or modify \`${buildLogFile}\` — Hermes owns that file and the OS will reject your write with EACCES.

All deliverables go inside \`${currentSlug}/\` — create the folder if it doesn't exist (mkdir -p ${currentSlug}/) and treat it as your project root for this task. Existing files in \`${currentSlug}/\` (from prior iterations or continuations) are part of the project — read and modify them as needed.

Scope rules (strict):
- Deliverables (HTML, CSS, JS, code of any kind) live ONLY inside \`${currentSlug}/\`. Do NOT write deliverable files at the project root.
- Meta files at the project root: \`${planFile}\` (Claude's plan, read-only for you), \`${buildLogFile}\` (Hermes-owned, EACCES on write), \`${feedbackFile}\` (Hermes-owned, EACCES on write). You write only to \`${scratchFile}\`.
- Do NOT modify anything outside the project root — hermes/, argus-ui/, landing/, any role-doc folder (.claude/, .gemini/, .codex/), Build-History/, and anything in a parent or sibling directory are argus's own codebase and are off-limits.
- If ${planFile} mentions a path outside \`${currentSlug}/\`, ignore it — scope was misplanned; build only inside \`${currentSlug}/\`.

Task: ${currentTask}${revisionNote}`;

    runAgent('builder', buildPrompt, { outputTopic: 'build.output', pipeline: 'build', taskId: builderTaskId })
        .then(() => {
            // Drop the result if state has moved on (user aborted mid-build, or a new task
            // was submitted before the agent process exited). Without this guard, the agent's
            // late scratch would get appended to a canonical that no longer represents the
            // active task. The orphan scratch will be swept by the archival pass.
            const liveState = service.getSnapshot().value;
            if (liveState !== 'building' || currentTaskId !== builderTaskId) {
                console.log(`[workflow] Builder finished after state moved (state=${liveState}, task=${builderTaskId}→${currentTaskId}) — discarding result`);
                logEvent('agent.completed_after_abort', {
                    role: 'build', state: liveState, captured_task: builderTaskId,
                }, builderTaskId);
                return;
            }
            // Process exited cleanly — now read scratch, validate, and assemble into canonical.
            // The agent honoring its contract is an assertion, not a fact: missing/malformed
            // scratch is a hard BUILD_FAILED (named reason in details for UI surfacing).
            try {
                const result = assembleAndAppend({
                    canonicalPath,
                    scratchPath,
                    slug: builderSlug,
                    iterationNumber: builderIteration,
                    role: 'build',
                    kind: 'Build Log',
                });
                logEvent('agent.completed', {
                    role: 'build',
                    iteration: result.iteration,
                    title: result.title,
                    bytes_appended: result.bytesAppended,
                    post_size: result.postSize,
                }, builderTaskId);
                publish('build.agent.completed', {
                    role: 'build', iteration: result.iteration, title: result.title,
                });
                service.send({ type: 'BUILD_DONE' });
            } catch (err) {
                if (err instanceof MetaFileError) {
                    console.error(`[workflow] Build assemble failed: ${err.reason}`, err.details);
                    logEvent('agent.failed', {
                        role: 'build', reason: err.reason, details: err.details,
                    }, builderTaskId);
                } else {
                    console.error('[workflow] Build assemble unexpected:', err.message);
                    logEvent('agent.failed', { role: 'build', error: err.message }, builderTaskId);
                }
                service.send({ type: 'BUILD_FAILED' });
            }
        })
        .catch((err) => {
            // Same guard for the failure path — a stale agent process that errors out should
            // not flip BUILD_FAILED on a task that's already moved on.
            const liveState = service.getSnapshot().value;
            if (liveState !== 'building' || currentTaskId !== builderTaskId) {
                console.log(`[workflow] Builder errored after state moved — discarding`);
                return;
            }
            console.error('[workflow] Build process failed:', err.message);
            logEvent('agent.failed', { role: 'build', error: err.message }, builderTaskId);
            service.send({ type: 'BUILD_FAILED' });
        });
}

function launchAuditor() {
    if (!currentSlug) {
        console.error('[workflow] launchAuditor called without currentSlug');
        logEvent('agent.failed', { role: 'audit', error: 'currentSlug missing' }, currentTaskId);
        service.send({ type: 'AUDIT_FAILED' });
        return;
    }
    const auditIteration = iterationCount;
    const auditTaskId = currentTaskId;
    const auditSlug = currentSlug;
    logEvent('agent.started', { role: 'audit', iteration: auditIteration }, auditTaskId);

    const planFile     = `${currentSlug}-Plan.md`;
    const buildLogFile = `${currentSlug}-Build-Log.md`;
    const feedbackFile = `${currentSlug}-Build-Feedback.md`;
    const scratchFile  = `${currentSlug}-audit.md`;
    const canonicalPath = path.join(WORK_DIR, feedbackFile);
    const scratchPath   = path.join(WORK_DIR, scratchFile);

    clearStaleScratch(scratchPath);
    try { lockCanonical(canonicalPath); } catch (err) {
        console.warn(`[workflow] Defensive lock of ${feedbackFile} failed: ${err.message}`);
    }

    const auditPrompt = `You are the AUDITOR in the Argus build pipeline. Read .codex/CODEX.md for your role spec. Read ${planFile} (what should have been built) and ${buildLogFile} (what was built — find the latest \`### Iteration\` entry). The deliverables live inside \`${currentSlug}/\` — read and verify the files Gemini listed under "Files Created/Modified" from there.

This is iteration ${auditIteration}. When done, write your audit as a single fresh markdown file at \`${scratchFile}\` (project root). Hermes will read it, inject the canonical iteration number and timestamp, and append it to \`${feedbackFile}\` for you.

Scratch file shape — write exactly this structure:

\`\`\`md
## <short audit title>
- **Audit Grade:** A
- **Auditor:** Codex
- **Status:** [COMPLETE | REVISION NEEDED | REDO]

#### Files Reviewed
- \`${currentSlug}/path/to/file\`

#### Plan Compliance
... (see CODEX.md for the full required structure)

#### Independent Findings
...

#### Instructions for Gemini
...
\`\`\`

The \`**Audit Grade:** <LETTER>\` line is required — Hermes parses it for state-machine routing. Use exactly one of A, B, C, or F (no brackets, just the letter).

DO NOT include a \`### Iteration N\` heading or a \`**Date:**\` / \`**Timestamp:**\` line — Hermes injects both. DO NOT write to or modify \`${feedbackFile}\` — Hermes owns that file and the OS will reject your write with EACCES.

Scope rules:
- Read deliverable files only from \`${currentSlug}/\`. Read meta files (${planFile}, ${buildLogFile}) from the project root.
- Write ONLY to \`${scratchFile}\`.
- Do NOT modify any other file. Do NOT read or reference anything outside the project root (hermes/, argus-ui/, landing/, role-doc folders, or any parent/sibling directory are argus's own codebase, not the audit target).
- Do NOT read or write anything inside Build-History/.`;

    runAgent('codex_auditor', auditPrompt, { outputTopic: 'build.output', pipeline: 'build', taskId: auditTaskId })
        .then(() => {
            const liveState = service.getSnapshot().value;
            if (liveState !== 'auditing' || currentTaskId !== auditTaskId) {
                console.log(`[workflow] Auditor finished after state moved (state=${liveState}, task=${auditTaskId}→${currentTaskId}) — discarding result`);
                logEvent('agent.completed_after_abort', {
                    role: 'audit', state: liveState, captured_task: auditTaskId,
                }, auditTaskId);
                return;
            }
            try {
                const result = assembleAndAppend({
                    canonicalPath,
                    scratchPath,
                    slug: auditSlug,
                    iterationNumber: auditIteration,
                    role: 'audit',
                    kind: 'Build Feedback',
                });
                lastGrade = result.grade;
                logEvent('grade.received', {
                    grade: result.grade,
                    iteration: result.iteration,
                    title: result.title,
                    bytes_appended: result.bytesAppended,
                }, auditTaskId);
                publish('grade.received', {
                    grade: result.grade, iteration: result.iteration, file: feedbackFile,
                });
                if (result.grade === 'A') {
                    service.send({ type: 'GRADE_A' });
                } else {
                    if (auditTaskId) completeTask(auditTaskId, iterationCount, result.grade, 'REVISION');
                    service.send({ type: 'GRADE_BCF' });
                }
            } catch (err) {
                if (err instanceof MetaFileError) {
                    console.error(`[workflow] Audit assemble failed: ${err.reason}`, err.details);
                    logEvent('agent.failed', {
                        role: 'audit', reason: err.reason, details: err.details,
                    }, auditTaskId);
                } else {
                    console.error('[workflow] Audit assemble unexpected:', err.message);
                    logEvent('agent.failed', { role: 'audit', error: err.message }, auditTaskId);
                }
                service.send({ type: 'AUDIT_FAILED' });
            }
        })
        .catch((err) => {
            const liveState = service.getSnapshot().value;
            if (liveState !== 'auditing' || currentTaskId !== auditTaskId) {
                console.log(`[workflow] Auditor errored after state moved — discarding`);
                return;
            }
            console.error('[workflow] Audit process failed:', err.message);
            logEvent('agent.failed', { role: 'audit', error: err.message }, auditTaskId);
            service.send({ type: 'AUDIT_FAILED' });
        });
}

const hermesMachine = createMachine({
    id: 'hermes',
    initial: 'idle',
    states: {
        idle: {
            entry: 'onIdle',
            on: {
                TASK_SUBMITTED: 'planning',
            },
        },
        planning: {
            entry: 'startPlanner',
            on: {
                PLAN_DONE:    { target: 'building', actions: 'resetRetry' },
                PLAN_FAILED:  [
                    { target: 'planning', guard: 'canRetry', actions: 'incrementRetry', reenter: true },
                    { target: 'paused' },
                ],
                ABORT: 'idle',
            },
        },
        building: {
            // Entry fires on every state entry — including self-transitions for retry.
            // No external guard needed to re-launch the builder on retry.
            entry: 'startBuilder',
            on: {
                BUILD_DONE:   { target: 'auditing', actions: 'resetRetry' },
                BUILD_FAILED: [
                    { target: 'building', guard: 'canRetry', actions: 'incrementRetry', reenter: true },
                    { target: 'paused' },
                ],
                ABORT: 'idle',
            },
        },
        auditing: {
            entry: 'startAuditor',
            on: {
                GRADE_A:      { target: 'done',              actions: 'resetRetry' },
                GRADE_BCF:    { target: 'awaiting_approval', actions: 'resetRetry' },
                AUDIT_FAILED: [
                    { target: 'auditing', guard: 'canRetry', actions: 'incrementRetry', reenter: true },
                    { target: 'paused' },
                ],
                ABORT: 'idle',
            },
        },
        awaiting_approval: {
            entry: 'onApprovalEntry',
            // Self-abort if the user never returns. Without this guard, the pipeline can sit
            // in awaiting_approval forever — leaving the slug occupied, the meta files in
            // place, and any reconnecting UI stuck on a half-completed task. APPROVAL_TIMEOUT_MS
            // is configurable via env. Auto-abort takes the same archival path as a manual abort.
            after: {
                [APPROVAL_TIMEOUT_MS]: { target: 'idle', actions: 'onApprovalTimeout' },
            },
            on: {
                APPROVE: 'building',
                SKIP:    'done',
                ABORT:   'idle',
            },
        },
        paused: {
            on: {
                RETRY: 'building',
                ABORT: 'idle',
            },
        },
        done: {
            entry: 'onDone',
            on: {
                TASK_SUBMITTED: 'planning',
            },
        },
    },
});

service = createActor(hermesMachine.provide({
    actions: {
        startPlanner:   launchPlanner,
        startBuilder:   launchBuilder,
        startAuditor:   launchAuditor,
        resetRetry:     () => { retryCount = 0; },
        incrementRetry: () => { retryCount++; },
        onDone: () => {
            if (currentTaskId) {
                completeTask(currentTaskId, iterationCount, lastGrade, 'DONE');
                logEvent('task.done', { taskId: currentTaskId, iterations: iterationCount }, currentTaskId);
                if (broadcastFn) broadcastFn({ type: 'history', items: getHistory() });
            }
            // Archive the just-completed task's meta files immediately so the history
            // view (and Build-History/<slug>/ on disk) reflects the completion right away,
            // not on the next submit. Idempotent — safe even if archival already ran.
            archiveLiveFiles();
        },
        onIdle: () => {
            currentTask = null;
            currentTaskId = null;
            currentSlug = null;
            currentMode = 'new';
            iterationCount = 0;
            retryCount = 0;
            lastGrade = null;
        },
        onApprovalEntry: () => {
            console.log(`[workflow] Awaiting approval (timeout in ${Math.round(APPROVAL_TIMEOUT_MS / 60000)} min)`);
            logEvent('approval_timer_armed', {
                deadline_ms: APPROVAL_TIMEOUT_MS, grade: lastGrade,
            }, currentTaskId);
        },
        onApprovalTimeout: () => {
            console.warn(`[workflow] Approval timeout fired after ${Math.round(APPROVAL_TIMEOUT_MS / 60000)} min — auto-aborting`);
            if (currentTaskId) {
                completeTask(currentTaskId, iterationCount, lastGrade, 'CANCELLED');
                logEvent('task.aborted', {
                    taskId: currentTaskId, reason: 'approval_timeout',
                    timeout_ms: APPROVAL_TIMEOUT_MS,
                }, currentTaskId);
                if (broadcastFn) broadcastFn({ type: 'history', items: getHistory() });
            }
            archiveLiveFiles();
            currentTask = null;
            currentTaskId = null;
        },
    },
    guards: {
        canRetry: () => retryCount < 1,
    },
}));

// Subscriber is now only responsible for logging and broadcasting state changes.
// All business logic (agent launching, DB writes) lives in machine entry actions above.
let lastBuildState = null;
service.subscribe((snapshot) => {
    const state = snapshot.value;
    if (state === lastBuildState) return;
    lastBuildState = state;
    console.log(`[workflow] State → ${state}`);
    // awaiting_approval carries grade info for the UI
    const extra = state === 'awaiting_approval' ? { grade: lastGrade } : {};
    broadcast(state, extra);
});

function startWorkflow() {
    service.start();

    subscribe('plan.completed', (payload) => {
        if (service.getSnapshot().value !== 'planning') return;
        const file = payload && payload.file;
        if (!file || !file.endsWith('-Plan.md')) {
            console.warn('[workflow] plan.completed without parseable file:', file);
            return;
        }
        const parsedSlug = file.slice(0, -'-Plan.md'.length);

        if (currentMode === 'continue') {
            // Drift safeguard: in continuation mode the slug is pre-set. If Claude wrote
            // to a different filename, the project would fragment silently. Surface loudly.
            if (parsedSlug !== currentSlug) {
                console.warn(
                    `[workflow] Slug mismatch in continuation mode: expected "${currentSlug}", ` +
                    `got "${parsedSlug}". Aborting plan.`,
                );
                logEvent('agent.failed', {
                    role: 'plan',
                    error: `slug mismatch: expected ${currentSlug}, got ${parsedSlug}`,
                }, currentTaskId);
                service.send({ type: 'PLAN_FAILED' });
                return;
            }
            console.log(`[workflow] Continuing project: ${currentSlug}`);
        } else {
            // New mode: Claude picks the slug on first entry; we capture it from the filename.
            // On a retry, currentSlug is already set — enforce match so the planner can't
            // silently swap slugs mid-flight.
            if (currentSlug && parsedSlug !== currentSlug) {
                console.warn(
                    `[workflow] Planner slug drifted: expected "${currentSlug}", got "${parsedSlug}" — ignoring.`,
                );
                return;
            }
            // Reject malformed slugs here — Claude is the untrusted input. A non-kebab
            // slug would poison every downstream prompt and filesystem path.
            if (!isValidTaskSlug(parsedSlug)) {
                console.warn(`[workflow] Planner produced invalid slug "${parsedSlug}" — aborting plan.`);
                logEvent('agent.failed', {
                    role: 'plan',
                    error: `invalid slug: ${parsedSlug}`,
                }, currentTaskId);
                service.send({ type: 'PLAN_FAILED' });
                return;
            }
            if (!currentSlug) {
                currentSlug = parsedSlug;
                console.log(`[workflow] Slug for this task: ${currentSlug}`);
            }
        }
        service.send({ type: 'PLAN_DONE' });
    });

    // Build/audit completion no longer comes from the watcher — the workflow drives the
    // state machine directly from its own runAgent.then handler after assembleAndAppend
    // succeeds (loud failure on missing/malformed scratch). The watcher only retains
    // *-Plan.md (planner is still file-signal-driven; Plan.md is small + atomic).

    console.log('[workflow] State machine started');
}

function submitTask(description, opts = {}) {
    if (service.getSnapshot().value !== 'idle' && service.getSnapshot().value !== 'done') {
        throw new Error('A task is already running');
    }
    const mode = opts.mode === 'continue' ? 'continue' : 'new';
    let slug = null;
    if (mode === 'continue') {
        slug = typeof opts.slug === 'string' ? opts.slug.trim() : '';
        if (!slug) {
            throw new Error('continue mode requires a non-empty slug');
        }
        if (!isValidTaskSlug(slug)) {
            throw new Error(`invalid slug format: ${slug}`);
        }
        const folder = path.join(process.env.WORK_DIR, slug);
        if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
            throw new Error(`project folder not found: ${slug}`);
        }
    }
    // Safety-net archival. The primary archive triggers are onDone and abort, which run
    // when the task actually finishes. This call covers the edge case of hermes crashing
    // mid-task (or a manual restart) — stale meta files at WORK_DIR root get archived
    // before the new task starts. Idempotent: no-op when nothing matches.
    archiveLiveFiles();
    currentTask = description;
    currentMode = mode;
    currentSlug = mode === 'continue' ? slug : null;
    iterationCount = 0;
    currentTaskId = createTask(description);
    logEvent('task.submitted', { description, mode, slug: currentSlug }, currentTaskId);
    service.send({ type: 'TASK_SUBMITTED' });
}

function sendApproval(action) {
    if (action === 'approve') {
        service.send({ type: 'APPROVE' });
    } else if (action === 'skip') {
        service.send({ type: 'SKIP' });
    } else if (action === 'retry') {
        service.send({ type: 'RETRY' });
    } else if (action === 'abort') {
        if (currentTaskId) {
            completeTask(currentTaskId, iterationCount, lastGrade, 'CANCELLED');
            logEvent('task.aborted', { taskId: currentTaskId }, currentTaskId);
            if (broadcastFn) broadcastFn({ type: 'history', items: getHistory() });
        }
        // Archive on abort too so the timing is symmetric with onDone — partial meta
        // files (whatever existed at the abort moment) move into Build-History/<slug>/
        // immediately, not on the next submit.
        archiveLiveFiles();
        currentTask = null;
        currentTaskId = null;
        service.send({ type: 'ABORT' });
    }
}

function getState() {
    return {
        state: service.getSnapshot().value,
        task: currentTask,
        iteration: iterationCount,
        // Include slug + grade so a reconnecting UI can render the full context of
        // an in-flight or just-completed task. Without these, reconnect during
        // auditing/awaiting_approval/done shows the state but loses which project is
        // running and what grade was returned.
        slug: currentSlug,
        grade: lastGrade,
    };
}

module.exports = { startWorkflow, submitTask, sendApproval, getState, setBroadcast };
