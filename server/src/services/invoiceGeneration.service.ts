import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class InvoiceGenerationService {
  /**
   * Generate an invoice from a completed job
   */
  async generateInvoiceFromJob(jobId: string) {
    const job = await prisma.crmJob.findUnique({
      where: { id: jobId },
      include: { client: true }
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'COMPLETE') {
      throw new Error(`Job is not complete. Current status: ${job.status}`);
    }

    // Get the business ID from the job's service business
    const serviceBusiness = await prisma.crmServiceBusiness.findUnique({
      where: { id: job.serviceBusinessId }
    });

    if (!serviceBusiness) {
      throw new Error('Service business not found');
    }

    // Calculate the due date (today + 7 days as default)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // Prepare line items
    const lineItems = [
      {
        description: job.serviceType || 'Service',
        amount: job.priceEstimate || 0
      }
    ];

    // Calculate subtotal
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Apply deposit if applicable
    let depositApplied = 0;
    if (job.depositStatus === 'funded' && job.depositAmount) {
      depositApplied = job.depositAmount;
      // In a real implementation, we would also update the deposit status to 'released'
      // and create a credit line item for the deposit
    }

    const finalAmount = Math.max(0, subtotal - depositApplied);

    // Create the invoice
    const invoice = await prisma.invoice.create({
      data: {
        businessId: serviceBusiness.id,
        clientId: job.clientId,
        // Optionally add jobId relation if we add it to the Invoice model
        // jobId: job.id,
        number: await this.generateInvoiceNumber(serviceBusiness.id),
        dateDue: dueDate,
        status: 'SENT', // Start as sent (ready to be paid)
        lineItems: JSON.stringify(lineItems),
        subtotal: finalAmount,
        // Notes could include job details
        notes: `Generated from job ${job.id}: ${job.serviceType || 'Service'}`
      }
    });

    // Update the deposit status to 'released' if it was funded
    if (job.depositStatus === 'funded') {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: {
          depositStatus: 'released'
        }
      });
    }

    logger.info(`[InvoiceGeneration] Generated invoice ${invoice.number} from job ${jobId}`);

    return invoice;
  }

  /**
   * Generate a new invoice number
   */
  private async generateInvoiceNumber(businessId: string): Promise<string> {
    const count = await prisma.invoice.count({ where: { businessId } });
    return `INV-${String(count + 1).padStart(4, '0')}`;
  }
}

export const invoiceGenerationService = new InvoiceGenerationService();
