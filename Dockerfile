# ── Stage 1: install dependencies (layer-cached) ──────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace manifests only — source changes won't bust this cache layer
COPY package*.json ./
COPY hermes/package*.json ./hermes/
COPY argus-ui/package*.json ./argus-ui/

RUN npm install --omit=dev

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Install the three agent CLIs.
# Authentication is handled via OAuth credential directories mounted from the
# VM host at runtime (~/.claude, ~/.gemini, ~/.codex) — no API keys needed.
RUN npm install -g \
    @anthropic-ai/claude-code \
    @google/gemini-cli \
    @openai/codex

# Copy hoisted node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy hermes source and the root package.json
# (root package.json is needed for npm workspaces + the dev:backend script)
COPY hermes/ ./hermes/
COPY package.json ./

# Role doc folders — core/role-docs.js resolves ARGUS_ROOT as /app/ inside the
# container and auto-copies .claude/, .gemini/, .codex/ into WORK_DIR on first
# boot. Without these in the image, agents start with no role specification.
COPY .claude/ ./.claude/
COPY .gemini/ ./.gemini/
COPY .codex/  ./.codex/

# Create the WORK_DIR mount point so core/env.js passes its existence check on boot.
# The actual contents come from the workspace_data Docker volume at runtime.
RUN mkdir -p /workspace /tmp/argus-chat

EXPOSE 3001 3002 3003

# dev:backend starts chat, build, and warzone servers via concurrently.
# Does NOT invoke scripts/dev.js, which would run the NATS preflight check —
# NATS runs as a separate container so no local nats-server binary is needed.
CMD ["npm", "run", "dev:backend"]
