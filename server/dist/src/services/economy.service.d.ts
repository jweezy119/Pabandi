/**
 * Aggregates real on-chain + simulated $PAB circulation from persisted
 * AgentTransaction rows + treasury accrual positions.
 * This is the single source of truth for the public Economy dashboard.
 */
export declare const getEconomyStats: () => Promise<{
    bookings: number;
    feesCollected: number;
    burned: number;
    rewardsPaid: number;
    poolFees: number;
    walletsFunded: number;
    accrual: {
        total: number;
        byBucket: Record<string, number>;
    };
    lastRunAt: string | null;
}>;
//# sourceMappingURL=economy.service.d.ts.map