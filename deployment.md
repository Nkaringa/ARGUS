> **VISIBILITY:** This file contains sensitive infrastructure details (server specs, tunnel config, CI/CD secrets). This repository **must be set to Private** on GitHub before pushing this file. Go to: GitHub repo → Settings → Danger Zone → Change repository visibility → Private. Only collaborators with explicit repository access will be able to see it.

---

# ARGUS — Production Deployment Guide
**Stack:** Oracle Cloud ARM · Docker Compose · Cloudflare Tunnel · Cloudflare Pages · GitHub Actions

---

## Overview

ARGUS is deployed as two Docker containers on a single Oracle Cloud ARM VM, with the React UI served globally from Cloudflare Pages and WebSocket/HTTP traffic routed through Cloudflare Tunnel (no open ports, no Nginx).

```
Cloudflare Pages (React UI — argus.yourdomain.com)
    │ wss                │ wss               │ wss
chat.domain        build.domain       warzone.domain
    │                    │                   │
Cloudflare Tunnel  (3 public hostnames → localhost on VM)
    │
Oracle Cloud VM — ARM A1.Flex (4 OCPUs / 24 GB)
┌──────────────────────────────────────────────┐
│  Docker Compose                              │
│  ┌──────────┐   ┌───────────────────────┐   │
│  │  nats    │◄──│  hermes               │   │
│  │  :4222   │   │  :3001 :3002 :3003    │   │
│  └──────────┘   │  + claude CLI         │   │
│                 │  + gemini CLI         │   │
│                 │  + codex  CLI         │   │
│                 └───────────────────────┘   │
│  Volumes:                                    │
│    workspace_data → /workspace              │
│    db_data        → /data  (hermes.db)      │
│    ~/.claude      → /root/.claude  (OAuth)  │
│    ~/.gemini      → /root/.gemini  (OAuth)  │
│    ~/.codex       → /root/.codex   (OAuth)  │
└──────────────────────────────────────────────┘
```

---

## Files Added / Modified by This Deployment

| File | What changed |
|---|---|
| `Dockerfile` | New — builds hermes image with agent CLIs and role docs |
| `docker-compose.yml` | New — orchestrates NATS + hermes containers |
| `.github/workflows/deploy.yml` | New — auto-deploys on push to `main` |
| `hermes/core/events.js` | 1-line fix — reads `NATS_URL` env var instead of hardcoded localhost |
| `argus-ui/src/config.ts` | Adds `VITE_CHAT_HOST`, `VITE_BUILD_HOST`, `VITE_WARZONE_HOST` for multi-subdomain support |
| `hermes/.env.example` | Documents `NATS_URL` and `HERMES_DB_PATH` |

---

## Step 1 — Code Changes Required Before Deploy

### `hermes/core/events.js` — line 7
```js
// Change from:
nc = await connect({ servers: 'nats://localhost:4222' });

// Change to:
nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
```

### `argus-ui/src/config.ts` — full replacement
```ts
const host        = import.meta.env.VITE_HOST        || 'localhost';
const chatPort    = import.meta.env.VITE_CHAT_PORT    || '3001';
const buildPort   = import.meta.env.VITE_BUILD_PORT   || '3002';
const warzonePort = import.meta.env.VITE_WARZONE_PORT || '3003';

// Production: set VITE_CHAT_HOST / VITE_BUILD_HOST / VITE_WARZONE_HOST to full
// Cloudflare tunnel subdomains. Cloudflare is always :443 — no port suffix needed.
// Local dev: leave unset — falls back to host:port (e.g. localhost:3001).
const chatHost    = import.meta.env.VITE_CHAT_HOST    || `${host}:${chatPort}`;
const buildHost   = import.meta.env.VITE_BUILD_HOST   || `${host}:${buildPort}`;
const warzoneHost = import.meta.env.VITE_WARZONE_HOST || `${host}:${warzonePort}`;

const isSecure  = typeof window !== 'undefined' && window.location.protocol === 'https:';
const httpProto = isSecure ? 'https' : 'http';
const wsProto   = isSecure ? 'wss'   : 'ws';

export const SERVERS = {
  chat:    { http: `${httpProto}://${chatHost}`,    ws: `${wsProto}://${chatHost}`    },
  build:   { http: `${httpProto}://${buildHost}`,   ws: `${wsProto}://${buildHost}`   },
  warzone: { http: `${httpProto}://${warzoneHost}`, ws: `${wsProto}://${warzoneHost}` },
};

const API_KEY = import.meta.env.VITE_API_KEY || '';

export function authHeaders(): Record<string, string> {
  return API_KEY ? { 'X-Api-Key': API_KEY } : {};
}

export function wsUrl(url: string): string {
  return API_KEY ? `${url}?key=${encodeURIComponent(API_KEY)}` : url;
}
```

### `hermes/.env.example` — append these two blocks
```env
# ─── NATS ──────────────────────────────────────────────────────
# Default: nats://localhost:4222 (auto-started by npm run dev).
# In Docker: set to nats://nats:4222 to reach the NATS container.
NATS_URL=

# ─── Database path ─────────────────────────────────────────────
# Default: hermes/hermes.db (relative to hermes/ source directory).
# In Docker: set to /data/hermes.db (on a named volume).
# Do NOT mount the entire hermes/ directory — that shadows source code.
HERMES_DB_PATH=
```

---

## Step 2 — `Dockerfile` (create at repo root)

```dockerfile
# ── Stage 1: install deps (layer-cached) ──────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY hermes/package*.json ./hermes/
COPY argus-ui/package*.json ./argus-ui/

RUN npm install --omit=dev

# ── Stage 2: runtime image ────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Agent CLIs — auth via OAuth credential dirs mounted from VM host at runtime
RUN npm install -g \
    @anthropic-ai/claude-code \
    @google/gemini-cli \
    @openai/codex

COPY --from=deps /app/node_modules ./node_modules

COPY hermes/ ./hermes/
COPY package.json ./

# Role docs — core/role-docs.js looks for these at ARGUS_ROOT (/app/) and
# auto-copies them to WORK_DIR on first boot. Without them agents have no role spec.
COPY .claude/ ./.claude/
COPY .gemini/ ./.gemini/
COPY .codex/  ./.codex/

RUN mkdir -p /workspace /tmp/argus-chat

EXPOSE 3001 3002 3003

# dev:backend runs chat/build/warzone servers without the NATS preflight script
# (NATS is a separate container — no need to auto-start it here)
CMD ["npm", "run", "dev:backend"]
```

---

## Step 3 — `docker-compose.yml` (create at repo root)

```yaml
version: '3.8'

services:
  nats:
    image: nats:2.10-alpine
    container_name: argus_nats
    restart: always
    networks:
      - argus_net

  hermes:
    build:
      context: .           # repo root — needed for COPY of .claude/.gemini/.codex
      dockerfile: Dockerfile
    container_name: argus_hermes
    restart: always
    depends_on:
      - nats
    environment:
      - NATS_URL=nats://nats:4222
      - WORK_DIR=/workspace
      - CHAT_DIR=/tmp/argus-chat
      - CHAT_PORT=3001
      - BUILD_PORT=3002
      - WARZONE_PORT=3003
      - BIND_HOST=0.0.0.0        # required for Cloudflare tunnel to reach the container
      - NODE_ENV=production
      - HERMES_DB_PATH=/data/hermes.db
      - ALLOWED_ORIGIN=${ALLOWED_ORIGIN:-http://localhost:5173}
      - API_KEY=${API_KEY}
    volumes:
      - workspace_data:/workspace   # agent build artefacts
      - db_data:/data               # SQLite DB (via HERMES_DB_PATH)
      # CLI OAuth credentials — pre-authenticated on VM host, mounted read-only
      - /home/ubuntu/.claude:/root/.claude:ro
      - /home/ubuntu/.gemini:/root/.gemini:ro
      - /home/ubuntu/.codex:/root/.codex:ro
    ports:
      - "3001:3001"
      - "3002:3002"
      - "3003:3003"
    networks:
      - argus_net

volumes:
  workspace_data:
  db_data:

networks:
  argus_net:
    driver: bridge
```

---

## Step 4 — `.github/workflows/deploy.yml` (create)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    name: Redeploy hermes on Oracle VM
    runs-on: ubuntu-latest
    steps:
      - name: SSH → pull → rebuild
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.ORACLE_IP }}
          username: ubuntu
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd ~/ARGUS
            git pull origin main
            docker compose up -d --build hermes
            docker compose ps
```

**GitHub Secrets to add** (repo → Settings → Secrets and variables → Actions):

| Secret name | Value |
|---|---|
| `ORACLE_IP` | VM public IP address |
| `SSH_KEY` | Full contents of your `key.pem` private key |

---

## Step 5 — Oracle Cloud VM Setup

### Instance spec (Oracle Free Tier)

| Attribute | Value |
|---|---|
| Image | Ubuntu 22.04 or 24.04 |
| Shape | `VM.Standard.A1.Flex` |
| OCPUs / RAM | 4 / 24 GB |
| Boot volume | 50–100 GB |

### Initial setup

```bash
ssh -i key.pem ubuntu@<VM_IP>

# Upgrade + swap (agent spawns are memory-intensive — 4 GB swap is a safety net)
sudo apt update && sudo apt upgrade -y
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu
# Log out and back in for group membership
```

### Clone and configure

```bash
git clone https://github.com/<your-org>/ARGUS.git ~/ARGUS
cd ~/ARGUS
```

Create `~/ARGUS/.env` (never committed — holds the two runtime secrets):
```env
API_KEY=<run: openssl rand -hex 32>
ALLOWED_ORIGIN=https://argus.pages.dev    # update after Cloudflare Pages URL is known
```

### Authenticate agent CLIs on the VM host (one-time)

The CLIs (`claude`, `gemini`, `codex`) authenticate via **OAuth browser login** — no API keys. Credentials are stored in home directories on the VM host and volume-mounted read-only into the container.

```bash
# Claude Code
claude
# Follow the login URL it prints, then /exit
# Credentials saved to ~/.claude/

# Gemini CLI
gemini
# Follow Google OAuth login, then /exit
# Credentials saved to ~/.gemini/

# Codex CLI
codex
# Follow its auth flow, then exit
# Credentials saved to ~/.codex/

# Verify
ls -la ~/.claude ~/.gemini ~/.codex
```

### Build and start

```bash
docker compose up -d --build
docker compose ps        # both services should show "Up"
docker compose logs hermes --tail=50
# Expected output:
# [chat]    Running at http://0.0.0.0:3001
# [build]   Running at http://0.0.0.0:3002
# [warzone] Running at http://0.0.0.0:3003
```

---

## Step 6 — Cloudflare Tunnel

Replaces Nginx and avoids opening inbound ports on the Oracle VCN. Supports WebSocket natively once enabled.

### Install cloudflared on the VM (ARM64)

```bash
curl -L -o cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
```

### Create tunnel

1. Cloudflare Zero Trust Dashboard → Networks → Tunnels → Create tunnel
2. Select **cloudflared**, name it (e.g. `argus-prod`)
3. Copy the install command and run it on the VM:
   ```bash
   sudo cloudflared service install <your-tunnel-token>
   ```

### Add 3 public hostnames

In the tunnel → **Public Hostnames** tab:

| Public hostname | Service |
|---|---|
| `chat.yourdomain.com` | `http://localhost:3001` |
| `build.yourdomain.com` | `http://localhost:3002` |
| `warzone.yourdomain.com` | `http://localhost:3003` |

### Enable WebSockets

**Main Cloudflare dashboard** (not Zero Trust) → yourdomain.com → **Network** → **WebSockets: ON**

This is required for all 3 hermes WebSocket connections to work through the tunnel.

---

## Step 7 — Frontend: Cloudflare Pages

1. Cloudflare Pages → Create application → Connect to Git → select the ARGUS repo
2. Configure build:

| Setting | Value |
|---|---|
| Build command | `npm run build:ui` |
| Output directory | `argus-ui/dist` |
| Root directory | *(leave blank)* |

3. Set **Environment Variables** in the Pages dashboard:

| Variable | Value |
|---|---|
| `VITE_CHAT_HOST` | `chat.yourdomain.com` |
| `VITE_BUILD_HOST` | `build.yourdomain.com` |
| `VITE_WARZONE_HOST` | `warzone.yourdomain.com` |
| `VITE_API_KEY` | same value as `API_KEY` in `~/ARGUS/.env` on VM |

> Do **not** set `VITE_HOST` or `VITE_*_PORT` in production. The per-server host vars take precedence, and Cloudflare always terminates on :443 (no port needed).

4. Once the Pages URL is assigned, update `ALLOWED_ORIGIN` in `~/ARGUS/.env` on the VM and restart:
   ```bash
   cd ~/ARGUS && docker compose up -d hermes
   ```

---

## Key Design Decisions

### Why not full XState rehydration?

The manual suggests `createActor(machine, { snapshot: savedState })` for state persistence across restarts. This is **not implemented** because it would be incomplete for ARGUS:

- The XState machine actions (`startPlanner`, `startBuilder`, `startAuditor`) are closures over module-level variables in `workflows/build.js` (`currentTask`, `currentSlug`, `iterationCount`). These are **not** part of the XState snapshot.
- Restoring only the snapshot to `building` state would leave `currentTask = null` → `launchBuilder()` sees `if (!currentTask) return` and stalls silently.

ARGUS already handles this gracefully: `sweepStaleRunningTasks()` (called in `servers/build.js` on every boot) marks any in-flight `RUNNING` tasks as `STALE`. Users see this in the history tab and resubmit. The machine boots to `idle` cleanly.

### Why `HERMES_DB_PATH` instead of mounting `/app/hermes`?

`core/db.js` already supports `HERMES_DB_PATH` env var. Using it and mounting a dedicated `/data` volume for the DB is cleaner than mounting the entire `/app/hermes/` directory — which would shadow the source code baked into the image with the host filesystem.

### Why the Dockerfile is at repo root (not `hermes/`)

`core/role-docs.js` resolves `ARGUS_ROOT = path.resolve(__dirname, '../..')` = `/app/` inside the container. It auto-copies `.claude/`, `.gemini/`, `.codex/` from `/app/` to `WORK_DIR` on first boot. The Dockerfile must `COPY` those three directories, which only exist at the repo root — requiring `context: .` in docker-compose.

---

## Verification Checklist

```bash
# Containers running
docker compose ps
# → argus_nats   Up
# → argus_hermes Up

# Servers started
docker compose logs hermes | grep Running
# → [chat]    Running at http://0.0.0.0:3001
# → [build]   Running at http://0.0.0.0:3002
# → [warzone] Running at http://0.0.0.0:3003

# Role docs auto-copied (first boot only)
docker compose logs hermes | grep role-docs
# → [role-docs] Copied .claude → /workspace/.claude

# Backend reachable through Cloudflare
curl https://build.yourdomain.com/state
# → {"state":"idle","task":null,...}

# WebSockets — browser DevTools → Network → WS tab
# → 3 connections (chat.*, build.*, warzone.*) showing status 101

# Pipeline smoke test
# Submit a task in the Build tab → pipeline advances planning → building → auditing

# Restart gracefully
docker compose restart hermes
docker compose logs hermes | grep STALE
# → [db] Marked N stale RUNNING task(s) as STALE on boot

# DB has events
docker exec argus_hermes sqlite3 /data/hermes.db "SELECT COUNT(*) FROM events;"
# → non-zero number

# CI/CD
# Push to main → GitHub Actions job runs → docker compose ps shows hermes restarted
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `hermes` container exits immediately | Run `docker compose logs hermes` — likely `WORK_DIR does not exist`. The `workspace_data` volume should create `/workspace` automatically; check volume mounts. |
| Agents fail with auth error | SSH into VM, re-authenticate the relevant CLI (`claude`, `gemini`, or `codex`), then `docker compose restart hermes`. Credentials are picked up from the mounted host dirs. |
| NATS connection refused inside container | Confirm `NATS_URL=nats://nats:4222` is set and the nats service is running (`docker compose ps nats`). |
| WebSocket 403/401 errors | `API_KEY` in `~/ARGUS/.env` and `VITE_API_KEY` in Cloudflare Pages env vars must match exactly. |
| WebSocket connects but immediately closes | WebSockets not enabled on Cloudflare: main dashboard → yourdomain.com → Network → WebSockets → ON. |
| UI can't reach `build.yourdomain.com` | Check CORS: `ALLOWED_ORIGIN` in VM `.env` must match the exact Cloudflare Pages URL (including `https://`). |
| Agents writing outside `WORK_DIR` | `WORK_DIR` is set correctly but not `/workspace` — check `docker compose config` to confirm volume and env are applied. |
| CI deploy fails | Confirm `ORACLE_IP` and `SSH_KEY` are set in GitHub Secrets. `SSH_KEY` must be the raw private key content (including `-----BEGIN` and `-----END` lines). |
