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
 * Fire a retry trust event without tripping the audit table's unique index.
 *
 * `InvoiceTrustEvent` is `@@unique([invoiceId, eventType])`, and
 * `trustCore.emit` rethrows on a failed insert. So emitting
 * `payment.retry_attempted` a second time for one invoice — which is the normal
 * case, since MAX_RETRIES is more than one — throws. It does not fail loudly in
 * a useful place either: the caller is a webhook that swallows the rejection,
 * so the retry silently stops after the first attempt.
 *
 * Two fixes, applied together:
 *
 *   1. Scope the event type to the attempt (`payment.retry_attempted.2`), so a
 *      second retry is a genuinely distinct fact worth its own row rather than
 *      a duplicate write. Attempt 1 keeps the bare name so the event is
 *      greppable by its documented name.
 *   2. Swallow the unique violation if one still occurs. Belt and braces, and
 *      it means a future event type added here degrades to a no-op instead of
 *      breaking the retry chain.
 *
 * Neither event appears in trust-core's delta map, so neither moves a score —
 * a client whose card was declined must not be penalised for it. That is the
 * intended behaviour, not an omission.
 */
async function emitRetryEvent(baseType: string, attempt: number, invoiceId: string, payload: Record<string, unknown>): Promise<void> {
  const eventType = attempt === 1 ? baseType : `${baseType}.${attempt}`;
  try {
    await trustCore.emit(eventType, {
      invoiceId,
      amount: payload.amount,
      reason: payload.reason ?? null,
      metadata: { ...payload },
    } as Parameters<typeof trustCore.emit>[1]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      logger.info(`[Retry] Trust event ${eventType} already recorded for ${invoiceId}; not repeating.`);
      return;
    }
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
  return withinOnePercent.length === 1 ? withinOnePercent[0] : null;
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

  // ── Step 2: spend one retry, atomically. ───────────────────────────────────
  // Compare-and-swap on retryCount. Two concurrent deliveries of the same
  // failure both read 0; both try to write 1 with `retryCount: 0` in the
  // filter; the database lets exactly one through. The loser returns
  // `duplicate` and sends nothing.
  const current = await prisma.reconciliationMatch.findUnique({
    where: { id: matchId },
    select: { retryCount: true },
  });
  const fromRetryCount = current?.retryCount ?? 0;

  const spent = await prisma.reconciliationMatch.updateMany({
    where: { id: matchId, retryCount: fromRetryCount },
    data: {
      retryCount: fromRetryCount + 1,
      lastRetryRail: payment.rail,
      lastFailureReason: payment.reason ?? null,
      failureKind,
    },
  });
  if (spent.count === 0) {
    logger.info(`[Retry] Concurrent handling of ${payment.paymentRef}; another delivery won.`);
    return { action: 'duplicate', matchId, retryCount: fromRetryCount };
  }

  const retryCount = fromRetryCount + 1;

  // Every rail this invoice has already been attempted on. Derived from the
  // attempt rows rather than tracked separately, so it cannot drift from the
  // history that actually happened.
  const priorAttempts = await prisma.reconciliationMatch.findMany({
    where: { invoiceId: invoice.id, status: 'failed' },
    select: { rail: true },
  });
  const failedRails = [...new Set(priorAttempts.map((r) => r.rail).filter(isRailId))];

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
      client: { select: { id: true, name: true, email: true, passportId: true } },
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
          // The passport is not loaded on this path, so wallet and verification
          // state are unknown. Left null rather than guessed: `canHandle` fails
          // closed on both, so an unknown client simply does not get offered
          // Solana or PayPal here. Loading the passport would be better, and is
          // the obvious follow-up — the retry is exactly when eligibility
          // matters most, because it is the path that runs after a failure.
          passport: null,
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
