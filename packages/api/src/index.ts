import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Projects
app.post('/api/projects', async (c) => {
  const body = await c.req.json();
  return c.json({ id: crypto.randomUUID(), ...body, createdAt: new Date() }, 201);
});

app.get('/api/projects/:id/runs', (c) => {
  const { id } = c.req.param();
  return c.json({ projectId: id, runs: [] });
});

// Runs
app.post('/api/runs', async (c) => {
  const body = await c.req.json();
  return c.json({ id: crypto.randomUUID(), status: 'pending', ...body }, 201);
});

app.get('/api/runs/:id/findings', (c) => {
  const { id } = c.req.param();
  return c.json({ runId: id, findings: [] });
});

// CI Webhook
app.post('/api/webhooks/ci/:token', async (c) => {
  const { token } = c.req.param();
  const body = await c.req.json();
  return c.json({ received: true, token, body });
});

// Baselines
app.get('/api/baselines/:project_id', (c) => {
  const { project_id } = c.req.param();
  return c.json({ projectId: project_id, baselines: [] });
});

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Sentinel API running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
