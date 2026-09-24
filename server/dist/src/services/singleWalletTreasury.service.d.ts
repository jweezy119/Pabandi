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
export type WalletBucket = 'OPERATING' | 'AGENT_ESCROW' | 'PLATFORM_REV' | 'YIELD' | 'RESERVE';
export declare class SingleWalletTreasury {
    private platformWalletAddress;
    constructor();
    /**
     * Record incoming funds to the platform wallet.
     * You send USDC/SOL to the platform address.
     * System records it as OPERATING capital.
     */
    fundWallet(params: {
        amountUsd: number;
        txHash?: string;
        note?: string;
    }): Promise<{
        success: boolean;
        recordId: string;
        newBalance: number;
    }>;
    /**
     * Release funds from escrow to agent after project completion.
     * Platform fee is deducted BEFORE disbursement.
     */
    disburseToAgent(params: {
        agentId: string;
        projectId: string;
        amountUsd: number;
        platformFeeUsd: number;
        txHash?: string;
    }): Promise<{
        success: boolean;
        disbursed: number;
        fee: number;
    }>;
    /**
     * All platform revenue flows back into the same wallet.
     * This is called automatically when fees are collected.
     */
    collectRevenue(params: {
        amountUsd: number;
        source: 'AGENT_FEES' | 'ARBITRAGE' | 'YIELD' | 'REFERRAL';
        referenceId?: string;
        txHash?: string;
    }): Promise<{
        success: boolean;
        recordId: string;
    }>;
    /**
     * When a project is funded, move from OPERATING → AGENT_ESCROW
     */
    lockInEscrow(params: {
        projectId: string;
        agentId: string;
        amountUsd: number;
    }): Promise<{
        success: boolean;
        locked: number;
    }>;
    /**
     * When project completes, move from AGENT_ESCROW → agent + revenue
     * (This is what disburseToAgent does, but separated for clarity)
     */
    releaseFromEscrow(params: {
        projectId: string;
        agentId: string;
        amountUsd: number;
        platformFeeUsd: number;
        txHash?: string;
    }): Promise<{
        success: boolean;
        disbursed: number;
        fee: number;
    }>;
    /**
     * Optional: move % of revenue to reserve/emergency fund
     */
    allocateToReserve(params: {
        amountUsd: number;
        txHash?: string;
    }): Promise<{
        success: boolean;
        allocated: number;
    }>;
    getBucketBalance(bucket: WalletBucket): Promise<number>;
    getFullBreakdown(): Promise<{
        operating: number;
        agentEscrow: number;
        platformRevenue: number;
        yield: number;
        reserve: number;
        total: number;
    }>;
    /**
     * Move platform revenue back into OPERATING for more agent funding.
     * This is the key to velocity: profits don't sit idle.
     */
    recycleProfitsToOperating(params: {
        amountUsd: number;
        txHash?: string;
    }): Promise<{
        success: boolean;
        recycled: number;
    }>;
    getPlatformWalletAddress(): string;
}
export declare const singleWalletTreasury: SingleWalletTreasury;
//# sourceMappingURL=singleWalletTreasury.service.d.ts.map