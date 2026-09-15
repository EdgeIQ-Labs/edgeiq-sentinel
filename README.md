# Sentinel

**Agentic QA Platform by EdgeIQ Labs**

Sentinel is an autonomous QA platform where AI agents crawl web applications, discover bugs, and report findings — all orchestrated through a modern TypeScript monorepo.

## Architecture

- **`packages/api`** — Hono REST API server
- **`packages/agent`** — Playwright + LLM orchestration engine
- **`packages/worker`** — BullMQ job processors
- **`packages/web`** — React + Vite SPA dashboard (dark/gothic cybersecurity theme)
- **`packages/db`** — Drizzle ORM schema + PostgreSQL connection

## Tech Stack

Node.js 20+, pnpm, Hono, Drizzle ORM, PostgreSQL, Redis, BullMQ, Playwright (Chromium), React 18, Vite, TypeScript, better-auth

## Dev Setup

```bash
# Clone and install
cd /home/guy/repos/edgeiq-sentinel
pnpm install

# Copy env
cp .env.example .env

# Start infrastructure
docker compose up postgres redis -d

# Push DB schema
pnpm db:push

# Run everything in dev mode
pnpm dev
```

## Environment Variables

See `.env.example` for required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `LLM_API_KEY` — API key for the LLM provider
- `LLM_BASE_URL` — Base URL for LLM API
- `BETTER_AUTH_SECRET` — Secret for better-auth
- `PORT` — API server port (default 3000)
