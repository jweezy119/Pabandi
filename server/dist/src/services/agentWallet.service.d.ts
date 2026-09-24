export type WalletOperation = 'PLATFORM_FEE' | 'AGENT_STAKE' | 'AGENT_PAYOUT' | 'SLASH' | 'BONUS' | 'ESCROW_FUND' | 'ESCROW_RELEASE';
export interface DebitOpts {
    agentId: string;
    amount: number;
    operation: WalletOperation;
    refId?: string;
    metadata?: Record<string, any>;
}
export interface CreditOpts {
    agentId: string;
    amount: number;
    operation: WalletOperation;
    refId?: string;
    metadata?: Record<string, any>;
}
export declare function debitAgent(opts: DebitOpts): Promise<any>;
export declare function creditAgent(opts: CreditOpts): Promise<any>;
/**
 * Collect the SOL platform fee for a booking/tool-call event atomically.
 * This is the canonical entry point for fee collection across the platform.
 */
export declare function collectSolPlatformFee(opts: {
    agentId?: string;
    gigId?: string;
    bookingId?: string;
    amountSol: number;
    metadata?: Record<string, any>;
}): Promise<any>;
/**
 * Record a booking outcome and update reputation/trust.
 */
export declare function recordBookingOutcome(opts: {
    agentId: string;
    status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
    gigId?: string;
    bookingId?: string;
    qualityScore?: number;
}): Promise<any>;
export declare const agentWalletService: {
    debitAgent: typeof debitAgent;
    creditAgent: typeof creditAgent;
    collectSolPlatformFee: typeof collectSolPlatformFee;
    recordBookingOutcome: typeof recordBookingOutcome;
};
//# sourceMappingURL=agentWallet.service.d.ts.map