"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.pabDisclaimer = exports.canMoveValueOnChain = exports.assertCompliantPkrSettlement = exports.isRegulated = exports.COMPLIANCE = void 0;
exports.COMPLIANCE = {
    /** Master switch. In Pakistan this MUST be 'REGULATED'. 'OPEN' is dev/test only. */
    MODE: (process.env.REGULATED_MODE === 'true' ? 'REGULATED' : 'OPEN'),
    /** PKR never custodied by Pabandi — settled via a licensed partner rail. */
    SETTLEMENT_PARTNER: process.env.SETTLEMENT_PARTNER || 'safepay',
    /** $PAB is tradable; token activity requires a VASP license. */
    VASP_LICENSED: process.env.VASP_LICENSED === 'true',
    /** Jurisdiction this deployment serves (drives which policy set applies). */
    JURISDICTION: process.env.COMPLIANCE_JURISDICTION || 'PK',
    /** Disclosure string shown wherever $PAB is mentioned. */
    PAB_DISCLAIMER: '$PAB is a utility & incentive token, NOT an investment, security, or deposit. ' +
        'Value is not guaranteed. Use is governed by Pabandi Terms of Service.',
};
const isRegulated = () => exports.COMPLIANCE.MODE === 'REGULATED';
exports.isRegulated = isRegulated;
/**
 * PKR must always settle through the licensed partner rail, never app-controlled.
 * Throws if the deployment is misconfigured (e.g. REGULATED mode but no partner).
 */
const assertCompliantPkrSettlement = () => {
    if ((0, exports.isRegulated)() && !exports.COMPLIANCE.SETTLEMENT_PARTNER) {
        throw new Error('REGULATED_MODE requires SETTLEMENT_PARTNER (licensed PKR rail).');
    }
};
exports.assertCompliantPkrSettlement = assertCompliantPkrSettlement;
/**
 * $PAB transfer / on-chain escrow is VASP activity. In REGULATED mode it must only
 * proceed when the token entity is licensed (or routed via a licensed VASP partner).
 * Returns false (don't proceed) rather than throwing, so callers can fail gracefully.
 */
const canMoveValueOnChain = () => {
    if (!(0, exports.isRegulated)())
        return true; // dev/test
    return exports.COMPLIANCE.VASP_LICENSED;
};
exports.canMoveValueOnChain = canMoveValueOnChain;
const pabDisclaimer = () => exports.COMPLIANCE.PAB_DISCLAIMER;
exports.pabDisclaimer = pabDisclaimer;
//# sourceMappingURL=compliance.js.map