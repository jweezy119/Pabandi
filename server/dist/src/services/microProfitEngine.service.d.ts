/**
 * Pabandi MicroProfitEngine — $25 Starting Capital Optimizer
 * =========================================================
 *
 * THE PROBLEM WITH $25:
 * - Solana tx cost: $0.00025 per tx
 * - USDC account rent: ~$0.002 per new account
 * - Platform fee: 2%
 * - PAB rewards: 5% per side (10% total)
 * - If you do 250 × $0.10 tasks individually: $0.0625 in SOL fees
 *
 * THE SOLUTION — BATCH + ACCUMULATE + DEFER:
 * 1. MICRO-TASKS: $0.05 minimum (5 cents)
 * 2. BATCH SETTLEMENT: Accumulate 20 tasks = $1.00, then one on-chain transfer
 *    → SOL fee amortized: $0.00025 / 20 = $0.0000125 per task
 * 3. PAB AS BALANCE CREDIT: No on-chain cost until agent withdraws
 * 4. AUTO-COMPOUND: Fees flow back to operating immediately
 * 5. DYNAMIC BATCH SIZE: Scales with available capital
 *
 * THE MATH WITH $25:
 * ═══════════════════════════════════════════════════════════════
 *
 * Starting: $25.00 USDC + $0.50 SOL (for gas)
 *
 * Cycle 1 (20 micro-tasks × $0.05 = $1.00):
 *   Agent earns: $0.98 (2% fee deducted)
 *   Platform fee: $0.02
 *   SOL cost: $0.00025 (one batched tx)
 *   Net profit: $0.01975
 *   Remaining capital: $24.00 USDC + $0.49975 SOL
 *
 * After 25 cycles (all $25 deployed):
 *   Total fees collected: $0.50
 *   Total SOL spent: $0.00625
 *   Net profit: $0.49375
 *   ROI per full cycle: ~2%
 *
 * With 10 full cycles/day (compounding):
 *   Daily: $25 × 2% × 10 = $5.00
 *   Monthly: $150 (6× return on $25)
 *
 * OPTIMIZATIONS:
 * ═══════════════
 *
 * 1. BATCH_SIZE = max(10, floor(capital / 5))
 *    → With $25: batch size = 20 tasks
 *    → With $100: batch size = 20 tasks
 *    → With $50: batch size = 10 tasks
 *
 * 2. MIN_TASK = $0.05 (5 cents)
 *    → Below this, fees eat profit
 *    → 2% of $0.05 = $0.001 fee > $0.00025 SOL cost ✓
 *
 * 3. PAB_REWARDS_AS_CREDITS = true
 *    → PAB issued as internal balance, not on-chain
 *    → Agent withdraws when they want (batched)
 *    → Zero on-chain cost for rewards
 *
 * 4. AUTO_COMPOUND = true
 *    → Fees go back to operating immediately
 *    → Same $1 cycles repeatedly
 *
 * 5. SOL_BUFFER = 0.01 SOL
 *    → Never go below this
 *    → If low, pause and alert
 */
interface BatchResult {
    batchId: string;
    taskCount: number;
    totalAmount: number;
    totalFees: number;
    totalSolCost: number;
    netProfit: number;
    txHash?: string;
}
interface MicroProfitReport {
    startingCapital: number;
    currentCapital: number;
    totalBatches: number;
    totalTasks: number;
    totalRevenue: number;
    totalSolSpent: number;
    totalPabIssued: number;
    netProfit: number;
    roiPercent: number;
    cyclesPerDay: number;
    dailyRevenue: number;
    monthlyRevenue: number;
    annualRevenue: number;
    avgBatchSize: number;
    avgTaskValue: number;
    solBuffer: number;
    isHealthy: boolean;
}
export declare class MicroProfitEngine {
    private totalRevenue;
    private totalSolSpent;
    private totalPabIssued;
    private totalBatches;
    private totalTasks;
    private batchHistory;
    /**
     * One batch = accumulate micro-tasks → settle once on-chain
     * This is the key to capital efficiency
     */
    runBatch(capitalUsd: number): Promise<BatchResult>;
    /**
     * Batch size scales with capital
     * More capital = bigger batches = more fee coverage
     */
    getOptimalBatchSize(capitalUsd: number): number;
    /**
     * Task value adjusts based on capital
     * Never go below $0.05 (fees eat profit)
     */
    getOptimalTaskValue(capitalUsd: number): number;
    getReport(startingCapital: number, currentCapital: number, solBalance: number): MicroProfitReport;
    /**
     * Simulate deploying all $25 and show the profit breakdown
     */
    static simulateDeployment(startingUsd: number, solBalance: number): {
        startingUsd: number;
        solBalance: number;
        batchSize: number;
        taskValue: number;
        cyclesNeeded: number;
        results: BatchResult[];
        totalFees: number;
        totalSol: number;
        netProfit: number;
        roiPercent: number;
        dailyRevenue: number;
        monthlyRevenue: number;
    };
}
export declare const microProfitEngine: MicroProfitEngine;
export {};
//# sourceMappingURL=microProfitEngine.service.d.ts.map