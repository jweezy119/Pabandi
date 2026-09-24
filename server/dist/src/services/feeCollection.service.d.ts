export interface SolFeeInput {
    bookingRef: string;
    amountSol: number;
    txHash?: string;
    source: 'AGENT_BOOKING' | 'HUMAN_BOOKING' | 'ESCROW_RELEASE';
    payerAddress?: string;
    onChain?: boolean;
}
export declare class FeeCollectionService {
    /** Record a SOL platform fee as one canonical TreasuryPosition (USD-valued). */
    recordSolFee(input: SolFeeInput): Promise<{
        id: string;
        usdValue: number;
    }>;
    /** Total SOL platform fees collected (optionally since a date), with USD value. */
    totalSolFees(sinceDays?: number): Promise<{
        totalSol: number;
        totalUsd: number;
        count: number;
        onChainSol: number;
        onChainUsd: number;
        accruedSol: number;
        accruedUsd: number;
    }>;
}
export declare const feeCollectionService: FeeCollectionService;
//# sourceMappingURL=feeCollection.service.d.ts.map