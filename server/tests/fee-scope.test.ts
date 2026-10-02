import { describe, it, expect } from 'vitest';
import * as feeSchedule from '../src/config/fees';
import {
  X402_PRICING,
  AGENT_ECONOMY_RAKE,
  AGENT_MARKETPLACE_FEE,
  OFFRAMP_FEE_RATE,
  PUBLISHED_RAIL_FEES,
  processingCostCents,
  PROCESSOR,
} from '../src/config/fees';
import { RAIL_FEES } from '../src/services/money-flow.service';

/**
 * Fee-constant scope.
 *
 * This exists because of a migration that nearly went wrong. An audit found ~50
 * constants containing a percentage and the plan was to move them all into the
 * fee engine. Classification showed only 7 were platform takes. The other 18 were
 * rewards paid out, staking mechanics, SOL gas, a simulation, and a matching
 * tolerance.
 *
 * Folding those in would have been worse than leaving them: it would make the
 * engine's profitability arithmetic include money we pay away, and make a
 * dashboard that reports "fees" quote a reward rate as revenue.
 *
 * So this file asserts two things. The 7 real takes live here. And the values are
 * byte-identical to what the call sites had inline — a refactor that quietly
 * changed 0.005 to 0.05 would pass every behavioural test and quietly quadruple a
 * price.
 */

describe('the seven real takes live in config/fees', () => {
  it('prices the x402 API surface', () => {
    // Matches whitepaper section 11.5.
    expect(X402_PRICING.TRUST_API_CALL).toBe(0.01);
    expect(X402_PRICING.ESCROW_INITIATION).toBe(0.005);
    expect(X402_PRICING.PREMIUM_PASSPORT).toBe(0.05);
    expect(X402_PRICING.MCP_TOOL_CALL).toBe(0.001);
  });

  it('prices the agent layer', () => {
    expect(AGENT_ECONOMY_RAKE).toBe(0.10);
    expect(AGENT_MARKETPLACE_FEE).toBe(0.02);
  });

  it('prices the offramp', () => {
    expect(OFFRAMP_FEE_RATE).toBe(0.015);
  });

  it('carries the published processor rates for reporting', () => {
    expect(PUBLISHED_RAIL_FEES.square.bps).toBe(290);
    expect(PUBLISHED_RAIL_FEES.paypal.bps).toBe(290);
    expect(PUBLISHED_RAIL_FEES.safepay.bps).toBe(250);
    expect(PUBLISHED_RAIL_FEES.solana.bps).toBe(25);
    expect(PUBLISHED_RAIL_FEES.bank.bps).toBe(0);
  });

  it('exports the same object money-flow reports from', () => {
    // money-flow re-exports rather than redefining. If it ever diverges, a margin
    // question gets a different answer from the schedule that depends on it.
    expect(RAIL_FEES).toBe(PUBLISHED_RAIL_FEES);
  });

  it('agrees with the processor model the merchant fee is floored against', () => {
    // Square is the reference rail. A reporting bps that disagrees with
    // PROCESSOR means the margin we publish is not the margin we keep.
    expect(PUBLISHED_RAIL_FEES.square.bps).toBe(PROCESSOR.percentRate * 10_000);
  });
});

describe('what must NOT be in the fee engine', () => {
  // Each of these is money going the other way, or is not money at all. They are
  // asserted as absent from config/fees rather than merely left alone, because
  // the next migration attempt will be tempted.

  it('does not export a PAB reward rate', () => {
    // PAB_REWARD_RATE = 0.05 appears in pabReserve, microProfitEngine and
    // agentMarketplace. It is paid OUT to agents for showing up. Quoting it as a
    // fee would report a cost as revenue.
    const fees = feeSchedule as unknown as Record<string, unknown>;
    expect(fees.PAB_REWARD_RATE).toBeUndefined();
    expect(fees.CUSTOMER_REWARD_RATE).toBeUndefined();
    expect(fees.BUSINESS_REWARD_RATE).toBeUndefined();
    expect(fees.REFERRAL_REWARD_RATE).toBeUndefined();
    expect(fees.CHECKIN_REWARD_RATE).toBeUndefined();
  });

  it('does not export staking parameters', () => {
    // A slashing rate is not a fee, and stake tiers are token mechanics with
    // their own accounting.
    const fees = feeSchedule as unknown as Record<string, unknown>;
    expect(fees.SLASH_RATES).toBeUndefined();
    expect(fees.STAKE_TIERS).toBeUndefined();
    expect(fees.AUTO_STAKE_RATE).toBeUndefined();
    expect(fees.STAKE_REQUIRED_PAB).toBeUndefined();
  });

  it('does not export SOL gas or buffers', () => {
    // Denominated in SOL rather than USD, and paid to a validator rather than to
    // us. Mixing them into a USD fee engine would be a unit error.
    const fees = feeSchedule as unknown as Record<string, unknown>;
    expect(fees.SOL_FEE_PER_BOOKING).toBeUndefined();
    expect(fees.SOL_BUFFER).toBeUndefined();
    expect(fees.SOL_FEE_RATE).toBeUndefined();
  });

  it('does not export simulation parameters', () => {
    // compounding's 15% and its 5%-hourly growth move no money — they are a
    // projection. profitEngine's rate is what its own simulation charges.
    const fees = feeSchedule as unknown as Record<string, unknown>;
    expect(fees.BASE_FEE_RATE).toBeUndefined();
    expect(fees.GROWTH_RATE_PER_HOUR).toBeUndefined();
    expect(fees.AGENT_PROJECT_FEE_RATE).toBeUndefined();
  });

  it('does not export a reconciliation tolerance', () => {
    // AMOUNT_TOLERANCE = 0.01 is a matching window in dollars, not a price.
    const fees = feeSchedule as unknown as Record<string, unknown>;
    expect(fees.AMOUNT_TOLERANCE).toBeUndefined();
  });
});

describe('rewards are not fees even when they share a number', () => {
  it('keeps 0.05 meaning different things in different files', () => {
    // AGENT_MARKETPLACE_FEE is 0.02 and the agent reward rate is 0.05. They
    // live apart deliberately. If someone ever "consolidates" these because the
    // numbers look related, this is the assertion that catches it.
    expect(AGENT_MARKETPLACE_FEE).not.toBe(0.05);
    expect(AGENT_ECONOMY_RAKE).toBe(0.10);
  });

  it('never subtracts a reward from a fee', () => {
    // The profitability floor is computed from processing cost only. A reward
    // entering that calculation would make every merchant fee look unprofitable
    // by exactly the amount we pay out, which is the opposite of true.
    const cost = processingCostCents(20_000);
    expect(cost).toBe(processingCostCents(20_000));
    expect(cost).toBe(610);
  });
});

describe('agent-layer pricing is a separate schedule from the merchant fee', () => {
  it('does not apply category modulation to API calls', () => {
    // There is no "small job" about a metered API call, so the ticket-size
    // tiering that governs the merchant fee has nothing to act on here. A salon
    // and a freelancer buying Trust API calls pay the same per call.
    expect(X402_PRICING.TRUST_API_CALL).toBe(0.01);
    expect(X402_PRICING.MCP_TOOL_CALL).toBe(0.001);
  });

  it('keeps the two agent rates distinguishable', () => {
    // They price different transactions: a rake on a human-paid rake, versus the
    // fee on an agent escrow. The names were both "PLATFORM_FEE_*" in separate
    // files, which is why the distinction was invisible.
    expect(AGENT_ECONOMY_RAKE).not.toBe(AGENT_MARKETPLACE_FEE);
  });
});
