/**
 * Centralized Pakistan regulatory posture for Pabandi.
 *
 * Decisions (locked with founder, 2026):
 *  - PKR settlement runs through a LICENSED escrow/payment PARTNER (Safepay +
 *    SBP-approved bank escrow). Pabandi does NOT self-custody customer deposits,
 *    so it stays out of SECP NBFC licensing for v1.
 *  - $PAB is a TRADABLE utility token. That makes token issuance + on-chain escrow
 *    VASP activity under PVARA / Virtual Assets Act 2026, so the token entity must
 *    operate under a PVARA VASP license (or via a licensed VASP partner).
 *
 * This module is the single source of truth the app reads to stay compliant-by-design.
 * It does NOT invent licenses — it declares the *required* posture and exposes guards
 * the rest of the code calls.
 */
export type RegulationMode = 'OPEN' | 'REGULATED';
export declare const COMPLIANCE: {
    /** Master switch. In Pakistan this MUST be 'REGULATED'. 'OPEN' is dev/test only. */
    readonly MODE: RegulationMode;
    /** PKR never custodied by Pabandi — settled via a licensed partner rail. */
    readonly SETTLEMENT_PARTNER: string;
    /** $PAB is tradable; token activity requires a VASP license. */
    readonly VASP_LICENSED: boolean;
    /** Jurisdiction this deployment serves (drives which policy set applies). */
    readonly JURISDICTION: string;
    /** Disclosure string shown wherever $PAB is mentioned. */
    readonly PAB_DISCLAIMER: string;
};
export declare const isRegulated: () => boolean;
/**
 * PKR must always settle through the licensed partner rail, never app-controlled.
 * Throws if the deployment is misconfigured (e.g. REGULATED mode but no partner).
 */
export declare const assertCompliantPkrSettlement: () => void;
/**
 * $PAB transfer / on-chain escrow is VASP activity. In REGULATED mode it must only
 * proceed when the token entity is licensed (or routed via a licensed VASP partner).
 * Returns false (don't proceed) rather than throwing, so callers can fail gracefully.
 */
export declare const canMoveValueOnChain: () => boolean;
export declare const pabDisclaimer: () => string;
//# sourceMappingURL=compliance.d.ts.map