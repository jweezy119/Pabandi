import { prisma } from '../utils/database';
import { buyPAB, sellPAB, getPoolInfo, getFees } from './raydiumPool.service';

/**
 * PabDex Auto-Trader
 * ==================
 * 
 * Continuously runs trades to generate LP fees.
 * Trades are executed from the platform wallet on behalf of agents.
 * All profits stay in the platform wallet as USDC.
 */

const TRADE_INTERVAL_MS = 5000; // 5 seconds between trades
const MIN_TRADE_USDC = 0.10;
const MAX_TRADE_USDC = 1.00;

let running = false;
let interval: NodeJS.Timeout | null = null;
let totalTrades = 0;
let totalVolume = 0;
let totalFees = 0;

export async function startAutoTrader(): Promise<void> {
  if (running) return;
  running = true;
  
  console.log('[AutoTrader] Starting...');
  
  interval = setInterval(async () => {
    try {
      await executeRandomTrade();
    } catch (err: any) {
      console.error('[AutoTrader] Error:', err.message);
    }
  }, TRADE_INTERVAL_MS);
}

export function stopAutoTrader(): void {
  if (interval) clearInterval(interval);
  running = false;
  console.log('[AutoTrader] Stopped');
}

export function getAutoTraderStats() {
  return {
    running,
    totalTrades,
    totalVolume,
    totalFees,
  };
}

async function executeRandomTrade() {
  // Get active agents with balances
  const agents = await prisma.agentProfile.findMany({
    where: { isActive: true },
    select: { id: true, name: true, balanceUsdc: true, balancePab: true },
  });
  
  if (agents.length === 0) return;
  
  // Pick a random agent
  const agent = agents[Math.floor(Math.random() * agents.length)];
  
  // Decide direction based on balances
  const direction = agent.balanceUsdc > agent.balancePab ? 'buy' : 'sell';
  
  let amount: number;
  if (direction === 'buy') {
    amount = Math.min(agent.balanceUsdc * 0.5, MAX_TRADE_USDC);
    if (amount < MIN_TRADE_USDC) return;
  } else {
    amount = Math.min(agent.balancePab * 0.5, 1000); // Sell up to 1000 PAB
    if (amount < 100) return;
  }
  
  const result = direction === 'buy'
    ? await buyPAB(agent.id, amount)
    : await sellPAB(agent.id, amount);
  
  if (result.success) {
    totalTrades++;
    totalVolume += amount;
    const fees = amount * 0.0025; // 0.25%
    totalFees += fees;
  }
}
