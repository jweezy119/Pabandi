export interface StakePosition {
    userId: string;
    amount: number;
    tier: StakingTier;
    multiplier: number;
    totalRewarded: number;
    totalSlashed: number;
    lastRewardAt: Date | null;
}
export type StakingTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export interface StakeResult {
    success: boolean;
    userId: string;
    amount: number;
    tier: StakingTier;
    multiplier: number;
    totalStaked: number;
    estimatedDailyReward: number;
    txHash?: string;
    error?: string;
}
export interface UnstakeResult {
    success: boolean;
    userId: string;
    amount: number;
    multiplier: number;
    totalStaked: number;
    slashingPenalty: number;
    txHash?: string;
    error?: string;
}
export interface SlashResult {
    success: boolean;
    userId: string;
    reason: string;
    slashedAmount: number;
    remainingStake: number;
    newMultiplier: number;
}
export interface RewardResult {
    success: boolean;
    userId: string;
    rewardAmount: number;
    trigger: string;
    newTotalStaked: number;
    message: string;
}
export declare const STAKING_TIERS: Record<StakingTier, {
    min: number;
    multiplier: number;
}>;
export declare const SLASH_RATES: Record<string, number>;
export declare const REWARD_RATES: Record<string, number>;
export declare class PabTokenStakingService {
    /**
     * Calculate the staking tier and multiplier based on total active stake
     */
    getTier(totalStaked: number): {
        tier: StakingTier;
        multiplier: number;
    };
    /**
     * Calculate trust score multiplier from user's staked $PAB
     * Used by trustScoreService to boost scores for stakers
     */
    getTrustMultiplier(userId: string): Promise<{
        multiplier: number;
        totalStaked: number;
        tier: StakingTier;
    }>;
    /**
     * Stake $PAB tokens for a user
     * In production: verifies on-chain transfer, then records in DB.
     * In dev/mock: records stake in DB (simulated).
     */
    stakeTokens(userId: string, amount: number, txHash?: string): Promise<StakeResult>;
    /**
     * Unstake $PAB tokens (with potential slashing penalty)
     */
    unstakeTokens(userId: string, positionId: string): Promise<UnstakeResult>;
    /**
     * Slash a user's stake for no-show, fraud, or dispute loss
     */
    slashStake(userId: string, reason: keyof typeof SLASH_RATES, reservationId?: string): Promise<SlashResult>;
    /**
     * Reward a user for completing a booking, positive review, etc.
     */
    rewardUser(userId: string, trigger: keyof typeof REWARD_RATES, referenceId?: string): Promise<RewardResult>;
    /**
     * Apply the trust multiplier to reduce a user's deposit requirement
     */
    getEffectiveDeposit(userId: string, baseDeposit: number): Promise<{
        effectiveDeposit: number;
        multiplier: number;
        tier: StakingTier;
        totalStaked: number;
    }>;
    private getTotalStaked;
    private getCurrentApy;
    private estimateDailyReward;
    private getRecentCompletedBookings;
    private computePendingPenalties;
}
export declare const pabTokenStakingService: PabTokenStakingService;
//# sourceMappingURL=pabTokenStaking.service.d.ts.map