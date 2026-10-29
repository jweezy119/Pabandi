import { Queue, Worker, type Job } from 'bullmq';
import { getRedis, isRedisConfigured } from '../lib/redis';
import { enqueue, type EnqueueResult } from './connection';
import { scoutAgent, ScoutTarget } from '../services/scout-agent.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export const SCOUT_QUEUE = 'pabandi-scout';
export const SCOUT_JOB_NAME = 'scout-daily-run';

const MAX_EMAILS_PER_DAY = 10;
const DRY_RUN = process.env.SCOUT_DRY_RUN === 'true';

/**
 * Check how many scouting emails have been sent today.
 * Resets at midnight UTC.
 */
async function getTodaysEmailCount(): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const count = await prisma.scoutedTarget.count({
    where: {
      outreachStatus: 'emailed',
      emailedAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });
  return count;
}

/**
 * Check if a target has already been scouted (deduplication).
 */
async function isAlreadyScouted(email: string): Promise<boolean> {
  const existing = await prisma.scoutedTarget.findUnique({
    where: { email },
    select: { id: true },
  });
  return existing != null;
}

/**
 * Record a target as scouted (deduplication record).
 */
async function recordScoutedTarget(target: ScoutTarget): Promise<void> {
  await prisma.scoutedTarget.upsert({
    where: { email: target.email ?? target.id },
    update: {
      outreachStatus: 'pending',
      name: target.name,
      website: target.website,
      agentType: target.agentType,
      source: target.source,
    },
    create: {
      email: target.email ?? target.id,
      name: target.name,
      website: target.website,
      agentType: target.agentType,
      source: target.source,
      outreachStatus: 'pending',
    },
  });
}

/**
 * Mark a target as emailed.
 */
async function markTargetEmailed(email: string): Promise<void> {
  await prisma.scoutedTarget.update({
    where: { email },
    data: {
      outreachStatus: 'emailed',
      emailedAt: new Date(),
    },
  });
}

/**
 * Run one full scout cycle: discover, research, outreach (with safeguards).
 */
export async function runScoutCycle(): Promise<{
  discovered: number;
  researched: number;
  emailed: number;
  skipped: number;
  errors: string[];
}> {
  const results = {
    discovered: 0,
    researched: 0,
    emailed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // ── Safeguard: rate limit ────────────────────────────────────────
  const todaysCount = await getTodaysEmailCount();
  const remainingSlots = MAX_EMAILS_PER_DAY - todaysCount;

  if (remainingSlots <= 0) {
    logger.info(
      `[Scout] Daily rate limit reached (${todaysCount}/${MAX_EMAILS_PER_DAY}), skipping outreach`
    );
    return results;
  }

  // ── Discover ─────────────────────────────────────────────────────
  let targets: ScoutTarget[];
  try {
    targets = await scoutAgent.discoverTargets();
    results.discovered = targets.length;
    logger.info(`[Scout] Discovered ${targets.length} targets`);
  } catch (err) {
    const msg = `Discovery failed: ${err instanceof Error ? err.message : String(err)}`;
    results.errors.push(msg);
    logger.error(`[Scout] ${msg}`);
    return results;
  }

  // ── Filter: deduplicate ──────────────────────────────────────────
  const newTargets: ScoutTarget[] = [];
  for (const target of targets) {
    if (!target.email) {
      results.skipped++;
      continue;
    }
    const already = await isAlreadyScouted(target.email);
    if (already) {
      results.skipped++;
      continue;
    }
    newTargets.push(target);
  }

  logger.info(
    `[Scout] ${newTargets.length} new targets after dedup (${results.skipped} skipped)`
  );

  // ── Research + Outreach ──────────────────────────────────────────
  for (const target of newTargets) {
    if (results.emailed >= remainingSlots) {
      logger.info(`[Scout] Rate limit reached during cycle, stopping`);
      break;
    }

    if (DRY_RUN) {
      logger.info(`[Scout][DRY_RUN] Would email ${target.email}: ${target.name}`);
      logger.info(`[Scout][DRY_RUN] Would research: ${target.name}`);
      results.emailed++;
      continue;
    }

    // Research
    let research: { summary: string; pitchHook: string };
    try {
      research = await scoutAgent.researchTarget(target);
      results.researched++;
    } catch (err) {
      const msg = `Research failed for ${target.name}: ${err instanceof Error ? err.message : String(err)}`;
      results.errors.push(msg);
      logger.warn(`[Scout] ${msg}`);
      // Still try outreach with a generic pitch
      research = {
        summary: 'AI agent discovered via discovery source',
        pitchHook: 'Monetize your data through Pabandi escrow',
      };
    }

    // Record as scouted (deduplication)
    await recordScoutedTarget(target);

    // Outreach
    try {
      const sent = await scoutAgent.outreachTarget(target, research.pitchHook);
      if (sent.sent) {
        await markTargetEmailed(target.email);
        results.emailed++;
        logger.info(`[Scout] Emailed ${target.email}`);
      } else {
        results.skipped++;
        logger.warn(
          `[Scout] Failed to email ${target.email}: ${sent.error}`
        );
      }
    } catch (err) {
      const msg = `Outreach failed for ${target.email}: ${err instanceof Error ? err.message : String(err)}`;
      results.errors.push(msg);
      logger.error(`[Scout] ${msg}`);
      results.skipped++;
    }
  }

  logger.info(
    `[Scout] Cycle complete: discovered=${results.discovered} researched=${results.researched} emailed=${results.emailed} skipped=${results.skipped} errors=${results.errors.length}`
  );
  return results;
}

/**
 * Enqueue a scout run job (called by the admin endpoint or scheduler).
 */
export async function enqueueScoutRun(): Promise<EnqueueResult> {
  const queue = await getQueue(SCOUT_QUEUE);
  if (!queue) {
    // Run inline if no queue
    const result = await runScoutCycle();
    return {
      jobId: `inline-${Date.now()}`,
      mode: 'inline',
    } as EnqueueResult;
  }

  const job = await queue.add(SCOUT_JOB_NAME, { triggeredAt: new Date().toISOString() }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 10,
    removeOnFail: 50,
  });
  return { jobId: String(job.id), mode: 'queued' };
}

async function getQueue(name: string): Promise<Queue | null> {
  if (!isRedisConfigured()) {
    return null;
  }
  const redis = await getRedis();
  if (!redis) return null;
  try {
    return new Queue(name, { connection: redis });
  } catch {
    return null;
  }
}

/**
 * Create the BullMQ worker for the scout queue.
 * Runs once per day at 8 AM UTC via cron pattern.
 */
export function createScoutWorker(): Worker | null {
  if (!isRedisConfigured()) {
    logger.warn('[Scout Worker] Redis not configured, worker not started');
    return null;
  }

  const redis = getRedis();
  // Note: getRedis returns a promise, but Worker constructor needs the connection
  // We handle this in the worker factory pattern below
  return null; // Will be created in registerScoutWorker
}

/**
 * Factory to create and register the scout worker with an existing Redis connection.
 */
export async function registerScoutWorker(
  redisConnection: Awaited<ReturnType<typeof getRedis>>
): Promise<Worker | null> {
  if (!redisConnection) return null;

  const worker = new Worker(
    SCOUT_QUEUE,
    async (job: Job) => {
      logger.info(`[Scout Worker] Job ${job.id} started`);
      const result = await runScoutCycle();
      logger.info(
        `[Scout Worker] Job ${job.id} complete: ${JSON.stringify(result)}`
      );
      return result;
    },
    {
      connection: redisConnection,
      concurrency: 1,
      limiter: { max: 1, duration: 60_000 }, // Max 1 run per minute
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      `[Scout Worker] Job ${job?.id ?? 'unknown'} failed: ${err instanceof Error ? err.message : String(err)}`
    );
  });

  worker.on('completed', (job) => {
    logger.info(`[Scout Worker] Job ${job.id} completed`);
  });

  await worker.waitUntilReady();
  logger.info(`[Scout Worker] ready on queue ${SCOUT_QUEUE}`);

  return worker;
}

/**
 * Cron-style check: should we run the scout today?
 * Runs at 8 AM UTC. Returns true if it's time.
 */
export function shouldRunScoutNow(): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();

  // Run at 8:00-8:59 UTC (8 AM UTC window)
  return utcHour === 8 && utcMinute < 15;
}
