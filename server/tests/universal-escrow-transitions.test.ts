import { describe, it, expect } from 'vitest';
import {
  UNIVERSAL_ESCROW_TRANSITIONS,
  UNIVERSAL_ESCROW_STATUSES,
  UNIVERSAL_ESCROW_TERMINAL,
  canUniversalTransition,
  isUniversalEscrowStatus,
  isUniversalTerminal,
  explainTransition,
  type UniversalEscrowStatus,
} from '../src/services/universal-escrow.rules';

/**
 * Universal escrow — the transition table, tested away from the database.
 *
 * The defect this guards: `updateStatus` checked only that the TARGET string was
 * one of seven known values, then wrote it. The current state was never read, so
 * all 49 ordered pairs of states were reachable, including `draft -> released`.
 *
 * That last one was a reputation-farming primitive rather than a bookkeeping
 * slip. `updateStatus` emits `escrow.released` on release, and
 * trust-core.service.ts turns that event into `score.changed` — a positive
 * reputation signal. So "create an escrow, PATCH it to released" raised a trust
 * score with no money ever moving, and PATCH /:referenceId/status was callable by
 * any named party on the escrow. A score a counterparty can raise by pressing a
 * button is worth nothing to whoever relies on it.
 *
 * Pure rules, no Prisma, for the same reason booking-escrow.rules.ts is separate:
 * importing the service drags in PrismaClient, and the tempting workaround —
 * re-declaring the table inside the test — asserts nothing.
 */

describe('universal escrow transition table', () => {
  it('refuses to release an escrow that was never funded', () => {
    // The headline defect. draft holds no money, so `released` would record a
    // payout that cannot exist — and emit the trust event that earns reputation
    // for it.
    expect(canUniversalTransition('draft', 'released')).toBe(false);
  });

  it('refuses to release money that was already refunded', () => {
    expect(canUniversalTransition('refunded', 'released')).toBe(false);
  });

  it('treats refunded as terminal', () => {
    expect(isUniversalTerminal('refunded')).toBe(true);
    for (const to of UNIVERSAL_ESCROW_STATUSES) {
      expect(canUniversalTransition('refunded', to)).toBe(false);
    }
  });

  it('allows the normal lifecycle end to end', () => {
    expect(canUniversalTransition('draft', 'funded')).toBe(true);
    expect(canUniversalTransition('funded', 'in_progress')).toBe(true);
    expect(canUniversalTransition('in_progress', 'conditions_met')).toBe(true);
    expect(canUniversalTransition('conditions_met', 'released')).toBe(true);
  });

  it('allows a refund from every state that can still hold money', () => {
    for (const from of ['draft', 'funded', 'in_progress', 'conditions_met', 'disputed'] as UniversalEscrowStatus[]) {
      expect(canUniversalTransition(from, 'refunded')).toBe(true);
    }
  });

  it('lets any live state be disputed', () => {
    // Disputing early is legitimate; a broker should not need the escrow to be
    // past a milestone to raise a problem.
    for (const from of ['draft', 'funded', 'in_progress', 'conditions_met', 'released'] as UniversalEscrowStatus[]) {
      expect(canUniversalTransition(from, 'disputed')).toBe(true);
    }
  });

  it('keeps a release contestable', () => {
    // A release the seller asserted without verified conditions is precisely the
    // decision worth reviewing, so released -> disputed stays legal.
    expect(canUniversalTransition('released', 'disputed')).toBe(true);
  });

  it('does not let a released escrow move to anything except a dispute', () => {
    expect(UNIVERSAL_ESCROW_TRANSITIONS.released).toEqual(['disputed']);
  });

  it('refuses self-transitions, since the service handles those as no-ops', () => {
    // canUniversalTransition stays strict about identity; idempotency is the
    // service's job. Keeping it here means the table describes real state moves
    // only, and the early return in updateStatus is the single place that decides
    // "already there" is fine.
    for (const status of UNIVERSAL_ESCROW_STATUSES) {
      expect(canUniversalTransition(status, status)).toBe(false);
    }
  });

  it('rejects unknown statuses rather than defaulting to permissive', () => {
    expect(canUniversalTransition('draft', 'RELEASED')).toBe(false);
    expect(canUniversalTransition('draft', '')).toBe(false);
    expect(canUniversalTransition('draft', 'paid')).toBe(false);
    // An unknown CURRENT state must not be treated as "anything goes" either.
    expect(canUniversalTransition('settled', 'released')).toBe(false);
  });

  it('recognises exactly the seven states the model documents', () => {
    expect(UNIVERSAL_ESCROW_STATUSES).toHaveLength(7);
    for (const s of UNIVERSAL_ESCROW_STATUSES) {
      expect(isUniversalEscrowStatus(s)).toBe(true);
    }
    expect(isUniversalEscrowStatus('released')).toBe(true);
    expect(isUniversalEscrowStatus('cancelled')).toBe(false);
    expect(isUniversalEscrowStatus(42)).toBe(false);
    expect(isUniversalEscrowStatus(null)).toBe(false);
  });

  it('has a defined target list for every state', () => {
    // A missing key would make canUniversalTransition return false via the `?.`
    // optional chain, which is the safe direction — but it should be a loud
    // test failure, not a silent behaviour change.
    for (const s of UNIVERSAL_ESCROW_STATUSES) {
      expect(Array.isArray(UNIVERSAL_ESCROW_TRANSITIONS[s])).toBe(true);
    }
  });
});

describe('universal escrow transition messages', () => {
  it('names the state and what was allowed, so a caller can act on it', () => {
    const msg = explainTransition('draft', 'released');
    expect(msg).toContain('draft');
    expect(msg).toContain('released');
    expect(msg).toContain('funded');
  });

  it('explains a terminal state as terminal', () => {
    expect(explainTransition('refunded', 'released')).toMatch(/terminal/i);
  });

  it('reports an unknown target as invalid rather than as a refused move', () => {
    expect(explainTransition('draft', 'settled')).toMatch(/invalid status/i);
  });
});