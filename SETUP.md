# Setup & Installation

This guide walks through installing Argus and running your first build. For background on what Argus is, what each agent does, and the architecture, see **[README.md](README.md)**.

---

## Prerequisites

- **Node.js ≥ 20** — check with `node --version`
- **Three agent CLIs**, each installed and authenticated with your own subscription:
  - `claude` — [Claude Code](https://docs.claude.com/claude-code)
  - `gemini` — [Gemini CLI](https://github.com/google-gemini/gemini-cli)
  - `codex` — [Codex CLI](https://github.com/openai/codex)

Argus never bundles or proxies the agents. You use your own accounts.

---

## Install

### 1. Clone and install dependencies

```bash
git clone <your-fork-url> argus
cd argus
npm install
```

A single `npm install` at the root installs everything. Argus uses npm workspaces — `hermes` and `argus-ui` are workspaces of the root package, and dependencies are hoisted into a single `node_modules/`.

### 2. Install `nats-server`

Argus uses [NATS](https://nats.io) as the pub/sub event bus between Hermes and the agents. It's a single binary — not an npm package — so it installs separately from step 1. You only do this once per machine.

| OS | Install command |
|---|---|
| macOS | `brew install nats-server` |
| Linux (Debian/Ubuntu) | Download binary from [nats.io/download](https://nats.io/download/) → drop in `/usr/local/bin` |
| Linux (via Go) | `go install github.com/nats-io/nats-server/v2@latest` |
| Windows | `scoop install nats-server` or `choco install nats-server` or binary from [nats.io/download](https://nats.io/download/) |
| Any OS (Docker) | `docker run -d -p 4222:4222 nats:latest` |

Verify with `nats-server --version`.

### 3. Create your project folder

Argus builds inside a **project folder** — not inside the argus clone itself. Create one as a subdirectory of the clone:

```bash
# From the argus clone root
mkdir Portfolio       # or any name you want — this is YOUR project
```

Your layout should now look like:

```
~/Desktop/Projects/argus/          ← the argus clone (the tool)
├── .claude/   .gemini/   .codex/   ← role docs agents read
├── hermes/                         ← engine (off limits to agents)
├── argus-ui/                       ← dashboard (off limits to agents)
└── Portfolio/                      ← YOUR project — WORK_DIR points here
```

**Why a subdirectory?** Agents spawn with their working directory set to `WORK_DIR`. If `WORK_DIR` is the argus clone root itself, agents see `argus-ui/` and `hermes/` as existing code and may build into them. Pointing `WORK_DIR` at a fresh empty subfolder means agents build inside that subfolder only — nothing else can accidentally get touched.

You can create additional project folders later (`argus/NextProject/`, `argus/Experiment/`, etc.) and switch `WORK_DIR` between them to work on different projects with the same argus install.

#### Alternative: project folder anywhere on your disk

If you'd rather keep your project completely separate from the argus clone (e.g. argus in `~/Desktop/argus/` and your project in `~/Documents/Portfolio/`), that's fully supported. Set `WORK_DIR` to wherever your project lives — Hermes will copy the three role-doc folders (`.claude/`, `.gemini/`, `.codex/`) into it on first boot if they're missing.

If you want to do the copy yourself ahead of time:

```bash
cd argus
cp -r .claude .gemini .codex /absolute/path/to/your-project/
```

Either way works. The subdirectory layout above is just the simplest default.

### 4. Configure `hermes/.env`

Copy the template:

```bash
cp hermes/.env.example hermes/.env
```

Required fields:

```env
WORK_DIR=/absolute/path/to/argus/Portfolio   # the subfolder you just created
CLAUDE_SESSION_ID=<uuid>
GEMINI_SESSION_ID=<uuid>
CODEX_SESSION_ID=<uuid>
```

Seed the four session UUIDs next, then come back and paste them in.

### 5. Seed the four session UUIDs

Each agent is always invoked with `--resume <UUID>`. Hermes **never creates a session on its own** — you seed each UUID manually. Sessions then persist across restarts and can be rotated when you want fresh context.

> **⚠ Important — where you seed from matters.** Each CLI stores its session data **relative to the directory you run it in**. When Hermes later spawns an agent, it spawns it with a specific cwd — so if you seed a UUID from a different folder, the agent will look for the session in the wrong store and come up empty (Gemini exits with code 42; Claude/Codex error out).
>
> **Three of the four agents are seeded from your `WORK_DIR`. Gemini chat is the exception — it's seeded from `CHAT_DIR`** (default `/tmp/argus-chat`) because Hermes spawns chat-mode Gemini there to keep its role doc isolated from the build pipeline. The seeding command for that one bakes in a `mkdir -p` so the directory exists.
>
> For the WORK_DIR commands below, **`$WORK_DIR` is a placeholder** — `.env` values aren't exported to your shell, so either replace it with the literal path (e.g. `cd /Users/you/Projects/argus/Portfolio`) or `export WORK_DIR=...` in your shell once before running the commands.

| Agent | How to seed |
|---|---|
| **Claude** | `cd $WORK_DIR && claude` → send one message → `/exit` → copy the UUID from the "resume this session" hint. Paste as `CLAUDE_SESSION_ID`. |
| **Gemini (build + warzone)** | `cd $WORK_DIR && gemini` → send one message → `/exit` → the last stdout line prints `To resume this session: gemini --resume <UUID>`. Paste the UUID as `GEMINI_SESSION_ID`. |
| **Gemini (chat)** | `mkdir -p /tmp/argus-chat && cd /tmp/argus-chat && gemini` → send one message → `/exit` → copy the UUID from the same `To resume this session:` line. Paste as `GEMINI_CHAT_SESSION_ID`. (If you changed `CHAT_DIR` in `.env`, substitute it for `/tmp/argus-chat`.) |
| **Codex** | `cd $WORK_DIR && codex exec --full-auto --skip-git-repo-check "hello"` → the UUID is printed in the stdout header as `session id: <UUID>`. Paste as `CODEX_SESSION_ID`. |

**Tip:** before running the WORK_DIR commands, `export WORK_DIR=/your/absolute/path` in your shell once — then `cd $WORK_DIR` will work without pasting the full path each time.

**Why Gemini needs two session IDs:** Gemini CLI scopes session storage by cwd. The build pipeline runs Gemini from `WORK_DIR` (where your `.gemini/GEMINI.md` says "always log to Build-Log.md") and chat runs Gemini from `CHAT_DIR` (where the role doc says "you're in chat mode, don't write to project files"). Same UUID can't satisfy both stores, so each cwd needs its own session.

To **rotate** any session later, re-run the same seeding procedure **from the same directory** and paste the new UUID, then restart Hermes.

### 6. Run

```bash
# From the repo root
nats-server &                  # or: brew services start nats-server on macOS
npm run dev
```

`npm run dev` uses `concurrently` to start all four processes in one terminal:

| Process | Port | Purpose |
|---|---|---|
| `chat` | 3001 | Direct per-agent chat |
| `build` | 3002 | Three-agent build pipeline |
| `warzone` | 3003 | Three-phase pre-build discussion |
| `ui` | 5173 | Argus React UI (Vite dev server) |

Open **http://localhost:5173**.

**First boot only — what you'll see in the logs:** if your `WORK_DIR` is missing the role-doc folders, Hermes copies them in for you and prints one line per folder:

```
[role-docs] Copied .claude → /your/WORK_DIR/.claude (see README for the manual setup alternative)
[role-docs] Copied .gemini → /your/WORK_DIR/.gemini (see README for the manual setup alternative)
[role-docs] Copied .codex → /your/WORK_DIR/.codex  (see README for the manual setup alternative)
```

That's expected — it's the auto-copy step from the alternative layout above. Subsequent boots find the folders present and stay quiet.

> **Windows note:** the combined `npm run dev` script uses POSIX-shell quoting that breaks under cmd/PowerShell. On Windows, either run each process in its own terminal using the individual scripts (`npm run dev:chat`, `npm run dev:build`, `npm run dev:warzone`, `npm run dev:ui`), or use WSL.

---

## Runtime files in your project folder

During a build, Hermes and the agents generate task-named files at `WORK_DIR` (your project folder — the `Portfolio/` from step 3). Claude picks a kebab-case slug for the task (e.g. `landing-page`); Gemini and Codex use the same slug for their files.

| File | Owner | Purpose |
|---|---|---|
| `<slug>-Plan.md` | Claude | Plan for the current task (slug picked by Claude on a new project, or fixed by the UI on a continuation) |
| `<slug>-Build-Log.md` | Gemini | Iteration log — append-only within the task |
| `<slug>-Build-Feedback.md` | Codex | Audit reports with grades — append-only within the task |
| `<slug>/` | Gemini | Deliverable folder. All HTML/CSS/JS/code Gemini writes for the project lives here. One folder per slug, accumulates iterations and continuations. |
| `<slug>-WarZone.md` | All three | Three-phase discussion log for one topic — Claude picks the slug; subsequent submits in the Warzone tab append more rounds to the same file |
| `Build-History/<slug>/` | Hermes | Archive of past build tasks' meta files. The three meta files move here the moment a task completes (grade A, skip, or abort) — renamed to `Plan.md`, `Build-Log.md`, `Build-Feedback.md` inside the slug folder. Deliverables stay in `<slug>/`. |
| `WarZone-History/<slug>/` | Hermes | Archive of past discussions. When you click **New Discussion** in the Warzone tab, the current `<slug>-WarZone.md` moves into `WarZone-History/<slug>/WarZone.md`. |

**Two ways to start a build:**
- **New project** (default in the Build tab's "Project" dropdown) — Claude picks a slug, Gemini creates a fresh `<slug>/` folder.
- **Continue: \<slug\>** — pick an existing project from the dropdown. Hermes injects the slug; Claude reads what's in `<slug>/` and plans additions/changes; Gemini iterates on the existing files.

**Argus's own `.gitignore` already excludes these inside the clone**, so they won't get committed back to the argus repo. But if you `git init` your project folder, add them to your project's `.gitignore`:

```
# .gitignore inside your project folder
*-Plan.md
*-Build-Log.md
*-Build-Feedback.md
*-WarZone.md
Build-History/
WarZone-History/
```

They regenerate on every run and contain run-specific content — not meant to be version-controlled alongside your project.

### Updating role docs after an argus pull

The auto-copy from step 3 only runs when the role doc folders are **missing** in `WORK_DIR` — it never overwrites existing copies. That preserves any project-specific edits you made to your `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, or `.codex/CODEX.md`.

The trade-off: if you `git pull` in the argus clone and the role specs change, your project's copies stay on the older version. To pick up the new specs, delete your project's copies and restart hermes — fresh copies will be auto-installed:

```bash
rm -rf /path/to/your-project/{.claude,.gemini,.codex}
# then restart hermes (npm run dev)
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED` on startup | Start `nats-server &` before `npm run dev`. |
| `WORK_DIR does not exist` log on boot | Typo in `hermes/.env`'s `WORK_DIR`, or you forgot to `mkdir` the folder. Fix and restart. |
| Claude session expired / `exit code 1` | Re-seed `CLAUDE_SESSION_ID` in `hermes/.env`, restart Hermes. |
| Gemini session expired | Re-seed `GEMINI_SESSION_ID`, restart Hermes. |
| Codex session expired | Re-seed `CODEX_SESSION_ID`, restart Hermes. |
| Stuck in `planning` | Claude did not write a `<slug>-Plan.md` ending with `**Plan Status:** READY`. Check the `[build]` stdout — common causes are dropping the slug prefix (`Plan.md` alone won't match) or omitting the READY marker. |
| Build aborted with "slug mismatch" | You picked **Continue: \<slug\>** but Claude wrote a different slug filename. Re-submit; if it persists, check `.claude/CLAUDE.md` to confirm the continuation rules are intact. |
| Stuck in `building` | Gemini did not append a new `### Iteration` to `<slug>-Build-Log.md`. |
| Stuck in `auditing` | Codex did not write `**Audit Grade:** [ABCF]` to `<slug>-Build-Feedback.md`. |
| Warzone stuck mid-phase | Check the current `<slug>-WarZone.md` for the expected status marker at the current phase. |
| Agents building inside `argus-ui/` or `hermes/` | `WORK_DIR` is set to the argus clone root. Set it to a project subfolder instead (see step 3). |
| Edits to `hermes/core/agents.json` don't take effect | Restart Hermes — `agents.json` is loaded once on startup and cached in memory. |

---

## See also

- **[README.md](README.md)** — what Argus is, the three-agent pipeline, architecture, file signals, safety model
- **[workflow.md](workflow.md)** — full end-to-end pipeline walkthrough with state tables
- **[hermes/HERMES.md](hermes/HERMES.md)** — engine reference (folder structure, agents.json config, session-management matrix)
- **[argus-ui/README.md](argus-ui/README.md)** — UI stack, scripts, section map, extension guide
