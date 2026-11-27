import { logger } from '../utils/logger';
import { runAllRetentionPolicies, initializeRetentionPolicies } from './dataRetention.service';

let cronJob: NodeJS.Timeout | null = null;

/**
 * Start the data retention cron job
 * Runs daily at 3 AM UTC by default
 */
export function startDataRetentionCron(cronExpression: string = '0 3 * * *'): void {
  // Parse cron expression (minute hour day month weekday)
  // For simplicity, we'll use a daily interval in ms
  // In production, consider using a proper cron library like 'node-cron'
  
  const runJob = async () => {
    logger.info('Starting scheduled data retention job');
    try {
      const result = await runAllRetentionPolicies();
      logger.info(`Data retention job completed. Total records deleted: ${result.totalDeleted}`);
      
      // Log individual policy results
      for (const [policy, res] of Object.entries(result.results)) {
        if (res.error) {
          logger.warn(`Policy ${policy}: ${res.error}`);
        } else {
          logger.info(`Policy ${policy}: ${res.recordsDeleted} records deleted`);
        }
      }
    } catch (error) {
      logger.error('Data retention job failed:', error);
    }
  };

  // Calculate initial delay until next 3 AM UTC
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setUTCHours(3, 0, 0, 0);
  
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }
  
  const initialDelay = nextRun.getTime() - now.getTime();
  
  logger.info(`Data retention cron scheduled. First run at: ${nextRun.toISOString()}`);
  
  // Run initial job after delay
  setTimeout(() => {
    runJob();
    
    // Then run daily (24 hours = 86400000 ms)
    cronJob = setInterval(runJob, 24 * 60 * 60 * 1000);
  }, initialDelay);
}

/**
 * Stop the data retention cron job
 */
export function stopDataRetentionCron(): void {
  if (cronJob) {
    clearInterval(cronJob);
    cronJob = null;
    logger.info('Data retention cron stopped');
  }
}

/**
 * Initialize retention policies on startup
 */
export async function initializeDataRetention(): Promise<void> {
  try {
    await initializeRetentionPolicies();
    startDataRetentionCron();
  } catch (error) {
    logger.error('Failed to initialize data retention:', error);
  }
}

/**
 * Manually trigger retention job (for admin/testing)
 */
export async function triggerRetentionJob(): Promise<{ results: Record<string, { success: boolean; recordsDeleted: number; error?: string }>; totalDeleted: number }> {
  logger.info('Manual data retention job triggered');
  return runAllRetentionPolicies();
}