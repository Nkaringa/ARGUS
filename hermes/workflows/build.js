const fs = require('fs');
const path = require('path');
const { createMachine, createActor } = require('xstate');
const { subscribe } = require('../core/events');
const { runAgent } = require('../core/agents');
const { archiveLiveFiles, isValidTaskSlug } = require('../core/archive');
const { logEvent, createTask, completeTask, getHistory } = require('../core/db');

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
    logEvent('agent.started', { role: 'plan', task: currentTask, mode: currentMode, slug: currentSlug });

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

    runAgent('planner', plannerPrompt, { outputTopic: 'build.output', pipeline: 'build' })
        .catch((err) => {
            console.error('[workflow] Plan failed:', err.message);
            logEvent('agent.failed', { role: 'plan', error: err.message });
            service.send({ type: 'PLAN_FAILED' });
        });
}

function launchBuilder() {
    if (!currentTask) return;
    if (!currentSlug) {
        // Shouldn't happen — plan.completed sets slug before BUILD transition.
        // Surface loudly rather than build with literal "null-Build-Log.md".
        console.error('[workflow] launchBuilder called without currentSlug');
        logEvent('agent.failed', { role: 'build', error: 'currentSlug missing' });
        service.send({ type: 'BUILD_FAILED' });
        return;
    }
    iterationCount++;
    logEvent('agent.started', { role: 'build', task: currentTask, iteration: iterationCount });

    const planFile     = `${currentSlug}-Plan.md`;
    const buildLogFile = `${currentSlug}-Build-Log.md`;
    const feedbackFile = `${currentSlug}-Build-Feedback.md`;

    const revisionNote = iterationCount > 1
        ? ` This is revision ${iterationCount}. Read ${feedbackFile} — find the latest audit entry and fix every issue listed under "Instructions for Gemini". Do not re-do work that already passed.`
        : ` Read ${planFile} first — that is Claude's implementation plan. Follow it.`;
    const logReminder = ` When done, append a new ### Iteration entry to ${buildLogFile} at the project root (required — the pipeline watches for it).`;
    const buildPrompt = `You are the BUILDER in the Argus build pipeline. Your current working directory is the project root for this task.

All deliverables go inside \`${currentSlug}/\` — create the folder if it doesn't exist (mkdir -p ${currentSlug}/) and treat it as your project root for this task. Existing files in \`${currentSlug}/\` (from prior iterations or continuations) are part of the project — read and modify them as needed.

Scope rules (strict):
- Deliverables (HTML, CSS, JS, code of any kind) live ONLY inside \`${currentSlug}/\`. Do NOT write deliverable files at the project root.
- Meta files at the project root (\`${planFile}\`, \`${buildLogFile}\`, \`${feedbackFile}\`) are owned by Claude / you / Codex respectively. You ONLY write to \`${buildLogFile}\` and only by appending a new \`### Iteration\` entry.
- Do NOT modify anything outside the project root — hermes/, argus-ui/, landing/, any role-doc folder (.claude/, .gemini/, .codex/), Build-History/, and anything in a parent or sibling directory are argus's own codebase and are off-limits.
- If ${planFile} mentions a path outside \`${currentSlug}/\`, ignore it — scope was misplanned; build only inside \`${currentSlug}/\`.

Task: ${currentTask}${revisionNote}${logReminder}`;

    runAgent('builder', buildPrompt, { outputTopic: 'build.output', pipeline: 'build' })
        .catch((err) => {
            console.error('[workflow] Build failed:', err.message);
            logEvent('agent.failed', { role: 'build', error: err.message });
            service.send({ type: 'BUILD_FAILED' });
        });
}

function launchAuditor() {
    if (!currentSlug) {
        console.error('[workflow] launchAuditor called without currentSlug');
        logEvent('agent.failed', { role: 'audit', error: 'currentSlug missing' });
        service.send({ type: 'AUDIT_FAILED' });
        return;
    }
    logEvent('agent.started', { role: 'audit' });

    const planFile     = `${currentSlug}-Plan.md`;
    const buildLogFile = `${currentSlug}-Build-Log.md`;
    const feedbackFile = `${currentSlug}-Build-Feedback.md`;

    const auditPrompt = `You are the AUDITOR in the Argus build pipeline. Read .codex/CODEX.md for your role spec. Read ${planFile} (what should have been built) and ${buildLogFile} (what Gemini reports was built — find the latest ### Iteration entry). The deliverables live inside \`${currentSlug}/\` — read and verify the files Gemini lists under "Files Created/Modified" from there.

Append your audit to ${feedbackFile} (at the project root) with a new ### Iteration entry and the exact line \`**Audit Grade:** <LETTER>\` where \`<LETTER>\` is one of A, B, C, or F (no brackets, just the letter). For example: \`**Audit Grade:** A\`.

Scope rules:
- Read deliverable files only from \`${currentSlug}/\`. Read meta files (${planFile}, ${buildLogFile}) from the project root.
- Write ONLY to ${feedbackFile}.
- Do NOT modify any other file. Do NOT read or reference anything outside the project root (hermes/, argus-ui/, landing/, role-doc folders, or any parent/sibling directory are argus's own codebase, not the audit target).
- Do NOT read or write anything inside Build-History/.`;
    runAgent('codex_auditor', auditPrompt, { outputTopic: 'build.output', pipeline: 'build' })
        .catch((err) => {
            console.error('[workflow] Audit failed:', err.message);
            logEvent('agent.failed', { role: 'audit', error: err.message });
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
                logEvent('task.done', { taskId: currentTaskId, iterations: iterationCount });
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
                });
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
                });
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

    subscribe('agent.completed', (payload) => {
        if (payload.role !== 'build') return;
        // Correlate the event to the active task. Without these guards, an ambient
        // write to a stale or wrong-slug *-Build-Log.md advances the state machine.
        if (service.getSnapshot().value !== 'building') return;
        if (!currentSlug || payload.file !== `${currentSlug}-Build-Log.md`) {
            console.warn(`[workflow] Ignoring agent.completed for unrelated file: ${payload.file}`);
            return;
        }
        service.send({ type: 'BUILD_DONE' });
    });

    subscribe('grade.received', (payload) => {
        if (service.getSnapshot().value !== 'auditing') return;
        if (!currentSlug || payload.file !== `${currentSlug}-Build-Feedback.md`) {
            console.warn(`[workflow] Ignoring grade.received for unrelated file: ${payload.file}`);
            return;
        }
        logEvent('grade.received', payload);
        lastGrade = payload.grade;
        if (payload.grade === 'A') {
            service.send({ type: 'GRADE_A' });
        } else {
            if (currentTaskId) completeTask(currentTaskId, iterationCount, payload.grade, 'REVISION');
            service.send({ type: 'GRADE_BCF' });
        }
    });

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
    logEvent('task.submitted', { description, mode, slug: currentSlug });
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
            logEvent('task.aborted', { taskId: currentTaskId });
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
