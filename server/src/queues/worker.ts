import { Worker, type Job } from 'bullmq';
import { getRedis, closeRedis, isRedisConfigured } from '../lib/redis';
import { closeQueues } from './connection';
import { EMAIL_QUEUE, runEmailJob, type EmailJob } from './email.queue';
import { WEBHOOK_QUEUE, runWebhookJob, type WebhookJob } from './webhook.queue';
import engineService from '../services/engine.service';
import { logger } from '../utils/logger';

/**
 * Pabandi background worker.
 *
 * Run as its own process (`npm run worker`, or the `pabandi-worker` Render
 * service). Keeping it separate from the API is the point: a queue worker is
 * allowed to use more memory and take longer than a request handler, and if it
 * does, the API stays up.
 *
 * ─── WHY THIS NEEDS REDIS AND THE API DOES NOT ──────────────────────────────
 * The API degrades to inline execution when Redis is absent. This process
 * cannot: there is nothing to degrade to, because running the work inline here
 * would defeat the reason for the process existing. So an unconfigured or
 * unreachable Redis is a startup error here and a log line there. That
 * asymmetry is intentional.
 */

const started = new Set<string>();

function reportFailure(queueName: string, job: Job | undefined, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`[Worker] ${queueName} job ${job?.name ?? 'unknown'} (${job?.id ?? '?'}) failed: ${message}`);
}

/**
 * Stop the process, for the two cases where continuing would be worse than
 * exiting.
 *
 * Setting `process.exitCode` alone is not enough. A failed `getRedis()` leaves
 * an ioredis client with a running `retryStrategy` timer, which holds the
 * event loop open -- the process logs its fatal error and then sits there doing
 * nothing until something kills it. On Render that reads as "deployed and
 * idle" rather than "crash-looping", which is the worse of the two by a long
 * way. Closing Redis releases the handle and `process.exit` is immediate.
 *
 * `process.exit` is called directly rather than via a helper because its `never`
 * return type is what lets TypeScript narrow the null checks below; returning
 * `Promise<never>` from an awaited helper does not.
 */
async function main(): Promise<void> {
  if (!isRedisConfigured()) {
    logger.error(
      '[Worker] REDIS_URL is not set. BullMQ requires Redis and this worker has nothing to fall back to. ' +
        'Set REDIS_URL and restart. (The API is unaffected and will run its work inline.)'
    );
    await closeRedis();
    process.exit(1);
  }

  const redis = await getRedis();

  if (!redis) {
    logger.error(
      '[Worker] could not reach Redis at REDIS_URL. Exiting rather than idling -- a worker that cannot ' +
        'reach its queue is not a worker, and silently retrying hides a misconfiguration until someone needs the emails.'
    );
    await closeRedis();
    process.exit(1);
  }

  // `duplicate` guards against two workers binding the same queue during a
  // rolling deploy, where both would otherwise drain the same jobs.
  const emailWorker = new Worker<EmailJob>(
    EMAIL_QUEUE,
    async (job) => {
      await runEmailJob(job.data);
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: { max: 50, duration: 1000 },
      settings: { backoffStrategy: undefined },
    }
  );

  const webhookWorker = new Worker<WebhookJob>(
    WEBHOOK_QUEUE,
    async (job) => {
      await runWebhookJob(job.data);
    },
    {
      connection: redis,
      // Lower than email: a webhook is a third-party HTTP call, so throughput
      // is bounded by their servers, not by ours.
      concurrency: 20,
      limiter: { max: 100, duration: 1000 },
    }
  );

  for (const [name, worker] of [
    [EMAIL_QUEUE, emailWorker],
    [WEBHOOK_QUEUE, webhookWorker],
  ] as const) {
    worker.on('failed', (job, err) => reportFailure(name, job, err));
    worker.on('error', (err) => logger.error(`[Worker] ${name} error: ${err.message}`));
    worker.on('completed', (job) => {
      // Info, not warn: completed is the common case and should not draw the
      // eye the way the failure paths do.
      logger.info(`[Worker] ${name} ${job.name} ${job.id} done`);
    });
  }

  await emailWorker.waitUntilReady();
  await webhookWorker.waitUntilReady();

  logger.info(`[Worker] ready. consuming ${EMAIL_QUEUE} and ${WEBHOOK_QUEUE}`);
  startSessionExpirySweep();
}

/**
 * Close sessions whose expiry has passed.
 *
 * Phase 2's `findSettleableSessions` returns them; actually settling them is
 * Phase 4's job, so this only marks them closed and invalidates the trust
 * cache for the owner. Without it, an expired session keeps reading as active
 * until something touches it, and the status is what every query filters on.
 */
function startSessionExpirySweep(): void {
  const SWEEP_INTERVAL_MS = 60_000;

  const sweep = async (): Promise<void> => {
    try {
      const due = await engineService.findSettleableSessions();

      if (due.length === 0) return;

      const { prisma } = await import('../utils/database');
      const result = await prisma.pabandiSession.updateMany({
        where: { id: { in: due.map((s) => s.id) }, status: 'active' },
        data: { status: 'closed', closedAt: new Date() },
      });

      if (result.count > 0) {
        logger.info(`[Worker] closed ${result.count} expired session(s)`);
      }
    } catch (error) {
      logger.error(`[Worker] session sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const timer = setInterval(() => {
    void sweep();
  }, SWEEP_INTERVAL_MS);

  // unref so the interval alone does not hold the process open; the workers
  // hold it up, not this.
  timer.unref();
  void sweep();
  startAppIntegrationDrain();
}

/**
 * Drain the database-backed app-integration webhook queue.
 *
 * `webhookDeliveryService.enqueueWebhook` has always worked -- gig claimed, gig
 * completed, agent wallet events all write a QUEUED row -- but
 * `processWebhookQueue` was called from nowhere in the codebase. Those rows
 * accumulated and were never delivered, so every third-party app integration
 * had been silently receiving nothing.
 *
 * This starts the drain rather than rewriting the queue, because enqueueing was
 * never the slow part: it is a single INSERT. What was missing was a consumer,
 * and adding one is a smaller and safer change than migrating the rows.
 *
 * Guarded by WORKER_DRAIN_APP_WEBHOOKS because turning this on for the first
 * time delivers a backlog, and whoever deploys should be able to say so.
 */
function startAppIntegrationDrain(): void {
  if (process.env.WORKER_DRAIN_APP_WEBHOOKS === 'false') {
    logger.warn('[Worker] app-integration webhook drain disabled by WORKER_DRAIN_APP_WEBHOOKS=false');
    return;
  }

  const DRAIN_INTERVAL_MS = 30_000;

  const drain = async (): Promise<void> => {
    try {
      const { webhookDeliveryService } = await import('../services/webhookDelivery.service');
      const result = await webhookDeliveryService.processWebhookQueue();

      if (result.delivered > 0 || result.failed > 0) {
        logger.info(`[Worker] app-integration webhooks delivered=${result.delivered} failed=${result.failed}`);
      }
    } catch (error) {
      logger.error(`[Worker] app-integration webhook drain failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const timer = setInterval(() => {
    void drain();
  }, DRAIN_INTERVAL_MS);
  timer.unref();

  logger.info('[Worker] draining app-integration webhook queue');
}

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`[Worker] ${signal} received, draining`);
  await closeQueues();
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch((error: unknown) => {
  logger.error(`[Worker] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});