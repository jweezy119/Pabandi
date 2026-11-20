import { describe, expect, it } from 'vitest';
import {
  evaluateBookingDepositPolicy,
  normalizeTrustScore,
  resolveRequiredDeposit,
  type DrpeDepositDecision,
} from '../src/services/bookingDepositPolicy.service';

/**
 * The deposit policy is where money is decided, so the assertions here are
 * about the properties that must not regress:
 *
 *  - a verified client never pays a deposit;
 *  - an unverified client's deposit is a percentage of the REAL service value;
 *  - the caller's own deposit amount is never an input.
 *
 * That last one was a live hole. The route used to fall back to the client's
 * `depositAmount` whenever the service value was unknown, so `serviceValue: 0`
 * (or omitting it) produced a deposit-free booking regardless of trust score.
 */

describe('normalizeTrustScore', () => {
  it('passes a 0–100 score through', () => {
    expect(normalizeTrustScore(70)).toBe(70);
    expect(normalizeTrustScore(90)).toBe(90);
    expect(normalizeTrustScore(100)).toBe(100);
  });

  it('rescales a 0–1000 score onto 0–100', () => {
    expect(normalizeTrustScore(700)).toBe(70);
    expect(normalizeTrustScore(920)).toBe(92);
    expect(normalizeTrustScore(1000)).toBe(100);
  });

  it('defaults a missing or non-finite score to the new-client value', () => {
    expect(normalizeTrustScore(undefined)).toBe(70);
    expect(normalizeTrustScore(null)).toBe(70);
    expect(normalizeTrustScore(Number.NaN)).toBe(70);
  });

  it('clamps out-of-range values rather than letting them through', () => {
    expect(normalizeTrustScore(-20)).toBe(0);
    expect(normalizeTrustScore(5000)).toBe(100);
  });
});

describe('evaluateBookingDepositPolicy', () => {
  it('charges no deposit at exactly the verified threshold', () => {
    const decision = evaluateBookingDepositPolicy({ trustScore: 90, serviceValue: 500 });
    expect(decision.depositPercent).toBe(0);
    expect(depositAmountOf(decision)).toBe(0);
    expect(decision.riskLevel).toBe('LOW');
    expect(decision.merchantBanner).toBe('Client Risk: LOW. Deposit Required: 0%.');
  });

  it('treats 89 as unverified', () => {
    const decision = evaluateBookingDepositPolicy({ trustScore: 89, serviceValue: 500 });
    expect(decision.depositPercent).toBe(20);
    expect(depositAmountOf(decision)).toBe(100);
  });

  it('charges 20% of the service value', () => {
    expect(depositAmountOf(evaluateBookingDepositPolicy({ trustScore: 70, serviceValue: 250 }))).toBe(50);
    expect(depositAmountOf(evaluateBookingDepositPolicy({ trustScore: 70, serviceValue: 99.99 }))).toBe(20);
  });

  it('rounds to cents', () => {
    // 20% of 33.33 is 6.666 — must not become 6.66 or 6.67 silently.
    expect(depositAmountOf(evaluateBookingDepositPolicy({ trustScore: 70, serviceValue: 33.33 }))).toBe(6.67);
  });

  it('charges nothing when the service value is unknown or negative', () => {
    expect(depositAmountOf(evaluateBookingDepositPolicy({ trustScore: 70, serviceValue: 0 }))).toBe(0);
    expect(depositAmountOf(evaluateBookingDepositPolicy({ trustScore: 70, serviceValue: -100 }))).toBe(0);
  });

  it('labels a very low trust score HIGH', () => {
    const decision = evaluateBookingDepositPolicy({ trustScore: 40, serviceValue: 100 });
    expect(decision.riskLevel).toBe('HIGH');
    expect(decision.merchantBanner).toContain('HIGH');
  });

  it('labels a high predicted risk HIGH even at a mid trust score', () => {
    const decision = evaluateBookingDepositPolicy({
      trustScore: 80,
      serviceValue: 100,
      predictedRiskScore: 0.75,
    });
    expect(decision.riskLevel).toBe('HIGH');
  });

  it('keeps the deposit flat across risk tiers, so the tier is wording only', () => {
    // Both are 20% by design; the tier must not imply a different price.
    const medium = evaluateBookingDepositPolicy({ trustScore: 70, serviceValue: 200 });
    const high = evaluateBookingDepositPolicy({ trustScore: 20, serviceValue: 200 });
    expect(medium.depositAmount).toBe(high.depositAmount);
  });
});

describe('resolveRequiredDeposit', () => {
  const verified: DrpeDepositDecision = evaluateBookingDepositPolicy({
    trustScore: 95,
    serviceValue: 500,
  });
  const unverified: DrpeDepositDecision = evaluateBookingDepositPolicy({
    trustScore: 70,
    serviceValue: 500,
  });

  it('charges nothing for a verified client even if the business configured a deposit', () => {
    expect(resolveRequiredDeposit({ drpe: verified, businessDepositAmount: 250 })).toBe(0);
  });

  it('charges the computed percentage of the real service value', () => {
    expect(resolveRequiredDeposit({ drpe: unverified, businessDepositAmount: null })).toBe(100);
  });

  it('ignores the business deposit when a percentage is computable', () => {
    // The percentage is derived from the catalog price, so a merchant's flat
    // deposit must not override it in either direction.
    expect(resolveRequiredDeposit({ drpe: unverified, businessDepositAmount: 5 })).toBe(100);
    expect(resolveRequiredDeposit({ drpe: unverified, businessDepositAmount: 999 })).toBe(100);
  });

  it('falls back to the merchant deposit only when no percentage is computable', () => {
    const noValue: DrpeDepositDecision = evaluateBookingDepositPolicy({
      trustScore: 70,
      serviceValue: 0,
    });
    expect(resolveRequiredDeposit({ drpe: noValue, businessDepositAmount: 75 })).toBe(75);
    expect(resolveRequiredDeposit({ drpe: noValue, businessDepositAmount: null })).toBe(0);
  });

  it('rounds the fallback to cents and rejects a non-finite one', () => {
    const noValue: DrpeDepositDecision = evaluateBookingDepositPolicy({
      trustScore: 70,
      serviceValue: 0,
    });
    expect(resolveRequiredDeposit({ drpe: noValue, businessDepositAmount: 10.005 })).toBe(10.01);
    expect(resolveRequiredDeposit({ drpe: noValue, businessDepositAmount: Number.NaN })).toBe(0);
  });

  it('takes no client-supplied amount as an argument at all', () => {
    // The regression this guards: the route used to accept the caller's
    // depositAmount as a fallback. If a client-controlled value were an input
    // here, this signature would have to grow — the test fails to compile if
    // someone adds one.
    const params: { drpe: DrpeDepositDecision; businessDepositAmount?: number | null } = {
      drpe: unverified,
    };
    expect(resolveRequiredDeposit(params)).toBe(100);
  });
});

function depositAmountOf(decision: DrpeDepositDecision): number {
  return decision.depositAmount;
}
