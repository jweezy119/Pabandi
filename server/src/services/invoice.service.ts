import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { trustCore } from '../trust/trust-core';
import { emailService } from './email.service';
import { notifyInvoicePaid, notifyInvoiceOverdue } from './notification.service';
import { referralFeeShareService } from './referral-fee-share.service';
import { logger } from '../utils/logger';

type InvoiceLineItem = {
  service: string;
  price: number;
  date?: string;
};

type InvoiceCreateData = {
  clientId: string;
  dateDue: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  notes?: string;
  status?: string;
  requireEscrow?: boolean;
};

export async function createInvoice(businessId: string, data: InvoiceCreateData) {
  const { clientId, dateDue, lineItems, subtotal, notes, status, requireEscrow } = data;
  if (!clientId || !dateDue) throw new CustomError('clientId and dateDue are required', 400);

  // Use notes to store metadata if needed, since schema doesn't have escrow/transaction fields
  const metadata = { requireEscrow: !!requireEscrow };
  const combinedNotes = JSON.stringify({ text: notes || '', metadata });

  const number = `INV-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      businessId,
      clientId,
      number,
      dateDue: new Date(dateDue),
      lineItems: lineItems as object[],
      subtotal,
      notes: combinedNotes,
      status: status || 'draft',
    },
    include: {
      client: true,
    }
  });

  return invoice;
}

export async function getInvoices(businessId: string, filters?: { status?: string, search?: string }) {
  const where: Record<string, unknown> = { businessId };
  if (filters?.status && filters.status !== 'all') {
    where.status = filters.status;
  }
  if (filters?.search) {
    where.number = { contains: filters.search, mode: 'insensitive' };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true },
    orderBy: { createdAt: 'desc' }
  });

  return invoices;
}

export async function getInvoice(businessId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: { client: true }
  });
  if (!invoice) throw new CustomError('Invoice not found', 404);
  return invoice;
}

export async function updateInvoice(businessId: string, invoiceId: string, data: Partial<InvoiceCreateData>) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, businessId }, include: { client: true } });
  if (!invoice) throw new CustomError('Invoice not found', 404);
  if (invoice.status !== 'draft') throw new CustomError('Only draft invoices can be edited', 400);

  const updateData: Record<string, unknown> = {};
  if (data.clientId) updateData.clientId = data.clientId;
  if (data.dateDue) updateData.dateDue = new Date(data.dateDue);
  if (data.lineItems) updateData.lineItems = data.lineItems;
  if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
  if (data.notes !== undefined || data.requireEscrow !== undefined) {
    let existingMetadata = { requireEscrow: false };
    let existingText = '';
    try {
      const parsed = JSON.parse(invoice.notes || '{}');
      existingMetadata = parsed.metadata || {};
      existingText = parsed.text || '';
    } catch {
      existingText = invoice.notes || '';
    }
    
    const newText = data.notes !== undefined ? data.notes : existingText;
    const newMetadata = data.requireEscrow !== undefined ? { ...existingMetadata, requireEscrow: data.requireEscrow } : existingMetadata;
    updateData.notes = JSON.stringify({ text: newText, metadata: newMetadata });
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
    include: { client: true }
  });
}

import { paymentRails } from '../payments/rails';
import { selectRail } from './rail-router.service';
import {
  resolveSquareCredentials,
  createSquarePaymentLink,
  invoiceNote,
} from './square-connection.service';
import { assessFeeSafe } from './fee-assessment.service';

/**
 * Read the notes envelope, tolerating notes that are plain text.
 *
 * Invoice has no column for escrow, currency, transaction hash or link source,
 * so they all ride along inside `notes` as JSON. Rows written before that
 * convention — and rows edited by hand — are plain strings, and JSON.parse
 * throws on those. Every reader has to cope with both.
 */
export function readNotesEnvelope(notes: string | null): {
  text: string;
  metadata: Record<string, unknown>;
} {
  if (!notes) return { text: '', metadata: {} };
  try {
    const parsed = JSON.parse(notes) as { text?: unknown; metadata?: unknown };
    if (parsed && typeof parsed === 'object' && parsed.metadata && typeof parsed.metadata === 'object') {
      return {
        text: typeof parsed.text === 'string' ? parsed.text : '',
        metadata: parsed.metadata as Record<string, unknown>,
      };
    }
  } catch {
    // Plain text, not the envelope.
  }
  return { text: notes, metadata: {} };
}

/**
 * Create a Square payment link priced for this specific invoice.
 *
 * Credentials resolve to the business's own Square account when it has
 * completed OAuth, and to the platform token otherwise — so the money lands with
 * the merchant in the normal case. The idempotency key is the invoice id, so
 * re-sending an invoice returns the same link instead of minting a second one.
 *
 * Returns null when Square is not usable at all, leaving the caller to fall
 * back. It never throws into the send path: an invoice must still be sendable
 * if a payment provider is having a bad day.
 */
async function createSquareInvoiceLink(
  businessId: string,
  invoice: { id: string; number: string; subtotal: number; client?: { email?: string | null } },
  currency: string,
): Promise<{ url: string; source: 'square-merchant-link' | 'square-platform-link' } | null> {
  try {
    const credentials = await resolveSquareCredentials(businessId);
    if (!credentials) {
      logger.warn(
        `[InvoiceService] Square selected for ${invoice.number} but no credentials are available (no SquareConnection and no SQUARE_ACCESS_TOKEN). Falling back to the registered static link.`,
      );
      return null;
    }

    const created = await createSquarePaymentLink({
      credentials,
      idempotencyKey: `invoice-${invoice.id}`,
      lineItemName: `Invoice ${invoice.number}`,
      amount: Number(invoice.subtotal ?? 0),
      currency,
      // The note is what the webhook reads back to identify this invoice.
      note: invoiceNote(invoice.id, invoice.number),
      ...(invoice.client?.email ? { buyerEmail: invoice.client.email } : {}),
      redirectUrl: `${process.env.APP_URL || 'https://pabandi.com'}/pay/${invoice.id}?status=paid`,
      metadata: { pabandiInvoiceId: invoice.id, pabandiInvoiceNumber: invoice.number },
    });

    logger.info(
      `[InvoiceService] Created Square link for ${invoice.number} ($${invoice.subtotal}) via ${credentials.source} credentials.`,
    );

    // Record the fee we will owe on this invoice. Not a deduction — the charge
    // below settles into the merchant's own account, so there is nothing to take a
    // percentage from. This is an accrual, collected on a later statement.
    //
    // Keyed on the invoice id, so re-sending an invoice (which mints a fresh link
    // above) assesses once and reuses the existing row thereafter.
    const assessment = await assessFeeSafe({
      businessId,
      sourceType: 'invoice',
      sourceId: invoice.id,
      chargeCents: Math.round(Number(invoice.subtotal ?? 0) * 100),
    });
    if (assessment) {
      logger.info(
        `[InvoiceService] Invoice ${invoice.number} fee assessed: ${assessment.feeCents}c ` +
          `(${assessment.quote.tier}${assessment.reused ? ', reused' : ''}).`,
      );
    }

    return {
      url: created.url,
      source: credentials.source === 'merchant' ? 'square-merchant-link' : 'square-platform-link',
    };
  } catch (err) {
    logger.error(
      `[InvoiceService] Square link creation failed for ${invoice.number}: ${err instanceof Error ? err.message : err}. Falling back to the registered static link.`,
    );
    return null;
  }
}

export async function sendInvoice(businessId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: { client: { include: { passport: { select: { paymentScore: true } } } } },
  });
  if (!invoice) throw new CustomError('Invoice not found', 404);

  // Route through the rail router instead of blindly taking the business
  // default, so the chosen rail is explainable to both parties.
  const [methods, railBusiness] = await Promise.all([
    prisma.businessPaymentMethod.findMany({ where: { businessId } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { address: true, currency: true } }),
  ]);

  let paymentLink: string | null = null;
  let paymentLinkSource = 'none';

  if (methods.length > 0) {
    try {
      const selection = selectRail(invoice, invoice.client, methods, {
        businessAddress: railBusiness?.address,
        passport: invoice.client.passport,
        currency: railBusiness?.currency,
      });
      const railId = selection.method.railId;
      const rail = paymentRails[railId];

      if (railId === 'square') {
        // Square needs a link priced for THIS invoice.
        //
        // The generic path below builds a URL by appending ?amount= to the
        // business's registered payment link. That does not work: a Square
        // Payment Link is a fixed-price hosted page and Square ignores an
        // amount query parameter, so every invoice would collect whatever that
        // one link was pinned at. A $15,000 invoice and a $150 invoice would
        // charge the same.
        const square = await createSquareInvoiceLink(businessId, invoice, railBusiness?.currency || 'USD');
        if (square) {
          paymentLink = square.url;
          paymentLinkSource = square.source;
        }
        // If Square is not configured, fall through to the registered link and
        // log it: a wrong-amount link is bad, but no link at all is worse, and
        // the log is what tells us to finish setup.
      }

      if (!paymentLink && rail) {
        paymentLink = rail.getPaymentUrl(selection.method.target, {
          amount: invoice.subtotal,
          number: invoice.number,
          currency: railBusiness?.currency || 'USD',
        });
        if (railId === 'square') paymentLinkSource = 'square-static-link';
      }
    } catch (err) {
      logger.warn(`[InvoiceService] Rail routing failed for ${invoice.number}: ${err}`);
    }
  }

  // Carry the link source in the notes envelope, the same place requireEscrow
  // and transactionHash already live. 'square-static-link' is the one worth
  // knowing about: it means the amount on the link may not match the invoice,
  // because Square is not connected for this business.
  const { text: existingNotes, metadata: existingMeta } = readNotesEnvelope(invoice.notes);
  const metadata = {
    ...existingMeta,
    paymentLinkSource,
    ...(paymentLinkSource === 'square-static-link'
      ? { paymentLinkWarning: 'Square is not connected for this business, so the link uses a fixed price and may not match this invoice.' }
      : {}),
  };

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'sent',
      sentAt: new Date(),
      paymentLink,
      notes: JSON.stringify({ text: existingNotes, metadata }),
    },
    include: { client: true }
  });

  if (updated.client.passportId) {
    await trustCore.emit('invoice.sent', {
      invoiceId: updated.id,
      passportId: updated.client.passportId,
      amount: updated.subtotal
    });
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (business) {
    emailService.sendInvoiceSent(updated.client, updated, business);
  }

  return updated;
}

export async function markInvoicePaid(businessId: string, invoiceId: string, transactionHash?: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, businessId }, include: { client: true } });
  if (!invoice) throw new CustomError('Invoice not found', 404);

  const now = new Date();
  
  let existingMetadata = { requireEscrow: false, transactionHash: '' };
  let existingText = '';
  try {
    const parsed = JSON.parse(invoice.notes || '{}');
    existingMetadata = parsed.metadata || {};
    existingText = parsed.text || '';
  } catch {
    existingText = invoice.notes || '';
  }
  
  if (transactionHash) {
    existingMetadata.transactionHash = transactionHash;
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { 
      status: 'paid', 
      paidAt: now,
      notes: JSON.stringify({ text: existingText, metadata: existingMetadata })
    },
    include: { client: true }
  });

  if (updated.client.passportId) {
    const isLate = now > new Date(updated.dateDue);
    const eventType = isLate ? 'invoice.paid_late' : 'invoice.paid_on_time';
    await trustCore.emit(eventType, {
      invoiceId: updated.id,
      passportId: updated.client.passportId,
      amount: updated.subtotal
    });
  }

  // Credit referral fee-share (5% of invoice amount to referrer)
  referralFeeShareService.creditReferrer({
    businessId,
    invoiceId: updated.id,
    amount: updated.subtotal,
  }).catch(err => {
    logger.error(`[InvoiceService] Referral fee-share failed: ${err.message}`);
  });

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (business) {
    emailService.sendPaymentReceived(business, updated, updated.client);
    await notifyInvoicePaid(business.ownerId || '', updated.id, updated.number, updated.subtotal);
  }

  return updated;
}

export async function scanOverdueInvoices() {
  const now = new Date();
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: 'sent',
      dateDue: { lt: now }
    },
    include: { client: true }
  });

  for (const inv of overdueInvoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'overdue' }
    });

    if (inv.client.passportId) {
      await trustCore.emit('invoice.overdue', {
        invoiceId: inv.id,
        passportId: inv.client.passportId,
        amount: inv.subtotal
      });
    }

    const business = await prisma.business.findUnique({ where: { id: inv.businessId } });
    if (business) {
      await notifyInvoiceOverdue(business.ownerId || '', inv.id, inv.number, inv.subtotal);
    }
  }

  // Handle invoice reminders (max 3 reminders, 1 per 3 days)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const invoicesToRemind = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'overdue'] },
      dateDue: { lt: now },
      reminderCount: { lt: 3 },
      OR: [
        { lastReminderAt: null },
        { lastReminderAt: { lt: threeDaysAgo } }
      ]
    },
    include: { client: true }
  });

  for (const inv of invoicesToRemind) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        reminderCount: inv.reminderCount + 1,
        lastReminderAt: now
      }
    });

    const business = await prisma.business.findUnique({ where: { id: inv.businessId } });
    if (business) {
      emailService.sendInvoiceReminder(inv.client, inv, business);
    }
  }
}

export async function getPublicInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true }
  });
  if (!invoice) throw new CustomError('Invoice not found', 404);
  return invoice;
}

export async function payPublicInvoice(invoiceId: string, transactionHash: string) {
  // Use a system bypass for businessId since this is a public endpoint
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId }
  });
  if (!invoice) throw new CustomError('Invoice not found', 404);

  return markInvoicePaid(invoice.businessId, invoiceId, transactionHash);
}
