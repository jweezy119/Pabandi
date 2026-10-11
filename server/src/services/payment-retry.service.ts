/**
 * Payment auto-retry.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * A payment that fails at the processor is, in the overwhelming majority of
 * cases, not a dead invoice. It is a declined card, a transient timeout, a
 * network queue on Solana. The client's intent to pay has not changed; the
 * instrument they used has.
 *
 * Until this service existed, the only path was the calendar: three days after
 * the due date, `scanFailureOwnership` engaged and told the client the money
 * had not arrived. That email is correct about the money and wrong about the
 * situation — it treats a payment that was actively attempted and failed as
 * though it was never tried, and it arrives days after the client was in a
 * position to fix it.
 *
 * So failure is handled where it happens. A failed payment retries on another
 * rail immediately, and only an invoice that has run out of retries reaches
 * failure ownership — at which point that email is finally true.
 *
 * ─── WHY RETRY IS SCOPED TO paymentRef AND NOT TO THE INVOICE ───────────────
 * Because an invoice can be attempted more than once and each attempt can fail
 * differently. One counter on the invoice would collapse Square→PayPal→Solana
 * into an undifferentiated "3 failures" with no way to answer "which rails has
 * this client already had trouble with?" — which is exactly the question the
 * exclusion list needs to answer. The counter lives on the attempt; the rail
 * history is derived from the attempts.
 *
 * ─── IDEMPOTENCY, AND WHY IT IS NOT A CONVENIENCE ───────────────────────────
 * Processors redeliver. Square will send the same `payment.failed` at least
 * twice under a slow acknowledgement, and the existing reconciliation path
 * already treats this as certain enough to arbitrate in the database rather
 * than in code — see `reconcileIncomingPayment`, which inserts the paymentRef
 * first and lets the unique constraint decide the winner.
 *
 * A naive `retryCount += 1` would therefore fire two retries, send two
 * emails, and generate two competing payment links for the same failure. So
 * the increment here is a compare-and-swap against the value we read, and a
 * lost race returns `duplicate` without doing anything else.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { paymentRails } from '../payments/rails';
import { trustCore } from '../trust/trust-core';
import { emailService } from './email.service';
import { createNotification } from './notification.service';
import { createSquareInvoiceLink } from './invoice.service';
import { runFailureOwnership } from './failure-ownership.service';
import { selectRail, isRailId, type RailId } from './rail-router.service';
import {
  MAX_RETRIES,
  SOLANA_RETRY_PRIORITY_MULTIPLIER,
  classifyFailure,
  shouldRetrySameRail,
  type FailureKind,
} from '../config/rail-fallback';

// ── Input ────────────────────────────────────────────────────────────────────

export interface FailedPayment {
  /** Rail-side unique reference. The idempotency key. */
  paymentRef: string;
  rail: RailId;
  amount: number;
  /** Known when the rail told us which invoice it was paying. */
  invoiceId?: string;
  clientId?: string;
  businessId?: string;
  currency?: string;
  /** The processor's own wording, kept verbatim for the audit trail. */
  reason?: string;
}

export type RetryOutcome =
  | {
      action: 'retried';
      matchId: string;
      invoiceId: string;
      retryCount: number;
      fromRail: RailId;
      toRail: RailId;
      /** True when the retry stayed on the failed rail at a higher fee. */
      sameRailRetry: boolean;
      priorityFeeMultiplier: number | null;
      paymentLink: string;
      reasoning: string;
    }
  | {
      action: 'exhausted';
      matchId: string;
      invoiceId: string | null;
      retryCount: number;
      failedRails: RailId[];
      /** Notes from failure ownership, which is where this now goes. */
      escalationNotes: string[];
    }
  | { action: 'duplicate'; matchId: string; retryCount: number }
  | { action: 'unmatched'; matchId: string; reason: string }
  | { action: 'skipped'; reason: string };

// ── Trust events ─────────────────────────────────────────────────────────────

/**
 * Fire a retry trust event.
 *
 * The event type is scoped to the attempt — `payment.retry_attempted.2` for the
 * second — for a reason that has nothing to do with the bug it used to work
 * around.
 *
 * `InvoiceTrustEvent` is `@@unique([invoiceId, eventType])`, so one invoice can
 * hold one `payment.retry_attempted` and no more. When emit() still threw on
 * that constraint, the suffix was forced: without it the second retry hit the
 * unique index and died. emit() no longer throws (a repeat is now a no-op that
 * reports `recorded: false`), so the suffix is no longer required — but it is
 * still the better behaviour. Silently dropping the second attempt would leave
 * no record that a retry happened, and "this invoice was attempted three times
 * on three rails" is exactly the history this table exists to hold.
 *
 * Neither event appears in trust-core's delta map, so neither moves a score. A
 * client whose card was declined must not be penalised for it, and that is the
 * intended behaviour rather than an omission.
 */
async function emitRetryEvent(
  baseType: string,
  attempt: number,
  invoiceId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const eventType = attempt === 1 ? baseType : `${baseType}.${attempt}`;
  try {
    await trustCore.emit(eventType, {
      invoiceId,
      amount: typeof payload.amount === 'number' ? payload.amount : undefined,
      reason: typeof payload.reason === 'string' ? payload.reason : null,
      metadata: { ...payload },
    });
  } catch (err) {
    // A trust event failing must not fail the retry that produced it. The
    // payment is the thing that matters; the note about it is not.
    logger.warn(`[Retry] Trust event ${eventType} failed for ${invoiceId}: ${String(err)}`);
  }
}

// ── Invoice resolution ───────────────────────────────────────────────────────

interface ResolvedInvoice {
  id: string;
  number: string;
  status: string;
}

const RESOLVE_SELECT = { id: true, number: true, status: true } as const;

/** Statuses that mean the money is already in. */
const PAID_STATUSES = new Set(['paid', 'PAID', 'refunded', 'REFUNDED']);

/**
 * Find the invoice a failed payment was for.
 *
 * The rail usually says. When it does not, we fall back to the payer's most
 * recent unpaid invoice at the same amount — the same inference
 * `auto-reconciliation.service.ts` makes for successes, deliberately with a
 * narrower candidate set here. A retry acts on the invoice (it moves the
 * payment link and emails the client), so guessing wrong is worse than guessing
 * for a match that only records a row: we would move the wrong invoice's link
 * and tell the wrong client their card failed.
 */
async function resolveInvoice(payment: FailedPayment): Promise<ResolvedInvoice | null> {
  if (payment.invoiceId) {
    const named = await prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
      select: RESOLVE_SELECT,
    });
    if (named) return named;
  }

  if (!payment.clientId) return null;

  const amount = Number.isFinite(payment.amount) ? payment.amount : 0;
  const candidates = await prisma.invoice.findMany({
    where: {
      clientId: payment.clientId,
      status: { in: ['sent', 'SENT', 'overdue', 'payment_claimed'] },
    },
    orderBy: { dateIssued: 'desc' },
    take: 10,
    select: { ...RESOLVE_SELECT, subtotal: true },
  });

  const withinOnePercent = candidates.filter((c) => {
    const subtotal = Number(c.subtotal ?? 0);
    if (subtotal <= 0) return false;
    return Math.abs(subtotal - amount) / subtotal <= 0.01;
  });

  // An exact single match only. Two invoices at the same amount is precisely
  // the ambiguity that sends a real payment to a human review queue elsewhere
  // in this system; introducing it into a path that also moves a live payment
  // link would be strictly worse.
  if (withinOnePercent.length === 1) return withinOnePercent[0];

  // Nothing outstanding at this amount. Before calling it unattributable, check
  // whether the payment simply belongs to an invoice that has ALREADY been
  // paid — a decline can arrive after a retry succeeded. Reporting that as
  // "unmatched, a human will place it" would put a real payment into a review
  // queue for a transaction that is finished and correct.
  const settled = await prisma.invoice.findMany({
    where: { clientId: payment.clientId },
    orderBy: { dateIssued: 'desc' },
    take: 10,
    select: { ...RESOLVE_SELECT, subtotal: true },
  });
  const settledMatch = settled.filter((c) => PAID_STATUSES.has(c.status) && Number(c.subtotal ?? 0) > 0
    && Math.abs(Number(c.subtotal) - amount) / Number(c.subtotal) <= 0.01);
  if (settledMatch.length === 1) return settledMatch[0];

  return null;
}

// ── Link generation ──────────────────────────────────────────────────────────

/**
 * Build a payment link for `railId` on a specific invoice.
 *
 * Square goes through `createSquareInvoiceLink` rather than the generic rail
 * path, for the reason documented in invoice.service.ts: a Square Payment Link
 * is a fixed-price hosted page and ignores an `amount` query parameter, so the
 * generic path would collect whatever the link was pinned at.
 */
async function buildPaymentLink(
  railId: RailId,
  invoice: { id: string; number: string; subtotal: number },
  businessId: string,
  currency: string,
  target: string,
  clientEmail: string | null,
): Promise<string | null> {
  const rail = paymentRails[railId];
  if (!rail) return null;

  if (railId === 'square') {
    return (await createSquareInvoiceLink(businessId, { ...invoice, client: { email: clientEmail } }, currency))?.url ?? null;
  }

  const url = rail.getPaymentUrl(target, { amount: invoice.subtotal, number: invoice.number, currency });
  // bank.rail returns '' by design — there is no URL for a bank transfer. An
  // empty link is not a broken link, but it is not something we can put in a
  // "try again" email either, so the caller is told there is nothing to send.
  return url && url.length > 0 ? url : null;
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Handle a `payment.failed` notification: retry on another rail, or escalate.
 *
 * Safe to call repeatedly with the same paymentRef. A redelivery is recognised
 * by the reconciliation claim and returns `duplicate` without incrementing
 * anything or sending a second email.
 */
export async function handlePaymentFailed(payment: FailedPayment): Promise<RetryOutcome> {
  if (!isRailId(payment.rail)) {
    return { action: 'skipped', reason: `Unknown rail: ${payment.rail}` };
  }
  if (!payment.paymentRef) {
    return { action: 'skipped', reason: 'paymentRef is required' };
  }

  const failureKind = classifyFailure(payment.reason);

  // ── Step 1: claim the failure. Same insert-first gate as reconciliation. ────
  let matchId: string;
  try {
    const claim = await prisma.reconciliationMatch.create({
      data: {
        paymentRef: payment.paymentRef,
        rail: payment.rail,
        amount: new Prisma.Decimal(payment.amount),
        status: 'failed',
        confidence: 0,
        originalRail: payment.rail,
        lastFailureReason: payment.reason ?? null,
        failureKind,
        retryCount: 0,
      },
      select: { id: true },
    });
    matchId = claim.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.reconciliationMatch.findUnique({
        where: { paymentRef: payment.paymentRef },
        select: { id: true, retryCount: true },
      });
      logger.info(`[Retry] Duplicate payment.failed for ${payment.paymentRef}; ignoring.`);
      return { action: 'duplicate', matchId: existing?.id ?? '', retryCount: existing?.retryCount ?? 0 };
    }
    throw err;
  }

  const invoice = await resolveInvoice(payment);
  if (!invoice) {
    logger.warn(
      `[Retry] ${payment.paymentRef} failed on ${payment.rail} but no invoice could be identified; recorded and parked.`,
    );
    return {
      action: 'unmatched',
      matchId,
      reason: 'no invoice matched this failed payment; a human will place it',
    };
  }

  // A failure notification can arrive after the money landed — a retry that
  // succeeded while the original decline was still in flight, or simply a
  // processor that reports both. Retrying here would move a paid invoice's
  // payment link and email a client to pay again for something they have
  // already paid, so the attempt is recorded and nothing else happens.
  if (PAID_STATUSES.has(invoice.status)) {
    logger.info(
      `[Retry] ${payment.paymentRef} failed on ${payment.rail} but ${invoice.number} is already ${invoice.status}; recorded, no retry.`,
    );
    return {
      action: 'skipped',
      reason: `invoice ${invoice.number} is already ${invoice.status}`,
    };
  }

// ── Step 2: count this invoice's attempts, and spend one. ─────────────────
  // WHY THE BUDGET IS COUNTED PER INVOICE, NOT PER PAYMENT REF
  //
  // Each failed payment gets its own ReconciliationMatch row, because
  // paymentRef is unique and each attempt is a distinct fact. That makes a
  // per-row counter useless as a budget: every retry produced a new row with
  // retryCount 0, spent its first retry, and the count reset. The budget could
  // never be exhausted and the chain would walk forever — Square, then PayPal,
  // then bank, then Square again on the next new row.
  //
  // So the counter on the row records this invoice's attempt POSITION, and the
  // budget is decided against how many failed attempts the invoice has in
  // total. The two uses are the same number, which is why one column serves
  // both.
  //
  // The CAS on retryCount stays, but as defence in depth rather than the
  // primary gate: `paymentRef` being unique already means only one handler can
  // own a given failure, and the create-first claim is what enforces that.
  const current = await prisma.reconciliationMatch.findUnique({
    where: { id: matchId },
    select: { retryCount: true },
  });
  const fromRetryCount = current?.retryCount ?? 0;

  // Every rail this invoice has already been attempted on, INCLUDING the rail
  // that just failed.
  //
  // The current attempt is included explicitly rather than relying on the query
  // to find it. Its own row has no `invoiceId` at this point — it is only
  // written further down, once we know the retry succeeded — so it is invisible
  // to a query scoped by invoice, and leaving it out meant the exclusion list
  // was always empty on the first failure. The retry then landed back on the
  // rail that had just declined: a silent repeat, not a retry.
  const priorAttempts = await prisma.reconciliationMatch.findMany({
    where: { invoiceId: invoice.id, status: 'failed' },
    select: { rail: true },
  });
  const failedRails = [...new Set([payment.rail, ...priorAttempts.map((r) => r.rail)].filter(isRailId))];

  const attemptCount = priorAttempts.length + 1;

  const spent = await prisma.reconciliationMatch.updateMany({
    where: { id: matchId, retryCount: fromRetryCount },
    data: {
      retryCount: attemptCount,
      lastRetryRail: payment.rail,
      lastFailureReason: payment.reason ?? null,
      failureKind,
    },
  });
  if (spent.count === 0) {
    logger.info(`[Retry] Concurrent handling of ${payment.paymentRef}; another delivery won.`);
    return { action: 'duplicate', matchId, retryCount: fromRetryCount };
  }

  const retryCount = attemptCount;

  // ── Step 3: retry or escalate. ─────────────────────────────────────────────
  if (retryCount > MAX_RETRIES) {
    return escalate(matchId, invoice.id, retryCount, failedRails);
  }

  const full = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    select: {
      id: true,
      number: true,
      subtotal: true,
      clientId: true,
      businessId: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          passportId: true,
          // Eligibility on this path needs the same three fields the invoice
          // send path reads. Loading them here is what keeps a retry able to
          // reach the crypto and PayPal rails at all.
          passport: { select: { paymentScore: true, walletAddress: true, verified: true } },
        },
      },
      business: { select: { id: true, name: true, ownerId: true, address: true, currency: true } },
    },
  });
  if (!full) return { action: 'unmatched', matchId, reason: `invoice ${invoice.id} disappeared` };

  const currency = payment.currency ?? full.business?.currency ?? 'USD';
  const amount = Number(full.subtotal ?? payment.amount);

  const methods = await prisma.businessPaymentMethod.findMany({
    where: { businessId: full.businessId },
  });

  const sameRailRetry = shouldRetrySameRail(payment.rail, failureKind);

  let toRail: RailId;
  let reasoning: string;
  let priorityFeeMultiplier: number | null = null;

  if (sameRailRetry) {
    // ── Crypto-specific: congestion retries stay on-chain. ──────────────────
    // The client's wallet is already set up and funded. Moving them to a card
    // rail to clear a network queue would take a payment that costs fractions
    // of a cent and turn it into one that costs ~3%, and would hand them a
    // payment method they have not used before at the exact moment they are
    // most likely to abandon. Paying more for priority is the right answer to
    // a queue.
    toRail = 'solana';
    priorityFeeMultiplier = SOLANA_RETRY_PRIORITY_MULTIPLIER;
    reasoning =
      `Solana payment failed to land (${payment.reason ?? 'network congestion'}). ` +
      `Retrying on Solana at ${SOLANA_RETRY_PRIORITY_MULTIPLIER}× priority fee rather than moving rails — ` +
      `the wallet is already funded and a network queue is not a payment problem.`;
  } else {
    // Excluding the failed rails is what makes this a retry rather than a
    // repeat. Without it the chain would keep offering the rail that just
    // failed, since chain order is independent of what happened.
    let selection;
    try {
      selection = selectRail(
        {
          id: full.id,
          number: full.number ?? '',
          subtotal: full.subtotal,
          clientId: full.clientId,
          businessId: full.businessId,
        },
        {
          id: full.client.id,
          name: full.client.name,
          email: full.client.email,
          address: null,
        },
        methods,
        {
          businessAddress: full.business?.address ?? null,
          currency,
          excludeRails: failedRails,
          // Loaded for the same reason invoice send loads it: `canHandle` reads
          // `walletAddress` to decide whether Solana is reachable and `verified`
          // to decide whether PayPal can send a request. Both fail closed, so
          // leaving them null would not crash — it would quietly make every
          // retry route to bank, which on a retry path is the one outcome
          // guaranteed to need another human.
          passport: full.client.passport
            ? {
                paymentScore: full.client.passport.paymentScore,
                walletAddress: full.client.passport.walletAddress,
                verified: full.client.passport.verified,
              }
            : null,
        },
      );
    } catch (err) {
      logger.warn(`[Retry] Could not route a replacement for ${invoice.number}: ${String(err)}`);
      return escalate(matchId, invoice.id, retryCount, failedRails);
    }
    toRail = selection.method.railId as RailId;
    reasoning = selection.reasoning;
  }

  const method = methods.find((m) => m.railId === toRail);
  if (!method) {
    logger.warn(`[Retry] No registered ${toRail} method for business ${full.businessId}; escalating instead.`);
    return escalate(matchId, invoice.id, retryCount, failedRails);
  }

  const paymentLink = await buildPaymentLink(
    toRail,
    { id: full.id, number: full.number ?? '', subtotal: amount },
    full.businessId,
    currency,
    method.target,
    full.client.email,
  );

  if (!paymentLink) {
    // bank.rail has no URL. There is nothing to send the client, so a "retry"
    // here would be a silent no-op dressed as an attempt. Escalate honestly.
    logger.info(`[Retry] ${toRail} produces no payment link for ${full.number}; escalating.`);
    return escalate(matchId, invoice.id, retryCount, failedRails);
  }

  await prisma.invoice.update({
    where: { id: full.id },
    data: { paymentLink },
  });

  await prisma.reconciliationMatch.update({
    where: { id: matchId },
    data: {
      invoiceId: full.id,
      lastRetryRail: toRail,
      note: `Retry ${retryCount}/${MAX_RETRIES}: ${payment.rail} → ${toRail}. ${reasoning}`,
    },
  });

  await emitRetryEvent('payment.retry_attempted', retryCount, full.id, {
    amount,
    passportId: full.client.passportId ?? undefined,
    fromRail: payment.rail,
    toRail,
    retryCount,
    sameRailRetry,
    failureKind,
    businessId: full.businessId,
  });

  const railName = paymentRails[toRail]?.name ?? toRail;

  await emailService
    .sendPaymentRetryLink(full.client, full, full.business, {
      previousRail: paymentRails[payment.rail]?.name ?? payment.rail,
      newRail: railName,
      reason: payment.reason ?? undefined,
    })
    .catch((err) => logger.warn(`[Retry] Retry email failed for ${full.number}: ${String(err)}`));

  if (full.business?.ownerId) {
    await createNotification({
      userId: full.business.ownerId,
      type: 'invoice_payment_retry',
      title: `${full.number} — retrying on ${railName}`,
      body: `${paymentRails[payment.rail]?.name ?? payment.rail} declined (${payment.reason ?? 'no reason given'}). Moved to ${railName}, attempt ${retryCount} of ${MAX_RETRIES}.`,
    }).catch((err) => logger.warn(`[Retry] Business notification failed: ${String(err)}`));
  }

  logger.info(
    `[Retry] ${full.number} attempt ${retryCount}/${MAX_RETRIES}: ${payment.rail} → ${toRail}` +
      `${priorityFeeMultiplier ? ` at ${priorityFeeMultiplier}× priority` : ''}. ${reasoning}`,
  );

  return {
    action: 'retried',
    matchId,
    invoiceId: full.id,
    retryCount,
    fromRail: payment.rail,
    toRail,
    sameRailRetry,
    priorityFeeMultiplier,
    paymentLink,
    reasoning,
  };
}

/**
 * Out of retries — hand the invoice to the failure-ownership flow.
 *
 * Notified rather than silent: this is the point where a client stops getting
 * automated help, and someone has to pick it up.
 */
async function escalate(
  matchId: string,
  invoiceId: string,
  retryCount: number,
  failedRails: RailId[],
): Promise<RetryOutcome> {
  await prisma.reconciliationMatch.update({
    where: { id: matchId },
    data: {
      invoiceId,
      note: `Retries exhausted (${retryCount} failures across ${failedRails.join(', ') || 'one rail'}). Escalated to failure ownership.`,
    },
  });

  await emitRetryEvent('payment.retry_exhausted', 1, invoiceId, {
    retryCount,
    failedRails,
    businessId: undefined,
  });

  // `runFailureOwnership` is calendar-gated: it returns early unless the
  // invoice is more than FAILURE_OWNERSHIP_GRACE_DAYS past due. That is
  // correct behaviour for its own purpose and worth being explicit about here,
  // because it means an exhausted retry does NOT by itself engage the failure
  // flow — a payment that fails before the due date is not an overdue invoice,
  // and escalating it would email a client about lateness they have not
  // committed to. The notes come back either way so a caller can tell the
  // difference.
  const ownership = await runFailureOwnership(invoiceId, { notify: true });

  logger.warn(
    `[Retry] Retries exhausted for invoice ${invoiceId} (${retryCount} failures across ${failedRails.join(', ')}). ` +
      `Failure ownership: ${ownership.notes.join(' | ') || 'engaged'}`,
  );

  return {
    action: 'exhausted',
    matchId,
    invoiceId,
    retryCount,
    failedRails,
    escalationNotes: ownership.notes,
  };
}
