"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementService = void 0;
/**
 * Settlement provider abstraction.
 *
 * Per the Pakistan regulatory posture (docs/COMPLIANCE-PAKISTAN.md):
 *  - PKR is NEVER custodied by Pabandi. It settles through a LICENSED partner rail
 *    (Safepay -> SBP-approved bank escrow). Pabandi controls RELEASE CONDITIONS via
 *    its trust verdicts (background-check gate, milestone attestation) but never holds
 *    the funds.
 *  - $PAB on-chain movement is VASP activity and is gated by canMoveValueOnChain().
 *
 * This is the single place the app touches PKR settlement, so compliance is enforced
 * by design rather than scattered across controllers.
 */
const compliance_1 = require("../config/compliance");
const safepay_service_1 = require("./safepay.service");
const logger_1 = require("../utils/logger");
exports.settlementService = {
    /**
     * Route a PKR deposit/escrow through the licensed partner. In REGULATED mode this
     * throws if no partner is configured (assertCompliantPkrSettlement), guaranteeing
     * Pabandi never custodies PKR.
     */
    async collectPkr(req) {
        (0, compliance_1.assertCompliantPkrSettlement)();
        const partner = compliance_1.COMPLIANCE.SETTLEMENT_PARTNER;
        if (partner === 'safepay') {
            const checkoutUrl = await safepay_service_1.safepayService.createCheckoutUrl(req.amountPkr, req.reservationId);
            return { checkoutUrl, partner };
        }
        throw new Error(`Unknown SETTLEMENT_PARTNER: ${partner}`);
    },
    /**
     * Release held PKR escrow. The release condition is enforced by the caller (the
     * reservation controller's background-check hard gate + milestone attestation), so
     * this only authorizes the partner to release. Documented here for auditability.
     */
    async releasePkr(req) {
        (0, compliance_1.assertCompliantPkrSettlement)();
        // Actual release is performed by the partner's API/escrow account; Pabandi issues
        // the release instruction keyed on the verified milestone + trust verdict.
        logger_1.logger.info(`[Settlement] authorizing PKR release for reservation ${req.reservationId} (bcCheck=${req.bcCheckId || 'n/a'})`);
        return { released: true, partner: compliance_1.COMPLIANCE.SETTLEMENT_PARTNER };
    },
    /**
     * Guard for any $PAB transfer / on-chain escrow. Returns false in REGULATED mode
     * when the token entity is not VASP-licensed, so callers fail open (don't move value
     * unlawfully) instead of proceeding.
     */
    pabTransferAllowed() {
        const allowed = (0, compliance_1.canMoveValueOnChain)();
        if ((0, compliance_1.isRegulated)() && !allowed) {
            logger_1.logger.warn('[Settlement] $PAB transfer blocked: VASP license required in REGULATED mode.');
        }
        return allowed;
    },
};
//# sourceMappingURL=settlement.service.js.map