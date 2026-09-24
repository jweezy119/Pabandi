export interface RewardCalculation {
    customerRewardUsd: number;
    businessRewardUsd: number;
    customerRewardPab: number;
    businessRewardPab: number;
    tierMultiplier: number;
}
export interface IssueRewardsParams {
    customerId: string;
    businessId: string;
    purchaseAmount: number;
    referenceId: string;
    referenceType: string;
}
export interface FeeOffsetResult {
    offsetAmount: number;
    offsetUsdValue: number;
    finalFee: number;
    discountPercent?: number;
}
export interface UserRewardTier {
    name: string;
    feeDiscount: number;
    rewardMultiplier: number;
}
export declare class RewardEngine {
    /**
     * Calculate rewards for a purchase
     */
    calculateRewards(purchaseAmountUsd: number, tierMultiplier?: number): RewardCalculation;
    /**
     * Issue rewards after a confirmed payment
     */
    issueRewards(params: IssueRewardsParams): Promise<{
        customerReward: {
            id: string;
            createdAt: Date;
            userId: string;
            type: string;
            status: string;
            amount: number;
            userType: string;
            usdValue: number;
            referenceId: string | null;
            referenceType: string | null;
            claimedAt: Date | null;
            settledAt: Date | null;
            vestingEnd: Date | null;
        };
        businessReward: {
            id: string;
            createdAt: Date;
            userId: string;
            type: string;
            status: string;
            amount: number;
            userType: string;
            usdValue: number;
            referenceId: string | null;
            referenceType: string | null;
            claimedAt: Date | null;
            settledAt: Date | null;
            vestingEnd: Date | null;
        };
        rewards: RewardCalculation;
    }>;
    /**
     * Calculate fee offset using staked $PAB
     */
    calculateFeeOffset(userId: string, userType: string, originalFeeUsd: number): Promise<FeeOffsetResult>;
    /**
     * Get user's reward tier
     */
    getUserTier(userId: string, userType: string): Promise<UserRewardTier>;
    /**
     * Update user's reward balance
     */
    updateBalance(userId: string, userType: string, amountDelta: number): Promise<{
        id: string;
        updatedAt: Date;
        userId: string;
        stakedAmount: number;
        userType: string;
        totalEarned: number;
        totalClaimed: number;
        totalVesting: number;
        currentTier: string;
    }>;
    /**
     * Seed default reward tiers
     */
    seedTiers(): Promise<void>;
}
export declare const rewardEngine: RewardEngine;
//# sourceMappingURL=rewardEngine.service.d.ts.map