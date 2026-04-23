# Argus UI

The React control-panel for Argus. Talks to Hermes (the backend engine) over WebSockets for live state and HTTP for actions. Sections: **Chat** (Gemini / Claude / Codex), **Build**, **Warzone**, **Logs** (DB-driven task list), **Archive** (read-only viewer for past `Build-History/` and `WarZone-History/` artifacts).

---

## Stack

- React 19 + TypeScript
- Vite 8 (dev server + build)
- TailwindCSS 4 (via `@theme` directive)
- `react-markdown` + `remark-gfm` (used in Warzone review)
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
│   ├── index.css                    terminal palette tokens (`:root` CSS vars), base reset, scrollbar, shared keyframes
│   │
│   ├── types/index.ts               AgentKey, Section, BuildState, WarzoneState, OutputLine, …
│   │
│   ├── hooks/
│   │   ├── useBuildSocket.ts        build pipeline WS + action endpoints + projects list + stageStartedAt
│   │   ├── useWarzoneSocket.ts      warzone WS + action endpoints + newDiscussion
│   │   ├── useChatSocket.ts         chat WS + sendMessage (three agents)
│   │   └── useHistory.ts            archive list/read fetchers (no WS)
│   │
│   └── components/
│       ├── Layout/
│       │   ├── StatusBar.tsx        fixed top bar — brand + scrolling ticker + quick nav + live pill
│       │   ├── Sidebar.tsx          left nav — state pill + `// chat / work / history` groups + agent-colored dots
│       │   └── ResetSessionsModal.tsx  "Refresh Agent Auth" — documentation-only (CLI re-auth steps)
│       ├── shared/
│       │   ├── Panel.tsx            shared Panel + ActionButton (supports `fill` for flex-column layouts)
│       │   └── markdownComponents.tsx  shared react-markdown styling (dark terminal aesthetic)
│       ├── ChatView/                per-agent chat (rendered 3×, one per agent); agent messages render via markdownComponents
│       ├── BuildView/
│       │   ├── index.tsx            cockpit — HeroCard + PipelineStrip + AgentMonitor + ActiveStage + OutputStream + TaskInput + LastAudit + TaskMeta; `[▸ pipeline | ◧ workspace]` toggle
│       │   ├── FileBrowser.tsx      WORK_DIR tree (polls `GET /files`); supports controlled-mode via `onFileSelect` + `externalSelectedFile`
│       │   ├── FilePreview.tsx      modal file-content viewer (used in pipeline mode via FileBrowser's uncontrolled path)
│       │   └── InlinePreview.tsx    non-modal file-content pane used in workspace mode
│       ├── WarzoneView/
│       │   ├── index.tsx            3-column discussion cockpit (Claude | Gemini | Codex), hero with New Discussion
│       │   └── DiscussionReview.tsx per-agent column border in agent color, capped at 65vh with internal scroll
│       ├── LogsView/                task history from SQLite — dense CSS-grid terminal table (id · when · task · iter · state · grade)
│       └── HistoryView/             read-only archive viewer (Build-History + WarZone-History)
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
| `build` | `BuildView` | build :3002 (`POST /task`, `GET /projects`) |
| `warzone` | `WarzoneView` | warzone :3003 (`POST /discuss`, `POST /warzone/new-discussion`) |
| `logs` | `LogsView` | build :3002 (DB history via WS broadcast) |
| `archive` | `HistoryView` | build :3002 + warzone :3003 (`GET /history/builds`, `GET /history/discussions`) |

---

## Build State (UI side)

The `BuildView` progress strip has 5 segments mirroring the backend state machine:

```
Plan → Build → Audit → Review → Done
```

- `planning` → PLAN segment active
- `building` → BUILD segment active
- `auditing` → AUDIT segment active
- `awaiting_approval` → REVIEW segment active, approval panel shown with grade letter rendered as an 84px hero
- `paused` → after an agent fails twice; BUILD segment kept active, retry / abort controls shown
- `done` → all segments filled

The Build view has two display modes toggled by `[▸ pipeline | ◧ workspace]` in the breadcrumbs: **pipeline** is the full cockpit (default); **workspace** replaces the body with a 320px file tree + inline preview split pane so the user can watch files land as they're written.

## Build Project Selector

Above the task input, the Build tab shows a "Project" dropdown:
- **New project** (default) — Claude picks the slug, Gemini creates `WORK_DIR/<slug>/` for deliverables.
- **Continue: \<slug\>** — populated from `GET /projects` (lists `<slug>/` folders in WORK_DIR, excluding system folders). Hermes pre-sets `currentSlug`; planner prompt instructs Claude to use it verbatim. Drift safeguard: if Claude writes a different slug, the workflow aborts with a logged warning.

The list refreshes on tab focus and after every transition to `idle`/`done`.

## Warzone State (UI side)

`WarzoneView` progress strip has 4 segments:

```
Claude → Gemini → Codex → Review
```

During the three busy phases (`discussing_claude` / `discussing_gemini` / `discussing_codex`), raw agent stdout streams in a live log panel for progress. On transition to `awaiting_discuss_approval`, the panel is **replaced** with `DiscussionReview` — three side-by-side columns (Claude | Gemini | Codex), each bordered in its agent color when active, rendering that agent's contribution as pretty-printed markdown. Columns are capped at `65vh` with internal scroll so the page itself doesn't grow. The status markers (`**Planner Status:** DONE`, etc.) are stripped from the human view — they're for the watcher only.

---

## Archive (HistoryView)

Read-only viewer for `Build-History/<slug>/` and `WarZone-History/<slug>/`. Two-pane layout: left rail lists archived builds + discussions (newest first by folder mtime); right pane renders the selected entry's markdown using the shared `markdownComponents`. No edit/delete/re-run — just browse what past tasks produced. Builds show three collapsible sections (Plan / Build-Log / Build-Feedback); discussions show the single WarZone.md.

The rail refreshes on mount and whenever the user revisits the tab. Slug params are validated server-side against `^[a-zA-Z0-9_-]+$` to prevent path traversal.

---

## Configuration

`src/config.ts` exposes server URLs and auth helpers. Defaults work for local development with no env vars set.

| Var | Default | Purpose |
|---|---|---|
| `VITE_HOST` | `localhost` | Hermes host |
| `VITE_CHAT_PORT` | `3001` | Chat server port |
| `VITE_BUILD_PORT` | `3002` | Build server port |
| `VITE_WARZONE_PORT` | `3003` | Warzone server port |
| `VITE_API_KEY` | *(empty)* | If set, sent as `X-Api-Key` on HTTP and `?key=` on WS. Leave empty for local dev (no auth). |

Set these in `argus-ui/.env.local` to override. Protocol (`http` / `https` / `ws` / `wss`) is auto-selected from `window.location.protocol`.

---

## Design System

The dashboard uses a dark terminal aesthetic — near-black canvas (`--bg #0c0c0d`), acid-lime accent (`--accent #c4ff3d`), JetBrains Mono for body / labels / logs, Space Grotesk for display headings, zero border-radius, 1px rules throughout. Drove by the HTML mockup at `landing/Mockup/argus-ui.html`.

Per-agent color coding for at-a-glance scanning:

| Agent | Color | Var |
|---|---|---|
| Claude | orange `#d97757` | `--claude` |
| Gemini | blue `#5b9cff` | `--gemini` |
| Codex | purple `#b084ff` | `--codex` |

All tokens live in `src/index.css` under `:root` — layout vars (`--sidebar-width`, `--statusbar-height`), palette, per-agent colors, fonts, and shared keyframes (`blink`, `pulse`, `ticker`, `caret`). The dashboard and the landing site now share the same terminal-native visual vocabulary.

---

## Extending

- **Add a new agent** — extend `AgentKey` in `src/types/index.ts`, add a state setter in `useChatSocket.ts`, add a section and `ChatView` render branch in `App.tsx`, add a `SubNavItem` in `Sidebar.tsx`.
- **Add a new build state** — extend `BuildState` in `src/types/index.ts`, add a `STATE_LABELS` entry in `BuildView`, update `stateOrder` array and `ProgressStrip` steps.
- **Add a new action button** — add a handler in the relevant socket hook, pass it into the view as a prop, wire to the matching backend endpoint.

---

## See Also

- [../README.md](../README.md) — top-level project overview, architecture, file signals, safety model
- [../SETUP.md](../SETUP.md) — install, configure, run, troubleshoot
- [../workflow.md](../workflow.md) — end-to-end pipeline walkthrough
- [../hermes/HERMES.md](../hermes/HERMES.md) — engine reference
