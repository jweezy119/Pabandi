export declare const nightlifeTokenomicsService: {
    rewardGuestAttendance(guestListId: string): Promise<{
        amount: number;
        reason: string;
        venue: string;
    } | null>;
    rewardGuestReview(userId: string, reviewId: string, isFirstReview: boolean): Promise<{
        amount: number;
        reason: string;
    }>;
    rewardGuestReferral(referrerId: string, referredUserId: string): Promise<{
        amount: number;
        reason: string;
    }>;
    rewardBottlePurchase(userId: string, amount: number, bottleReservationId: string): Promise<{
        amount: number;
        reason: string;
    }>;
    stakePromoterTier(userId: string, tier: string): Promise<{
        error: string;
        stake?: undefined;
        tierConfig?: undefined;
    } | {
        stake: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: string | null;
            amount: number;
            agentId: string;
            tier: string | null;
            amountPab: number;
            slashedPab: number;
            vault: string | null;
            indexed: boolean;
            txStatus: string | null;
            benefits: string[];
            stakedAt: Date | null;
            unstakedAt: Date | null;
        };
        tierConfig: {
            minStake: number;
            maxStake: number;
            benefits: string[];
            commissionDiscount: number;
            color: string;
        } | {
            minStake: number;
            maxStake: number;
            benefits: string[];
            commissionDiscount: number;
            color: string;
        } | {
            minStake: number;
            maxStake: number;
            benefits: string[];
            commissionDiscount: number;
            color: string;
        } | {
            minStake: number;
            maxStake: number;
            benefits: string[];
            commissionDiscount: number;
            color: string;
        } | {
            minStake: number;
            maxStake: null;
            benefits: string[];
            commissionDiscount: number;
            color: string;
        };
        error?: undefined;
    }>;
    unstakePromoterTier(userId: string): Promise<{
        error: string;
        refunded?: undefined;
        tier?: undefined;
    } | {
        refunded: number;
        tier: string | null;
        error?: undefined;
    }>;
    payVenueSubscription(venueId: string, amountUsd: number): Promise<{
        amountUsd: number;
        amountPab: number;
        discount: number;
    }>;
    depositGuestListSpot(userId: string, guestListId: string, amountPab: number): Promise<{
        held: number;
        status: string;
    }>;
    returnGuestListDeposit(userId: string, guestListId: string, showUp: boolean): Promise<{
        returned: number;
        bonus: number;
        forfeited?: undefined;
    } | {
        forfeited: number;
        returned?: undefined;
        bonus?: undefined;
    } | null>;
    getTokenomicsStats(period?: "day" | "week" | "month"): Promise<{
        totalDistributed: number;
        totalCollected: number;
        totalStaked: number;
        byType: Record<string, {
            count: number;
            amount: number;
        }>;
    }>;
    getUserNightlifeBalance(userId: string): Promise<{
        balance: number;
        lifetimeEarned: number;
        lifetimeSpent: number;
    }>;
};
//# sourceMappingURL=nightlifeTokenomics.service.d.ts.map