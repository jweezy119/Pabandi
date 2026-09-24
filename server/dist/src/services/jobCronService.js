"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobCronService = exports.JobCronService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const jobLifecycle_service_1 = require("./jobLifecycle.service");
class JobCronService {
    constructor() {
        this.cronJob = null;
        // Additional cron jobs could be added here for:
        // - Recurring job series generation
        // - Invoice generation (though this is better handled via webhooks or events)
        // - Deposit expiry, etc.
    }
    start() {
        // Run every minute to check for overdue jobs and no-shows
        this.cronJob = node_cron_1.default.schedule('* * * * *', async () => {
            try {
                await this.processOverdueJobs();
                await this.processNoShows();
            }
            catch (error) {
                logger_1.logger.error('[JobCron] Error processing jobs:', error);
            }
        });
        logger_1.logger.info('[JobCron] Started - running every minute');
    }
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            logger_1.logger.info('[JobCron] Stopped');
        }
    }
    async processOverdueJobs() {
        // Find jobs that are IN_PROGRESS but have been checked in for too long
        // This would be based on business rules - for now, we'll skip this
        // as the check-out logic handles lateness
    }
    async processNoShows() {
        const now = new Date();
        // Find scheduled jobs where the scheduled time has passed by more than 30 minutes
        const jobs = await database_1.prisma.crmJob.findMany({
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
                    await jobLifecycle_service_1.jobLifecycleService.handleNoShow(job.id);
                }
            }
            catch (error) {
                logger_1.logger.error(`[JobCron] Error processing job ${job.id} for no-show:`, error);
            }
        }
    }
}
exports.JobCronService = JobCronService;
exports.jobCronService = new JobCronService();
//# sourceMappingURL=jobCronService.js.map