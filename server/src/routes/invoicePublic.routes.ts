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
        // Only `client` is a real relation on Invoice. There is no
        // `business` relation — Invoice.businessId is a bare String with no
        // `@relation`, and Business has no `solanaAddress` column. The old
        // `include: { business: ... }` asked Prisma for a relation that does
        // not exist, so this threw on every request and the pay page returned
        // 500 for every invoice.
        client: { select: { id: true, name: true } },
      },
    });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // The business is a separate lookup on businessId, and may not resolve if
    // the row was deleted — the pay page must still render.
    const business = invoice.businessId
      ? await prisma.business.findUnique({
          where: { id: invoice.businessId },
          select: { id: true, name: true, logoUrl: true, currency: true },
        })
      : null;

    let metadata: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(invoice.notes || '{}') as { metadata?: Record<string, unknown> };
      metadata = parsed.metadata ?? {};
    } catch {
      // notes was plain text, not the JSON envelope. Not an error.
    }

    // lineItems is stored as a JSON *string*. It was previously forwarded raw,
    // so the client received `"[{\"service\":...}]"` — a string where it
    // expected an array. Parsed here, with the string as a fallback.
    let lineItems: unknown = [];
    try {
      lineItems = typeof invoice.lineItems === 'string'
        ? JSON.parse(invoice.lineItems)
        : invoice.lineItems;
    } catch {
      lineItems = [];
    }

    res.json({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      subtotal: invoice.subtotal,
      // The pay page renders this as a currency code. It defaulted to 'USDC',
      // which is not a fiat currency, and ignored the business's actual one.
      currency: (metadata.currency as string | undefined) ?? business?.currency ?? 'USD',
      dueDate: invoice.dateDue,
      lineItems,
      notes: metadata.text ?? null,
      paidAt: invoice.paidAt,
      paymentLink: invoice.paymentLink,
      transactionHash: metadata.transactionHash,
      requireEscrow: metadata.requireEscrow,
      business: {
        id: business?.id ?? null,
        name: business?.name ?? null,
        logoUrl: business?.logoUrl ?? null,
      },
      clientName: invoice.client?.name ?? null,
    });
  } catch (err) {
    logger.error(`[InvoicePublic] Error fetching invoice: ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * POST /api/v1/public/invoices/:invoiceId/pay
 *
 * No auth: this is the public payment link, and the invoice id is the secret.
 *
 * Two things are guarded here, because the endpoint accepts a caller-supplied
 * `transactionHash` and previously took it on trust:
 *  - The invoice must exist and not already be paid. Re-marking a paid invoice
 *    re-fired the trust event and re-credited the referral fee share.
 *  - The transaction hash must be present. A missing hash used to mark the
 *    invoice paid with no settlement reference at all, so the business had no
 *    way to trace the money.
 *
 * This is a *claim* that a payment happened, not proof of it. Confirming an
 * on-chain transfer is a separate step; what is enforced here is that the claim
 * is recorded once, with a reference, and cannot be replayed.
 */
router.post('/:invoiceId/pay', writeLimiter, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { transactionHash } = req.body ?? {};

    if (typeof transactionHash !== 'string' || transactionHash.trim().length < 8) {
      return res.status(400).json({ error: 'A transaction reference is required' });
    }

    // Invoices are stored with lowercase statuses, but the codebase has been
    // inconsistent, so an already-paid check must be case-insensitive.
    const existing = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, dateDue: true, subtotal: true, client: { select: { passportId: true } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (existing.status.toLowerCase() === 'paid') {
      return res.status(409).json({ error: 'This invoice is already marked paid' });
    }
    // transactionHash is @unique, so a replay with the same reference would
    // also collide here. Catching it by status is the friendlier error.
    if (existing.status.toLowerCase() === 'payment_claimed') {
      return res.status(409).json({ error: 'A payment is already being verified for this invoice' });
    }

    const { payPublicInvoice } = await import('../services/invoice.service');
    const updated = await payPublicInvoice(invoiceId, transactionHash.trim());

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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment failed';
    logger.error(`[InvoicePublic] Error paying invoice: ${message}`);
    res.status(500).json({ error: message });
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

    // A claim is a statement that payment was made, so it is only meaningful
    // against an unpaid invoice. Claiming against a paid or already-claimed
    // one used to re-send the "client claims paid" email to the business each
    // time, and re-emitted the trust event.
    const status = invoice.status.toLowerCase();
    if (status === 'paid' || status === 'payment_claimed') {
      return res.status(409).json({ error: 'This invoice is already settled or under review' });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'payment_claimed' },
    });

    const business = await prisma.business.findUnique({ where: { id: invoice.businessId } });
    if (business) {
      // Fire-and-forget, but surfaced: a rejected send must not fail the claim.
      emailService.sendPaymentClaimed(business, updated, invoice.client)
        .catch((e: unknown) => logger.error(`[InvoicePublic] claim email failed: ${e instanceof Error ? e.message : e}`));
    }

    if (invoice.client?.passportId) {
      await trustCore.emit('invoice.payment_claimed', {
        passportId: invoice.client.passportId,
        invoiceId: invoice.id,
        amount: invoice.subtotal,
      });
    }

    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Claim failed';
    logger.error(`[InvoicePublic] Error claiming paid: ${message}`);
    res.status(500).json({ error: message });
  }
});

export default router;
