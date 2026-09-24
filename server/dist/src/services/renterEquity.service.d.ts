/**
 * Renter Equity service — makes rent a yield-bearing asset (Trust-As-Infrastructure).
 *
 * Design (mirrors pyd.service non-custodial principle):
 *   - Pabandi NEVER holds principal. Rent is notionally held in a yield-bearing
 *     RWA rail (Ondo USDY / Jito) for the float window (paid 1st, settles 5th).
 *   - Generated YIELD (not principal) is split 50/50 tenant / landlord.
 *   - Pabandi takes its spread FROM the yield, never from principal.
 *   - Until an on-chain RWA adapter is live, settlement is SIMULATED (flagged).
 *
 * Settlement is idempotent per RentStream row and is driven by the autonomous
 * heartbeat (monthly accrual) so it survives cold starts.
 */
export interface RentStreamInput {
    tenantId: string;
    landlordId: string;
    rentAmountUSD: number;
    propertyId?: string;
    pool?: 'ONDO_USDC' | 'JITO_STSOL' | 'MAPLE';
    expectedApy?: number;
    holdingDays?: number;
}
export declare class RenterEquityService {
    /** Create a rent stream (holds rent in yield rail for the float window). */
    createRentStream(input: RentStreamInput): Promise<{
        ok: boolean;
        stream: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            settledAt: Date | null;
            propertyId: string | null;
            simulated: boolean;
            tenantId: string;
            expectedApy: number;
            pool: string;
            landlordId: string;
            rentAmountUSD: number;
            holdingDays: number;
            totalYieldUSD: number | null;
            tenantEquityUSD: number | null;
            landlordBonusUSD: number | null;
            pabandiSpreadUSD: number | null;
        };
    }>;
    /** Settle a single rent stream: compute + record 50/50 yield split. Idempotent. */
    settleRentStream(streamId: string): Promise<{
        ok: boolean;
        error: string;
        settled?: undefined;
        reason?: undefined;
        simulated?: undefined;
        totalYieldUSD?: undefined;
        tenantEquityUSD?: undefined;
        landlordBonusUSD?: undefined;
        pabandiSpreadUSD?: undefined;
        onchain?: undefined;
        porProofId?: undefined;
    } | {
        ok: boolean;
        settled: boolean;
        reason: string;
        error?: undefined;
        simulated?: undefined;
        totalYieldUSD?: undefined;
        tenantEquityUSD?: undefined;
        landlordBonusUSD?: undefined;
        pabandiSpreadUSD?: undefined;
        onchain?: undefined;
        porProofId?: undefined;
    } | {
        ok: boolean;
        settled: boolean;
        simulated: any;
        totalYieldUSD: number;
        tenantEquityUSD: number;
        landlordBonusUSD: number;
        pabandiSpreadUSD: number;
        onchain: any;
        porProofId: string | undefined;
        error?: undefined;
        reason?: undefined;
    }>;
    /** Settle all PENDING rent streams (called by heartbeat). Returns summary. */
    settleAllPending(): Promise<{
        ok: boolean;
        settled: number;
        totalTenant: number;
        totalLandlord: number;
    }>;
    /** Get renter equity wallet for a user (public-friendly, no principal shown). */
    getEquity(userId: string): Promise<{
        userId: string;
        tenantEquity: number;
        landlordBonus: number;
        totalSettled: number;
        exists: boolean;
    }>;
}
export declare const renterEquityService: RenterEquityService;
//# sourceMappingURL=renterEquity.service.d.ts.map