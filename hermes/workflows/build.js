const fs = require('fs');
const path = require('path');
const { createMachine, createActor } = require('xstate');
const { subscribe } = require('../core/events');
const { runAgent } = require('../core/agents');
const { logEvent, createTask, completeTask, getHistory } = require('../core/db');

const PLAN_FILE = path.join(process.env.WORK_DIR, 'Plan.md');

let currentTaskId = null;
let currentTask = null;
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
    logEvent('agent.started', { role: 'plan', task: currentTask });

    const plannerPrompt = `You are the PLANNER in the Argus build pipeline. Read .claude/CLAUDE.md for your role spec. Task: ${currentTask}

Write Plan.md at the project root — OVERWRITE the file (don't append). The plan must cover: files to touch, approach, gotchas, verification. End the file with the line \`**Plan Status:** READY\` — Hermes watches for that line to advance the pipeline.

Do NOT modify anything in hermes/. Do NOT write code — Gemini will implement from your plan.`;

    runAgent('planner', plannerPrompt, { outputTopic: 'build.output' })
        .catch((err) => {
            console.error('[workflow] Plan failed:', err.message);
            logEvent('agent.failed', { role: 'plan', error: err.message });
            service.send({ type: 'PLAN_FAILED' });
        });
}

function launchBuilder() {
    if (!currentTask) return;
    iterationCount++;
    logEvent('agent.started', { role: 'build', task: currentTask, iteration: iterationCount });

    const revisionNote = iterationCount > 1
        ? ` This is revision ${iterationCount}. Read Build-Feedback.md — find the latest audit entry and fix every issue listed under "Instructions for Gemini". Do not re-do work that already passed.`
        : ` Read Plan.md first — that is Claude's implementation plan. Follow it.`;
    const logReminder = ` When done, append a new ### Iteration entry to Build-Log.md (required — the pipeline watches for it).`;
    const buildPrompt = `You are working in the NK-Base project root. Build all output in a project subdirectory. Do NOT modify any files inside hermes/ — that directory is off-limits. Task: ${currentTask}${revisionNote}${logReminder}`;

    runAgent('builder', buildPrompt, { outputTopic: 'build.output' })
        .catch((err) => {
            console.error('[workflow] Build failed:', err.message);
            logEvent('agent.failed', { role: 'build', error: err.message });
            service.send({ type: 'BUILD_FAILED' });
        });
}

function launchAuditor() {
    logEvent('agent.started', { role: 'audit' });
    const auditPrompt = `You are the AUDITOR. Read .codex/CODEX.md for your role spec. Read Plan.md (what should have been built) and Build-Log.md (what Gemini reports was built — find the latest ### Iteration entry). Verify every file listed under that iteration's "Files Created/Modified" matches the plan. Append your audit to Build-Feedback.md with a new ### Iteration entry and the exact line \`**Audit Grade:** [A/B/C/F]\`. Do not modify anything else.`;
    runAgent('codex_auditor', auditPrompt, { outputTopic: 'build.output' })
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
        },
        onIdle: () => {
            currentTask = null;
            currentTaskId = null;
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

    subscribe('plan.completed', () => {
        if (service.getSnapshot().value === 'planning') {
            service.send({ type: 'PLAN_DONE' });
        }
    });

    subscribe('agent.completed', (payload) => {
        if (payload.role === 'build') {
            service.send({ type: 'BUILD_DONE' });
        }
    });

    subscribe('grade.received', (payload) => {
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

function submitTask(description) {
    if (service.getSnapshot().value !== 'idle' && service.getSnapshot().value !== 'done') {
        throw new Error('A task is already running');
    }
    // Delete any leftover Plan.md so the planner always creates a fresh file.
    // Makes the watcher's "content changed + pattern matches" signal unambiguous —
    // no stale READY marker from a previous task can pre-populate the watcher.
    try { fs.unlinkSync(PLAN_FILE); } catch { /* already absent */ }
    currentTask = description;
    iterationCount = 0;
    currentTaskId = createTask(description);
    logEvent('task.submitted', { description });
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
    };
}

module.exports = { startWorkflow, submitTask, sendApproval, getState, setBroadcast };
