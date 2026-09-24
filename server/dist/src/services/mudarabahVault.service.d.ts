/**
 * Mudarabah Yield Vault Service (Sharia-Compliant)
 *
 * In a Mudarabah contract, Pabandi acts as the Mudarib (manager) and the user
 * (or the escrow treasury) acts as the Rabb-ul-Mal (capital provider).
 *
 * Funds held in escrow are routed to a Sharia-compliant yield-generating
 * DeFi protocol (e.g., Sukuk-backed liquidity pools, Halal staking).
 * Profits are shared between the user and Pabandi according to a pre-agreed ratio.
 */
export declare class MudarabahVaultService {
    private connection;
    constructor();
    /**
     * Deposit escrowed funds into the Mudarabah Yield Vault.
     * In a real implementation, this interacts with a Solana DeFi program via CPI.
     */
    depositToVault(escrowId: string, amount: number, tokenMint: string): Promise<{
        success: boolean;
        apy: number;
    }>;
    /**
     * Withdraw funds and accumulated Halal yield upon escrow release.
     */
    withdrawWithYield(escrowId: string, principalAmount: number, daysLocked: number): Promise<{
        principal: number;
        totalYield: number;
        userShare: number;
        pabandiShare: number;
    }>;
    /**
     * Sweep idle collateral into Mudarabah
     */
    sweepIdleCollateral(): Promise<void>;
}
export declare const mudarabahVaultService: MudarabahVaultService;
//# sourceMappingURL=mudarabahVault.service.d.ts.map