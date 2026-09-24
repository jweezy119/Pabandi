"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmAutomationService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const notification_service_1 = require("./notification.service");
exports.crmAutomationService = {
    // ── Rent Generation ──────────────────────────────────────────────────────────
    async generateMonthlyRent() {
        const result = { generated: 0, errors: [] };
        try {
            const now = new Date();
            const currentMonth = now.toISOString().slice(0, 7);
            const schedules = await database_1.prisma.rentSchedule.findMany({
                where: { isActive: true },
                include: {
                    unit: { include: { property: { include: { manager: true } } } },
                    tenant: true,
                    lease: true,
                },
            });
            for (const schedule of schedules) {
                try {
                    const dueDate = new Date(`${currentMonth}-${String(schedule.dueDay).padStart(2, '0')}`);
                    // Check if payment already exists
                    const existing = await database_1.prisma.rentPayment.findFirst({
                        where: {
                            unitId: schedule.unitId,
                            tenantEmail: schedule.tenant.email,
                            dueDate: { gte: new Date(`${currentMonth}-01`), lt: new Date(`${currentMonth}-31`) },
                        },
                    });
                    if (!existing) {
                        await database_1.prisma.rentPayment.create({
                            data: {
                                propertyId: schedule.unit.propertyId,
                                unitId: schedule.unitId,
                                tenantEmail: schedule.tenant.email,
                                amount: schedule.amount,
                                dueDate,
                                status: 'PENDING',
                                reference: `schedule:${schedule.id}:${currentMonth}`,
                                notes: `Auto-generated rent for ${currentMonth} (schedule ${schedule.id})`,
                            },
                        });
                        // Create ledger entry
                        await database_1.prisma.tenantLedger.create({
                            data: {
                                tenantId: schedule.tenantId,
                                type: 'RENT',
                                amount: schedule.amount,
                                description: `Monthly rent for ${currentMonth}`,
                                reference: `schedule:${schedule.id}`,
                                balanceAfter: schedule.amount,
                                date: now,
                            },
                        });
                        result.generated++;
                    }
                    await database_1.prisma.rentSchedule.update({
                        where: { id: schedule.id },
                        data: { lastGenerated: now },
                    });
                }
                catch (e) {
                    result.errors.push(`Schedule ${schedule.id}: ${e.message}`);
                }
            }
        }
        catch (e) {
            logger_1.logger.error('[crm] generateMonthlyRent failed', e);
            result.errors.push(`Global: ${e.message}`);
        }
        return result;
    },
    // ── Late Fee Engine ─────────────────────────────────────────────────────────
    async applyLateFees() {
        const result = { applied: 0, totalAmount: 0, errors: [] };
        try {
            const now = new Date();
            const overduePayments = await database_1.prisma.rentPayment.findMany({
                where: {
                    status: { in: ['PENDING', 'LATE'] },
                    dueDate: { lt: now },
                },
                include: {
                    property: { include: { manager: { include: { user: true } } } },
                    unit: true,
                },
            });
            for (const payment of overduePayments) {
                try {
                    const lease = await database_1.prisma.propertyLease.findFirst({
                        where: { unitId: payment.unitId, tenantEmail: payment.tenantEmail, status: 'ACTIVE' },
                    });
                    const graceDays = lease?.lateGraceDays || 5;
                    const lateFee = lease?.lateFee || 50;
                    const graceEnd = new Date(payment.dueDate);
                    graceEnd.setDate(graceEnd.getDate() + graceDays);
                    if (now > graceEnd && lateFee > 0) {
                        const daysLate = Math.floor((now.getTime() - graceEnd.getTime()) / (1000 * 60 * 60 * 24));
                        // Check if late fee already applied this month
                        const existingFee = await database_1.prisma.tenantLedger.findFirst({
                            where: {
                                tenantId: lease ? (await database_1.prisma.propertyTenant.findFirst({ where: { email: payment.tenantEmail } }))?.id || '' : '',
                                type: 'LATE_FEE',
                                date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
                            },
                        });
                        if (!existingFee) {
                            const tenant = await database_1.prisma.propertyTenant.findFirst({
                                where: { email: payment.tenantEmail },
                            });
                            if (tenant) {
                                await database_1.prisma.tenantLedger.create({
                                    data: {
                                        tenantId: tenant.id,
                                        type: 'LATE_FEE',
                                        amount: lateFee,
                                        description: `Late fee: ${daysLate} days overdue`,
                                        reference: payment.id,
                                        balanceAfter: lateFee,
                                        date: now,
                                    },
                                });
                            }
                            await database_1.prisma.rentPayment.update({
                                where: { id: payment.id },
                                data: { status: 'LATE' },
                            });
                            // Escalation: notify manager for repeated late payments
                            const lateCount = await database_1.prisma.tenantLedger.count({
                                where: {
                                    tenantId: tenant?.id || '',
                                    type: 'LATE_FEE',
                                    date: { gte: new Date(now.getFullYear(), now.getMonth() - 3, 1) },
                                },
                            });
                            if (lateCount >= 3 && payment.property?.manager?.user?.email) {
                                await notification_service_1.notificationService.sendEmail({
                                    to: payment.property.manager.user.email,
                                    subject: `⚠️ Tenant ${payment.tenantEmail} - Repeated Late Payments`,
                                    html: `<p>Tenant ${payment.tenantEmail} has ${lateCount} late payments in the last 3 months. Consider action.</p>`,
                                });
                            }
                            result.applied++;
                            result.totalAmount += lateFee;
                        }
                    }
                }
                catch (e) {
                    result.errors.push(`Payment ${payment.id}: ${e.message}`);
                }
            }
        }
        catch (e) {
            logger_1.logger.error('[crm] applyLateFees failed', e);
            result.errors.push(`Global: ${e.message}`);
        }
        return result;
    },
    // ── Lease Expiry Notifications ───────────────────────────────────────────────
    async checkLeaseExpirations() {
        const result = { notified: 0, errors: [] };
        const thresholds = [60, 30, 7];
        try {
            const now = new Date();
            for (const days of thresholds) {
                const target = new Date(now);
                target.setDate(target.getDate() + days);
                target.setHours(0, 0, 0, 0);
                const targetEnd = new Date(target);
                targetEnd.setHours(23, 59, 59, 999);
                const leases = await database_1.prisma.propertyLease.findMany({
                    where: {
                        status: 'ACTIVE',
                        endDate: { gte: target, lte: targetEnd },
                    },
                    include: {
                        property: { include: { manager: { include: { user: true } } } },
                    },
                });
                for (const lease of leases) {
                    try {
                        if (lease.property?.manager?.user?.email) {
                            await notification_service_1.notificationService.sendEmail({
                                to: lease.property.manager.user.email,
                                subject: `Lease Expiring in ${days} days - ${lease.tenantEmail}`,
                                html: `
                  <p>Lease for <strong>${lease.tenantEmail}</strong> at ${lease.property.title} expires on ${lease.endDate.toLocaleDateString()}.</p>
                  <p><strong>Action:</strong> Send renewal offer or begin move-out process.</p>
                `,
                            });
                            result.notified++;
                        }
                    }
                    catch (e) {
                        result.errors.push(`Lease ${lease.id}: ${e.message}`);
                    }
                }
            }
        }
        catch (e) {
            logger_1.logger.error('[crm] checkLeaseExpirations failed', e);
            result.errors.push(`Global: ${e.message}`);
        }
        return result;
    },
    // ── Maintenance Auto-Assignment ──────────────────────────────────────────────
    async autoAssignVendor(maintenanceId) {
        try {
            const maintenance = await database_1.prisma.propertyMaintenance.findUnique({
                where: { id: maintenanceId },
            });
            if (!maintenance)
                return null;
            const vendors = await database_1.prisma.maintenanceVendor.findMany({
                where: { isActive: true, managerId: maintenance.managerId },
            });
            if (vendors.length === 0)
                return null;
            // Score vendors by: category match, rating, jobs completed
            let bestVendor = vendors[0];
            let bestScore = -1;
            for (const vendor of vendors) {
                let score = 0;
                // Category match
                if (vendor.specialties.some(s => maintenance.description?.toLowerCase().includes(s.toLowerCase()))) {
                    score += 40;
                }
                // Rating
                score += vendor.rating * 10;
                // Jobs completed (capped)
                score += Math.min(vendor.jobsCompleted, 100) * 0.5;
                if (score > bestScore) {
                    bestScore = score;
                    bestVendor = vendor;
                }
            }
            await database_1.prisma.propertyMaintenance.update({
                where: { id: maintenanceId },
                data: { vendorId: bestVendor.id, vendorName: bestVendor.name },
            });
            return { vendorId: bestVendor.id, score: bestScore };
        }
        catch (e) {
            logger_1.logger.error('[crm] autoAssignVendor failed', e);
            return null;
        }
    },
    // ── Financial Reports ────────────────────────────────────────────────────────
    async generatePropertyFinancials(propertyId, startDate, endDate) {
        const financials = await database_1.prisma.propertyFinancial.findMany({
            where: { propertyId, date: { gte: startDate, lte: endDate } },
        });
        const rentCollected = financials
            .filter(f => f.type === 'INCOME' && f.category === 'RENT')
            .reduce((s, f) => s + f.amount, 0);
        const lateFees = financials
            .filter(f => f.type === 'INCOME' && f.category === 'LATE_FEE')
            .reduce((s, f) => s + f.amount, 0);
        const maintenanceExpenses = financials
            .filter(f => f.type === 'EXPENSE' && f.category === 'MAINTENANCE')
            .reduce((s, f) => s + f.amount, 0);
        const totalExpenses = financials
            .filter(f => f.type === 'EXPENSE')
            .reduce((s, f) => s + f.amount, 0);
        const totalIncome = financials
            .filter(f => f.type === 'INCOME')
            .reduce((s, f) => s + f.amount, 0);
        const noi = totalIncome - totalExpenses;
        // Property value for cap rate (if stored in notes or use default)
        const property = await database_1.prisma.propertyManagerProperty.findUnique({ where: { id: propertyId } });
        const estimatedValue = property ? (property.rentAmount || 0) * 200 : null; // rough estimate
        const capRate = estimatedValue ? (noi / estimatedValue) * 100 : null;
        return {
            propertyId,
            period: { start: startDate, end: endDate },
            totalIncome,
            totalExpenses,
            rentCollected,
            lateFees,
            maintenanceExpenses,
            netOperatingIncome: noi,
            estimatedValue,
            capRate,
        };
    },
    // ── Cash Flow Forecast ───────────────────────────────────────────────────────
    async generateCashFlowForecast(propertyId, months = 12) {
        const now = new Date();
        const activeLeases = await database_1.prisma.propertyLease.findMany({
            where: { propertyId, status: 'ACTIVE' },
        });
        const monthlyRent = activeLeases.reduce((s, l) => s + l.rentAmount, 0);
        const units = await database_1.prisma.propertyUnit.findMany({ where: { propertyId } });
        const occupiedUnits = units.filter(u => u.status === 'OCCUPIED').length;
        const vacancyRate = units.length > 0 ? (units.length - occupiedUnits) / units.length : 0;
        const forecast = [];
        for (let i = 0; i < months; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
            forecast.push({
                month: date.toISOString().slice(0, 7),
                expectedRent: monthlyRent * (1 - vacancyRate),
                vacancyRate: vacancyRate * 100,
            });
        }
        return { propertyId, months, monthlyRent, vacancyRate, forecast };
    },
    // ── Tenant Risk Scoring ──────────────────────────────────────────────────────
    async calculateTenantRiskScore(tenantId) {
        const factors = [];
        let score = 100; // start perfect, deduct
        const tenant = await database_1.prisma.propertyTenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            return { score: 0, band: 'HIGH', factors: [{ label: 'Tenant not found', impact: -100 }] };
        // Payment history (on-time vs late ratio)
        const ledger = await database_1.prisma.tenantLedger.findMany({ where: { tenantId } });
        const lateFees = ledger.filter(l => l.type === 'LATE_FEE').length;
        const totalPayments = ledger.filter(l => l.type === 'RENT').length;
        const lateRatio = totalPayments > 0 ? lateFees / totalPayments : 0;
        const paymentPenalty = Math.min(lateRatio * 50, 50);
        score -= paymentPenalty;
        factors.push({ label: 'Late payment ratio', impact: -paymentPenalty });
        // Screening band
        const screening = await database_1.prisma.propertyScreening.findFirst({
            where: { tenantEmail: tenant.email },
            orderBy: { screenedAt: 'desc' },
        });
        if (screening) {
            const bandPenalty = screening.band === 'HIGH' ? 30 : screening.band === 'MEDIUM' ? 10 : 0;
            score -= bandPenalty;
            factors.push({ label: `Screening: ${screening.band}`, impact: -bandPenalty });
        }
        // Disputes
        const disputes = tenant.totalDisputes || 0;
        const disputePenalty = disputes * 10;
        score -= disputePenalty;
        if (disputes > 0)
            factors.push({ label: `${disputes} disputes`, impact: -disputePenalty });
        // Maintenance request frequency
        const maintenanceCount = await database_1.prisma.propertyMaintenance.count({
            where: { tenantEmail: tenant.email },
        });
        const maintPenalty = maintenanceCount > 5 ? 10 : 0;
        score -= maintPenalty;
        if (maintPenalty > 0)
            factors.push({ label: 'High maintenance requests', impact: -maintPenalty });
        // Lease violations (notes-based)
        const leases = await database_1.prisma.propertyLease.findMany({ where: { tenantEmail: tenant.email } });
        const violationPenalty = leases.filter(l => l.notes?.toLowerCase().includes('violation')).length * 15;
        score -= violationPenalty;
        if (violationPenalty > 0)
            factors.push({ label: 'Lease violations', impact: -violationPenalty });
        score = Math.max(0, Math.min(100, score));
        const band = score >= 70 ? 'LOW' : score >= 40 ? 'MEDIUM' : 'HIGH';
        return { score: Math.round(score), band, factors };
    },
};
//# sourceMappingURL=crmAutomation.service.js.map