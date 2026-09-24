export type PTPRiskBand = 'A' | 'B' | 'C' | 'D' | 'E';
/** Per-band capability policy. This is the foolproof guard rail. */
export declare const BAND_POLICY: Record<PTPRiskBand, {
    allow: string[];
    deny: string[];
    maxTransferUSD: number;
    maxIssuePerDay: number;
}>;
export interface CapabilityCheck {
    ok: boolean;
    reason?: string;
}
/**
 * Foolproof capability validation against the owner's risk band.
 * Returns ok=false if ANY requested capability is disallowed or exceeds a ceiling.
 */
export declare function validateCapabilities(band: PTPRiskBand, capabilities: string[]): CapabilityCheck;
export interface IssueChargeResult {
    idempotencyKey: string;
    feePab: number;
    alreadyCharged: boolean;
    record: any;
    balanceAfter?: number;
}
/**
 * Idempotent, fail-closed charge for issuing a passport.
 * - dedupes on idempotencyKey (retry-safe)
 * - enforces per-owner daily issue cap
 * - deducts the real $PAB fee from the owner's Web3Agent balance, fail-closed:
 *   insufficient balance -> throws (no passport, no charge)
 * - on ANY ledger/balance failure, throws (fail-closed: no passport without payment)
 */
export declare const passportEconomy: {
    ensureLedger(): Promise<void>;
    countToday(ownerUserId: string): Promise<number>;
    /** Resolve (or lazily create at 0 balance) the owner's Web3Agent holding $PAB. */
    resolveAgent(ownerUserId: string): Promise<any>;
    chargeIssue(params: {
        ownerUserId: string;
        agentId: string;
        riskBand: PTPRiskBand;
        capabilities: string[];
        idempotencyKey?: string;
    }): Promise<IssueChargeResult>;
    /** Public audit lookup. Returns the charge record or null. */
    lookup(idempotencyKey: string): Promise<any | null>;
};
//# sourceMappingURL=passportEconomy.service.d.ts.map