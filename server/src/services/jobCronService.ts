import cron from 'node-cron';
import { logger } from './logger';
import { prisma } from './database';
import { jobLifecycleService } from './jobLifecycle.service';

export class JobCronService {
  private cronJob: any = null;

  start() {
    // Run every minute to check for overdue jobs and no-shows
    this.cronJob = cron.schedule('* * * * *', async () => {
      try {
        await this.processOverdueJobs();
        await this.processNoShows();
      } catch (error) {
        logger.error('[JobCron] Error processing jobs:', error);
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
    // Find jobs that are IN_PROGRESS but have been checked in for too long
    // This would be based on business rules - for now, we'll skip this
    // as the check-out logic handles lateness
  }

  private async processNoShows() {
    const now = new Date();
    
    // Find scheduled jobs where the scheduled time has passed by more than 30 minutes
    const jobs = await prisma.crmJob.findMany({
      where: {
        status: 'SCHEDULED',
        // We need to compare scheduledDate + scheduledTime with now
        // Since these are stored separately, we need to do this in the query
        // For simplicity, we'll fetch all scheduled jobs and filter in memory
        // In a production app, this would be optimized
      }
    });

    for (const job of jobs) {
      try {
        const scheduledTime = new Date(`${job.scheduledDate}T${job.scheduledTime}`);
        const minutesLate = (now.getTime() - scheduledTime.getTime()) / (1000 * 60);
        
        if (minutesLate > 30) {
          await jobLifecycleService.handleNoShow(job.id);
        }
      } catch (error) {
        logger.error(`[JobCron] Error processing job ${job.id} for no-show:`, error);
      }
    }
  }

  // Additional cron jobs could be added here for:
  // - Recurring job series generation
  // - Invoice generation (though this is better handled via webhooks or events)
  // - Deposit expiry, etc.
}

export const jobCronService = new JobCronService();
