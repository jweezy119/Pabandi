export declare class ReferralService {
    /**
     * Processes the first booking bounty for a referred business or customer.
     */
    processFirstBookingBounty(reservationId: string): Promise<void>;
    private payBounty;
    /**
     * Calculates and accrues a commission when a booking reaches terminal completed state.
     */
    calculateBookingCommission(reservationId: string): Promise<void>;
    private getConfig;
}
//# sourceMappingURL=referral.service.d.ts.map