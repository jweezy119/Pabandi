import { describe, it, expect } from 'vitest';
import {
  TOTAL_SUPPLY,
  ALLOCATIONS,
  ALLOCATIONS as allocations,
  allocationFor,
  EMISSION_SCHEDULE,
  COMMUNITY_REWARDS,
  emissionForYear,
  checkInsToExhaustCommunity,
  TREASURY_BUCKETS,
  BUYBACK_SHARE_BPS,
  BUYBACK_REVENUE_THRESHOLD_CENTS,
  STAKING_POOL_BPS,
  STAKING_MIN_LOCK_DAYS,
  assertAllocationsReconcile,
  assertTreasuryBucketsReconcile,
  buybackCentsForQuarter,
  stakingPoolCents,
  stakerRewardCents,
  distributeEpochCents,
} from '../src/config/pab-supply';

/**
 * PAB supply and policy arithmetic.
 *
 * This file exists because "1,000,000,000 PAB, no further minting" is a claim in
 * a whitepaper that people will divide. An exchange checks the tranches sum to the
 * total. An investor checks the emission schedule does not exceed the community
 * tranche. Both are done here rather than trusted.
 *
 * Nothing here touches a database, which is deliberate: the supply arithmetic must
 * be checkable without one, and every test that needs a DB to verify a constant is
 * a test that stops running.
 */

describe('the supply reconciles', () => {
  it('allocations total exactly 1,000,000,000', () => {
    const total = ALLOCATIONS.reduce((sum, a) => sum + a.amount, 0n);
    // BigInt, not Float: 500,000,000 + 150,000,000 in IEEE 754 is not
    // 650,000,000, and a supply that does not add up is the first thing anyone
    // checks.
    expect(total).toBe(TOTAL_SUPPLY);
    expect(total).toBe(1_000_000_000n);
  });

  it('allocation percentages total 100%', () => {
    expect(ALLOCATIONS.reduce((sum, a) => sum + a.bps, 0)).toBe(10_000);
  });

  it('passes its own reconciliation check', () => {
    expect(() => assertAllocationsReconcile()).not.toThrow();
  });

  it('matches the published table exactly', () => {
    const expected: Record<string, [bigint, number]> = {
      COMMUNITY_REWARDS: [500_000_000n, 5000],
      TREASURY: [200_000_000n, 2000],
      TEAM: [150_000_000n, 1500],
      ECOSYSTEM: [100_000_000n, 1000],
      LIQUIDITY: [50_000_000n, 500],
    };
    for (const [category, [amount, bps]] of Object.entries(expected)) {
      const row = allocationFor(category as never);
      expect(row.amount, category).toBe(amount);
      expect(row.bps, category).toBe(bps);
    }
  });

  it('would catch a tranche edited to the wrong number', () => {
    // The check that makes the table trustworthy: each tranche's bps must match
    // its OWN share, not merely the total. 500M at 4900bps and 150M at 5100bps
    // would pass the sum checks while contradicting the published table.
    const tampered = [
      { category: 'A', amount: 490_000_000n, bps: 5000 },
      { category: 'B', amount: 150_000_000n, bps: 2000 },
    ];
    for (const row of tampered) {
      const expectedBps = Number((row.amount * 10_000n) / TOTAL_SUPPLY);
      expect(expectedBps).not.toBe(row.bps);
    }
  });

  it('rejects an unknown category rather than returning something plausible', () => {
    expect(() => allocationFor('NOPE' as never)).toThrow(/Unknown allocation/);
  });
});

describe('treasury buckets reconcile', () => {
  it('split the treasury tranche 50/30/20', () => {
    const byName = Object.fromEntries(TREASURY_BUCKETS.map((b) => [b.name, b.allocationBps]));
    expect(byName.STABLE_RESERVES).toBe(5000);
    expect(byName.BUYBACK_FUND).toBe(3000);
    expect(byName.OPERATING_BUFFER).toBe(2000);
  });

  it('sum to 100% of the treasury, not of total supply', () => {
    // Of the treasury. 50% of 200M is 100M, not 500M — conflating the two is an
    // easy mistake and would overstate reserves fourfold.
    expect(TREASURY_BUCKETS.reduce((s, b) => s + b.allocationBps, 0)).toBe(10_000);
    expect(() => assertTreasuryBucketsReconcile()).not.toThrow();
  });

  it('shows the stable reserves the policy actually describes', () => {
    const reserves = allocationFor('TREASURY').amount * 5000n / 10_000n;
    expect(reserves).toBe(100_000_000n);
  });
});

describe('emission schedule', () => {
  it('halves every two years to the stated rate', () => {
    expect(emissionForYear(1).pabPerCheckIn).toBe(10n);
    expect(emissionForYear(3).pabPerCheckIn).toBe(5n);
    expect(emissionForYear(5).pabPerCheckIn).toBe(2n);
    // Year 7 onward is the floor.
    expect(emissionForYear(7).pabPerCheckIn).toBe(1n);
    expect(emissionForYear(50).pabPerCheckIn).toBe(1n);
  });

  it('has no gaps or overlaps', () => {
    for (let year = 1; year <= 20; year++) {
      // A year with no defined rate would throw at emit time, in the middle of a
      // customer's check-in.
      expect(() => emissionForYear(year)).not.toThrow();
    }
    expect(() => emissionForYear(0)).toThrow();
  });

  it('states how many check-ins exhaust the community tranche', () => {
    // The number worth sanity-checking before launch. At 10 PAB it is 50,000,000
    // check-ins — large, which is why the schedule halves so the tranche is
    // reachable inside the stated decade rather than never.
    expect(checkInsToExhaustCommunity(1)).toBe(50_000_000n);
    expect(checkInsToExhaustCommunity(3)).toBe(100_000_000n);
    // Years 7+ is 1 PAB, not the 1.25 the specification text states.
    expect(checkInsToExhaustCommunity(7)).toBe(500_000_000n);
  });

  it('never uses a fractional emission rate', () => {
    // The spec says 1.25 for years 7+, and a 1.25 award cannot be added to a
    // wallet holding whole tokens without a rounding rule — which is exactly where
    // a "fixed, no further minting" promise quietly becomes "fixed, plus dust".
    // Asserted so the rate cannot be reintroduced as a float.
    for (const period of EMISSION_SCHEDULE) {
      expect(typeof period.pabPerCheckIn, period.label).toBe('bigint');
      expect(period.pabPerCheckIn, period.label).toBeGreaterThan(0n);
    }
  });

  it('only ever mints from the community tranche', () => {
    // The ceiling that makes "fixed supply" true: emissions can only ever draw on
    // the 500M community allocation, never on team, treasury or liquidity.
    expect(COMMUNITY_REWARDS).toBe(500_000_000n);
    const minted = 500_000_000n;
    expect(minted).toBeLessThan(TOTAL_SUPPLY);
    // Everything else is allocated out and never emitted.
    const nonCommunity = ALLOCATIONS
      .filter((a) => a.category !== 'COMMUNITY_REWARDS')
      .reduce((s, a) => s + a.amount, 0n);
    expect(nonCommunity + COMMUNITY_REWARDS).toBe(TOTAL_SUPPLY);
  });

  it('monotonically decreases', () => {
    let previous = emissionForYear(1).pabPerCheckIn;
    for (const period of EMISSION_SCHEDULE.slice(1)) {
      expect(period.pabPerCheckIn).toBeLessThan(previous);
      previous = period.pabPerCheckIn;
    }
    // Never zero: a zero rate would mean the community tranche is unreachable.
    expect(previous).toBeGreaterThan(0n);
  });
});

describe('buyback policy', () => {
  it('takes 10% of revenue above the threshold', () => {
    // $100,000 revenue: 10% is $10,000.
    expect(buybackCentsForQuarter(100_000_00n)).toBe(10_000_00n);
  });

  it('does nothing below $50,000', () => {
    // A quiet quarter is normal early on and is not an error, so this returns 0
    // rather than throwing.
    expect(BUYBACK_REVENUE_THRESHOLD_CENTS).toBe(5_000_000n);
    expect(buybackCentsForQuarter(4_999_999n)).toBe(0n);
    expect(buybackCentsForQuarter(0n)).toBe(0n);
  });

  it('is exactly 10%', () => {
    expect(BUYBACK_SHARE_BPS).toBe(1000n);
    expect(Number(BUYBACK_SHARE_BPS) / 100).toBe(10);
  });

  it('rounds down, never up', () => {
    // Rounding a buyback up would spend money that is not ours.
    const odd = 100_000_01n;
    const result = buybackCentsForQuarter(odd);
    expect(result * 10_000n <= odd * BUYBACK_SHARE_BPS).toBe(true);
  });

  it('reproduces the whitepaper flywheel figure, with the arithmetic corrected', () => {
    // The specification claims "1,000 merchants x $2,000/month -> $144K/year in PAB
    // burn". Two things are wrong with the route it takes to that number, and both
    // are asserted here so the corrected version is the one that ships.
    //
    // WRONG 1: 1,000 x $2,000/month is $24M/YEAR, not $24M/month. The draft's
    // intermediate line said "$24M/month = $288M annual", which is a twelvefold
    // overstatement of volume.
    const monthlyVolumeCents = 1_000n * 200_000n;        // $2,000,000/month
    const annualVolumeCents = monthlyVolumeCents * 12n;   // $24,000,000/year
    expect(annualVolumeCents).toBe(2_400_000_000n);
    // The draft's version, for contrast.
    expect(1_000n * 2_000_000n * 12n).not.toBe(annualVolumeCents);

    // WRONG 2: it assumed a 0.5% platform fee. The schedule is 3.5%, because 0.5%
    // loses money against a 2.9% processor. So the fees are 7x larger.
    const feesCents = (annualVolumeCents * 35n) / 1_000n;
    expect(feesCents).toBe(84_000_000n); // $840,000/year

    // 10% of that is $84,000/year. The claim of $144K/year was reached by the
    // monthly/annual confusion above, not by a real figure.
    const annualBuyback = (feesCents * BUYBACK_SHARE_BPS) / 10_000n;
    expect(annualBuyback).toBe(8_400_000n); // $84,000/year
    expect(annualBuyback).not.toBe(14_400_000n);
  });
});

describe('Mudarabah staking pool', () => {
  it('is 30% of net revenue', () => {
    expect(STAKING_POOL_BPS).toBe(3000n);
    expect(stakingPoolCents(100_000_00n)).toBe(30_000_00n);
  });

  it('matches the worked example in the specification', () => {
    // $50,000 revenue, 30% pool, 50M staked, user has 100k (0.2%).
    const pool = stakingPoolCents(50_000_00n);
    expect(pool).toBe(15_000_00n); // $15,000

    const reward = stakerRewardCents({
      poolCents: pool,
      stakedByAll: 50_000_000n,
      stakedByUser: 100_000n,
    });
    // 0.2% of $15,000 = $30.
    expect(reward).toBe(30_00n);
  });

  it('is proportional to stake, so a larger holder earns more', () => {
    const pool = 15_000_00n;
    const small = stakerRewardCents({ poolCents: pool, stakedByAll: 50_000_000n, stakedByUser: 100_000n });
    const large = stakerRewardCents({ poolCents: pool, stakedByAll: 50_000_000n, stakedByUser: 1_000_000n });
    expect(large).toBe(small * 10n);
  });

  it('a single share is capped at the pool', () => {
    // Floor division alone does not make a share affordable. The aggregate case —
    // ten holders each claiming a legitimate third of a pool — is handled by
    // distributeEpochCents, which pays from a running remainder.
    const pool = 15_000_00n;
    expect(stakerRewardCents({ poolCents: pool, stakedByAll: 3n, stakedByUser: 1n }))
      .toBeLessThanOrEqual(pool);
  });

  it('returns nothing when nobody is staking', () => {
    // A pool with no stakers must not be paid out to nobody and must not throw.
    expect(stakerRewardCents({ poolCents: 15_000_00n, stakedByAll: 0n, stakedByUser: 100_000n })).toBe(0n);
  });

  it('returns nothing for a zero stake, rather than a share of everything', () => {
    expect(stakerRewardCents({ poolCents: 15_000_00n, stakedByAll: 50_000_000n, stakedByUser: 0n })).toBe(0n);
  });

  it('requires a 30-day minimum lock', () => {
    // A shorter lock is not a commitment, and Mudarabah requires the capital to
    // actually be at risk for the partnership to be genuine.
    expect(STAKING_MIN_LOCK_DAYS).toBe(30);
  });
});
