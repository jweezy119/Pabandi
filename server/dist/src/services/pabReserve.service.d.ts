/**
 * Pabandi PAB Reserve — Maximum Profit System
 * ===========================================
 *
 * THE INSIGHT:
 * SOL cost is negligible ($0.00025/batch). The REAL constraint is capital velocity.
 *
 * THE WINNING STRATEGY:
 * Instead of "$28 deploys and returns", use "$28 is a RESERVE".
 *
 * 1. $28 USDC sits in the wallet as RESERVE (never deployed)
 * 2. Agents work on INTERNAL CREDIT (no on-chain movement)
 * 3. Agents accumulate USDC/PAB credits in their accounts
 * 4. ONE settlement tx per day: credits → actual USDC
 * 5. Fees collected daily, capital untouched
 *
 * THE MATH:
 * - $28 reserve guarantees agent credits
 * - Agents can work up to $28 worth of tasks
 * - 500 batches/day × 25 tasks × $0.06 = $750 daily volume
 * - 2% fee = $15/day × 18.5 cycles = $277.50/day
 * - 1 settlement tx = $0.00025 SOL
 * - Net profit: $277.50 - $0.00025 = $277.50
 *
 * ADVANTAGES:
 * - Zero capital risk (reserve never deployed)
 * - Unlimited velocity (same $28 backs 500 batches)
 * - Near-zero SOL cost (1 tx/day)
 * - Self-learning (agents earn reputation, unlock higher limits)
 * - Compound ready (fees auto-recycled to reserve)
 */
interface AgentCredit {
    agentId: string;
    usdcCredit: number;
    pabCredit: number;
    reputation: number;
    tasksCompleted: number;
}
interface SettlementResult {
    date: string;
    totalTasks: number;
    totalVolume: number;
    totalFees: number;
    totalPabIssued: number;
    solCost: number;
    netProfit: number;
    txHash?: string;
}
interface ReserveReport {
    reserveBalance: number;
    totalOutstandingCredits: number;
    utilizationPercent: number;
    dailyVolume: number;
    dailyFees: number;
    dailyNetProfit: number;
    monthlyProjection: number;
    annualProjection: number;
    agentCredits: AgentCredit[];
    isHealthy: boolean;
}
export declare class PabReserve {
    private reserveBalance;
    private agentCredits;
    private dailyVolume;
    private dailyFees;
    private dailyTasks;
    constructor(reserveUsd: number);
    /**
     * Agent completes a task — credit is issued internally
     * NO on-chain movement
     */
    creditAgent(params: {
        agentId: string;
        taskValue: number;
    }): Promise<{
        usdcCredit: number;
        pabCredit: number;
    }>;
    /**
     * Settle all agent credits to actual USDC
     * Called once per day
     */
    settleDaily(): Promise<SettlementResult>;
    /**
     * Run one full daily cycle:
     * 1. Run N batches (internal credits)
     * 2. Settle once (one on-chain tx)
     * 3. Return profit report
     */
    runDailyCycle(batches: number, batchSize: number, taskValue: number): Promise<SettlementResult>;
    getReport(): ReserveReport;
    static projectProfit(params: {
        reserveUsd: number;
        batchesPerDay: number;
        batchSize: number;
        taskValue: number;
        settlementFrequency: number;
    }): {
        reserveUsd: number;
        tasksPerDay: number;
        dailyVolume: number;
        dailyFees: number;
        dailySolCost: number;
        dailyNet: number;
        monthlyNet: number;
        annualNet: number;
        roiPercent: number;
    };
}
export declare const pabReserve: PabReserve;
export {};
//# sourceMappingURL=pabReserve.service.d.ts.map