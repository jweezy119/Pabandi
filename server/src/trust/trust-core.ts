import { Prisma, PrismaClient } from '@prisma/client';
import { emailService } from '../services/email.service';
import { writeAttestation } from '../services/onchain-attestation.service';

const prisma = new PrismaClient();

type TrustEventPayload = {
  passportId?: string;
  invoiceId?: string;
  dealId?: string;
  jobId?: string;
  amount?: number;
  minutesLate?: number;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  clientId?: string;
  taskId?: string;
  clientPassportId?: string;
  [key: string]: unknown;
};

/**
 * What happened when a trust event was fired.
 *
 * Returned rather than `void` so callers and tests can tell the two outcomes
 * apart: an event that was written, and one that was already on record. Both
 * are successes; the difference matters when debugging why a score did or did
 * not move.
 */
export interface EmitResult {
  /** True when a new row was written. False when the fact was already recorded. */
  recorded: boolean;
  eventType: string;
  invoiceId: string | null;
  passportId: string | null;
}

/** Score-affecting events. Everything else is logged and nothing more. */
const SCORE_DELTAS: Record<string, { field: 'paymentScore' | 'deliveryScore' | 'showUpScore'; delta: number }> = {
  'invoice.paid_on_time': { field: 'paymentScore', delta: +10 },
  'invoice.paid_late': { field: 'paymentScore', delta: -5 },
  'invoice.overdue': { field: 'paymentScore', delta: -15 },
  'delivery.on_time': { field: 'deliveryScore', delta: +10 },
  'delivery.late': { field: 'deliveryScore', delta: -5 },
  'delivery.missed': { field: 'deliveryScore', delta: -20 },
  'booking.no_show': { field: 'showUpScore', delta: -20 },
  'delivery.checked_in': { field: 'showUpScore', delta: +5 },
};

/** Events worth writing to an on-chain attestation. */
const ATTESTATION_EVENT_TYPES = new Set([
  'invoice.paid_on_time',
  'invoice.paid_late',
  'delivery.on_time',
  'delivery.missed',
  'booking.attended',
  'booking.no_show',
  'escrow.released',
  'escrow.disputed',
]);

/** Is this the unique-constraint violation the idempotency guard relies on? */
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

class TrustCore {
  /**
   * Record a trust event.
   *
   * ─── TWO THINGS THIS NO LONGER DOES ───────────────────────────────────────
   *
   * **It does not invent an invoice.** It used to fill a missing `invoiceId`
   * with `prisma.invoice.findFirst()`. Twenty-one of the thirty-two call sites
   * pass no invoice — booking lifecycle, delivery check-ins, escrow movements,
   * reviews — so this was the normal path, and it filed each of those events
   * against an unrelated invoice. That corrupted the misfiled invoice's
   * history and could collide with its own events on the unique index, which
   * threw. A missing invoice is now a null invoice.
   *
   * **It does not throw when the fact is already recorded.** The unique index
   * on (invoiceId, eventType) exists to make repeats harmless — failure
   * ownership documents relying on exactly that — but the catch block
   * rethrew, so the second `invoice.overdue` for an invoice threw instead of
   * doing nothing. Most callers `await` this without a catch, so a routine
   * repeat could fail the operation that produced it.
   *
   * A genuine database error still propagates. Silently swallowing those would
   * hide an outage behind a green request, which is a different bug rather than
   * an absent one.
   */
  async emit(eventType: string, payload: TrustEventPayload): Promise<EmitResult> {
    const invoiceId = payload.invoiceId ?? null;
    const passportId = payload.passportId || payload.clientPassportId || null;

    try {
      await prisma.invoiceTrustEvent.create({
        data: {
          invoiceId,
          passportId,
          eventType,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Already on record. That is the constraint doing its job, and the
        // score is deliberately NOT moved a second time — a repeated penalty
        // for one failure would be worse than a lost one.
        return { recorded: false, eventType, invoiceId, passportId };
      }
      console.error(`[TrustCore] emit failed for ${eventType}:`, err);
      throw err;
    }

    if (passportId) {
      await this.updateScopedScore(eventType, passportId);
    }

    if (passportId && ATTESTATION_EVENT_TYPES.has(eventType)) {
      // The attestation has to point at something. `payload` carries an index
      // signature, so each candidate is narrowed to a string rather than
      // asserted — an attestation written against a reference that is not a
      // reference is worse than one that was not written.
      const referenceId =
        [payload.invoiceId, payload.jobId, payload.dealId, payload.bookingId, invoiceId].find(
          (value): value is string => typeof value === 'string' && value.length > 0,
        ) ?? passportId;

      // Fire and forget: an attestation write failing must not fail the payment
      // that triggered it.
      writeAttestation({
        passportId,
        eventType,
        referenceId,
        metadata: { amount: payload.amount },
      }).catch(err => {
        console.error('[TrustCore] attestation write failed:', err);
      });
    }

    return { recorded: true, eventType, invoiceId, passportId };
  }

  private async updateScopedScore(eventType: string, passportId: string): Promise<void> {
    const update = SCORE_DELTAS[eventType];
    // No entry means this event is log-only — `invoice.sent`, every booking
    // lifecycle event, every escrow movement. That is the intended behaviour
    // rather than an omission, and it is what keeps a declined card from
    // costing a client their score.
    if (!update) return;

    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId },
    });
    if (!passport) return;

    const current = passport[update.field] ?? 500;
    const next = Math.max(0, Math.min(1000, current + update.delta));

    await prisma.trustPassport.update({
      where: { id: passportId },
      data: { [update.field]: next },
    });

    if (Math.abs(next - current) >= 20) {
      const client = await prisma.crmClient.findUnique({ where: { passportId } });
      if (client && client.email) {
        emailService.sendTrustScoreChanged(client, update.field, current, next);
      }
    }
  }

  async calculateScore(wallet: string): Promise<number> {
    return 500;
  }

  async getPassport(passportId: string): Promise<unknown> {
    return prisma.trustPassport.findUnique({ where: { id: passportId } });
  }
}

export const trustCore = new TrustCore();
export default trustCore;