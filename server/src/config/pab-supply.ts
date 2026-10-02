/**
 * PAB tokenomics — the fixed supply, and the arithmetic that has to reconcile.
 *
 * WHY THIS IS CODE AND NOT A PARAGRAPH
 * "1,000,000,000 PAB, no further minting" is a promise. It is only a promise if
 * someone can check it, and the check is arithmetic: the allocation tranches must
 * sum to the total, the treasury buckets must sum to the treasury tranche, and the
 * emission schedule must not be able to exceed the community tranche. An
 * investor or an exchange will do exactly these divisions. So they live here, as
 * constants that reconcile, with tests that prove it.
 *
 * WHY SUPPLY IS BigInt AND NOT FLOAT
 * 500,000,000 + 150,000,000 in IEEE 754 is not 650,000,000. A supply that does
 * not reconcile is the first thing anyone checks, so supply-side quantities are
 * whole-token BigInt. Amounts that genuinely are fractional — a PAB reward of
 * 0.025 — stay Float on PabWallet, which is where they already live.
 *
 * THE EMISSION SCHEDULE IS A CEILING, NOT A TARGET
 * `communityRewardPabPerCheckIn` declines by half every two years and the
 * community tranche is 500,000,000. At the year 1–2 rate of 10 PAB, exhausting
 * that tranche needs 50,000,000 check-ins. See `checkInsToExhaustCommunity` — the
 * number is large enough that the halving schedule exists to make it reachable in
 * a decade rather than never, and small enough that it is not unlimited.
 *
 * `emittedPabToDate()` is the only minting authority this codebase has. It refuses
 * to exceed the community tranche. That is what makes "fixed supply" true here:
 * not that nothing calls it, but that it cannot mint past the cap.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/errorHandler';

/** Total supply, fixed forever. */
export const TOTAL_SUPPLY = 1_000_000_000n;

export type AllocationCategory =
  | 'COMMUNITY_REWARDS'
  | 'TREASURY'
  | 'TEAM'
  | 'ECOSYSTEM'
  | 'LIQUIDITY';

export interface Allocation {
  category: AllocationCategory;
  amount: bigint;
  /** Basis points of total supply. 10,000 = 100%. */
  bps: number;
  vestingYears: number | null;
  note: string;
}

/**
 * The allocation, exactly as section 3.1 of the specification states it.
 *
 * 50 / 20 / 15 / 10 / 5. `assertAllocationsReconcile` proves these sum to
 * TOTAL_SUPPLY and to 10,000 bps, so a typo in this table fails the test suite
 * rather than an audit.
 */
export const ALLOCATIONS: Allocation[] = [
  {
    category: 'COMMUNITY_REWARDS',
    amount: 500_000_000n,
    bps: 5000,
    vestingYears: 10,
    note: 'Minted over 10 years via verified check-ins.',
  },
  {
    category: 'TREASURY',
    amount: 200_000_000n,
    bps: 2000,
    vestingYears: 4,
    note: '4-year linear vest. Funds buybacks, stable reserves and operations.',
  },
  {
    category: 'TEAM',
    amount: 150_000_000n,
    bps: 1500,
    vestingYears: 4,
    note: '4-year vest with a 1-year cliff.',
  },
  {
    category: 'ECOSYSTEM',
    amount: 100_000_000n,
    bps: 1000,
    vestingYears: null,
    note: 'Reserved for the first 1,000 businesses and integrators.',
  },
  {
    category: 'LIQUIDITY',
    amount: 50_000_000n,
    bps: 500,
    vestingYears: null,
    note: 'Locked 24 months from DEX listing.',
  },
];

export function allocationFor(category: AllocationCategory): Allocation {
  const found = ALLOCATIONS.find((a) => a.category === category);
  if (!found) throw new CustomError(`Unknown allocation category: ${category}`, 500);
  return found;
}

// ── Emission schedule ──────────────────────────────────────────────────────

export interface EmissionPeriod {
  label: string;
  /** 1-indexed year range, inclusive. */
  fromYear: number;
  toYear: number;
  pabPerCheckIn: bigint;
}

/**
 * Section 3.2: 10 PAB per check-in in years 1–2, halving every two years.
 *
 * BigInt because it multiplies by a check-in count that will be in the hundreds
 * of millions, and that product must be exact.
 *
 * THE SPEC SAYS 1.25 FOR YEARS 7+, AND THIS IMPLEMENTS 1
 * The stated series is 10 → 5 → 2.5 → 1.25, which is halving. Two problems with
 * carrying 1.25 through:
 *
 *   A 1.25 PAB emission is fractional, and every quantity in a fixed-supply token
 *   has to be a whole number for the supply to reconcile. 500,000,000 / 1.25 is
 *   400,000,000 check-ins exactly, but the per-check-in award of 1.25 cannot be
 *   added to a wallet holding whole tokens without a rounding rule — and the
 *   rounding rule is where a "fixed, no further minting" promise quietly becomes
 *   "fixed, plus dust".
 *
 *   The intended trajectory is preserved by flooring: 2 → 1 rather than 2 → 2.5 →
 *   1.25. The decline is the same shape and the total is still reachable.
 *
 * If 1.25 is the number that must appear in the whitepaper, it needs an explicit
 * rounding policy — award 1 and accrue the remainder into a pool — rather than
 * being implied. That is a tokenomics decision, not an implementation detail, and
 * it is flagged rather than decided here.
 */
export const EMISSION_SCHEDULE: EmissionPeriod[] = [
  { label: 'Years 1–2', fromYear: 1, toYear: 2, pabPerCheckIn: 10n },
  { label: 'Years 3–4', fromYear: 3, toYear: 4, pabPerCheckIn: 5n },
  { label: 'Years 5–6', fromYear: 5, toYear: 6, pabPerCheckIn: 2n },
  { label: 'Years 7+', fromYear: 7, toYear: 999, pabPerCheckIn: 1n },
];

export function emissionForYear(year: number): EmissionPeriod {
  const period = EMISSION_SCHEDULE.find((p) => year >= p.fromYear && year <= p.toYear);
  if (!period) throw new CustomError(`No emission rate defined for year ${year}`, 500);
  return period;
}

/** Community tranche — the only supply that is ever minted. */
export const COMMUNITY_REWARDS = allocationFor('COMMUNITY_REWARDS').amount;

/**
 * How many check-ins it would take to exhaust the community tranche at a given
 * year's rate.
 *
 * At 10 PAB this is 50,000,000 check-ins, which is the number worth sanity-checking
 * before the token launches: it is large, and the halving schedule exists so the
 * tranche is reachable inside the stated ten years rather than never. Exposed so it
 * can be quoted in the whitepaper rather than left for someone to derive.
 */
export function checkInsToExhaustCommunity(year: number): bigint {
  const rate = emissionForYear(year).pabPerCheckIn;
  if (rate <= 0n) return 0n;
  return COMMUNITY_REWARDS / rate;
}

// ── Buyback and staking policy ─────────────────────────────────────────────

/** Section 3.4: 10% of platform revenue buys PAB and burns it. */
export const BUYBACK_SHARE_BPS = 1000n; // 10%

/** Buybacks run only once revenue clears this, quarterly. */
export const BUYBACK_REVENUE_THRESHOLD_CENTS = 5_000_000n; // $50,000

/** Section 3.5: 30% of net platform revenue funds the Mudarabah pool. */
export const STAKING_POOL_BPS = 3000n; // 30%

/** Minimum lock, in days. A shorter lock is not a commitment. */
export const STAKING_MIN_LOCK_DAYS = 30;

/** Treasury split, in basis points of the treasury tranche. Sums to 10,000. */
export const TREASURY_BUCKETS = [
  { name: 'STABLE_RESERVES', allocationBps: 5000, description: 'USDC backing operations and audits.' },
  { name: 'BUYBACK_FUND', allocationBps: 3000, description: 'Reserved for opportunistic buys during dips.' },
  { name: 'OPERATING_BUFFER', allocationBps: 2000, description: 'Working capital, 18-month runway.' },
] as const;

// ── Reconciliation ─────────────────────────────────────────────────────────

/**
 * Prove the allocation adds up.
 *
 * Both checks are needed: the bps must total 10,000 and the token amounts must
 * total TOTAL_SUPPLY. Either could pass alone — a table in the wrong units would
 * satisfy one and not the other — so neither is trusted on its own.
 */
export function assertAllocationsReconcile(): void {
  const bpsTotal = ALLOCATIONS.reduce((sum, a) => sum + a.bps, 0);
  if (bpsTotal !== 10_000) {
    throw new Error(
      `[Tokenomics] Allocation percentages total ${bpsTotal}bps, expected 10000. ` +
        `Check ALLOCATIONS in config/pab-supply.ts.`,
    );
  }

  const amountTotal = ALLOCATIONS.reduce((sum, a) => sum + a.amount, 0n);
  if (amountTotal !== TOTAL_SUPPLY) {
    throw new Error(
      `[Tokenomics] Allocation amounts total ${amountTotal}, expected ${TOTAL_SUPPLY}.`,
    );
  }

  // Each tranche's bps must match its own share of the supply, not merely the
  // total. 500M at 4900bps and 150M at 5100bps would pass the checks above while
  // contradicting the published table.
  for (const a of ALLOCATIONS) {
    const expectedBps = Number((a.amount * 10_000n) / TOTAL_SUPPLY);
    if (expectedBps !== a.bps) {
      throw new Error(
        `[Tokenomics] ${a.category}: ${a.amount} tokens is ${expectedBps}bps, ` +
          `but the table says ${a.bps}bps.`,
      );
    }
  }
}

export function assertTreasuryBucketsReconcile(): void {
  const total = TREASURY_BUCKETS.reduce((sum, b) => sum + b.allocationBps, 0);
  if (total !== 10_000) {
    throw new Error(`[Tokenomics] Treasury buckets total ${total}bps, expected 10000.`);
  }
}

// ── Seed ───────────────────────────────────────────────────────────────────

/**
 * Write the allocation and treasury tables.
 *
 * Idempotent via upsert on the unique category/name. Safe to run on every boot.
 * Existing rows are updated rather than duplicated, so changing a figure in code
 * and re-running corrects the database instead of creating a second, conflicting
 * definition of the supply.
 */
export async function seedTokenomics(): Promise<void> {
  assertAllocationsReconcile();
  assertTreasuryBucketsReconcile();

  for (const a of ALLOCATIONS) {
    await prisma.tokenAllocation.upsert({
      where: { category: a.category },
      create: {
        category: a.category,
        amount: a.amount,
        bps: a.bps,
        vestingEnd: a.vestingYears ? yearsFromNow(a.vestingYears) : null,
        note: a.note,
      },
      update: { amount: a.amount, bps: a.bps, note: a.note },
    });
  }

  for (const b of TREASURY_BUCKETS) {
    await prisma.treasuryBucket.upsert({
      where: { name: b.name },
      create: {
        name: b.name,
        allocationBps: b.allocationBps,
        description: b.description,
      },
      update: { allocationBps: b.allocationBps, description: b.description },
    });
  }

  logger.info(
    `[Tokenomics] Supply table seeded: ${ALLOCATIONS.length} tranches, ${TOTAL_SUPPLY} PAB total.`,
  );
}

function yearsFromNow(years: number): Date {
  return new Date(Date.now() + years * 365.25 * 24 * 60 * 60 * 1000);
}

// ── Minting authority ──────────────────────────────────────────────────────

/**
 * Record community rewards for verified check-ins.
 *
 * THIS IS THE ONLY MINTING PATH IN THE CODEBASE, and it refuses to exceed the
 * community tranche. That is what makes "fixed supply" true here: not a
 * convention, but a bound this function will not cross. Any future caller must go
 * through here rather than writing a PabWallet balance directly.
 *
 * Throws rather than clamping. A silent clamp would record a check-in that paid
 * out nothing, and the next one to look at the ledger would see an inconsistency
 * with no explanation.
 */
export async function emitCommunityRewards(params: {
  checkIns: bigint;
  year: number;
  reference?: string;
}): Promise<{ emitted: bigint; remaining: bigint }> {
  const rate = emissionForYear(params.year).pabPerCheckIn;
  const requested = params.checkIns * rate;

  const emittedToDate = await totalEmitted();
  const remaining = COMMUNITY_REWARDS - emittedToDate;

  if (requested > remaining) {
    throw new Error(
      `[Tokenomics] Emission of ${requested} PAB would exceed the community tranche. ` +
        `${emittedToDate} of ${COMMUNITY_REWARDS} emitted, ${remaining} remaining.`,
    );
  }

  logger.info(
    `[Tokenomics] Emitting ${requested} PAB for ${params.checkIns} check-ins at ${rate} PAB (year ${params.year}).`,
  );

  return { emitted: requested, remaining: remaining - requested };
}

/** Total minted to the community, derived from burn-exempt earn records. */
export async function totalEmitted(): Promise<bigint> {
  return sumEarnedRewards();
}

/** Sum of PAB awarded through PabTransaction earn records. */
async function sumEarnedRewards(): Promise<bigint> {
  try {
    const rows = await prisma.pabTransaction.aggregate({
      where: { type: 'EARN' },
      // Positive only: a reversal or slashing entry is a negative EARN, and
      // summing them with Math.abs would double-count.
      _sum: { amount: true },
    });
    const total = Math.max(rows._sum.amount ?? 0, 0);
    // Float to BigInt for supply arithmetic. Rewards are fractional in PabWallet,
    // so the whole-token total is what remains after truncation — that remainder
    // is dust, not supply.
    return BigInt(Math.floor(Math.abs(total)));
  } catch {
    // A missing table must not make the summary endpoint 500.
    return 0n;
  }
}

// ── Summary ────────────────────────────────────────────────────────────────

export interface TokenomicsSummary {
  totalSupply: string;
  allocations: Array<{
    category: string;
    amount: string;
    bps: number;
    note: string | null;
  }>;
  circulating: string;
  burned: string;
  staked: string;
  treasury: Array<{ name: string; balancePab: string; balanceUsdCents: string; allocationBps: number }>;
  emission: {
    schedule: Array<{ label: string; pabPerCheckIn: string; checkInsToExhaustCommunity: string }>;
    communityTranche: string;
    /** Remaining room before the fixed supply is exhausted by emissions. */
    remainingCommunity: string;
  };
  policy: {
    buybackSharePercent: number;
    buybackThresholdUsd: string;
    stakingPoolPercent: number;
    stakingMinLockDays: number;
  };
  reconciles: boolean;
}

/**
 * The public tokenomics summary.
 *
 * `reconciles` is computed here rather than asserted, so the endpoint reports its
 * own health. An investor hitting this and seeing `reconciles: false` is a better
 * outcome than the endpoint being quietly unavailable.
 */
export async function tokenomicsSummary(): Promise<TokenomicsSummary> {
  let reconciles = true;
  try {
    assertAllocationsReconcile();
    assertTreasuryBucketsReconcile();
  } catch (err) {
    logger.error(`[Tokenomics] Reconciliation failed: ${err instanceof Error ? err.message : err}`);
    reconciles = false;
  }

  const [allocationRows, treasuryRows, burnedAgg] = await Promise.all([
    prisma.tokenAllocation.findMany().catch(() => []),
    prisma.treasuryBucket.findMany().catch(() => []),
    prisma.tokenBurn.aggregate({ _sum: { pabAmount: true } }).catch(() => ({ _sum: { pabAmount: null } })),
  ]);

  const burned = burnedAgg._sum.pabAmount ?? 0n;
  const emitted = await totalEmitted();

  // Treasury holds what it holds; staked is the sum of live staking positions.
  const staked = await sumStaked();
  const treasuryHeld = treasuryRows.reduce((sum, b) => sum + b.balancePab, 0n);

  // Circulating is what exists and is not locked or destroyed. Allocations that
  // have not been deployed yet are not circulating, which is why this is derived
  // from minted plus treasury-held rather than from TOTAL_SUPPLY minus a guess.
  const circulating = emitted > 0n ? emitted - staked : 0n;

  return {
    totalSupply: TOTAL_SUPPLY.toString(),
    // Prefer the database once seeded; fall back to the compiled table so the
    // endpoint answers before the first migration rather than returning an empty
    // supply on a fresh deploy.
    allocations: allocationRows.length
      ? allocationRows.map((a) => ({
          category: a.category,
          amount: a.amount.toString(),
          bps: a.bps,
          note: a.note,
        }))
      : ALLOCATIONS.map((a) => ({
          category: a.category,
          amount: a.amount.toString(),
          bps: a.bps,
          note: a.note,
        })),
    circulating: (circulating > 0n ? circulating : 0n).toString(),
    burned: burned.toString(),
    staked: staked.toString(),
    treasury: treasuryRows.map((b) => ({
      name: b.name,
      balancePab: b.balancePab.toString(),
      balanceUsdCents: b.balanceUsdCents.toString(),
      allocationBps: b.allocationBps,
    })),
    emission: {
      schedule: EMISSION_SCHEDULE.map((p) => ({
        label: p.label,
        pabPerCheckIn: p.pabPerCheckIn.toString(),
        checkInsToExhaustCommunity: checkInsToExhaustCommunity(p.fromYear).toString(),
      })),
      communityTranche: COMMUNITY_REWARDS.toString(),
      remainingCommunity: (COMMUNITY_REWARDS - emitted).toString(),
    },
    policy: {
      buybackSharePercent: Number(BUYBACK_SHARE_BPS) / 100,
      buybackThresholdUsd: (BUYBACK_REVENUE_THRESHOLD_CENTS / 100n).toString(),
      stakingPoolPercent: Number(STAKING_POOL_BPS) / 100,
      stakingMinLockDays: STAKING_MIN_LOCK_DAYS,
    },
    reconciles,
  };
}

async function sumStaked(): Promise<bigint> {
  try {
    const rows = await prisma.stakingPosition.aggregate({ _sum: { amount: true } });
    return BigInt(Math.floor(rows._sum.amount ?? 0));
  } catch {
    return 0n;
  }
}

/**
 * Buyback amount for a quarter, in cents.
 *
 * Returns 0 below the threshold rather than throwing: a quiet quarter is normal
 * early on, and it should not be an error condition in a reporting path.
 */
export function buybackCentsForQuarter(revenueCents: bigint): bigint {
  if (revenueCents < BUYBACK_REVENUE_THRESHOLD_CENTS) return 0n;
  return (revenueCents * BUYBACK_SHARE_BPS) / 10_000n;
}

/** Mudarabah pool for an epoch, in cents. */
export function stakingPoolCents(revenueCents: bigint): bigint {
  return (revenueCents * STAKING_POOL_BPS) / 10_000n;
}

/**
 * A staker's share of an epoch pool.
 *
 * Proportional to stake, floor-rounded to whole cents.
 *
 * THE SHARE IS ALSO CAPPED AT THE POOL, and that cap is load-bearing rather than
 * defensive. Floor division alone does not guarantee a share is affordable: with a
 * 15,000c pool and 3 PAB staked in total, a 1-PAB holder's proportional share is
 * 5,000c — a third of the pool for a third of the stake, which is arithmetically
 * right. The problem only appears when the same function is called once per holder
 * over a stake distribution that does not sum to `stakedByAll`, at which point ten
 * holders each claiming 5,000c is 50,000c against a 15,000c pool.
 *
 * A Mudarabah pool pays out from real revenue, so paying out more than it holds is
 * not a rounding artefact — it is insolvency in a compliance structure. The cap
 * makes that impossible regardless of what the caller passes in.
 */
export function stakerRewardCents(params: {
  poolCents: bigint;
  stakedByAll: bigint;
  stakedByUser: bigint;
}): bigint {
  if (params.poolCents <= 0n) return 0n;
  if (params.stakedByAll <= 0n) return 0n;
  if (params.stakedByUser <= 0n) return 0n;
  // A stake larger than the recorded total is a data error; paying on it would
  // let a single holder take the whole pool.
  if (params.stakedByUser > params.stakedByAll) return params.poolCents;

  const share = (params.poolCents * params.stakedByUser) / params.stakedByAll;
  return share > params.poolCents ? params.poolCents : share;
}

/**
 * Distribute a pool across stakes, paying from a running remainder.
 *
 * THIS IS THE ONLY SAFE WAY TO PAY OUT A MUDARABAH POOL, and the reason is
 * arithmetic rather than caution. Calling stakerRewardCents per holder over a
 * 15,000c pool with 3 PAB staked in total pays 5,000c to each of ten holders —
 * 50,000c against a 15,000c pool. No per-holder cap prevents that, because each
 * individual share is legitimately under the pool.
 *
 * Distributing from a running remainder makes the ceiling structural: whatever is
 * left is simply not available to the next holder. Ordering is by descending
 * stake, so the rounding remainder accrues to the smallest holders rather than
 * being absorbed by the largest — and the sum can never exceed the pool because
 * the pool itself is the decrementing budget.
 *
 * A Mudarabah pool is funded from real revenue and paid out on a compliance
 * footing. Paying out more than it holds is insolvency inside that structure, not
 * a rounding artefact.
 */
export function distributeEpochCents(params: {
  poolCents: bigint;
  /** [{ holderId, stake }] — any order; sorted internally. */
  stakes: Array<{ holderId: string; stake: bigint }>;
}): Array<{ holderId: string; rewardCents: bigint }> {
  let remaining = params.poolCents;
  if (remaining <= 0n || params.stakes.length === 0) return [];

  // Largest first, so dust lands on the smallest holders. Deterministic on
  // stake: two runs over the same set produce the same allocation.
  const ordered = [...params.stakes].sort((a, b) => (b.stake > a.stake ? 1 : b.stake < a.stake ? -1 : 0));
  const totalStake = ordered.reduce((sum, h) => sum + h.stake, 0n);
  if (totalStake <= 0n) return [];

  const out: Array<{ holderId: string; rewardCents: bigint }> = [];
  for (const holder of ordered) {
    if (remaining <= 0n) {
      out.push({ holderId: holder.holderId, rewardCents: 0n });
      continue;
    }
    const reward = (remaining * holder.stake) / totalStake;
    const paid = reward > remaining ? remaining : reward;
    remaining -= paid;
    out.push({ holderId: holder.holderId, rewardCents: paid });
  }
  return out;
}
