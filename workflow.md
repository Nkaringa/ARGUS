# Hermes Workflow

**Version:** 0.3 (three-agent)
**UI:** `http://localhost:5173` (Argus — React/Vite)

---

## Overview

Hermes is the backend engine for Argus. It runs three independent servers, each with its own pipeline and state machine. You interact through the Argus UI. Hermes handles all agent routing, state transitions, file watching, and persistence.

The core abstraction is simple: **agents write to files, Hermes watches files, file writes advance state machines**.

---

## Servers

| Server | Port | Role |
|---|---|---|
| **chat** | 3001 | Direct per-agent conversation — three tabs (Gemini, Claude, Codex), no pipeline |
| **build** | 3002 | Build pipeline: Claude plans → Gemini builds → Codex audits → loop until Grade A |
| **warzone** | 3003 | Pre-build discussion: Claude plans → Gemini proposes build → Codex audits → you approve |

---

## Agents

| Agent | CLI | Role | Invocation |
|---|---|---|---|
| Claude | `claude` | Planner · Discuss Planner | `claude -p "<task>"` (one-shot) |
| Gemini | `gemini` | Builder · Discuss Builder · Chat | `gemini -p "<task>" -y` (one-shot) |
| Codex | `codex` | Auditor · Discuss Auditor | `codex exec "<task>"` (one-shot) |

Every agent call is a fresh non-interactive invocation. No session UUIDs, no `--resume`. Context comes from the prompt text + role doc + files on disk.

Each agent has a role spec in its dotfile: `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.codex/CODEX.md`.

---

## Build Pipeline

```
Submit task via Argus UI
        ↓
Hermes — state: IDLE → PLANNING
        ↓
Claude CLI runs:
  - new project: chooses a slug, writes <slug>-Plan.md
  - continuation: uses the slug Hermes injected, writes <slug>-Plan.md
  Either way: ends with **Plan Status:** READY
        ↓
watcher.js detects *-Plan.md match
        ↓  publishes: plan.completed { file: '<slug>-Plan.md' }
Hermes — state: PLANNING → BUILDING
  - new mode: slug captured from filename
  - continue mode: slug must match the pre-set value, else PLAN_FAILED (drift safeguard)
        ↓
Gemini CLI runs (creates <slug>/ if missing, writes deliverables there,
                appends iteration entry to <slug>-Build-Log.md at root)
        ↓
watcher.js detects new ### Iteration in <slug>-Build-Log.md
        ↓  publishes: agent.completed
Hermes — state: BUILDING → AUDITING
        ↓
Codex CLI runs (reads <slug>-Plan.md + latest <slug>-Build-Log iteration, grades)
        ↓
Codex appends **Audit Grade:** [ABCF] to <slug>-Build-Feedback.md
        ↓
watcher.js detects grade
        ↓  publishes: grade.received

        ┌── Grade A ─────────────────────────────────────────────────┐
        │   State: AUDITING → DONE                                   │
        │   Task saved to SQLite · History updated                   │
        └────────────────────────────────────────────────────────────┘

        ┌── Grade B / C / F ─────────────────────────────────────────┐
        │   State: AUDITING → AWAITING_APPROVAL                      │
        │   UI shows grade + Revise / Skip / Abort buttons           │
        │                                                            │
        │   Revise → BUILDING (Gemini reads <slug>-Build-Feedback.md │
        │            <slug>-Plan.md UNCHANGED, Claude not re-invoked)│
        │   Skip   → DONE                                            │
        │   Abort  → IDLE                                            │
        └────────────────────────────────────────────────────────────┘
```

### Build States

```
IDLE
  → task submitted → PLANNING

PLANNING
  → any *-Plan.md file ends with **Plan Status:** READY → BUILDING (slug captured)
  → agent failed, retry < 1 → PLANNING (retry)
  → agent failed, retry ≥ 1 → PAUSED

BUILDING
  → new ### Iteration in <slug>-Build-Log.md → AUDITING
  → agent failed, retry < 1 → BUILDING (retry)
  → agent failed, retry ≥ 1 → PAUSED

AUDITING
  → Grade A → DONE
  → Grade B/C/F → AWAITING_APPROVAL
  → agent failed, retry < 1 → AUDITING (retry)
  → agent failed, retry ≥ 1 → PAUSED

AWAITING_APPROVAL
  → Approve → BUILDING (revision — Plan.md unchanged)
  → Skip    → DONE
  → Abort   → IDLE

PAUSED
  → Retry → BUILDING
  → Abort → IDLE

DONE
  → new task submitted → PLANNING
```

**Design choice:** On B/C/F the plan is frozen — only Gemini rebuilds. The rationale is that Claude's plan is rarely the bug; when it is, the iteration limit will surface that and you can abort manually. Avoids a Claude re-planning loop.

---

## Warzone Pipeline

Use Warzone before starting a build to get a structured three-agent discussion. Output is `WarZone.md` with three sections per discussion. Approve, then reference it in a real Build task.

```
Submit idea via Argus UI (Warzone tab)
        ↓
Hermes — state: IDLE → DISCUSSING_CLAUDE
        ↓
First round on a fresh topic: Claude picks a slug and creates <slug>-WarZone.md.
Continuing round on the same topic: Claude appends to the existing <slug>-WarZone.md.
Claude appends: **Planner Status:** DONE
        ↓
watcher.js detects marker → publishes discuss.claude_done { file: '<slug>-WarZone.md' }
Hermes — state: DISCUSSING_CLAUDE → DISCUSSING_GEMINI (slug captured on first round)
        ↓
Gemini appends its Build Approach to <slug>-WarZone.md
Gemini appends: **Builder Status:** DONE
        ↓
watcher.js detects marker → publishes discuss.gemini_done
Hermes — state: DISCUSSING_GEMINI → DISCUSSING_CODEX
        ↓
Codex appends its Audit to <slug>-WarZone.md
Codex appends: **Auditor Status:** READY TO BUILD
        ↓
watcher.js detects marker → publishes discuss.complete
Hermes — state: DISCUSSING_CODEX → AWAITING_DISCUSS_APPROVAL
        ↓
UI shows the latest discussion block + Approve / Discard / New Discussion

        Approve         → state returns to IDLE; slug persists; next submit
                          appends another round to the same <slug>-WarZone.md
        New Discussion  → archives <slug>-WarZone.md into
                          WarZone-History/<slug>/WarZone.md and clears the slug
```

### Warzone States

```
IDLE
  → DISCUSSING_CLAUDE → DISCUSSING_GEMINI → DISCUSSING_CODEX → AWAITING_DISCUSS_APPROVAL → IDLE
```

Claude goes first because framing the idea is a planning task. Gemini then proposes an approach against that frame. Codex audits both, which is its comparative strength.

---

## Files

| File | Owner | Ownership rule | Purpose |
|---|---|---|---|
| `<slug>-Plan.md` | Claude | one per task; slug picked by Claude (new) or fixed by UI (continue) | Implementation plan for current build task |
| `<slug>-Build-Log.md` | Gemini | append-only within the task | Iteration log — what was built, which files changed |
| `<slug>-Build-Feedback.md` | Codex | append-only within the task | Audit grades and findings per iteration |
| `<slug>/` | Gemini | created on first iteration; persists across continuations | Deliverable folder per project — all code Gemini writes lives here |
| `Build-History/<slug>/` | Hermes | created the moment a task completes or is aborted | Archive of past tasks' meta files (renamed to `Plan.md`/`Build-Log.md`/`Build-Feedback.md` inside). Deliverables stay in `<slug>/`. |
| `<slug>-WarZone.md` | all three | append-only within a topic; Claude picks the slug | Three-phase discussion log for one topic |
| `WarZone-History/<slug>/` | Hermes | created when user clicks **New Discussion** | Archive of past discussion topics |
| `hermes/core/agents.json` | — | static config | Agent command templates + completion signals |
| `hermes/.env` | — | static config | `WORK_DIR`, session IDs, ports |
| `hermes/hermes.db` | — | SQLite | Event stream + task history |

Agents are forbidden from writing to files they don't own. Role docs enforce this.

---

## Folder Structure

```
NK-Base/
├── argus-ui/                  React frontend (Vite, port 5173)
│
├── hermes/
│   ├── core/                  shared infrastructure
│   │   ├── agents.js          agent runner (buildCommand, runAgent)
│   │   ├── agents.json        agent configs (6 entries: builder, planner, codex_auditor + 3 discuss variants)
│   │   ├── archive.js         archiveLiveFiles (on task completion) + per-task + history list/read helpers + slug parsers
│   │   ├── auth.js            shared-secret auth + CORS
│   │   ├── db.js              SQLite (logEvent, createTask, completeTask, getHistory)
│   │   ├── events.js          NATS pub/sub
│   │   └── watcher.js         file watcher (*-Plan.md, *-Build-Log.md, *-Build-Feedback.md, *-WarZone.md)
│   │
│   ├── workflows/
│   │   ├── build.js           XState — build pipeline
│   │   └── warzone.js         XState — warzone discussion
│   │
│   ├── servers/
│   │   ├── build.js           POST /task, /approval, /stop  GET /state, /history
│   │   ├── chat.js            POST /chat
│   │   └── warzone.js         POST /discuss, /discuss/approval, /stop  GET /state
│   │
│   ├── hermes.db              SQLite
│   ├── .env                   environment config
│   └── HERMES.md              engine reference
│
├── .claude/CLAUDE.md          Planner role spec
├── .gemini/GEMINI.md          Builder role spec
├── .codex/CODEX.md            Auditor role spec
│
├── .archive/                  retired files from pre-three-agent era
│
├── <slug>/                    deliverable folder per project (Gemini's HTML/CSS/JS/code)
├── <slug>-Plan.md             created at runtime (Claude; slug picked by Claude or fixed by UI)
├── <slug>-Build-Log.md        created at runtime (Gemini)
├── <slug>-Build-Feedback.md   created at runtime (Codex)
├── <slug>-WarZone.md          created at runtime (all three; one per discussion topic)
├── Build-History/<slug>/      archive of past build tasks' meta files (Hermes moves them here on task completion: grade A, skip, or abort)
└── WarZone-History/<slug>/    archive of past discussions (Hermes moves files here on New Discussion)
```

---

## NATS Topics

| Topic | Published by | Consumed by |
|---|---|---|
| `agent.output` | agents.js (stdout/stderr) | build server + warzone server → UI |
| `chat.output` | agents.js (chat mode) | chat server → UI |
| `agent.started` | agents.js | build server → UI |
| `plan.completed` | watcher.js (`*-Plan.md`) | build workflow (extracts slug from filename) |
| `agent.completed` | watcher.js (`*-Build-Log.md`) | build workflow |
| `grade.received` | watcher.js (`*-Build-Feedback.md`) | build workflow |
| `discuss.claude_done` | watcher.js (`*-WarZone.md`) | warzone workflow (extracts slug from filename) |
| `discuss.gemini_done` | watcher.js (`*-WarZone.md`) | warzone workflow |
| `discuss.complete` | watcher.js (`*-WarZone.md`) | warzone workflow |

---

## How to Start

```bash
# From NK-Base root — starts NATS + all 3 Hermes servers + Argus UI
npm run dev

# Or run components individually (requires nats-server already running)
npm run dev:chat        # chat server (port 3001)
npm run dev:build       # build server (port 3002)
npm run dev:warzone     # warzone server (port 3003)
npm run dev:ui          # Argus UI (port 5173)
```

---

## Agent Invocation

No session UUIDs, no `--resume`. Every call is a fresh one-shot CLI spawn. Context for each invocation comes from three places, not from vendor-side session memory:

- **Prompt text** — the workflow bakes the task description, continuation context, and role-doc reminders into `{task}`.
- **Role doc on disk** — `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.codex/CODEX.md` inside `WORK_DIR` (or `CHAT_DIR` for chat Gemini). Each CLI loads this from cwd on spawn.
- **Files on disk** — plan, build log, and audit files are read by the agent with its Read tool.

**CHAT_DIR still exists** — not for session isolation, but for role-doc isolation. Chat Gemini spawns with `cwd=CHAT_DIR` so it loads a chat-specific `GEMINI.md` telling it not to write to `Build-Log.md`.

**Auth refresh.** If a CLI's auth expires, re-authenticate that CLI directly (`claude`, `gemini`, or `codex` from your shell). Argus picks up the refreshed auth on the next spawn — no `.env` change, no restart.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| NATS connection refused | `nats-server` not running (happens only with individual `npm run dev:*` scripts) | Use `npm run dev` which auto-starts NATS, or start it manually first |
| Build stuck at PLANNING | Claude didn't write a `<slug>-Plan.md` ending with `**Plan Status:** READY` (common: forgot the slug prefix or the READY marker) | Check build server stdout, re-run |
| Build stuck at BUILDING | Gemini didn't append a new `### Iteration` to `<slug>-Build-Log.md` | Check build server stdout |
| Build stuck at AUDITING | Codex didn't write `**Audit Grade:** [ABCF]` to `<slug>-Build-Feedback.md` | Check build server stdout |
| Warzone stuck at a phase | Missing status marker in the current `<slug>-WarZone.md` for that phase | Check marker format against watcher patterns |
| CLI auth error on agent spawn | Vendor auth expired | Re-authenticate the CLI directly (`claude`, `gemini`, or `codex` from your shell). Argus picks up the refresh on next invocation. |
| Gemini writes to a `*-Build-Log.md` during chat | `CHAT_DIR` is a directory with `.gemini/` containing the build role doc | Point `CHAT_DIR` at `/tmp/argus-chat` (its own isolated `.gemini/GEMINI.md` gets written on boot) |
| Grade never detected | `<slug>-Build-Feedback.md` pattern mismatch | Verify exact string `**Audit Grade:** A` (case-sensitive) |
