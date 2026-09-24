export interface PabondMintParams {
    userId: string;
    amountUSD: number;
    source: 'BOOKING_DEPOSIT' | 'POSITIVE_REVIEW' | 'ARBITRATION_WIN' | 'STAKING_REWARD';
    metadata?: Record<string, any>;
}
export interface PabondResult {
    success: boolean;
    userId: string;
    amountUSD: number;
    pabTokens: number;
    pricePerPAB: number;
    velocity: number;
    velocityMultiplier: number;
    velocityBonus: number;
    totalSupply: number;
    reserveUSD: number;
    effectiveApr: number;
    txHash?: string;
    error?: string;
}
export declare class PabondService {
    private reserveUSD;
    private totalSupplyPAB;
    constructor();
    /** Get current PAB price in USD (before velocity adjustment) */
    getCurrentPrice(): number;
    /**
     * Mint $PAB via the bonding curve.
     * Uses TrustFlux velocity to compute a multiplier that makes
     * rising-trust users pay less and declining-trust users pay more.
     */
    mint(params: PabondMintParams): Promise<PabondResult>;
    /**
     * Burn $PAB to reduce reserve (e.g., for redemption or fee payment).
     * Burn ratio = pabTokens / supply → returns proportional reserve share.
     */
    burn(userId: string, pabAmount: number): Promise<{
        success: boolean;
        usdReturn: number;
    }>;
    /** Compute implied APR from velocity trend. Positive velocity = higher future rewards. */
    private computeEffectiveApr;
    /**
     * AMM-style batch redemption: burn $PAB to get proportional reserve share.
     * Batch processing with yield claim (accumulated fees from curve trades).
     */
    batchRedeem(userId: string, pabAmount: number): Promise<{
        success: boolean;
        usdReturn: number;
        yield: number;
    }>;
    /**
     * Compute comprehensive Pabond statistics for dashboards.
     * Returns current price, APY, TVL, daily volume, top 10 velocity leaders.
     */
    getStats(): Promise<{
        pricePerPAB: number;
        apy: number;
        tvl: number;
        dailyVolume: number;
        totalSupply: number;
        topVelocityLeaders: Array<{
            userId: string;
            velocity: number;
            pabBalance: number;
        }>;
    }>;
    /**
     * Compute daily reward rate for velocity bonus.
     * Users with velocity > 0.5 get a 10% bonus on minted $PAB.
     */
    private getVelocityBonus;
    /**
     * Load persisted state from DB */
    private loadState;
    /** Save current state to DB */
    private saveState;
}
export declare const pabondService: PabondService;
//# sourceMappingURL=pabond.service.d.ts.map