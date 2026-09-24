/**
 * Pabandi Frictionless Payment Agent
 * ==================================
 *
 * Users NEVER touch crypto directly.
 * The agent handles ALL on-chain complexity.
 */
export declare class FrictionlessPaymentAgent {
    /**
     * Process a payment from a user (in USD)
     * Agent handles all crypto conversion on the backend
     */
    processPayment(userId: string, amountUsd: number, type: string, referenceId: string): Promise<{
        success: boolean;
        amountUsd: number;
        amountPab?: number;
    }>;
    /**
     * Booking deposit: Agent locks PAB in escrow
     */
    private executeBookingDeposit;
    /**
     * Check-in reward: Agent distributes PAB reward
     */
    processCheckinReward(agentId: string, bookingValueUsd: number): Promise<{
        success: boolean;
        amountUsd: number;
        amountPab: number;
    }>;
    /**
     * Rent payment: Agent converts USDC to PAB, sends to landlord
     */
    private executeRentPayment;
    /**
     * Lease deposit: Agent locks PAB in escrow
     */
    private executeLeaseDeposit;
    /**
     * Reward payout: Convert PAB to USDC for agent
     */
    private executeRewardPayout;
    /**
     * Get agent's portfolio (USD only — no crypto jargon)
     */
    getAgentPortfolio(agentId: string): Promise<{
        usdcBalance: number;
        pabBalance: number;
        pabValueUsd: number;
        totalValueUsd: number;
        trustScore: number;
    } | null>;
}
export declare const paymentAgent: FrictionlessPaymentAgent;
//# sourceMappingURL=frictionlessPayment.service.d.ts.map