export declare class RentYieldService {
    /**
     * Processes a rent payment, deposits into the live Ondo USDY Yield Vault on Solana,
     * and splits the initial simulated yield equity between tenant and landlord.
     */
    processRentAndGenerateYield(leaseId: string, amountUsd: number): Promise<{
        paymentId: any;
        amountProcessed: number;
        tenantYieldEarned: number;
        landlordYieldEarned: number;
    }>;
}
export declare const rentYieldService: RentYieldService;
//# sourceMappingURL=rent-yield.service.d.ts.map