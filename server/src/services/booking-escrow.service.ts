/**
 * Booking → escrow lifecycle.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Pabandi holds no money for a booking. The deposit is collected by the
 * merchant's own Square account (resolveSquareCredentials prefers the merchant
 * token), so the cash has already reached the business by the time the webhook
 * fires. A `released` status here records that a decision was made and why —
 * it does not move funds, and this file never claims otherwise.
 *
 * That is what the record is for. Today the same information is spread across
 * `Booking.depositStatus`, `Booking.status`, and a check-in row on `CrmJob`,
 * with no way to answer "why did this customer keep their deposit" without
 * reading three tables and inferring intent. One row with an explicit reason and
 * the evidence that justified it is the whole point.
 *
 * THE LIFECYCLE
 * -------------
 *   draft            booking created, deposit quoted but not yet paid
 *   funded           the webhook confirmed the deposit landed
 *   conditions_met   the job happened and was checked into (or completed)
 *   released         the business earned it
 *   refunded         cancelled under policy, or disputed in the client's favour
 *   disputed         a party has contested the outcome, pending review
 *
 * `released` and `refunded` are terminal. Every transition is idempotent, and a
 * second attempt at a terminal state is refused rather than silently re-applied —
 * replaying a webhook must not flip a refund back into a payout.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

import {
  bookingEscrowReference,
  canTransition,
  type EscrowStatus,
} from './booking-escrow.rules';

export { bookingEscrowReference };

export interface EscrowEvidence {
  /** Where the decision came from, e.g. 'square-webhook' or 'checkin'. */
  source: string;
  /** Free text shown in a dispute review. Keep it factual. */
  reason?: string;
  /** Structured facts backing the decision — geofence distance, override, etc. */
  facts?: Record<string, unknown>;
}

/**
 * Create or return the escrow for a booking.
 *
 * Idempotent on referenceId. `universalEscrowService.create` already returns an
 * existing row when the reference is taken, and this adds the booking-specific
 * template and conditions on first write only — a re-run must not overwrite the
 * conditions of an escrow that is already in flight.
 */
export async function ensureBookingEscrow(params: {
  bookingId: string;
  businessId: string;
  sellerPartyId: string;
  buyerPartyId: string | null;
  amount: number;
  currency: string;
  slotStart: Date;
  slotEnd: Date;
}): Promise<void> {
  const referenceId = bookingEscrowReference(params.bookingId);

  const existing = await prisma.universalEscrow.findUnique({
    where: { referenceId },
    select: { id: true },
  });
  if (existing) return;

  const parties = [
    { partyId: params.sellerPartyId, role: 'seller' as const },
    ...(params.buyerPartyId ? [{ partyId: params.buyerPartyId, role: 'buyer' as const }] : []),
  ];

  await prisma.universalEscrow.create({
    data: {
      referenceId,
      template: 'booking',
      parties: parties as any,
      amount: params.amount,
      currency: params.currency,
      conditions: [
        {
          // The release condition for a booking is that the job happened and was
          // geographically verified. `manual` is the fallback for services with
          // no fixed location (mobile repair, remote work), where there is no
          // geofence to check against.
          type: params.slotStart ? 'checkin' : 'manual',
          verify: { bookingId: params.bookingId },
        },
      ] as any,
      status: 'draft',
      deadline: params.slotEnd,
      metadata: {
        bookingId: params.bookingId,
        businessId: params.businessId,
        // Recorded so a reviewer reading the escrow can tell a held deposit
        // from one that was never collected.
        depositKind: 'merchant_collected',
        note: 'Deposit is collected into the business\'s own payment account. This record tracks commitment and evidence, it does not hold funds.',
      } as any,
    },
  });

  logger.info(`[BookingEscrow] Created escrow for booking ${params.bookingId} ($${params.amount}).`);
}

async function currentStatus(referenceId: string): Promise<EscrowStatus | null> {
  const row = await prisma.universalEscrow.findUnique({
    where: { referenceId },
    select: { status: true },
  });
  return (row?.status as EscrowStatus) ?? null;
}

/**
 * Apply a transition, or explain why it was refused.
 *
 * Returns false rather than throwing when the transition is invalid or the row
 * is absent. Callers sit on webhook and request paths where an exception means
 * a retry storm, and "already released" is a success for our purposes — the
 * desired end state is already true.
 */
export async function advanceBookingEscrow(
  bookingId: string,
  to: EscrowStatus,
  evidence: EscrowEvidence,
): Promise<boolean> {
  const referenceId = bookingEscrowReference(bookingId);
  const from = await currentStatus(referenceId);

  if (!from) {
    logger.warn(`[BookingEscrow] No escrow for booking ${bookingId}; skipping ${to}.`);
    return false;
  }

  if (from === to) return false;

  if (!canTransition(from, to)) {
    logger.warn(
      `[BookingEscrow] Refused ${from} → ${to} for booking ${bookingId} (source: ${evidence.source}). Not a permitted transition.`,
    );
    return false;
  }

  const existing = await prisma.universalEscrow.findUnique({
    where: { referenceId },
    select: { metadata: true },
  });
  const meta = (existing?.metadata as Record<string, unknown>) ?? {};

  await prisma.universalEscrow.update({
    where: { referenceId },
    data: {
      status: to,
      metadata: {
        ...meta,
        evidence: {
          ...((meta.evidence as object) ?? {}),
          [to]: { at: new Date().toISOString(), ...evidence },
        },
      } as any,
    },
  });

  logger.info(`[BookingEscrow] ${bookingId}: ${from} → ${to} (${evidence.source}).`);
  return true;
}

/**
 * Release the deposit because the job happened.
 *
 * Requires a verified check-in. An *unverified* check-in is one the worker
 * overrode with a free-text reason, and that is the case where the worker is
 * deciding whether the customer keeps their deposit — so it is recorded as a
 * dispute for review rather than a release.
 *
 * This is the part that makes the check-in geofence load-bearing, and the
 * reason the check-in ownership hole matters: if anyone can check in to anyone's
 * job, this function is deciding on unauthenticated evidence.
 */
export async function releaseOnAttendance(params: {
  bookingId: string;
  locationVerified: boolean;
  distanceMeters?: number | null;
  overrideReason?: string | null;
}): Promise<boolean> {
  if (!params.locationVerified) {
    return advanceBookingEscrow(params.bookingId, 'disputed', {
      source: 'checkin-unverified',
      reason: 'Check-in was outside the geofence and was overridden; needs review.',
      facts: {
        distanceMeters: params.distanceMeters ?? null,
        overrideReason: params.overrideReason ?? null,
      },
    });
  }

  return advanceBookingEscrow(params.bookingId, 'conditions_met', {
    source: 'checkin-verified',
    facts: { distanceMeters: params.distanceMeters ?? null },
  });
}

/** The client's deposit came back to them — cancellation under policy. */
export async function refundBookingDeposit(
  bookingId: string,
  reason: string,
): Promise<boolean> {
  return advanceBookingEscrow(bookingId, 'refunded', { source: 'cancellation', reason });
}

/** The client did not turn up; the business keeps it. */
export async function forfeitBookingDeposit(
  bookingId: string,
  reason: string,
): Promise<boolean> {
  return advanceBookingEscrow(bookingId, 'released', { source: 'no-show', reason });
}

/** Read the escrow alongside a booking, or null when there isn't one. */
export async function getBookingEscrow(bookingId: string) {
  return prisma.universalEscrow.findUnique({
    where: { referenceId: bookingEscrowReference(bookingId) },
  });
}