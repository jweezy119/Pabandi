export interface StakingPosition {
    id: string;
    amount: number;
    currency: string;
    apy: number;
    validatorType: 'INSTITUTIONAL' | 'RETAIL_POOL';
    status: 'STAKING' | 'UNSTAKING' | 'REPATRIATED';
    yieldEarned: number;
}
export declare class YieldService {
    /**
     * Validation-as-a-Service (VaaS) Orchestration.
     * Takes idle escrow deposits (e.g. USDC) and routes them into liquid staking
     * protocols on Solana (e.g. Jito, Marinade) to generate yield while
     * preserving liquidity for refunds/payouts.
     */
    orchestrateStaking(amount: number, currency: string, tier?: 'INSTITUTIONAL' | 'RETAIL'): Promise<StakingPosition>;
    /**
     * Simulates calculating and sweeping accumulated yield.
     */
    sweepYield(position: StakingPosition): Promise<number>;
}
export declare const yieldService: YieldService;
//# sourceMappingURL=yield.service.d.ts.map