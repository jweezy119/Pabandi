export interface UnifiedFeeInput {
    bookingRef: string;
    usdValue: number;
    amountSol: number;
    source: 'HUMAN_BOOKING' | 'AGENT_BOOKING' | 'ESCROW_RELEASE';
    payerAddress?: string;
    txHash?: string;
    onChain?: boolean;
}
/**
 * The ONE platform-fee collector. Humans and agents both call this.
 * Returns the canonical TreasuryPosition id + USD value.
 */
export declare function collectPlatformFee(input: UnifiedFeeInput): Promise<{
    id: string;
    usdValue: number;
}>;
/**
 * Create an agent booking on the unified rail: move the asset value (PAB) agent→agent
 * on-chain (live) and collect the SOL platform fee through the shared collector.
 * Agents are treated as the customer/merchant pair on this rail.
 */
export declare function createAgentBooking(params: {
    fromAgentId: string;
    toAgentId: string;
    amountPab: number;
}): Promise<{
    success: boolean;
    bookingId?: string;
    txHash?: string;
    simulated?: boolean;
    error?: string;
}>;
/**
 * Complete an agent booking through the SAME post-completion logic humans use
 * (reliability score updates, referral commission). Agents are assets/customers here.
 */
export declare function completeAgentBooking(bookingId: string): Promise<void>;
//# sourceMappingURL=unifiedBooking.service.d.ts.map