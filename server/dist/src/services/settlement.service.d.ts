export interface PkrSettlementRequest {
    amountPkr: number;
    reservationId: string;
    /** If true, this is the release of held escrow (not a new collection). */
    release?: boolean;
    /** Background-check id that must be PASS/REVIEW-cleared before release (trust gate). */
    bcCheckId?: string;
}
export declare const settlementService: {
    /**
     * Route a PKR deposit/escrow through the licensed partner. In REGULATED mode this
     * throws if no partner is configured (assertCompliantPkrSettlement), guaranteeing
     * Pabandi never custodies PKR.
     */
    collectPkr(req: PkrSettlementRequest): Promise<{
        checkoutUrl: string;
        partner: string;
    }>;
    /**
     * Release held PKR escrow. The release condition is enforced by the caller (the
     * reservation controller's background-check hard gate + milestone attestation), so
     * this only authorizes the partner to release. Documented here for auditability.
     */
    releasePkr(req: PkrSettlementRequest): Promise<{
        released: boolean;
        partner: string;
    }>;
    /**
     * Guard for any $PAB transfer / on-chain escrow. Returns false in REGULATED mode
     * when the token entity is not VASP-licensed, so callers fail open (don't move value
     * unlawfully) instead of proceeding.
     */
    pabTransferAllowed(): boolean;
};
//# sourceMappingURL=settlement.service.d.ts.map