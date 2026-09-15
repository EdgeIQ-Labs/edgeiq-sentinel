# ⬡ Sentinel

**Autonomous agentic QA by [EdgeIQ Labs](https://edgeiqlabs.com).**

Point Sentinel at a URL. Autonomous AI agents explore every flow, click every button, fill every form, screenshot failures, log console errors, audit accessibility, and generate comprehensive reports. No scripts needed.

Built by cybersecurity engineers. Runs entirely inside your own infrastructure. Your application data never leaves your network.

## Quick Start

```bash
# Clone
git clone https://github.com/EdgeIQ-Labs/edgeiq-sentinel.git
cd edgeiq-sentinel

# Configure
cp .env.example .env
# Edit .env with your LLM API key

# Launch
docker compose up -d

# Dashboard → http://localhost:3000
```

## CLI Usage

```bash
# Trigger a scan from CI or terminal
SENTINEL_API=http://localhost:3000 SENTINEL_TOKEN=your-token \
  npx tsx packages/cli/src/index.ts run https://myapp.com --fail-on high
```

Exit codes: `0` = clean, `1` = findings at or above `--fail-on` threshold.

## GitHub Action

```yaml
- uses: EdgeIQ-Labs/edgeiq-sentinel@main
  with:
    url: https://myapp.com
    sentinel-api: https://sentinel.example.com
    sentinel-token: ${{ secrets.SENTINEL_TOKEN }}
    fail-on: high
```

## Architecture

| Layer | Tech |
|-------|------|
| API | Hono (TypeScript) |
| Frontend | React + Vite |
| Database | PostgreSQL + Drizzle ORM |
| Queue | BullMQ + Redis |
| Browser | Playwright (Chromium) |
| Agent | OpenAI-compatible LLM (works with Ollama/vLLM) |
| Auth | Better Auth |

## Monetization

| Community (Free) | Pro ($399) | Managed ($149/mo) |
|---|---|---|
| AGPL-3.0 | Multi-agent parallel | We host it |
| Single agent | CI/CD integration | Team seats & RBAC |
| Docker self-hosted | Custom assertions | Alert integrations |

## Development

```bash
pnpm install
pnpm --filter @sentinel/api dev    # API on :3000
pnpm --filter @sentinel/web dev    # Vite on :5173
pnpm --filter @sentinel/worker dev # BullMQ worker
```

## License

AGPL-3.0 © 2026 EdgeIQ Labs
