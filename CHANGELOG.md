# Changelog

All notable changes to Argus are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Argus uses product versioning — major/minor/patch bumps reflect user-facing scope, not library API contracts.


---

## [1.0.0] — 2026-04-23

First named release. Baseline for all future entries.

### Pipeline
- Three-agent build pipeline: Claude plans, Gemini builds, Codex audits, orchestrated by the Hermes engine.
- Two workflows: **Build** (plan → build → audit → approve) and **Warzone** (three-agent debate before build).
- File-signal handoffs at each state transition (`**Plan Status:** READY`, new `### Iteration` entry, `**Audit Grade:** <letter>`).
- XState state machines for both workflows, with paused-state recovery on repeated agent failure.
- `Build-History/` and `WarZone-History/` archive every completed task's meta files and deliverables.
- Continuation flow — reuse a slug to iterate on an existing project without fragmenting its history.

### Role docs (v1)
- Specs shipped to `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.codex/CODEX.md`, auto-copied into each `WORK_DIR` on first boot.
- **Planner (Claude)** writes `Plan.md` with Architecture (stack, directory structure, cross-cutting concerns), Approach, Gotchas, and Acceptance Criteria sections.
- **Builder (Gemini)** logs every iteration with decision notes and labeled deviations from the plan.
- **Auditor (Codex)** performs a two-purpose audit — Plan Compliance (Architecture + Acceptance Criteria + Files/Gotchas) and Independent Defect Detection across five categories (Security / Correctness / Resource / Interaction / Maintainability).
- Grades: A (production-ready, no Critical findings), B (one revision away), C (significant rework), F (cannot audit). Critical severity blocks A; Major/Minor do not.

### UI (Argus UI)
- React 19 + Vite 8 + TypeScript + Tailwind v4 stack.
- Dark terminal aesthetic — JetBrains Mono + Space Grotesk, acid-lime accent (`#c4ff3d`), per-agent color coding (Claude orange, Gemini blue, Codex purple).
- **Chat** — three tabs (Gemini / Claude / Codex), one-shot per message, agent replies rendered as markdown.
- **Build** — cockpit with Hero, pipeline strip, active-stage monitor, output stream, task queue, last audit, task meta. `[▸ pipeline | ◧ workspace]` toggle — workspace mode shows a live file tree + inline preview of the work directory.
- **Warzone** — 3-column discussion view (Claude | Gemini | Codex) with per-agent color borders on active columns.
- **Logs** — dense CSS-grid terminal table (id · when · task · iter · state · grade).
- **Archive** — read-only viewer for Build-History and WarZone-History artifacts.
- Live state + streaming output via WebSocket; reconnect with exponential backoff.

### Engine (Hermes)
- Node.js + Express + native WebSocket + better-sqlite3.
- NATS pub/sub across three servers (chat :3001, build :3002, warzone :3003); `nats-server` auto-starts with `npm run dev`.
- SQLite (`hermes/hermes.db`) with WAL mode, `tasks` table, `events` table indexed on `task_id` / `ts` / `topic`.
- Chokidar file watcher with `fs.realpathSync(WORK_DIR)` at module load for macOS case-sensitivity safety; system folders (`node_modules`, `.git`, `.next`, etc.) excluded from watching.
- File browser endpoints — `GET /files` (tree, depth-capped), `GET /files/content` (500KB cap, binary detection, path-safety within `WORK_DIR`).
- Shared-secret auth + CORS for all three HTTP servers.
- One-shot CLI invocation model — every agent call spawns a fresh `claude` / `gemini` / `codex` process. No session state to manage.

### Infrastructure
- npm workspaces — root `argus` package, `hermes` + `argus-ui` as workspaces, single `package-lock.json` at repo root.
- `npm run dev` from the repo root starts NATS + all three servers + Vite dev server.

### Docs
- User-facing: [`README.md`](README.md), [`SETUP.md`](SETUP.md), [`workflow.md`](workflow.md), [`hermes/HERMES.md`](hermes/HERMES.md), [`argus-ui/README.md`](argus-ui/README.md), [`deployment.md`](deployment.md).
- Role specs: [`.claude/CLAUDE.md`](.claude/CLAUDE.md), [`.gemini/GEMINI.md`](.gemini/GEMINI.md), [`.codex/CODEX.md`](.codex/CODEX.md).
