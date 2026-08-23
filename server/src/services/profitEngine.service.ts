/**
 * profitEngine.service.ts — Pabandi's agentic profit-maximization layer.
 *
 * Goal (user mandate): MAXIMIZE PLATFORM PROFIT, agentically, and REINVEST collected
 * fees to fund future bookings so the system is self-sustaining (a compounding loop).
 *
 * Three mechanisms, all DETERMINISTIC (auditable, no LLM moving real money):
 *
 *  1) VALUE-PROGRESSIVE FEE TIERS — higher-value bookings pay a higher rate.
 *     This captures more surplus from large bookings without a flat 2% that
 *     under-prices them. Tiers are config (PROFIT_TIERS).
 *
 *  2) AGENTIC POLICY — a deterministic optimizer that, each cycle, picks the fee
 *     tier + reinvestment ratio toward a target (e.g. 30% net retained, 70% reinvested
 *     to grow throughput). It reacts to utilization: if agent PAB pools are low it
 *     shifts more collected fees into re-funding agents (protecting throughput); if
 *     pools are healthy it retains more profit. Transparent + bounded.
 *
 *  3) SELF-FUNDING REINVESTMENT LOOP — collected PAB/SOL fees flow back into
 *     (a) agent PAB balances (so they can keep booking) and (b) the treasury gas
 *     buffer (so the gas-neutral rail keeps running). Net effect: platform profit
 *     compounds instead of the treasury being a one-way faucet.
 *
 * Safety: every number is bounded by config; the policy can NEVER set a fee below
 * MIN_FEE_RATE or above MAX_FEE_RATE. Reinvestment never spends the treasury below
 * a hard SOL floor (TREASURY_SOL_FLOOR) so the rail can't stall.
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ── Config (env-overridable, sensible defaults) ───────────────────────────────
const TIERS = JSON.parse(process.env.PROFIT_TIERS || JSON.stringify([
  { minPab: 0, rate: 0.02 },     // <100 PAB  → 2%
  { minPab: 100, rate: 0.035 },  // 100–1000  → 3.5%
  { minPab: 1000, rate: 0.05 },  // 1000–10000→ 5%
  { minPab: 10000, rate: 0.07 }, // >10000    → 7%  (whale bookings carry more platform value)
]));
const MIN_FEE_RATE = 0.01;       // policy floor
const MAX_FEE_RATE = 0.10;       // policy ceiling (never gouge)
const MIN_FEE_PAB = 1;           // absolute floor per booking
const REINVEST_TARGET = parseFloat(process.env.PROFIT_REINVEST || '0.70'); // 70% reinvest default
const RETAIN_TARGET = 1 - REINVEST_TARGET;
const TREASURY_SOL_FLOOR = parseFloat(process.env.TREASURY_SOL_FLOOR || '0.01'); // keep 0.01 SOL min

export interface FeeQuote { rate: number; feePab: number; tier: string; }

/** Pick the value-progressive tier for a booking of `amountPab`. */
export function quoteFee(amountPab: number): FeeQuote {
  let chosen = TIERS[0];
  for (const t of TIERS) if (amountPab >= t.minPab) chosen = t;
  const rate = Math.min(MAX_FEE_RATE, Math.max(MIN_FEE_RATE, chosen.rate));
  const feePab = Math.max(MIN_FEE_PAB, Math.round(amountPab * rate));
  return { rate, feePab, tier: `${chosen.minPab}+ PAB @ ${(rate * 100).toFixed(1)}%` };
}

/**
 * AGENTIC POLICY — given current system state, decide how to split this cycle's
 * collected fees between REINVEST (fund agents + gas) and RETAIN (platform profit).
 *
 * Logic (deterministic, self-optimizing toward sustained profit):
 *  - If agent PAB pools are thin (< UTIL_LOW), push reinvestment UP (protect throughput
 *    so future cycles still earn). Throughput is the profit engine; starving it kills
 *    future revenue.
 *  - If pools are healthy (>= UTIL_OK), pull reinvestment DOWN toward RETAIN_TARGET so
 *    profit accrues to the treasury.
 *  - Never let reinvestment spend the treasury below TREASURY_SOL_FLOOR.
 */
export function decideReinvestment(opts: {
  collectedPab: number;
  collectedSol: number;
  agentPabPoolAvg: number;   // avg PAB balance across active agents
  treasurySol: number;
  avgBookingPab: number;
}): { reinvestPab: number; retainPab: number; reinvestSol: number; retainSol: number; reinvestRatio: number; reason: string } {
  const { collectedPab, collectedSol, agentPabPoolAvg, treasurySol, avgBookingPab } = opts;
  const UTIL_LOW = Math.max(2, avgBookingPab * 1.5);   // below this avg → thin
  const UTIL_OK = avgBookingPab * 4;                    // healthy buffer

  let ratio = REINVEST_TARGET;
  let reason = `healthy pools → reinvest ${Math.round(ratio * 100)}%`;
  if (agentPabPoolAvg < UTIL_LOW) {
    ratio = Math.min(0.95, REINVEST_TARGET + 0.20); // protect throughput
    reason = `thin agent pools (avg ${agentPabPoolAvg.toFixed(0)} PAB) → boost reinvest to ${Math.round(ratio * 100)}%`;
  } else if (agentPabPoolAvg >= UTIL_OK) {
    ratio = Math.max(0.40, RETAIN_TARGET * 0.5 + RETAIN_TARGET); // lean to profit
    ratio = Math.min(ratio, 0.60);
    reason = `healthy pools (avg ${agentPabPoolAvg.toFixed(0)} PAB) → retain more, reinvest ${Math.round(ratio * 100)}%`;
  }

  // Hard floor: never drain treasury below floor
  let reinvestSol = collectedSol * ratio;
  if (treasurySol - reinvestSol < TREASURY_SOL_FLOOR) {
    reinvestSol = Math.max(0, treasurySol - TREASURY_SOL_FLOOR);
    ratio = collectedSol > 0 ? reinvestSol / collectedSol : 0;
    reason += ' | SOL floor hit → capped reinvest';
  }

  const reinvestPab = Math.floor(collectedPab * ratio);
  return {
    reinvestPab,
    retainPab: collectedPab - reinvestPab,
    reinvestSol,
    retainSol: collectedSol - reinvestSol,
    reinvestRatio: ratio,
    reason,
  };
}

/**
 * SELF-FUNDING LOOP — apply one cycle's collected fees:
 *  - reinvestPab → top up the N thinnest agents so they can keep booking (throughput)
 *  - reinvestSol → add to treasury gas buffer (rail stays live)
 *  - retainPab/retainSol → stay in treasury as platform profit (compounds via buybacks)
 * Returns an accounting record (no on-chain action here; the caller executes the
 * actual transfers via web3Agent.service so keys stay in one place).
 */
export async function applyReinvestmentCycle(summary: {
  collectedPab: number;
  collectedSol: number;
  reinvestPab: number;
  reinvestSol: number;
  cycle: number;
}): Promise<{ fundedAgents: number; pabToAgents: number; solToBuffer: number }> {
  const { collectedPab, collectedSol, reinvestPab, reinvestSol } = summary;
  // Distribute reinvestPab across the thinnest active agents (keep throughput alive)
  const thin = await prisma.web3Agent.findMany({
    where: { isActive: true },
    orderBy: { balancePab: 'asc' },
    take: 20,
  });
  let pabToAgents = 0;
  const perAgent = thin.length ? Math.floor(reinvestPab / thin.length) : 0;
  for (const a of thin) {
    if (perAgent <= 0) break;
    try {
      await prisma.web3Agent.update({ where: { id: a.id }, data: { balancePab: { increment: perAgent } } });
      pabToAgents += perAgent;
    } catch { /* skip */ }
  }
  const solToBuffer = reinvestSol; // caller adds to treasury SOL buffer
  // Ledger the retained profit + reinvestment for the dashboard
  await prisma.treasuryPosition.create({
    data: {
      bucket: 'PROFIT_RETAINED', amount: (collectedPab - pabToAgents) / 1e9, status: 'DEPLOYED',
      meta: { source: 'BOOKING_FEE_PROFIT', cycle: summary.cycle, retainedPab: collectedPab - pabToAgents, retainedSol: collectedSol - solToBuffer, reinvestedPab: pabToAgents, reinvestedSol: solToBuffer },
    },
  }).catch(() => {});
  logger.info(`[ProfitEngine] cycle ${summary.cycle}: reinvested ${pabToAgents} PAB → ${thin.length} agents, ${solToBuffer} SOL → buffer; retained ${(collectedPab - pabToAgents)} PAB profit`);
  return { fundedAgents: thin.length, pabToAgents, solToBuffer };
}

export const profitEngine = { quoteFee, decideReinvestment, applyReinvestmentCycle, TIERS };
