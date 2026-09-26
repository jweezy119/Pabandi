export declare class OndoSolanaService {
    private connection;
    private treasuryKeypair;
    private USDC_MINT;
    private USDY_MINT;
    constructor();
    /**
     * Fetches the Treasury's current USDY balance on Solana
     */
    getUsdyBalance(): Promise<number>;
    /**
     * Swaps USDC for USDY using Jupiter Aggregator (V6 API)
     * @param amountUsdc Amount of USDC to swap (in USD, unscaled)
     * @returns txHash The Solana transaction hash, or null if failed/mocked
     */
    swapUsdcForUsdy(amountUsdc: number): Promise<string | null>;
}
export declare const ondoSolanaService: OndoSolanaService;
//# sourceMappingURL=ondo-solana.service.d.ts.map