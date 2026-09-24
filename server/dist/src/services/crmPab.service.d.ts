export interface PabBalanceInfo {
    managerId: string;
    totalPabBalance: number;
    totalPabStaked: number;
    tenantBalances: {
        tenantId: string;
        email: string;
        balance: number;
    }[];
}
export interface StakingOverview {
    managerId: string;
    totalStaked: number;
    tenantStakes: {
        tenantId: string;
        email: string;
        amount: number;
        tier: string;
    }[];
    tiers: {
        tier: string;
        count: number;
        totalAmount: number;
    }[];
}
export interface RevenueAnalytics {
    managerId: string;
    totalUsdcRevenue: number;
    totalPabRevenue: number;
    totalRevenueUsdc: number;
    byMonth: {
        month: string;
        usdc: number;
        pab: number;
        totalUsdc: number;
    }[];
    byProperty: {
        propertyId: string;
        title: string;
        usdc: number;
        pab: number;
    }[];
}
export declare function getManagerPabBalance(managerId: string): Promise<PabBalanceInfo>;
export declare function getStakingOverview(managerId: string): Promise<StakingOverview>;
export declare function getRevenueAnalytics(managerId: string): Promise<RevenueAnalytics>;
export interface TenantRiskWithPab {
    tenantId: string;
    email: string;
    riskScore: number;
    riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
    pabStaked: number;
    pabBalance: number;
    adjustedRiskScore: number;
    factors: {
        label: string;
        impact: number;
    }[];
}
export declare function getTenantRiskWithPabScoring(tenantId: string): Promise<TenantRiskWithPab | null>;
export declare function createBulkPabReward(params: {
    managerId: string;
    name: string;
    description?: string;
    recipients: {
        contactId?: string;
        email: string;
        amount: number;
    }[];
}): Promise<any>;
export declare function distributeBulkPabReward(rewardId: string): Promise<any>;
export declare const crmPabService: {
    getManagerPabBalance: typeof getManagerPabBalance;
    getStakingOverview: typeof getStakingOverview;
    getRevenueAnalytics: typeof getRevenueAnalytics;
    getTenantRiskWithPabScoring: typeof getTenantRiskWithPabScoring;
    createBulkPabReward: typeof createBulkPabReward;
    distributeBulkPabReward: typeof distributeBulkPabReward;
    PAB_DISCOUNT_RATE: number;
    AUTO_STAKE_RATE: number;
    PAB_PRICE_USDC: number;
};
//# sourceMappingURL=crmPab.service.d.ts.map