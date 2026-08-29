interface AgentLoopState {
    running: boolean;
    live: boolean;
    lastCycleAt: Date | null;
    lastPoolFeeAt: Date | null;
    totalBookings: number;
    totalFeesCollected: number;
    totalSolFeesCollected: number;
    totalBadgePurchases: number;
}
/**
 * Run one cycle of the AI agent loop:
 * 1. Badge purchases (simulated — agents buy badges from treasury)
 * 2. Bookings (agents pay other agents for services)
 * 3. Pool fee collection (arbitrage fees from USDC/PAB pool)
 */
export declare function runAgentLoopCycle(): Promise<{
    bookings: number;
    feesCollected: number;
    solFeesCollected: number;
    badgePurchases: number;
    errors: string[];
}>;
/**
 * Start the agent loop — runs on a recurring interval.
 */
export declare function startAgentLoop(): void;
/**
 * Stop the agent loop.
 */
export declare function stopAgentLoop(): void;
/**
 * Prepare LIVE booking rails (pre-create agent ATAs + fund SOL for tx fees).
 * Calls web3AgentService.prepareLiveBookingRails. Safe to call once before
 * enabling LIVE_BOOKINGS=true. Returns SOL spent so the operator can verify budget.
 */
export declare function prepareLiveRails(opts?: {
    solBudget?: number;
    perAgentSol?: number;
}): Promise<{
    prepared: number;
    fundedSol: number;
    ataCreated: number;
    solSpent: number;
    error?: string;
}>;
/**
 * Get current agent loop state.
 */
export declare function getAgentLoopState(): AgentLoopState;
/**
 * Loud self-check of the live on-chain rail. Returns a clear status so operators
 * can see at a glance what is armed vs missing — the loop fails SILENTLY otherwise.
 */
export declare function getAgentLoopHealth(): Promise<{
    liveMode: boolean;
    solanaPrivateKeySet: boolean;
    treasuryWalletSet: boolean;
    feeWalletSet: boolean;
    oracleKeySet: boolean;
    agentsLoaded: number;
    agentsPrepared: number;
    ready: boolean;
    warnings: string[];
}>;
/**
 * Reset daily counters for all agents (call at midnight UTC).
 */
export declare function resetAllDailyCounters(): Promise<void>;
export {};
//# sourceMappingURL=agentLoop.service.d.ts.map