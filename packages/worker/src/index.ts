/**
 * Sentinel Worker — BullMQ job processors
 * Stub for Phase 1
 */

import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'sentinel-jobs',
  async (job) => {
    console.log(`[Worker] Processing job ${job.id}: ${job.name}`);
    // TODO: Dispatch to SentinelAgent based on job type
    throw new Error('Not implemented');
  },
  { connection },
);

worker.on('completed', (job) => console.log(`[Worker] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err.message));

console.log('🔧 Sentinel Worker started, waiting for jobs...');
