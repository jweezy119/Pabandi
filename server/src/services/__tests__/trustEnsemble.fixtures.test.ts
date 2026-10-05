import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The ensemble, pinned to fixed fixtures.
 *
 * ─── WHAT THIS FILE IS FOR ───────────────────────────────────────────────────
 *
 * `computeEnsembleScore` is the BASELINE. A future learned expert has to beat
 * it on a held-out set before it is allowed to touch a real customer's score,
 * and "beat it" is only a meaningful claim if the baseline is pinned. These
 * fixtures are that pin: every expected number below is written out by hand from
 * the formula in `config/trust-weights.ts`, not captured from a run.
 *
 * That distinction is the whole point. Snapshot tests (`expect(score).toBe(old)`)
 * pass forever, including after someone changes a weight and silently degrades
 * the product. These expectations are hand-derived, so a weight change breaks
 * exactly the fixtures that depend on it, and the failure message says which
 * signal moved.
 *
 * ─── THE FORMULA, AS IMPLEMENTED ─────────────────────────────────────────────
 *
 *   score = w1·punctuality
 *         + w2·paymentBehaviour
 *         + w3·(1 − disputeRate)·100
 *         − w4·normalizedCancellations·100
 *
 * The ×100 on the dispute term: `(1 − disputeRate)` is a 0–1 ratio while every
 * other term is 0–100. Without it the dispute term is worth at most 0.20 points,
 * which is noise, and the fixtures below would all be within a point of each
 * other on that axis.
 */

import {
  CANCELLATION_SATURATION,
  DEFAULT_TRUST_WEIGHTS,
  TrustSignals,
  TrustWeights,
  clampReliabilityScore,
} from '../../config/trust-weights';
import { computeEnsembleScore, normalizeCancellationCount } from '../trust-core.service';

const W = DEFAULT_TRUST_WEIGHTS;

// ─── Fixtures ────────────────────────────────────────────────────────────────

interface Fixture {
  name: string;
  signals: TrustSignals;
  /**
   * Hand-derived. The derivation is written out per fixture so a reader can
   * check the arithmetic without running anything — which is the property that
   * makes this a specification rather than a snapshot.
   */
  expected: number;
  derivation: string;
}

const FIXTURES: Fixture[] = [
  {
    name: 'flawless record',
    // 0.4(100) + 0.3(100) + 0.2(1−0)·100 − 0.1(0)·100 = 40 + 30 + 20 − 0
    expected: 90,
    derivation: '40 + 30 + 20 − 0',
    signals: { punctuality: 100, paymentBehaviour: 100, disputeRate: 0, cancellations: 0 },
  },
  {
    name: 'neutral, no history of note',
    // 0.4(50) + 0.3(50) + 0.2(1)·100 − 0 = 20 + 15 + 20
    expected: 55,
    derivation: '20 + 15 + 20 − 0',
    signals: { punctuality: 50, paymentBehaviour: 50, disputeRate: 0, cancellations: 0 },
  },
  {
    name: 'reliable customer who pays late',
    // 0.4(90) + 0.3(40) + 20 − 0 = 36 + 12 + 20
    expected: 68,
    derivation: '36 + 12 + 20 − 0',
    signals: { punctuality: 90, paymentBehaviour: 40, disputeRate: 0, cancellations: 0 },
  },
  {
    name: 'shows up, does not pay',
    // 0.4(100) + 0.3(10) + 20 − 0 = 40 + 3 + 20
    // The intended shape: punctuality carries more weight than payment, so this
    // lands ABOVE `neutral` despite a 10% payment score. Deliberate — the
    // platform's promise is "they show up", and payment failure is frequently
    // an invoicing bug rather than bad faith.
    expected: 63,
    derivation: '40 + 3 + 20 − 0',
    signals: { punctuality: 100, paymentBehaviour: 10, disputeRate: 0, cancellations: 0 },
  },
  {
    name: 'dispute-free record with a 5% dispute rate',
    // 0.4(95) + 0.3(95) + 0.2(1−0.05)·100 = 38 + 28.5 + 19
    expected: 85.5,
    derivation: '38 + 28.5 + 19 − 0',
    signals: { punctuality: 95, paymentBehaviour: 95, disputeRate: 0.05, cancellations: 0 },
  },
  {
    name: 'every transaction disputed',
    // 0.4(50) + 0.3(50) + 0.2(1−1)·100 = 20 + 15 + 0
    // The dispute term alone removes 20 points, which is the whole weight of
    // the term. If this fixture ever moves to 75, w3 has been silently changed.
    expected: 35,
    derivation: '20 + 15 + 0 − 0',
    signals: { punctuality: 50, paymentBehaviour: 50, disputeRate: 1, cancellations: 0 },
  },
  {
    name: 'one cancellation',
    // normalizeCancellationCount(1) = 1/6 = 0.16667
    // 0.4(100) + 0.3(100) + 20 − 0.1(1/6)·100 = 40 + 30 + 20 − 1.6667
    expected: 88.33333333333333,
    derivation: '40 + 30 + 20 − 1.6667',
    signals: { punctuality: 100, paymentBehaviour: 100, disputeRate: 0, cancellations: 1 },
  },
  {
    name: 'cancellations saturated',
    // normalizeCancellationCount(6) = 1.0 (CANCELLATION_SATURATION)
    // 0.4(50) + 0.3(50) + 20 − 0.1(1)·100 = 20 + 15 + 20 − 10
    expected: 45,
    derivation: '20 + 15 + 20 − 10',
    signals: { punctuality: 50, paymentBehaviour: 50, disputeRate: 0, cancellations: 6 },
  },
  {
    name: 'beyond saturation, cancellations cost no more',
    // Beyond 6 the cancellation term is capped. A customer with 6 cancellations
    // and one with 60 are treated identically. A raw count in a weighted sum is
    // not a signal — the 60th cancellation should not cost 10x the first.
    expected: 45,
    derivation: 'identical to `cancellations saturated` by construction',
    signals: { punctuality: 50, paymentBehaviour: 50, disputeRate: 0, cancellations: 60 },
  },
  {
    name: 'worst case, clamps to the floor',
    // 0 − 0 + 0 − 0.1(1)·100 = −10, clamped to 0
    expected: 0,
    derivation: '−10 clamped to 0',
    signals: { punctuality: 0, paymentBehaviour: 0, disputeRate: 1, cancellations: 6 },
  },
];

describe('computeEnsembleScore: fixed fixtures', () => {
  it.each(FIXTURES)('$name → $expected', ({ signals, expected, derivation, name }) => {
    const actual = computeEnsembleScore(signals);

    // Float tolerance is tight but non-zero: the cancellation term is 1/6, and
    // the expected value above is written to 14 significant figures by hand.
    // An exact-equality assert would fail on representation, not on behaviour.
    expect(actual, `${name}: expected ${expected} via ${derivation}, got ${actual}`).toBeCloseTo(
      expected,
      10,
    );
  });

  it('the fixture set covers every signal independently', () => {
    // If a signal were dropped from the formula, the whole fixture table could
    // still pass if the fixtures never isolated it. These four assert the
    // marginal value of each term directly.
    //
    // Base is all-zero except the dispute term, so every delta is a full
    // weight × 100. A base of 50s would measure only half of each term's range
    // (and, at the top of the scale, the clamp would eat the difference).
    const base: TrustSignals = {
      punctuality: 0,
      paymentBehaviour: 0,
      disputeRate: 0,
      cancellations: 0,
    };
    const baseline = computeEnsembleScore(base);

    const punctualityDelta = computeEnsembleScore({ ...base, punctuality: 100 }) - baseline;
    const paymentDelta = computeEnsembleScore({ ...base, paymentBehaviour: 100 }) - baseline;
    const disputeDelta = computeEnsembleScore({ ...base, disputeRate: 1 }) - baseline;
    const cancellationDelta =
      computeEnsembleScore({ ...base, cancellations: CANCELLATION_SATURATION }) - baseline;

    expect(punctualityDelta).toBeCloseTo(W.w1 * 100, 10); // +40
    expect(paymentDelta).toBeCloseTo(W.w2 * 100, 10); // +30
    expect(disputeDelta).toBeCloseTo(-W.w3 * 100, 10); // −20
    expect(cancellationDelta).toBeCloseTo(-W.w4 * 100, 10); // −10
  });

  it('weight sensitivity: names the fixtures a w1 change moves', () => {
    // The stated purpose of pinning fixtures is that a weight change shows you
    // exactly which fixtures move. Asserted here so that property is itself
    // tested, rather than assumed.
    //
    // Raising w1 by 0.1 adds 0.1 per punctuality point. Every fixture with any
    // punctuality at all therefore moves, including the ones already at 100 —
    // there is no "headroom" for a weight increase to consume, because the
    // ceiling applies to the SUM, not to each term. The one fixture that does
    // not move is the all-zero one, where the punctuality term is zero under
    // either weight.
    const raisedW1: TrustWeights = { ...W, w1: 0.5 };
    const moved = FIXTURES.filter(
      (f) => Math.abs(computeEnsembleScore(f.signals, raisedW1) - f.expected) > 1e-9,
    ).map((f) => f.name);

    expect(moved).toEqual(FIXTURES.filter((f) => f.signals.punctuality > 0).map((f) => f.name));
    expect(moved).not.toContain('worst case, clamps to the floor');
  });
});

describe('normalizeCancellationCount', () => {
  it.each([
    { count: -5, expected: 0, why: 'negative counts are meaningless, not maximal' },
    { count: 0, expected: 0, why: 'no cancellations' },
    { count: NaN, expected: 0, why: 'unknown is not "many"' },
    { count: 3, expected: 0.5, why: 'half of saturation' },
    { count: 6, expected: 1, why: 'exactly saturation' },
    { count: 1000, expected: 1, why: 'saturates, does not keep growing' },
  ])('$count → $expected ($why)', ({ count, expected }) => {
    expect(normalizeCancellationCount(count)).toBeCloseTo(expected, 10);
  });
});

// ─── Signal collection from the database ─────────────────────────────────────

/**
 * `collectClientSignals` reads real rows, so it needs a Prisma double. The
 * fixtures below are shaped like the rows the query actually selects, which is
 * the part worth testing: the derivations (paid on time, excluded job states)
 * are where an off-by-one in a filter would silently change a real score.
 *
 * `vi.hoisted` because `vi.mock` is hoisted above every top-level binding —
 * referencing a plain `const` from a mock factory throws a TDZ error rather than
 * producing a mock.
 */
const prismaMock = vi.hoisted(() => ({
  crmJob: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  invoice: { findMany: vi.fn() },
  dispute: { count: vi.fn() },
  reservation: { findMany: vi.fn() },
  business: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  crmClient: { findUnique: vi.fn(), update: vi.fn() },
  crmEmployee: { findUnique: vi.fn(), update: vi.fn() },
  trustPassport: { findUnique: vi.fn(), update: vi.fn() },
  systemAuditLog: { create: vi.fn(async () => ({})) },
  trustAuditTrail: { findFirst: vi.fn(async () => null), createMany: vi.fn(async () => ({})) },
  invoiceTrustEvent: { create: vi.fn(async () => ({})) },
}));

vi.mock('../../utils/database', () => ({ prisma: prismaMock }));
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../trustAuditWriter', () => ({
  trustAuditWriter: { enqueue: vi.fn(async () => {}), flush: vi.fn(async () => {}) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.crmJob.findMany.mockResolvedValue([]);
  prismaMock.invoice.findMany.mockResolvedValue([]);
  prismaMock.dispute.count.mockResolvedValue(0);
  prismaMock.reservation.findMany.mockResolvedValue([]);
  prismaMock.business.findUnique.mockResolvedValue(null);
});

describe('collectClientSignals: row → signal derivations', () => {
  it('returns null signals for a client with no transactions', async () => {
    const { collectClientSignals } = await import('../trust-core.service');
    const result = await collectClientSignals('client_1');

    // Absence of history is not a score of zero. Returning `null` here is what
    // routes the caller to the cold-start baseline instead of punishing a
    // brand-new client for having no clients.
    expect(result.signals).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  it('excludes SCHEDULED and IN_PROGRESS jobs from punctuality', async () => {
    prismaMock.crmJob.findMany.mockResolvedValue([
      { status: 'COMPLETED' },
      { status: 'COMPLETED' },
      { status: 'SCHEDULED' },
      { status: 'IN_PROGRESS' },
    ]);

    const { collectClientSignals } = await import('../trust-core.service');
    const { signals, sampleSize } = await collectClientSignals('client_1');

    // 2 of 2 RESOLVED jobs completed = 100%. If un-run jobs were counted, this
    // would be 50% and a client mid-contract would look unreliable.
    expect(signals?.punctuality).toBeCloseTo(100, 10);
    expect(sampleSize).toBe(2);
  });

  it('counts a cancelled job against punctuality', async () => {
    prismaMock.crmJob.findMany.mockResolvedValue([
      { status: 'COMPLETED' },
      { status: 'CANCELLED' },
    ]);

    const { collectClientSignals } = await import('../trust-core.service');
    const { signals } = await collectClientSignals('client_1');

    expect(signals?.punctuality).toBeCloseTo(50, 10);
    expect(signals?.cancellations).toBe(1);
  });

  it('measures punctuality against the DUE DATE, not the issue date', async () => {
    const due = new Date('2026-01-10T00:00:00Z');
    prismaMock.invoice.findMany.mockResolvedValue([
      { status: 'paid', dateDue: due, dateIssued: new Date('2026-01-01'), paidAt: new Date('2026-01-05') },
      { status: 'paid', dateDue: due, dateIssued: new Date('2026-01-01'), paidAt: new Date('2026-01-20') },
    ]);

    const { collectClientSignals } = await import('../trust-core.service');
    const { signals } = await collectClientSignals('client_1');

    // 1 of 2 paid by the due date = 50%. Paying early counts, paying late does
    // not, and the comparison is against `dateDue` because that is the term the
    // customer agreed to.
    expect(signals?.paymentBehaviour).toBeCloseTo(50, 10);
  });

  it('does not count an open invoice as a late payment', async () => {
    const due = new Date('2026-01-10T00:00:00Z');
    prismaMock.invoice.findMany.mockResolvedValue([
      { status: 'paid', dateDue: due, dateIssued: new Date(), paidAt: new Date('2026-01-05') },
      // Draft and sent invoices have not settled yet.
      { status: 'draft', dateDue: due, dateIssued: new Date(), paidAt: null },
      { status: 'sent', dateDue: due, dateIssued: new Date(), paidAt: null },
    ]);

    const { collectClientSignals } = await import('../trust-core.service');
    const { signals, sampleSize } = await collectClientSignals('client_1');

    expect(signals?.paymentBehaviour).toBeCloseTo(100, 10);
    expect(sampleSize).toBe(1);
  });

  it('falls back to the cold-start signal when one axis has no data', async () => {
    // Jobs but no invoices: punctuality is measured, payment behaviour is not.
    // Reporting 0% for payment would be a fabricated accusation.
    prismaMock.crmJob.findMany.mockResolvedValue([{ status: 'COMPLETED' }]);

    const { collectClientSignals, COLD_START_SIGNAL_FALLBACK } = await import(
      '../trust-core.service'
    ).then((m) => ({ ...m, COLD_START_SIGNAL_FALLBACK: 50 }));

    const { signals } = await collectClientSignals('client_1');

    expect(signals?.punctuality).toBeCloseTo(100, 10);
    expect(signals?.paymentBehaviour).toBe(COLD_START_SIGNAL_FALLBACK);
  });

  it('expresses dispute rate as disputes over transactions', async () => {
    prismaMock.crmJob.findMany.mockResolvedValue([
      { status: 'COMPLETED' },
      { status: 'COMPLETED' },
      { status: 'COMPLETED' },
      { status: 'COMPLETED' },
    ]);
    prismaMock.dispute.count.mockResolvedValue(1);

    const { collectClientSignals } = await import('../trust-core.service');
    const { signals } = await collectClientSignals('client_1');

    // 1 dispute / 4 resolved jobs = 0.25
    expect(signals?.disputeRate).toBeCloseTo(0.25, 10);
  });
});

describe('explainScore: the customer-facing itemisation', () => {
  it('produces contributions that sum to the score', async () => {
    const { explainScore, computeEnsembleScore } = await import('../trust-core.service');
    const signals: TrustSignals = {
      punctuality: 90,
      paymentBehaviour: 80,
      disputeRate: 0.05,
      cancellations: 2,
    };

    const lines = explainScore(signals);
    const sum = lines.reduce((acc, l) => acc + l.contribution, 0);

    // This is the property that makes the itemisation worth anything: it is the
    // SAME arithmetic as the score, not a post-hoc narrative. If these drift
    // apart, the explanation is decoration.
    expect(sum).toBeCloseTo(computeEnsembleScore(signals), 1);
  });

  it('names every signal and shows its raw value', async () => {
    const { explainScore } = await import('../trust-core.service');
    const lines = explainScore({
      punctuality: 90,
      paymentBehaviour: 80,
      disputeRate: 0.05,
      cancellations: 2,
    });

    expect(lines.map((l) => l.signal)).toEqual([
      'Punctuality',
      'Payment behaviour',
      'Dispute-free record',
      'Cancellations',
    ]);
    expect(lines[0].value).toBe('90 / 100');
    expect(lines[3].value).toBe('2 recorded');
  });

  it('shows cancellations as a negative contribution', async () => {
    const { explainScore } = await import('../trust-core.service');
    const lines = explainScore({
      punctuality: 90,
      paymentBehaviour: 90,
      disputeRate: 0,
      cancellations: 3,
    });

    // A customer reading "cancellations: +5 points" would be confused, and a
    // customer reading a positive number for something they did wrong would be
    // misled.
    expect(lines[3].contribution).toBeLessThan(0);
  });
});

describe('weights are config, not code', () => {
  it('are all documented and sum to a sane total', () => {
    // The positives deliberately sum to 0.9, not 1.0, leaving 0.1 of headroom
    // for the negative term. A perfect record scores 90, not 100: we do not
    // award the top of the scale to somebody we have merely never caught doing
    // anything wrong.
    const positives = W.w1 + W.w2 + W.w3;
    expect(positives).toBeCloseTo(0.9, 10);
    expect(W.w4).toBeCloseTo(0.1, 10);
  });

  it('rank punctuality above payment behaviour above disputes', () => {
    // The ordering is a product claim — "they show up" is the promise the
    // platform is named for — so it is asserted rather than left to the reader
    // of a comment.
    expect(W.w1).toBeGreaterThan(W.w2);
    expect(W.w2).toBeGreaterThan(W.w3);
    expect(W.w3).toBeGreaterThan(W.w4);
  });

  it('keeps every weight positive', () => {
    // A negative weight would invert a signal's meaning, and the clamp would
    // hide it: a subject with terrible punctuality would score higher.
    for (const [name, value] of Object.entries(W)) {
      expect(value, `weight ${name} must be >= 0`).toBeGreaterThanOrEqual(0);
    }
  });
});