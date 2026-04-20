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

`argus-ui` is a workspace of the root `argus` package. For first-time setup (prerequisites, project folder, session seeding, etc.) see [../SETUP.md](../SETUP.md). Quick commands once you're set up — **install from the repo root, not here**:

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
│   ├── index.css                    BMW @theme tokens, base reset, scrollbar
│   │
│   ├── types/index.ts               AgentKey, Section, BuildState, WarzoneState, OutputLine, …
│   │
│   ├── hooks/
│   │   ├── useBuildSocket.ts        build pipeline WS + action endpoints + projects list
│   │   ├── useWarzoneSocket.ts      warzone WS + action endpoints + newDiscussion
│   │   ├── useChatSocket.ts         chat WS + sendMessage (three agents)
│   │   └── useHistory.ts            archive list/read fetchers (no WS)
│   │
│   └── components/
│       ├── Layout/
│       │   ├── Sidebar.tsx          left nav — BMW dark strip
│       │   └── ResetSessionsModal.tsx  documentation-only rotation guide
│       ├── shared/
│       │   └── markdownComponents.tsx  shared react-markdown styling (BMW aesthetic)
│       ├── ChatView/                per-agent chat (rendered 3×, one per agent)
│       ├── BuildView/               build pipeline UI — 5-step progress, approval, grade hero, project selector
│       ├── WarzoneView/
│       │   ├── index.tsx            3-phase progress, raw log panel while busy, New Discussion button
│       │   └── DiscussionReview.tsx pretty-printed markdown review once complete
│       ├── LogsView/                task history from SQLite (DB-driven)
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
- `awaiting_approval` → REVIEW segment active, approval panel shown with grade letter rendered as a 60px hero
- `done` → all segments filled

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

During the three busy phases (`discussing_claude` / `discussing_gemini` / `discussing_codex`), raw agent stdout streams in a dark log panel for live progress. On transition to `awaiting_discuss_approval`, the panel is **replaced** with `DiscussionReview` — which fetches `GET /warzone.md` and renders each agent's contribution as pretty-printed markdown (weight 900 uppercase labels, BMW Blue role tags, hairline-separated sections). The status markers (`**Planner Status:** DONE`, etc.) are stripped from the human view — they're for the watcher only.

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

The dashboard uses a BMW-literal design language (white canvas, BMW Blue `#1c69d4` accent, Helvetica stack, zero border-radius, weight extremes 300/400/700/900). Dark strips (`#262626`) survive only in the sidebar, the log output panel, and the Warzone discussion panel during busy phases.

This is intentionally **different** from the landing site (which lives in its own repository and uses a terminal-native dark + lime palette). The dashboard is the tool; the landing is the marketing voice.

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
