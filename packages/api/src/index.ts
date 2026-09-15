import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { db, projects, runs, findings, exploredPages, baselines, ciTriggers, apiTokens } from '@sentinel/db';
import { eq } from 'drizzle-orm';
import { auth } from './auth.js';
import { crawlQueue } from './queue.js';

const app = new Hono();

// --- Auth middleware ---
const requireAuth = async (c: any, next: any) => {
  // Check Bearer token first (CLI/CI)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const tokenValue = authHeader.slice(7);
    const [token] = await db.select().from(apiTokens).where(eq(apiTokens.token, tokenValue));
    if (token && (!token.expiresAt || token.expiresAt > new Date())) {
      await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, token.id));
      c.set('userId', token.userId);
      c.set('authMethod', 'token');
      return next();
    }
    return c.json({ error: 'Invalid or expired API token' }, 401);
  }

  // Fall back to session auth (browser)
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', session.user);
  c.set('session', session.session);
  c.set('authMethod', 'session');
  await next();
};

// Mount Better Auth routes at /api/auth/*
app.on(['POST', 'GET'], '/api/auth/*', async (c) => {
  return auth.handler(c.req.raw);
});

// Health check (unauthenticated)
app.get('/health', (c) => c.json({ status: 'ok' }));

// --- Protected routes ---

// Projects
app.get('/api/projects', requireAuth, async (c) => {
  const all = await db.select().from(projects);
  return c.json(all);
});

app.post('/api/projects', requireAuth, async (c) => {
  const body = await c.req.json();
  const [project] = await db.insert(projects).values({
    name: body.name,
    url: body.url,
  }).returning();
  return c.json(project, 201);
});

app.get('/api/projects/:id/runs', requireAuth, async (c) => {
  const { id } = c.req.param();
  const projectRuns = await db.select().from(runs).where(eq(runs.projectId, id));
  return c.json({ projectId: id, runs: projectRuns });
});

// Runs
app.post('/api/runs', requireAuth, async (c) => {
  const body = await c.req.json();

  // Look up project URL
  const [project] = await db.select().from(projects).where(eq(projects.id, body.projectId));
  if (!project) return c.json({ error: 'Project not found' }, 404);

  // Create run record
  const [run] = await db.insert(runs).values({
    projectId: body.projectId,
    status: 'queued',
    triggerType: body.triggerType || 'manual',
    llmModel: body.llmModel,
  }).returning();

  // Enqueue BullMQ job
  await crawlQueue.add('crawl', {
    runId: run.id,
    projectId: body.projectId,
    url: project.url,
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel: body.llmModel,
    maxSteps: body.maxSteps,
  });

  return c.json(run, 201);
});

app.get('/api/runs/:id', requireAuth, async (c) => {
  const { id } = c.req.param();
  const [run] = await db.select().from(runs).where(eq(runs.id, id));
  if (!run) return c.json({ error: 'Run not found' }, 404);
  return c.json(run);
});

app.get('/api/runs/:id/findings', requireAuth, async (c) => {
  const { id } = c.req.param();
  const runFindings = await db.select().from(findings).where(eq(findings.runId, id));
  return c.json({ runId: id, findings: runFindings });
});

// CI Webhook (uses token auth instead of session)
app.post('/api/webhooks/ci/:token', async (c) => {
  const { token } = c.req.param();
  const body = await c.req.json();
  // Validate token against ci_triggers table
  const [trigger] = await db.select().from(ciTriggers).where(eq(ciTriggers.webhookSecret, token));
  if (!trigger) {
    return c.json({ error: 'Invalid webhook token' }, 403);
  }
  // Look up project
  const [project] = await db.select().from(projects).where(eq(projects.id, trigger.projectId));
  if (!project) return c.json({ error: 'Project not found' }, 404);

  // Create a run triggered by CI
  const [run] = await db.insert(runs).values({
    projectId: trigger.projectId,
    status: 'queued',
    triggerType: 'ci',
  }).returning();

  // Enqueue
  await crawlQueue.add('crawl', {
    runId: run.id,
    projectId: trigger.projectId,
    url: project.url,
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  });

  return c.json({ received: true, runId: run.id }, 201);
});

// --- CLI-friendly run + poll endpoint ---
app.post('/api/cli/run', requireAuth, async (c) => {
  const body = await c.req.json();
  const { url, maxSteps, llmModel } = body;
  if (!url) return c.json({ error: 'url is required' }, 400);

  // Find or create project by URL
  let [project] = await db.select().from(projects).where(eq(projects.url, url));
  if (!project) {
    [project] = await db.insert(projects).values({
      name: new URL(url).hostname,
      url,
    }).returning();
  }

  const [run] = await db.insert(runs).values({
    projectId: project.id,
    status: 'queued',
    triggerType: 'ci',
    llmModel,
  }).returning();

  await crawlQueue.add('crawl', {
    runId: run.id,
    projectId: project.id,
    url,
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel,
    maxSteps,
  });

  return c.json({ runId: run.id, projectId: project.id, status: 'queued' }, 201);
});

// Baselines
app.get('/api/baselines/:project_id', requireAuth, async (c) => {
  const { project_id } = c.req.param();
  const projectBaselines = await db.select().from(baselines).where(eq(baselines.projectId, project_id));
  return c.json({ projectId: project_id, baselines: projectBaselines });
});

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Sentinel API running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
