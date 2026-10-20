import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/utils/database';
import {
  settleExpiredWindows,
  settlementStatus,
  disputeWithinWindow,
  SettlementError,
} from '../src/services/booking-settlement.service';
import {
  ensureBookingEscrow,
  advanceBookingEscrow,
  bookingEscrowReference,
} from '../src/services/booking-escrow.service';
import { disputeService as disputeServiceInstance } from '../src/services/dispute.service';

/**
 * These run against the local database, creating real rows — the sweep's
 * correctness claims are about state transitions across four tables and a
 * window measured off a real clock, none of which a mock observes.
 *
 * The tenant on trial here is the sweep's honesty, not its SQL: a booking
 * whose window closed settles to the business, a booking whose window is
 * open does not, a disputed booking waits for its verdict, and evidence of
 * attendance beats absence of negotiation.
 */

const SUFFIX = `stl-${Date.now().toString(36)}`.slice(0, 20);
const OWNING_USER_EMAIL = `${SUFFIX}-owner@example.com`;

let businessId: string;
let ownerUserId: string;
let serviceBusinessId: string;

interface Harness {
  bookingId: string;
  slotEnd: Date;
}

/** Days back from now, in the past. */
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

beforeAll(async () => {
  await prisma.$connect();

  const owner = await prisma.user.create({
    data: {
      email: OWNING_USER_EMAIL,
      passwordHash: 'test',
      firstName: 'Settle',
      lastName: 'Test',
      role: 'BUSINESS_OWNER',
    },
  });
  ownerUserId = owner.id;

  const business = await prisma.business.create({
    data: {
      ownerId: ownerUserId,
      name: 'Settlement Test Co',
      category: 'OTHER',
      address: '456 Window St',
      currency: 'USD',
    },
  });
  businessId = business.id;

  // CrmClients anchor to a CrmServiceBusiness, not to the Business row. The
  // escrow parties reference the business by its id; the service record is
  // scaffolding for the client and nothing else in these tests reads it.
  serviceBusinessId = (
    await prisma.crmServiceBusiness.create({
      data: { ownerId: ownerUserId, businessId, serviceType: 'CLEANING' },
    })
  ).id;
});

afterAll(async () => {
  // Bookings cascade to nothing by default; delete explicitly to cover the
  // escrow rows, whose reference embeds the booking id.
  const bookings = await prisma.booking.findMany({
    where: { businessId },
    select: { id: true },
  });
  for (const b of bookings) {
    await prisma.universalEscrow.deleteMany({ where: { referenceId: bookingEscrowReference(b.id) } });
    await prisma.dispute.deleteMany({ where: { contextId: b.id, contextType: 'RESERVATION' } });
  }
  await prisma.booking.deleteMany({ where: { businessId } });
  await prisma.businessPaymentMethod.deleteMany({ where: { businessId } });
  await prisma.dispute.deleteMany({ where: { userId: ownerUserId } });
  await prisma.business.deleteMany({ where: { id: businessId } });
  await prisma.crmServiceBusiness.deleteMany({ where: { id: serviceBusinessId } });
  await prisma.user.deleteMany({ where: { email: OWNING_USER_EMAIL } });
  await prisma.$disconnect();
});

/**
 * Build a booking the manual flow would have produced: escrow row exists and
 * is funded, Square has the money.
 */
async function fundedBooking(opts: { slotEnd: Date; status?: string }): Promise<Harness> {
  const client = await prisma.crmClient.create({
    data: {
      serviceBusinessId,
      name: 'Guarantee Client',
      email: `${SUFFIX}-client-${Math.random().toString(36).slice(2, 8)}@example.com`,
    },
  });

  const booking = await prisma.booking.create({
    data: {
      businessId,
      clientId: client.id,
      slotStart: new Date(opts.slotEnd.getTime() - 2 * 3600 * 1000),
      slotEnd: opts.slotEnd,
      serviceType: 'Roof Inspection',
      depositAmount: 250,
      travelFee: 25,
      depositStatus: 'funded',
      status: opts.status ?? 'confirmed',
    },
  });

  await ensureBookingEscrow({
    bookingId: booking.id,
    businessId,
    sellerPartyId: businessId,
    buyerPartyId: client.id,
    amount: 275,
    currency: 'USD',
    slotStart: new Date(opts.slotEnd.getTime() - 2 * 3600 * 1000),
    slotEnd: opts.slotEnd,
  });
  await advanceBookingEscrow(booking.id, 'funded', { source: 'square-webhook', facts: {} });

  return { bookingId: booking.id, slotEnd: opts.slotEnd };
}

/**
 * Get past the square that exists for real bookings: this business has no
 * geofence points. Evidence is inserted by the sweep only — this helper just
 * mirrors the manual attend endpoint, which sets conditions_met directly.
 */
describe('settleExpiredWindows — the sweep', () => {
  beforeEach(async () => {
    const bookings = await prisma.booking.findMany({ where: { businessId }, select: { id: true } });
    for (const b of bookings) {
      await prisma.universalEscrow.deleteMany({ where: { referenceId: bookingEscrowReference(b.id) } });
      await prisma.booking.delete({ where: { id: b.id } });
    }
  });

  it('settles a deposit whose window closed without a check-in or a dispute', async () => {
    const { bookingId } = await fundedBooking({ slotEnd: daysAgo(4) });

    const result = await settleExpiredWindows();
    expect(result.settled).toBeGreaterThanOrEqual(1);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe('no_show');
    expect(booking!.depositStatus).toBe('forfeited');

    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: bookingEscrowReference(bookingId) },
      select: { status: true, metadata: true },
    });
    expect(escrow!.status).toBe('released');
    const evidence = (escrow!.metadata as any).evidence.released;
    // Who decided is part of the record. A cron settlement must read
    // differently from a business's assertion.
    expect(evidence.source).toBe('settlement-window-closed');
  });

  it('leaves a booking whose window is still open entirely alone', async () => {
    const { bookingId } = await fundedBooking({ slotEnd: new Date(Date.now() - 3600 * 1000) });

    const before = await settleExpiredWindows();
    void before;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe('confirmed');

    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: bookingEscrowReference(bookingId) },
      select: { status: true },
    });
    expect(escrow!.status).toBe('funded');
  });

  it('finalises attendance instead of penalising it when evidence already exists', async () => {
    const { bookingId } = await fundedBooking({ slotEnd: daysAgo(3) });
    // The geofence checked the client in; the business never called attend.
    await advanceBookingEscrow(bookingId, 'conditions_met', {
      source: 'checkin-verified',
      facts: { distanceMeters: 12 },
    });

    const result = await settleExpiredWindows();
    expect(result.settled).toBeGreaterThanOrEqual(1);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe('attended');

    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: bookingEscrowReference(bookingId) },
      select: { status: true },
    });
    expect(escrow!.status).toBe('released');
  });

  it('waits for an open dispute rather than racing arbitration', async () => {
    const { bookingId } = await fundedBooking({ slotEnd: daysAgo(5) });
    await advanceBookingEscrow(bookingId, 'disputed', {
      source: 'client-dispute',
      reason: 'Filed inside the window.',
    });
    const reporter = await prisma.user.create({
      data: {
        email: `${SUFFIX}-reporter@example.com`,
        passwordHash: 'test',
        firstName: 'Disputing',
        lastName: 'Client',
        role: 'CUSTOMER',
      },
    });

    await prisma.dispute.create({
      data: {
        contextType: 'RESERVATION',
        contextId: bookingId,
        reportedById: reporter.id,
        userId: ownerUserId,
        type: 'QUALITY_ISSUE',
        outcome: 'PENDING',
        description: 'Test dispute.',
      },
    });

    const result = await settleExpiredWindows();
    expect(result.reasons['disputed-pending']).toBeGreaterThanOrEqual(1);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe('confirmed');

    await prisma.dispute.deleteMany({ where: { contextId: bookingId } });
    await prisma.user.delete({ where: { id: reporter.id } });
  });

  it('does not settle a deposit that was never funded', async () => {
    // required-but-unpaid: no money sits in escrow, nothing to settle.
    const past = daysAgo(3);
    await fundedBooking({ slotEnd: past });
    const unfinished = await prisma.booking.findFirst({
      where: { businessId, slotEnd: past },
      select: { id: true },
    });
    await prisma.booking.update({
      where: { id: unfinished!.id },
      data: { depositStatus: 'required' },
    });

    await settleExpiredWindows();

    const booking = await prisma.booking.findUnique({ where: { id: unfinished!.id } });
    // Still exactly as unpaid as the client left it.
    expect(booking!.depositStatus).toBe('required');
  });
});

describe('settlementStatus — the window facts', () => {
  it('reports the deadline and open-window state for a fresh booking', async () => {
    const { bookingId, slotEnd } = await fundedBooking({
      slotEnd: new Date(Date.now() + 3600 * 1000),
    });

    const status = await settlementStatus(bookingId);
    expect(status!.inWindow).toBe(false); // the appointment has not ended yet
    expect(status!.bookingStatus).toBe('confirmed');
    expect(status!.escrowStatus).toBe('funded');
    expect(status!.atStake).toBe(275);
    expect(new Date(status!.closesAt).getTime()).toBeGreaterThan(slotEnd.getTime());
  });
});

describe('disputeWithinWindow — the client half', () => {  it('files a dispute while the window is open, and puts the escrow on hold', async () => {
    const { bookingId } = await fundedBooking({ slotEnd: daysAgo(1) });

    const dispute = await disputeWithinWindow(bookingId, {
      reportedById: ownerUserId, // stand-in for the client's user in tests
      againstId: ownerUserId,
      description: 'The service was performed; the deposit should release.',
    });

    expect(dispute.outcome).toBe('PENDING');
    expect((dispute as any).contextId).toBe(bookingId);
    expect(dispute.contextType).toBe('BOOKING');

    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: bookingEscrowReference(bookingId) },
      select: { status: true },
    });
    expect(escrow!.status).toBe('disputed');

    await prisma.dispute.deleteMany({ where: { contextId: bookingId } });
  });

  it('refuses a dispute filed after the window closed', async () => {
    const { bookingId } = await fundedBooking({ slotEnd: daysAgo(6) });

    await expect(
      disputeWithinWindow(bookingId, {
        reportedById: ownerUserId,
        againstId: ownerUserId,
        description: 'Too late.',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  /**
   * The verdict moves the escrow. resolveDispute is private — every caller
   * (jury vote, arbitrator) reaches it through the service's own flow — so the
   * test reaches it the same way a juror's vote would, rather than testing a
   * copy of the logic this file would have to keep in sync. The subject under
   * test is the wiring, and the wiring is what would silently rot.
   */
  describe('the verdict wires back into the escrow', () => {
    it('DISMISSED releases the deposit to the business — the default stands', async () => {
      const { bookingId } = await fundedBooking({ slotEnd: daysAgo(1) });
      const dispute = await disputeWithinWindow(bookingId, {
        reportedById: ownerUserId,
        againstId: ownerUserId,
        description: 'Contesting the outcome.',
      });

      await (disputeServiceInstance as any).resolveDispute(dispute, 'DISMISSED');

      const escrow = await prisma.universalEscrow.findUnique({
        where: { referenceId: bookingEscrowReference(bookingId) },
        select: { status: true, metadata: true },
      });
      expect(escrow!.status).toBe('released');
      const evidence = (escrow!.metadata as any).evidence.released;
      expect(evidence.source).toBe('dispute-verdict');

      await prisma.dispute.deleteMany({ where: { contextId: bookingId } });
    });

    it('UPHELD refunds the deposit — the contest succeeded', async () => {
      const { bookingId } = await fundedBooking({ slotEnd: daysAgo(1) });
      const dispute = await disputeWithinWindow(bookingId, {
        reportedById: ownerUserId,
        againstId: ownerUserId,
        description: 'The service was actually done.',
      });

      await (disputeServiceInstance as any).resolveDispute(dispute, 'UPHELD');

      const escrow = await prisma.universalEscrow.findUnique({
        where: { referenceId: bookingEscrowReference(bookingId) },
        select: { status: true },
      });
      expect(escrow!.status).toBe('refunded');
      // The booking stays exactly as it was when contested: a refund is a
      // money outcome, not a claim about who showed up.
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking!.status).toBe('confirmed');

      await prisma.dispute.deleteMany({ where: { contextId: bookingId } });
    });
  });

  it('gracefully refuses when there is no deposit to argue about', async () => {
    const { bookingId } = await fundedBooking({ slotEnd: daysAgo(1) });
    await prisma.booking.update({ where: { id: bookingId }, data: { depositAmount: 0, travelFee: 0 } });

    await expect(
      disputeWithinWindow(bookingId, {
        reportedById: ownerUserId,
        againstId: ownerUserId,
        description: 'Nothing at stake.',
      })
    ).rejects.toBeInstanceOf(SettlementError);
  });
});
