"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobLifecycleService = exports.JobLifecycleService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const event_bus_service_1 = require("./event-bus.service");
const trustAuditWriter_1 = require("./trustAuditWriter");
class JobLifecycleService {
    /**
     * Check in for a job
     */
    async checkInJob(jobId, userId, latitude, longitude) {
        const job = await database_1.prisma.crmJob.findUnique({
            where: { id: jobId },
            include: { client: true }
        });
        if (!job) {
            throw new Error('Job not found');
        }
        if (job.status !== 'SCHEDULED') {
            throw new Error(`Job is not in SCHEDULED status. Current status: ${job.status}`);
        }
        // Update job with check-in timestamp and status
        const updatedJob = await database_1.prisma.crmJob.update({
            where: { id: jobId },
            data: {
                status: 'IN_PROGRESS',
                checkedInAt: new Date(),
                // In a real app, we would also store latitude/longitude if provided
            }
        });
        // Fire trust event: delivery.checked_in
        event_bus_service_1.eventBus.emitEvent('delivery.checked_in', {
            jobId,
            clientId: job.clientId,
            timestamp: new Date(),
            latitude,
            longitude
        });
        // Audit log entry
        await trustAuditWriter_1.trustAuditWriter.enqueue({
            userId: job.clientId || '',
            previousScore: 0, // This would be the previous deliveryScore - we'd need to fetch it
            newScore: 0, // This would be the new deliveryScore
            changeReason: 'Job checked in',
            component: 'DELIVERY_JOB',
            severity: 'neutral',
            metadata: { jobId, action: 'check_in' },
            methodology: '1.0.0'
        });
        logger_1.logger.info(`[JobLifecycle] Job ${jobId} checked in`);
        return updatedJob;
    }
    /**
     * Check out from a job
     */
    async checkOutJob(jobId, userId) {
        const job = await database_1.prisma.crmJob.findUnique({
            where: { id: jobId },
            include: { client: true }
        });
        if (!job) {
            throw new Error('Job not found');
        }
        if (job.status !== 'IN_PROGRESS') {
            throw new Error(`Job is not in IN_PROGRESS status. Current status: ${job.status}`);
        }
        const now = new Date();
        const checkedInAt = job.checkedInAt || new Date(); // Fallback to now if not set
        const actualDurationMinutes = Math.max(0, (now.getTime() - checkedInAt.getTime()) / (1000 * 60));
        const scheduledDurationMinutes = job.durationMinutes || 0;
        const isLate = actualDurationMinutes > scheduledDurationMinutes + 15; // More than 15 min over scheduled time
        // Update job with check-out timestamp, status, and actual duration
        const updatedJob = await database_1.prisma.crmJob.update({
            where: { id: jobId },
            data: {
                status: 'COMPLETE',
                checkedOutAt: new Date(),
                actualDurationMinutes: Math.round(actualDurationMinutes)
            }
        });
        // Determine if job was on time or late based on scheduled vs actual time
        // For simplicity, we'll consider it late if actual duration > scheduled duration + 15min
        const deliveryEventType = isLate ? 'delivery.late' : 'delivery.on_time';
        const deliveryDelta = isLate ? -10 : 5; // Example deltas - would be configured based on trust system
        // Fire trust event: delivery.on_time OR delivery.late
        event_bus_service_1.eventBus.emitEvent(deliveryEventType, {
            jobId,
            clientId: job.clientId,
            workerId: userId, // Assuming userId is the worker
            actualDurationMinutes,
            scheduledDurationMinutes,
            timestamp: new Date()
        });
        // Update worker's deliveryScore (in a real app, this would update the worker's TrustPassport)
        // For now, we'll just log it
        logger_1.logger.info(`[JobLifecycle] Updating deliveryScore for worker ${userId} by ${deliveryDelta} points`);
        // Audit log entry for delivery score change
        await trustAuditWriter_1.trustAuditWriter.enqueue({
            userId, // workerId
            previousScore: 0, // Would fetch actual previous score
            newScore: deliveryDelta, // Would be previousScore + deliveryDelta
            changeReason: `Job ${isLate ? 'late' : 'on time'} completion`,
            component: 'DELIVERY_WORKER',
            severity: deliveryDelta > 0 ? 'positive' : 'negative',
            weightUsed: 1.0, // No decay for immediate events
            metadata: { jobId, action: 'check_out', isLate, actualDurationMinutes, scheduledDurationMinutes },
            methodology: '1.0.0'
        });
        logger_1.logger.info(`[JobLifecycle] Job ${jobId} checked out${isLate ? ' (late)' : ''}`);
        // Auto-generate invoice (would call invoice generation service)
        // Auto-release deposit from escrow (would call escrow service)
        // These would be implemented in separate services
        return { updatedJob, isLate, actualDurationMinutes };
    }
    /**
     * Handle no-show detection (called by cron job)
     */
    async handleNoShow(jobId) {
        const job = await database_1.prisma.crmJob.findUnique({
            where: { id: jobId },
            include: { client: true }
        });
        if (!job) {
            return;
        }
        if (job.status !== 'SCHEDULED') {
            return; // Already processed
        }
        const now = new Date();
        const scheduledTime = new Date(`${job.scheduledDate}T${job.scheduledTime}`);
        // Check if it's been more than 30 minutes since scheduled time
        const minutesLate = (now.getTime() - scheduledTime.getTime()) / (1000 * 60);
        if (minutesLate > 30) {
            // Update job status to missed
            await database_1.prisma.crmJob.update({
                where: { id: jobId },
                data: {
                    status: 'MISSED'
                }
            });
            // Fire event: delivery.missed (affects business owner's deliveryScore, not client)
            event_bus_service_1.eventBus.emitEvent('delivery.missed', {
                jobId,
                clientId: job.clientId,
                timestamp: now,
                minutesLate
            });
            // In a real app, this would show a prompt to the business owner:
            // "Did [Client] no-show? [Yes / No / Reschedule]"
            // And based on the response:
            // Yes → fire booking.no_show (affects client's showUpScore), release deposit to business
            // No → business missed it, no client penalty
            // Reschedule → creates a new job
            logger_1.logger.info(`[JobLifecycle] Job ${jobId} marked as MISSED (${minutesLate.toFixed(1)} minutes late)`);
        }
    }
    /**
     * Process recurring jobs - called by cron job or when creating a recurring job
     */
    async processRecurringJobSeries(parentJobId) {
        // This would generate the child jobs in a series
        // Implementation would depend on the recurrence pattern
        // For now, we'll just log that this needs to be implemented
        logger_1.logger.info(`[JobLifecycle] Processing recurring job series for parent ${parentJobId}`);
        // Actual implementation would:
        // 1. Get the parent job details
        // 2. Calculate the series dates based on recurrence
        // 3. Create child jobs for each date in the series
        // 4. Set parentJobId and seriesIndex on each child job
    }
}
exports.JobLifecycleService = JobLifecycleService;
exports.jobLifecycleService = new JobLifecycleService();
//# sourceMappingURL=jobLifecycle.service.js.map