const { createMachine, createActor } = require('xstate');
const { subscribe } = require('../core/events');
const { runAgent } = require('../core/agents');
const { logEvent } = require('../core/db');
const fs = require('fs');
const path = require('path');

let currentIdea = null;
let broadcastFn = null;

function setWarzoneBroadcast(fn) {
    broadcastFn = fn;
}

function broadcast(state, extra = {}) {
    if (broadcastFn) {
        broadcastFn({ type: 'state', state, idea: currentIdea, ...extra });
    }
}

// Forward declaration — closures capture `service` by reference; assigned before start().
let service;

function nextDiscussionNumber() {
    const warzoneFile = path.join(process.env.WORK_DIR, 'WarZone.md');
    if (!fs.existsSync(warzoneFile)) return 1;
    const matches = fs.readFileSync(warzoneFile, 'utf8').match(/^### Discussion \d+/gm) || [];
    return matches.length + 1;
}

function launchClaudePlanDiscuss() {
    if (!currentIdea) return;
    const n = nextDiscussionNumber();
    const today = new Date().toISOString().split('T')[0];
    const prompt = `IMPORTANT: This is a DISCUSSION task, not a build task. Do NOT write to Plan.md, Build-Log.md, or Build-Feedback.md. Do NOT create or modify any project files. Your ONLY output is appending to WarZone.md.

Append the following block to WarZone.md (create the file if it does not exist):

---
### Discussion ${n}
**Idea:** ${currentIdea}
**Date:** ${today}

#### Claude's Plan
[Write your planner perspective here: how you'd frame the problem, key files to touch, approach, gotchas, success criteria]
**Planner Status:** DONE

Do not write to any other file. Do not write to Plan.md or Build-Log.md. Only append to WarZone.md.`;
    logEvent('discuss.started', { role: 'claude', idea: currentIdea });
    runAgent('discuss_planner', prompt, { outputTopic: 'warzone.output' }).catch((err) => {
        console.error('[warzone] discuss_planner failed:', err.message);
        logEvent('discuss.failed', { role: 'claude', error: err.message });
        service.send({ type: 'ABORT' });
    });
}

function launchGeminiBuildDiscuss() {
    const prompt = `IMPORTANT: This is a DISCUSSION task, not a build task. Do NOT write to Plan.md, Build-Log.md, or Build-Feedback.md. Do NOT create or modify any project files. Your ONLY output is appending to WarZone.md.

Read WarZone.md. Find the latest Discussion entry. Append to that same entry block:

#### Gemini's Build Approach
[Write your builder perspective here: recommended stack, concrete implementation steps, dependencies, any concerns about Claude's plan]
**Builder Status:** DONE

Do not modify anything above #### Gemini's Build Approach. Only append to WarZone.md.`;
    logEvent('discuss.started', { role: 'gemini' });
    runAgent('discuss_builder', prompt, { outputTopic: 'warzone.output' }).catch((err) => {
        console.error('[warzone] discuss_builder failed:', err.message);
        logEvent('discuss.failed', { role: 'gemini', error: err.message });
        service.send({ type: 'ABORT' });
    });
}

function launchCodexAuditDiscuss() {
    const prompt = `IMPORTANT: This is a DISCUSSION task, not a build task. Do NOT write to Plan.md, Build-Log.md, or Build-Feedback.md. Do NOT create or modify any project files. Your ONLY output is appending to WarZone.md.

Read WarZone.md. Find the latest Discussion entry. Append to that same entry block:

#### Codex's Audit
[Write your auditor perspective here: poke holes in Claude's plan and Gemini's build approach, flag missing edge cases, validate or push back]
**Auditor Status:** READY TO BUILD

Do not modify anything above #### Codex's Audit. Only append to WarZone.md.`;
    logEvent('discuss.started', { role: 'codex' });
    runAgent('discuss_codex', prompt, { outputTopic: 'warzone.output' }).catch((err) => {
        console.error('[warzone] discuss_codex failed:', err.message);
        logEvent('discuss.failed', { role: 'codex', error: err.message });
        service.send({ type: 'ABORT' });
    });
}

const warzoneMachine = createMachine({
    id: 'warzone',
    initial: 'idle',
    states: {
        idle: {
            entry: 'onIdle',
            on: {
                DISCUSS_SUBMITTED: 'discussing_claude',
            },
        },
        discussing_claude: {
            entry: 'startClaudePlan',
            on: {
                CLAUDE_PLAN_DONE: 'discussing_gemini',
                ABORT: 'idle',
            },
        },
        discussing_gemini: {
            entry: 'startGeminiBuild',
            on: {
                GEMINI_BUILD_DONE: 'discussing_codex',
                ABORT: 'idle',
            },
        },
        discussing_codex: {
            entry: 'startCodexAudit',
            on: {
                DISCUSS_COMPLETE: 'awaiting_discuss_approval',
                ABORT: 'idle',
            },
        },
        awaiting_discuss_approval: {
            on: {
                DISCUSS_APPROVE: 'idle',
                ABORT: 'idle',
            },
        },
    },
});

service = createActor(warzoneMachine.provide({
    actions: {
        startClaudePlan:  launchClaudePlanDiscuss,
        startGeminiBuild: launchGeminiBuildDiscuss,
        startCodexAudit:  launchCodexAuditDiscuss,
        onIdle: () => {
            currentIdea = null;
        },
    },
}));

// Subscriber is now only responsible for logging and broadcasting state changes.
let lastWarzoneState = null;
service.subscribe((snapshot) => {
    const state = snapshot.value;
    if (state === lastWarzoneState) return;
    lastWarzoneState = state;
    console.log(`[warzone] State → ${state}`);
    broadcast(state);
});

function startWarzoneWorkflow() {
    service.start();

    subscribe('discuss.claude_done', () => {
        if (service.getSnapshot().value === 'discussing_claude') {
            service.send({ type: 'CLAUDE_PLAN_DONE' });
        }
    });

    subscribe('discuss.gemini_done', () => {
        if (service.getSnapshot().value === 'discussing_gemini') {
            service.send({ type: 'GEMINI_BUILD_DONE' });
        }
    });

    subscribe('discuss.complete', () => {
        if (service.getSnapshot().value === 'discussing_codex') {
            service.send({ type: 'DISCUSS_COMPLETE' });
        }
    });

    console.log('[warzone] State machine started');
}

function submitDiscuss(idea) {
    const snap = service.getSnapshot().value;
    if (snap !== 'idle') {
        throw new Error('A discussion is already running');
    }
    currentIdea = idea;
    logEvent('discuss.submitted', { idea });
    service.send({ type: 'DISCUSS_SUBMITTED' });
}

function sendDiscussApproval(action) {
    if (action === 'approve') {
        service.send({ type: 'DISCUSS_APPROVE' });
    } else {
        currentIdea = null;
        service.send({ type: 'ABORT' });
    }
}

function getWarzoneState() {
    return {
        state: service.getSnapshot().value,
        idea: currentIdea,
    };
}

module.exports = { startWarzoneWorkflow, submitDiscuss, sendDiscussApproval, getWarzoneState, setWarzoneBroadcast };
