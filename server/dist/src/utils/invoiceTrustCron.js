"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startInvoiceTrustCron = startInvoiceTrustCron;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("./logger");
const database_1 = require("./database");
const invoice_trust_service_1 = require("../services/invoice-trust.service");
function startInvoiceTrustCron() {
    // Daily at 03:00 AM
    node_cron_1.default.schedule('0 3 * * *', async () => {
        logger_1.logger.info('[InvoiceTrustCron] Running daily overdue detection...');
        try {
            const now = new Date();
            const sentInvoices = await database_1.prisma.invoice.findMany({
                where: {
                    status: 'sent',
                    dateDue: { lt: now },
                },
            });
            if (sentInvoices.length === 0) {
                logger_1.logger.info('[InvoiceTrustCron] No overdue invoices to process.');
                return;
            }
            for (const invoice of sentInvoices) {
                try {
                    // Check if already overdue (should not be, but safety)
                    if (invoice.status !== 'sent')
                        continue;
                    // Update invoice status to overdue first
                    const oldStatus = invoice.status;
                    const newStatus = 'overdue';
                    await database_1.prisma.invoice.update({
                        where: { id: invoice.id },
                        data: { status: newStatus },
                    });
                    // Process via invoice trust service (will emit event, update paymentScore, record event)
                    await invoice_trust_service_1.invoiceTrustService.processInvoiceStatusChange(invoice.id, invoice.clientId, oldStatus, newStatus, now, false, // isPaidOnTime
                    true, // isOverdue
                    false // isDefaulted
                    );
                }
                catch (err) {
                    logger_1.logger.error(`[InvoiceTrustCron] Failed to process invoice ${invoice.id}: ${err.message}`, err);
                }
            }
            logger_1.logger.info(`[InvoiceTrustCron] Processed ${sentInvoices.length} overdue invoices.`);
        }
        catch (err) {
            logger_1.logger.error('[InvoiceTrustCron] Daily overdue detection failed', err);
        }
    });
    logger_1.logger.info('[InvoiceTrustCron] Scheduled daily overdue detection at 03:00 AM');
}
//# sourceMappingURL=invoiceTrustCron.js.map