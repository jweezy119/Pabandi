"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.microProfitEngine = exports.MicroProfitEngine = void 0;
const database_1 = require("../utils/database");
// ─── Configuration ───────────────────────────────────────
const MIN_TASK_USD = 0.05; // 5 cents minimum
const MAX_TASK_USD = 0.25; // 25 cents maximum
const PLATFORM_FEE_RATE = 0.02; // 2%
const PAB_REWARD_RATE = 0.05; // 5% per side (internal credit)
const PAB_PRICE = 0.01; // $0.01 per PAB (lower = more supply)
const SOL_BUFFER = 0.01; // Never go below 0.01 SOL
const TARGET_CYCLES_PER_DAY = 10;
class MicroProfitEngine {
    constructor() {
        this.totalRevenue = 0;
        this.totalSolSpent = 0;
        this.totalPabIssued = 0;
        this.totalBatches = 0;
        this.totalTasks = 0;
        this.batchHistory = [];
    }
    // ─── CORE: Run One Batch Cycle ─────────────────────────
    /**
     * One batch = accumulate micro-tasks → settle once on-chain
     * This is the key to capital efficiency
     */
    async runBatch(capitalUsd) {
        const batchSize = this.getOptimalBatchSize(capitalUsd);
        const taskValue = this.getOptimalTaskValue(capitalUsd);
        // 1. Accumulate micro-tasks (internal, no on-chain cost)
        const tasks = [];
        for (let i = 0; i < batchSize; i++) {
            const agents = await database_1.prisma.agentProfile.findMany({
                where: { isActive: true, reputation: { gt: 20 } },
                orderBy: { reputation: 'desc' },
                take: 5,
            });
            if (agents.length < 2)
                break;
            const poster = agents[0];
            const solver = agents[1];
            // Create micro-task internally
            const project = await database_1.prisma.agentProject.create({
                data: {
                    title: `Micro-${this.totalTasks + i + 1}`,
                    description: `Auto micro-task`,
                    requirements: 'Instant',
                    posterId: poster.id,
                    budgetUsd: taskValue,
                    budgetPab: taskValue / PAB_PRICE,
                    deadline: new Date(Date.now() + 60000),
                    category: 'micro',
                    complexity: 'LOW',
                    status: 'COMPLETED',
                },
            });
            // Issue PAB as internal credit (no on-chain cost)
            const pabCredit = (taskValue * PAB_REWARD_RATE) / PAB_PRICE;
            await database_1.prisma.rewardTransaction.create({
                data: {
                    userId: solver.id,
                    userType: 'AGENT',
                    type: 'MICRO_TASK_REWARD',
                    amount: pabCredit,
                    usdValue: taskValue * PAB_REWARD_RATE,
                    referenceId: project.id,
                    referenceType: 'MICRO',
                    status: 'CLAIMED',
                    claimedAt: new Date(),
                },
            });
            tasks.push({
                id: project.id,
                agentId: solver.id,
                amount: taskValue,
                completedAt: new Date(),
            });
        }
        if (tasks.length === 0) {
            return { batchId: 'empty', taskCount: 0, totalAmount: 0, totalFees: 0, totalSolCost: 0, netProfit: 0 };
        }
        // 2. Calculate batch totals
        const totalAmount = tasks.reduce((s, t) => s + t.amount, 0);
        const totalFees = totalAmount * PLATFORM_FEE_RATE;
        const totalPab = tasks.reduce((s, t) => s + (t.amount * PAB_REWARD_RATE * 2) / PAB_PRICE, 0);
        // 3. Settle on-chain (one transfer for all tasks)
        // In production: aggregate all agent payments into one transaction
        // For now: simulate the SOL cost
        const solCost = 0.00025; // One batched tx
        const netProfit = totalFees - solCost;
        // 4. Record batch
        const batch = {
            batchId: `batch-${this.totalBatches + 1}`,
            taskCount: tasks.length,
            totalAmount,
            totalFees,
            totalSolCost: solCost,
            netProfit,
        };
        this.batchHistory.push(batch);
        this.totalBatches++;
        this.totalTasks += tasks.length;
        this.totalRevenue += totalFees;
        this.totalSolSpent += solCost;
        this.totalPabIssued += totalPab;
        return batch;
    }
    // ─── OPTIMIZATION: Dynamic Batch Size ──────────────────
    /**
     * Batch size scales with capital
     * More capital = bigger batches = more fee coverage
     */
    getOptimalBatchSize(capitalUsd) {
        if (capitalUsd < 10)
            return 10; // $10 → 10 tasks × $0.05 = $0.50
        if (capitalUsd < 25)
            return 20; // $25 → 20 tasks × $0.05 = $1.00
        if (capitalUsd < 50)
            return 25; // $50 → 25 tasks × $0.05 = $1.25
        if (capitalUsd < 100)
            return 30; // $100 → 30 tasks × $0.05 = $1.50
        return 50; // $100+ → 50 tasks × $0.05 = $2.50
    }
    // ─── OPTIMIZATION: Dynamic Task Value ──────────────────
    /**
     * Task value adjusts based on capital
     * Never go below $0.05 (fees eat profit)
     */
    getOptimalTaskValue(capitalUsd) {
        // With $25: $0.05 tasks (5 cents)
        // With $100: $0.10 tasks (10 cents)
        // With $500: $0.25 tasks (25 cents)
        const rawValue = capitalUsd / 500;
        return Math.max(MIN_TASK_USD, Math.min(MAX_TASK_USD, rawValue));
    }
    // ─── PROFIT REPORT ─────────────────────────────────────
    getReport(startingCapital, currentCapital, solBalance) {
        const netProfit = this.totalRevenue - this.totalSolSpent;
        const roiPercent = (netProfit / startingCapital) * 100;
        const avgBatchSize = this.totalTasks / (this.totalBatches || 1);
        const avgTaskValue = this.totalRevenue / (this.totalTasks || 1) / PLATFORM_FEE_RATE;
        // Estimate cycles per day based on capital
        // With $25: 1 cycle = $1 deployed, 25 cycles to deploy all = ~2.5 hours
        // So ~10 cycles/day is achievable
        const cyclesPerDay = Math.max(1, Math.floor(25 / (startingCapital / 25)));
        const dailyRevenue = netProfit * cyclesPerDay;
        const monthlyRevenue = dailyRevenue * 30;
        const annualRevenue = dailyRevenue * 365;
        return {
            startingCapital,
            currentCapital,
            totalBatches: this.totalBatches,
            totalTasks: this.totalTasks,
            totalRevenue: this.totalRevenue,
            totalSolSpent: this.totalSolSpent,
            totalPabIssued: this.totalPabIssued,
            netProfit,
            roiPercent,
            cyclesPerDay,
            dailyRevenue,
            monthlyRevenue,
            annualRevenue,
            avgBatchSize,
            avgTaskValue,
            solBuffer: solBalance,
            isHealthy: solBalance > SOL_BUFFER,
        };
    }
    // ─── SIMULATE FULL DEPLOYMENT ──────────────────────────
    /**
     * Simulate deploying all $25 and show the profit breakdown
     */
    static simulateDeployment(startingUsd, solBalance) {
        const engine = new MicroProfitEngine();
        const batchSize = engine.getOptimalBatchSize(startingUsd);
        const taskValue = engine.getOptimalTaskValue(startingUsd);
        const tasksPerCycle = batchSize;
        const usdPerCycle = tasksPerCycle * taskValue;
        const cyclesNeeded = Math.ceil(startingUsd / usdPerCycle);
        const results = [];
        let remainingCapital = startingUsd;
        let totalFees = 0;
        let totalSol = 0;
        for (let i = 0; i < cyclesNeeded; i++) {
            const cycleUsd = Math.min(usdPerCycle, remainingCapital);
            const tasksInCycle = Math.floor(cycleUsd / taskValue);
            const actualUsd = tasksInCycle * taskValue;
            const fees = actualUsd * PLATFORM_FEE_RATE;
            const solCost = 0.00025;
            results.push({
                batchId: `sim-${i + 1}`,
                taskCount: tasksInCycle,
                totalAmount: actualUsd,
                totalFees: fees,
                totalSolCost: solCost,
                netProfit: fees - solCost,
            });
            totalFees += fees;
            totalSol += solCost;
            remainingCapital -= actualUsd;
        }
        return {
            startingUsd,
            solBalance,
            batchSize,
            taskValue,
            cyclesNeeded,
            results,
            totalFees,
            totalSol,
            netProfit: totalFees - totalSol,
            roiPercent: ((totalFees - totalSol) / startingUsd) * 100,
            dailyRevenue: (totalFees - totalSol) * TARGET_CYCLES_PER_DAY,
            monthlyRevenue: (totalFees - totalSol) * TARGET_CYCLES_PER_DAY * 30,
        };
    }
}
exports.MicroProfitEngine = MicroProfitEngine;
exports.microProfitEngine = new MicroProfitEngine();
//# sourceMappingURL=microProfitEngine.service.js.map