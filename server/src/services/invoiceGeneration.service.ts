import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class InvoiceGenerationService {
  /**
   * Generate an invoice from a completed job.
   *
   * The invoice is keyed on the platform `Business` id (not the CRM
   * service-business id) because invoice trust events resolve a passport by
   * walking client → serviceBusiness → Business → owner. Writing the CRM id here
   * would break that traversal and silently stop every invoice from moving a
   * trust score.
   */
  async generateInvoiceFromJob(jobId: string) {
    const job = await prisma.crmJob.findUnique({
      where: { id: jobId },
      include: { client: true },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'COMPLETED') {
      throw new Error(`Job is not complete. Current status: ${job.status}`);
    }

    const serviceBusiness = await prisma.crmServiceBusiness.findUnique({
      where: { id: job.serviceBusinessId },
    });

    if (!serviceBusiness) {
      throw new Error('Service business not found');
    }

    const businessId = serviceBusiness.businessId;
    if (!businessId) {
      throw new Error(
        'Service business is not linked to a platform business — cannot invoice'
      );
    }

    // Calculate the due date (today + 7 days as default)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // Prepare line items
    const lineItems = [
      {
        description: job.serviceType || 'Service',
        amount: job.price || 0,
      },
    ];

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // A job whose escrow is still held has already been (partially) paid, so
    // the invoice nets out the escrowed amount rather than billing it twice.
    const escrowHeld = job.escrowStatus === 'HELD';
    const depositApplied = escrowHeld ? Math.min(job.price || 0, subtotal) : 0;
    const finalAmount = Math.max(0, subtotal - depositApplied);

    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        clientId: job.clientId,
        number: await this.generateInvoiceNumber(businessId),
        dateDue: dueDate,
        status: 'sent', // ready to be paid
        lineItems,
        subtotal: finalAmount,
        notes: `Generated from job ${job.id}: ${job.serviceType || 'Service'}`,
      },
    });

    logger.info(
      `[InvoiceGeneration] Generated invoice ${invoice.number} from job ${jobId}`
    );

    return invoice;
  }

  /**
   * Generate a new invoice number, scoped per business and per year so the
   * sequence is readable and the unique index is far less contended.
   */
  private async generateInvoiceNumber(businessId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await prisma.invoice.count({
        where: { businessId, number: { startsWith: prefix } },
      });
      const number = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const clash = await prisma.invoice.findUnique({
        where: { number },
        select: { id: true },
      });
      if (!clash) return number;
    }

    // Fall back to something certainly unique rather than looping forever.
    return `${prefix}${Date.now().toString(36).toUpperCase()}`;
  }
}

export const invoiceGenerationService = new InvoiceGenerationService();