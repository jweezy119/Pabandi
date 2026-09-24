"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateClientScore = calculateClientScore;
exports.updateClientScore = updateClientScore;
exports.getClientStage = getClientStage;
exports.refreshClientTrust = refreshClientTrust;
const database_1 = require("../utils/database");
/**
 * Calculate a reliability score (0-100) for a CRM client based on job history.
 *
 * Scoring:
 *   - Baseline: 50
 *   - Completion rate: +30 max (proportional to completed/total)
 *   - Cancel penalty: -15 max (proportional to cancelled/total)
 *   - Repeat bonus: +5 for 3+ jobs, +10 for 10+ jobs
 *   - Default penalty: -20 per completed job whose escrow was REFUNDED
 */
function calculateClientScore(clientId, jobs) {
    let score = 50; // baseline
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
    // Default penalty: -20 per defaulted escrow
    const defaults = completed.filter(j => j.escrowStatus === 'REFUNDED').length;
    score -= defaults * 20;
    return Math.max(0, Math.min(100, Math.round(score)));
}
/**
 * Recalculate and persist a client's reliabilityScore.
 */
async function updateClientScore(clientId) {
    const jobs = await database_1.prisma.crmJob.findMany({
        where: { clientId },
    });
    const score = calculateClientScore(clientId, jobs);
    await database_1.prisma.crmClient.update({
        where: { id: clientId },
        data: { reliabilityScore: score },
    });
    return score;
}
/**
 * Determine the lifecycle stage of a client.
 *
 * Priority order (first match wins):
 *   - vip:        10+ completed AND score > 80
 *   - at_risk:    score < 30 OR has a defaulted escrow (REFUNDED)
 *   - repeat:     2+ completed
 *   - booked:     has 1+ job
 *   - verified:   phone exists OR score > 0
 *   - lead:       no jobs (fallback)
 */
function getClientStage(client, jobs) {
    const completed = jobs.filter(j => j.status === 'COMPLETED');
    const total = jobs.length;
    const score = client.reliabilityScore ?? 50;
    const hasDefaultedEscrow = completed.some(j => j.escrowStatus === 'REFUNDED');
    if (total === 0)
        return 'lead';
    if (completed.length >= 10 && score > 80)
        return 'vip';
    if (score < 30 || hasDefaultedEscrow)
        return 'at_risk';
    if (completed.length >= 2)
        return 'repeat';
    if (total >= 1)
        return 'booked';
    if (client.phone || score > 0)
        return 'verified';
    return 'lead';
}
/**
 * Recalculate score + stage for a client and persist both.
 */
async function refreshClientTrust(clientId) {
    const client = await database_1.prisma.crmClient.findUnique({
        where: { id: clientId },
    });
    if (!client)
        throw new Error(`Client ${clientId} not found`);
    const jobs = await database_1.prisma.crmJob.findMany({
        where: { clientId },
    });
    const score = calculateClientScore(clientId, jobs);
    const stage = getClientStage(client, jobs);
    await database_1.prisma.crmClient.update({
        where: { id: clientId },
        data: { reliabilityScore: score, stage },
    });
    return { score, stage };
}
//# sourceMappingURL=crm-reliability.service.js.map