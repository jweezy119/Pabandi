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
export declare class AgentTrader {
    private agents;
    private states;
    private intervals;
    createAgent(config: AgentConfig): AgentConfig;
    startAgent(agentId: string): boolean;
    pauseAgent(agentId: string): boolean;
    stopAgent(agentId: string): boolean;
    executeTrade(agentId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getState(agentId: string): AgentState | undefined;
    getAllStates(): AgentState[];
}
export declare const agentTrader: AgentTrader;
//# sourceMappingURL=agentTrader.service.d.ts.map