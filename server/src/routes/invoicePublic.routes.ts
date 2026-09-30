import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustCore } from '../trust/trust-core';
import { emailService } from '../services/email.service';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

/**
 * GET /api/v1/public/invoices/:invoiceId
 * Fetch invoice details for a payment link.
 * No authentication required — this is a public endpoint.
 */
router.get('/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        business: { select: { id: true, name: true, solanaAddress: true, logoUrl: true } },
        client: { select: { id: true, name: true, email: true } },
      },
    });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    let metadata: any = {};
    try {
      const parsed = JSON.parse(invoice.notes || '{}');
      metadata = parsed.metadata || {};
    } catch { }

    res.json({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      subtotal: invoice.subtotal,
      currency: metadata.currency || 'USDC',
      dueDate: invoice.dateDue,
      lineItems: invoice.lineItems,
      notes: invoice.notes,
      paidAt: invoice.paidAt,
      paymentLink: invoice.paymentLink,
      transactionHash: metadata.transactionHash,
      requireEscrow: metadata.requireEscrow,
      business: {
        name: invoice.business?.name,
        logoUrl: (invoice.business as any)?.logoUrl,
        solanaAddress: (invoice.business as any)?.solanaAddress,
      },
      clientName: invoice.client?.name,
    });
  } catch (err) {
    logger.error(`[InvoicePublic] Error fetching invoice: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.post('/:invoiceId/pay', writeLimiter, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { transactionHash } = req.body;
    
    // We import from invoice.service dynamically to avoid circular dependencies if any
    const { payPublicInvoice } = await import('../services/invoice.service');
    const updated = await payPublicInvoice(invoiceId, transactionHash);

    if (updated.client?.passportId) {
      const isLate = new Date() > new Date(updated.dateDue);
      const eventName = isLate ? 'invoice.paid_late' : 'invoice.paid_on_time';
      await trustCore.emit(eventName, {
        passportId: updated.client.passportId,
        invoiceId: updated.id,
        amount: updated.subtotal,
      });
    }

    res.json(updated);
  } catch (err: any) {
    logger.error(`[InvoicePublic] Error paying invoice: ${err.message}`);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:invoiceId/claim-paid', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'payment_claimed' },
    });

    const business = await prisma.business.findUnique({ where: { id: invoice.businessId } });
    if (business) {
      emailService.sendPaymentClaimed(business, updated, invoice.client);
    }

    if (invoice.client?.passportId) {
      await trustCore.emit('invoice.payment_claimed', {
        passportId: invoice.client.passportId,
        invoiceId: invoice.id,
        amount: invoice.subtotal,
      });
    }

    res.json(updated);
  } catch (err: any) {
    logger.error(`[InvoicePublic] Error claiming paid: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
