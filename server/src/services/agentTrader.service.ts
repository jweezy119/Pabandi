/**
 * agentTrader.service.ts — Agent Trading Loop
 * 
 * Agents continuously buy/sell PAB to generate volume.
 * Trading fees (0.25%) accrue to LP.
 * Auto-compounds fees back into LP.
 * Platform takes 10% of LP earnings.
 */
import { buyPAB, sellPAB, getPoolInfo } from './raydiumPool.service';

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
  pnl: number;
}

export class AgentTrader {
  private agents: Map<string, AgentConfig> = new Map();
  private states: Map<string, AgentState> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  createAgent(config: AgentConfig): AgentConfig {
    this.agents.set(config.id, config);
    this.states.set(config.id, {
      id: config.id,
      name: config.name,
      status: 'stopped',
      totalTrades: 0,
      totalVolumeUsd: 0,
      totalFeesPaid: 0,
      totalProfit: 0,
      pnl: 0,
    });
    return config;
  }

  startAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    agent.enabled = true;
    this.states.get(agentId)!.status = 'running';
    
    const interval = setInterval(async () => {
      await this.executeTrade(agentId);
    }, agent.tradeIntervalMs);
    
    this.intervals.set(agentId, interval);
    return true;
  }

  pauseAgent(agentId: string): boolean {
    const interval = this.intervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(agentId);
    }
    const state = this.states.get(agentId);
    if (state) state.status = 'paused';
    return true;
  }

  stopAgent(agentId: string): boolean {
    const interval = this.intervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(agentId);
    }
    const state = this.states.get(agentId);
    if (state) state.status = 'stopped';
    return true;
  }

  async executeTrade(agentId: string): Promise<{ success: boolean; error?: string }> {
    const agent = this.agents.get(agentId);
    const state = this.states.get(agentId);
    if (!agent || !state) return { success: false, error: 'Agent not found' };

    try {
      // Alternate between buy and sell
      const direction = state.totalTrades % 2 === 0 ? 'buy' : 'sell';
      const amount = Math.random() * (agent.maxTradeAmountUsdc - agent.minTradeAmountUsdc) + agent.minTradeAmountUsdc;
      
      // Use the agent's wallet address from database
      const { prisma } = await import('../utils/database');
      const agentProfile = await prisma.agentProfile.findUnique({ where: { id: agentId } });
      if (!agentProfile) return { success: false, error: 'Agent profile not found' };
      
      const result = direction === 'buy'
        ? await buyPAB(agentProfile.walletAddress, amount)
        : await sellPAB(agentProfile.walletAddress, amount);

      if (result.success) {
        state.totalTrades++;
        state.totalVolumeUsd += amount;
        state.lastTradeAt = new Date().toISOString();
        state.lastTradeDirection = direction;
        state.lastTradeAmount = amount;
      }

      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  getState(agentId: string): AgentState | undefined {
    return this.states.get(agentId);
  }

  getAllStates(): AgentState[] {
    return Array.from(this.states.values());
  }
}

export const agentTrader = new AgentTrader();
