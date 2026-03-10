# 🚀 IssuePilot

> AI-powered GitHub issue resolver — assign an issue, get a pull request.

IssuePilot connects an AI agent to your GitHub repository. When you assign an issue to the agent (via label or comment), it reads the issue, understands your codebase, writes code, runs tests, reviews the changes, and opens a pull request — all automatically.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         IssuePilot                               │
├──────────────────┬──────────────────────────────────────────────┤
│   Web (Next.js)  │              API (Express)                    │
│   - Dashboard    │  ┌─────────────────────────────────────────┐ │
│   - Repos list   │  │  Routes: /auth /api/repos /api/jobs      │ │
│   - Job monitor  │  │  BullMQ Worker                          │ │
│   - Live logs    │  │  GitHub Webhook Handler                  │ │
└──────────────────┴──┴────────────────┬────────────────────────┴─┘
                                        │
                         ┌──────────────▼──────────────┐
                         │      Agent Pipeline          │
                         │                             │
                         │  ┌──────────┐               │
                         │  │ Planner  │ ← explores repo│
                         │  └────┬─────┘               │
                         │       │                     │
                         │  ┌────▼─────┐               │
                         │  │  Coder   │ ← writes code  │
                         │  └────┬─────┘               │
                         │       │                     │
                         │  ┌────▼──────┐              │
                         │  │Test Runner│ ← Docker      │
                         │  └────┬──────┘              │
                         │       │                     │
                         │  ┌────▼──────┐              │
                         │  │ Reviewer  │ ← checks code │
                         │  └────┬──────┘              │
                         │       │  (if issues)        │
                         │  ┌────▼──────┐              │
                         │  │ Fix Agent │ ← fixes bugs  │
                         │  └────┬──────┘              │
                         │       │                     │
                         │  ┌────▼──────┐              │
                         │  │Create PR  │               │
                         │  └───────────┘              │
                         └──────────────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
    ┌─────────▼──────┐      ┌───────────▼────────┐    ┌──────────▼─────┐
    │ @issuepilot/llm │      │ @issuepilot/tools  │    │@issuepilot/    │
    │                │      │                    │    │github          │
    │ OpenAI Provider│      │ read_file          │    │                │
    │ Claude Provider│      │ write_file         │    │ GitHubClient   │
    │ Ollama Provider│      │ edit_file          │    │ cloneOrUpdate  │
    └────────────────┘      │ search_code        │    │ createPR       │
                            │ run_command        │    └────────────────┘
                            │ git_*              │
                            └────────────────────┘

    Infrastructure:
    PostgreSQL ─ job state, users, repos
    Redis      ─ BullMQ job queue
    Qdrant     ─ vector embeddings for code search
    Docker     ─ isolated test execution sandbox
```

---

## Features

- **GitHub PAT authentication** — uses a fine-grained personal access token
- **Repository connection** — connect any public or private repo you have access to
- **Automatic triggering** — add label `ai-agent` or comment `/ai solve`
- **Multi-provider LLM** — OpenAI, Anthropic Claude, or local Ollama models
- **Bring your own API key** — keys encrypted at rest with AES-256-GCM
- **Full agent pipeline** — Plan → Code → Test → Review → Fix → PR
- **Docker sandboxing** — test execution isolated in containers
- **Vector code search** — embeddings-powered semantic code understanding
- **Live job monitoring** — real-time SSE event stream in the dashboard
- **CLI tool** — `npx issuepilot solve` for direct use

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for infrastructure and sandbox test execution)
- Git

### Automated Setup (recommended)

```bash
git clone https://github.com/issuepilot/issuepilot.git
cd issuepilot
pnpm run setup
```

The setup script interactively:

1. Checks prerequisites (Node.js, pnpm, Docker)
2. Copies `.env.example` → `.env`
3. Runs `pnpm install`
4. Builds all packages in dependency order
5. Starts Docker infrastructure (PostgreSQL, Redis, Qdrant)

```bash
  pnpm run infra:up
```

6. Runs the database migration

```bash
   pnpm run db:migrate
```

### Manual Setup

#### 1. Clone & Install

```bash
git clone https://github.com/issuepilot/issuepilot.git
cd issuepilot
pnpm install
```

#### 2. Configure Environment

```bash
cp .env.example .env
```

Generate secure keys automatically:

```bash
pnpm run gen-keys
# or write them directly to .env:
pnpm run gen-keys:write
```

Edit `.env` with your values:

| Variable            | Description                                    |
| ------------------- | ---------------------------------------------- |
| `GITHUB_TOKEN`      | Fine-grained PAT (see below)                   |
| `ENCRYPTION_KEY`    | 64 hex chars (32 bytes) for AES-256 encryption |
| `DATABASE_URL`      | PostgreSQL connection string                   |
| `REDIS_URL`         | Redis connection string                        |
| `WEBHOOK_SECRET`    | Secret for verifying GitHub webhook signatures |
| `LLM_PROVIDER`      | `openai`, `claude`, or `ollama`                |
| `OPENAI_API_KEY`    | OpenAI API key (if using OpenAI)               |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using Claude)            |

**Create a GitHub Fine-Grained PAT:**

1. Go to https://github.com/settings/tokens?type=beta
2. New fine-grained token
3. Select the repositories you want IssuePilot to access
4. Required permissions: **Contents** (R/W), **Issues** (R/W), **Pull Requests** (R/W), **Webhooks** (R/W)
5. Generate token and paste it as `GITHUB_TOKEN` in `.env`

#### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and Qdrant
pnpm run infra:up
```

#### 4. Build Packages

```bash
# Build all workspace packages in dependency order
pnpm run build
```

#### 5. Run Database Migration

```bash
pnpm run db:migrate
```

#### 6. Set Up Webhook Proxy (local dev)

So you never have to change the GitHub webhook URL between restarts:

```bash
# 1. Get a permanent smee.io URL (free, one-time)
open https://smee.io/new       # copy the URL shown

# 2. Add it to .env
echo "WEBHOOK_PROXY_URL=https://smee.io/yourChannelId" >> .env

# 3. Set that same URL as the GitHub webhook Payload URL (once, permanent)

# 4. Start the proxy in a separate terminal
pnpm run webhook:dev
```

#### 7. Start Development

```bash
# Terminal 1 — API + Web
pnpm dev

# Terminal 2 — webhook proxy (forwards GitHub events to localhost)
pnpm run webhook:dev
```

- Web UI: http://localhost:3000
- API: http://localhost:3001
- API Health: http://localhost:3001/health

---

## Webhook Setup (Local Development)

GitHub can't reach `localhost` directly. Use the built-in smee.io proxy to get a **permanent public URL** that forwards events to your local API — set it once in GitHub and never change it again.

### One-time setup

1. Go to **https://smee.io/new** — a unique channel URL is generated (e.g. `https://smee.io/abc123xyz`)
2. Copy that URL and add it to your `.env`:
   ```
   WEBHOOK_PROXY_URL=https://smee.io/abc123xyz
   ```
3. In your GitHub repo → **Settings → Webhooks → Add webhook**:
   - **Payload URL**: `https://smee.io/abc123xyz` ← the smee URL, permanent
   - **Content type**: `application/json`
   - **Secret**: value of `WEBHOOK_SECRET` from your `.env`
   - **Events**: Issues + Issue comments
4. Start the proxy whenever you develop:
   ```bash
   pnpm run webhook:dev
   ```

The smee URL never changes — no more updating GitHub settings on every restart.

---

## Available Scripts

| Script                    | Description                                                   |
| ------------------------- | ------------------------------------------------------------- |
| `pnpm run setup`          | Interactive first-time setup (install, build, infra, migrate) |
| `pnpm run setup:build`    | Setup with package build step                                 |
| `pnpm run setup:ci`       | Non-interactive CI setup                                      |
| `pnpm run build`          | Build all packages in dependency order                        |
| `pnpm run build:all`      | Force rebuild all packages (including already-built)          |
| `pnpm run dev`            | Start API + Web in watch mode (via Turborepo)                 |
| `pnpm run dev:api`        | Start only the API in watch mode                              |
| `pnpm run dev:web`        | Start only the Next.js frontend                               |
| `pnpm run webhook:dev`    | Start smee.io proxy — forwards GitHub webhooks to localhost   |
| `pnpm run gen-keys`       | Print generated JWT_SECRET, ENCRYPTION_KEY, WEBHOOK_SECRET    |
| `pnpm run gen-keys:write` | Generate keys and write them directly to `.env`               |
| `pnpm run db:migrate`     | Run the SQL migration via psql or Docker                      |
| `pnpm run db:generate`    | Generate new Drizzle migration from schema changes            |
| `pnpm run infra:up`       | Start PostgreSQL, Redis, Qdrant via Docker Compose            |
| `pnpm run infra:down`     | Stop infrastructure containers                                |
| `pnpm run infra:logs`     | Tail infrastructure container logs                            |
| `pnpm run docker:up`      | Start the full stack (infra + API + Web)                      |
| `pnpm run docker:down`    | Stop all Docker Compose services                              |
| `pnpm run lint`           | Run ESLint across all packages                                |
| `pnpm run type-check`     | Run TypeScript type checking across all packages              |
| `pnpm run test`           | Run tests across all packages                                 |

---

## Docker Compose (Full Stack)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env — set GITHUB_TOKEN, LLM keys, etc.

# Start everything
docker compose -f docker/docker-compose.yml up -d

# Check logs
docker compose -f docker/docker-compose.yml logs -f api
```

---

## CLI Usage

```bash
# Solve an issue directly from the command line
npx issuepilot solve owner/repo 42

# Specify provider
npx issuepilot solve owner/repo 42 --provider claude --model claude-sonnet-4-6

# Use Ollama (local model)
npx issuepilot solve owner/repo 42 --provider ollama --model llama3.1

# With explicit token
npx issuepilot solve owner/repo 42 --token ghp_xxx
```

**Environment variables for CLI:**

```bash
export GITHUB_TOKEN=ghp_your_token
export OPENAI_API_KEY=sk-your-key
# or
export ANTHROPIC_API_KEY=sk-ant-your-key
```

---

## Triggering the Agent

### Via GitHub Label

Add the label `ai-agent` to any open issue. IssuePilot will automatically:

1. Detect the label via webhook
2. Queue an agent job
3. Comment on the issue when work begins
4. Post the PR link when done

### Via Comment

Comment `/ai solve` on any open issue.

### Via Web UI

1. Connect your repository in the dashboard
2. Browse open issues
3. Click **🤖 Solve** on any issue

### Via API

```bash
curl -X POST http://localhost:3001/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"repositoryId": "uuid", "issueNumber": 42, "issueTitle": "Fix login bug"}'
```

---

## Project Structure

```
issuepilot/
├── apps/
│   ├── web/                    # Next.js 14 frontend
│   │   └── src/app/
│   │       ├── dashboard/      # Main UI
│   │       └── auth/           # OAuth callback
│   └── api/                    # Express API server
│       └── src/
│           ├── routes/         # auth, repos, jobs, webhooks
│           ├── queue/          # BullMQ worker & queue
│           ├── db/             # Drizzle ORM schema & migrations
│           ├── middleware/      # Auth middleware
│           └── services/       # Crypto utilities
│
├── packages/
│   ├── agent/                  # Agent pipeline orchestration
│   │   └── src/
│   │       ├── agents/         # planner, coder, reviewer, fix-agent
│   │       ├── pipeline.ts     # Main orchestrator
│   │       └── tool-loop.ts    # LLM + tool execution loop
│   │
│   ├── llm/                    # LLM provider abstraction
│   │   └── src/providers/      # openai, claude, ollama
│   │
│   ├── tools/                  # Agent tools
│   │   └── src/
│   │       ├── file-tools.ts   # read/write/edit/search
│   │       ├── command-tools.ts # run_command (sandboxed)
│   │       └── git-tools.ts    # git operations
│   │
│   ├── github/                 # GitHub integration
│   │   └── src/
│   │       ├── client.ts       # Octokit wrapper
│   │       ├── cloner.ts       # repo clone/update
│   │       └── webhook.ts      # webhook verification
│   │
│   ├── vector/                 # Code indexing
│   │   └── src/
│   │       ├── chunker.ts      # file → chunks
│   │       ├── qdrant-store.ts # Qdrant client
│   │       └── indexer.ts      # index + search
│   │
│   ├── sandbox/                # Isolated execution
│   │   └── src/
│   │       ├── docker-runner.ts # Docker container runner
│   │       └── test-runner.ts  # Auto-detect & run tests
│   │
│   └── cli/                    # CLI tool (npx issuepilot)
│       └── src/index.ts
│
├── scripts/
│   ├── setup.mjs               # Interactive first-time setup
│   ├── build-packages.mjs      # Build packages in dependency order
│   ├── gen-keys.mjs            # Generate cryptographic secrets
│   └── migrate.mjs             # Run database migration
│
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   └── Dockerfile.web
│
├── .env.example
├── turbo.json                  # Turborepo pipeline config
└── pnpm-workspace.yaml         # pnpm workspace definition
```

---

## LLM Provider Configuration

IssuePilot supports three providers via a common interface:

```typescript
interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  embed?(options: EmbeddingOptions): Promise<EmbeddingResult>;
}
```

### OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o          # optional, default: gpt-4o
```

### Anthropic Claude

```env
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-6  # optional
```

### Ollama (Local)

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

**Recommended Ollama models for coding:**

- `llama3.1:70b` — best quality (requires ~40GB RAM)
- `deepseek-coder-v2` — excellent for code tasks
- `codestral` — fast and code-focused
- `llama3.1` — good balance of speed/quality

---

## Security

| Feature              | Implementation                                    |
| -------------------- | ------------------------------------------------- |
| GitHub access        | Fine-grained PAT (scoped to selected repos)       |
| LLM API keys         | AES-256-GCM encrypted in PostgreSQL               |
| Webhook verification | HMAC-SHA256 signature check                       |
| Command execution    | Regex allowlist + blocked patterns                |
| Docker sandbox       | `--network none`, `--cap-drop ALL`, `--read-only` |
| Path traversal       | Resolved path must be within repoPath             |
| Rate limiting        | 100 req/15min per IP on `/api/*`                  |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Submit a pull request

---

## License

MIT © IssuePilot Contributors
