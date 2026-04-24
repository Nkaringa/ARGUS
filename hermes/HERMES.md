# Hermes — Orchestration Engine

**Version:** 1.0 (three-agent)
**Part of:** Argus
**Interface:** `http://localhost:5173` (Argus React UI via Vite)

---

## What It Does

Hermes is the backend engine for Argus. It runs three independent servers that share the same agent runner, NATS bus, SQLite store, and file watcher.

| Server | Port | Role |
|---|---|---|
| **chat** | 3001 | Direct per-agent conversation — three tabs (Gemini, Claude, Codex), no pipeline |
| **build** | 3002 | Build pipeline: Claude plans → Gemini builds → Codex audits → loop until grade A |
| **warzone** | 3003 | Pre-build discussion: Claude plans → Gemini proposes build → Codex audits → user approves |

The core loop is: **agents write files → watcher detects markers → NATS events drive XState transitions**.

See [workflow.md](../workflow.md) for the end-to-end pipeline walkthrough.

---

## How to Start

For full first-time setup (prerequisites, project folder, CLI auth, etc.) see **[SETUP.md](../SETUP.md)** at the repo root. Quick commands once you're already set up:

```bash
# From the repo root (one-time install covers hermes + argus-ui as workspaces)
npm install

# Start NATS + all 3 Hermes servers + Argus UI
npm run dev

# Or start individually from the repo root
npm run dev:chat     # port 3001
npm run dev:build    # port 3002
npm run dev:warzone  # port 3003
npm run dev:ui       # Vite on port 5173
```

**Do not run `npm install` inside `hermes/`.** Dependencies are hoisted to the root `node_modules/` by npm workspaces; running install here creates a separate `hermes/node_modules/` that will shadow the workspace link.

---

## Folder Structure

```
hermes/
├── core/                   ← shared infrastructure
│   ├── events.js           NATS pub/sub (connect, publish, subscribe)
│   ├── agents.js           Agent runner (buildCommand, runAgent)
│   ├── agents.json         Command templates for 7 agent keys (3 build + 3 warzone + 1 chat-specific Gemini)
│   ├── archive.js          archiveLiveFiles (on task completion), archiveWarzoneFile, findLiveWarzoneSlug, listProjectFolders, listBuildHistory, listDiscussionHistory, listHistoryFolder, readBuildHistory, readDiscussionHistory, parseTaskFile, parseWarzoneFile, buildFileTree, isSafeSlug, isValidTaskSlug
│   ├── auth.js             Shared-secret auth + CORS
│   ├── db.js               SQLite (logEvent, createTask, completeTask, getHistory)
│   └── watcher.js          File watcher (*-Plan.md, *-Build-Log.md, *-Build-Feedback.md, *-WarZone.md)
│
├── workflows/              ← XState state machines
│   ├── build.js            idle → planning → building → auditing → awaiting_approval → …
│   └── warzone.js          idle → discussing_claude → discussing_gemini → discussing_codex → …
│
├── servers/                ← Express + WebSocket HTTP servers
│   ├── chat.js             POST /chat
│   ├── build.js            POST /task · /approval · /stop
│   │                       GET /state · /history · /projects · /files · /files/content
│   │                       GET /history/builds · /history/builds/:slug
│   └── warzone.js          POST /discuss · /discuss/approval · /warzone/new-discussion · /stop
│                           GET /state · /warzone.md
│                           GET /history/discussions · /history/discussions/:slug
│
├── hermes.db               SQLite database (events + tasks tables) — git-ignored
├── .env                    WORK_DIR, ports, CHAT_DIR — git-ignored
├── .env.example            Template — copy to .env and set WORK_DIR
├── .gitignore              Ignores .env, hermes.db, runtime artifacts
├── HERMES.md               This file
└── package.json
```

---

## `.env` Reference

```
WORK_DIR=/Users/.../your-project-folder
CHAT_PORT=3001
BUILD_PORT=3002
WARZONE_PORT=3003
CHAT_DIR=/tmp/argus-chat    ← chat Gemini cwd (isolated role doc)
```

Only `WORK_DIR` is required. Everything else has defaults. No session UUIDs — every agent invocation is a fresh, one-shot spawn; Hermes gives the agent everything it needs via prompt + role docs + files on disk.

---

## agents.json — Config Reference

Seven agent keys, one per (role × pipeline) slot. All seven invoke their CLI in one-shot mode:

```json
{
  "builder":         { "name": "Gemini", "role": "build",          "command": "gemini -p \"{task}\" -y", ... },
  "planner":         { "name": "Claude", "role": "plan",           "command": "claude --allowedTools Edit Write Read Glob Grep -p \"{task}\" < /dev/null", ... },
  "codex_auditor":   { "name": "Codex",  "role": "audit",          "command": "codex exec --full-auto --skip-git-repo-check \"{task}\"", ... },
  "discuss_builder": { "name": "Gemini", "role": "discuss_build",  "command": "gemini -p \"{task}\" -y", ... },
  "discuss_planner": { "name": "Claude", "role": "discuss_plan",   "command": "claude --allowedTools Edit Write Read Glob Grep -p \"{task}\" < /dev/null", ... },
  "discuss_codex":   { "name": "Codex",  "role": "discuss_audit",  "command": "codex exec --full-auto --skip-git-repo-check \"{task}\"", ... },
  "chat_builder":    { "name": "Gemini", "role": "chat",           "command": "gemini -p \"{task}\" -y", ... }
}
```

`chat_builder` exists as a distinct key so chat-mode Gemini can be spawned with `cwd=CHAT_DIR` (which has its own `GEMINI.md` role doc telling Gemini not to write to project files). Claude and Codex don't need a chat-specific key — they use their build-side keys with the same cwd, and their role docs already cover chat behavior.

**Substitution tokens** (resolved in [core/agents.js](core/agents.js) `buildCommand`):

| Token | Source |
|---|---|
| `"{task}"` | Shell-escaped (single-quoted) task prompt |
| `{WORK_DIR}` | `process.env.WORK_DIR` |

**Per-agent fields:**

- `timeout` — kill after N ms
- `completionSignal` — `{ type: 'file_append' | 'file_content', file, pattern }` — watcher uses this
- `suppressStderr`, `noisePatterns` — used for Gemini, which writes noisy YOLO/MCP warnings to stderr

---

## Agent Invocation Model

Every agent call is a fresh, non-interactive one-shot. No session UUIDs, no `--resume`. Hermes gives each invocation everything it needs through three channels:

1. **Prompt text** — the task description, continuation context, and role-doc references are baked into `{task}` by the workflow that invokes `runAgent`.
2. **Role doc on disk** — `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.codex/CODEX.md` inside `WORK_DIR`. Each CLI loads these automatically from its cwd.
3. **Files on disk** — prior plan/build-log/audit files the agent can read with its Read tool.

This means there is no per-session state to manage, rotate, or expire. If a CLI auth token expires, re-authenticate that CLI (`claude`, `gemini`, or `codex` alone) and Argus picks it up on the next invocation.

**Why two Gemini configs for "chat" vs "build":** still exists, but now purely about role-doc isolation via `CHAT_DIR`. Gemini loads `CHAT_DIR/.gemini/GEMINI.md` when invoked there, which tells it "you're in chat mode, don't write to Build-Log.md." Without the cwd isolation, chat Gemini would load the build role doc and corrupt the build pipeline's log files.

---

## Build Pipeline States

```
IDLE → PLANNING → BUILDING → AUDITING → AWAITING_APPROVAL → BUILDING (loop on B/C/F)
                                     ↘ DONE (grade A)
PLANNING/BUILDING/AUDITING → PAUSED (on failure after 1 retry)
```

| State | Meaning |
|---|---|
| idle | Ready for a task |
| planning | Claude writing Plan.md |
| building | Gemini implementing, appending to Build-Log.md |
| auditing | Codex grading, appending to Build-Feedback.md |
| awaiting_approval | Grade B/C/F — user decides revise / skip / abort |
| paused | Agent crashed or timed out after retry |
| done | Grade A — task complete |

On B/C/F, **only Gemini re-runs**. Plan.md is frozen. Claude is not re-invoked.

## Warzone Pipeline States

```
IDLE → DISCUSSING_CLAUDE → DISCUSSING_GEMINI → DISCUSSING_CODEX → AWAITING_DISCUSS_APPROVAL → IDLE
```

Claude goes first — framing the idea is a planning task.

---

## File Signals (watched by watcher.js)

| File | Owner | Signal pattern | Type | NATS topic |
|---|---|---|---|---|
| `<slug>-Plan.md` | Claude | `**Plan Status:** READY` | `file_content` (slug picked by Claude on new, fixed by UI on continue) | `plan.completed` (payload includes `file`) |
| `<slug>-Build-Log.md` | Gemini | new `### Iteration N` | `file_append` (delta scan) | `agent.completed` |
| `<slug>-Build-Feedback.md` | Codex | `**Audit Grade:** [ABCF]` | `file_append` | `grade.received` |
| `<slug>/` | Gemini | (not watched) | — | deliverable folder; persists across iterations and continuations |
| `<slug>-WarZone.md` | all three | `**Planner Status:** DONE` | `file_append` | `discuss.claude_done` (payload includes `file`) |
| `<slug>-WarZone.md` | all three | `**Builder Status:** DONE` | `file_append` | `discuss.gemini_done` |
| `<slug>-WarZone.md` | all three | `**Auditor Status:** READY TO BUILD` | `file_append` | `discuss.complete` |

The watcher uses glob patterns (`*-Plan.md`, `*-Build-Log.md`, `*-Build-Feedback.md`, `*-WarZone.md`) at the project root only — `Build-History/` and `WarZone-History/` are not watched. Append-only files use delta scanning (only newly written bytes are checked).

**Build archival.** `archiveLiveFiles()` runs at three points: the `onDone` action (when a task completes — grade A or skip), the `sendApproval('abort')` path, and as a safety net at the start of `submitTask()` (covers files stranded by a crash or manual restart). It moves any matching `<slug>-*.md` into `Build-History/<slug>/{Plan.md, Build-Log.md, Build-Feedback.md}` (slug prefix dropped). On slug collision the destination folder is suffixed with an ISO timestamp. Idempotent — re-running it is a no-op when nothing matches. **Deliverable folders (`<slug>/`) are NOT archived** — they persist in WORK_DIR so users can continue iterating on them via the Build tab's "Project" dropdown.

**New vs continue mode.** `submitTask(description, opts)` accepts `{ mode: 'new' | 'continue', slug? }`. In `'new'` mode Claude picks the slug as part of planning; in `'continue'` mode the UI passes a slug from the dropdown, Hermes pre-sets `currentSlug`, and the planner prompt instructs Claude to use that slug verbatim. The `plan.completed` handler enforces the constraint in continue mode — a filename whose slug differs from `currentSlug` triggers `PLAN_FAILED` instead of silently fragmenting the project. The Build UI offers continue mode via `GET /projects` (returns the list of `<slug>/` folders in WORK_DIR, excluding system folders).

**Warzone archival.** A discussion can span multiple submits on the same topic — they all append to the same `<slug>-WarZone.md`. Clicking **New Discussion** in the UI calls `newDiscussion()`, which `archiveWarzoneFile(slug)` moves into `WarZone-History/<slug>/WarZone.md` and clears the in-memory slug. On hermes boot the workflow scans `WORK_DIR` for any `*-WarZone.md` and resumes the slug from disk, so a mid-discussion restart is recoverable.

---

## NATS Topics

| Topic | Published by | Consumed by |
|---|---|---|
| `build.output` | agents.js stdout/stderr (build pipeline) | build server → UI |
| `warzone.output` | agents.js stdout/stderr (warzone pipeline) | warzone server → UI |
| `chat.output` | agents.js stdout/stderr (chat server) | chat server → UI |
| `build.agent.started` | agents.js (build-pipeline invocations) | build server → UI |
| `warzone.agent.started` | agents.js (warzone-pipeline invocations) | warzone server → UI |
| `plan.completed` | watcher.js (`*-Plan.md`) | build workflow (extracts slug from `payload.file`) |
| `agent.completed` | watcher.js (`*-Build-Log.md`) | build workflow |
| `grade.received` | watcher.js (`*-Build-Feedback.md`) | build workflow |
| `discuss.claude_done` | watcher.js (`*-WarZone.md`) | warzone workflow (extracts slug from `payload.file` on first round) |
| `discuss.gemini_done` | watcher.js (`*-WarZone.md`) | warzone workflow |
| `discuss.complete` | watcher.js (`*-WarZone.md`) | warzone workflow |



---

## Database (hermes.db)

SQLite, opened with **WAL journaling** (`journal_mode=WAL`, `synchronous=NORMAL`) so readers don't block writers during an active build.

Two tables:

- **events** — every event fired (full audit trail). Columns include `task_id` (keyed to `tasks.id`), `ts`, `topic`, `payload`. Indexed on `task_id`, `ts`, and `topic` — so you can query an entire iteration's event trace or pull a time-slice without a full scan.
- **tasks** — completed task records: description, grade, iterations, timestamps, status (`RUNNING` / `DONE` / `STALE` / `ABORTED`). On hermes boot any `RUNNING` task left over from a prior crash is marked `STALE`.

Everything Hermes publishes to NATS is also written to `events` via `logEvent()` — plus workflow-internal events like `agent.failed` that never hit NATS. So the events table is the complete trace; NATS is the live broadcast subset.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| NATS connection refused | Only happens when starting servers individually (`npm run dev:chat/build/warzone`). Use `npm run dev` which auto-starts NATS, or run `nats-server &` first. |
| CLI auth expired / agent fails with login error | Re-authenticate the CLI directly (`claude`, `gemini`, or `codex` alone from your shell). Argus picks up the refreshed auth on the next invocation — no .env change needed. |
| Stuck in `planning` | No `*-Plan.md` ending with `**Plan Status:** READY` — Claude either dropped the slug prefix (`Plan.md` alone won't match the watcher glob) or omitted the READY marker. Check build server stdout. |
| Stuck in `building` | `<slug>-Build-Log.md` missing new `### Iteration` entry — check build server stdout. |
| Stuck in `auditing` | `<slug>-Build-Feedback.md` missing `**Audit Grade:** [ABCF]` (case-sensitive, exact format). |
| Warzone stuck at a phase | The current `<slug>-WarZone.md` is missing the expected status marker for that phase. |
| Gemini writes to a `*-Build-Log.md` during chat | `CHAT_DIR` points at a directory containing `.gemini/`. Use `/tmp/argus-chat`. |

---

## See also

- **[../CHANGELOG.md](../CHANGELOG.md)** — version history
- **[../README.md](../README.md)** — product overview, architecture, file signals, safety model
- **[../SETUP.md](../SETUP.md)** — install, configure, run, troubleshoot
- **[../workflow.md](../workflow.md)** — end-to-end pipeline walkthrough with state tables
- **[../argus-ui/README.md](../argus-ui/README.md)** — UI stack, scripts, section map
