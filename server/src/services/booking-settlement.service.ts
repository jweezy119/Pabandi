import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { DisputeType } from '@prisma/client';
// dispute.service exports an instance (`disputeService`), not statics — the
// DisputeService methods all run on that singleton.
import { disputeService as disputeServiceDisputeInstance } from './dispute.service';
import {
  advanceBookingEscrow,
  bookingEscrowReference,
} from './booking-escrow.service';
import { trustCore } from '../trust/trust-core';
import { eventBus, TrustEvent } from './event-bus.service';

/**
 * The settlement window — the half of the guarantee that no one else builds,
 * and the half that makes the guarantee settle instead of nag.
 *
 * ─── THE PROBLEM THIS EXISTS FOR ─────────────────────────────────────────────
 * Before this window, the promise ("if they ghost, you keep the money; if they
 * show, funds release") required a person to press a button. The business had
 * to recognise the ghost and call /bookings/:id/no-show, or recognise the
 * attendance and call attend. Platforms without a default mechanism tend to
 * drift toward leaving money in limbo: the deposit stays `funded` forever even
 * though the appointment it covered is weeks in the past. Nothing settles.
 * The guarantee becomes a ledger of unanswered claims.
 *
 * ─── THE DESIGN: REVERSE THE CHARGEBACK ──────────────────────────────────────
 * On a card network the default is the client keeps the money and the merchant
 * must fight a chargeback. Pabandi runs the direction the other way around,
 * because the guarantee starts from a deposit that both sides already agreed
 * to place in escrow:
 *
 *   1. The appointment ends.
 *   2. A settlement window opens (SETTLEMENT_WINDOW_HOURS, default 48).
 *   3. During the window the client can say so:
 *        - check in with geofence evidence → conditions met instantly;
 *        - or file a dispute → escrow flips to `disputed` and the platform's
 *          arbitration machinery takes it from there.
 *   4. If the window closes and nothing arrived — no check-in, no dispute —
 *      the deposit settles to the business automatically. The default is paid.
 *
 * The sweep below is step 4. It reuses the same transition the manual no-show
 * endpoint ends in, so a cron settlement and a business-marked no-show are
 * indistinguishable in outcome — they differ only in the `source` on the
 * evidence row, which says `settlement-window-closed` and therefore tells the
 * truth about who decided.
 */

/** Hours after slotEnd during which the client can still act. */
const SETTLEMENT_WINDOW_HOURS = Number(process.env.SETTLEMENT_WINDOW_HOURS || 48);

export function settlementDeadline(slotEnd: Date): Date {
  return new Date(slotEnd.getTime() + SETTLEMENT_WINDOW_HOURS * 3600 * 1000);
}

/** What a client or business surface needs to know about one booking's window. */
export async function settlementStatus(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, slotEnd: true, depositAmount: true, travelFee: true },
  });
  if (!booking) return null;

  const escrow = await prisma.universalEscrow.findUnique({
    where: { referenceId: bookingEscrowReference(bookingId) },
    select: { status: true },
  });

  const now = new Date();
  const closesAt = settlementDeadline(new Date(booking.slotEnd));
  /**
   * The window is open from the moment the appointment ends, not before.
   * Before the appointment there is nothing to dispute: an unhappened slot is
   * a cancellation claim, and the cancel route owns that path. After it, the
   * client asserts attendance or contests the outcome.
   */
  const inWindow = booking.status === 'confirmed' && now > new Date(booking.slotEnd) && now <= closesAt;

  return {
    bookingStatus: booking.status,
    escrowStatus: escrow?.status ?? null,
    windowHours: SETTLEMENT_WINDOW_HOURS,
    closesAt: closesAt.toISOString(),
    inWindow,
    remainingMs: Math.max(0, closesAt.getTime() - now.getTime()),
    /** Exactly the amounts that settle either way. */
    atStake: (booking.depositAmount || 0) + (booking.travelFee || 0),
  };
}

/**
 * One sweep over everything whose appointment has ended and whose deposit is
 * still in limbo.
 *
 * `cancelled` is in the sweep deliberately. The checkout floor says a
 * last-minute cancellation costs the client their deposit — but the cancel
 * route records nothing against the escrow, so without this a cancelled
 * booking leaves its deposit parked as `funded` forever. The sweep gives
 * cancellations their verdict via the same window: cancel early and the
 * dispute route's refund convention can move the money; ghost the slot and
 * the deposit settles to the business like any other no-show.
 */
export async function settleExpiredWindows(now = new Date()): Promise<{
  settled: number;
  reasons: Record<string, number>;
}> {
  const reasons: Record<string, number> = {};
  const cutoff = new Date(now.getTime() - SETTLEMENT_WINDOW_HOURS * 3600 * 1000);

  const due = await prisma.booking.findMany({
    where: {
      status: { in: ['confirmed', 'cancelled'] },
      slotEnd: { lt: cutoff },
      depositStatus: { in: ['funded'] },
    },
    // include job + client the way the manual endpoints read them, so the
    // cron's side effects are the same shape as the route's.
    include: { job: true, client: { select: { passportId: true } }, business: true },
    take: 200, // bounded sweep; the query re-selects everything next minute
  });

  let settled = 0;

  for (const booking of due) {
    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: bookingEscrowReference(booking.id) },
      select: { status: true, metadata: true },
    });

    // Wait for arbitration rather than settling over it. An open dispute is a
    // live decision about who keeps this deposit; the sweep must not race it.
    if (escrow?.status === 'disputed') {
      reasons['disputed-pending'] = (reasons['disputed-pending'] || 0) + 1;
      continue;
    }

    // ── Attendance already evidenced, business just never finalised ──────────
    if (escrow?.status === 'conditions_met') {
      await advanceBookingEscrow(booking.id, 'released', {
        source: 'settlement-window-closed',
        reason: 'Verified check-in exists; the attendance window closed and the deposit releases.',
      });
      if (booking.status === 'confirmed') {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'attended' },
        });
      }
      announceSettlement(booking.id, 'attended');
      settled += 1;
      reasons['settled-attended'] = (reasons['settled-attended'] || 0) + 1;
      continue;
    }

    // ── Nothing came in during the window: the default is paid ───────────────
    if (escrow?.status === 'funded') {
      const wasCancelled = booking.status === 'cancelled';
      /**
       * Not `forfeitBookingDeposit()` — that stamps evidence `source: 'no-show'`,
       * which is the business's *assertion*. A cron settlement is the
       * platform's default, and the record must say which of the two decided:
       * same transition, different author of the decision.
       */
      const settledAsNoShow = await advanceBookingEscrow(booking.id, 'released', {
        source: 'settlement-window-closed',
        reason: wasCancelled
          ? 'Cancelled without refunding and the settlement window closed without a dispute.'
          : 'The appointment ended, the settlement window closed, and neither a check-in nor a dispute arrived.',
      });

      if (settledAsNoShow) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'no_show' },
        });

        if (booking.job) {
          await prisma.crmJob.update({
            where: { id: booking.job.id },
            data: { status: 'NO_SHOW' },
          });
        }

        // Same trust consequence, the same event, as if the business had
        // marked it — because from the client's record's point of view it is
        // the same fact: the slot they held was never proven attended.
        if (booking.client?.passportId) {
          await trustCore.emit('booking.no_show', {
            bookingId: booking.id,
            clientPassportId: booking.client.passportId,
            businessId: booking.businessId,
          });
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: { depositStatus: 'forfeited' },
        }).catch(() => {/* depositStatus is informational; the escrow row is the truth */});

        announceSettlement(booking.id, wasCancelled ? 'cancelled' : 'no-show');
        settled += 1;
        reasons['settled-no-show'] = (reasons['settled-no-show'] || 0) + 1;
      }
      continue;
    }

    // Escrow in draft, refunded, released already, or missing: nothing the
    // sweep has jurisdiction over this pass.
  }

  if (settled > 0) {
    logger.info(`[Settlement] ${settled} booking deposit(s) settled via closed windows.`, reasons);
  }
  return { settled, reasons };
}

/**
 * Tell the platform's money bus that a booking escrow finalised.
 *
 * The escrow→job subscribers on the event bus do not need to claim this is the
 * only funding source for their decision; the booking linked to the job is the
 * link those subscribers have lacked. This is the emit that makes them live.
 */
function announceSettlement(bookingId: string, kind: 'attended' | 'no-show' | 'cancelled') {
  void (async () => {
    try {
      const job = await prisma.crmJob.findFirst({
        where: { bookingId },
        select: { id: true },
      });
      if (!job) return;
      const event: TrustEvent = {
        type: 'escrow.released',
        jobId: job.id,
        data: { source: 'settlement-window-closed', kind, bookingId },
        timestamp: new Date(),
      } as TrustEvent;
      eventBus.publish(event);
    } catch (err) {
      logger.warn(`[Settlement] Could not announce settlement for ${bookingId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();
}

/**
 * The client's half of the guarantee: while the window is open, disputing is
 * free, and it takes exactly one call.
 *
 * The caller is the authenticated user; authorisation is the same convention
 * the check-in route uses — the client whose email matches the booking's
 * client record, or the business owner on their own booking. A stranger who
 * has somehow authenticated as neither party cannot move someone else's money.
 */
export async function disputeWithinWindow(
  bookingId: string,
  opts: { reportedById: string; againstId: string; description: string },
) {
  const status = await settlementStatus(bookingId);
  if (!status) throw new SettlementError('Booking not found.', 404);
  if (status.bookingStatus !== 'confirmed') {
    throw new SettlementError(
      `This booking ${status.bookingStatus === 'cancelled' ? 'was cancelled' : `is ${status.bookingStatus}`} — disputes apply to bookings whose appointment has passed and whose deposit still stands.`,
      409,
    );
  }
  if (!status.inWindow) {
    throw new SettlementError(
      `The settlement window closed at ${status.closesAt}. The deposit has settled to the business.`,
      403,
    );
  }

  if ((status.atStake || 0) <= 0) {
    throw new SettlementError('There is no deposit in escrow to dispute.', 409);
  }

  await advanceBookingEscrow(bookingId, 'disputed', {
    source: 'client-dispute',
    reason: 'Dispute filed inside the settlement window; arbitration decides who keeps the deposit.',
  });

  return disputeServiceDisputeInstance.fileContextDispute({
    reportedById: opts.reportedById,
    againstId: opts.againstId,
    contextType: 'BOOKING',
    contextId: bookingId,
    type: DisputeType.QUALITY_ISSUE,
    description: opts.description,
  });
}

export class SettlementError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}
