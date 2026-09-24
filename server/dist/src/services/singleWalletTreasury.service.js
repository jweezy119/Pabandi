"use strict";
/**
 * Pabandi Single-Wallet Treasury System
 * =====================================
 *
 * THE MODEL:
 * =========
 * You fund ONE wallet (platform master wallet).
 * The system tracks all disbursements and collections internally.
 * No need to fund multiple wallets — the platform wallet is the single source of truth.
 *
 * FLOW:
 * =====
 *
 * 1. FUNDING (You → Platform Wallet)
 *    You send USDC/SOL to the platform wallet address.
 *    System records: +$X to OPERATING bucket.
 *
 * 2. DISBURSEMENT (Platform Wallet → Agents / Expenses)
 *    Agent completes work → funds released from escrow.
 *    Platform fee (2%) is deducted BEFORE disbursement.
 *    System records: -$X to AGENT_PAYMENTS, +$Y to PLATFORM_REVENUE.
 *
 * 3. COLLECTION (Back to Platform Wallet)
 *    All platform fees, yield, and arbitrage profits flow back.
 *    System records: +$X to TREASURY bucket.
 *
 * 4. RECYCLING (Same wallet cycles)
 *    Profits stay in the wallet → fund more agent projects → earn more fees.
 *
 * THE MATH:
 * =========
 * $100 funded → $5 disbursed to agents (5 micro-tasks at $1 each)
 *                $0.10 platform fee collected (2% of $5)
 *                $95.90 remains in wallet
 *                Cycle repeats with remaining balance
 *
 * WALLET BREAKDOWN:
 * ================
 *
 * Platform Wallet (your Phantom)
 * ├── OPERATING    — funds available for agent projects
 * ├── TREASURY     — platform revenue collected
 * ├── AGENT_ESCROW — funds locked in active projects
 * ├── YIELD        — DeFi yield earned on idle capital
 * └── RESERVE      — emergency fund (5% of total)
 *
 * Every transaction is recorded in TreasuryPosition for full audit trail.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleWalletTreasury = exports.SingleWalletTreasury = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
// ─── Single Wallet Treasury ──────────────────────────────
class SingleWalletTreasury {
    constructor() {
        // The single platform wallet (your Phantom or dedicated platform address)
        this.platformWalletAddress = process.env.PLATFORM_WALLET_ADDRESS || '';
    }
    // ─── 1. FUND THE WALLET ──────────────────────────────
    /**
     * Record incoming funds to the platform wallet.
     * You send USDC/SOL to the platform address.
     * System records it as OPERATING capital.
     */
    async fundWallet(params) {
        const { amountUsd, txHash, note } = params;
        const record = await database_1.prisma.treasuryPosition.create({
            data: {
                bucket: 'OPERATING',
                amount: amountUsd,
                txHash: txHash || null,
                status: 'CONFIRMED',
                meta: { note: note || 'Platform funding', direction: 'INFLOW' },
            },
        });
        logger_1.logger.info(`[Treasury] Wallet funded: $${amountUsd}`, { txHash, note });
        return { success: true, recordId: record.id, newBalance: await this.getBucketBalance('OPERATING') };
    }
    // ─── 2. DISBURSE TO AGENT ────────────────────────────
    /**
     * Release funds from escrow to agent after project completion.
     * Platform fee is deducted BEFORE disbursement.
     */
    async disburseToAgent(params) {
        const { agentId, projectId, amountUsd, platformFeeUsd, txHash } = params;
        const disburseAmount = amountUsd - platformFeeUsd;
        // Move from AGENT_ESCROW → out to agent + platform revenue
        await database_1.prisma.$transaction([
            // Reduce escrow
            database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'AGENT_ESCROW',
                    amount: -amountUsd,
                    txHash: txHash || null,
                    status: 'CONFIRMED',
                    meta: { agentId, projectId, direction: 'OUTCOME_AGENT_PAYMENT' },
                },
            }),
            // Platform revenue
            database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'PLATFORM_REV',
                    amount: platformFeeUsd,
                    txHash: txHash || null,
                    status: 'CONFIRMED',
                    meta: { agentId, projectId, direction: 'INFLOW_FEE' },
                },
            }),
        ]);
        logger_1.logger.info(`[Treasury] Disbursed $${disburseAmount.toFixed(4)} to agent (fee: $${platformFeeUsd.toFixed(4)})`, { agentId, projectId });
        return { success: true, disbursed: disburseAmount, fee: platformFeeUsd };
    }
    // ─── 3. COLLECT REVENUE ──────────────────────────────
    /**
     * All platform revenue flows back into the same wallet.
     * This is called automatically when fees are collected.
     */
    async collectRevenue(params) {
        const { amountUsd, source, referenceId, txHash } = params;
        const record = await database_1.prisma.treasuryPosition.create({
            data: {
                bucket: source === 'YIELD' ? 'YIELD' : 'PLATFORM_REV',
                amount: amountUsd,
                txHash: txHash || null,
                status: 'CONFIRMED',
                meta: { source, referenceId, direction: 'INFLOW' },
            },
        });
        logger_1.logger.info(`[Treasury] Revenue collected: $${amountUsd.toFixed(4)} from ${source}`, { referenceId });
        return { success: true, recordId: record.id };
    }
    // ─── 4. LOCK FUNDS IN ESCROW ─────────────────────────
    /**
     * When a project is funded, move from OPERATING → AGENT_ESCROW
     */
    async lockInEscrow(params) {
        const { projectId, agentId, amountUsd } = params;
        await database_1.prisma.$transaction([
            database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'OPERATING',
                    amount: -amountUsd,
                    status: 'CONFIRMED',
                    meta: { projectId, agentId, direction: 'OUTFLOW_ESCROW' },
                },
            }),
            database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'AGENT_ESCROW',
                    amount: amountUsd,
                    status: 'CONFIRMED',
                    meta: { projectId, agentId, direction: 'INFLOW_ESCROW' },
                },
            }),
        ]);
        return { success: true, locked: amountUsd };
    }
    // ─── 5. RELEASE FROM ESCROW ──────────────────────────
    /**
     * When project completes, move from AGENT_ESCROW → agent + revenue
     * (This is what disburseToAgent does, but separated for clarity)
     */
    async releaseFromEscrow(params) {
        return this.disburseToAgent(params);
    }
    // ─── 6. MOVE TO RESERVE ──────────────────────────────
    /**
     * Optional: move % of revenue to reserve/emergency fund
     */
    async allocateToReserve(params) {
        const { amountUsd, txHash } = params;
        await database_1.prisma.$transaction([
            database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'PLATFORM_REV',
                    amount: -amountUsd,
                    status: 'CONFIRMED',
                    meta: { direction: 'OUTFLOW_RESERVE' },
                },
            }),
            database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'RESERVE',
                    amount: amountUsd,
                    txHash: txHash || null,
                    status: 'CONFIRMED',
                    meta: { direction: 'INFLOW_RESERVE' },
                },
            }),
        ]);
        return { success: true, allocated: amountUsd };
    }
    // ─── BALANCE QUERIES ─────────────────────────────────
    async getBucketBalance(bucket) {
        const result = await database_1.prisma.treasuryPosition.aggregate({
            where: { bucket, status: 'CONFIRMED' },
            _sum: { amount: true },
        });
        return result._sum.amount || 0;
    }
    async getFullBreakdown() {
        const [operating, agentEscrow, platformRevenue, yieldBal, reserve] = await Promise.all([
            this.getBucketBalance('OPERATING'),
            this.getBucketBalance('AGENT_ESCROW'),
            this.getBucketBalance('PLATFORM_REV'),
            this.getBucketBalance('YIELD'),
            this.getBucketBalance('RESERVE'),
        ]);
        return {
            operating,
            agentEscrow,
            platformRevenue,
            yield: yieldBal,
            reserve,
            total: operating + agentEscrow + platformRevenue + yieldBal + reserve,
        };
    }
    // ─── RECYCLE PROFITS ─────────────────────────────────
    /**
     * Move platform revenue back into OPERATING for more agent funding.
     * This is the key to velocity: profits don't sit idle.
     */
    async recycleProfitsToOperating(params) {
        const { amountUsd, txHash } = params;
        await database_1.prisma.$transaction([
            database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'PLATFORM_REV',
                    amount: -amountUsd,
                    status: 'CONFIRMED',
                    meta: { direction: 'OUTFLOW_RECYCLE' },
                },
            }),
            database_1.prisma.treasuryPosition.create({
                data: {
                    bucket: 'OPERATING',
                    amount: amountUsd,
                    txHash: txHash || null,
                    status: 'CONFIRMED',
                    meta: { direction: 'INFLOW_RECYCLE' },
                },
            }),
        ]);
        logger_1.logger.info(`[Treasury] Recycled $${amountUsd.toFixed(4)} from revenue back to operating`);
        return { success: true, recycled: amountUsd };
    }
    // ─── GET ADDRESS ─────────────────────────────────────
    getPlatformWalletAddress() {
        return this.platformWalletAddress;
    }
}
exports.SingleWalletTreasury = SingleWalletTreasury;
exports.singleWalletTreasury = new SingleWalletTreasury();
//# sourceMappingURL=singleWalletTreasury.service.js.map