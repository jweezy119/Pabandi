import { web3AgentService } from './web3Agent.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ── Config ─────────────────────────────────────────────────────
const LOOP_INTERVAL_MS = parseInt(process.env.AGENT_LOOP_INTERVAL_MS || '300000', 10); // 5 min default
const BOOKING_AMOUNT = parseInt(process.env.AGENT_BOOKING_AMOUNT || '1', 10); // PAB per booking
const POOL_FEE_INTERVAL_MS = parseInt(process.env.POOL_FEE_INTERVAL_MS || '600000', 10); // 10 min default
const MAX_BOOKINGS_PER_CYCLE = parseInt(process.env.MAX_BOOKINGS_PER_CYCLE || '10', 10);
const MIN_OUTFLOW_PAB = parseInt(process.env.MIN_OUTFLOW_PAB || '1', 10);
// Live on-chain bookings (real PAB transfers). OFF by default → simulated (DB-only) to protect SOL.
const LIVE_BOOKINGS = process.env.LIVE_BOOKINGS === 'true';

interface AgentLoopState {
  running: boolean;
  live: boolean;
  lastCycleAt: Date | null;
  lastPoolFeeAt: Date | null;
  totalBookings: number;
  totalFeesCollected: number;
  totalBadgePurchases: number;
}

let state: AgentLoopState = {
  running: false,
  live: LIVE_BOOKINGS,
  lastCycleAt: null,
  lastPoolFeeAt: null,
  totalBookings: 0,
  totalFeesCollected: 0,
  totalBadgePurchases: 0,
};

// ── Agent Loop ─────────────────────────────────────────────────

/**
 * Run one cycle of the AI agent loop:
 * 1. Badge purchases (simulated — agents buy badges from treasury)
 * 2. Bookings (agents pay other agents for services)
 * 3. Pool fee collection (arbitrage fees from USDC/PAB pool)
 */
export async function runAgentLoopCycle(): Promise<{
  bookings: number;
  feesCollected: number;
  badgePurchases: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let bookings = 0;
  let badgePurchases = 0;
  let badgePab = 0;
  let feesCollected = 0; // PAB booking fees captured this cycle
  let poolFeesUsdc = 0; // USDC pool fees captured this cycle

  try {
    // Step 1: Load active agents
    const agents = await web3AgentService.loadAgents();
    if (agents.length === 0) {
      logger.info('[AgentLoop] No active agents — skipping cycle');
      return { bookings: 0, feesCollected: 0, badgePurchases: 0, errors: ['No active agents'] };
    }

    // Step 2: Simulated badge purchases (agents buy badges from treasury)
    const badgeTypes = ['genesis-partner', 'early-adopter', 'trust-flux'] as const;
    const badgePrices: Record<string, number> = {
      'genesis-partner': 50,
      'early-adopter': 20,
      'trust-flux': 10,
    };

    for (const agent of agents.slice(0, Math.min(agents.length, MAX_BOOKINGS_PER_CYCLE))) {
      try {
        // Randomly decide if this agent buys a badge this cycle (30% chance)
        if (Math.random() > 0.3) continue;

        const badgeType = badgeTypes[Math.floor(Math.random() * badgeTypes.length)];
        const price = badgePrices[badgeType];

        if (agent.balancePab < price) continue; // Skip if not enough balance

        // Debit agent balance
        await prisma.web3Agent.update({
          where: { profileId: agent.profileId },
          data: { balancePab: { decrement: price } },
        });

        // Credit treasury (simulated — in production this would be an on-chain transfer)
        await prisma.agentTransaction.create({
          data: {
            agentId: agent.id,
            type: 'BADGE_PURCHASE',
            amount: price,
            fromAddress: agent.walletAddress,
            toAddress: process.env.PABANDI_TREASURY_WALLET || 'treasury',
            metadata: { badgeType } as any,
          } as any,
        });

        badgePurchases++;
        state.totalBadgePurchases++;
        badgePab += price;
        logger.info(`[AgentLoop] Badge purchase: ${agent.profileId} bought ${badgeType} for ${price} PAB`);
      } catch (err: any) {
        errors.push(`Badge purchase for ${agent.profileId}: ${err.message}`);
      }
    }

    // Step 3: Simulated bookings (agents pay other agents)
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const bookingLimit = Math.min(shuffled.length, MAX_BOOKINGS_PER_CYCLE);

    for (let i = 0; i < bookingLimit; i++) {
      const fromAgent = shuffled[i];
      const toAgent = shuffled[(i + 1) % shuffled.length];

      if (fromAgent.profileId === toAgent.profileId) continue;
      if (fromAgent.balancePab < BOOKING_AMOUNT + MIN_OUTFLOW_PAB) continue;

      try {
        const result = await web3AgentService.executeBookingPayment(
          fromAgent,
          toAgent,
          BOOKING_AMOUNT
        );

        if (result.success) {
          bookings++;
          state.totalBookings++;
          // 5 PAB platform fee per booking goes to treasury
          state.totalFeesCollected += 5;
          feesCollected += 5;
          logger.info(`[AgentLoop] Booking: ${fromAgent.profileId} → ${toAgent.profileId} | ${BOOKING_AMOUNT} PAB`);
        } else {
          errors.push(`Booking ${fromAgent.profileId}→${toAgent.profileId}: ${result.error}`);
        }
      } catch (err: any) {
        errors.push(`Booking ${fromAgent.profileId}→${toAgent.profileId}: ${err.message}`);
      }
    }

    // Step 4: Collect pool fees
    try {
      const poolResult = await web3AgentService.collectPoolFees();
      if (poolResult.success && poolResult.feesCollected) {
        feesCollected = poolResult.feesCollected;
        poolFeesUsdc = poolResult.feesCollected;
        state.totalFeesCollected += feesCollected;
        logger.info(`[AgentLoop] Pool fees collected: ${feesCollected} USDC`);
      }
    } catch (err: any) {
      errors.push(`Pool fee collection: ${err.message}`);
    }

    state.lastCycleAt = new Date();

    // Step 5: Write combined revenue to the Autonomous Treasury ledger (TreasuryPosition)
    try {
      await recordTreasuryRevenue({
        bookingFeesPab: feesCollected,
        badgePab,
        poolFeesUsdc,
      });
    } catch (err: any) {
      errors.push(`Treasury ledger: ${err.message}`);
    }

    logger.info(`[AgentLoop] Cycle complete: ${bookings} bookings, ${feesCollected} fees, ${badgePurchases} badges, ${errors.length} errors`);
  } catch (err: any) {
    errors.push(`Agent loop cycle: ${err.message}`);
    logger.error('[AgentLoop] Cycle failed:', err.message);
  }

  return { bookings, feesCollected, badgePurchases, errors };
}

/**
 * Start the agent loop — runs on a recurring interval.
 */
export function startAgentLoop(): void {
  if (state.running) {
    logger.warn('[AgentLoop] Already running');
    return;
  }

  state.running = true;
  logger.info(`[AgentLoop] Started — interval ${LOOP_INTERVAL_MS}ms, pool fee interval ${POOL_FEE_INTERVAL_MS}ms`);

  // Run booking + badge cycle
  setInterval(async () => {
    try {
      await runAgentLoopCycle();
    } catch (err: any) {
      logger.error('[AgentLoop] Unhandled cycle error:', err.message);
    }
  }, LOOP_INTERVAL_MS);

  // Run pool fee collection on separate interval
  setInterval(async () => {
    try {
      const result = await web3AgentService.collectPoolFees();
      if (result.success && result.feesCollected) {
        state.totalFeesCollected += result.feesCollected;
        state.lastPoolFeeAt = new Date();
        logger.info(`[AgentLoop] Scheduled pool fee collection: ${result.feesCollected} USDC`);
      }
    } catch (err: any) {
      logger.error('[AgentLoop] Scheduled pool fee error:', err.message);
    }
  }, POOL_FEE_INTERVAL_MS);

  // Recurring background-check re-screening (30d stale → recheck) every 24h
  const BG_RECHECK_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const { backgroundCheckService } = await import('./backgroundCheck.service');
      const n = await backgroundCheckService.recheckDue();
      if (n > 0) logger.info(`[AgentLoop] Re-screening ${n} stale background checks`);
    } catch (err: any) {
      logger.error('[AgentLoop] BG recheck error:', err.message);
    }
  }, BG_RECHECK_MS);

  // Run initial cycle immediately
  runAgentLoopCycle().catch((err: any) => {
    logger.error('[AgentLoop] Initial cycle error:', err.message);
  });
}

/**
 * Stop the agent loop.
 */
export function stopAgentLoop(): void {
  state.running = false;
  logger.info('[AgentLoop] Stopped');
}

/**
 * Prepare LIVE booking rails (pre-create agent ATAs + fund SOL for tx fees).
 * Calls web3AgentService.prepareLiveBookingRails. Safe to call once before
 * enabling LIVE_BOOKINGS=true. Returns SOL spent so the operator can verify budget.
 */
export async function prepareLiveRails(opts?: { solBudget?: number; perAgentSol?: number }) {
  return web3AgentService.prepareLiveBookingRails(opts);
}

/**
 * Get current agent loop state.
 */
export function getAgentLoopState(): AgentLoopState {
  return { ...state };
}

/**
 * Record combined agent-loop revenue into the Autonomous Treasury ledger
 * (TreasuryPosition) so the profitability report shows one reconciled number.
 *
 * - Booking fees (PAB) + Badge revenue (PAB): captured to treasury
 * - 10% of PAB revenue is burned (deflation) → recorded as BURN
 * - Pool fees (USDC): captured to treasury
 */
const BOOKING_FEE_BURN_PCT = 0.1;

async function recordTreasuryRevenue(opts: {
  bookingFeesPab: number;
  badgePab: number;
  poolFeesUsdc: number;
}): Promise<void> {
  const pabRevenue = (opts.bookingFeesPab || 0) + (opts.badgePab || 0);
  if (pabRevenue <= 0 && (opts.poolFeesUsdc || 0) <= 0) return;

  if (pabRevenue > 0) {
    // PAB fees captured to treasury
    await prisma.treasuryPosition.create({
      data: {
        bucket: 'AGENT_REVENUE',
        amount: pabRevenue,
        status: 'DEPLOYED',
        meta: {
          asset: 'PAB',
          source: 'agent-loop',
          bookingFees: opts.bookingFeesPab,
          badgeRevenue: opts.badgePab,
          note: 'Agent booking + badge revenue captured to treasury',
        },
      },
    });

    // 10% burn (deflation engine)
    const burn = +(pabRevenue * BOOKING_FEE_BURN_PCT).toFixed(4);
    await prisma.treasuryPosition.create({
      data: {
        bucket: 'BURN',
        amount: burn,
        status: 'DEPLOYED',
        meta: {
          asset: 'PAB',
          source: 'agent-loop',
          burnedFrom: pabRevenue,
          note: '10% of agent-loop PAB revenue burned (deflation)',
        },
      },
    });
  }

  if (opts.poolFeesUsdc > 0) {
    await prisma.treasuryPosition.create({
      data: {
        bucket: 'AGENT_REVENUE',
        amount: opts.poolFeesUsdc,
        status: 'DEPLOYED',
        meta: {
          asset: 'USDC',
          source: 'pool-fee',
          note: 'USDC/PAB pool arbitrage fee captured to treasury',
        },
      },
    });
  }
}

/**
 * Reset daily counters for all agents (call at midnight UTC).
 */
export async function resetAllDailyCounters(): Promise<void> {
  await web3AgentService.resetDailyCounters();
  logger.info('[AgentLoop] All daily counters reset');
}