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
     *  method: BANK (simulated/local), CONNECT (real Stripe transfer), LOCAL (real P2P off-ramp intent to mobile wallet/bank), CASHAPP (Cash App balance).
     *  destinationRef / mobile optional for LOCAL (JazzCash/Easypaisa/Raast account). */
    request(userId: string, amountUsdc: number, method?: 'BANK' | 'CONNECT' | 'LOCAL' | 'CASHAPP', destinationRef?: string): Promise<{
        id: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        method: string;
        txHash: string | null;
        amountUsdc: number;
        feeUsdc: number;
        netUsdc: number;
        destinationRef: string | null;
        offrampIntentId: string | null;
    }>;
    /** Payout history for a user. */
    history(userId: string): Promise<{
        id: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        method: string;
        txHash: string | null;
        amountUsdc: number;
        feeUsdc: number;
        netUsdc: number;
        destinationRef: string | null;
        offrampIntentId: string | null;
    }[]>;
}
export declare const payoutService: PayoutService;
//# sourceMappingURL=payout.service.d.ts.map