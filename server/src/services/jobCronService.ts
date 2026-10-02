import cron from 'node-cron';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import * as jobService from './job.service';
import { jobLifecycleService } from './jobLifecycle.service';

/** Minutes past the scheduled start after which a job counts as a no-show. */
const NO_SHOW_GRACE_MINUTES = 30;

export class JobCronService {
  private cronJob: any = null;
  /** Guards against a slow run overlapping the next tick. */
  private running = false;

  start() {
    this.cronJob = cron.schedule('* * * * *', async () => {
      // Without this, a run that takes longer than the interval stacks up and
      // the same job gets marked missed twice.
      if (this.running) return;
      this.running = true;
      try {
        await this.processOverdueJobs();
        await this.processNoShows();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[JobCron] Error processing jobs: ${message}`);
      } finally {
        this.running = false;
      }
    });

    logger.info('[JobCron] Started - running every minute');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('[JobCron] Stopped');
    }
  }

  private async processOverdueJobs() {
    // Stalled check-ins (IN_PROGRESS far past the scheduled end) are a real
    // operational signal, but acting on them needs a per-business grace policy
    // that does not exist yet. Left explicit rather than half-implemented.
  }

  /**
   * Mark jobs as no-shows once they are more than the grace period past their
   * scheduled start.
   *
   * The previous version loaded every SCHEDULED job on the platform each minute
   * and filtered in memory, and combined the schedule by string-concatenating a
   * DateTime with a time string — which discarded the time entirely and compared
   * against midnight. Both are fixed here: the window is bounded in the query and
   * the schedule is composed in code.
   */
  private async processNoShows() {
    const now = new Date();
    // scheduledDate is stored as a date; a job can only be a no-show once its
    // whole day is in the past, so today is excluded and filtered precisely below.
    const earliest = new Date(now);
    earliest.setUTCDate(earliest.getUTCDate() - 1);
    earliest.setUTCHours(0, 0, 0, 0);

    const jobs = await prisma.crmJob.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: { lt: earliest },
      },
      select: { id: true, scheduledDate: true, scheduledTime: true },
      take: 500,
    });

    let marked = 0;

    for (const job of jobs) {
      try {
        const start = composeStart(job.scheduledDate, job.scheduledTime);
        if (!start) continue;

        const minutesLate = (now.getTime() - start.getTime()) / (1000 * 60);
        if (minutesLate <= NO_SHOW_GRACE_MINUTES) continue;

        await jobLifecycleService.handleNoShow(job.id);
        marked += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[JobCron] Error processing job ${job.id} for no-show: ${message}`);
      }
    }

    if (marked > 0) {
      logger.info(`[JobCron] Marked ${marked} job(s) as no-show`);
    }
  }
}

/**
 * Compose the real start instant from the stored date and `HH:mm` time.
 * Returns null for a time that will not parse, so one malformed row cannot make
 * the whole job count a no-show.
 */
// scheduledTime is nullable in the schema: the booking flow does not always set
// one, and the merged CRM model kept that optional rather than tightening it.
// A job with no time cannot be judged late, so this returns null and the
// caller skips it — which is why the guard below is load-bearing.
function composeStart(scheduledDate: Date, scheduledTime: string | null): Date | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((scheduledTime || '').trim());
  if (!match) return null;

  const start = new Date(scheduledDate);
  start.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);

  if (Number.isNaN(start.getTime())) return null;
  return start;
}

export const jobCronService = new JobCronService();