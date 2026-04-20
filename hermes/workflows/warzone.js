const { createMachine, createActor } = require('xstate');
const { subscribe } = require('../core/events');
const { runAgent } = require('../core/agents');
const { archiveWarzoneFile, findLiveWarzoneSlug, isValidTaskSlug } = require('../core/archive');
const { logEvent } = require('../core/db');
const fs = require('fs');
const path = require('path');

let currentIdea = null;
// Slug for the in-flight discussion topic. Persists across submits within the same
// discussion (so multi-submit conversations share one file). Cleared on newDiscussion()
// (which also archives the file). Re-derived from disk on hermes boot.
let currentDiscussionSlug = null;
let broadcastFn = null;

function setWarzoneBroadcast(fn) {
    broadcastFn = fn;
}

function broadcast(state, extra = {}) {
    if (broadcastFn) {
        broadcastFn({
            type: 'state',
            state,
            idea: currentIdea,
            slug: currentDiscussionSlug,
            ...extra,
        });
    }
}

// Forward declaration — closures capture `service` by reference; assigned before start().
let service;

function warzoneFilePath() {
    if (!currentDiscussionSlug) return null;
    return path.join(process.env.WORK_DIR, `${currentDiscussionSlug}-WarZone.md`);
}

function nextDiscussionNumber() {
    const fp = warzoneFilePath();
    if (!fp || !fs.existsSync(fp)) return 1;
    const matches = fs.readFileSync(fp, 'utf8').match(/^### Discussion \d+/gm) || [];
    return matches.length + 1;
}

function launchClaudePlanDiscuss() {
    if (!currentIdea) return;
    const today = new Date().toISOString().split('T')[0];

    let prompt;
    if (currentDiscussionSlug) {
        // Continuing an existing discussion. Slug is fixed; do NOT pick a new one.
        const file = `${currentDiscussionSlug}-WarZone.md`;
        const n = nextDiscussionNumber();
        prompt = `IMPORTANT: This is a DISCUSSION task, not a build task. Do NOT write to any \`*-Plan.md\`, \`*-Build-Log.md\`, or \`*-Build-Feedback.md\` file. Do NOT create or modify any project files. Do NOT touch the Build-History/ or WarZone-History/ folders. Your ONLY output is appending to ${file}.

You are continuing the existing discussion thread \`${currentDiscussionSlug}\`. Do NOT pick a new slug. Do NOT create a new file. Append the following block to ${file}:

---
### Discussion ${n}
**Idea:** ${currentIdea}
**Date:** ${today}

#### Claude's Plan
[Write your planner perspective here: how you'd frame the problem, key files to touch, approach, gotchas, success criteria]
**Planner Status:** DONE

Only append to ${file}.`;
    } else {
        // Fresh discussion — Claude picks the slug and creates <slug>-WarZone.md.
        prompt = `IMPORTANT: This is a DISCUSSION task, not a build task. Do NOT write to any \`*-Plan.md\`, \`*-Build-Log.md\`, or \`*-Build-Feedback.md\` file. Do NOT create or modify any project files. Do NOT touch the Build-History/ or WarZone-History/ folders. Your ONLY output is creating and appending to a new \`<slug>-WarZone.md\` file.

This is a fresh discussion. Choose a SLUG describing the topic. Rules:
- Lowercase kebab-case (alphanumeric and hyphens only)
- Max 50 characters
- Concise — 2 to 4 words is ideal
- Examples: portfolio idea → \`portfolio\`; web app for trading → \`trading-app\`; CLI for ticket triage → \`ticket-triage-cli\`

Create \`<slug>-WarZone.md\` and append the following block (substituting the slug you chose):

---
### Discussion 1
**Idea:** ${currentIdea}
**Date:** ${today}

#### Claude's Plan
[Write your planner perspective here: how you'd frame the problem, key files to touch, approach, gotchas, success criteria]
**Planner Status:** DONE

Gemini and Codex will append to the same \`<slug>-WarZone.md\`. Pick a slug they'd be happy seeing reused.`;
    }

    logEvent('discuss.started', { role: 'claude', idea: currentIdea, slug: currentDiscussionSlug });
    runAgent('discuss_planner', prompt, { outputTopic: 'warzone.output', pipeline: 'warzone' }).catch((err) => {
        console.error('[warzone] discuss_planner failed:', err.message);
        logEvent('discuss.failed', { role: 'claude', error: err.message });
        service.send({ type: 'ABORT' });
    });
}

function launchGeminiBuildDiscuss() {
    if (!currentDiscussionSlug) {
        console.error('[warzone] launchGeminiBuildDiscuss called without currentDiscussionSlug');
        service.send({ type: 'ABORT' });
        return;
    }
    const file = `${currentDiscussionSlug}-WarZone.md`;
    const prompt = `IMPORTANT: This is a DISCUSSION task, not a build task. Do NOT write to any \`*-Plan.md\`, \`*-Build-Log.md\`, or \`*-Build-Feedback.md\` file. Do NOT create or modify any project files. Do NOT touch the Build-History/ or WarZone-History/ folders. Your ONLY output is appending to ${file}.

Read ${file}. Find the latest Discussion entry. Append to that same entry block:

#### Gemini's Build Approach
[Write your builder perspective here: recommended stack, concrete implementation steps, dependencies, any concerns about Claude's plan]
**Builder Status:** DONE

Do not modify anything above #### Gemini's Build Approach. Only append to ${file}.`;
    logEvent('discuss.started', { role: 'gemini', slug: currentDiscussionSlug });
    runAgent('discuss_builder', prompt, { outputTopic: 'warzone.output', pipeline: 'warzone' }).catch((err) => {
        console.error('[warzone] discuss_builder failed:', err.message);
        logEvent('discuss.failed', { role: 'gemini', error: err.message });
        service.send({ type: 'ABORT' });
    });
}

function launchCodexAuditDiscuss() {
    if (!currentDiscussionSlug) {
        console.error('[warzone] launchCodexAuditDiscuss called without currentDiscussionSlug');
        service.send({ type: 'ABORT' });
        return;
    }
    const file = `${currentDiscussionSlug}-WarZone.md`;
    const prompt = `IMPORTANT: This is a DISCUSSION task, not a build task. Do NOT write to any \`*-Plan.md\`, \`*-Build-Log.md\`, or \`*-Build-Feedback.md\` file. Do NOT create or modify any project files. Do NOT touch the Build-History/ or WarZone-History/ folders. Your ONLY output is appending to ${file}.

Read ${file}. Find the latest Discussion entry. Append to that same entry block:

#### Codex's Audit
[Write your auditor perspective here: poke holes in Claude's plan and Gemini's build approach, flag missing edge cases, validate or push back]
**Auditor Status:** READY TO BUILD

Do not modify anything above #### Codex's Audit. Only append to ${file}.`;
    logEvent('discuss.started', { role: 'codex', slug: currentDiscussionSlug });
    runAgent('discuss_codex', prompt, { outputTopic: 'warzone.output', pipeline: 'warzone' }).catch((err) => {
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
        // onIdle clears the per-submit `currentIdea` ONLY. The discussion slug
        // persists across submits — it's only cleared by newDiscussion() (which
        // also archives the file).
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
    // Re-derive the in-flight discussion slug from disk on boot. Survives hermes restart
    // mid-discussion (state machine resets to idle, but the file on disk is the source of truth).
    const found = findLiveWarzoneSlug();
    if (found) {
        currentDiscussionSlug = found;
        console.log(`[warzone] Resumed discussion slug from disk: ${found}`);
    }

    service.start();

    subscribe('discuss.claude_done', (payload) => {
        if (service.getSnapshot().value !== 'discussing_claude') return;
        if (!currentDiscussionSlug && payload && payload.file) {
            // First submit on a fresh discussion: capture the slug Claude chose.
            const m = payload.file.match(/^(.+)-WarZone\.md$/);
            if (!m) {
                console.warn('[warzone] discuss.claude_done with unparseable file:', payload.file);
                service.send({ type: 'ABORT' });
                return;
            }
            // Claude is untrusted input here. Reject any slug that wouldn't survive the
            // kebab-case contract — else it poisons every subsequent prompt and path.
            if (!isValidTaskSlug(m[1])) {
                console.warn(`[warzone] Planner produced invalid slug "${m[1]}" — aborting.`);
                logEvent('discuss.failed', { role: 'claude', error: `invalid slug: ${m[1]}` });
                service.send({ type: 'ABORT' });
                return;
            }
            currentDiscussionSlug = m[1];
            console.log(`[warzone] Slug for this discussion: ${currentDiscussionSlug}`);
        } else if (currentDiscussionSlug) {
            // Continuing submit: slug is already set; reject events for a different file.
            if (payload && payload.file && payload.file !== `${currentDiscussionSlug}-WarZone.md`) {
                console.warn(`[warzone] Ignoring discuss.claude_done for unrelated file: ${payload.file}`);
                return;
            }
        }
        service.send({ type: 'CLAUDE_PLAN_DONE' });
    });

    subscribe('discuss.gemini_done', (payload) => {
        if (service.getSnapshot().value !== 'discussing_gemini') return;
        if (!currentDiscussionSlug || !payload || payload.file !== `${currentDiscussionSlug}-WarZone.md`) {
            console.warn(`[warzone] Ignoring discuss.gemini_done for unrelated file: ${payload && payload.file}`);
            return;
        }
        service.send({ type: 'GEMINI_BUILD_DONE' });
    });

    subscribe('discuss.complete', (payload) => {
        if (service.getSnapshot().value !== 'discussing_codex') return;
        if (!currentDiscussionSlug || !payload || payload.file !== `${currentDiscussionSlug}-WarZone.md`) {
            console.warn(`[warzone] Ignoring discuss.complete for unrelated file: ${payload && payload.file}`);
            return;
        }
        service.send({ type: 'DISCUSS_COMPLETE' });
    });

    console.log('[warzone] State machine started');
}

function submitDiscuss(idea) {
    const snap = service.getSnapshot().value;
    if (snap !== 'idle') {
        throw new Error('A discussion is already running');
    }
    currentIdea = idea;
    logEvent('discuss.submitted', { idea, slug: currentDiscussionSlug });
    service.send({ type: 'DISCUSS_SUBMITTED' });
}

function sendDiscussApproval(action) {
    if (action === 'approve') {
        // Approval acknowledges the round but keeps the discussion slug — the next submit
        // appends to the same file. Only newDiscussion() archives.
        service.send({ type: 'DISCUSS_APPROVE' });
    } else {
        currentIdea = null;
        service.send({ type: 'ABORT' });
    }
}

function newDiscussion() {
    const snap = service.getSnapshot().value;
    if (snap !== 'idle' && snap !== 'awaiting_discuss_approval') {
        throw new Error('Wait for the current discussion round to finish before starting a new one');
    }
    archiveWarzoneFile(currentDiscussionSlug);
    const archivedSlug = currentDiscussionSlug;
    currentDiscussionSlug = null;
    currentIdea = null;
    logEvent('discuss.new', { archivedSlug });
    // If we were sitting in awaiting_discuss_approval, drop back to idle so the UI
    // reflects "ready for a new discussion" immediately.
    if (snap === 'awaiting_discuss_approval') {
        service.send({ type: 'DISCUSS_APPROVE' });
    } else {
        // Already idle — broadcast manually so the slug clear reaches the UI.
        broadcast('idle');
    }
}

function getWarzoneState() {
    return {
        state: service.getSnapshot().value,
        idea: currentIdea,
        slug: currentDiscussionSlug,
    };
}

module.exports = {
    startWarzoneWorkflow,
    submitDiscuss,
    sendDiscussApproval,
    newDiscussion,
    getWarzoneState,
    setWarzoneBroadcast,
};
