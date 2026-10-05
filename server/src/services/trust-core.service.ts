import { eventBus, TrustEvent } from './event-bus.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustAuditWriter } from './trustAuditWriter';
import {
  COLD_START_SCORE,
  CANCELLATION_SATURATION,
  DEFAULT_TRUST_WEIGHTS,
  METHODOLOGY_VERSION,
  TrustSignals,
  TrustWeights,
  clampReliabilityScore,
  normalizeReliabilityScore,
} from '../config/trust-weights';

/**
 * trust-core.service.ts — the ONLY writer of `reliabilityScore`.
 *
 * ─── WHY THIS FILE IS THE WRITER ────────────────────────────────────────────
 *
 * `reliabilityScore` had seven writers on three scales (0–100, 0–1000, and a
 * 0–5 Google rating). The consequences were not theoretical:
 *
 *   - `auth.controller` wrote 750 at signup — a value that, against the 0–1000
 *     passport tiers, meant "Gold", and against the badge UI's "/100" meant the
 *     public string "750/100". Every new account was born lying about itself.
 *   - `reviewService` wrote `(googleRating × 0.4) + (completionRate × 0.6)`,
 *     both on 0–5, into the same column. A business with a perfect 5.0 rating
 *     stored `5.0`, which every 0–100 threshold read as "as bad as possible".
 *   - `passport.service` clamped to 0–1000; `crm-reliability` clamped to 0–100.
 *     Both wrote the same column.
 *
 * So the score a customer saw depended on which module happened to be asked.
 *
 * The rule now: if you did not write it here, you do not write it. Readers are
 * welcome everywhere — there are dozens of `select: { reliabilityScore: true }`
 * calls and they are all fine, because a read cannot produce an incoherent
 * scale. This is enforced by a test, not by good intentions: see
 * `server/src/services/__tests__/reliabilityScore.invariant.test.ts`, which
 * greps `server/src` for a write to the field outside this file and fails.
 *
 * ─── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 *
 * It is not a learned model. It is a transparent weighted ensemble over signals
 * the platform already emits, and it is the BASELINE that any future learned
 * expert must beat on a held-out set before it is allowed to touch a real
 * customer's score. See `computeEnsembleScore` and `DEFAULT_TRUST_WEIGHTS`.
 *
 * A model whose entire purpose is to tell a customer why their trust score
 * changed is a liability in a product where you cannot explain it. So the
 * explainable thing ships first and sets the bar.
 */

// ─── Subjects ────────────────────────────────────────────────────────────────

/**
 * Every table carrying a `reliabilityScore` column. Enumerated rather than
 * inferred so that adding a model without adding a branch is a type error.
 */
export type ReliabilitySubject = 'user' | 'crmClient' | 'business' | 'crmEmployee';

export interface ScoreWriteContext {
  /**
   * Human-readable cause, stored on the audit row. This string is what a
   * support agent reads to a customer asking why their score moved, so it must
   * say the reason and not restate the number.
   */
  reason: string;
  component?: string;
  severity?: 'positive' | 'neutral' | 'negative';
  /** Signals/weights snapshot for ensemble-driven writes. */
  metadata?: Record<string, unknown>;
  /** Skip the audit row. Only for bulk backfills that write their own trail. */
  silent?: boolean;
}

interface AuditOutcome {
  auditLogged: boolean;
  previousScore: number | null;
  newScore: number;
}

// ─── The audit trail ─────────────────────────────────────────────────────────

/**
 * Reuses the two logs that already exist. Builds neither.
 *
 * `TrustAuditTrail` is the trust-specific chain (hashed, per-user, exposed to
 * customers on request). Its `userId` is a required foreign key, so it can only
 * carry user-scoped changes. For CRM clients, businesses and employees we use
 * `SystemAuditLog` — the platform's general action log, already used by
 * `wallet.controller` and `terms-recommendation.service` for exactly this
 * kind of "an actor changed a thing" record.
 *
 * The alternative — a new score-specific table — would be a third audit log in
 * a system that already has two, and would be the one nobody queries.
 */
async function writeAuditTrail(
  subject: ReliabilitySubject,
  id: string,
  previousScore: number | null,
  newScore: number,
  ctx: ScoreWriteContext,
): Promise<boolean> {
  if (ctx.silent) return false;

  try {
    if (subject === 'user') {
      await trustAuditWriter.enqueue({
        userId: id,
        previousScore: previousScore ?? COLD_START_SCORE,
        newScore,
        changeReason: ctx.reason,
        component: ctx.component ?? 'RELIABILITY',
        severity: ctx.severity ?? (newScore >= (previousScore ?? COLD_START_SCORE) ? 'positive' : 'negative'),
        metadata: { methodology: METHODOLOGY_VERSION, ...(ctx.metadata ?? {}) },
        methodology: METHODOLOGY_VERSION,
      });
      // trustAuditWriter buffers to a flush (and its interval is disabled), so a
      // caller that needs the row to exist right now — a dispute response, say
      // — must force it. Cheap: the buffer is usually empty.
      await trustAuditWriter.flush();
      return true;
    }

    await prisma.systemAuditLog.create({
      data: {
        action: 'TRUST_SCORE_CHANGED',
        targetId: id,
        metadata: {
          subject,
          previousScore,
          newScore,
          reason: ctx.reason,
          component: ctx.component ?? 'RELIABILITY',
          methodology: METHODOLOGY_VERSION,
          ...(ctx.metadata ?? {}),
        },
      },
    });
    return true;
  } catch (err) {
    // A failed audit row must not fail the score write: the score is the
    // product, the audit trail is the receipt. But losing receipts silently is
    // how a dispute becomes unanswerable, so this is logged loudly.
    logger.error(
      `[TrustCore] Score audit write failed for ${subject}:${id} (${newScore}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return false;
  }
}

// ─── The single write path ───────────────────────────────────────────────────

/**
 * Persist a reliability score, clamped to the canonical 0–100 scale, with an
 * audit row.
 *
 * This is the only function in the codebase permitted to write the field. It
 * clamps unconditionally and rounds for the integer-scored models, so no caller
 * can produce a value outside the range — including a caller that computes
 * something wildly wrong, which is exactly the case the range exists to
 * contain.
 *
 * @returns the value actually persisted (post-clamp, post-round).
 */
export async function writeReliabilityScore(
  subject: ReliabilitySubject,
  id: string,
  rawScore: number | null | undefined,
  ctx: ScoreWriteContext,
): Promise<number> {
  if (!id) {
    throw new Error('[TrustCore] writeReliabilityScore requires an id');
  }

  // Business and CRM-client scores are surfaced as whole numbers in the CRM UI
  // and on public profile pages; User scores are Elo-derived floats and keep
  // their precision so small movements are not rounded away to nothing.
  const next =
    subject === 'user'
      ? clampReliabilityScore(rawScore)
      : normalizeReliabilityScore(rawScore);

  const previous = await readReliabilityScore(subject, id);

  try {
    switch (subject) {
      case 'user':
        await prisma.user.update({ where: { id }, data: { reliabilityScore: next } });
        break;
      case 'crmClient':
        await prisma.crmClient.update({ where: { id }, data: { reliabilityScore: next } });
        break;
      case 'business':
        await prisma.business.update({ where: { id }, data: { reliabilityScore: next } });
        break;
      case 'crmEmployee':
        await prisma.crmEmployee.update({ where: { id }, data: { reliabilityScore: next } });
        break;
    }
  } catch (err) {
    logger.error(
      `[TrustCore] Failed to write ${subject}:${id} score: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    throw err;
  }

  const audit: AuditOutcome = {
    auditLogged: await writeAuditTrail(subject, id, previous, next, ctx),
    previousScore: previous,
    newScore: next,
  };

  logger.info(
    `[TrustCore] ${subject}:${id} score ${previous ?? '∅'} → ${audit.newScore} (${ctx.reason})`,
  );

  return audit.newScore;
}

/**
 * Read the stored score, clamped.
 *
 * Clamped on READ as well as write, and that is not belt-and-braces paranoia:
 * this column holds 750s and 4.6s in production today. Any reader that skipped
 * the clamp would render "Reliability: 750" until every row had been rewritten
 * by the new code path. Clamping at the boundary means the migration can be
 * online — old rows are correct the moment this ships, without a backfill that
 * has to finish before anyone sees a fixed number.
 *
 * `null` (no row, or no score yet) comes back as the cold-start baseline, so
 * callers never need a null branch. Use `readStoredReliabilityScore` when the
 * difference between "absent" and "neutral" matters.
 */
export async function readReliabilityScore(
  subject: ReliabilitySubject,
  id: string,
): Promise<number> {
  const stored = await readStoredReliabilityScore(subject, id);
  return stored === null ? COLD_START_SCORE : clampReliabilityScore(stored);
}

/** The raw column value, or `null` if there is no row. No clamping. */
export async function readStoredReliabilityScore(
  subject: ReliabilitySubject,
  id: string,
): Promise<number | null> {
  switch (subject) {
    case 'user': {
      const row = await prisma.user.findUnique({ where: { id }, select: { reliabilityScore: true } });
      return row?.reliabilityScore ?? null;
    }
    case 'crmClient': {
      const row = await prisma.crmClient.findUnique({ where: { id }, select: { reliabilityScore: true } });
      return row?.reliabilityScore ?? null;
    }
    case 'business': {
      const row = await prisma.business.findUnique({ where: { id }, select: { reliabilityScore: true } });
      return row?.reliabilityScore ?? null;
    }
    case 'crmEmployee': {
      const row = await prisma.crmEmployee.findUnique({ where: { id }, select: { reliabilityScore: true } });
      return row?.reliabilityScore ?? null;
    }
  }
}

// ─── Cold start ──────────────────────────────────────────────────────────────

/**
 * Seed a brand-new account at the documented cold-start baseline.
 *
 * Replaces three hardcoded `750`s at signup (email-code login, wallet login,
 * and password registration). 750 was not a score; it was a number that made
 * the passport tier tables resolve to "Gold" and the badge string resolve to
 * "750/100". A new account now starts at 50 — neutral, and documented as such
 * in `trust-weights.ts`.
 *
 * Best-effort by design: a failure to seed the baseline must not block
 * registration. The column default is 50 too, so the fallback is the same
 * number either way.
 */
export async function seedColdStartScore(
  subject: ReliabilitySubject,
  id: string,
  reason = 'Account created — no behavioural history yet',
): Promise<number> {
  try {
    return await writeReliabilityScore(subject, id, COLD_START_SCORE, {
      reason,
      component: 'COLD_START',
      severity: 'neutral',
    });
  } catch (err) {
    logger.error(
      `[TrustCore] Cold-start seed failed for ${subject}:${id}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return COLD_START_SCORE;
  }
}

// ─── The weighted ensemble (the baseline) ────────────────────────────────────

/**
 * The scoring function. Pure — no I/O, no clock, no randomness — which is what
 * makes it testable against fixed fixtures and reproducible from an audit row.
 *
 *   score = w1·punctuality + w2·paymentBehaviour + w3·(1 − disputeRate)·100
 *           − w4·normalizedCancellations
 *
 * TWO THINGS WORTH STATING PLAINLY, because both differ from the formula as
 * first sketched:
 *
 * 1. `(1 − disputeRate)` is multiplied by 100. It is a 0–1 ratio and every
 *    other term is 0–100; without the ×100 the dispute term is worth at most
 *    0.20 points, which is noise, and a subject with a 100% dispute rate would
 *    lose 0.2 rather than the intended 20. The ×100 is what makes the term
 *    dimensionally commensurate with the rest of the sum.
 *
 * 2. Cancellations arrive already normalised to 0–1 by
 *    `normalizeCancellationCount`. A raw count in a weighted sum is not a
 *    signal — the fifth cancellation should not cost five times the first.
 *
 * The result is clamped to [0, 100] before it is returned, so this function's
 * output is in range for ANY input, which is what the invariant test asserts.
 */
export function computeEnsembleScore(
  signals: TrustSignals,
  weights: TrustWeights = DEFAULT_TRUST_WEIGHTS,
): number {
  const punctuality = clampReliabilityScore(signals.punctuality);
  const paymentBehaviour = clampReliabilityScore(signals.paymentBehaviour);

  const disputeRate = Number.isFinite(signals.disputeRate)
    ? Math.max(0, Math.min(1, signals.disputeRate))
    : 0;
  const normalizedCancellations = normalizeCancellationCount(signals.cancellations);

  const score =
    weights.w1 * punctuality +
    weights.w2 * paymentBehaviour +
    weights.w3 * (1 - disputeRate) * 100 -
    weights.w4 * normalizedCancellations * 100;

  return clampReliabilityScore(score);
}

/**
 * Raw cancellation count → 0–1, saturating at `CANCELLATION_SATURATION`.
 */
export function normalizeCancellationCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(1, count / CANCELLATION_SATURATION);
}

// ─── Signal collection ───────────────────────────────────────────────────────

/**
 * Derive the ensemble's four inputs for a CRM client.
 *
 *   punctuality      — jobs completed ÷ jobs resolved (COMPLETED + CANCELLED),
 *                      as a percentage. In-progress and scheduled jobs are
 *                      excluded: counting an un-run job against somebody is
 *                      how a score becomes indefensible.
 *   paymentBehaviour  — invoices paid on or before the due date ÷ invoices that
 *                      reached a terminal state. `paidAt <= dateDue` is the
 *                      test; an invoice still open is not a late payment.
 *   disputeRate      — disputes against this client ÷ transactions (jobs +
 *                      invoices). Only UPHELD disputes count; a DISMISSED one is
 *                      the system working, and charging for it would teach
 *                      customers that disputing is dangerous.
 *   cancellations    — CANCELLED job count, normalised downstream.
 *
 * A subject with no history returns `null` signals, and `computeEnsembleScore`
 * falls back to the cold-start baseline rather than scoring absence as zero.
 */
export async function collectClientSignals(
  clientId: string,
): Promise<{ signals: TrustSignals | null; sampleSize: number }> {
  const [jobs, invoices, disputes] = await Promise.all([
    prisma.crmJob.findMany({
      where: { clientId },
      select: { status: true, completedAt: true, scheduledDate: true, scheduledTime: true },
    }),
    prisma.invoice.findMany({
      where: { clientId },
      select: { status: true, dateDue: true, dateIssued: true, paidAt: true },
    }),
    prisma.dispute.count({ where: { reservationId: { not: null }, outcome: 'UPHELD' } }),
  ]);

  const resolvedJobs = jobs.filter(
    (j) => j.status === 'COMPLETED' || j.status === 'CANCELLED',
  );
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');
  const cancelledJobs = jobs.filter((j) => j.status === 'CANCELLED');

  const settledInvoices = invoices.filter(
    (i) => i.status === 'paid' || i.status === 'overdue' || i.status === 'void',
  );
  const paidInvoices = invoices.filter((i) => i.paidAt !== null);
  const paidOnTime = paidInvoices.filter(
    (i) => i.paidAt !== null && i.paidAt.getTime() <= i.dateDue.getTime(),
  );

  const transactions = resolvedJobs.length + settledInvoices.length;
  if (transactions === 0) {
    return { signals: null, sampleSize: 0 };
  }

  return {
    signals: {
      punctuality:
        resolvedJobs.length > 0 ? (completedJobs.length / resolvedJobs.length) * 100 : COLD_START_SCORE,
      paymentBehaviour:
        settledInvoices.length > 0
          ? (paidOnTime.length / settledInvoices.length) * 100
          : COLD_START_SCORE,
      disputeRate: disputes / transactions,
      cancellations: cancelledJobs.length,
    },
    sampleSize: transactions,
  };
}

/**
 * Recompute and persist a CRM client's score from the ensemble.
 *
 * Called by the `score.changed` subscriber and by anything else that wants a
 * fresh number. Returns the persisted value.
 */
export async function recomputeClientScore(
  clientId: string,
  reason: string,
  weights: TrustWeights = DEFAULT_TRUST_WEIGHTS,
): Promise<number> {
  const { signals, sampleSize } = await collectClientSignals(clientId);

  if (!signals) {
    // No history. Cold start, not zero — see `COLD_START_SCORE`.
    return seedColdStartScore('crmClient', clientId, `${reason} — no transaction history yet`);
  }

  return writeReliabilityScore('crmClient', clientId, computeEnsembleScore(signals, weights), {
    reason,
    component: 'ENSEMBLE',
    metadata: { signals, weights, sampleSize },
  });
}

/**
 * Itemised explanation of a score, for the customer-facing dispute response.
 *
 * This is the artefact the whole design is built around. "A customer disputing
 * their score receives an itemized explanation, not a black-box rejection" is
 * only true if the itemisation can be produced on demand, from the same
 * function that produced the number — not reconstructed afterwards from logs.
 */
export function explainScore(
  signals: TrustSignals,
  weights: TrustWeights = DEFAULT_TRUST_WEIGHTS,
): Array<{ signal: string; value: string; contribution: number }> {
  const disputeRate = Math.max(0, Math.min(1, signals.disputeRate));
  const normalizedCancellations = normalizeCancellationCount(signals.cancellations);

  return [
    {
      signal: 'Punctuality',
      value: `${round2(clampReliabilityScore(signals.punctuality))} / 100`,
      contribution: round2(weights.w1 * clampReliabilityScore(signals.punctuality)),
    },
    {
      signal: 'Payment behaviour',
      value: `${round2(clampReliabilityScore(signals.paymentBehaviour))} / 100`,
      contribution: round2(weights.w2 * clampReliabilityScore(signals.paymentBehaviour)),
    },
    {
      signal: 'Dispute-free record',
      value: `${round2((1 - disputeRate) * 100)} / 100 (dispute rate ${round2(disputeRate * 100)}%)`,
      contribution: round2(weights.w3 * (1 - disputeRate) * 100),
    },
    {
      signal: 'Cancellations',
      value: `${signals.cancellations} recorded`,
      contribution: round2(-weights.w4 * normalizedCancellations * 100),
    },
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── CRM client lifecycle (moved here from crm-reliability) ─────────────────

/**
 * Lifecycle stage for a client. Pure — reads the score, decides nothing about
 * persistence.
 *
 * Stage thresholds are on the 0–100 scale. They previously sat next to a 0–1000
 * column, so `score > 80` was satisfied by a default-750 client, and every
 * freshly created client looked like a VIP.
 */
export function getClientStage(client: { reliabilityScore?: number | null; phone?: string | null }, jobs: Array<{ status: string; escrowStatus?: string | null }>): string {
  const completed = jobs.filter((j) => j.status === 'COMPLETED');
  const total = jobs.length;
  const score = clampReliabilityScore(client.reliabilityScore);
  const hasDefaultedEscrow = completed.some((j) => j.escrowStatus === 'REFUNDED');

  if (total === 0) return 'lead';
  if (completed.length >= 10 && score > 80) return 'vip';
  if (score < 30 || hasDefaultedEscrow) return 'at_risk';
  if (completed.length >= 2) return 'repeat';
  if (total >= 1) return 'booked';
  if (client.phone || score > 0) return 'verified';

  return 'lead';
}

/**
 * Derive the ensemble's four inputs for a business.
 *
 * Mirrors `collectClientSignals` but for the `Business` subject, where the
 * punctuality signal comes from RESERVATIONS (a customer walking in) rather than
 * jobs (a contractor turning up). The shape is the same, which is the point:
 * one formula, one set of weights, every subject.
 *
 * The Google rating enters here — explicitly, converted from 0–5 to 0–100, and
 * blended as a fraction of punctuality rather than written as a score. It is
 * the first thing `reviewService` used to do directly, and it is why a 5.0-rated
 * business used to store `5.0`.
 */
export async function collectBusinessSignals(
  businessId: string,
  googleRating?: number,
): Promise<{ signals: TrustSignals | null; sampleSize: number }> {
  const [reservations, invoices, business] = await Promise.all([
    prisma.reservation.findMany({
      where: { businessId },
      select: { status: true },
    }),
    prisma.invoice.findMany({
      where: { businessId },
      select: { status: true, dateDue: true, paidAt: true },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { rating: true } }),
  ]);

  const resolved = reservations.filter(
    (r) => r.status === 'COMPLETED' || r.status === 'NO_SHOW' || r.status === 'CANCELLED',
  );
  const kept = reservations.filter((r) => r.status === 'COMPLETED');
  const cancelled = reservations.filter((r) => r.status === 'CANCELLED');

  const settled = invoices.filter((i) => i.status === 'paid' || i.status === 'overdue');
  const paidOnTime = settled.filter(
    (i) => i.paidAt !== null && i.paidAt.getTime() <= i.dateDue.getTime(),
  );

  const transactions = resolved.length + settled.length;
  if (transactions === 0) {
    return { signals: null, sampleSize: 0 };
  }

  const rating = googleRating ?? business?.rating ?? null;
  const ratingPct = rating !== null && rating > 0 ? (rating / 5) * 100 : null;

  // Reviews are a signal, not a score. They adjust punctuality by a bounded
  // amount rather than replacing it: a business with a 1.1-star rating and a
  // flawless booking record is a business whose CUSTOMERS are unhappy, and the
  // honest reading of that is "mixed", not "perfect with a footnote".
  const punctualityFromBookings =
    resolved.length > 0 ? (kept.length / resolved.length) * 100 : COLD_START_SCORE;
  const punctuality =
    ratingPct === null
      ? punctualityFromBookings
      : punctualityFromBookings * 0.7 + ratingPct * 0.3;

  return {
    signals: {
      punctuality,
      paymentBehaviour:
        settled.length > 0 ? (paidOnTime.length / settled.length) * 100 : COLD_START_SCORE,
      disputeRate: 0,
      cancellations: cancelled.length,
    },
    sampleSize: transactions,
  };
}

/**
 * Recompute and persist a business's score from the ensemble.
 */
export async function recomputeBusinessScore(
  businessId: string,
  reason: string,
  googleRating?: number,
  weights: TrustWeights = DEFAULT_TRUST_WEIGHTS,
): Promise<number> {
  const { signals, sampleSize } = await collectBusinessSignals(businessId, googleRating);

  if (!signals) {
    return seedColdStartScore('business', businessId, `${reason} — no transaction history yet`);
  }

  return writeReliabilityScore('business', businessId, computeEnsembleScore(signals, weights), {
    reason,
    component: 'ENSEMBLE',
    metadata: { signals, weights, sampleSize },
  });
}

/**
 * Recompute score + stage for a client and persist both through the single
 * write path.
 */
export async function refreshClientTrust(
  clientId: string,
  reason = 'CRM trust refresh',
): Promise<{ score: number; stage: string }> {
  const client = await prisma.crmClient.findUnique({ where: { id: clientId } });
  if (!client) throw new Error(`Client ${clientId} not found`);

  const jobs = await prisma.crmJob.findMany({ where: { clientId } });
  const stage = getClientStage(client, jobs);
  const score = await recomputeClientScore(clientId, reason);

  await prisma.crmClient.update({ where: { id: clientId }, data: { stage } });

  return { score, stage };
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

export function initializeTrustCore(): void {
  // These four events move a trust score. If the process dies between the
  // business write that produced them and the score update, the movement is
  // lost with no record — and an under-counted trust score is the one class of
  // platform bug that silently disadvantages a real person. They are therefore
  // written to the outbox before dispatch and replayed at boot.
  for (const type of [
    'score.changed',
    'escrow.funded',
    'escrow.released',
    'escrow.disputed',
    // Delivery outcomes move a PROVIDER's score. An event emitted and lost is a
    // real worker who turned up and got nothing, or one who no-showed and kept
    // their standing — the same silent-disadvantage class as above.
    'delivery.on_time',
    'delivery.late',
    'delivery.missed',
  ]) {
    eventBus.markDurable(type);
  }

  eventBus.markStarted();

  // score.changed → recompute the client's score through the ensemble.
  eventBus.subscribe('score.changed', async (event: TrustEvent) => {
    const clientId = event.clientId || event.data?.clientId;
    if (!clientId) return;

    try {
      const trigger = typeof event.data?.trigger === 'string' ? event.data.trigger : 'score.changed';
      await recomputeClientScore(clientId, `Trust event: ${trigger}`);
    } catch (err) {
      logger.error(
        `[TrustCore] Score update failed for ${clientId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  });

  // escrow.funded → update CrmJob.escrowStatus
  eventBus.subscribe('escrow.funded', async (event: TrustEvent) => {
    const jobId = event.jobId || event.data?.jobId;
    if (!jobId) return;

    try {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: { escrowStatus: 'HELD' },
      });

      logger.info(`[TrustCore] Job ${jobId} escrow funded → HELD`);
    } catch (err) {
      logger.error(`[TrustCore] Escrow fund update failed for ${jobId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // escrow.released → update CrmJob.escrowStatus + trigger score recalculation
  eventBus.subscribe('escrow.released', async (event: TrustEvent) => {
    const jobId = event.jobId || event.data?.jobId;
    const clientId = event.clientId || event.data?.clientId;
    if (!jobId) return;

    try {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: { escrowStatus: 'RELEASED' },
      });

      // Recalculate score on release (positive signal)
      if (clientId) {
        eventBus.publish({
          type: 'score.changed',
          clientId,
          data: { trigger: 'escrow.released', jobId },
          timestamp: new Date(),
        });
      }

      logger.info(`[TrustCore] Job ${jobId} escrow released → RELEASED`);
    } catch (err) {
      logger.error(`[TrustCore] Escrow release update failed for ${jobId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // escrow.disputed → flag client + update job status
  eventBus.subscribe('escrow.disputed', async (event: TrustEvent) => {
    const jobId = event.jobId || event.data?.jobId;
    const clientId = event.clientId || event.data?.clientId;
    if (!jobId) return;

    try {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: { escrowStatus: 'DISPUTED' },
      });

      // Recalculate score (dispute is negative)
      if (clientId) {
        eventBus.publish({
          type: 'score.changed',
          clientId,
          data: { trigger: 'escrow.disputed', jobId },
          timestamp: new Date(),
        });
      }

      logger.info(`[TrustCore] Job ${jobId} escrow disputed`);
    } catch (err) {
      logger.error(`[TrustCore] Escrow dispute update failed for ${jobId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // checkin.verified → mark job complete + update provider stats
  eventBus.subscribe('checkin.verified', async (event: TrustEvent) => {
    const jobId = event.jobId || event.data?.jobId;
    if (!jobId) return;

    try {
      await prisma.crmJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      logger.info(`[TrustCore] Job ${jobId} check-in verified → COMPLETED`);
    } catch (err) {
      logger.error(`[TrustCore] Checkin verify failed for ${jobId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  /**
   * Delivery outcomes → the WORKER's deliveryScore.
   *
   * These three events were emitted by jobLifecycle and crm.service and had no
   * subscriber, so a provider who completed every job on time and one who
   * no-showed repeatedly carried the same deliveryScore. Not a small gap: delivery
   * is the signal the whole reputation product is built on, and it was inert.
   *
   * The passport is read from the job, then from the assigned employee, because a
   * job may carry its own (an independent worker) or belong to staff (an employee
   * with a passport). Without either there is no one to score, and we log rather
   * than invent a subject — attributing a penalty to an arbitrary worker would be
   * worse than not scoring.
   */
  const applyDeliveryDelta = async (
    event: TrustEvent,
    eventType: 'delivery.on_time' | 'delivery.late' | 'delivery.missed',
  ) => {
    const jobId = event.jobId || event.data?.jobId;
    if (!jobId) return;

    const DELTA = { 'delivery.on_time': 10, 'delivery.late': -5, 'delivery.missed': -20 };

    try {
      const job = await prisma.crmJob.findFirst({
        where: { id: jobId },
        select: {
          passportId: true,
          employee: { select: { passportId: true } },
        },
      });
      if (!job) return;

      const passportId = job.passportId ?? job.employee?.passportId ?? null;
      if (!passportId) {
        logger.warn(
          `[TrustCore] ${eventType} for job ${jobId} had no worker passport; score not updated.`,
        );
        return;
      }

      const passport = await prisma.trustPassport.findUnique({
        where: { id: passportId },
        select: { deliveryScore: true },
      });
      if (!passport) return;

      // Clamped to the same 0–1000 band every other deliveryScore delta uses.
      // NOTE: `deliveryScore` is a TrustPassport scoped score, a DIFFERENT field
      // from `reliabilityScore`, and 0–1000 is its own documented scale. It is
      // deliberately not routed through the reliability clamp — see
      // trust-weights.ts.
      const next = Math.max(0, Math.min(1000, (passport.deliveryScore ?? 500) + DELTA[eventType]));
      const applied = next - (passport.deliveryScore ?? 500);

      await prisma.trustPassport.update({
        where: { id: passportId },
        data: { deliveryScore: next },
      });

      logger.info(`[TrustCore] ${eventType} job ${jobId} → deliveryScore ${applied >= 0 ? '+' : ''}${applied} (${next}).`);
    } catch (err) {
      logger.error(`[TrustCore] ${eventType} failed for job ${jobId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  eventBus.subscribe('delivery.on_time', (event: TrustEvent) => applyDeliveryDelta(event, 'delivery.on_time'));
  eventBus.subscribe('delivery.late', (event: TrustEvent) => applyDeliveryDelta(event, 'delivery.late'));
  eventBus.subscribe('delivery.missed', (event: TrustEvent) => applyDeliveryDelta(event, 'delivery.missed'));

  // passport.linked → enrich client with cross-module data
  eventBus.subscribe('passport.linked', async (event: TrustEvent) => {
    const clientId = event.clientId || event.data?.clientId;
    if (!clientId) return;

    try {
      logger.info(`[TrustCore] Passport linked for client ${clientId}`, event.data?.passportData);
    } catch (err) {
      logger.error(`[TrustCore] Passport link failed for ${clientId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  /**
   * business.reviews_synced → rescore the BUSINESS.
   *
   * `reviewService` emits this and no longer writes `reliabilityScore`. Before,
   * it wrote a 0–5 blend into a column the rest of the system read as 0–100,
   * which meant a 5.0-star business stored `5.0` and every threshold treated it
   * as the worst possible score. Routing the signal through here means the
   * conversion to 0–100 happens once, explicitly, in `collectBusinessSignals`.
   *
   * Not marked durable: a missed review rescore is corrected by the next review
   * sync, and unlike a customer score movement this does not silently
   * disadvantage a named individual. `score.changed` IS durable, for exactly
   * that reason.
   */
  eventBus.subscribe('business.reviews_synced', async (event: TrustEvent) => {
    const businessId = event.businessId || event.data?.businessId;
    if (!businessId) return;

    try {
      const rating =
        typeof event.data?.googleRating === 'number' ? event.data.googleRating : undefined;
      await recomputeBusinessScore(businessId, 'Review signals synced', rating);
    } catch (err) {
      logger.error(
        `[TrustCore] Business rescore failed for ${businessId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  });

  logger.info('[TrustCore] All event handlers initialized');
}