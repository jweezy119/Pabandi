interface SettlementResult {
    settled: number;
    failed: number;
    totalUsdc: number;
    totalSolCost: number;
    txHashes: string[];
    errors: string[];
}
export declare class SettlementService {
    runSettlement(): Promise<SettlementResult>;
    startPeriodicSettlement(): ReturnType<typeof setInterval>;
}
export declare const settlementService: SettlementService;
export {};
//# sourceMappingURL=settlement.service.d.ts.map