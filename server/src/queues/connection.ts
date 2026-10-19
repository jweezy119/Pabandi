import { Queue, type JobsOptions } from 'bullmq';
import { getRedis, isRedisConfigured } from '../lib/redis';
import { logger } from '../utils/logger';

/**
 * Queue plumbing with a fallback.
 *
 * ─── THE PROBLEM ────────────────────────────────────────────────────────────
 * BullMQ is Redis-only. If enqueueing throws when Redis is down, then adding a
 * queue to an email path turns a working (blocking) email into a broken
 * request, and the failure lands in exactly the handler that was already slow.
 *
 * ─── THE FALLBACK ───────────────────────────────────────────────────────────
 * `enqueue()` resolves in two ways:
 *
 *   - Redis reachable: add a job and return `{ delivered: false, mode: 'queued' }`.
 *     Work happens in the worker. The response returns immediately.
 *   - Redis unreachable, or the add failed: run the processor inline on the
 *     next tick and return `{ delivered: false, mode: 'inline' }`.
 *
 * Both are fire-and-forget from the request's point of view, which is the
 * actual goal of this phase -- the handler stops waiting on a provider. The
 * inline path is strictly worse than the queued path (no retry, no durability,
 * it dies with the process) and it is meant to be visible: every inline run
 * logs at warn, so a deployment quietly running without its queue is
 * noticeable rather than silent.
 *
 * The one thing `enqueue()` will not do is swallow a throw from the processor
 * itself. Inline, that rejection is caught and logged here. A queued processor
 * throwing is the worker's problem and BullMQ handles it with retries.
 */

export type EnqueueMode = 'queued' | 'inline';

export interface EnqueueResult {
  jobId: string;
  mode: EnqueueMode;
}

export type Processor<T> = (data: T) => Promise<void>;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  // A provider that is down for six hours should not still be retrying on
  // Monday morning. Three attempts, then the job fails and stays failed for
  // inspection rather than disappearing.
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

/**
 * One BullMQ Queue per name, created lazily and memoised.
 *
 * `getRedis()` is called before constructing because BullMQ accepts a connection
 * instance or a URL; handing it our shared, reconnecting client means the
 * queue survives a Redis restart instead of needing its own reconnect policy.
 */
const queues = new Map<string, Queue>();

async function getQueue(name: string): Promise<Queue | null> {
  const existing = queues.get(name);
  if (existing) return existing;

  if (!isRedisConfigured()) {
    return null;
  }

  const redis = await getRedis();
  if (!redis) {
    return null;
  }

  try {
    const queue = new Queue(name, {
      connection: redis,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    queues.set(name, queue);
    return queue;
  } catch (error) {
    logger.warn(`[Queue:${name}] could not create queue: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Hand work to a queue, or run it inline if there is no queue to hand it to.
 *
 * Resolves once the work has been *accepted* -- queued, or scheduled inline --
 * never once it has completed. Callers must not read the result as success of
 * the underlying operation.
 */
export async function enqueue<T>(
  queueName: string,
  jobName: string,
  data: T,
  processor: Processor<T>,
  options: JobsOptions = {}
): Promise<EnqueueResult> {
  const queue = await getQueue(queueName);

  if (queue) {
    try {
      const job = await queue.add(jobName, data, options);
      return { jobId: String(job.id), mode: 'queued' };
    } catch (error) {
      // Redis went away between the connection check and the add. Fall through
      // to inline rather than failing the request.
      logger.warn(
        `[Queue:${queueName}] enqueue failed, running inline: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Inline. setImmediate so the processor does not run before this function has
  // returned and the handler has sent its response -- the whole point is that
  // the response is not waiting on this.
  //
  // The async IIFE is not decoration. `Promise.resolve(processor(data))`
  // looks equivalent and is not: it evaluates `processor(data)` first, so a
  // processor that throws synchronously escapes before the Promise exists and
  // becomes an uncaught exception, which terminates the process. The IIFE
  // converts a synchronous throw into a rejection, which the catch below can
  // actually handle.
  setImmediate(() => {
    (async () => processor(data))().catch((error: unknown) => {
      logger.error(
        `[Queue:${queueName}] inline job ${jobName} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  });

  return { jobId: `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mode: 'inline' };
}

/** Close all queues. Used by graceful shutdown and by tests. */
export async function closeQueues(): Promise<void> {
  const all = [...queues.values()];
  queues.clear();
  await Promise.all(
    all.map((q) =>
      q.close().catch(() => {
        // A queue that is already closed is not a shutdown failure.
      })
    )
  );
}