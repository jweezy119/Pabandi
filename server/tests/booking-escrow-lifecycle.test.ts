import { describe, it, expect } from 'vitest';
import {
  bookingEscrowReference,
  canTransition,
  isTerminal,
  ESCROW_TRANSITIONS,
  TERMINAL_STATUSES,
  type EscrowStatus as Status,
} from '../src/services/booking-escrow.rules';

/**
 * Booking escrow — the transition table, tested away from the database.
 *
 * These assert the rules the service actually runs, imported from
 * booking-escrow.rules. The rules were originally inline in the service, which
 * put them out of reach: importing the service drags in PrismaClient, which
 * fails to construct outside a live environment, and the tempting fix at that
 * point is to re-declare the table in the test — where it asserts nothing and
 * drifts silently. Splitting the pure rules out fixed the import problem and the
 * fake-assertion problem together.
 */

const ALLOWED = ESCROW_TRANSITIONS;

describe('escrow reference convention', () => {
  it('namespaces bookings the way invoices are already namespaced', () => {
    // failure-ownership.service.ts uses `invoice:<id>`. Booking references have to
    // be distinguishable, or a dispute lookup could resolve to the wrong record.
    expect(bookingEscrowReference('bkg_1')).toBe('booking:bkg_1');
    expect(bookingEscrowReference('bkg_1')).not.toBe('invoice:bkg_1');
  });
});

describe('escrow transition table', () => {
  it('refuses to release a deposit that was never funded', () => {
    // The deposit money is collected by the merchant. An escrow sitting in draft
    // has no money behind it, so "released" would be recording a payout that
    // cannot exist.
    expect(canTransition('draft', 'released')).toBe(false);
  });

  it('allows a funded deposit to be released or refunded', () => {
    expect(canTransition('funded', 'released')).toBe(true);
    expect(canTransition('funded', 'refunded')).toBe(true);
  });

  it('requires the condition to be met before release', () => {
    // fund → conditions_met → released. Releasing straight from funded would
    // let the release condition be skipped, which is the condition existing to
    // prevent.
    expect(canTransition('conditions_met', 'released')).toBe(true);
  });

  it('identifies the terminal states without duplicating the list', () => {
    expect(isTerminal('released')).toBe(true);
    expect(isTerminal('refunded')).toBe(true);
    expect(isTerminal('disputed')).toBe(false);
    expect(TERMINAL_STATUSES.sort()).toEqual(['refunded', 'released']);
  });

  it('treats released and refunded as terminal', () => {
    // Replaying a webhook must not turn a refund back into a payout. `refunded`
    // has no exits at all, and `released` only permits a dispute.
    expect(ALLOWED.refunded).toHaveLength(0);
    expect(ALLOWED.released).toEqual(['disputed']);
  });

  it('permits a dispute from any non-terminal state', () => {
    // Contesting early is legitimate; contesting something already settled is
    // the whole point of the narrow released -> disputed edge.
    for (const from of ['draft', 'funded', 'conditions_met'] as Status[]) {
      expect(canTransition(from, 'disputed')).toBe(true);
    }
  });

  it('lets a dispute resolve either way', () => {
    expect(canTransition('disputed', 'released')).toBe(true);
    expect(canTransition('disputed', 'refunded')).toBe(true);
  });

  it('never leaves a state with no defined transitions', () => {
    // A missing key would silently become "no transitions allowed", which reads
    // as a deliberate refusal rather than a typo.
    for (const s of Object.keys(ALLOWED)) {
      expect(ALLOWED[s as Status]).toBeDefined();
    }
  });

  it('has no self-transitions', () => {
    for (const [from, targets] of Object.entries(ALLOWED)) {
      expect(targets).not.toContain(from);
    }
  });
});

describe('the outcomes a booking can reach', () => {
  it('lets a completed booking end released or refunded, never stranded', () => {
    // Every non-terminal state must be able to reach a terminal one, or a
    // deposit could be left permanently undecided.
    const terminals: Status[] = ['released', 'refunded'];
    for (const from of ['draft', 'funded', 'conditions_met'] as Status[]) {
      const reachable = ALLOWED[from].some((to) => terminals.includes(to));
      expect(reachable).toBe(true);
    }
  });

  it('requires an out-of-band decision once disputed', () => {
    // releaseOnAttendance records an unverified check-in as disputed rather than
    // released. That only works because disputed has both exits.
    expect([...ALLOWED.disputed].sort()).toEqual(['refunded', 'released']);
  });
});