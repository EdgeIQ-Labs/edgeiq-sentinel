import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

export const crawlQueue = new Queue('sentinel-crawls', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  },
});
