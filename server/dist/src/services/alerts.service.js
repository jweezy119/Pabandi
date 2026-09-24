"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAlerts = generateAlerts;
exports.getActiveAlerts = getActiveAlerts;
exports.dismissAlert = dismissAlert;
const database_1 = require("../utils/database");
/**
 * Generate alerts for a business based on client, job, and employee data.
 * This is the core rule engine of the trust-aware revenue system.
 */
async function generateAlerts(serviceBusinessId) {
    const alerts = [];
    const now = new Date();
    // ── Client-based alerts ─────────────────────────────────────────────────────
    const clients = await database_1.prisma.crmClient.findMany({
        where: { serviceBusinessId },
        include: { jobs: true },
    });
    for (const client of clients) {
        const jobs = client.jobs;
        const completed = jobs.filter(j => j.status === 'COMPLETED');
        const score = client.reliabilityScore ?? 50;
        const hasDefaulted = completed.some(j => j.escrowStatus === 'REFUNDED');
        // Client score < 30 → CRITICAL
        if (score < 30) {
            alerts.push({
                type: 'critical',
                title: `Low reliability score: ${score}`,
                message: 'Require 50% deposit or decline',
                entityType: 'client',
                entityId: client.id,
            });
        }
        // Client score < 50 → WARNING
        else if (score < 50) {
            alerts.push({
                type: 'warning',
                title: `Below-average reliability: ${score}`,
                message: 'Recommend deposit for next booking',
                entityType: 'client',
                entityId: client.id,
            });
        }
        // 3+ completed → OPPORTUNITY: net-30 terms
        if (completed.length >= 3 && score >= 50) {
            alerts.push({
                type: 'opportunity',
                title: 'Repeat client eligible',
                message: 'Offer net-30 terms',
                entityType: 'client',
                entityId: client.id,
            });
        }
        // 10+ completed AND score > 80 → VIP
        if (completed.length >= 10 && score > 80) {
            alerts.push({
                type: 'opportunity',
                title: 'VIP client',
                message: 'VIP client — priority matching',
                entityType: 'client',
                entityId: client.id,
            });
        }
        // Cross-module trust history available (client has phone from external module)
        if (client.phone && client.phoneVerified) {
            alerts.push({
                type: 'info',
                title: 'Verified client contact',
                message: 'Cross-module trust history available',
                entityType: 'client',
                entityId: client.id,
            });
        }
    }
    // ── Job-based alerts ────────────────────────────────────────────────────────
    const jobs = await database_1.prisma.crmJob.findMany({
        where: { serviceBusinessId },
    });
    for (const job of jobs) {
        // Job escrow held > 30 days → WARNING
        if (job.escrowStatus === 'HELD' && job.createdAt) {
            const daysHeld = Math.floor((now.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            if (daysHeld > 30) {
                alerts.push({
                    type: 'warning',
                    title: 'Escrow held over 30 days',
                    message: 'Release or dispute',
                    entityType: 'job',
                    entityId: job.id,
                });
            }
        }
    }
    // ── Employee/Provider alerts ────────────────────────────────────────────────
    const employees = await database_1.prisma.crmEmployee.findMany({
        where: { serviceBusinessId, isActive: true },
    });
    for (const emp of employees) {
        // Provider no bookings 14+ days → INFO
        const lastBooking = emp.lastBookingAt;
        const daysSinceBooking = lastBooking
            ? Math.floor((now.getTime() - lastBooking.getTime()) / (1000 * 60 * 60 * 24))
            : 999; // No booking recorded → consider stale
        if (daysSinceBooking >= 14) {
            alerts.push({
                type: 'info',
                title: 'Provider inactive',
                message: 'Consider promotion',
                entityType: 'provider',
                entityId: emp.id,
            });
        }
    }
    return alerts;
}
/**
 * Get active (non-dismissed) alerts for a business.
 * Generates fresh alerts from current data and merges with stored ones.
 */
async function getActiveAlerts(serviceBusinessId) {
    // Generate seeds from current data
    const seeds = await generateAlerts(serviceBusinessId);
    // Upsert alerts — avoid duplicates by entityId + title key
    const existingAlerts = await database_1.prisma.crmAlert.findMany({
        where: { serviceBusinessId, dismissed: false },
    });
    const existingKeys = new Set(existingAlerts.map(a => `${a.entityId}:${a.title}`));
    // Insert only new alerts that don't already exist
    const newSeeds = seeds.filter(s => !existingKeys.has(`${s.entityId}:${s.title}`));
    if (newSeeds.length > 0) {
        await database_1.prisma.crmAlert.createMany({
            data: newSeeds.map(s => ({
                serviceBusinessId,
                ...s,
            })),
        });
    }
    // Return all active alerts
    return database_1.prisma.crmAlert.findMany({
        where: { serviceBusinessId, dismissed: false },
        orderBy: { createdAt: 'desc' },
    });
}
/**
 * Dismiss an alert by ID.
 */
async function dismissAlert(alertId, serviceBusinessId) {
    return database_1.prisma.crmAlert.updateMany({
        where: { id: alertId, serviceBusinessId },
        data: { dismissed: true, dismissedAt: new Date() },
    });
}
//# sourceMappingURL=alerts.service.js.map