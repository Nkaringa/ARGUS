# Hermes — Orchestration Engine

**Version:** 0.3 (three-agent)
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

For full first-time setup (prerequisites, project folder, session seeding, etc.) see **[SETUP.md](../SETUP.md)** at the repo root. Quick commands once you're already set up:

```bash
# From the repo root (one-time install covers hermes + argus-ui as workspaces)
npm install

# Start NATS + all 3 Hermes servers + Argus UI
nats-server &
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
│   ├── agents.json         Command templates for 6 agent keys
│   ├── archive.js          Build-History move on each submitTask + parseTaskFile helper
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
│   ├── build.js            POST /task, /approval, /stop   GET /state, /history
│   └── warzone.js          POST /discuss, /discuss/approval, /stop   GET /state, /warzone.md
│
├── hermes.db               SQLite database (events + tasks tables) — git-ignored
├── .env                    WORK_DIR, session IDs, ports, CHAT_DIR — git-ignored
├── .env.example            Template — copy to .env and seed UUIDs
├── .gitignore              Ignores .env, hermes.db, runtime artifacts
├── HERMES.md               This file
└── package.json
```

---

## `.env` Reference

```
WORK_DIR=/Users/.../NK-Base
CLAUDE_SESSION_ID=<uuid>
GEMINI_SESSION_ID=<uuid>
CODEX_SESSION_ID=<uuid>
CHAT_PORT=3001
BUILD_PORT=3002
WARZONE_PORT=3003
CHAT_DIR=/tmp/argus-chat    ← chat cwd (no .gemini/ here = Gemini won't write to Build-Log.md)
```

All three session IDs are seeded manually by the user. Hermes never creates sessions. See [Session Management](#session-management) below.

---

## agents.json — Config Reference

Six agent keys, one per (role × pipeline) slot. All six follow the same template pattern:

```json
{
  "builder":         { "name": "Gemini", "role": "build",          "command": "gemini --resume {GEMINI_SESSION_ID} -p \"{task}\" -y", ... },
  "planner":         { "name": "Claude", "role": "plan",           "command": "claude --resume {CLAUDE_SESSION_ID} --allowedTools Edit Write Read Glob Grep -p \"{task}\" < /dev/null", ... },
  "codex_auditor":   { "name": "Codex",  "role": "audit",          "command": "codex exec resume {CODEX_SESSION_ID} --full-auto --skip-git-repo-check \"{task}\"", ... },
  "discuss_builder": { "name": "Gemini", "role": "discuss_build",  "command": "gemini --resume {GEMINI_SESSION_ID} -p \"{task}\" -y", ... },
  "discuss_planner": { "name": "Claude", "role": "discuss_plan",   "command": "claude --resume {CLAUDE_SESSION_ID} --allowedTools Edit Write Read Glob Grep -p \"{task}\" < /dev/null", ... },
  "discuss_codex":   { "name": "Codex",  "role": "discuss_audit",  "command": "codex exec resume {CODEX_SESSION_ID} --full-auto --skip-git-repo-check \"{task}\"", ... }
}
```

**Substitution tokens** (resolved in [core/agents.js](core/agents.js) `buildCommand`):

| Token | Source |
|---|---|
| `"{task}"` | Shell-escaped (single-quoted) task prompt |
| `{CLAUDE_SESSION_ID}` | `process.env.CLAUDE_SESSION_ID` |
| `{GEMINI_SESSION_ID}` | `process.env.GEMINI_SESSION_ID` |
| `{CODEX_SESSION_ID}` | `process.env.CODEX_SESSION_ID` |
| `{WORK_DIR}` | `process.env.WORK_DIR` |

**Per-agent fields:**

- `timeout` — kill after N ms
- `completionSignal` — `{ type: 'file_append' | 'file_content', file, pattern }` — watcher uses this
- `suppressStderr`, `noisePatterns` — used for Gemini, which writes noisy YOLO/MCP warnings to stderr

---

## Session Management

Every agent invocation is `<cli> --resume <UUID>` (or the Codex equivalent, `codex exec resume <UUID>`). The user seeds all three UUIDs in `.env`. There is no runtime session capture, no "first call vs subsequent call" branching — every call is symmetric.

| Agent | Command pattern | Seeding procedure |
|---|---|---|
| Claude | `claude --resume {CLAUDE_SESSION_ID} …` | In `WORK_DIR`: `claude` → send a small prompt → `/exit` → copy resume UUID |
| Gemini | `gemini --resume {GEMINI_SESSION_ID} …` | In `WORK_DIR`: `gemini` → send a small prompt → `/exit` → copy from `To resume this session: gemini --resume <UUID>` line |
| Codex | `codex exec resume {CODEX_SESSION_ID} …` | `codex exec --full-auto --skip-git-repo-check -C "$WORK_DIR" "hello"` → copy UUID from stdout header. Top-level `codex resume` is TTY-only and won't work. |

Each agent uses **one session across all three pipelines** (chat, build, warzone). Gemini-chat differs only in `cwd` (runs in `CHAT_DIR` so it doesn't pollute Build-Log.md), not session.

**Rotating context.** When starting an unrelated task, seed fresh UUIDs in `.env` and restart Hermes. No server-side state needs clearing — rotation is purely an `.env` edit.

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
| `agent.output` | agents.js stdout/stderr | build + warzone servers → UI |
| `chat.output` | agents.js (chat server's runAgent) | chat server → UI |
| `agent.started` | agents.js | build + warzone servers → UI |
| `plan.completed` | watcher.js (`*-Plan.md`) | build workflow (extracts slug from `payload.file`) |
| `agent.completed` | watcher.js (`*-Build-Log.md`) | build workflow |
| `agent.failed` | workflow | build workflow |
| `grade.received` | watcher.js (`*-Build-Feedback.md`) | build workflow |
| `discuss.claude_done` | watcher.js (`*-WarZone.md`) | warzone workflow (extracts slug from `payload.file` on first round) |
| `discuss.gemini_done` | watcher.js (`*-WarZone.md`) | warzone workflow |
| `discuss.complete` | watcher.js (`*-WarZone.md`) | warzone workflow |

---

## Database (hermes.db)

Two SQLite tables:

- **events** — every NATS event ever fired (full audit trail)
- **tasks** — completed task records: description, grade, iterations, timestamps

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| NATS connection refused | `nats-server` is not running. `nats-server &`. |
| Claude session expired / invalid UUID | `claude` in terminal → `/exit` → update `CLAUDE_SESSION_ID` in `.env`. |
| Gemini session expired / invalid UUID | `gemini` in terminal → `/exit` → copy UUID from `To resume this session:` line → update `GEMINI_SESSION_ID`. |
| Codex session expired | `codex exec --full-auto --skip-git-repo-check -C "$WORK_DIR" "hello"` → copy UUID from stdout → update `CODEX_SESSION_ID`. |
| Stuck in `planning` | No `*-Plan.md` ending with `**Plan Status:** READY` — Claude either dropped the slug prefix (`Plan.md` alone won't match the watcher glob) or omitted the READY marker. Check build server stdout. |
| Stuck in `building` | `<slug>-Build-Log.md` missing new `### Iteration` entry — check build server stdout. |
| Stuck in `auditing` | `<slug>-Build-Feedback.md` missing `**Audit Grade:** [ABCF]` (case-sensitive, exact format). |
| Warzone stuck at a phase | The current `<slug>-WarZone.md` is missing the expected status marker for that phase. |
| Gemini writes to a `*-Build-Log.md` during chat | `CHAT_DIR` points at a directory containing `.gemini/`. Use `/tmp/argus-chat`. |
