declare const STAKE_TIERS: {
    BRONZE: {
        minAmount: number;
        trustBoost: number;
        apy: number;
    };
    SILVER: {
        minAmount: number;
        trustBoost: number;
        apy: number;
    };
    GOLD: {
        minAmount: number;
        trustBoost: number;
        apy: number;
    };
    PLATINUM: {
        minAmount: number;
        trustBoost: number;
        apy: number;
    };
};
type StakeTier = keyof typeof STAKE_TIERS;
export declare function stakePab(userId: string, tier: StakeTier): Promise<any>;
export declare function unstakePab(userId: string, stakingId: string): Promise<any>;
export declare function getStakingStatus(userId: string): Promise<any>;
export declare const pabStakingService: {
    stakePab: typeof stakePab;
    unstakePab: typeof unstakePab;
    getStakingStatus: typeof getStakingStatus;
    STAKE_TIERS: {
        BRONZE: {
            minAmount: number;
            trustBoost: number;
            apy: number;
        };
        SILVER: {
            minAmount: number;
            trustBoost: number;
            apy: number;
        };
        GOLD: {
            minAmount: number;
            trustBoost: number;
            apy: number;
        };
        PLATINUM: {
            minAmount: number;
            trustBoost: number;
            apy: number;
        };
    };
};
export {};
//# sourceMappingURL=pabStaking.service.d.ts.map