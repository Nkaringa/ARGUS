# Argus UI

The React control-panel for Argus. Talks to Hermes (the backend engine) over WebSockets for live state and HTTP for actions. Sections: **Chat** (Gemini / Claude / Codex, with per-message timestamps + hover-copy + clear-thread), **Build** (pipeline + workspace modes — toggle in the top-controls row), **Warzone**, **Logs** (paginated `/history` with filter chips + click-to-expand task detail), **Archive** (master-detail viewer for past `Build-History/` and `WarZone-History/` artifacts). Light theme available via the sidebar's `☾ DARK` / `☀ LIGHT` toggle.

---

## Stack

- React 19 + TypeScript
- Vite 8 (dev server + build)
- TailwindCSS 4 + custom `:root` CSS variables (no `@theme` directive)
- `react-markdown` + `remark-gfm` (agent message rendering in Chat + Warzone)
- Native WebSocket (no socket.io)

---

## Getting Started

`argus-ui` is a workspace of the root `argus` package. For first-time setup (prerequisites, project folder, CLI auth, etc.) see [../SETUP.md](../SETUP.md). Quick commands once you're set up — **install from the repo root, not here**:

```bash
# From the repo root (one-time)
npm install

# Then — dev server on port 5173
npm run dev:ui
# or
cd argus-ui && npm run dev
```

Hermes must be running for the UI to do anything useful. From the repo root:

```bash
npm run dev         # starts NATS + all 3 Hermes servers + Argus UI
```

---

## Scripts

All scripts are runnable both from the repo root (`npm run <name>:ui`) and inside `argus-ui/` (`npm run <name>`):

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR on port 5173 |
| `npm run build` | `tsc -b` + Vite production build to `dist/` |
| `npm run lint` | ESLint over `src/` |
| `npm run preview` | Serve the production build locally |

---

## Project Layout

```
argus-ui/
├── src/
│   ├── App.tsx                      top-level section router
│   ├── main.tsx                     entry point
│   ├── config.ts                    server URLs + auth helpers
│   ├── index.css                    terminal palette tokens (`:root` + `[data-theme="light"]` CSS vars), base reset, scrollbar, shared keyframes
│   │
│   ├── types/index.ts               AgentKey, Section, BuildState, WarzoneState, OutputLine, …
│   │
│   ├── hooks/
│   │   ├── useBuildSocket.ts        build pipeline WS + action endpoints + projects list + stageStartedAt + sendPlanReview
│   │   ├── useWarzoneSocket.ts      warzone WS + action endpoints + newDiscussion + stageStartedAt
│   │   ├── useChatSocket.ts         chat WS + sendMessage + clearMessages (per-agent thread wipe)
│   │   ├── useHistory.ts            archive fetchers (Build-History + WarZone-History list/read)
│   │   └── useLogsHistory.ts        /logs page state — filter chips (search/state/grade), debounced search (250ms), paginated /history fetcher (load-more), out-of-order-response guard
│   │
│   └── components/
│       ├── Layout/
│       │   ├── Sidebar.tsx          left nav — `◉ ΛЯGUS` brand wordmark in head + `// chat / work / history` groups with agent-colored dots; ThemeToggle + refresh-auth in footer
│       │   ├── ThemeToggle.tsx      `☾ DARK` / `☀ LIGHT` switch — applies `data-theme="light"` to <html>, persists to localStorage
│       │   └── ResetSessionsModal.tsx  "Refresh Agent Auth" — documentation-only (CLI re-auth steps)
│       ├── shared/
│       │   ├── Panel.tsx            shared Panel + ActionButton (`headRight` accepts ReactNode for the chat clear-thread button)
│       │   └── markdownComponents.tsx  shared react-markdown styling (terminal aesthetic, theme-flippable)
│       ├── ChatView/                per-agent chat (rendered 3×); markdown-rendered agent messages, per-message timestamps, hover copy button, two-click clear-thread (red-fill confirm)
│       ├── BuildView/
│       │   ├── index.tsx            cockpit — TopControls (`▸ PIPELINE | ◧ WORKSPACE` toggle), HeroCard with nested HeroAuditPanel, agent-color-glow PipelineStrip, inline StopPipelineButton, ActionPanel (for awaiting_approval / paused / done / idle), PlanReviewPanel (for awaiting_plan_review), OutputStream, TaskInputPanel
│       │   ├── FileBrowser.tsx      WORK_DIR tree with filter input + sort modes (path / recent / size) + active-build pin
│       │   ├── InlinePreview.tsx    workspace-mode preview pane: path breadcrumb + `[⎘ COPY PATH] [⎘ COPY CONTENTS]` + metadata strip (size · lines · modified-ago · agent) + line-numbered body
│       │   └── FilePreview.tsx      legacy modal viewer (no live consumer in current UI; flagged for removal)
│       ├── WarzoneView/
│       │   ├── index.tsx            top-row 1fr/1fr (IdeaInputPanel + HeroCard), agent-color-glow PipelineStrip, lime ↻ NEW DISCUSSION button in hero
│       │   └── DiscussionReview.tsx per-agent column with agent-color halo (box-shadow) on active column; done columns get accent-tint-soft bg
│       ├── LogsView/                paginated task history — 7-column table (id · when · wall · task · iter · state · grade), filter chips, click-to-expand RowDetail backed by `/tasks/:id/detail`, load-more (20 per click)
│       └── HistoryView/             slim archive viewer — master-detail (rail with filter + entry list, right pane with MetadataStrip + TabStrip + ContentBody); agent identity inferred from file presence, no DB join
│
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.*.json
└── package.json
```

---

## Section Map

| Section | Component | Backend |
|---|---|---|
| `chat-gemini` | `ChatView` (agent=builder) | chat :3001 |
| `chat-claude` | `ChatView` (agent=planner) | chat :3001 |
| `chat-codex` | `ChatView` (agent=codex_auditor) | chat :3001 |
| `build` | `BuildView` | build :3002 (`POST /task`, `POST /approval`, `GET /projects`, `GET /files`) |
| `warzone` | `WarzoneView` | warzone :3003 (`POST /discuss`, `POST /discuss/approval`, `POST /warzone/new-discussion`) |
| `logs` | `LogsView` | build :3002 (`GET /history?limit=&offset=&search=&status=&grade=` returning `{items, total}`, plus `GET /tasks/:id/detail` per row) |
| `archive` | `HistoryView` | build :3002 + warzone :3003 (`GET /history/builds`, `GET /history/discussions`, plus per-slug detail endpoints) |

---

## Build State (UI side)

The `BuildView` progress strip has 5 segments mirroring the backend state machine. Active step gets an **agent-color glow** (claude orange / gemini blue / codex purple / "you" warn-red / hermes lime), done steps get a sunken `accent-tint-soft` background with a ✓, queued steps get dashed borders.

```
Plan → Build → Audit → Review → Done
```

- `planning` → PLAN segment active (orange glow)
- `awaiting_plan_review` → opt-in (`planReview: true` on submit). PlanReviewPanel renders alongside the strip with `Approve Plan` / `Request Plan Changes (with feedback)` buttons. Both actions go through `useBuildSocket.sendPlanReview(action, feedback?)`, which POSTs to `/approval` with the matching action type.
- `building` → BUILD segment active (blue glow); inline `<agent> is working` block in the hero shows pulse-dot + 28px "Gemini is working" + 36px elapsed counter in `var(--warn)`
- `auditing` → AUDIT segment active (purple glow)
- `awaiting_approval` → REVIEW segment active. HeroAuditPanel (nested in hero, 56px grade) shows the audit. ActionPanel renders the manual buttons. **When `autoApprove: true` and iter < cap**, the backend short-circuits this state automatically (no UI click needed) — UI sees a transient awaiting_approval flash before the next BUILDING. Cap default 10, max 20.
- `paused` → after an agent fails twice or the auto-approve cap is hit; BUILD segment kept active, retry / abort controls shown
- `done` → all segments filled

The Build view has two display modes toggled by `[▸ PIPELINE | ◧ WORKSPACE]` in the top-controls row: **pipeline** is the full cockpit (default); **workspace** replaces the body with a 340px FileBrowser + InlinePreview split pane so the user can watch files land as they're written. The pipeline strip is rendered in *both* modes (shared component, no per-mode variant).

## Build Project Selector

The TaskInputPanel has a single row of controls (relocated from a multi-row layout in the v1.0 UI): **Project** dropdown + **Auto-Approve** toggle (with a numeric cap input adjacent) + **Review-Plan** toggle. The toggles use a custom `TogglePill` that matches the terminal aesthetic (replaces native checkboxes).

- **Project: New** (default) — Claude picks the slug, Gemini creates `WORK_DIR/<slug>/` for deliverables.
- **Project: Continue: \<slug\>** — populated from `GET /projects` (lists `<slug>/` folders in WORK_DIR, excluding system folders). The selected slug is pinned through the pipeline so continuations always write to the same folder.
- **Auto-Approve** — when on, B/C/F audit grades auto-progress to BUILDING within the configured cap (default 10, max 20). Cap-hit pauses the pipeline.
- **Review-Plan** — when on, after Claude writes Plan.md the pipeline pauses at `awaiting_plan_review` so you can read the plan and either approve or send feedback that re-invokes Claude.

The Project list refreshes on tab focus and after every transition to `idle`/`done`.

## Warzone State (UI side)

`WarzoneView` follows the same hero+pipeline language as BuildView. Top row is 1fr/1fr — IdeaInputPanel on the left, HeroCard on the right. The hero shows the slug, the idea, an inline `<agent> is debating` block (pulse-dot + agent-color headline), the state tag with `started Xm Ys ago`, and a lime-fill **`↻ NEW DISCUSSION`** button at bottom-right (mirrors the lime send button visually so users know it's clickable).

The 4-segment progress strip uses the same agent-color-glow language as BuildView:

```
Claude → Gemini → Codex → Review
```

During the three busy phases (`discussing_claude` / `discussing_gemini` / `discussing_codex`), raw agent stdout streams in a live log panel for progress. On transition to `awaiting_discuss_approval`, the panel is **replaced** with `DiscussionReview` — three side-by-side columns (Claude | Gemini | Codex). The active column gets an agent-color **halo** (`box-shadow: 0 0 18px -2px <agent-color>`); done columns get an `accent-tint-soft` background. Columns are capped at `65vh` with internal scroll so the page itself doesn't grow. Status markers (`**Planner Status:** DONE`, etc.) are stripped from the human view — they're for the watcher only.

---

## Archive (HistoryView)

Master-detail viewer for `Build-History/<slug>/` and `WarZone-History/<slug>/`. Slim version — no DB join, agent identity inferred entirely from file presence. **Architectural call:** /logs is the task-lifecycle view (DB-driven); /archive is the file-contents view (folder-driven). Forcing a join would couple the two so a tasks-row cleanup could break the archive. Slim version keeps them independent.

- **Left rail** (300px): brand-style head + filter bar (search + builds/discussions segmented toggle + clear button) + entry list with `slug + age` (`12m ago` / `3h ago` / `Apr 30`).
- **Right pane**:
  - `MetadataStrip` — breadcrumb + slug pill + agent identity chips inferred from file presence (Plan.md non-empty ⇒ claude chip; Build-Log.md ⇒ gemini; Build-Feedback.md ⇒ codex; discussions show all three since WarZone.md is a 3-way debate).
  - `TabStrip` — for builds: `Plan.md` / `Build-Log.md` / `Build-Feedback.md` as tabs (one open at a time, lime underline + accent on active, sizes shown next to label, empty files marked `not present` and disabled). For discussions: a single `WarZone.md` tab.
  - `ContentBody` — markdown rendered, full-height scroll.

Defaults: `builds` segment, `plan` tab on each new selection. Filter state in component (reset on remount). Slug params are validated server-side against `^[a-zA-Z0-9_-]+$` to prevent path traversal.

---

## Configuration

`src/config.ts` exposes server URLs and auth helpers. Defaults work for local development with no env vars set.

| Var | Default | Purpose |
|---|---|---|
| `VITE_HOST` | `localhost` | Hermes host (shared by all three servers unless a per-server `*_HOST` is set) |
| `VITE_CHAT_PORT` | `3001` | Chat server port |
| `VITE_BUILD_PORT` | `3002` | Build server port |
| `VITE_WARZONE_PORT` | `3003` | Warzone server port |
| `VITE_CHAT_HOST` | `${VITE_HOST}:${VITE_CHAT_PORT}` | Production override for chat server — full host (e.g. Cloudflare tunnel subdomain, no port suffix) |
| `VITE_BUILD_HOST` | `${VITE_HOST}:${VITE_BUILD_PORT}` | Production override for build server |
| `VITE_WARZONE_HOST` | `${VITE_HOST}:${VITE_WARZONE_PORT}` | Production override for warzone server |
| `VITE_API_KEY` | *(empty)* | If set, sent as `X-Api-Key` on HTTP and `?key=` on WS. Must match `API_KEY` in `hermes/.env`. Leave empty for local dev (no auth). |

Copy [`.env.local.example`](.env.local.example) to `argus-ui/.env.local` and uncomment any values you want to override. Protocol (`http` / `https` / `ws` / `wss`) is auto-selected from `window.location.protocol`.

---

## Design System

The dashboard uses a dark terminal aesthetic — near-black canvas (`--bg #0c0c0d`), acid-lime accent (`--accent #c4ff3d`), JetBrains Mono for body / labels / logs, Space Grotesk for display headings, zero border-radius, 1px rules throughout.

**Brand.** The Sidebar head wordmark is rendered as `◉ ΛЯGUS` (blinking lime dot + Greek Λ for A + Cyrillic Я for R) — a visual treatment specific to the dashboard. The product name remains "Argus" everywhere else (docs, metadata, search). The wordmark carries `aria-label="argus"` so assistive tech reads the plain English name.

**Theme.** Two themes live in `src/index.css` — the default dark terminal palette under `:root`, and a pure-white office palette under `[data-theme="light"]` toggled via `Layout/ThemeToggle.tsx` (localStorage-persisted as `argus-theme`). Theme-flippable derived tokens (`--scanline`, `--accent-tint`, `--accent-tint-soft`, `--accent-hover`) shift polarity between themes. Light mode shifts `--accent` to a deep-olive `#5e7a00` so the lime brand still carries on white. Body uses `var(--scanline)` for the faint repeating-linear-gradient scanline effect — flips between faint white on dark and faint black on light at 0.012 opacity.

Per-agent color coding for at-a-glance scanning:

| Agent | Color | Var |
|---|---|---|
| Claude | orange `#d97757` | `--claude` |
| Gemini | blue `#5b9cff` | `--gemini` |
| Codex | purple `#b084ff` | `--codex` |

All tokens live in `src/index.css` under `:root` — layout var `--sidebar-width`, palette, per-agent colors, fonts, theme-flippable tokens listed above, and shared keyframes (`blink`, `pulse`, `caret`).

---

## Extending

- **Add a new agent** — extend `AgentKey` in `src/types/index.ts`, add a state setter in `useChatSocket.ts`, add a section and `ChatView` render branch in `App.tsx`, add a `SubNavItem` in `Sidebar.tsx`.
- **Add a new build state** — extend `BuildState` in `src/types/index.ts`, add a label entry in `BuildView/index.tsx`, update the `stateOrder` array and `PipelineStrip` steps. If the new state needs a dedicated panel (like `PlanReviewPanel` for `awaiting_plan_review`), add a render branch in `BuildView` keyed off `state ===`.
- **Add a new action button** — add a handler in the relevant socket hook, pass it into the view as a prop, wire to the matching backend endpoint. For approval-style actions, route through `POST /approval` with a new action type rather than a new endpoint (matches the existing `approve_plan` / `request_plan_changes` / `approve` / `skip` / `retry` / `abort` family).

---

## See Also

- [../README.md](../README.md) — top-level project overview, architecture, file signals, safety model
- [../CHANGELOG.md](../CHANGELOG.md) — version history
- [../SETUP.md](../SETUP.md) — install, configure, run, troubleshoot
- [../workflow.md](../workflow.md) — end-to-end pipeline walkthrough
- [../hermes/HERMES.md](../hermes/HERMES.md) — engine reference
