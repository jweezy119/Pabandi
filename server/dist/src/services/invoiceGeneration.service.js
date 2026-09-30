"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceGenerationService = exports.InvoiceGenerationService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
class InvoiceGenerationService {
    /**
     * Generate an invoice from a completed job
     */
    async generateInvoiceFromJob(jobId) {
        const job = await database_1.prisma.crmJob.findUnique({
            where: { id: jobId },
            include: { client: true }
        });
        if (!job) {
            throw new Error('Job not found');
        }
        if (job.status !== 'COMPLETE') {
            throw new Error(`Job is not complete. Current status: ${job.status}`);
        }
        // Validate that the job has a businessId
        if (!job.businessId) {
            throw new Error('Business ID not found on job');
        }
        // Calculate the due date (today + 7 days as default)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        // Prepare line items
        const lineItems = [
            {
                description: job.serviceType || 'Service',
                amount: job.price || 0
            }
        ];
        // Calculate subtotal
        const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
        // Apply deposit if applicable
        let depositApplied = 0;
        if (job.escrowStatus === 'FUNDED' && job.price > 0) {
            // Assuming full price is escrowed when FUNDED
            depositApplied = job.price;
        }
        const finalAmount = Math.max(0, subtotal - depositApplied);
        // Create the invoice
        const invoice = await database_1.prisma.invoice.create({
            data: {
                businessId: job.businessId,
                clientId: job.clientId,
                // Optionally add jobId relation if we add it to the Invoice model
                // jobId: job.id,
                number: await this.generateInvoiceNumber(job.businessId),
                dateDue: dueDate,
                status: 'SENT', // Start as sent (ready to be paid)
                lineItems: JSON.stringify(lineItems),
                subtotal: finalAmount,
                // Notes could include job details
                notes: `Generated from job ${job.id}: ${job.serviceType || 'Service'}`
            }
        });
        if (job.escrowStatus === 'FUNDED') {
            await database_1.prisma.crmJob.update({
                where: { id: jobId },
                data: {
                    escrowStatus: 'RELEASED'
                }
            });
        }
        logger_1.logger.info(`[InvoiceGeneration] Generated invoice ${invoice.number} from job ${jobId}`);
        return invoice;
    }
    /**
     * Generate a new invoice number
     */
    async generateInvoiceNumber(businessId) {
        const count = await database_1.prisma.invoice.count({ where: { businessId } });
        return `INV-${String(count + 1).padStart(4, '0')}`;
    }
}
exports.InvoiceGenerationService = InvoiceGenerationService;
exports.invoiceGenerationService = new InvoiceGenerationService();
//# sourceMappingURL=invoiceGeneration.service.js.map