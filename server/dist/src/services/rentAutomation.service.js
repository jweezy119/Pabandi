"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rentAutomationService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const notification_service_1 = require("./notification.service");
exports.rentAutomationService = {
    /**
     * Daily job: scan active leases, generate pending rent payments for the period,
     * send reminders, and apply late fees after grace period.
     */
    async runDailyRentAutomation() {
        const result = { processed: 0, remindersSent: 0, lateFeesApplied: 0, errors: [] };
        try {
            const now = new Date();
            const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
            // 1. Find all ACTIVE leases
            const activeLeases = await database_1.prisma.propertyLease.findMany({
                where: { status: 'ACTIVE' },
                include: { property: { include: { manager: { include: { user: { select: { email: true, firstName: true } } } } } } },
            });
            for (const lease of activeLeases) {
                try {
                    const tenantEmail = lease.tenantEmail;
                    const managerEmail = lease.property?.manager?.user?.email;
                    const propertyTitle = lease.property?.title || 'Property';
                    if (!tenantEmail || !managerEmail)
                        continue;
                    // 2. Check if rent payment already exists for this month
                    const existing = await database_1.prisma.rentPayment.findFirst({
                        where: {
                            propertyId: lease.propertyId || undefined,
                            unitId: lease.unitId || undefined,
                            tenantEmail,
                            dueDate: { gte: new Date(`${currentMonth}-01`) },
                        },
                    });
                    if (!existing) {
                        // Generate a rent payment record
                        await database_1.prisma.rentPayment.create({
                            data: {
                                propertyId: lease.propertyId || '',
                                unitId: lease.unitId || undefined,
                                tenantEmail,
                                amount: lease.rentAmount,
                                dueDate: new Date(`${currentMonth}-01`),
                                status: 'PENDING',
                                method: null,
                                reference: `lease:${lease.id}:${currentMonth}`,
                                notes: `Auto-generated rent for ${currentMonth}`,
                            },
                        });
                        // Send reminder
                        try {
                            await notification_service_1.notificationService.sendEmail({
                                to: tenantEmail,
                                subject: `Rent Payment Reminder - ${propertyTitle}`,
                                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <h2 style="color: #2563eb;">Rent Payment Reminder</h2>
                    <p>Hello,</p>
                    <p>This is a reminder that your rent of <strong>$${lease.rentAmount.toFixed(2)}</strong> is due on <strong>${new Date(`${currentMonth}-01`).toLocaleDateString()}</strong>.</p>
                    <p>Please make your payment to avoid late fees.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                    <p style="font-size: 12px; color: #777;">Property: ${propertyTitle}</p>
                  </div>
                `,
                            });
                            result.remindersSent++;
                        }
                        catch (e) {
                            logger_1.logger.warn('[rent] reminder failed', e.message);
                        }
                    }
                    // 3. Check for late payments
                    const dueDate = existing?.dueDate || new Date(`${currentMonth}-01`);
                    const graceEnd = new Date(dueDate);
                    graceEnd.setDate(graceEnd.getDate() + (lease.lateGraceDays || 5));
                    if (now > graceEnd && existing?.status === 'PENDING') {
                        // Mark as late and apply late fee
                        const lateFee = lease.lateFee || 0;
                        if (lateFee > 0) {
                            await database_1.prisma.rentPayment.update({
                                where: { id: existing.id },
                                data: {
                                    status: 'LATE',
                                    amount: existing.amount + lateFee,
                                    notes: `${existing.notes || ''}\nLate fee applied: $${lateFee}`,
                                },
                            });
                            // Log financial record
                            await database_1.prisma.propertyFinancial.create({
                                data: {
                                    propertyId: lease.propertyId || '',
                                    unitId: lease.unitId || undefined,
                                    type: 'INCOME',
                                    category: 'LATE_FEE',
                                    amount: lateFee,
                                    description: `Late fee applied to ${tenantEmail}`,
                                    tenantEmail,
                                },
                            });
                            result.lateFeesApplied++;
                        }
                    }
                    result.processed++;
                }
                catch (e) {
                    result.errors.push(`Lease ${lease.id}: ${e.message}`);
                }
            }
        }
        catch (e) {
            logger_1.logger.error('[rent] automation failed', e);
            result.errors.push(`Global: ${e.message}`);
        }
        return result;
    },
    /**
     * Mark a rent payment as paid.
     */
    async markRentPaid(paymentId, method, reference) {
        const payment = await database_1.prisma.rentPayment.update({
            where: { id: paymentId },
            data: { status: 'PAID', paidAt: new Date(), method, reference },
            include: { property: { include: { manager: { include: { user: { select: { email: true } } } } } } },
        });
        // Log financial record
        await database_1.prisma.propertyFinancial.create({
            data: {
                propertyId: payment.propertyId,
                unitId: payment.unitId || undefined,
                type: 'INCOME',
                category: 'RENT',
                amount: payment.amount,
                description: `Rent payment from ${payment.tenantEmail}`,
                tenantEmail: payment.tenantEmail,
            },
        });
        // Send receipt
        try {
            const propertyTitle = payment.property?.title || 'Property';
            await notification_service_1.notificationService.sendEmail({
                to: payment.tenantEmail,
                subject: `Rent Payment Receipt - ${propertyTitle}`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #2563eb;">Payment Receipt</h2>
            <p>Thank you for your rent payment of <strong>$${payment.amount.toFixed(2)}</strong>.</p>
            <p>Payment method: ${method}</p>
            <p>Reference: ${reference || payment.id}</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #777;">Property: ${propertyTitle}</p>
          </div>
        `,
            });
        }
        catch (e) {
            logger_1.logger.warn('[rent] receipt failed', e.message);
        }
        return payment;
    },
};
//# sourceMappingURL=rentAutomation.service.js.map