---
name: Hermes / Argus — Full System State
description: Complete current architecture, file structure, all paths, all state machines, all bugs fixed, start commands. Read this before any Hermes/Argus work.
type: project
originSessionId: e72807b5-485a-484b-ad9d-9125c1ea21fc
---
The system is **Argus** (brand/UI name). **Hermes** is the internal engine name. When Nagesh says "Argus" he means the whole system.

---

## How to Start

```bash
# From NK-Base root — auto-starts NATS (reused if already running) + all 3 servers + UI
npm run dev

# Kill stuck ports first if needed
lsof -ti:3001,3002,3003 | xargs kill -9 2>/dev/null; npm run dev
```

Open `http://localhost:5173` for the React UI.

---

## Full File Structure

```
NK-Base/                               ← WORK_DIR
├── package.json                       ← root start script (concurrently)
├── .gitignore                         ← root gitignore (node_modules, .env, hermes.db, dist)
│                                       (.env.example lives under hermes/ now — 2026-04-15)
├── Audit-codex.md                     ← Codex audit report (original + re-audit addendum)
├── Audit-status.md                    ← Fix tracking log (all bugs, status, details)
├── node_modules/                      ← concurrently only
│
├── hermes/                            ← backend engine
│   ├── core/
│   │   ├── events.js                  NATS pub/sub (connectNATS, publish, subscribe)
│   │   ├── agents.js                  CLI runner (runAgent, buildCommand, shellEscape) — simplified 2026-04-15, single-path command execution
│   │   ├── agents.json                Agent config — REFACTORED: builder, planner, codex_auditor, discuss_builder, discuss_planner, discuss_codex (see "Three-Agent Refactor" section below)
│   │   ├── auth.js                    NEW — shared CORS + API key auth + wsAuth
│   │   ├── db.js                      SQLite (logEvent, createTask, completeTask, getHistory)
│   │   └── watcher.js                 File watcher — REFACTORED: build=Plan.md+Build-Log.md+Build-Feedback.md, warzone=WarZone.md (see refactor section)
│   │
│   ├── workflows/
│   │   ├── build.js                   Build pipeline — REFACTORED: idle → planning → building → auditing → awaiting_approval
│   │   └── warzone.js                 Warzone — REFACTORED: idle → discussing_claude → discussing_gemini → discussing_codex → awaiting_discuss_approval
│   │
│   ├── servers/
│   │   ├── build.js                   Port 3002 — POST /task /approval /stop, GET /state /history
│   │   ├── chat.js                    Port 3001 — POST /chat
│   │   └── warzone.js                 Port 3003 — POST /discuss /discuss/approval /stop, GET /state
│   │
│   ├── hermes.db                      SQLite database
│   ├── .env                           Env config (see below)
│   └── package.json                   XState version: ^5.14.0 (IMPORTANT — see XState note below)
│
├── argus-ui/                          ← React + TypeScript frontend (Vite)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── config.ts                  SERVERS + authHeaders() + wsUrl() helpers
│   │   ├── types/index.ts
│   │   ├── hooks/
│   │   │   ├── useBuildSocket.ts      WS → localhost:3002
│   │   │   ├── useChatSocket.ts       WS → localhost:3001
│   │   │   └── useWarzoneSocket.ts    WS → localhost:3003
│   │   └── components/
│   │       ├── Layout/
│   │       │   ├── Sidebar.tsx
│   │       │   └── ResetSessionsModal.tsx  ← added 2026-04-15 evening (BMW redesign)
│   │       ├── ChatView/index.tsx
│   │       ├── BuildView/index.tsx
│   │       ├── WarzoneView/index.tsx
│   │       └── LogsView/index.tsx
│   ├── vite.config.ts                 Vite + Tailwind v4 + react plugin, port 5173
│   └── package.json
│                                      (App.css deleted 2026-04-15 — unused Vite template)
│
├── Plan.md                            Created at runtime by Claude (Planner, overwrites per task)
├── Build-Log.md                       Created at runtime by Gemini (Builder, append-only)
├── Build-Feedback.md                  Created at runtime by Codex (Auditor, append-only)
├── WarZone.md                         Created at runtime — three-phase discussion log
├── .archive/                          Log.md + Feedback.md + DISCUSS.md moved here (2026-04-14)
├── Test/                              Test output folder (login page built here)
├── Images/
│   └── architecture.webp              145 KB — embedded at top of root README.md (committed)
├── landing/                           Next.js 16 landing site — **separate git repo**, gitignored from the Argus repo. Lives here on disk for local dev convenience but NOT pushed with Argus. See "Landing Site" section below for full structure.
├── .gemini/GEMINI.md                  Builder role spec — REWRITTEN (reads Plan.md, logs Build-Log.md)
├── .claude/CLAUDE.md                  Planner role spec — REWRITTEN (writes Plan.md, not auditor anymore)
├── .codex/CODEX.md                    Auditor role spec — REWRITTEN (reads Plan.md + Build-Log.md, grades to Build-Feedback.md)
├── README.md                          REWRITTEN — project overview w/ ASCII arch diagram + three-agent pipeline
├── workflow.md                        REWRITTEN — full state machine walkthroughs + NATS topics + troubleshooting
└── argus-ui/README.md                 REWRITTEN — UI stack + scripts + section map + extension guide
```

---

## .env Contents (hermes/.env)

```
WORK_DIR=/Users/karinganageshgoud/Desktop/Karinga.dev/NK-Base
CLAUDE_SESSION_ID=<uuid>    # seeded manually — see seeding procedure below
GEMINI_SESSION_ID=<uuid>    # seeded manually — added 2026-04-15
CODEX_SESSION_ID=<uuid>     # seeded manually
CHAT_PORT=3001
BUILD_PORT=3002
WARZONE_PORT=3003
CHAT_DIR=/tmp/argus-chat
# Auth — leave API_KEY empty for local dev (no auth). Set for production.
API_KEY=
# CORS — restrict to frontend origin.
ALLOWED_ORIGIN=http://localhost:5173
```

**All three session keys are required.** Missing/blank = resume command substitutes empty string → CLI errors out loudly on startup. That's the correct failure mode; no silent fallback.

**Seeding procedure — same pattern for all three bots:**

| Bot | How to get UUID |
|---|---|
| Claude | `cd NK-Base && claude` → small task → `/exit` → copy UUID from resume hint |
| Gemini | `cd NK-Base && gemini` → small task → `/exit` → last line prints `To resume this session: gemini --resume <UUID>` |
| Codex | `cd NK-Base && codex exec "list files"` → copy UUID from `session id: <UUID>` header line |

Paste each into `hermes/.env`, then restart hermes. See "Session Management Convention" section for the full rationale and the planned Reset Sessions UI button.

---

## ⚠️ CRITICAL: XState v5 Note

The project uses **XState v5.14.0**. Key architectural pattern:

1. `snapshot.changed` does NOT exist in v5 — always `undefined`. Never use it as a guard.
2. `interpret` is deprecated — use `createActor` (both workflows now use it).
3. **Side effects belong in machine entry actions, NOT in `service.subscribe()`.** Subscriber is observer-only: logging + broadcasting.
4. **⚠️ v5 default is INTERNAL self-transitions — entry does NOT re-fire on `{ target: 'self' }`.** This reverses the v4 default. For retry self-transitions to re-launch the agent, the transition MUST declare `reenter: true`:
   ```js
   BUILD_FAILED: [
       { target: 'building', guard: 'canRetry', actions: 'incrementRetry', reenter: true }, // REQUIRED
       { target: 'paused' },
   ],
   ```
   Without `reenter: true` the machine silently transitions to itself, increments the counter, but never calls `startBuilder` again — leaving the pipeline frozen with no process running. Confirmed 2026-04-15 on iteration 2 audit retry (see "Bugs found during first E2E" below). The earlier memory claim "entry fires on every state entry including self-transitions" was wrong for v5 — it described v4 behavior.

**Current correct pattern** (both build.js and warzone.js):
```js
let service; // forward declaration — closures capture by reference

function launchBuilder() { /* side effects: runAgent(...), logEvent(...) */ }
function launchAuditor() { /* side effects */ }

const machine = createMachine({
    states: {
        building: {
            entry: 'startBuilder', // ⚠️ only re-fires on retry if the self-transition declares `reenter: true` (v5 default is internal)
            on: {
                BUILD_FAILED: [
                    { target: 'building', guard: 'canRetry', actions: 'incrementRetry', reenter: true },
                    { target: 'paused' },
                ],
            },
        },
        // ...
    },
});

service = createActor(machine.provide({
    actions: { startBuilder: launchBuilder, startAuditor: launchAuditor, ... },
    guards:  { canRetry: () => retryCount < 1 },
}));

// Subscriber is observer-only — NO business logic here
let lastState = null;
service.subscribe((snapshot) => {
    if (snapshot.value === lastState) return;
    lastState = snapshot.value;
    broadcast(snapshot.value);
});
```

Prior band-aid (`lastHandledRetryCount` to detect self-transitions in subscriber) has been reverted — it was symptom-patching a design flaw.

---

## Auth System (hermes/core/auth.js)

Shared module used by all 3 servers:
- `corsMiddleware` — sets `ALLOWED_ORIGIN` CORS header, handles OPTIONS preflight
- `authMiddleware` — checks `X-Api-Key` header. Skipped if `API_KEY` unset (local dev)
- `wsAuth(req)` — checks `?key=` query param on WS upgrade. Skipped if `API_KEY` unset

Frontend helpers in `argus-ui/src/config.ts`:
- `authHeaders()` — returns `{ 'X-Api-Key': key }` or `{}` if unset
- `wsUrl(url)` — appends `?key=...` to WS URL or returns unchanged if unset

**Production setup:**
```
hermes/.env:   API_KEY=your-secret   ALLOWED_ORIGIN=https://your-domain.com
argus-ui/.env: VITE_API_KEY=your-secret
```

---

## agents.json — Key Config (post 2026-04-15 session-unification)

Six agents total: `builder`, `planner`, `codex_auditor` (pipeline) + `discuss_builder`, `discuss_planner`, `discuss_codex` (warzone). **All six follow the same template shape:** `<cli> --resume {XXX_SESSION_ID} ... "{task}"`. There is NO `resumeCommand` or `chatCommand` field anywhere — every invocation uses the static `command` template that resumes a manually-seeded env-var UUID.

- **builder / discuss_builder** (Gemini): `gemini --resume {GEMINI_SESSION_ID} -p "{task}" -y`. `builder` has `suppressStderr: true` + `noisePatterns` array (YOLO notice, IDEClient error, MCP issues, etc.). `discuss_builder` does NOT suppress stderr.
- **planner / discuss_planner** (Claude): `claude --resume {CLAUDE_SESSION_ID} --allowedTools Edit Write Read Glob Grep -p "{task}" < /dev/null`. The `< /dev/null` prevents Claude from hanging on interactive permission prompts; `--allowedTools` is the whitelist Claude obeys when stdin is closed.
- **codex_auditor / discuss_codex** (Codex): `codex exec resume {CODEX_SESSION_ID} --full-auto --skip-git-repo-check "{task}"`. No `-C <dir>` — `codex exec resume` does NOT accept that flag (see Bug C below); WORK_DIR is set via spawn `cwd` instead.
- Shell injection fixed: `shellEscape()` wraps task in single quotes before shell interpolation.

**Substitutions in [hermes/core/agents.js](../hermes/core/agents.js) `buildCommand`:**
```js
.replace('"{task}"', shellEscape(task))
.replace('{CLAUDE_SESSION_ID}', process.env.CLAUDE_SESSION_ID || '')
.replace('{CODEX_SESSION_ID}', process.env.CODEX_SESSION_ID || '')
.replace('{GEMINI_SESSION_ID}', process.env.GEMINI_SESSION_ID || '')
.replace('{WORK_DIR}', WORK_DIR || '');
```

**Dead code removal — COMPLETE (2026-04-15 evening).** After the session-unification simplified the command templates (no more `resumeCommand` / `chatCommand` anywhere), the supporting branching in `agents.js` became pure dead code. All removed in one pass:

- `hasRun = {}` tracking map — gone.
- `resetSession(agentKey)` function — gone. Also removed the 6 calls in build.js `submitTask()` and warzone.js `submitDiscuss()`.
- `chatMode`/`chatCommand` branch in `buildCommand` — gone. Also removed `chatMode: true` from chat.js's `runAgent` options.
- `isResume ? resumeCommand : command` branch — gone. `buildCommand` now just reads `agent.command` and runs four template substitutions (task + three session IDs + WORK_DIR).
- `publish('agent.started', { ..., resume: isResume })` — dropped the `resume` field (no consumer was reading it; verified via grep).
- Log line simplified: `[agents] Running Claude (new)` → `[agents] Running Claude`.

`buildCommand` dropped from ~20 lines to ~9. `runAgent`'s options object now only accepts `outputTopic` and `cwd`. `node --check` clean on all four touched files. See [hermes/core/agents.js](../hermes/core/agents.js), [hermes/workflows/build.js](../hermes/workflows/build.js), [hermes/workflows/warzone.js](../hermes/workflows/warzone.js), [hermes/servers/chat.js](../hermes/servers/chat.js).

---

## Session Management Convention (2026-04-15) — PERMANENT

**All three bots use the same pattern: a manually-seeded UUID in `hermes/.env`, substituted into the command template at runtime, never rotated automatically.**

| Env var | CLI call shape | Seed procedure |
|---|---|---|
| `CLAUDE_SESSION_ID` | `claude --resume {UUID} --allowedTools ... -p "..." < /dev/null` | `cd NK-Base && claude` → small task ("list files in hermes/") → `/exit` → copy UUID from resume hint |
| `GEMINI_SESSION_ID` | `gemini --resume {UUID} -p "..." -y` | `cd NK-Base && gemini` → small task → `/exit` → last line prints `To resume this session: gemini --resume <UUID>` → copy UUID |
| `CODEX_SESSION_ID` | `codex exec resume {UUID} --full-auto --skip-git-repo-check "..."` | `cd NK-Base && codex exec "list files in hermes/"` → copy UUID from `session id: <UUID>` header line. (Or `codex` interactive mode, same pattern as Claude.) |

After updating `.env`, restart hermes:

```bash
lsof -ti:3001,3002,3003,5173 | xargs kill -9 2>/dev/null; cd /Users/karinganageshgoud/Desktop/Karinga.dev/NK-Base && npm run dev
```

**Why this is the permanent design (not a bandaid):**

1. **Symmetric across all three CLIs** — one mental model, one workflow for rotation.
2. **Zero runtime magic** — no stdout parsing, no filesystem watching, no capture maps. `.env` → template substitution → spawn. Impossible to break with a CLI version bump.
3. **User-visible, user-controlled rotation** — the user decides when context should reset. Session rotation becomes a deliberate action ("I finished a task, want to start fresh") rather than an implicit side effect of task transitions.
4. **Sessions are shared across audit/build/warzone/chat within a single seed** — a bot remembers everything it did across flows. Codex in chat can reference "why did you give that a B?" because it's the same session that wrote the audit. Same pattern Claude already had.

**Rejected alternatives (documented so future-me doesn't re-invent them):**

- **Runtime UUID capture from stdout.** Works (verified with a regex on `session id: <UUID>` from Codex's exec header, and Gemini prints a similar hint). But fragile: depends on unchanging CLI output format, and asymmetric with Claude which doesn't support this pattern cleanly. See Bug C above.
- **Per-agent-key session maps** (separate sessions for `codex_auditor` vs `discuss_codex` vs chat codex). Rejected as over-engineering — Claude/Gemini already share one session across all flows and haven't had problems from it.
- **`--last` / `--resume latest` for any bot.** Cross-contaminates concurrent flows via cwd filtering. Applied to both Codex (rejected before merging) and Gemini (already in place, removed 2026-04-15).

### Reset Sessions button (BUILT 2026-04-15 evening ✓)

Documentation-only modal triggered from the sidebar. **No server-side state mutation, no API calls, no state touched.** The modal shows the three seed procedures above as code blocks + a RESTART HERMES step. Permanence comes from the design being pure documentation — nothing runtime to break.

Implementation: [argus-ui/src/components/Layout/ResetSessionsModal.tsx](../argus-ui/src/components/Layout/ResetSessionsModal.tsx) — 640px white panel, zero radius, no shadow, Escape/backdrop/CLOSE close. Sidebar button at `margin-top: auto` above Stop, Helvetica 400 14px uppercase letter-spacing 2px, color `#bbbbbb` → white on hover. Opens modal via local `useState` in Sidebar.tsx. Full spec in [Argus-Design.md §4](../Argus-Design.md).

### hermes/.env (session keys expected)

```
CLAUDE_SESSION_ID=<uuid>
GEMINI_SESSION_ID=<uuid>
CODEX_SESSION_ID=<uuid>
# plus the other pre-existing keys (WORK_DIR, NATS_URL, etc.)
```

If any session UUID is missing/blank, the resume command substitutes an empty string and the CLI errors out loudly at startup. That's the correct failure mode — tells the user which key to seed. No silent fallback to `--last` or fresh sessions.

---

## watcher.js — Mode Split + Content-Based Diff (FIXED ✓)

Two fixes combined:

1. **Mode split**: `startWatcher('build')` vs `startWatcher('warzone')` — each server watches only its own files.
2. **Content-based diff** (Fix 10 + warzone rewrite fix): tracks full file content, not byte offsets. Agents sometimes rewrite entire files (read-modify-write) — byte offsets broke when file size didn't match appended content. `getNewContent(current, lastKnown)` strips the known prefix, or falls back to scanning for divergence point if the file was rewritten.

```js
// Post-refactor names: watcher.js tracks Plan.md / Build-Log.md / Build-Feedback.md / WarZone.md
let lastPlanContent = '', lastBuildLogContent = '', lastBuildFeedbackContent = '', lastWarzoneContent = '';
// No lastPlanMatched boolean — Fix 36 (2026-04-15 afternoon) removed it after Bug E.
// Plan.md fires plan.completed on content-change + pattern-match only. Watcher is stateless
// across task boundaries; submitTask guarantees Plan.md is absent at task start.

function getNewContent(current, lastKnown) {
    if (current === lastKnown) return '';
    if (current.startsWith(lastKnown)) return current.slice(lastKnown.length);
    // File was rewritten — find divergence point
    let i = 0;
    const minLen = Math.min(current.length, lastKnown.length);
    while (i < minLen && current[i] === lastKnown[i]) i++;
    return current.slice(i);
}
```

Why byte offsets failed: agents sometimes rewrite the warzone file entirely (read-modify-write). Byte offset said "read from byte N" but the rewritten file may be shorter or have different content at that offset → stale content re-scanned → stale events republished. Content tracking is the permanent fix: compares actual content, so duplicate detection is structurally correct regardless of append vs rewrite. **Plan.md is special — it is deleted by `submitTask` before each task and written fresh by Claude.** The watcher fires `plan.completed` on content-change + pattern-match (no edge trigger, no boolean state — see Fix 36 for why the original edge-trigger design was removed).

---

## Build Workflow Key Details

```js
// submitTask() is now minimal — no session reset needed (session IDs are static env vars).
// Just sets currentTask, zeros iterationCount, creates DB row, fires TASK_SUBMITTED event.

// Revision-aware prompt (inside launchBuilder)
const revisionNote = iterationCount > 1
    ? ` This is revision ${iterationCount}. Read Build-Feedback.md — find the latest audit entry and fix every issue listed under "Instructions for Gemini". Do not re-do work that already passed.`
    : '';
const logReminder = ` When done, append a new ### Iteration entry to Build-Log.md (required — the pipeline watches for it).`;
```

Grade tracking: `lastGrade` module var, set in `grade.received`, used in `done` state. DB column `final_grade`, aliased as `grade` in `getHistory()`.

History: broadcast `{ type: 'history', items: getHistory() }` after `done` state and after `abort`.

Abort: calls `completeTask(..., 'CANCELLED')` before clearing `currentTaskId`.

---

## Build States (three-agent)

```
idle → planning → building → auditing → awaiting_approval → building (loop on B/C/F)
      (Claude)   (Gemini)   (Codex)                         Plan.md frozen on revision
                                        ↘ done (grade A)
planning/building/auditing → paused (after 1 retry failure)
paused → building (RETRY) | idle (ABORT)
done → planning (new TASK_SUBMITTED)
```

## Warzone States (three-phase)

```
idle → discussing_claude → discussing_gemini → discussing_codex → awaiting_discuss_approval → idle
       (Planner first)     (Builder take)     (Auditor pokes holes)
any → idle (ABORT)
```

---

## All Fixes Applied (confirmed in current code ✓)

1. CORS missing → added to all 3 servers (now via auth.js) ✓
2. Claude session not found → Claude uses WORK_DIR cwd ✓
3. Claude stdin warning → `< /dev/null` on all Claude commands ✓
4. Gemini output doubled → `suppressStderr: true` ✓
5. React Strict Mode double WS → per-connection `closed` closure flag ✓
6. Gemini startup noise → `noisePatterns` + filter in agents.js ✓
7. Gemini no project context in chat → `ensureChatGeminiMd()` on startup ✓
8. Revision loop broken → `revisionNote` in build prompt ✓
9. New task reuses old Gemini session → `resetSession('builder')` in `submitTask()` ✓ — **superseded by Fix 31 (2026-04-15):** `resetSession` removed entirely after session-unification made Gemini use a static env UUID (no per-process session state to reset)
10. NATS topic cross-contamination → separate `build.output`, `warzone.output`, `chat.output` ✓
11. Double watcher events → `startWatcher(mode)` splits file watching by server ✓
12. XState duplicate subscriber → `lastBuildState`/`lastHandledRetryCount` guard (NOT `snapshot.changed`) ✓
13. Grade tracking broken → `lastGrade` var, `final_grade AS grade` alias in getHistory ✓
14. History not live → `broadcastFn({ type: 'history', items: getHistory() })` after done/abort ✓
15. Abort leaves RUNNING → `completeTask(..., 'CANCELLED')` before clearing ID ✓
16. Frontend build errors → `type KeyboardEvent`, removed `MessageSquare`, `connectRef` pattern ✓
17. Shell injection → `shellEscape()` wraps task in single quotes ✓
18. No .gitignore → created root `.gitignore` ✓
19. Hardcoded localhost → `VITE_HOST`, `VITE_*_PORT` env vars with defaults ✓
20. Unauthenticated APIs → `hermes/core/auth.js` with API key + restricted CORS ✓
21. Unused `GRADE_PATTERN` in watcher.js → removed ✓
22. Unused `publish` import in build.js → removed ✓
23. XState retry path broken by subscriber guard (Fix 9) → agent launches moved to machine entry actions; `createActor` replaces deprecated `interpret`; subscriber is observer-only ✓ — **Completed by Fix 33 (Bug B): added `reenter: true` to all three retry self-transitions for v5 semantics.**
24. Watcher republishes stale events on file growth (Fix 10) → content-based diff replaces byte offsets; handles both append and rewrite cases ✓
25. Servers bound to all interfaces (Fix 11) → `BIND_HOST` env var, defaults to `127.0.0.1`, applied to all 3 servers ✓
26. Fetch calls didn't check response.ok (Fix 12) → all 7 hook fetches now check `res.ok`, throw with server error, UI only clears state after success ✓
27. Protocol hardcoded http/ws (Fix 13) → derived from `window.location.protocol` in `config.ts` ✓
28. Lint `react-hooks/refs` errors → `connectRef.current = connect` moved into `useEffect(() => { connectRef.current = connect; }, [connect])` in all 3 WS hooks ✓
29. Warzone: Gemini writing to Log.md during discussion → prompt override prepends "IMPORTANT: This is a DISCUSSION task, not a build task. Do NOT write to Log.md" and appends reinforcement — overrides `.gemini/GEMINI.md` system instructions for discussion mode ✓
30. Warzone: Claude blocked on file-write permission prompt → `--allowedTools Edit Write Read Glob Grep` added to all Claude commands in agents.json ✓
31. Dead code from pre-unification session plumbing (2026-04-15) → removed `hasRun` map, `resetSession` function + 6 call sites, `chatMode`/`chatCommand` branch, `isResume ? resumeCommand : command` branch, `resume` field in `agent.started` payload, `chatMode: true` option in chat.js. agents.js `buildCommand` now 9 lines (was 20). `node --check` clean on all four touched files ✓
32. Docs unified with 2026-04-15 session-unification → [hermes/HERMES.md](../hermes/HERMES.md) fully rewritten (was entirely pre-three-agent); [README.md](../README.md) + [workflow.md](../workflow.md) session-seeding sections updated with all three bots; [hermes/HERMES-workflow.excalidraw](../hermes/HERMES-workflow.excalidraw) Gemini + Codex + Claude agent boxes updated to symmetric `--resume {SESSION_ID}` form (JSON validity verified); [.env.example](../.env.example) restructured with all three agent seeding procedures and explicit "Hermes never creates sessions" note ✓
33. Bug B — XState v5 retry self-transitions never re-fired entry (2026-04-15 evening) → added `reenter: true` to PLAN_FAILED, BUILD_FAILED, AUDIT_FAILED retry transitions in [hermes/workflows/build.js:90,103,115](../hermes/workflows/build.js). v5 default is internal self-transitions (v4 was external); without `reenter: true`, `retryCount` incremented but `startPlanner/startBuilder/startAuditor` entry actions never re-fired, leaving the pipeline frozen. warzone.js has no retry transitions — confirmed via grep. Node syntax check clean. Pending E2E verification (needs a non-A audit to exercise the path) ✓
34. `.env.example` moved from repo root to [hermes/.env.example](../hermes/.env.example) (2026-04-15 evening) → symmetric with `hermes/.env` (the actual config file). Copy flow is now `cp hermes/.env.example hermes/.env`. No live docs referenced the root path; all remaining mentions are in `.archive/` (historical) ✓
35. BMW-literal UI redesign applied (2026-04-15 evening) → 9 argus-ui files changed per [Argus-Design.md §9](../Argus-Design.md). Identity shift from dark-violet-rounded to white-dominant BMW Blue `#1c69d4` + Helvetica + zero radius + weight extremes 300/400/700/900. Dark `#262626` strips survive only in sidebar, log panel, Warzone discussion panel. All Lucide nav icons removed. All semantic grade colors (emerald/amber/orange/red) removed — grade letter renders as 60px Helvetica Light hero (BMW Blue for A, Near Black for B/C/F). Reset Sessions button + documentation-only modal added (zero server calls). App.css deleted (unused Vite template). `npm run build` + `npm run lint` both clean ✓
36. Bug E — plan.completed edge-trigger stuck planning when Plan.md pre-existed with READY marker (2026-04-15 afternoon) → watcher's `lastPlanMatched` boolean was seeded `true` at server startup if Plan.md on disk already ended in `**Plan Status:** READY` (leftover from a prior task). When Claude then overwrote Plan.md with a new plan that also ended in READY, the edge condition `matchesNow && !lastPlanMatched` evaluated false → `plan.completed` never published → state stuck in `planning` indefinitely. Permanent fix (structural, not band-aid) applied in two parts: (a) removed `lastPlanMatched` entirely from [hermes/core/watcher.js](../hermes/core/watcher.js) — watcher now stateless across task boundaries, fires on content-change + pattern-match (chokidar's `awaitWriteFinish: { stabilityThreshold: 1000 }` already guarantees single-fire per write). (b) `submitTask()` in [hermes/workflows/build.js](../hermes/workflows/build.js) now `fs.unlinkSync(PLAN_FILE)` before state transitions — Plan.md is guaranteed absent at task start, Claude's Write tool always creates fresh (chokidar `add` event, not `change`), "overwrite, don't append" becomes structurally enforced instead of prompt-dependent. Node syntax clean on both files ✓
37. Landing site rebuild — Next.js 16 + TS + Tailwind 4 (2026-04-15 afternoon) → old static HTML/CSS/JS at [landing/](../landing/) deleted entirely (the BMW-literal version the three-agent pipeline had built that morning, kept long enough to validate the pipeline, then replaced). New Next.js 16 App Router app scaffolded at `landing/` with `output: 'export'` static generation, Geist Sans + Geist Mono via `next/font/google`, single lime accent `#b6ff3c` on near-black `#0a0a0a` canvas. Terminal-native feel — NOT an extension of the BMW dashboard identity, explicit "fresh marketing voice, dashboard stays BMW" decision. Hero centerpiece is [PipelineReplay.tsx](../landing/src/components/PipelineReplay.tsx) — a scripted terminal that types a real task prompt then streams `[claude]`/`[gemini]`/`[codex]` log lines mimicking the B→B→A trajectory from the morning's E2E. See "Landing Site" section below for full structure, content decisions, and verification. Build clean, `/` + `/analytics` both pre-rendered ✓
38. Warzone DiscussionReview — pretty-printed markdown rendering of the three-agent discussion (2026-04-15 evening) → previously the warzone UI only showed raw agent stdout (wall of log lines, noisy, tool-use traces) during AND after the discussion. Added `GET /warzone.md` endpoint to [hermes/servers/warzone.js](../hermes/servers/warzone.js) that returns the raw file. New component [argus-ui/src/components/WarzoneView/DiscussionReview.tsx](../argus-ui/src/components/WarzoneView/DiscussionReview.tsx) fetches it when state transitions to `awaiting_discuss_approval`, parses out the latest `### Discussion N` block, splits on the three `####` subheadings (Claude's Plan / Gemini's Build Approach / Codex's Audit), strips the `**Planner Status:** DONE` / `**Builder Status:** DONE` / `**Auditor Status:** READY TO BUILD` signaling markers (they're for the watcher only), renders each section as a BMW-styled card with weight-900 agent label + BMW Blue role tag + `react-markdown` + `remark-gfm` body with custom components (Helvetica tokens, zero radius, hairline borders, dark code blocks). During the three busy phases the original dark-log panel still streams raw output for live progress — only the AFTER view is pretty-printed. Added deps: `react-markdown@^10` + `remark-gfm@^4`. ✓
39. npm workspaces migration (2026-04-15 evening, prep for first github push) → previously three separate `node_modules/` folders (root/ for concurrently, hermes/, argus-ui/) each with its own install step. Restructured as npm workspaces: root [package.json](../package.json) declares `"workspaces": ["hermes", "argus-ui"]`, bumped version to 0.3.0, added `"engines": { "node": ">=20" }`. Dropped redundant `concurrently` devDep from hermes/package.json. Deleted all three node_modules + hermes/package-lock.json + argus-ui/package-lock.json. Single `npm install` at root installs 433 packages into one hoisted `node_modules/` with symlinks (`node_modules/hermes → ../hermes`, `node_modules/argus-ui → ../argus-ui`). Single consolidated `package-lock.json` (235 KB) at root. Verified: all 3 hermes servers boot cleanly through workspace symlinks, argus-ui builds + lints clean, `require('better-sqlite3')` etc. resolve to the hoisted root copy. `landing/` is NOT a workspace (separate repo, separate install). Gotcha documented in [hermes/HERMES.md](../hermes/HERMES.md): running `npm install` inside `hermes/` creates a shadow node_modules that breaks the symlink — install only at root. ✓
40. Repo git-ready (2026-04-15 evening) → three gitignores reconciled for first push: [/.gitignore](../.gitignore) rewritten (excludes `landing/`, all runtime artifacts Plan.md/Build-Log.md/Build-Feedback.md/WarZone.md, hermes.db, .env files in both root and hermes/, UI build output, OS junk); new [hermes/.gitignore](../hermes/.gitignore) covering .env, hermes.db, runtime .md artifacts; [argus-ui/.gitignore](../argus-ui/.gitignore) unchanged (was already fine). `Images/architecture.webp` (145 KB, resized from `Architechture.png` at root) placed at repo root so root README can embed it — landing/public/ copy stays for the landing site. Root README.md fully rewritten with: architecture image at top, "Why Argus" section, cross-platform prerequisites table (macOS brew / Linux binary+go / Windows scoop+choco / Docker), single-install workspaces flow, session-seeding walkthrough with exact commands per agent, runtime-files table with "never committed" note, state tables, file-signal table, troubleshooting matrix, docs index. `landing/` explicitly called out as separate-repo. [hermes/HERMES.md](../hermes/HERMES.md) and [argus-ui/README.md](../argus-ui/README.md) audited + updated for workspace install flow and post-BMW stack (dropped Lucide mention, added react-markdown). Windows caveat added for POSIX-shell quoting in `npm run dev`. ✓
41. Landing site — assorted tweaks during 2026-04-15 evening polish pass ✓:
    - **Hero two-column layout**: terminal was full-width below the headline, moved to a right column beside the copy. Container widened 1200→1280, headline clamp shrunk `(40,7vw,80)` → `(36,5vw,58)` so "Zero babysitting." fits at the new column width, subhead trimmed 18→17px / max 620→520. Stacks below 900px. CTA copy `See it run ↓` → `How it works ↓` (terminal is now visible in hero, old label was redundant).
    - **Nav wordmark bumped** 15→22px, tracking 0.18→0.22em.
    - **Architecture image swapped**: Nagesh dropped a new `Architechture.png` (note spelling) at repo root — 1786×1576, 474 KB source. Converted to `landing/public/architecture.webp` (145 KB) and `Images/architecture.webp` (same file, for the root README). Old `workflow.webp` removed from landing/public/ (unused). Alt text in [SeeItInAction.tsx](../landing/src/components/SeeItInAction.tsx) rewritten to describe the full orchestration workflow (build + warzone state machines, file signals, session strategy) since the diagram is now the detailed Hermes workflow, not just the 3-agent handoff.
    - **Footer LinkedIn icons + names**: Nagesh edited [Footer.tsx](../landing/src/components/Footer.tsx) to list two people with titles — `Nagesh Karinga - Software Developer` (`mailto:nageshkaringa@gmail.com` + LinkedIn `/in/nageshkaringa/`) and `Anish Jakka Singaraiah - Software Architect` (`mailto:anishjakka@gmail.com` + LinkedIn `/in/anish-jakka-singaraiah/`). LinkedIn icon is an inline 14×14 SVG (no new dep), `--color-fg-2` default → accent on hover.
    - **Roadmap user-edit**: Nagesh flipped three items from `SHIPPED` → `ACTIVE` (CLI First / Dashboard / Warzone mode) and moved Agents Analytics from `ACTIVE` → `NEXT`. `StatusChip` tones re-ordered to match (ACTIVE in accent, SHIPPED in fg-0, NEXT in fg-2). His framing: nothing is "shipped" yet in the strict sense since the product isn't distributed — everything currently in the codebase is "active development." Preserved as-is. See [landing/src/components/Roadmap.tsx](../landing/src/components/Roadmap.tsx).
42. argus-ui dark-lime redesign — BMW → landing-style port (2026-04-15 evening → 2026-04-16 morning, LIVES ON `ui-redesign-argus` BRANCH ONLY, NOT ON MAIN) → Nagesh asked to unify the dashboard's design language with the landing site. Ported the landing's tokens verbatim: near-black `#0a0a0a` canvas (was white), single lime accent `#b6ff3c` (was BMW Blue `#1c69d4`), Geist Sans + Geist Mono via Google Fonts `<link>` in [argus-ui/index.html](../argus-ui/index.html) (was Helvetica stack), weight palette 400/500/600 (dropped the 300/700/900 BMW extremes). Zero radius preserved. 10 files rewritten: [index.css](../argus-ui/src/index.css), [App.tsx](../argus-ui/src/App.tsx), [Sidebar.tsx](../argus-ui/src/components/Layout/Sidebar.tsx), [ResetSessionsModal.tsx](../argus-ui/src/components/Layout/ResetSessionsModal.tsx), [BuildView/index.tsx](../argus-ui/src/components/BuildView/index.tsx), [ChatView/index.tsx](../argus-ui/src/components/ChatView/index.tsx), [WarzoneView/index.tsx](../argus-ui/src/components/WarzoneView/index.tsx), [DiscussionReview.tsx](../argus-ui/src/components/WarzoneView/DiscussionReview.tsx), [LogsView/index.tsx](../argus-ui/src/components/LogsView/index.tsx), [index.html](../argus-ui/index.html). Build + lint clean (381 KB JS, 115 KB gzip). **Outcome:** Nagesh tested live, surfaced the Gemini exit-42 chat bug (see Bug F below) during testing, then reset the dashboard changes back to BMW on `main` and pushed the dark-lime version to a **separate branch `ui-redesign-argus`** for preservation. Current `main` is BMW-era; current working branch `hermes-agents-workflow-change` is also BMW-era. **The redesign is NOT abandoned — it's parked on its branch until Nagesh decides whether to merge.**
43. First GitHub push complete (2026-04-16 morning) → repo live at **[github.com/Nkaringa/ARGUS](https://github.com/Nkaringa/ARGUS)**. Git identity set repo-locally to `Nkaringa <NageshKaringaGoud@my.unt.edu>` (Nagesh's school account, NOT his personal `nageshkaringa@gmail.com` global) — `git config user.name "Nkaringa"` + `git config user.email "NageshKaringaGoud@my.unt.edu"` applied by Nagesh. Three branches exist:
    - **`main`** (`41a86f3` "Initial project upload") — BMW baseline
    - **`ui-redesign-argus`** (`a2ecfbe` "Refactor UI components for improved styling and consistency") — dark-lime dashboard redesign (Fix 42)
    - **`hermes-agents-workflow-change`** (local only, branched from main at `41a86f3`) — CURRENT working branch for new workflow-level changes
    `landing/` is gitignored and pushed to its own repo separately (per plan).
44. WORK_DIR project-folder model + off-limits agent prompts (2026-04-16, hermes-agents-workflow-change branch) → triggered by friend's first-time E2E findings: he set `WORK_DIR=/path/to/argus` (the clone root) and Gemini built his "landing page" task INSIDE `argus-ui/` because that's the obvious React project Gemini saw at cwd. Three changes:
    - **[hermes/.env.example](../hermes/.env.example)**: `WORK_DIR=/path/to/NK-Base` → explicit `WORK_DIR=/absolute/path/to/argus/your-project-folder` with comment block warning *"Do NOT point WORK_DIR at the argus clone root itself — agents will end up building inside hermes/, argus-ui/, or other argus internals."* Recommends `mkdir Portfolio` workflow.
    - **[hermes/workflows/build.js](../hermes/workflows/build.js)**: rewrote all three agent prompts (planner / builder / auditor). Removed `"NK-Base project root"` hardcode. Replaced lone `"Do NOT modify anything in hermes/"` line with explicit scope rules listing `hermes/, argus-ui/, landing/, role-doc folders (.claude/, .gemini/, .codex/), parent/sibling directories` as off-limits. Builder gets an extra defense: *"If Plan.md mentions a path outside your working directory, ignore it — scope was misplanned; build only within cwd."* Auditor explicitly forbidden from reading anything outside cwd.
    - **README path**: introduced the *recommended layout* — create `argus/Portfolio/` as a subdirectory inside the clone, point `WORK_DIR` at it. Agents spawn inside `Portfolio/` (empty), can't see argus internals from cwd, build only there. Closes the friend's specific "landing page in argus-ui" failure mode.
45. Role-docs auto-copy on hermes boot (2026-04-16, hermes-agents-workflow-change branch) → users who put their project folder OUTSIDE the argus clone (e.g. argus on Desktop, project in Documents) have agents spawn in a folder where `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.codex/CODEX.md` aren't reachable via the CLIs' upward walk. Without role docs, the pipeline contract breaks silently (Plan.md format wrong, watcher patterns don't match, stuck states). New module **[hermes/core/role-docs.js](../hermes/core/role-docs.js)** exports `ensureRoleDocs()`: on hermes boot, checks `WORK_DIR/.claude/`, `WORK_DIR/.gemini/`, `WORK_DIR/.codex/`. For any missing folder, copies recursively from the argus clone (`<__dirname>/../..`) using `fs.cpSync(src, dest, { recursive: true })`. Logs `[role-docs] Copied .claude → /your/WORK_DIR/.claude (see README for the manual setup alternative)` per copy. Idempotent — never overwrites existing copies (preserves user customizations). Does NOT `mkdir` WORK_DIR if missing (per Nagesh's call) — warns and skips. Wired into [build.js](../hermes/servers/build.js) and [warzone.js](../hermes/servers/warzone.js) boot. NOT wired into chat.js (chat-Gemini uses `CHAT_DIR` with its own `ensureChatGeminiMd()`). Verified on Nagesh's local: works.
46. README split — README.md (concept) + SETUP.md (install) (2026-04-16, hermes-agents-workflow-change branch) → README was 347 lines, half install instructions; first-time visitors had to scroll past prereqs and seed-UUID warnings to reach "what is Argus." Split into two files:
    - **[README.md](../README.md)** (157 lines now) — title, architecture image, `→ Ready to install? See SETUP.md` CTA placed directly under the image, Why Argus, Architecture Overview, Repository Layout (argus's own structure), Three-Agent Pipeline (build/warzone/chat), File Signals, Safety Model, Docs index, License. Pure concept + reference. Zero install commands.
    - **[SETUP.md](../SETUP.md)** (210 lines, NEW) — Prerequisites, 6-step Install (clone+npm install / nats-server with cross-platform table / create project folder with recommended-subdirectory + alternative-anywhere paths / configure .env / seed UUIDs with WORK_DIR seed-from-here warning callout / run with first-boot role-docs log expectation), Runtime files in your project folder (Plan.md/Build-Log.md/Build-Feedback.md/WarZone.md + .gitignore guidance for user's project), Updating role docs after argus pull (manual delete-and-restart), Troubleshooting matrix.
    - **Cross-references updated**: [hermes/HERMES.md](../hermes/HERMES.md) "How to Start" now opens with `For full first-time setup see SETUP.md. Quick commands once you're set up:`. [argus-ui/README.md](../argus-ui/README.md) install section + See Also both link to SETUP.md.
    - Discoverability covered by two anchors in README: prominent CTA under the architecture image, and Docs section at bottom.

---

## Current Status (as of 2026-04-16 morning)

- **Stack boot**: ✓ verified 2026-04-15. `npm run dev` brings all 4 processes up clean — chat:3001, build:3002, warzone:3003, ui:5173. NATS connects, both state machines start at `idle`, watchers attach to their respective files. No port conflicts, no startup errors.
- **Build pipeline (3-agent) — LIVE-VERIFIED END-TO-END ✓ (2026-04-15 afternoon)**: First full successful E2E ran the landing-page BMW redesign task through three complete iterations: grade B → grade B → grade A. Timeline: Plan.md written 13:16 (Claude) → Build-Log.md iteration 1 at 13:24 (Gemini) → Build-Feedback.md iteration 1 audit at 13:25 (Codex, grade B with actionable "Instructions for Gemini") → iteration 2 build+audit (grade B, narrower fixes) → iteration 3 build+audit (grade A, COMPLETE). Validates: Fix 33 (Bug B `reenter: true`) on two consecutive retry self-transitions, Fix 36 (Bug E plan.completed edge-trigger removal + submitTask Plan.md delete), Plan.md-frozen-across-iterations design, session unification (all three bots on manual env UUIDs). Codex audit quality was substantive — caught real spec violations (`border-radius: 50% !important` slipping in, 80px watermark vs 60px spec, 8px vs 4px node size, line-height 1 outside 1.15–1.30 band) and even caught a self-contradiction in Claude's plan ("zero border-radius everywhere" vs "4px circle node") and made the judgment call to honor zero-radius.
- **Session management**: unified 2026-04-15, verified live. All three bots run through `--resume {UUID}` from `hermes/.env`. During the 3-iteration E2E run, sessions were rotated once mid-session by Nagesh (between stuck-plan attempts this morning) without issue — rotation = manual `.env` edit + restart, exactly as the Reset Sessions modal documents.
- **Dead code cleanup (2026-04-15 evening)**: complete. agents.js / build.js / warzone.js / chat.js all simplified to single-path session logic. No vestigial branches. Docs now match code (HERMES.md rewritten, README/workflow/excalidraw updated, .env.example restructured).
- **UI on `main` = BMW-era** (Fix 35, shipped + stable): white canvas + BMW Blue `#1c69d4` + Helvetica stack + zero radius + weight extremes 300/400/700/900. Dark `#262626` strips in sidebar, log panel, warzone discussion panel, code blocks. No Lucide nav icons. Grade letter renders as 60px Helvetica Light hero (BMW Blue for A, Near Black for B/C/F). Reset Sessions modal is pure documentation.
- **UI on `ui-redesign-argus` branch = dark-lime** (Fix 42, parked, not on main): near-black `#0a0a0a` canvas, lime `#b6ff3c` accent, Geist Sans/Mono, weight palette 400/500/600. Mirrors the landing site identity. Awaiting Nagesh's decision on whether to merge to main.
- **Warzone (3-phase)**: code complete, not live-run yet ⚠️ (but pretty-printed markdown review panel shipped 2026-04-15 evening — see Fix 38)
- **Chat (Gemini + Claude + Codex)** — status split by agent as of 2026-04-16 afternoon:
    - **Claude chat ⚠ blocked by billing today** — Nagesh's Claude.ai account is "out of extra usage" / "background usage" pool depleted. Both VSCode-icon and terminal `claude` invocations fail with the same error (`API Error 400: You're out of extra usage. Add more at claude.ai/settings/usage`). Affects ALL Claude calls from hermes (planner + chat), not just chat. Not a code bug. Resolves when Nagesh tops up at https://claude.ai/settings/usage or weekly reset hits. Curiously, this in-Claude-Code conversation continues to work — likely session-level budget reservation OR different model variant (Opus 4.7 1M-context). Until resolved, build pipeline tasks fail at planning step.
    - **Codex chat ✓ verified working 2026-04-16 afternoon** — `hello` returned `Hello.` cleanly, header showed `workdir: /Users/.../NK-Base`, `model: gpt-5.4`, `session id: 019d9203...`.
    - **Gemini chat ✗ BROKEN** — exits with code 42 on every message. Three independent observations now (2026-04-15 evening + two on 2026-04-16). **Leading hypothesis: cwd / session-store mismatch between CHAT_DIR (where chat-Gemini spawns) and WORK_DIR (where SETUP.md tells users to seed the UUID).** See **Bug F** below for full analysis + sharpened hypothesis + 2-minute test to confirm.
- **Landing site (Next.js 16)**: rebuilt from scratch 2026-04-15 afternoon replacing the static HTML/CSS/JS version the pipeline had built that morning. Static export builds clean, both routes (`/` and `/analytics`) pre-render as static HTML, TypeScript clean, no warnings. Dev server verified via `curl http://localhost:3000/` + `curl http://localhost:3000/analytics/` both returned 200. **Pending: visual review by Nagesh in a browser** — see "Landing Site" section below for component-by-component checklist.
- **Logs section**: unchanged, was working pre-refactor ✓
- **Telegram bot**: fully removed ✓
- **Frontend typecheck + build + lint**: pass clean ✓ (post-refactor)
- **All 13 Codex audit findings fixed ✓** (pre-refactor)
- **File structure**: ✓ verified 2026-04-15 against `workflow.md` — exact match after restore + cleanup (see "2026-04-15 restore incident" below).
- **Repo structure — npm workspaces ✓** (Fix 39, 2026-04-15 evening): single root install, one hoisted `node_modules/` with symlinks to `hermes` and `argus-ui`. `landing/` is NOT a workspace and is gitignored for push to a separate repo.
- **Git status ✓** (Fix 43): repo pushed to [github.com/Nkaringa/ARGUS](https://github.com/Nkaringa/ARGUS) under the school account `Nkaringa <NageshKaringaGoud@my.unt.edu>` (repo-local override applied — global config still uses the personal `nageshkaringa@gmail.com`). Three branches: `main` (BMW baseline, initial commit), `ui-redesign-argus` (dark-lime dashboard experiment, Fix 42), **`hermes-agents-workflow-change`** (current working branch, all 2026-04-16 work landing here). `landing/` gitignored and lives in its own repo.
- **WORK_DIR / project-folder model ✓ NEW** (Fix 44, 2026-04-16): users now create a project subfolder (recommended `argus/Portfolio/`) or anywhere on disk. Build prompts in [build.js](../hermes/workflows/build.js) tightened to forbid edits outside cwd. `.env.example` updated with anti-footgun comment. Closes the friend's "landing page built into argus-ui" failure.
- **Role-docs auto-copy ✓ NEW** (Fix 45, 2026-04-16): [hermes/core/role-docs.js](../hermes/core/role-docs.js) auto-copies `.claude/`, `.gemini/`, `.codex/` from argus root → WORK_DIR on hermes boot if missing. Wired into build.js + warzone.js boot. Idempotent. Not wired into chat.js (chat uses CHAT_DIR with separate `ensureChatGeminiMd()`). Verified working on Nagesh's setup.
- **README split ✓ NEW** (Fix 46, 2026-04-16): [README.md](../README.md) (157 lines, concept) + [SETUP.md](../SETUP.md) (210 lines, install). Cross-refs updated in HERMES.md + argus-ui/README.md.
- **First friend E2E install attempt (2026-04-16, important learning event)** — Nagesh shared a friend's first-time install findings. Three real UX failures, all now fixed: (1) NATS install was buried in Prereqs, friend missed it → moved to numbered Install step 2 with cross-platform table. (2) Friend seeded session UUIDs from wrong directory → added prominent "where you seed from matters" callout in SETUP.md. (3) Friend set WORK_DIR to argus clone root, agents built into argus-ui → Fix 44 (project-folder model + tightened off-limits prompts) + Fix 45 (role-docs auto-copy for sibling layouts). Each finding produced a concrete code or doc change.

---

## Bugs found during E2E (2026-04-15) — history

### Bug A — Claude stdout flood between PLANNING and BUILDING (iteration 1, diagnosed but not root-caused)

**Symptom:** Nagesh watched the Build log view in Argus UI and saw "millions of words, every alphabet from a-z, all words possible" streamed *between* Claude finishing its plan and Gemini starting. Confirmed by Nagesh to be Claude's output, NOT Gemini's. After the flood ended, Gemini's build started normally.

**Evidence:** The dev server log (concurrently stdout) is clean — only orchestration lines. That means the flood was published to NATS `build.output` (bypassing console.log in `runAgent`), went directly through WS to the UI. Plan.md itself is only 11KB (reasonable). Build-Log.md iteration 1 reflects a normal landing-page overhaul. So the flood didn't come from Plan.md content itself — it came from Claude CLI stdout during or immediately after writing Plan.md.

**Suspects (unconfirmed):**
- Claude CLI in `-p` mode with `--allowedTools Edit Write Read Glob Grep` may stream tool-use traces (every Read/Grep/Glob result) to stdout. Task prompt "read the entire codebase" would have triggered many tool calls; each Read/Grep could dump file contents or match lists.
- No `--output-format json` or equivalent flag on the planner command — default output format may include verbose streaming.
- `runAgent` in [hermes/core/agents.js](hermes/core/agents.js) publishes every stdout data chunk as a single NATS message with no size cap — one multi-MB chunk becomes one flood message to the UI.

**Next step when investigating:** start Claude CLI manually with the same flags + a "read the entire codebase" style prompt, observe what actually goes to stdout. Decide whether to add an output-format flag, a size cap/truncate in `runAgent`, or a scope constraint in the planner prompt (e.g. "don't enumerate node_modules").

Per Nagesh 2026-04-15: don't touch code for this yet — park it until after Bug B is fixed.

### Bug B — XState v5 retry self-transition does NOT re-fire entry (iteration 2 audit froze) ✓ FIXED 2026-04-15

**Symptom:** Iteration 2 audit: Codex exited with code 2 in 88ms (DB evidence: `agent.started` id 124 at 04:53:01.944Z → `agent.failed` id 125 at 04:53:02.032Z, error "Codex exited with code 2"). State stuck in `auditing` with no Codex process running, no new `agent.started` event, no state transition. 12+ minutes frozen.

**Root cause:** XState v5 defaults targeted self-transitions to **internal** (no re-entry). The retry transitions in [hermes/workflows/build.js](hermes/workflows/build.js) for `planning`/`building`/`auditing` all omit `reenter: true`:

```js
AUDIT_FAILED: [
    { target: 'auditing', guard: 'canRetry', actions: 'incrementRetry' },  // ← needs reenter: true
    { target: 'paused' },
],
```

When `AUDIT_FAILED` fired, the machine went `auditing → auditing` (internal), `retryCount` incremented to 1, but `startAuditor` did NOT re-fire → no second Codex process. Machine now permanently waiting for a `GRADE_*` or `AUDIT_FAILED` event that will never arrive. Only escape is Abort.

**Why this wasn't caught earlier:** All prior E2E tasks graded A on first audit, so retry paths in `planning`/`building`/`auditing` were never actually exercised. The Fix 23 memory note ("Entry actions fire on every state entry including self-transitions") was wrong — that's v4 behavior; v5 reversed the default.

**Fix (when approved):** add `reenter: true` to all three retry self-transitions in build.js (planning, building, auditing). Inspect warzone.js for the same pattern — although warzone doesn't have retry transitions today, verify no other targeted-self transitions exist without `reenter`.

**Explanation walked through 2026-04-15 evening** — Nagesh asked for a full explanation before approving the fix. Explanation given covered: v4→v5 semantic reversal, what happens step-by-step when AUDIT_FAILED fires (internal transition, retryCount increments, no entry re-fire, no second Codex spawn, indefinite wait), why this wasn't caught before (all prior E2Es graded A on first try), and the 3-line fix.

**Applied 2026-04-15 evening.** Added `reenter: true` to all three retry self-transitions in [hermes/workflows/build.js:90,103,115](../../../../../Desktop/Karinga.dev/NK-Base/hermes/workflows/build.js) (PLAN_FAILED, BUILD_FAILED, AUDIT_FAILED). Grepped warzone.js — no FAILED retry transitions there, no change needed. **LIVE-VERIFIED 2026-04-15 afternoon** during the landing-page E2E: BUILD_FAILED retry fired twice (iteration 1 → iteration 2 → iteration 3) via the `awaiting_approval → building` transition path (grade B → approve → back to building with `iterationCount++`), confirming `reenter: true` correctly re-fires `launchBuilder`. First production exercise of a non-A grade retry loop since three-agent refactor.

### Bug C — Codex exit code 2 on resume (iteration 2) — FIXED ✓ 2026-04-15

**Actual root cause (diagnosed by running the failing command manually):** `codex exec resume` does **not** accept the `-C <dir>` flag. Only the top-level `codex exec` (new) accepts it. Passing `-C {WORK_DIR}` to the resume variant → argument-parsing error → exit code 2 in ~88ms. Verified against `codex exec resume --help` on codex-cli 0.114.0:

```
error: unexpected argument '-C' found
  tip: to pass '-C' as a value, use '-- -C'
Usage: codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]
```

The `-C` flag was there because Nagesh (and earlier Claude) assumed the flag worked on both subcommands. It doesn't. `codex exec resume --help` output lists available options and `-C` / `--cd` is NOT among them. Compare with `codex exec --help` which has `-C, --cd <DIR>`.

**Fix:** removed `-C {WORK_DIR}` from the resume forms in [hermes/core/agents.json](../hermes/core/agents.json). WORK_DIR is still honored because `spawn` in `runAgent` sets `cwd: cwd || WORK_DIR`, so the child process runs in the right directory anyway. No other code change required for this specific bug.

**Second latent issue discovered during diagnosis (also fixed):** the old `resumeCommand` substituted `{CODEX_SESSION_ID}` from `.env` — a static, manually-seeded value that never gets updated at runtime. When iteration 1 ran fresh `codex exec` (new session), it created a new session UUID but hermes never captured it. Iteration 2's resume therefore targeted the stale env UUID (often days old, from a completely different context) rather than the session iteration 1 actually created. After the `-C` fix, this would have been the next failure mode. Resolved by the session-unification architecture (see Session Management Convention below) — all three bots now always resume the manually-seeded env UUID, so "resume" and "fresh" collapse into one consistent call shape.

**Things tried but rejected:**
- **Runtime UUID capture from Codex stdout.** Implemented: regex-match `session id: <UUID>` from the Codex exec header, store per-agent-key in a `capturedSessions` map, substitute into resume commands. Worked in a smoke test. Reverted because (a) Nagesh pointed out the asymmetry — Claude uses manual env-seeded UUIDs, so Codex should too, and (b) runtime capture is fragile: any change to Codex's stdout header format breaks it silently.
- **`codex exec resume --last`.** Shorter to write but cross-contaminates concurrent flows: build pipeline's `codex_auditor`, warzone's `discuss_codex`, and chat codex all filter by cwd and all would resume whichever Codex ran most recently. Classic `--last` bandaid, same problem Gemini's `--resume latest` had. Rejected for the same reason.

### Bug C2 — Gemini `--resume latest` bandaid — FIXED ✓ 2026-04-15

Discovered while unifying session mechanisms. Old Gemini config:
- `builder.command`: `gemini -p "{task}" -y` (fresh session, no resume)
- `builder.resumeCommand`: `gemini --resume latest -p "{task}" -y` (resume most-recently-touched session in cwd)

Same `--last`-style cross-contamination risk as the rejected Codex `--last` approach: build's `builder` and warzone's `discuss_builder` could resume each other's sessions if they ran close in time. Hadn't caused a visible bug because flows rarely overlapped in practice, but the architectural smell was real.

**Nagesh verified** that `gemini --resume <UUID> -p "..." -y` works headlessly and preserves context. Fix: replaced both Gemini templates with `gemini --resume {GEMINI_SESSION_ID} -p "{task}" -y`. Added `{GEMINI_SESSION_ID}` substitution in agents.js. User must seed `GEMINI_SESSION_ID` in `hermes/.env` the same way they seed Claude/Codex.

### Bug D — State machine stuck state not surfaced to UI or user

**Symptom:** Nagesh reported "UI still showing auditing, but Gemini already built iteration 2 and is waiting." The UI is technically correct — the state machine IS in `auditing` — but there's no hint that it's actually frozen (no process running, no timer, no visible error). Only the dev log shows `Audit failed: Codex exited with code 2`.

**Relationship to Bug B:** Bug D is the UX consequence of Bug B. Once Bug B is fixed (entry re-fires on retry), a real failure would progress `auditing → auditing → paused` and the UI would show `paused` state. With Bug B now live-verified (see §Bug B), any real Codex failure will now surface as `paused` — Bug D is effectively no longer a separate concern unless we decide `agent.failed` should surface as a WS toast (UX polish, deferred until asked).

### Bug E — plan.completed edge-trigger stuck planning state (FIXED ✓ 2026-04-15 afternoon)

**Symptom:** Nagesh submitted a task ("redesign landing page using BMW design"). Claude planned successfully — Plan.md written, ended with `**Plan Status:** READY`, Claude's stdout said "Plan.md written and ready". But state never advanced from `planning` → `building`. Happened twice — first time with Plan.md leftover from yesterday's BMW redesign work; second time after Nagesh manually deleted Plan.md, rotated session IDs, and restarted.

**Root cause (first freeze — latent design flaw):** [hermes/core/watcher.js](../hermes/core/watcher.js) used a `lastPlanMatched` boolean to edge-trigger the `plan.completed` event only on false→true transitions of the READY pattern. The seeding logic at server startup read Plan.md from disk and set `lastPlanMatched = PLAN_STATUS_PATTERN.test(lastPlanContent)`. If Plan.md leftover from a prior task already ended in READY, `lastPlanMatched` seeded to `true` → next task's Claude overwrite still matched the pattern → `matchesNow && !lastPlanMatched` = `true && !true` = false → no fire → stuck. The edge-trigger was defensive code against double-firing on a single write, but chokidar's `awaitWriteFinish` already guarantees one event per write, so the boolean was both unnecessary and actively broken.

**Root cause (second freeze — hypothesis, not root-caused):** After Nagesh deleted Plan.md and restarted, `lastPlanMatched` seeded to `false` by default, and the bug as described above shouldn't have triggered. Second freeze likely a separate chokidar/macOS-fsevents edge case with `add` events on non-existent-at-startup paths under `awaitWriteFinish`. The permanent fix addresses this case implicitly by guaranteeing the file is always absent at task start (see below).

**Permanent fix (Fix 36 above, not a band-aid):** two structural changes that together make the class of bug impossible:

1. **Watcher becomes stateless across task boundaries.** Removed `lastPlanMatched` entirely (declaration, seeding, update). Signal is now: `if (content changed && pattern matches) → fire`. No cross-task memory, no stale boolean to corrupt.

2. **`submitTask` deletes Plan.md before spawning the planner.** `fs.unlinkSync(PLAN_FILE)` in a try/catch inside [hermes/workflows/build.js:submitTask](../hermes/workflows/build.js). Every task starts with Plan.md guaranteed absent — Claude's Write tool always creates fresh (chokidar fires `add`, not `change`), "overwrite, don't append" is enforced by the filesystem rather than prompt discipline, and the watcher's content-change check has unambiguous input.

**Why Nagesh insisted on "permanent not band-aid":** first proposal was only part (1). He pushed back: "it worked first, why is it broken now?" — meaning: if prior E2Es worked, what changed? The honest answer was that the bug was latent (only triggers when Plan.md pre-exists with READY at startup), and past successful runs just happened to start with a clean slate. Permanent fix eliminates the asymmetry by removing both the stale-state coupling AND the possibility of pre-existing Plan.md — now the bug cannot recur regardless of what's on disk when the server starts.

**Discussion learnings (2026-04-15 afternoon):**
- Plan.md being "overwritten per task" sounds clean in prose but in practice Claude's Write tool may interpret "overwrite" variably (read-then-write, merge, append, etc.). Deleting the file makes "overwrite" structurally the only option Claude can take.
- "check first" rule from feedback_style.md kicked in — Nagesh caught the partial fix and asked for the full root-cause explanation before applying. Walking through WHY the fix was permanent (not just WHAT it was) was load-bearing for his go-ahead.

### Bug F — Gemini chat exits with code 42 on every message (OPEN, surfaced 2026-04-15 evening while testing Fix 42 dark-lime dashboard)

**Symptom:** Nagesh sent `hello` to Gemini in the chat tab. `[error] Gemini exited with code 42`. Sent `list the contents in landing folder` as a follow-up. Same error. Exit 42 is not a standard Unix code — it's Gemini CLI's own "fatal error" signal. The concurrent Claude chat call worked fine, so it's Gemini-specific. Build-pipeline Claude planner also worked fine on a separate `hello` task in the same session, so the Gemini problem didn't bleed into the build flow.

**Observation about prompt shape** (partially investigated, not concluded): [hermes/servers/chat.js:82-89](../hermes/servers/chat.js) builds Gemini's prompt by concatenating the last 10 messages of conversation history before the new user prompt. Format is `Human: ...\nAssistant: ...\n\nHuman: <new message>`. The SECOND Gemini call's prompt included the prior error line, shaped like: `Human: hello / Assistant: [error] Gemini exited with code 42 / Human: list the contents in landing folder`. That's a weird prompt to pass to any LLM CLI but shouldn't itself cause exit 42. More likely the FIRST call (just `hello`) already failed — so the question is what's breaking Gemini on even a minimal prompt through our invocation.

**LEADING HYPOTHESIS (sharpened 2026-04-16): cwd / session-store mismatch.**

[hermes/servers/chat.js:93](../hermes/servers/chat.js#L93) routes Gemini chat with a different cwd from build/warzone:

```js
const agentCwd = agent === 'builder' ? CHAT_DIR : process.env.WORK_DIR;
```

So Gemini chat spawns with `cwd = CHAT_DIR` (default `/tmp/argus-chat`), while Claude chat and Codex chat spawn with `cwd = WORK_DIR`. `CHAT_DIR` exists for a real reason — see "CHAT_DIR explained" below — but it creates a session-storage asymmetry.

The user seeds `GEMINI_SESSION_ID` from `WORK_DIR` per SETUP.md instructions (`cd $WORK_DIR && gemini` → /exit → copy UUID). Gemini CLI scopes session storage to cwd. So:
- Session was created relative to `WORK_DIR`
- Hermes resumes it from `CHAT_DIR`
- Gemini does `--resume <UUID>` looking for the session file relative to `CHAT_DIR`, can't find it, exits with its "fatal" code 42

**Cross-check evidence (2026-04-16 testing session):**
| Agent | cwd at chat spawn | Where seeded (per SETUP.md) | Match? | Result |
|---|---|---|---|---|
| Codex chat | `WORK_DIR` | `WORK_DIR` | ✓ | works ✓ (verified `session id: 019d9203...`, model gpt-5.4 responded "Hello.") |
| Claude chat | `WORK_DIR` | `WORK_DIR` | ✓ | blocked by billing today, but no session error — different failure mode |
| **Gemini chat** | **`CHAT_DIR`** | **`WORK_DIR`** | **✗** | **exit 42** (third independent observation) |

Gemini is the only one whose spawn cwd doesn't match the seed location → only one with this failure mode. Lines up perfectly with the friend's earlier "agents couldn't find conversation data" issue (same root cause: cwd-scoped session storage + seeded-from-different-cwd).

**Quick test to confirm (not yet run):** `cd /tmp/argus-chat && gemini` → send any message → /exit → copy UUID → paste over `GEMINI_SESSION_ID` in `hermes/.env` → restart hermes → try Gemini chat. If it works = hypothesis confirmed.

**Permanent fix options once confirmed:**
1. **Two Gemini env vars** — `GEMINI_SESSION_ID` (build, seeded from WORK_DIR) + `GEMINI_CHAT_SESSION_ID` (chat, seeded from CHAT_DIR). Honest, explicit, requires SETUP.md update.
2. **Hermes copies the Gemini session data file from WORK_DIR's store to CHAT_DIR's store on boot** — same pattern as Fix 45 role-doc auto-copy. Invisible to user. Requires knowing Gemini's session storage location on disk (probably `~/.gemini/sessions/` or similar, OS-specific).
3. **Run chat-Gemini from WORK_DIR** instead of CHAT_DIR — restores the session match BUT brings back the original problem CHAT_DIR was solving (chat-Gemini reading the build-pipeline `.gemini/GEMINI.md` and writing to Build-Log.md after every chat message). Would need to also override Gemini's role doc inline in the chat prompt.

Option 1 is the cleanest first cut. Option 2 is invisible but requires reverse-engineering Gemini's session storage path. Option 3 is the riskiest — undoes a deliberate isolation.

**Note on branch context:** Bug F was surfaced on the `ui-redesign-argus` branch during dark-lime dashboard testing. The bug is not related to the UI redesign — it's a backend (hermes/chat) issue — so it reproduces on `main` too. Fixing on `hermes-agents-workflow-change` is appropriate.

### CHAT_DIR explained (referenced from Bug F above)

`CHAT_DIR` (default `/tmp/argus-chat`, configurable via `hermes/.env`) is a separate working directory used ONLY when Gemini is spawned for chat — never for build or warzone, never for Claude or Codex. Auto-created on hermes boot by [chat.js:ensureChatGeminiMd()](../hermes/servers/chat.js) which does `fs.mkdirSync(CHAT_DIR/.gemini, { recursive: true })` then writes a chat-specific `.gemini/GEMINI.md` (always overwrites — keeps it in sync with chat.js). The chat-mode GEMINI.md tells Gemini "you're in direct chat mode, do NOT write to Plan.md / Build-Log.md / Build-Feedback.md / WarZone.md."

**Why CHAT_DIR exists:** without it, chat-Gemini would read the build-pipeline `WORK_DIR/.gemini/GEMINI.md` (which says "always append a `### Iteration` entry to Build-Log.md when you finish") and pollute Build-Log.md with chat noise on every chat message. CHAT_DIR isolates chat-Gemini's instructions from the build-pipeline ones. Claude and Codex don't need this — their role docs describe roles but don't have standing "always write to file X" directives, so chat-mode invocation doesn't auto-trigger file writes.

**For new users:** zero setup. Hermes creates CHAT_DIR on first boot, writes the chat-mode GEMINI.md, prints `[chat] Wrote project context to /tmp/argus-chat/.gemini/GEMINI.md`. User never touches `/tmp/argus-chat/` manually. Linux/macOS only — Windows has no `/tmp`, but Windows is already documented as needing WSL.

### Fix order discussion — last updated 2026-04-16 morning

- **Bug A — parked.** Claude stdout flood during "read the entire codebase" prompts. Deferred by Nagesh. Didn't recur during the afternoon E2E (task prompt was scoped to landing folder, not entire codebase), so we may never need to fix. Revisit if it reappears.
- **Bug B — FIXED ✓ + LIVE-VERIFIED ✓** during the 2026-04-15 landing-page E2E. `reenter: true` worked correctly across two consecutive retry cycles.
- **Bug C — FIXED ✓** (`-C` flag removed from resume; session mechanism unified). Verified via chat after hermes restart.
- **Bug D — effectively resolved** via Bug B fix. `paused` state now surfaces naturally on real failures. Toast-for-agent.failed deferred until asked.
- **Bug E — FIXED ✓ + LIVE-VERIFIED ✓** 2026-04-15 afternoon. Plan.md fix shipped, full 3-iteration E2E succeeded immediately after.
- **Bug F — OPEN.** Gemini chat exits 42. Currently the biggest live blocker since Gemini chat is nonfunctional. Likely picking this up on the `hermes-agents-workflow-change` branch.

## 2026-04-15 restore incident

Nagesh accidentally deleted most of `hermes/` (only `HERMES.md` and `HERMES-workflow.excalidraw` survived), recovered the files from Trash into a `backup/` folder at repo root, and asked Claude to place them back. All 17 hermes/ files restored successfully — byte-identical, 148 npm packages intact, all JS passes `node --check`, both JSON files valid, `.env` has all 7 required keys. `backup/` folder and three root-level timestamped duplicates (`README.md 00-07-11-566.md`, `package.json 00-07-15-583.json`, `package-lock.json 00-07-16-125.json`) deleted after byte-diff verification against canonical copies. Nagesh then manually deleted leftover root `HERMES.md` (duplicate of `hermes/HERMES.md`) and empty `Test/` folder to get 100% spec match. See feedback_verify_before_delete.md for the pattern.

## Claude Chat Timeout — Decision: Defer

Observed: first chat turn hit the 120s timeout; second turn (narrower) returned in time. Root cause is that `runAgent` in [hermes/core/agents.js](hermes/core/agents.js) buffers stdout until process exit — synchronous model on an inherently streaming workload. The 120s cap is the symptom, not the bug.

**Permanent fix is streaming** (`claude --output-format stream-json`, per-chunk WS broadcast, no-output heartbeat kill). Raising the timeout is a band-aid.

**Decision (2026-04-14):** defer. Build pipeline is unaffected. Chat/discuss is a secondary path today — occasional "no response, retype narrower" is survivable. Revisit when chat or warzone becomes the primary interface. Not a correctness bug, just a UX paper cut.

Prerequisite for warzone liveness (watching agents talk back-and-forth in real time) — so streaming and that UX upgrade will land together.

---

## UI Redesign — BMW-applied (2026-04-15 evening, APPLIED ✓)

**Nagesh's directive:** "change our Product completely while following the bmw desing" — apply BMW CI2020's design system **literally** (not "inspired by") to the Argus dashboard. Plus: add a Reset Sessions button. Greenlit and shipped 2026-04-15 evening.

**Source of truth:** [Design.md](../Design.md) is the BMW spec Nagesh supplied. [Argus-Design.md](../Argus-Design.md) translates it component-by-component to Argus — that doc is the contract the implementation follows.

**The identity shift:**

| | Current Argus | New Argus (BMW) |
|---|---|---|
| Primary surface | `#0d0d0f` dark | `#ffffff` pure white |
| Accent | Violet `#a855f7` | BMW Blue `#1c69d4` |
| Font stack | Inter / SF / system | `'BMWTypeNextLatin', 'Helvetica', 'Arial', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Meiryo'` — degrades to Helvetica on most machines (we don't license BMWTypeNextLatin) |
| Weight palette | 400, 500, 600, 700 | 300, 400, 700, 900 — extremes only (no 500/600) |
| Border-radius | `rounded-lg` / `xl` / `2xl` / `full` | `0` everywhere, no exceptions |
| Icons on nav | Hammer, Swords, History, ChevronRight, Square, Send, RotateCcw, SkipForward, CheckCircle2, XCircle | All removed — type-only nav |
| Grade colors | Emerald (A) / amber (B) / orange (C) / red (F) | BMW Blue for A, Near Black weight 700 for B/C/F — no semantic palette |
| Log output | Dark card with `rounded-xl`, mono `text-xs` | Full-bleed `#262626` strip, Helvetica 14px (no mono — BMW rejects mono, so do we) |
| View titles | "Build" 16px semibold | "BUILD" Helvetica Light 300 uppercase 60px letter-spacing 2px |
| Animations | `animate-bounce`, ring pulses, hover transitions | 150ms color transitions only — no bounce, no fade, no spin |

**Dark strips (where `#262626` survives):** sidebar, log output panel, Warzone discussion panel, code blocks inside chat messages. These are Argus's equivalent of BMW's "dark automotive photography" hero rhythm.

**Reset Sessions button — part of the same PR:**
- Sidebar button above Stop, Helvetica 400 14px uppercase letter-spacing 2px, color Silver, bottom-border hairline
- Opens modal: white 640px panel, zero radius, no shadow, no backdrop blur
- Content is **pure documentation** — three code blocks showing the `.env` rotation commands for Claude / Gemini / Codex, followed by `npm run dev`. No fetch, no backend call, no state touched. Matches the 2026-04-15 session-unification architecture where rotation is a manual `.env` edit.
- Escape / backdrop click / "CLOSE" button all close the modal.

**Files changed (all listed in Argus-Design.md §9):**
- Rewrote: [index.css](../argus-ui/src/index.css), [Sidebar.tsx](../argus-ui/src/components/Layout/Sidebar.tsx), [BuildView/index.tsx](../argus-ui/src/components/BuildView/index.tsx), [ChatView/index.tsx](../argus-ui/src/components/ChatView/index.tsx), [WarzoneView/index.tsx](../argus-ui/src/components/WarzoneView/index.tsx), [LogsView/index.tsx](../argus-ui/src/components/LogsView/index.tsx), [App.tsx](../argus-ui/src/App.tsx) (dropped `bg-[#0d0d0f]` + `agentColor` bubble props)
- New: [ResetSessionsModal.tsx](../argus-ui/src/components/Layout/ResetSessionsModal.tsx) — documentation-only modal, zero backend calls
- Deleted: `argus-ui/src/App.css` (unused Vite template; no imports existed, grep confirmed)

**Implementation notes:**
- BuildView replaces the old violet ProgressDots with a BMW-style segmented ProgressStrip (1px line under pending segments, 2px BMW Blue under active/done).
- Sidebar uses inline `style={}` for the letter-spacing / font-weight values (Tailwind v4's arbitrary utility syntax for these didn't match the design tokens cleanly).
- Grade letter on approval card renders as 60px Helvetica Light — BMW's "hero display" scale — in BMW Blue for A, Near Black for B/C/F.
- Log output panel is the only dark strip in BuildView — full-bleed `#262626`, no border, Helvetica 14px not mono.
- Chat messages: no bubbles. Each block is `padding: 24px 0; border-bottom: 1px solid #bbbbbb`. Author label Helvetica 900 uppercase 14px. "YOU" is rendered Meta Gray to distinguish from agent name without using color semantically.
- Focus state on inputs: bottom-border shifts from 1px `#262626` to 2px `#1c69d4` on focus (inline `onFocus`/`onBlur` handlers).
- Reset Sessions modal: Escape listener attached via `useEffect` only while open; backdrop click closes; modal body click is `stopPropagation`.

**Verification:** `npm run build` produced `dist/index-*.css` (9.55 kB gzip 2.86 kB) and `index-*.js` (221 kB gzip 66 kB) clean. `npm run lint` passed with no output.

**Checkpoint questions — ALL GREENLIT IMPLICITLY** by "okay lets start the redesign useing the argus-redisgn file". Implementation followed Argus-Design.md literally: BMW Blue + white + Helvetica committed ✓, all Lucide nav icons stripped ✓, grade semantic colors dropped ✓, logs render in Helvetica ✓.

**Both resolved 2026-04-15 afternoon:**
- Visual verification ✓ — screenshot shared during the landing-page E2E confirmed white canvas, BMW Blue accents, segmented progress strip, dark log panel, type-only nav, grade hero, Reset Sessions button all rendering as specified.
- Live E2E + Bug B retry path ✓ — landing-page task ran 3 iterations (B→B→A), exercising the retry path twice. `GEMINI_SESSION_ID` was seeded before this run.

---

## Landing Site — Next.js 16 rebuild (2026-04-15 afternoon, BUILT ✓)

**Why:** the three-agent pipeline's output landing page (BMW-literal, static HTML/CSS/JS) was fine as pipeline validation but not suitable as the product's public face. Nagesh wanted a proper product surface, not an internal demo artifact. Explicit decision to diverge visually from the Argus dashboard — landing is the marketing voice, dashboard is the tool.

**Stack:** Next.js 16.2.3 App Router + TypeScript + Tailwind 4 + Geist Sans/Mono via `next/font/google`. Static export via `output: 'export'` in [next.config.ts](../landing/next.config.ts). Deploys to any static host. React 19.2.4.

**Design language (terminal-native — NOT BMW):**
- Canvas `#0a0a0a` (near-black, warmer than pure black)
- Single accent `#b6ff3c` (lime chartreuse) — used for interactive elements, active state, agent prefixes in the pipeline replay, and the blinking cursor. Never as background wash or gradient.
- Surface ramp: ink-0 `#0a0a0a` / ink-1 `#111` / ink-2 `#1a1a1a` / ink-3 `#2a2a2a` (hairline dividers)
- Text ramp: fg-0 `#ededed` / fg-1 `#a0a0a0` / fg-2 `#5a5a5a`
- Fonts: Geist Sans for display and body, Geist Mono for terminal content / code / agent labels. Weight palette 400/500/600 only — no 300/700/900 (landing chose gentler palette than dashboard).
- Zero border-radius (kept this BMW principle — it's anti-slop regardless of palette).
- Explicit anti-slop constraints: no glassmorphism, no purple dark mode, no generic feature cards, no gradient-on-dark, no hover bounces, no decorative-only animation.

**Information architecture — tight 5-section flow:**
1. Hero ([Hero.tsx](../landing/src/components/Hero.tsx)) — eyebrow + three-line headline ending in accent "Zero babysitting." + subhead + dual CTA + PipelineReplay
2. How It Works ([HowItWorks.tsx](../landing/src/components/HowItWorks.tsx)) — three `AgentCard`s (Plan/Build/Audit) with `[ plan ]` `[ build ]` `[ audit ]` mono tags in accent
3. See It In Action ([SeeItInAction.tsx](../landing/src/components/SeeItInAction.tsx)) — left: pub/sub narrative + mono metadata grid (engine/agents/topics/signals); right: `architecture.webp`; below: collapsed `<details>` expands to show a real Plan.md excerpt in a terminal frame
4. Roadmap ([Roadmap.tsx](../landing/src/components/Roadmap.tsx)) — 5 milestones with SHIPPED (accent) / ACTIVE (white) / NEXT (dim) status chips
5. Footer ([Footer.tsx](../landing/src/components/Footer.tsx)) — three columns, `hello@karinga.dev`, © year

Plus a minimal `/analytics` "Coming Soon" splash ([analytics/page.tsx](../landing/src/app/analytics/page.tsx)). No email capture, no mockups, no signup — Nagesh chose minimal.

**PipelineReplay hero centerpiece** ([PipelineReplay.tsx](../landing/src/components/PipelineReplay.tsx) + [pipelineScript.ts](../landing/src/lib/pipelineScript.ts)):
- Scripted terminal, single `useEffect` + `setTimeout` chain, no animation library
- Prompt typed char-by-char at 45ms/char (`$ argus build` → `> redesign landing page as next.js`)
- Then streams 11 log lines: planning → plan.md ready → building iter 1 → audit grade B → building iter 2 → audit grade B → building iter 3 → audit grade A, COMPLETE → hero grade letter `A` in accent
- Total loop ~10s, holds 3.2s, restarts
- Mimics the real B→B→A trajectory from the morning's landing-page E2E — the actual pipeline behavior
- `prefers-reduced-motion: reduce` → renders the final frame statically, no loop

**Files created** (under [landing/src/](../landing/src/)):
- `app/layout.tsx` — root, Geist fonts, full OG + Twitter metadata
- `app/page.tsx` — assembles all 5 sections
- `app/analytics/page.tsx` — coming-soon splash
- `app/globals.css` — Tailwind 4 `@theme` tokens, base reset, cursor-blink keyframes, reveal class
- `components/{Nav,Hero,HowItWorks,AgentCard,SeeItInAction,Roadmap,Footer,PipelineReplay}.tsx`
- `components/ui/{Eyebrow,Cursor,TerminalFrame}.tsx`
- `lib/pipelineScript.ts` — typed data for PipelineReplay
- `lib/useInView.ts` — IntersectionObserver wrapper for scroll reveal (built but not wired into sections yet; sections use static padding instead — revisit if we want reveal animations)

**Assets** (under [landing/public/](../landing/public/)):
- `architecture.webp` (57 KB, resized from the 332 KB PNG the pipeline reused)
- `workflow.webp` (120 KB, available but not currently rendered in any section)
- `favicon.svg` — "A" mark in accent on ink-0
- `og-image.png` (41 KB, 1200×630, generated from inline SVG via sharp-cli)

**Build verification:**
- `npm run build`: compiles in ~2s, TypeScript clean, 4 routes static (`/`, `/_not-found`, `/analytics`), `out/` directory 1.4 MB total, largest chunk 222 KB
- `npm run dev`: verified 200 OK on `/` and `/analytics/` via curl
- Known config: `turbopack.root` set to landing/ to silence the multi-lockfile warning (NK-Base root has its own lockfile from concurrently)

**Content provenance** — all product copy was ported verbatim from the pipeline-built static page that preceded this: value-prop tagline, three-phase descriptions, roadmap items, contact email (`hello@karinga.dev`), tagline "Built by agents, for agents." The pipeline's page was deleted once its content was captured.

**Pending:**
- Visual review by Nagesh in a browser — terminal replay timing, section spacing, overall feel
- Any copy tweaks after reading with fresh eyes
- Eventually wire `useInView` into reveal animations if we decide the current static presentation is too flat
- Favicon.ico fallback (some browsers prefer .ico over .svg — low priority)
- OG image rendering — tested build, no visual confirmation of what the card actually looks like when crawled

**Out of scope (explicit):**
- Backend integration of live hermes WebSocket into the hero terminal (would require public hermes hosting)
- No Plausible/GA/PostHog analytics integration yet
- No signup/waitlist form (analytics page is a promise, not a funnel)
- Docs link in footer goes to `#` placeholder

---

## Distribution / Install UX — deferred decisions (2026-04-15)

**Target pattern:** `npm create argus@latest` — same family as `npm create vite`, `npm create next-app`, `npm create t3-app`. Chosen over `git clone`, `curl | bash`, Docker, or Homebrew as the primary install path when we eventually publish.

**What would need to be built:**
1. A separate `create-argus` npm package (name is load-bearing — the `create-*` prefix is what makes `npm create argus` work). Tiny CLI that prompts for target folder name, fetches a tarball of the current NK-Base layout from GitHub via `degit` (or similar), runs `npm install` in each workspace, prints next-steps.
2. A new `npm run seed-sessions` script inside Argus itself that programmatically walks the user through seeding the three UUIDs (parsing the "resume hint" line from each CLI's stdout) instead of the current manual `claude` → `/exit` → copy → paste flow.

**Irreducible constraint:** users must have their own Claude / Gemini / Codex subscriptions and install those three CLIs separately. We can detect-and-instruct but never bundle — not ours to redistribute, separate auth per provider.

**Trade-off table (for future reference):**
- `npm create argus` — clean product UX, cross-platform, familiar pattern. Cost: build + publish `create-argus`, one-time npm org setup.
- `git clone` only — works today, zero work. Cost: signals "dev tool" not "product".
- `curl | bash` — one-liner. Cost: auditability concerns, fragile, macOS/Linux only.
- Docker — bundles NATS. Cost: user still needs agent CLIs outside container; awkward hybrid.
- Homebrew — native install on macOS/Linux. Cost: own-tap infra, Windows excluded.

**Status:** not building yet. Nagesh explicitly said "we will do it later." Shape of work captured here so the first conversation picking it up has full context.

---

## Telemetry / hermes.db — current state (2026-04-15 afternoon inspection)

**Tables:**
- `events` (append-only NATS log): `id | ts | topic | payload(JSON)`
- `tasks` (lifecycle per build submit): `id | created_at | completed_at | description | iterations | final_grade | status`

**Event topics currently emitted:** `agent.started` (per planner/builder/auditor spawn), `agent.failed`, `grade.received`, `task.submitted`, `task.done`, `task.aborted`, `discuss.started`, `discuss.submitted`, `discuss.failed`.

**Event counts (live DB, ~19 tasks of history, 52KB total):** agent.started 64 · grade.received 25 · task.submitted 19 · task.done 13 · discuss.started 12 · agent.failed 10 · discuss.submitted 10 · task.aborted 4.

**Tasks state distribution:** 19 total · 6 DONE · 4 CANCELLED · **5 stuck in RUNNING** (stale orphans from Bug B/Bug E freezes before those were fixed). No cleanup hook on server restart — `getHistory()` returns them as if still active. Minor data-quality issue; consider adding a boot-time sweep that marks any still-RUNNING tasks as STALE.

**Not emitted (gaps):** no `agent.completed` event → can't compute per-agent call duration from DB alone. No token counts. No stdout/stderr byte counts. No process memory or cost estimates.

**Derivable metrics we could surface in the "Agents Analytics" page:** grade distribution over time, avg iterations to grade A (quality-of-Claude's-plans signal), agent failure rate per role (`agent.failed / agent.started` grouped by role), time-to-done per task (`completed_at - created_at`), tasks-per-day.

**Blockers for real telemetry:** none structurally, but to get meaningful latency/cost metrics we'd need to add an `agent.completed` event with `{role, durationMs, stdoutBytes}` emitted from [runAgent()](../hermes/core/agents.js). That's the minimum surface for the Analytics page to be useful beyond "how many tasks did I run."

**Status:** not building analytics yet. Nagesh explicitly said "lets work on telemetry later" when this came up.

---

## Open questions (pending Nagesh's decision)

### Build-Log.md / Build-Feedback.md retention across tasks

**The observation (2026-04-15 evening):** `Plan.md` gets wiped before each new `submitTask` (Fix 36). `Build-Log.md` and `Build-Feedback.md` do NOT — they are append-only across task boundaries. If the first task was "build a web page" (2 iterations) and the second task is "build a login page" (1 iteration), Build-Log.md ends up containing `### Iteration 1 — Web Page`, `### Iteration 2 — Web Page`, `### Iteration 3 — Login Page` all in one file, with no task headers separating them. Same for Build-Feedback.md.

**Is this broken?** No, functionally it works. Codex reads "the latest iteration" which is always correctly the most-recent append. Hermes's `iterationCount` resets per task internally. `hermes.db` `tasks` table has proper task-level separation for analytics. The mess is purely human-readability of the two .md files.

**Two options presented to Nagesh (not yet chosen):**
- **Option A (recommended):** mirror Plan.md — `fs.unlinkSync(BUILD_LOG_FILE)` + `fs.unlinkSync(BUILD_FEEDBACK_FILE)` in `submitTask`. Every task gets a fresh pair. Loses per-file history (but `hermes.db` retains it). Minimal code change.
- **Option B:** keep history but prepend `## Task: <description>` header in `submitTask`. Files become navigable running logs, not junk drawers. More code, agent prompts need a small update to "find latest iteration under the current task header."

**Status:** pending Nagesh's decision. Don't apply either until he picks. Note that [.gemini/GEMINI.md:51](../.gemini/GEMINI.md) currently says *"Check the last entry in Build-Log.md for the current number and increment by 1"* — so Gemini's file-level iteration number keeps climbing across tasks (task 1 had iterations 1-3 → task 2 starts at iteration 4 in the file, but hermes's state-machine counter starts at 1). Both options resolve this divergence.

---

## Deferred product ideas

### Portfolio Builder sub-product (parked 2026-04-15)

**Nagesh's pitch:** a sub-product built on top of Argus — user uploads resume (parse for info) + structured inputs (projects, case studies, links) + a provided Design.md they can edit → click "Build Portfolio" → Argus three-agent pipeline generates a localhost-viewable Next.js portfolio. **We do NOT host or deploy** — the output is files the user runs locally and deploys themselves. That scoping line was explicit from Nagesh; removes the entire hosting/domains/SSL/ops scope.

**My critical feedback given:** portfolios are a crowded category (Framer/Super/Cargo), Design.md editing assumes dev-brain users, three-agent pipeline is overkill for template-heavy task (one agent would do), resume parsing is a rabbit hole, non-determinism is a UX bug in this category. Suggested reshapes: (a) make it Argus's single "try it" demo on the landing page instead of a separate product, (b) if product, narrow to dev portfolios only, (c) ship presets not Design.md editing by default.

**Decision (2026-04-15):** parked. Argus itself is v0.3 and needs hardening before a sub-product. Nagesh agreed: "lets first finish argus ... lets put the sub-product aside for now." Revisit after Argus is polished (distribution live, analytics surfacing real numbers, warzone exercised E2E).

**When revisiting, don't re-raise:** (i) the hosting/deploy problem — Nagesh scoped it out, we only build to localhost; (ii) whether to do it at all — decision is yes-eventually, just not now. Do re-raise: demo-surface vs standalone-product, three-agent overkill, Design.md vs presets.

---

## Three-Agent Refactor — COMPLETE + E2E VERIFIED ✓ (2026-04-14 → 2026-04-15)

**Backend + frontend + role docs + file cleanup + doc rewrite done 2026-04-14. First successful end-to-end run 2026-04-15 afternoon (landing-page BMW task, 3 iterations, B→B→A). See "Current Status" bullet at top for the E2E details.**

### Final state
- **Backend**: 7 files edited (agents.json, agents.js, watcher.js, build.js, warzone.js, chat.js, .env) — internally consistent.
- **Frontend**: 6 files edited (types/index.ts, useChatSocket.ts, App.tsx, Sidebar.tsx, BuildView/index.tsx, WarzoneView/index.tsx). `npm run build` + `npm run lint` both pass clean. Types extended: `AgentKey` now `'builder' | 'planner' | 'codex_auditor'`, `Section` includes `'chat-codex'`, `BuildState` includes `'planning'`, `WarzoneState` has `'discussing_claude' | 'discussing_gemini' | 'discussing_codex' | 'awaiting_discuss_approval'`. Progress bars: Build 5 steps (Plan→Build→Audit→Review→Done), Warzone 4 steps (Claude→Gemini→Codex→Review).
- **Role docs**: all three rewritten in full — [.claude/CLAUDE.md](.claude/CLAUDE.md) as Planner (overwrite Plan.md, end with `**Plan Status:** READY`), [.gemini/GEMINI.md](.gemini/GEMINI.md) as Builder (reads Plan.md, logs Build-Log.md, revisions read Build-Feedback.md), [.codex/CODEX.md](.codex/CODEX.md) as Auditor (reads Plan.md + Build-Log.md, grades in Build-Feedback.md).
- **Filesystem**: old files archived (not deleted, per user preference) — `Log.md`, `Feedback.md`, `DISCUSS.md` moved to [.archive/](.archive/). New runtime files will be created fresh: `Plan.md`, `Build-Log.md`, `Build-Feedback.md`, `WarZone.md`.
- **Docs rewritten in clean professional format**: [README.md](README.md), [workflow.md](workflow.md), [hermes/HERMES.md](hermes/HERMES.md), [argus-ui/README.md](argus-ui/README.md). All four are cross-consistent (same agent/role terminology, same file names, same NATS topic names, same state tables) and cross-linked. Top-level README has an ASCII architecture diagram. workflow.md and HERMES.md both have state tables + troubleshooting matrices.

### E2E verification — COMPLETE ✓ (2026-04-15 afternoon)

Build pipeline end-to-end verified on the landing-page BMW task. Full trajectory captured in Plan.md (12KB, 225 lines), Build-Log.md (3 iterations), Build-Feedback.md (3 audits: B, B, A). See "Current Status" bullet at top of file for details. Warzone 3-phase still not yet live-run end-to-end. Chat status per-agent (as of 2026-04-16 morning): Codex ✓ working (verified after hermes restart cleared cached agents.json); Claude ✓ working (Nagesh tested during 2026-04-15 dark-lime UI session); **Gemini ✗ exit 42 — see Bug F (OPEN).**

---

## Three-Agent Refactor — file-by-file record (2026-04-14)

Detailed per-file notes kept as reference; the summary above is the source of truth for status.

> **Partially superseded by 2026-04-15 session unification** — the `agents.json` / `agents.js` / `.env` details below describe the pre-unification shape (separate `command` vs `resumeCommand`, `-C {WORK_DIR}` on Codex resume, `{CODEX_SESSION_ID}` only). Current shape is documented in the **"Session Management Convention"** and **"agents.json — Key Config (post 2026-04-15 session-unification)"** sections above. The rest of this record (watcher, build.js, warzone.js, chat.js, frontend, role docs, filesystem, docs) is still accurate.

**Plan file:** `/Users/karinganageshgoud/.claude/plans/shiny-watching-scroll.md`

Architectural shift: Claude=Planner, Gemini=Builder, Codex=Auditor. Build pipeline: `idle → planning → building → auditing → awaiting_approval → (loop or done)`. Warzone: `idle → discussing_claude → discussing_gemini → discussing_codex → awaiting_discuss_approval`. Chat gets Codex as third tab.

### Codex CLI — Verified 2026-04-14 / corrected 2026-04-15 (codex-cli 0.114.0)

- **First invocation:** `codex exec --full-auto --skip-git-repo-check -C <dir> "<prompt>"` — headless, non-interactive. Session UUID printed in stdout header as `session id: <UUID>`.
- **Resume (headless):** `codex exec resume <UUID> --full-auto --skip-git-repo-check "<prompt>"` — **no `-C <dir>` flag allowed.** The 2026-04-14 note claimed `-C` worked on resume; it does NOT. `codex exec resume --help` does not list `-C`; passing it causes `error: unexpected argument '-C' found` and exit code 2 in ~88ms. Directory is handled via spawn `cwd` instead.
- **Top-level `codex resume`** is TTY-only (fails with `Error: stdin is not a terminal` even with `< /dev/null`). Do NOT use.
- **Interactive:** plain `codex` (no subcommand) forwards to the interactive CLI — this is the equivalent of Claude's `claude` command. Useful for manual session seeding.
- `--full-auto` = `-a on-request` + `--sandbox workspace-write` (matches Gemini `-y`).
- `--skip-git-repo-check` required (WORK_DIR is not a git repo).
- Smoke test passed 2026-04-15: `codex exec "say hi"` (new) → copied `session id: <UUID>` from stdout header → `codex exec resume <UUID> --full-auto --skip-git-repo-check "what did i just say"` → resumed correctly, context preserved ("session"), exit 0.
- **Session files on disk:** `~/.codex/sessions/YYYY/MM/DD/rollout-<TIMESTAMP>-<UUID>.jsonl`. Newest file by mtime = most recent session. Sessions persist across codex CLI restarts.

### Gemini CLI — Verified 2026-04-15

- **Interactive:** `gemini` (no subcommand) — equivalent to `claude`. On `/exit` the last line prints `To resume this session: gemini --resume <UUID>` — this is the UUID to paste into `.env`.
- **Headless resume:** `gemini --resume <UUID> -p "<prompt>" -y` works and preserves full context across calls. Verified: resumed a session where Nagesh had asked to list files in landing/; the resumed invocation correctly answered "You asked me to list the files in the `landing` folder."
- `-y` = YOLO mode (auto-approve tool calls), matches Codex `--full-auto`.
- `--resume latest` — accepts the literal keyword "latest" to resume the most recent session in cwd. This was the old hermes behavior; now replaced with explicit UUID substitution. Do NOT use for pipeline commands — cross-contaminates concurrent flows.

### Seeded session UUID
`CODEX_SESSION_ID=019d8f27-efe8-7193-bfd0-4fce9d08542c` — already written to [hermes/.env](hermes/.env). Seeded via `codex exec --full-auto --skip-git-repo-check "ready"`.

### Backend changes — COMPLETED ✓

All 6 backend files rewritten/edited:

1. **[hermes/.env](hermes/.env)** — added `CODEX_SESSION_ID=019d8f27-efe8-7193-bfd0-4fce9d08542c` after `CLAUDE_SESSION_ID`.

2. **[hermes/core/agents.json](hermes/core/agents.json)** — fully rewritten. Six agents: `builder` (Gemini, completion file now `Build-Log.md`), `planner` (Claude, new, completion via `file_content` type matching `**Plan Status:** READY` in `Plan.md`), `codex_auditor` (Codex, new, completion via append to `Build-Feedback.md`), `discuss_builder`, `discuss_planner`, `discuss_codex`. Codex commands use `codex exec` / `codex exec resume` with `--full-auto --skip-git-repo-check -C {WORK_DIR}`. Old `auditor` entry deleted (Claude now plans, Codex audits).

3. **[hermes/core/agents.js](hermes/core/agents.js)** — added two replacements to `buildCommand`: `{CODEX_SESSION_ID}` from env, `{WORK_DIR}` from env. Rest of runAgent unchanged.

4. **[hermes/core/watcher.js](hermes/core/watcher.js)** — fully rewritten. Renamed `LOG_FILE/FEEDBACK_FILE/DISCUSS_FILE` → `BUILD_LOG_FILE/BUILD_FEEDBACK_FILE/WARZONE_FILE`. Added `PLAN_FILE`. Build mode now watches `[PLAN_FILE, BUILD_LOG_FILE, BUILD_FEEDBACK_FILE]`. **`Plan.md` uses edge-triggered content match** (not delta) because the file is overwritten per task — tracks `lastPlanMatched` boolean and fires `plan.completed` only on the false→true transition. Warzone watches three sequential markers: `**Planner Status:** DONE` → `discuss.claude_done`, `**Builder Status:** DONE` → `discuss.gemini_done`, `**Auditor Status:** READY TO BUILD` → `discuss.complete`.

5. **[hermes/workflows/build.js](hermes/workflows/build.js)** — inserted `planning` state between `idle` and `building`. New entry action `startPlanner` calls `runAgent('planner', plannerPrompt, ...)`. New events: `PLAN_DONE` (from `plan.completed`), `PLAN_FAILED` (retry path like build/audit). `TASK_SUBMITTED` now targets `planning`, not `building`. `launchAuditor` now calls `'codex_auditor'` agent key. `submitTask` calls `resetSession('builder' | 'planner' | 'codex_auditor')`. `launchBuilder` prompt updated: reads Plan.md on first iteration, reads Build-Feedback.md on revision, logs to Build-Log.md. `launchAuditor` prompt tells Codex to read Plan.md + Build-Log.md, write `**Audit Grade:**` line to Build-Feedback.md.

6. **[hermes/workflows/warzone.js](hermes/workflows/warzone.js)** — fully rewritten. Three states: `discussing_claude → discussing_gemini → discussing_codex → awaiting_discuss_approval`. Entry actions: `startClaudePlan / startGeminiBuild / startCodexAudit` — each writes its section to WarZone.md with the status marker the watcher expects. Claude goes first (planner frames the idea). All three prompts include "DISCUSSION task, not a build task — do NOT write to Plan.md, Build-Log.md, or Build-Feedback.md. Only append to WarZone.md." `submitDiscuss` resets all three discuss session keys.

7. **[hermes/servers/chat.js](hermes/servers/chat.js)** — allowed agents now `['builder', 'planner', 'codex_auditor']`. `chat.output` subscriber maps agent name → key: `Gemini→builder, Claude→planner, Codex→codex_auditor`. `ensureChatGeminiMd()` context updated to reference new filenames (Plan.md/Build-Log.md/Build-Feedback.md/WarZone.md).

### Frontend changes — COMPLETED ✓
All 6 files edited. `npm run build` + `npm run lint` both pass clean.
- [argus-ui/src/types/index.ts](argus-ui/src/types/index.ts) — `AgentKey = 'builder' | 'planner' | 'codex_auditor'`, `Section` includes `'chat-codex'`, `BuildState` includes `'planning'`, `WarzoneState` has all three `discussing_*` states.
- [argus-ui/src/hooks/useChatSocket.ts](argus-ui/src/hooks/useChatSocket.ts) — added `codexMessages` state/setter/ref; three-way routing in both `ws.onmessage` and `sendMessage` (builder→Gemini, planner→Claude, codex_auditor→Codex).
- [argus-ui/src/App.tsx](argus-ui/src/App.tsx) — `chat-claude` agent prop flipped from `"auditor"` to `"planner"`; new `chat-codex` branch renders `<ChatView agent="codex_auditor" agentLabel="Codex" agentColor="bg-emerald-500/20 text-emerald-300" ...>`.
- [argus-ui/src/components/Layout/Sidebar.tsx](argus-ui/src/components/Layout/Sidebar.tsx) — third SubNavItem for Codex under Chat group.
- [argus-ui/src/components/BuildView/index.tsx](argus-ui/src/components/BuildView/index.tsx) — `STATE_LABELS` includes `planning: 'Planning...'`; 5-step ProgressDots (Plan→Build→Audit→Review→Done); `stateOrder` includes `'planning'`; busy state includes planning/building/auditing; header "Claude plans · Gemini builds · Codex audits"; approval text "Codex flagged issues".
- [argus-ui/src/components/WarzoneView/index.tsx](argus-ui/src/components/WarzoneView/index.tsx) — three `discussing_*` states in STATE_LABELS; 4-step DiscussProgress (Claude→Gemini→Codex→Review); explanation list rewritten for 3 agents; approval references WarZone.md.
- [argus-ui/src/components/ChatView/index.tsx](argus-ui/src/components/ChatView/index.tsx) — no change needed (treats `agent` as opaque key).

### Role docs — COMPLETED ✓
All three rewritten in full:
- **[.claude/CLAUDE.md](.claude/CLAUDE.md)** — Planner role. Writes Plan.md (OVERWRITE, not append). Ends with exact line `**Plan Status:** READY`. Plan.md format: Goal / Files to Touch / Approach / Gotchas / Verification. Notes Claude is NOT re-invoked on B/C/F — plan must be resilient.
- **[.gemini/GEMINI.md](.gemini/GEMINI.md)** — Builder role. Reads Plan.md first, appends `### Iteration N` to Build-Log.md. On revision reads Build-Feedback.md. Forbidden from Plan.md / Build-Feedback.md / hermes/.
- **[.codex/CODEX.md](.codex/CODEX.md)** — Auditor role (newly created). Reads Plan.md + latest Build-Log.md iteration + modified files. Appends grade entry to Build-Feedback.md with exact `**Audit Grade:** [A/B/C/F]` line. Includes Plan Adherence section.

### Filesystem cleanup — COMPLETED ✓ (archived, not deleted)
Per user preference ("lets archive them as no agent will read them"), old files moved to [.archive/](.archive/) instead of deletion:
- `Log.md` → `.archive/Log.md`
- `Feedback.md` → `.archive/Feedback.md`
- `DISCUSS.md` → `.archive/DISCUSS.md`

Runtime files (Plan.md, Build-Log.md, Build-Feedback.md, WarZone.md) will be created fresh by agents on first task.

### Documentation rewrites — COMPLETED ✓
Four docs rewritten in clean professional format, cross-consistent terminology, cross-linked:
- [README.md](README.md) — top-level, ASCII architecture diagram, three-agent pipeline explanation, file signals table, getting-started, session seeding, safety model.
- [workflow.md](workflow.md) — v0.3 pipeline walkthrough with full state-flow ASCII diagrams, state tables with retry behavior, file ownership, troubleshooting matrix.
- [hermes/HERMES.md](hermes/HERMES.md) — v0.3 engine reference. Folder structure, .env reference, state tables, file-signal table (edge-triggered vs delta-checked noted), agents.json field reference, Codex CLI quirks section, session management matrix.
- [argus-ui/README.md](argus-ui/README.md) — replaced Vite template. Stack, scripts, project layout, section-to-backend map, BuildState/WarzoneState UI mapping, configuration, extension guide.

### E2E verification — Build: COMPLETE ✓ | Warzone: still pending | Chat: Gemini BROKEN (Bug F), Claude + Codex ✓
- **Build:** Full 3-iteration run on landing-page task 2026-04-15 afternoon (B→B→A). Artifacts on disk: Plan.md / Build-Log.md / Build-Feedback.md. See "Current Status" bullet.
- **Warzone:** not yet exercised. Expected sequence: WarZone.md with Claude's Plan → Gemini's Build Approach → Codex's Audit, in that order.
- **Chat:** 3 tabs open and Codex verified working today; deeper conversation testing not done.
