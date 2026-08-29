export declare class PayoutService {
    /**
     * Resolve the user's passport band to gate cash-outs (band E = blocked).
     * Chain: User.walletAddress -> LinkedInProfile.walletAddress -> trustBand
     */
    private resolveBand;
    /** Quote a cash-out: shows fee + net delivered. */
    quote(userId: string, amountUsdc: number): Promise<{
        band: string;
        eligible: boolean;
        amountUsdc: number;
        feeUsdc: number;
        netUsdc: number;
        feePct: number;
        vsRemittance: number;
        note: string;
    }>;
    /** Request a cash-out of earned USDC to a real off-ramp rail.
     *  method: BANK (simulated/local), CONNECT (real Stripe transfer), LOCAL (real P2P off-ramp intent to mobile wallet/bank).
     *  destinationRef / mobile optional for LOCAL (JazzCash/Easypaisa/Raast account). */
    request(userId: string, amountUsdc: number, method?: 'BANK' | 'CONNECT' | 'LOCAL', destinationRef?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        method: string;
        userId: string;
        status: string;
        txHash: string | null;
        amountUsdc: number;
        destinationRef: string | null;
        feeUsdc: number;
        netUsdc: number;
        offrampIntentId: string | null;
    }>;
    /** Payout history for a user. */
    history(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        method: string;
        userId: string;
        status: string;
        txHash: string | null;
        amountUsdc: number;
        destinationRef: string | null;
        feeUsdc: number;
        netUsdc: number;
        offrampIntentId: string | null;
    }[]>;
}
export declare const payoutService: PayoutService;
//# sourceMappingURL=payout.service.d.ts.map