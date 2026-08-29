export declare class RentYieldService {
    /**
     * Processes a rent payment, deposits into a DeFi Yield Vault (mocked),
     * and splits the yield equity between tenant and landlord.
     */
    processRentAndGenerateYield(leaseId: string, amountUsd: number): Promise<{
        paymentId: string;
        amountProcessed: number;
        tenantYieldEarned: number;
        landlordYieldEarned: number;
    }>;
}
export declare const rentYieldService: RentYieldService;
//# sourceMappingURL=rent-yield.service.d.ts.map