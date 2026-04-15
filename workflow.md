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

| Agent | CLI | Role | Session strategy |
|---|---|---|---|
| Claude | `claude` | Planner · Discuss Planner | `claude --resume {CLAUDE_SESSION_ID}` |
| Gemini | `gemini` | Builder · Discuss Builder | `gemini --resume {GEMINI_SESSION_ID}` |
| Codex | `codex` | Auditor · Discuss Auditor | `codex exec resume {CODEX_SESSION_ID}` |

All three use the same pattern: the user seeds a UUID in `hermes/.env`, every invocation resumes that session. One session per agent spans chat, build, and warzone. Rotate by seeding a fresh UUID.

Each agent has a role spec in its dotfile: `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.codex/CODEX.md`.

---

## Build Pipeline

```
Submit task via Argus UI
        ↓
Hermes — state: IDLE → PLANNING
        ↓
Claude CLI runs (writes Plan.md, ends with **Plan Status:** READY)
        ↓
watcher.js detects Plan.md match
        ↓  publishes: plan.completed
Hermes — state: PLANNING → BUILDING
        ↓
Gemini CLI runs (reads Plan.md, implements, appends to Build-Log.md)
        ↓
watcher.js detects new ### Iteration in Build-Log.md
        ↓  publishes: agent.completed
Hermes — state: BUILDING → AUDITING
        ↓
Codex CLI runs (reads Plan.md + latest Build-Log iteration, grades)
        ↓
Codex appends **Audit Grade:** [ABCF] to Build-Feedback.md
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
        │   Revise → BUILDING (Gemini reads Build-Feedback.md,       │
        │            Plan.md UNCHANGED, Claude not re-invoked)       │
        │   Skip   → DONE                                            │
        │   Abort  → IDLE                                            │
        └────────────────────────────────────────────────────────────┘
```

### Build States

```
IDLE
  → task submitted → PLANNING

PLANNING
  → Plan.md has **Plan Status:** READY → BUILDING
  → agent failed, retry < 1 → PLANNING (retry)
  → agent failed, retry ≥ 1 → PAUSED

BUILDING
  → new ### Iteration in Build-Log.md → AUDITING
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
Claude appends its Planner take to WarZone.md
Claude appends: **Planner Status:** DONE
        ↓
watcher.js detects marker → publishes discuss.claude_done
Hermes — state: DISCUSSING_CLAUDE → DISCUSSING_GEMINI
        ↓
Gemini appends its Build Approach
Gemini appends: **Builder Status:** DONE
        ↓
watcher.js detects marker → publishes discuss.gemini_done
Hermes — state: DISCUSSING_GEMINI → DISCUSSING_CODEX
        ↓
Codex appends its Audit
Codex appends: **Auditor Status:** READY TO BUILD
        ↓
watcher.js detects marker → publishes discuss.complete
Hermes — state: DISCUSSING_CODEX → AWAITING_DISCUSS_APPROVAL
        ↓
UI shows full WarZone.md entry + Approve / Discard

        Approve → state returns to IDLE
                  (copy the entry's summary into a Build task)
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
| `Plan.md` | Claude | overwrite per task | Implementation plan for current build task |
| `Build-Log.md` | Gemini | append-only | Iteration log — what was built, which files changed |
| `Build-Feedback.md` | Codex | append-only | Audit grades and findings per iteration |
| `WarZone.md` | all three | append-only | Three-phase discussion log |
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
│   │   ├── auth.js            shared-secret auth + CORS
│   │   ├── db.js              SQLite (logEvent, createTask, completeTask, getHistory)
│   │   ├── events.js          NATS pub/sub
│   │   └── watcher.js         file watcher (Plan.md, Build-Log.md, Build-Feedback.md, WarZone.md)
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
├── Plan.md                    created at runtime (Claude)
├── Build-Log.md               created at runtime (Gemini)
├── Build-Feedback.md          created at runtime (Codex)
└── WarZone.md                 created at runtime (all three)
```

---

## NATS Topics

| Topic | Published by | Consumed by |
|---|---|---|
| `agent.output` | agents.js (stdout/stderr) | build server + warzone server → UI |
| `chat.output` | agents.js (chat mode) | chat server → UI |
| `agent.started` | agents.js | build server → UI |
| `plan.completed` | watcher.js (Plan.md) | build workflow |
| `agent.completed` | watcher.js (Build-Log.md) | build workflow |
| `grade.received` | watcher.js (Build-Feedback.md) | build workflow |
| `discuss.claude_done` | watcher.js (WarZone.md) | warzone workflow |
| `discuss.gemini_done` | watcher.js (WarZone.md) | warzone workflow |
| `discuss.complete` | watcher.js (WarZone.md) | warzone workflow |

---

## How to Start

```bash
# From NK-Base root — starts all 3 Hermes servers + Argus UI
nats-server &
npm run dev

# Or run components individually
npm run dev:chat        # chat server (port 3001)
npm run dev:build       # build server (port 3002)
npm run dev:warzone     # warzone server (port 3003)
npm run dev:ui          # Argus UI (port 5173)
```

---

## Session Management

All three agents use the same model: the user seeds a UUID in `hermes/.env`, and every invocation resumes that session. Hermes never creates sessions — it only reads and resumes.

| Agent | Strategy |
|---|---|
| Claude (all roles) | `claude --resume {CLAUDE_SESSION_ID}`. Refresh by running `claude` → `/exit` → copy UUID into `.env`. |
| Gemini (build/warzone) | `gemini --resume {GEMINI_SESSION_ID}`. Refresh by running `gemini` → `/exit` → copy the `To resume this session:` UUID into `.env`. |
| Gemini (chat) | Same session as build/warzone — `CHAT_DIR` only isolates the *cwd* so Gemini doesn't write to Build-Log.md during chat. |
| Codex (all roles) | `codex exec resume {CODEX_SESSION_ID} …`. The top-level `codex resume` is TTY-only and will not work. Refresh by running `codex exec …` and copying the printed UUID. |

**Rotating sessions.** When you start a task unrelated to prior work, seed fresh UUIDs for all three in `.env` and restart Hermes. There is no server-side session state — rotation is purely an `.env` edit + restart.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| NATS connection refused | `nats-server` not running | `nats-server &` |
| Build stuck at PLANNING | Claude didn't end Plan.md with `**Plan Status:** READY` | Check build server stdout, re-run |
| Build stuck at BUILDING | Gemini didn't append a new `### Iteration` to Build-Log.md | Check build server stdout |
| Build stuck at AUDITING | Codex didn't write `**Audit Grade:** [ABCF]` | Check build server stdout |
| Warzone stuck at a phase | Missing status marker in WarZone.md for that phase | Check marker format against watcher patterns |
| Claude chat session expired | Session UUID invalid | `claude` → `/exit` → update `CLAUDE_SESSION_ID` |
| Codex session invalid | Session UUID expired or from wrong machine | `codex exec …` → copy UUID from stdout → update `CODEX_SESSION_ID` |
| Gemini session invalid | `GEMINI_SESSION_ID` missing or expired | `gemini` → `/exit` → copy UUID from `To resume this session:` line → update `GEMINI_SESSION_ID` |
| Gemini writes to Build-Log.md during chat | `CHAT_DIR` is a directory with `.gemini/` | Point `CHAT_DIR` at `/tmp/argus-chat` |
| Grade never detected | `Build-Feedback.md` pattern mismatch | Verify exact string `**Audit Grade:** A` (case-sensitive) |
