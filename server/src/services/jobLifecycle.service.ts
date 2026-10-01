import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import {
  checkInJob,
  checkOutJob,
  handleNoShow,
} from './crm.service';

/**
 * Job lifecycle — thin façade over `crm.service`.
 *
 * This class previously held its own copies of check-in, check-out and no-show
 * while `crm.service` held slightly different ones, and the no-show cron called
 * *these* while the API called *those*. The two had already diverged: this file
 * set status `'COMPLETE'` where the rest of the platform uses `'COMPLETED'`, and
 * emitted a different event set, so a job marked missed by cron was invisible to
 * the trust accounting that the API path fed.
 *
 * It is kept as a class because `jobCronService` depends on the shape, and
 * because it is the natural home for the recurring-series work that still needs
 * doing. Every lifecycle transition now has exactly one implementation.
 */
export class JobLifecycleService {
  checkInJob(jobId: string, userId: string, latitude?: number, longitude?: number) {
    return checkInJob(jobId, userId, latitude, longitude);
  }

  checkOutJob(jobId: string, userId: string) {
    return checkOutJob(jobId, userId);
  }

  handleNoShow(jobId: string) {
    return handleNoShow(jobId);
  }

  /**
   * Expand a repeating job into its child occurrences.
   *
   * `CrmJob` has no `parentJobId`/`seriesIndex` columns yet, so this cannot be
   * implemented honestly. It is left as an explicit no-op that reports the
   * blocker rather than silently succeeding, so nothing builds on the assumption
   * that recurring jobs work.
   */
  async processRecurringJobSeries(_parentJobId: string): Promise<void> {
    const parent = await prisma.crmJob.findUnique({
      where: { id: _parentJobId },
      select: { id: true },
    });
    if (!parent) {
      throw new Error('Parent job not found');
    }
    logger.warn(
      '[JobLifecycle] Recurring job series is not implemented: CrmJob has no parentJobId/seriesIndex columns'
    );
  }
}

export const jobLifecycleService = new JobLifecycleService();