export type TreasuryBucket = 'OPERATING' | 'TREASURY' | 'LP_PROVISION' | 'YIELD_REINVEST' | 'EMERGENCY';
export declare const TREASURY_BUCKETS: readonly TreasuryBucket[];
export declare const recordTribute: (params: {
    amount: number;
    bucket: TreasuryBucket;
    txHash?: string;
    meta?: Record<string, any>;
}) => Promise<{
    id: string;
}>;
export declare const getTreasurySummary: () => Promise<{
    total: number;
    byBucket: Record<string, number>;
    byStrategy: Record<string, number>;
}>;
//# sourceMappingURL=treasury.service.d.ts.map