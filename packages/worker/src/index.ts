import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { SentinelAgent } from '@sentinel/agent';
import { db, runs, findings, exploredPages } from '@sentinel/db';
import { eq } from 'drizzle-orm';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

export interface CrawlJobData {
  runId: string;
  projectId: string;
  url: string;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel?: string;
  maxSteps?: number;
}

const worker = new Worker<CrawlJobData>(
  'sentinel-crawls',
  async (job) => {
    const { runId, url, llmApiKey, llmBaseUrl, llmModel, maxSteps } = job.data;
    console.log(`[Worker] Starting crawl for run ${runId} → ${url}`);

    // Mark run as running
    await db.update(runs)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(runs.id, runId));

    const agent = new SentinelAgent({
      llmApiKey,
      llmBaseUrl,
      llmModel,
      headless: true,
      maxSteps: maxSteps || 50,
    });

    try {
      const results = await agent.crawl(url);

      // Persist findings to DB
      if (results.length > 0) {
        const findingRows = results.map((f) => ({
          runId,
          type: f.type,
          severity: f.severity,
          title: f.title,
          description: f.description,
          url: f.url,
          screenshotPath: f.screenshotPath || null,
        }));
        await db.insert(findings).values(findingRows);

        // Track explored pages
        const uniqueUrls = [...new Set(results.map((f) => f.url))];
        if (uniqueUrls.length > 0) {
          await db.insert(exploredPages).values(
            uniqueUrls.map((u) => ({ runId, url: u }))
          );
        }
      }

      // Mark run as completed
      await db.update(runs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          findingsCount: results.length,
        })
        .where(eq(runs.id, runId));

      console.log(`[Worker] Run ${runId} completed — ${results.length} findings`);
      return { findingsCount: results.length };
    } catch (err) {
      // Mark run as failed
      await db.update(runs)
        .set({ status: 'failed', completedAt: new Date() })
        .where(eq(runs.id, runId));

      console.error(`[Worker] Run ${runId} failed:`, err);
      throw err; // Let BullMQ handle retry
    }
  },
  {
    connection,
    concurrency: 2, // 2 parallel crawls per worker instance
  }
);

worker.on('completed', (job) => console.log(`[Worker] Job ${job?.id} done`));
worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err.message));

console.log('🔧 Sentinel Worker listening on queue: sentinel-crawls');
