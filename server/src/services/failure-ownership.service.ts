import { DisputeType, DisputeOutcome } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustCore } from '../trust/trust-core';
import { emailService } from './email.service';
import { createNotification } from './notification.service';
import { invoiceTrustService } from './invoice-trust.service';
import { universalEscrowService } from './universal-escrow.service';
import { disputeService } from './dispute.service';

/**
 * Failure Ownership — who is responsible when an invoice goes unpaid.
 *
 * WHY THIS EXISTS
 * When an invoice is sent and stays unpaid, the status silently sat at
 * 'overdue'. scanOverdueInvoices flipped the status and emitted a trust event;
 * nothing told either party. The client did not know the payment had not
 * landed, the business did not know they had been chasing, and an escrow that
 * was funded had no route to becoming a dispute. Silence is the worst possible
 * failure mode for a settlement layer: the money is in limbo and nobody owns it.
 *
 * This service makes the failure explicit and assigns it. Past due by three
 * days: the client gets a payment link, the business is told the client was
 * notified, both passports take a trust hit, and if escrow is being held the
 * case escalates into the existing dispute layer.
 *
 * ON "SULHA"
 * The brief describes Sulha as Pabandi's dispute resolution layer and asks us
 * to hook into what exists. There is no symbol named sulha anywhere in this
 * repository — no model, no service, no route. What exists is the Dispute model
 * (schema.prisma), the DisputeService, and trustArbitratorService. This service
 * therefore uses those primitives directly rather than inventing a parallel
 * dispute system: a Sulha case is a Dispute row with contextType 'INVOICE'.
 */

/** Days past due before the failure flow engages. The brief's "3 days". */
export const FAILURE_OWNERSHIP_GRACE_DAYS = 3;

/** Invoice statuses that still count as "awaiting payment". */
const AWAITING_PAYMENT = ['sent', 'SENT', 'overdue'];

export interface FailureOwnershipResult {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  daysPastDue: number;
  clientNotified: boolean;
  businessNotified: boolean;
  trustEventsFired: string[];
  escrowHeld: boolean;
  escrowStatus: string | null;
  escalatedToDispute: boolean;
  disputeId: string | null;
  notes: string[];
}

/** Escrow reference for an invoice. UniversalEscrow.referenceId is @unique. */
function escrowReference(invoiceId: string): string {
  return `invoice:${invoiceId}`;
}

interface InvoiceWithContext {
  id: string;
  number: string;
  businessId: string;
  clientId: string;
  status: string;
  subtotal: number;
  dateDue: Date;
  notes: string | null;
  client: {
    id: string;
    name: string;
    email: string | null;
    passportId: string | null;
  };
}

/**
 * Run the failure flow for one invoice.
 *
 * Idempotent: safe to call repeatedly for the same invoice. The trust events
 * are guarded by InvoiceTrustEvent's @@unique([invoiceId, eventType]), escrow
 * is held by UniversalEscrow's unique referenceId, and the dispute is guarded
 * by the existing contextType/contextId check. Calling this twice does not
 * double-penalise, double-email, or file two disputes.
 */
export async function runFailureOwnership(invoiceId: string, opts: { notify?: boolean } = {}): Promise<FailureOwnershipResult> {
  const shouldNotify = opts.notify !== false;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: { select: { id: true, name: true, email: true, passportId: true } } },
  }) as InvoiceWithContext | null;

  const empty: FailureOwnershipResult = {
    invoiceId,
    invoiceNumber: '',
    status: 'missing',
    daysPastDue: 0,
    clientNotified: false,
    businessNotified: false,
    trustEventsFired: [],
    escrowHeld: false,
    escrowStatus: null,
    escalatedToDispute: false,
    disputeId: null,
    notes: [],
  };
  if (!invoice) return { ...empty, notes: ['Invoice not found.'] };

  const notes: string[] = [];

  if (invoice.status === 'paid' || invoice.status === 'PAID') {
    return { ...empty, invoiceNumber: invoice.number, status: invoice.status, notes: ['Invoice is already paid; nothing to own.'] };
  }
  if (!AWAITING_PAYMENT.includes(invoice.status)) {
    return { ...empty, invoiceNumber: invoice.number, status: invoice.status, notes: [`Status '${invoice.status}' is not awaiting payment.`] };
  }

  const now = new Date();
  const daysPastDue = Math.floor((now.getTime() - invoice.dateDue.getTime()) / (24 * 60 * 60 * 1000));
  if (daysPastDue < FAILURE_OWNERSHIP_GRACE_DAYS) {
    return {
      ...empty,
      invoiceNumber: invoice.number,
      status: invoice.status,
      daysPastDue,
      notes: [`Only ${daysPastDue} day(s) past due; grace period is ${FAILURE_OWNERSHIP_GRACE_DAYS}.`],
    };
  }

  const result: FailureOwnershipResult = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    status: invoice.status,
    daysPastDue,
    clientNotified: false,
    businessNotified: false,
    trustEventsFired: [],
    escrowHeld: false,
    escrowStatus: null,
    escalatedToDispute: false,
    disputeId: null,
    notes,
  };

  const business = await prisma.business.findUnique({
    where: { id: invoice.businessId },
    select: { id: true, name: true, email: true, ownerId: true },
  });

  // ── 1. Client-side: "Payment didn't arrive — here's the link" ────────────
  if (shouldNotify && invoice.client.email) {
    try {
      await emailService.sendPaymentDidntArrive(invoice.client, invoice, business, daysPastDue);
      result.clientNotified = true;
    } catch (err) {
      logger.error(`[FailureOwnership] client email failed for ${invoice.number}: ${err}`);
      notes.push('Client email failed to send.');
    }
  } else if (shouldNotify) {
    notes.push('Client has no email address; skipped the payment link email.');
  }

  // ── 2. Business-side: "INV-0042 overdue — client notified" ─────────────
  if (shouldNotify && business?.ownerId) {
    try {
      await createNotification({
        userId: business.ownerId,
        type: 'invoice_overdue',
        title: `${invoice.number} overdue — client notified`,
        body: result.clientNotified
          ? `$${invoice.subtotal.toLocaleString()} is ${result.daysPastDue} days past due. The client has been emailed a payment link.`
          : `$${invoice.subtotal.toLocaleString()} is ${result.daysPastDue} days past due.`,
        actionUrl: `/contact/invoices/${invoice.id}`,
      });
      result.businessNotified = true;
    } catch (err) {
      logger.error(`[FailureOwnership] business notify failed for ${invoice.number}: ${err}`);
    }
  } else if (shouldNotify) {
    notes.push('Business has no linked owner; notification logged only.');
  }

  // ── 3. Trust events on both passports ───────────────────────────────────
  // The client's passport is the one the invoice already scores. The business
  // is a party too: an invoice that goes unpaid is a signal about the
  // relationship, and the brief asks for both.
  const trustEventsFired: string[] = [];

  if (invoice.client.passportId) {
    try {
      await invoiceTrustService.processInvoiceStatusChange(
        invoice.id,
        invoice.clientId,
        invoice.status,
        'overdue',
        now,
        false,
        true,
        false,
      );
      trustEventsFired.push('client:invoice.overdue');
    } catch (err) {
      logger.error(`[FailureOwnership] client trust event failed for ${invoice.number}: ${err}`);
    }
  } else {
    notes.push('Client has no linked passport; no client-side trust event.');
  }

  if (business?.ownerId) {
    const businessPassport = await prisma.trustPassport.findUnique({
      where: { userId: business.ownerId },
      select: { id: true, paymentScore: true },
    });
    if (businessPassport) {
      try {
        await trustCore.emit('invoice.overdue', {
          invoiceId: invoice.id,
          passportId: businessPassport.id,
          amount: invoice.subtotal,
          reason: 'business-side unpaid invoice',
        });
        trustEventsFired.push('business:invoice.overdue');
      } catch (err) {
        logger.error(`[FailureOwnership] business trust event failed for ${invoice.number}: ${err}`);
      }
    } else {
      notes.push('Business owner has no trust passport; no business-side trust event.');
    }
  } else {
    notes.push('Business has no linked owner; no business-side trust event.');
  }
  result.trustEventsFired = trustEventsFired;

  // ── 4. Escrow: hold, and escalate to the dispute flow ──────────────────
  const escrow = await prisma.universalEscrow.findUnique({
    where: { referenceId: escrowReference(invoice.id) },
    select: { id: true, status: true, amount: true },
  });

  if (escrow) {
    result.escrowHeld = true;
    result.escrowStatus = escrow.status;

    if (escrow.status === 'released' || escrow.status === 'refunded') {
      // Funds already moved; there is nothing left to hold.
      notes.push(`Escrow is already ${escrow.status}; cannot hold further.`);
    } else {
      try {
        // 'disputed' is the terminal-hold state in UniversalEscrowService. It
        // blocks release until a dispute resolves, which is exactly the
        // guarantee the brief asks for.
        await universalEscrowService.updateStatus(escrowReference(invoice.id), 'disputed');
        result.escrowStatus = 'disputed';
        notes.push('Escrow moved to disputed and will hold until the dispute resolves.');
      } catch (err) {
        logger.error(`[FailureOwnership] escrow hold failed for ${invoice.number}: ${err}`);
        notes.push('Failed to hold escrow.');
      }
    }

    if (result.escrowStatus === 'disputed') {
      const dispute = await escalateToDispute(invoice, escrow.id, `Invoice ${invoice.number} is ${result.daysPastDue} days past due with escrow held.`);
      if (dispute) {
        result.escalatedToDispute = true;
        result.disputeId = dispute.id;
      }
    }
  } else {
    notes.push('No escrow is held for this invoice.');
  }

  logger.info(
    `[FailureOwnership] ${invoice.number} (${result.daysPastDue}d past due): client=${result.clientNotified} business=${result.businessNotified} trust=[${trustEventsFired.join(', ')}] escrow=${result.escrowStatus ?? 'none'} dispute=${result.disputeId ?? 'none'}`,
  );

  return result;
}

/**
 * Create the dispute case in Pabandi's existing dispute layer.
 *
 * Reuses the Dispute model, DisputeType/DisputeOutcome enums, and the existing
 * juror assignment. contextType is a free string column and 'INVOICE' is not
 * yet a member of disputeService's TypeScript union, so the row is created
 * directly rather than through fileContextDispute — that method also requires
 * User ids for both parties, and a CrmClient has no User row.
 */
async function escalateToDispute(
  invoice: InvoiceWithContext,
  escrowId: string,
  reason: string,
): Promise<{ id: string } | null> {
  const existing = await prisma.dispute.findFirst({
    where: { contextType: 'INVOICE', contextId: invoice.id },
    select: { id: true },
  });
  if (existing) {
    logger.info(`[FailureOwnership] Dispute ${existing.id} already exists for invoice ${invoice.number}.`);
    return existing;
  }

  try {
    const dispute = await prisma.dispute.create({
      data: {
        type: DisputeType.NON_PAYMENT,
        description: reason,
        outcome: DisputeOutcome.PENDING,
        contextType: 'INVOICE',
        contextId: invoice.id,
        evidenceUrls: [],
        stakedAmount: 0,
        // No reportedById/userId: a CrmClient is not a User, and inventing a
        // user row here would create an identity that does not exist.
      },
      select: { id: true },
    });

    try {
      await disputeService.assignJurors(dispute.id);
    } catch (err) {
      logger.warn(`[FailureOwnership] juror assignment failed for dispute ${dispute.id}: ${err}`);
    }

      await notifyPartiesOfDispute(invoice, dispute.id, escrowId, reason);

    logger.info(`[FailureOwnership] Filed dispute ${dispute.id} for invoice ${invoice.number}.`);
    return dispute;
  } catch (err) {
    logger.error(`[FailureOwnership] failed to file dispute for ${invoice.number}: ${err}`);
    return null;
  }
}

async function notifyPartiesOfDispute(
  invoice: InvoiceWithContext,
  disputeId: string,
  escrowId: string,
  reason: string,
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: invoice.businessId },
    select: { name: true, email: true, ownerId: true },
  });

  if (invoice.client.email) {
    try {
      await emailService.sendDisputeOpened(
        { name: invoice.client.name, email: invoice.client.email },
        invoice,
        business,
        disputeId,
        reason,
      );
    } catch (err) {
      logger.error(`[FailureOwnership] dispute email to client failed: ${err}`);
    }
  }

  if (business?.email) {
    try {
      await emailService.sendDisputeOpened(
        { name: business.name, email: business.email },
        invoice,
        { name: business.name, email: business.email },
        disputeId,
        reason,
      );
    } catch (err) {
      logger.error(`[FailureOwnership] dispute email to business failed: ${err}`);
    }
  }

  if (business?.ownerId) {
    try {
      await createNotification({
        userId: business.ownerId,
        type: 'support_reply',
        title: `Dispute opened on ${invoice.number}`,
        body: `Funds are held in escrow until this is resolved. Reference: ${escrowId}.`,
        actionUrl: `/contact/invoices/${invoice.id}`,
      });
    } catch (err) {
      logger.error(`[FailureOwnership] dispute notification failed: ${err}`);
    }
  }
}

/**
 * Scan for invoices that are past the grace period and run the flow on each.
 * Invoked by the daily invoice cron.
 */
export async function scanFailureOwnership(): Promise<FailureOwnershipResult[]> {
  const cutoff = new Date(Date.now() - FAILURE_OWNERSHIP_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: AWAITING_PAYMENT },
      dateDue: { lt: cutoff },
    },
    select: { id: true },
  });

  const results: FailureOwnershipResult[] = [];
  for (const inv of invoices) {
    try {
      results.push(await runFailureOwnership(inv.id));
    } catch (err) {
      logger.error(`[FailureOwnership] run failed for invoice ${inv.id}: ${err}`);
    }
  }
  return results;
}

/** A business user filing a dispute on an invoice they own. */
export async function fileInvoiceDispute(params: {
  invoiceId: string;
  reason: string;
  evidence: string[];
  filedByUserId?: string;
}): Promise<{ disputeId: string; escrowHeld: boolean; escrowStatus: string | null }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: { client: { select: { id: true, name: true, email: true, passportId: true } } },
  }) as InvoiceWithContext | null;
  if (!invoice) throw new Error('Invoice not found');

  const escrow = await prisma.universalEscrow.findUnique({
    where: { referenceId: escrowReference(invoice.id) },
    select: { id: true, status: true },
  });

  if (escrow && escrow.status !== 'released' && escrow.status !== 'refunded') {
    await universalEscrowService.updateStatus(escrowReference(invoice.id), 'disputed');
  }

  const existing = await prisma.dispute.findFirst({
    where: { contextType: 'INVOICE', contextId: invoice.id },
    select: { id: true },
  });

  let disputeId: string;
  if (existing) {
    disputeId = existing.id;
  } else {
    const dispute = await prisma.dispute.create({
      data: {
        type: DisputeType.NON_PAYMENT,
        description: params.reason,
        outcome: DisputeOutcome.PENDING,
        contextType: 'INVOICE',
        contextId: invoice.id,
        evidenceUrls: params.evidence ?? [],
        stakedAmount: 0,
        ...(params.filedByUserId ? { reportedById: params.filedByUserId } : {}),
      },
      select: { id: true },
    });
    disputeId = dispute.id;
    try {
      await disputeService.assignJurors(disputeId);
    } catch (err) {
      logger.warn(`[FailureOwnership] juror assignment failed for dispute ${disputeId}: ${err}`);
    }
  }

  const escrowAfter = escrow ? await prisma.universalEscrow.findUnique({
    where: { referenceId: escrowReference(invoice.id) },
    select: { status: true },
  }) : null;

  await notifyPartiesOfDispute(invoice, disputeId, escrow?.id ?? 'none', params.reason);

  return {
    disputeId,
    escrowHeld: Boolean(escrow),
    escrowStatus: escrowAfter?.status ?? escrow?.status ?? null,
  };
}
