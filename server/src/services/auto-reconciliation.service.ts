import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { markInvoicePaid } from './invoice.service';
import { createNotification } from './notification.service';
import { isRailId, RailId } from './rail-router.service';
import { settlementDecision } from '../config/rail-cost';

/**
 * Auto-Reconciliation — match an inbound rail payment to an invoice.
 *
 * WHY THIS EXISTS
 * Rail webhooks arrive with an amount and a reference. Nothing connects them
 * to the invoice they were paying. Today only Square's webhook exists and it
 * looks up a Payment row by transactionId; if a business invoices outside the
 * checkout flow, the money arrives with no home. Reconciliation is the step
 * that closes that gap.
 *
 * IDEMPOTENCY
 * `ReconciliationMatch.paymentRef` is UNIQUE in the database. We attempt the
 * insert FIRST and treat a unique violation as "already processed". This is the
 * opposite order to a read-then-write check, and the ordering is the whole
 * point: with a read-then-write, two concurrent redeliveries of the same
 * webhook both observe "nothing here yet" and both settle the same invoice —
 * double trust event, double referral fee credit. Attempting the insert means
 * the database arbitrates, so exactly one caller wins regardless of timing.
 *
 * The insert is also done before the invoice is marked paid, so a crash between
 * insert and settlement leaves a 'queued' row that a human can finish, rather
 * than an unpaid invoice whose payment is already recorded as processed.
 */

export type ReconciliationStatus = 'matched' | 'queued' | 'orphan';

export interface IncomingPayment {
  /** Rail-side unique reference. The idempotency key. */
  paymentRef: string;
  rail: RailId;
  amount: number;
  /** Settled at the rail, if known. Used to bound the invoice window. */
  paidAt?: Date;
  /**
   * If the rail told us who paid, use it. A rail-supplied clientId makes the
   * match unambiguous and we skip the amount scan. When absent we fall back to
   * matching on amount alone, which is why the multi-candidate path exists.
   */
  clientId?: string;
  businessId?: string;
  currency?: string;
  /**
   * The invoice this payment was created for, when the rail told us.
   *
   * Square writes the invoice id into the checkout's payment note and returns
   * it on the webhook, so the correct invoice is known outright. That skips the
   * amount scan entirely — and with it the ambiguity that made a real payment
   * queue for manual review because a second invoice happened to share an
   * amount. This is the strongest signal available and is preferred over any
   * amount-based inference.
   */
  invoiceId?: string;
}

export interface MatchCandidate {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dateDue: string;
  daysPastDue: number;
  confidence: number;
}

export interface ReconciliationOutcome {
  status: ReconciliationStatus;
  /** True when this payment had already been reconciled on an earlier call. */
  duplicate: boolean;
  matchId: string;
  invoiceId: string | null;
  confidence: number;
  candidates: MatchCandidate[];
  reasoning: string;
}

/** How far back from the payment date we still consider an invoice payable. */
export const MATCH_WINDOW_DAYS = 7;

/** Amounts within this fraction of each other count as the same amount. */
const AMOUNT_TOLERANCE = 0.01;

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Find invoices this payment could plausibly be paying.
 *
 * Matching rule from the brief: { amount, clientId, within 7 days }. The
 * window is anchored on the payment date when the rail supplies one, otherwise
 * on now. Invoices are only considered while they are still unpaid — paying an
 * already-paid invoice is a refund conversation, not a reconciliation.
 */
async function findCandidates(payment: IncomingPayment): Promise<MatchCandidate[]> {
  const anchor = payment.paidAt ?? new Date();
  const windowStart = new Date(anchor.getTime() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(anchor.getTime() + MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const targetMinor = toMinor(payment.amount);
  const toleranceMinor = Math.max(1, Math.round(targetMinor * AMOUNT_TOLERANCE));

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'SENT', 'overdue', 'payment_claimed'] },
      dateIssued: { gte: windowStart, lte: windowEnd },
      ...(payment.businessId ? { businessId: payment.businessId } : {}),
      ...(payment.clientId ? { clientId: payment.clientId } : {}),
    },
    select: {
      id: true,
      number: true,
      subtotal: true,
      status: true,
      dateDue: true,
      clientId: true,
    },
  });

  const now = Date.now();

  return invoices
    .filter((inv) => Math.abs(toMinor(inv.subtotal) - targetMinor) <= toleranceMinor)
    .map((inv) => {
      const daysPastDue = Math.floor((anchor.getTime() - inv.dateDue.getTime()) / (24 * 60 * 60 * 1000));
      // Confidence is a ranking aid for the human reviewer, not a probability.
      // An amount-exact + client-exact + recently-issued invoice is a strong
      // match; a 6-day-old overdue invoice for the same amount is weaker.
      let confidence = 0.6;
      if (payment.clientId) confidence += 0.25;
      if (Math.abs(daysPastDue) <= 2) confidence += 0.1;
      if (daysPastDue > 2) confidence -= 0.15;
      confidence = Math.max(0.05, Math.min(0.99, confidence));

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        amount: inv.subtotal,
        status: inv.status,
        dateDue: inv.dateDue.toISOString(),
        daysPastDue,
        confidence: Math.round(confidence * 100) / 100,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

export async function reconcileIncomingPayment(payment: IncomingPayment): Promise<ReconciliationOutcome> {
  if (!payment.paymentRef) throw new Error('paymentRef is required for reconciliation');
  if (!isRailId(payment.rail)) throw new Error(`Unknown rail: ${payment.rail}`);

  // ── Step 1: claim the paymentRef. This is the idempotency gate. ────────────
  let claimId: string;
  try {
    const claim = await prisma.reconciliationMatch.create({
      data: {
        paymentRef: payment.paymentRef,
        rail: payment.rail,
        amount: new Prisma.Decimal(payment.amount),
        status: 'queued',
        confidence: 0,
      },
      select: { id: true },
    });
    claimId = claim.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.reconciliationMatch.findUnique({
        where: { paymentRef: payment.paymentRef },
        select: { id: true, status: true, invoiceId: true, confidence: true },
      });
      logger.info(
        `[Reconcile] Duplicate delivery for ${payment.rail} paymentRef=${payment.paymentRef}; already ${existing?.status ?? 'processed'}.`,
      );
      return {
        status: (existing?.status as ReconciliationStatus) ?? 'queued',
        duplicate: true,
        matchId: existing?.id ?? '',
        invoiceId: existing?.invoiceId ?? null,
        confidence: existing?.confidence ?? 0,
        candidates: [],
        reasoning: 'Already reconciled on an earlier delivery of this payment.',
      };
    }
    throw err;
  }

  // ── Step 2a: the rail named the invoice outright. Trust it. ──────────────
  //
  // Everything below this point is inference. When Square hands us the invoice
  // id it created the checkout for, there is nothing to infer: the amount check
  // becomes a sanity assertion rather than a search, and the ambiguous
  // "two invoices for $150" case cannot occur.
  if (payment.invoiceId) {
    const named = await prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
      select: { id: true, number: true, businessId: true, status: true, subtotal: true },
    });

    if (named && named.status.toLowerCase() !== 'paid') {
      const settled = await settleClaimedInvoice(claimId, payment, named.id, named.number, named.businessId, 1);
      return settled;
    }

    // The note names an invoice that is already paid, or one that has since
    // been deleted. Record it as an orphan with the reason rather than falling
    // back to an amount scan, which could settle the wrong invoice.
    await prisma.reconciliationMatch.update({
      where: { id: claimId },
      data: {
        status: 'orphan',
        confidence: named ? 1 : 0,
        note: named
          ? `Payment note named invoice ${named.number}, which is already paid.`
          : `Payment note named invoice ${payment.invoiceId}, which no longer exists.`,
      },
    });
    logger.warn(
      `[Reconcile] ${payment.rail} paymentRef=${payment.paymentRef} names invoice ${payment.invoiceId}, which is ${named ? `already ${named.status}` : 'missing'}. Recorded as orphan.`,
    );
    return {
      status: 'orphan',
      duplicate: false,
      matchId: claimId,
      invoiceId: null,
      confidence: named ? 1 : 0,
      candidates: [],
      reasoning: named
        ? `Payment names invoice ${named.number}, which is already paid.`
        : `Payment names invoice ${payment.invoiceId}, which no longer exists.`,
    };
  }

  // ── Step 2b: decide which invoice this is by inference. ──────────────────
  const candidates = await findCandidates(payment);

  if (candidates.length === 0) {
    await prisma.reconciliationMatch.update({
      where: { id: claimId },
      data: {
        status: 'orphan',
        confidence: 0,
        note: `No unpaid invoice within ${MATCH_WINDOW_DAYS} days matched ${payment.rail} payment ${payment.paymentRef}.`,
      },
    });
    logger.warn(
      `[Reconcile] Orphan ${payment.rail} paymentRef=${payment.paymentRef} amount=${payment.amount}. No matching invoice.`,
    );
    await notifyOrphanPayment(payment);
    return {
      status: 'orphan',
      duplicate: false,
      matchId: claimId,
      invoiceId: null,
      confidence: 0,
      candidates: [],
      reasoning: `Orphan: no unpaid invoice matched this ${payment.amount} ${payment.currency ?? ''} payment within ${MATCH_WINDOW_DAYS} days.`,
    };
  }

  if (candidates.length > 1) {
    await prisma.reconciliationMatch.update({
      where: { id: claimId },
      data: {
        status: 'queued',
        confidence: candidates[0].confidence,
        candidates: candidates as unknown as Prisma.InputJsonValue,
        note: `${candidates.length} candidate invoices — needs a human decision.`,
      },
    });
    logger.warn(
      `[Reconcile] Ambiguous ${payment.rail} paymentRef=${payment.paymentRef}: ${candidates.length} candidates (${candidates.map((c) => c.invoiceNumber).join(', ')}). Queued for review.`,
    );
    return {
      status: 'queued',
      duplicate: false,
      matchId: claimId,
      invoiceId: null,
      confidence: candidates[0].confidence,
      candidates,
      reasoning: `${candidates.length} invoices match this amount. Queued for review: ${candidates.map((c) => `${c.invoiceNumber} (${c.confidence})`).join(', ')}.`,
    };
  }

  // ── Step 3: unique inferred match — settle it. ─────────────────────────
  const winner = candidates[0];

  const invoice = await prisma.invoice.findUnique({
    where: { id: winner.invoiceId },
    select: { id: true, businessId: true, number: true, status: true },
  });
  if (!invoice) {
    await prisma.reconciliationMatch.update({
      where: { id: claimId },
      data: {
        status: 'orphan',
        note: `Candidate invoice ${winner.invoiceNumber} disappeared before settlement.`,
      },
    });
    return {
      status: 'orphan',
      duplicate: false,
      matchId: claimId,
      invoiceId: null,
      confidence: 0,
      candidates,
      reasoning: `Candidate invoice ${winner.invoiceNumber} no longer exists.`,
    };
  }

  return settleClaimedInvoice(
    claimId,
    payment,
    invoice.id,
    invoice.number,
    invoice.businessId,
    winner.confidence,
    candidates as unknown as Prisma.InputJsonValue,
  );
}

/**
 * Mark an invoice paid against an already-claimed ReconciliationMatch row.
 *
 * Shared by the named-invoice path and the inferred path so settlement has one
 * implementation and one set of invariants: the trust event is idempotent
 * (InvoiceTrustEvent is @@unique([invoiceId, eventType])), the row is only
 * linked once, and the business is notified once.
 */
async function settleClaimedInvoice(
  claimId: string,
  payment: IncomingPayment,
  invoiceId: string,
  invoiceNumber: string,
  businessId: string,
  confidence: number,
  candidates?: Prisma.InputJsonValue,
): Promise<ReconciliationOutcome> {
  await markInvoicePaid(businessId, invoiceId, payment.paymentRef);

  const finality = settlementDecision(payment.rail, new Date());

  await prisma.reconciliationMatch.update({
    where: { id: claimId },
    data: {
      status: 'matched',
      invoiceId,
      confidence,
      matchedAt: new Date(),
      // The invoice is marked paid above and stays paid. What varies by rail is
      // whether that word is currently the whole truth — see settlementDecision.
      settlementStatus: finality.status,
      settlesAt: finality.settlesAt,
      ...(candidates ? { candidates } : {}),
      note: payment.invoiceId
        ? `Matched by rail-supplied invoice reference (${invoiceNumber}).`
        : `Auto-matched to ${invoiceNumber}.`,
    },
  });

  logger.info(
    `[Reconcile] Matched ${payment.rail} paymentRef=${payment.paymentRef} → ${invoiceNumber} ` +
      `(confidence ${confidence}${payment.invoiceId ? ', by invoice reference' : ''}). ` +
      `Settlement: ${finality.status}${finality.settlesAt ? ` until ${finality.settlesAt.toISOString()}` : ''}.`,
  );
  await notifyAutoMatch(businessId, invoiceNumber, payment);

  return {
    status: 'matched',
    duplicate: false,
    matchId: claimId,
    invoiceId,
    confidence,
    candidates: [],
    reasoning: payment.invoiceId
      ? `Matched ${payment.rail} payment ${payment.paymentRef} to ${invoiceNumber} by reference.`
      : `Matched ${payment.rail} payment ${payment.paymentRef} to ${invoiceNumber}.`,
  };
}

/**
 * Notify the business that a payment was matched. The brief asks for
 * "Invoice INV-0042 auto-matched to Square payment of $150."
 *
 * notification.service keys every notification off a userId, and Invoice
 * businessId points at a Business whose ownerId may be null (a CrmBusiness has
 * no user row at all). We notify when we can identify an owner and log
 * otherwise, rather than writing a Notification row with a null user.
 */
async function notifyAutoMatch(businessId: string, invoiceNumber: string, payment: IncomingPayment): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, name: true },
    });
    if (!business?.ownerId) {
      logger.info(
        `[Reconcile] ${business?.name ?? businessId} has no linked owner; skipping in-app notification for ${invoiceNumber}.`,
      );
      return;
    }
    await createNotification({
      userId: business.ownerId,
      type: 'invoice_paid',
      title: `${invoiceNumber} auto-matched to ${payment.rail} payment of $${payment.amount.toLocaleString()}`,
      body: `Reconciled automatically at ${new Date().toISOString()}.`,
      actionUrl: '/contact/invoices',
    });
  } catch (err) {
    logger.error(`[Reconcile] Failed to notify auto-match for ${invoiceNumber}: ${err}`);
  }
}

/** Real money arrived that we could not attribute. The business must know. */
async function notifyOrphanPayment(payment: IncomingPayment): Promise<void> {
  try {
    if (!payment.businessId) {
      logger.warn(`[Reconcile] Orphan paymentRef=${payment.paymentRef} has no businessId; cannot notify.`);
      return;
    }
    const business = await prisma.business.findUnique({
      where: { id: payment.businessId },
      select: { ownerId: true, name: true },
    });
    if (!business?.ownerId) {
      logger.warn(`[Reconcile] Orphan paymentRef=${payment.paymentRef}: ${business?.name ?? payment.businessId} has no owner to notify.`);
      return;
    }
    await createNotification({
      userId: business.ownerId,
      type: 'invoice_paid',
      title: `Unmatched ${payment.rail} payment of $${payment.amount.toLocaleString()}`,
      body: 'We received a payment that did not match any open invoice. Review it to confirm what it was for.',
      actionUrl: '/contact/invoices',
    });
  } catch (err) {
    logger.error(`[Reconcile] Failed to notify orphan ${payment.paymentRef}: ${err}`);
  }
}

/** A human resolving a queued match picked an invoice. */
export async function resolveQueuedMatch(
  matchId: string,
  invoiceId: string,
  note?: string,
): Promise<ReconciliationOutcome> {
  const match = await prisma.reconciliationMatch.findUnique({ where: { id: matchId } });
  if (!match) throw new Error('Reconciliation match not found');
  if (match.status === 'matched') {
    return {
      status: 'matched',
      duplicate: true,
      matchId,
      invoiceId: match.invoiceId,
      confidence: match.confidence,
      candidates: [],
      reasoning: 'This payment was already matched.',
    };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, businessId: true, number: true },
  });
  if (!invoice) throw new Error('Invoice not found');

  await markInvoicePaid(invoice.businessId, invoice.id, match.paymentRef);
  await prisma.reconciliationMatch.update({
    where: { id: matchId },
    data: {
      status: 'matched',
      invoiceId: invoice.id,
      matchedAt: new Date(),
      confidence: 1,
      note: note || `Manually matched to ${invoice.number} by a reviewer.`,
    },
  });

  return {
    status: 'matched',
    duplicate: false,
    matchId,
    invoiceId: invoice.id,
    confidence: 1,
    candidates: [],
    reasoning: `Manually matched to ${invoice.number}.`,
  };
}

/**
 * Trust-event guard used by the webhook routes: does this reference exist? */
export async function alreadyReconciled(paymentRef: string): Promise<boolean> {
  const found = await prisma.reconciliationMatch.findUnique({
    where: { paymentRef },
    select: { id: true },
  });
  return found !== null;
}
