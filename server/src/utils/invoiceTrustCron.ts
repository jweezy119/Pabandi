import cron from 'node-cron';
import { logger } from './logger';
import { prisma } from './database';
import { invoiceTrustService } from '../services/invoice-trust.service';

export function startInvoiceTrustCron() {
  // Daily at 03:00 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('[InvoiceTrustCron] Running daily overdue detection...');
    try {
      const now = new Date();
      const sentInvoices = await prisma.invoice.findMany({
        where: {
          status: 'sent',
          dateDue: { lt: now },
        },
      });

      if (sentInvoices.length === 0) {
        logger.info('[InvoiceTrustCron] No overdue invoices to process.');
        return;
      }

      for (const invoice of sentInvoices) {
        try {
          // Check if already overdue (should not be, but safety)
          if (invoice.status !== 'sent') continue;
          
          // Update invoice status to overdue first
          const oldStatus = invoice.status;
          const newStatus = 'overdue';
          
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: newStatus },
          });

          // Process via invoice trust service (will emit event, update paymentScore, record event)
          await invoiceTrustService.processInvoiceStatusChange(
            invoice.id,
            invoice.clientId,
            oldStatus,
            newStatus,
            now,
            false, // isPaidOnTime
            true,  // isOverdue
            false  // isDefaulted
          );
        } catch (err: any) {
          logger.error(`[InvoiceTrustCron] Failed to process invoice ${invoice.id}: ${err.message}`, err);
        }
      }

      logger.info(`[InvoiceTrustCron] Processed ${sentInvoices.length} overdue invoices.`);
    } catch (err: any) {
      logger.error('[InvoiceTrustCron] Daily overdue detection failed', err);
    }
  });

  logger.info('[InvoiceTrustCron] Scheduled daily overdue detection at 03:00 AM');
}
