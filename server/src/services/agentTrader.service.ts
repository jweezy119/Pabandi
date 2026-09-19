/**
 * agentTrader.service.ts — Agent Trading Loop
 * 
 * Agents continuously buy/sell PAB to generate volume.
 * Trading fees (0.25%) accrue to LP.
 * Auto-compounds fees back into LP.
 * Platform takes 10% of LP earnings.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { raydiumPoolService } from './raydiumPool.service';

const TOKEN_DECIMALS = 9;
const USDC_DECIMALS = 6;
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export interface AgentConfig {
  id: string;
  name: string;
  tradeIntervalMs: number;
  maxTradeAmountUsdc: number;
  minTradeAmountUsdc: number;
  maxSlippagePercent: number;
  enabled: boolean;
}

export interface AgentState {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'stopped';
  totalTrades: number;
  totalVolumeUsd: number;
  totalFeesPaid: number;
  totalProfit: number;
  lastTradeAt?: string;
  lastTradeDirection?: 'buy' | 'sell';
  lastTradeAmount?: number;
  lastTradePrice?: number;
  pnl: number; // profit and loss in USDC
}

export interface TradeResult {
  success: boolean;
  agentId: string;
  direction: 'buy' | 'sell';
  inputAmount: number;
  outputAmount: number;
  price: number;
  feeUsdc: number;
  txSignature?: string;
  error?: string;
}

const agents = new Map<string, AgentState>();
const intervals = new Map<string, NodeJS.Timeout>();

function getConnection(): Connection {
  return raydiumPoolService ? new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  ) : null as any;
}

function getKeypair(): Keypair {
  const key = process.env.PLATFORM_PRIVATE_KEY;
  if (!key) throw new Error('PLATFORM_PRIVATE_KEY not set');
  return Keypair.fromSecretKey(bs58.decode(key));
}

/**
 * Create a new agent with configuration
 */
export function createAgent(config: Partial<AgentConfig> & { id: string; name: string }): AgentConfig {
  const agentConfig: AgentConfig = {
    id: config.id,
    name: config.name,
    tradeIntervalMs: config.tradeIntervalMs || 30000, // 30 seconds
    maxTradeAmountUsdc: config.maxTradeAmountUsdc || 0.50, // $0.50 max per trade
    minTradeAmountUsdc: config.minTradeAmountUsdc || 0.10, // $0.10 min per trade
    maxSlippagePercent: config.maxSlippagePercent || 2,
    enabled: config.enabled ?? true,
  };

  const state: AgentState = {
    id: config.id,
    name: config.name,
    status: 'paused',
    totalTrades: 0,
    totalVolumeUsd: 0,
    totalFeesPaid: 0,
    totalProfit: 0,
    pnl: 0,
  };

  agents.set(config.id, state);
  console.log(`[AgentTrader] Agent created: ${config.name} (${config.id})`);

  return agentConfig;
}

/**
 * Start an agent's trading loop
 */
export async function startAgent(agentId: string): Promise<boolean> {
  const agent = agents.get(agentId);
  if (!agent) {
    console.error(`[AgentTrader] Agent not found: ${agentId}`);
    return false;
  }

  if (agent.status === 'running') {
    console.log(`[AgentTrader] Agent already running: ${agent.name}`);
    return true;
  }

  agent.status = 'running';
  console.log(`[AgentTrader] Starting agent: ${agent.name}`);

  // Run initial trade
  await executeTrade(agentId);

  // Schedule recurring trades
  const config = getAgentConfig(agentId);
  const interval = setInterval(async () => {
    if (agent.status === 'running') {
      await executeTrade(agentId);
    }
  }, config?.tradeIntervalMs || 30000);

  intervals.set(agentId, interval);
  return true;
}

/**
 * Pause an agent
 */
export function pauseAgent(agentId: string): boolean {
  const agent = agents.get(agentId);
  if (!agent) return false;

  agent.status = 'paused';
  console.log(`[AgentTrader] Agent paused: ${agent.name}`);
  return true;
}

/**
 * Stop an agent completely
 */
export function stopAgent(agentId: string): boolean {
  const agent = agents.get(agentId);
  if (!agent) return false;

  agent.status = 'stopped';

  const interval = intervals.get(agentId);
  if (interval) {
    clearInterval(interval);
    intervals.delete(agentId);
  }

  console.log(`[AgentTrader] Agent stopped: ${agent.name}`);
  return true;
}

/**
 * Get agent configuration (stored externally)
 */
function getAgentConfig(agentId: string): AgentConfig | undefined {
  // In production, load from DB/env. For now, use defaults.
  return {
    id: agentId,
    name: agents.get(agentId)?.name || agentId,
    tradeIntervalMs: parseInt(process.env.AGENT_TRADE_INTERVAL_MS || '30000', 10),
    maxTradeAmountUsdc: parseFloat(process.env.AGENT_MAX_TRADE_USDC || '0.50'),
    minTradeAmountUsdc: parseFloat(process.env.AGENT_MIN_TRADE_USDC || '0.10'),
    maxSlippagePercent: 2,
    enabled: true,
  };
}

/**
 * Execute a single trade (buy or sell) for an agent
 */
export async function executeTrade(agentId: string): Promise<TradeResult> {
  const agent = agents.get(agentId);
  if (!agent) {
    return { success: false, agentId, direction: 'buy', inputAmount: 0, outputAmount: 0, price: 0, feeUsdc: 0, error: 'Agent not found' };
  }

  try {
    const connection = getConnection();
    const owner = getKeypair();
    const pabMint = new PublicKey(process.env.PAB_MINT_ADDRESS || '');
    const usdcMint = new PublicKey(USDC_MINT);

    // Determine trade direction (alternate or random)
    const direction = shouldBuy(agent) ? 'buy' : 'sell';

    // Calculate trade amount
    const config = getAgentConfig(agentId);
    const tradeAmountUsdc = randomBetween(
      config?.minTradeAmountUsdc || 0.10,
      config?.maxTradeAmountUsdc || 0.50
    );

    // Get current price
    const poolInfo = await raydiumPoolService.getPoolInfo();
    const currentPrice = poolInfo.price || 0.01;

    let inputAmount: number;
    let outputAmount: number;

    if (direction === 'buy') {
      // Buying PAB with USDC
      inputAmount = tradeAmountUsdc;
      outputAmount = inputAmount / currentPrice; // PAB received
    } else {
      // Selling PAB for USDC
      outputAmount = tradeAmountUsdc;
      inputAmount = outputAmount / currentPrice; // PAB spent
    }

    // Check balance
    const platformUsdcAta = await getAssociatedTokenAddress(usdcMint, owner.publicKey);
    const platformPabAta = await getAssociatedTokenAddress(pabMint, owner.publicKey);

    let usdcBalance = 0;
    let pabBalance = 0;

    try {
      const usdcAccount = await getAccount(connection, platformUsdcAta);
      usdcBalance = Number(usdcAccount.amount) / Math.pow(10, USDC_DECIMALS);
    } catch {}

    try {
      const pabAccount = await getAccount(connection, platformPabAta);
      pabBalance = Number(pabAccount.amount) / Math.pow(10, TOKEN_DECIMALS);
    } catch {}

    // Check if we have enough balance
    if (direction === 'buy' && usdcBalance < inputAmount) {
      return { success: false, agentId, direction, inputAmount: 0, outputAmount: 0, price: currentPrice, feeUsdc: 0, error: 'Insufficient USDC balance' };
    }
    if (direction === 'sell' && pabBalance < inputAmount) {
      return { success: false, agentId, direction, inputAmount: 0, outputAmount: 0, price: currentPrice, feeUsdc: 0, error: 'Insufficient PAB balance' };
    }

    // Execute swap
    const swapResult = await raydiumPoolService.executeSwap({
      direction,
      amount: inputAmount,
      slippage: config?.maxSlippagePercent || 2,
    });

    // Calculate fee (0.25% of trade value in USDC)
    const feeUsdc = tradeAmountUsdc * 0.0025;

    // Update agent state
    agent.totalTrades++;
    agent.totalVolumeUsd += tradeAmountUsdc;
    agent.totalFeesPaid += feeUsdc;
    agent.lastTradeAt = new Date().toISOString();
    agent.lastTradeDirection = direction;
    agent.lastTradeAmount = inputAmount;
    agent.lastTradePrice = currentPrice;

    // Update PnL (simplified: sells are profitable if price went up)
    if (direction === 'sell') {
      agent.pnl += outputAmount - inputAmount * currentPrice;
    }

    console.log(`[AgentTrader] Trade executed: ${direction} ${inputAmount.toFixed(4)} -> ${outputAmount.toFixed(4)} | Fee: ${feeUsdc.toFixed(6)} USDC`);

    return {
      success: swapResult.success,
      agentId,
      direction,
      inputAmount,
      outputAmount,
      price: currentPrice,
      feeUsdc,
      txSignature: swapResult.txSignature,
      error: swapResult.error,
    };
  } catch (err: any) {
    console.error(`[AgentTrader] Trade failed for ${agent.name}:`, err.message);
    return {
      success: false,
      agentId,
      direction: 'buy',
      inputAmount: 0,
      outputAmount: 0,
      price: 0,
      feeUsdc: 0,
      error: err.message,
    };
  }
}

/**
 * Determine if agent should buy or sell based on price history
 * Simple strategy: random with slight mean reversion tendency
 */
function shouldBuy(agent: AgentState): boolean {
  // Random 50/50 for now (generates volume regardless of direction)
  return Math.random() > 0.5;
}

/**
 * Get random number between min and max
 */
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Get agent state
 */
export function getAgentState(agentId: string): AgentState | undefined {
  return agents.get(agentId);
}

/**
 * Get all agent states
 */
export function getAllAgentStates(): AgentState[] {
  return Array.from(agents.values());
}

/**
 * Get total trading stats across all agents
 */
export function getTotalStats(): {
  totalTrades: number;
  totalVolumeUsd: number;
  totalFeesUsdc: number;
  totalPlatformRevenue: number;
  activeAgents: number;
} {
  const allAgents = getAllAgentStates();
  const totalTrades = allAgents.reduce((sum, a) => sum + a.totalTrades, 0);
  const totalVolume = allAgents.reduce((sum, a) => sum + a.totalVolumeUsd, 0);
  const totalFees = allAgents.reduce((sum, a) => sum + a.totalFeesPaid, 0);

  return {
    totalTrades,
    totalVolumeUsd: totalVolume,
    totalFeesUsdc: totalFees,
    totalPlatformRevenue: totalFees * 0.10, // 10% platform fee
    activeAgents: allAgents.filter(a => a.status === 'running').length,
  };
}

/**
 * Start the default trading agents (called on server startup)
 */
export function startDefaultAgents(): void {
  // Create and start multiple agents for volume generation
  const agentConfigs = [
    { id: 'agent-alpha', name: 'Alpha', tradeIntervalMs: 30000 },
    { id: 'agent-beta', name: 'Beta', tradeIntervalMs: 45000 },
    { id: 'agent-gamma', name: 'Gamma', tradeIntervalMs: 60000 },
  ];

  for (const config of agentConfigs) {
    createAgent(config);
    startAgent(config.id);
  }

  console.log(`[AgentTrader] Started ${agentConfigs.length} default trading agents`);
}

export const agentTraderService = {
  createAgent,
  startAgent,
  pauseAgent,
  stopAgent,
  executeTrade,
  getAgentState,
  getAllAgentStates,
  getTotalStats,
  startDefaultAgents,
};
