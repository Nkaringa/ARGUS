# Argus

**Argus** is a three-agent orchestration platform for software engineering. It coordinates **Claude** (planner), **Gemini** (builder), and **Codex** (auditor) through structured state machines with real-time visibility. The engine that drives it is called **Hermes**.

The goal: turn raw LLM outputs into production-ready code by enforcing a planning step, a building step, and an independent audit — with a human review loop when the audit isn't clean.

![Argus three-agent orchestration architecture](Images/architecture.webp)

> **→ Ready to install? See [SETUP.md](SETUP.md).**

---

## Why Argus

Each LLM is strong at something different. Rather than pick one and live with its weaknesses, Argus runs a pipeline where each agent does what it's best at:

- **Claude plans** — picks a kebab-case slug for the task (e.g. `landing-page`) and turns the task into a concrete `<slug>-Plan.md` (files to touch, approach, gotchas, verification).
- **Gemini builds** — implements the plan across the workspace, logging each iteration to `<slug>-Build-Log.md`.
- **Codex audits** — reviews the implementation against the plan, grades it A / B / C / F in `<slug>-Build-Feedback.md`, and lists specific revision instructions on anything less than A.

On a non-A grade, you approve in the UI and Gemini revises from the same plan using Codex's feedback. Plans are frozen across iterations — revisions are implementation fixes, not plan rewrites. When Codex gives an A, the task is done. When you submit the next task, the previous task's three files move into `Build-History/<slug>/` so the live workspace always holds exactly one task.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Argus UI (port 5173)                     │
│            React 19 · Vite 8 · TailwindCSS 4                │
└────────────┬────────────────────────────────────────────────┘
             │ WebSocket + HTTP
┌────────────┴────────────────────────────────────────────────┐
│                   Hermes Engine (Node.js 20)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ chat :3001   │  │ build :3002  │  │ warzone :3003    │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                   │             │
│  ┌──────┴─────────────────┴───────────────────┴─────────┐   │
│  │  XState v5 · NATS pub/sub · SQLite · chokidar        │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ spawn: `<cli> --resume <UUID> ...`
     ┌────────────────────┼────────────────────┐
     │                    │                    │
┌────┴─────┐        ┌─────┴─────┐        ┌─────┴────┐
│  Claude  │        │  Gemini   │        │  Codex   │
│ Planner  │        │  Builder  │        │ Auditor  │
└──────────┘        └───────────┘        └──────────┘
```

See the full diagram at the top of this README, and [workflow.md](workflow.md) for the state machines in detail.

---

## Repository Layout

```
argus/
├── Images/
│   └── architecture.webp     Diagram used in this README
│
├── argus-ui/                  React 19 + Vite + TailwindCSS 4
│   ├── src/
│   │   ├── components/        Build / Warzone / Chat / Logs views
│   │   ├── hooks/             WebSocket hooks per server
│   │   └── ...
│   └── README.md              UI-specific docs
│
├── hermes/                    Node.js orchestration engine
│   ├── core/                  NATS, agents, SQLite, file watcher, role-doc bootstrap
│   ├── workflows/             XState machines (build, warzone)
│   ├── servers/               Express + WebSocket servers (chat/build/warzone)
│   ├── .env.example           Template — copy to hermes/.env and seed UUIDs
│   └── HERMES.md              Engine reference
│
├── .claude/CLAUDE.md          Planner role specification
├── .gemini/GEMINI.md          Builder role specification
├── .codex/CODEX.md            Auditor role specification
│
├── package.json               Root — workspaces + dev script
├── README.md                  This file
├── SETUP.md                   Install & run guide
└── workflow.md                End-to-end pipeline walkthrough
```

---

## Three-Agent Pipeline

### Build flow

```
idle → planning → building → auditing → awaiting_approval → (loop | done)
      (Claude)   (Gemini)   (Codex)
```

| Stage | Agent | Output |
|---|---|---|
| `planning` | Claude | `<slug>-Plan.md` (slug chosen by Claude on a new project, or fixed by the UI on a continuation) |
| `building` | Gemini | `<slug>-Build-Log.md` (append-only within the task) + deliverables under `<slug>/` |
| `auditing` | Codex | `<slug>-Build-Feedback.md` (grade A/B/C/F per audit) |

On **grade A** the task is marked done. On **B/C/F** the user approves in the UI and Gemini rebuilds from the same `<slug>-Plan.md` using Codex's feedback. Retry depth is capped — on repeated failure the pipeline pauses for human review. As soon as the task completes (grade A, skip, or abort), the three meta files move into `Build-History/<slug>/{Plan.md, Build-Log.md, Build-Feedback.md}` (slug prefix dropped). The `<slug>/` deliverable folder stays in place — re-select it from the Build tab's "Project" dropdown to continue iterating on the same project.

### Warzone flow (pre-build discussion)

```
idle → discussing_claude → discussing_gemini → discussing_codex → awaiting_approval
```

All three agents append to `<slug>-WarZone.md` in order — Claude picks the slug on the first round, then frames the idea; Gemini proposes a build approach; Codex audits both takes. When done, the UI renders each agent's contribution as pretty-printed markdown for human review. After approval, submit again to add another round on the same topic. Click **New Discussion** in the Warzone header to archive the file into `WarZone-History/<slug>/WarZone.md` and start a fresh topic.

### Chat

Three tabs: Gemini, Claude, Codex. Each speaks to its own persistent session. No pipeline, no file logging — direct conversation.

---

## File Signals

Hermes uses file writes as state-transition signals. A chokidar watcher publishes NATS events when specific patterns appear.

| File | Owner | Signal pattern | NATS event |
|---|---|---|---|
| `<slug>-Plan.md` | Claude | `**Plan Status:** READY` | `plan.completed` |
| `<slug>-Build-Log.md` | Gemini | new `### Iteration N` entry | `agent.completed` |
| `<slug>-Build-Feedback.md` | Codex | `**Audit Grade:** [ABCF]` | `grade.received` |
| `<slug>/` | Gemini | (not watched) | — deliverable folder per project |
| `<slug>-WarZone.md` | All three | `**Planner Status:** DONE` → `**Builder Status:** DONE` → `**Auditor Status:** READY TO BUILD` | `discuss.claude_done` → `discuss.gemini_done` → `discuss.complete` |

The watcher uses globs (`*-Plan.md`, `*-Build-Log.md`, `*-Build-Feedback.md`) at the project root — deliverable subfolders, `Build-History/`, and `WarZone-History/` are not watched. Each task's three meta files move into `Build-History/<slug>/` the moment the task completes (or is aborted); `submitTask` re-runs the same archival as a safety net to catch any stale files left behind by a crash. Deliverables stay in their `<slug>/` folder; the user can iterate on them by selecting **Continue: \<slug\>** in the Build tab.

---

## Safety Model

- Agents are scoped to `WORK_DIR` and run with standard user permissions.
- Each role doc (`.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.codex/CODEX.md`) restricts file ownership — Gemini cannot write to `Plan.md`, Codex cannot write to `Build-Log.md`, etc.
- `hermes/`, `argus-ui/`, and any directory outside `WORK_DIR` are off-limits to all agents — only the human edits the engine and dashboard.
- Retry depth is capped (1 retry per state transition) to prevent runaway loops. On repeated failure the pipeline transitions to `paused` for human review.
- Every NATS event is persisted to `hermes/hermes.db` for post-hoc debugging.

---

## Docs

- **[SETUP.md](SETUP.md)** — install, configure, run, troubleshoot
- **[workflow.md](workflow.md)** — full end-to-end pipeline walkthrough, state tables, file signal table
- **[hermes/HERMES.md](hermes/HERMES.md)** — engine reference (folder structure, `.env` fields, `agents.json` config, Codex CLI quirks, session-management matrix)
- **[argus-ui/README.md](argus-ui/README.md)** — UI stack, scripts, section map, extension guide
- **[.claude/CLAUDE.md](.claude/CLAUDE.md)** / **[.gemini/GEMINI.md](.gemini/GEMINI.md)** / **[.codex/CODEX.md](.codex/CODEX.md)** — role specifications each agent is prompted with

---

## License

Proprietary — Karinga.dev. All rights reserved.
