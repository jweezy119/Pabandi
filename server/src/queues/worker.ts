import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { EMAIL_QUEUE, runEmailJob } from './email.queue';
import type { EmailJob } from './email.queue';
import { syncAllChannels } from '../services/channelSync.service';

/**
 * Dedicated worker process. Render runs this as a separate service with
 * REDIS_URL set; without Redis there is no durable queue, so exit loudly rather
 * than silently running a worker that never consumes anything.
 */
const redisUrl = process.env.REDIS_URL || '';
if (!redisUrl) {
  logger.error('[Worker] REDIS_URL is required — exiting');
  process.exit(1);
}

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err) => logger.warn(`[Worker] Redis error: ${err.message}`));

const worker = new Worker<EmailJob>(
  EMAIL_QUEUE,
  async (job) => {
    logger.info(`[Worker] processing ${job.name} (${job.id})`);
    await runEmailJob(job.data);
  },
  { connection, concurrency: 2 },
);

worker.on('completed', (job) => logger.info(`[Worker] completed ${job?.name} (${job?.id})`));
worker.on('failed', (job, err) => logger.error(`[Worker] failed ${job?.name}: ${err?.message}`));

// Channel sync also lives here when enabled, so the API service does not need
// to run a second timer. ENABLE_CHANNEL_SYNC defaults off in the API.
if (process.env.ENABLE_CHANNEL_SYNC === 'true') {
  setInterval(() => void syncAllChannels(), 5 * 60 * 1000);
  void syncAllChannels();
}

logger.info(`[Worker] listening on ${EMAIL_QUEUE}`);

async function shutdown() {
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
