/**
 * ondoUsdy.service.ts — Real Ondo USDY (tokenized US Treasuries) holding + yield split
 * for the Trust-As-Infrastructure rent rail.
 *
 * SECURITY POSTURE (non-custodial, treasury-protected):
 *   - Pabandi NEVER sweeps the main treasury (38HR8Bo…) into USDY. All on-chain USDY
 *     activity uses a DEDICATED settlement wallet (ONDO_SETTLEMENT_WALLET env), which must
 *     be seeded separately with USDY + a little SOL for gas.
 *   - The USDY mint is an ENV VAR (ONDO_USDY_MINT). We NEVER hardcode a mainnet mint —
 *     a wrong mint = irreversible loss. Until it is set + ONDO_RWA_LIVE=true, everything
 *     is SIMULATED (clearly flagged), matching the rest of the platform.
 *   - Yield is accrued by USDY natively (rebasing). We compute the distributable yield for
 *     the float window from ONDO_APY (env, default 4.5%) and split 50/50 tenant/landlord.
 *     The yield math is real; the on-chain USDY holding + balance read is real when live.
 *
 * Real on-chain calls (when live):
 *   - getOrCreateAssociatedTokenAccount(usdyMint, settlementWallet)
 *   - getOrCreateAssociatedTokenAccount(usdyMint, tenant/landlord destination)
 *   - transfer(usdyMint, settlement -> destination, amount)
 *   - getAccount balance read
 */
export interface UsdyHoldingResult {
    simulated: boolean;
    streamId?: string;
    usdyMint?: string;
    heldAmountUsdy?: number;
    settlementWallet?: string;
    txHash?: string;
    error?: string;
}
export declare class OndoUsdyService {
    private live;
    /**
     * Hold a rent payment in USDY for the float window (real SPL transfer when live).
     * Returns simulated:true when ONDO_RWA_LIVE / mint / settlement wallet are not configured.
     */
    holdInUsdy(streamId: string, tenantWallet: string, amountUsd: number): Promise<UsdyHoldingResult>;
    /**
     * Compute the 50/50 yield split for a holding over `holdingDays`.
     * Yield is USDY-native; we express the distributable yield in USD and split.
     */
    computeYieldSplit(amountUsd: number, holdingDays: number): {
        totalYield: number;
        spread: number;
        tenantEquity: number;
        landlordBonus: number;
        apy: number;
        simulated: boolean;
    };
    /**
     * Settle: distribute the yield (as USDC from the settlement wallet) 50/50 to tenant + landlord.
     * Principal (USDY) is returned to the tenant. Real USDC transfer when live; else simulated.
     */
    settleYield(streamId: string, tenantWallet: string, landlordWallet: string, amountUsd: number, holdingDays: number): Promise<any>;
}
export declare const ondoUsdyService: OndoUsdyService;
//# sourceMappingURL=ondoUsdy.service.d.ts.map