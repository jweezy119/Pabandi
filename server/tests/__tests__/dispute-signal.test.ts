import { describe, it, expect, vi } from 'vitest';

import {
  computeEnsembleScore,
  explainScore,
} from '../../src/services/trust-core.service';
import { DEFAULT_TRUST_WEIGHTS } from '../../src/config/trust-weights';

/**
 * A platform statistic in everyone's personal trust score.
 *
 * `collectClientSignals` counted upheld disputes with
 *
 *   prisma.dispute.count({ where: { reservationId: { not: null }, outcome: 'UPHELD' } })
 *
 * — no client predicate at all — and then divided that by *this one client's*
 * transaction count. So `disputeRate` measured how busy the platform had been, and
 * every client on a busy platform was penalised for other people's disputes. It could
 * exceed 1, and it was clamped, which flattened it to "zero dispute-free record" for
 * everyone at once.
 *
 * It also could not be fixed by adding a filter. A `Dispute` attaches to a `userId`, a
 * `reservationId` or an `apiClientId`, and `CrmClient` has none of those columns, so
 * there is no join to scope with. Until the model grows one, the signal is genuinely
 * unavailable for a CRM client — and the fix is to say so rather than substitute a
 * number that looks like a measurement.
 *
 * Unmeasurable is scored at the neutral midpoint, not 0 and not 1. Zero would award
 * full marks for a clean record nobody checked; the old platform count punishes an
 * individual for strangers. Neutral does neither.
 */

const base = {
  punctuality: 80,
  paymentBehaviour: 80,
  cancellations: 0,
  disputeRate: 0,
};

describe('the dispute signal when it cannot be measured', () => {
  it('neither rewards nor punishes', () => {
    const neutral = computeEnsembleScore({ ...base, disputeMeasurable: false });
    const halfMarks = computeEnsembleScore({ ...base, disputeRate: 0.5 });

    expect(neutral).toBe(halfMarks);
  });

  it('is not the same as a perfect record', () => {
    const neutral = computeEnsembleScore({ ...base, disputeMeasurable: false });
    const perfect = computeEnsembleScore({ ...base, disputeRate: 0 });

    // If these were equal, "we did not check" would be indistinguishable from
    // "they have never disputed anything" — and would score identically to it.
    expect(neutral).toBeLessThan(perfect);
  });

  it('is not the same as a bad record either', () => {
    const neutral = computeEnsembleScore({ ...base, disputeMeasurable: false });
    const bad = computeEnsembleScore({ ...base, disputeRate: 1 });

    expect(neutral).toBeGreaterThan(bad);
  });

  it('does not move a score when the platform gets busier', () => {
    // The old failure direction: a global dispute count divided by one client's
    // transactions meant everyone dropped together as the platform grew.
    const quiet = computeEnsembleScore({ ...base, disputeMeasurable: false });
    const busy = computeEnsembleScore({ ...base, disputeMeasurable: false, disputeRate: 0.93 });
    expect(quiet).toBe(busy);
  });

  it('still scores a real dispute rate when one is supplied', () => {
    const measured = computeEnsembleScore({ ...base, disputeRate: 0, disputeMeasurable: true });
    expect(measured).toBe(computeEnsembleScore({ ...base, disputeRate: 0 }));
  });

  it('says "not tracked" rather than claiming a clean record', () => {
    const rows = explainScore({ ...base, disputeMeasurable: false });
    const disputeRow = rows.find((r) => r.signal === 'Dispute-free record');

    expect(disputeRow?.value).toMatch(/not tracked/i);
    // The word "clean" or "100" here would be a claim nobody measured.
    expect(disputeRow?.value).not.toMatch(/100 \/ 100/);
  });

  it('shows a real number when the signal is real', () => {
    const rows = explainScore({ ...base, disputeRate: 0.1, disputeMeasurable: true });
    const disputeRow = rows.find((r) => r.signal === 'Dispute-free record');
    expect(disputeRow?.value).toMatch(/10%/);
  });
});

describe('the score itself', () => {
  it('stays inside the 0-100 scale', () => {
    const weights = DEFAULT_TRUST_WEIGHTS;
    expect(computeEnsembleScore({ ...base, punctuality: 100, paymentBehaviour: 100 })).toBeLessThanOrEqual(100);
    expect(weights.w1 + weights.w2 + weights.w3 + weights.w4).toBeCloseTo(1, 5);
  });
});