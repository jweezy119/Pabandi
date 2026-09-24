"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateClientScore = calculateClientScore;
exports.getClientStage = getClientStage;
exports.initializeTrustCore = initializeTrustCore;
const event_bus_service_1 = require("./event-bus.service");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
// ─── Reliability Score Calculator ────────────────────────────────────────────
function calculateClientScore(jobs) {
    let score = 50;
    const completed = jobs.filter(j => j.status === 'COMPLETED');
    const cancelled = jobs.filter(j => j.status === 'CANCELLED');
    const total = jobs.length;
    if (total === 0)
        return score;
    // Completion rate: +30 max
    score += (completed.length / total) * 30;
    // Cancel penalty: -15 max
    score -= (cancelled.length / total) * 15;
    // Repeat bonus: +5 for 3+ jobs, +10 for 10+
    if (total >= 10)
        score += 10;
    else if (total >= 3)
        score += 5;
    // Default penalty: -20 per refunded escrow
    const defaults = jobs.filter(j => j.escrowStatus === 'REFUNDED' || j.escrowStatus === 'DISPUTED').length;
    score -= defaults * 20;
    return Math.max(0, Math.min(100, Math.round(score)));
}
// ─── Client Lifecycle Stage ─────────────────────────────────────────────────
function getClientStage(client, jobs) {
    const completed = jobs.filter((j) => j.status === 'COMPLETED');
    const hasDefaults = jobs.some((j) => j.escrowStatus === 'REFUNDED' || j.escrowStatus === 'DISPUTED');
    if (jobs.length === 0)
        return 'lead';
    if (client.phone || client.phoneVerified)
        return 'verified';
    if (completed.length >= 10 && (client.reliabilityScore || 50) > 80)
        return 'vip';
    if (hasDefaults || (client.reliabilityScore || 50) < 30)
        return 'at_risk';
    if (completed.length >= 2)
        return 'repeat';
    if (jobs.length >= 1)
        return 'booked';
    return 'lead';
}
// ─── Event Handlers ─────────────────────────────────────────────────────────
function initializeTrustCore() {
    // score.changed → update CrmClient.reliabilityScore
    event_bus_service_1.eventBus.subscribe('score.changed', async (event) => {
        const clientId = event.clientId || event.data?.clientId;
        if (!clientId)
            return;
        try {
            const jobs = await database_1.prisma.crmJob.findMany({ where: { clientId } });
            const score = calculateClientScore(jobs);
            await database_1.prisma.crmClient.update({
                where: { id: clientId },
                data: { reliabilityScore: score },
            });
            logger_1.logger.info(`[TrustCore] Updated client ${clientId} score → ${score}`);
        }
        catch (err) {
            logger_1.logger.error(`[TrustCore] Score update failed for ${clientId}: ${err.message}`);
        }
    });
    // escrow.funded → update CrmJob.escrowStatus
    event_bus_service_1.eventBus.subscribe('escrow.funded', async (event) => {
        const jobId = event.jobId || event.data?.jobId;
        if (!jobId)
            return;
        try {
            await database_1.prisma.crmJob.update({
                where: { id: jobId },
                data: { escrowStatus: 'HELD' },
            });
            logger_1.logger.info(`[TrustCore] Job ${jobId} escrow funded → HELD`);
        }
        catch (err) {
            logger_1.logger.error(`[TrustCore] Escrow fund update failed for ${jobId}: ${err.message}`);
        }
    });
    // escrow.released → update CrmJob.escrowStatus + trigger score recalculation
    event_bus_service_1.eventBus.subscribe('escrow.released', async (event) => {
        const jobId = event.jobId || event.data?.jobId;
        const clientId = event.clientId || event.data?.clientId;
        if (!jobId)
            return;
        try {
            await database_1.prisma.crmJob.update({
                where: { id: jobId },
                data: { escrowStatus: 'RELEASED' },
            });
            // Recalculate score on release (positive signal)
            if (clientId) {
                event_bus_service_1.eventBus.publish({
                    type: 'score.changed',
                    clientId,
                    data: { trigger: 'escrow.released', jobId },
                    timestamp: new Date(),
                });
            }
            logger_1.logger.info(`[TrustCore] Job ${jobId} escrow released → RELEASED`);
        }
        catch (err) {
            logger_1.logger.error(`[TrustCore] Escrow release update failed for ${jobId}: ${err.message}`);
        }
    });
    // escrow.disputed → flag client + update job status
    event_bus_service_1.eventBus.subscribe('escrow.disputed', async (event) => {
        const jobId = event.jobId || event.data?.jobId;
        const clientId = event.clientId || event.data?.clientId;
        if (!jobId)
            return;
        try {
            await database_1.prisma.crmJob.update({
                where: { id: jobId },
                data: { escrowStatus: 'DISPUTED' },
            });
            // Recalculate score (dispute is negative)
            if (clientId) {
                event_bus_service_1.eventBus.publish({
                    type: 'score.changed',
                    clientId,
                    data: { trigger: 'escrow.disputed', jobId },
                    timestamp: new Date(),
                });
            }
            logger_1.logger.info(`[TrustCore] Job ${jobId} escrow disputed`);
        }
        catch (err) {
            logger_1.logger.error(`[TrustCore] Escrow dispute update failed for ${jobId}: ${err.message}`);
        }
    });
    // checkin.verified → mark job complete + update provider stats
    event_bus_service_1.eventBus.subscribe('checkin.verified', async (event) => {
        const jobId = event.jobId || event.data?.jobId;
        if (!jobId)
            return;
        try {
            await database_1.prisma.crmJob.update({
                where: { id: jobId },
                data: { status: 'COMPLETED', completedAt: new Date() },
            });
            logger_1.logger.info(`[TrustCore] Job ${jobId} check-in verified → COMPLETED`);
        }
        catch (err) {
            logger_1.logger.error(`[TrustCore] Checkin verify failed for ${jobId}: ${err.message}`);
        }
    });
    // passport.linked → enrich client with cross-module data
    event_bus_service_1.eventBus.subscribe('passport.linked', async (event) => {
        const clientId = event.clientId || event.data?.clientId;
        if (!clientId)
            return;
        try {
            logger_1.logger.info(`[TrustCore] Passport linked for client ${clientId}`, event.data?.passportData);
        }
        catch (err) {
            logger_1.logger.error(`[TrustCore] Passport link failed for ${clientId}: ${err.message}`);
        }
    });
    logger_1.logger.info('[TrustCore] All event handlers initialized');
}
//# sourceMappingURL=trust-core.service.js.map