import { web3AgentService } from './web3Agent.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ── Config ─────────────────────────────────────────────────────
const LOOP_INTERVAL_MS = parseInt(process.env.AGENT_LOOP_INTERVAL_MS || '300000', 10); // 5 min default
const BOOKING_AMOUNT = parseInt(process.env.AGENT_BOOKING_AMOUNT || '1', 10); // PAB per booking
const POOL_FEE_INTERVAL_MS = parseInt(process.env.POOL_FEE_INTERVAL_MS || '600000', 10); // 10 min default
const MAX_BOOKINGS_PER_CYCLE = parseInt(process.env.MAX_BOOKINGS_PER_CYCLE || '10', 10);
const MIN_OUTFLOW_PAB = parseInt(process.env.MIN_OUTFLOW_PAB || '1', 10);

interface AgentLoopState {
  running: boolean;
  lastCycleAt: Date | null;
  lastPoolFeeAt: Date | null;
  totalBookings: number;
  totalFeesCollected: number;
  totalBadgePurchases: number;
}

let state: AgentLoopState = {
  running: false,
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
  let feesCollected = 0;

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
            agentId: agent.profileId,
            type: 'BADGE_PURCHASE',
            amount: price,
            fromAddress: agent.walletAddress,
            toAddress: process.env.PABANDI_TREASURY_WALLET || 'treasury',
            metadata: { badgeType } as any,
          } as any,
        });

        badgePurchases++;
        state.totalBadgePurchases++;
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
        state.totalFeesCollected += feesCollected;
        logger.info(`[AgentLoop] Pool fees collected: ${feesCollected} USDC`);
      }
    } catch (err: any) {
      errors.push(`Pool fee collection: ${err.message}`);
    }

    state.lastCycleAt = new Date();
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
 * Get current agent loop state.
 */
export function getAgentLoopState(): AgentLoopState {
  return { ...state };
}

/**
 * Reset daily counters for all agents (call at midnight UTC).
 */
export async function resetAllDailyCounters(): Promise<void> {
  await web3AgentService.resetDailyCounters();
  logger.info('[AgentLoop] All daily counters reset');
}