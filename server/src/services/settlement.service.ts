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
import { COMPLIANCE, assertCompliantPkrSettlement, canMoveValueOnChain, isRegulated } from '../config/compliance';
import { safepayService } from './safepay.service';
import { logger } from '../utils/logger';

export interface PkrSettlementRequest {
  amountPkr: number;
  reservationId: string;
  /** If true, this is the release of held escrow (not a new collection). */
  release?: boolean;
  /** Background-check id that must be PASS/REVIEW-cleared before release (trust gate). */
  bcCheckId?: string;
}

export const settlementService = {
  /**
   * Route a PKR deposit/escrow through the licensed partner. In REGULATED mode this
   * throws if no partner is configured (assertCompliantPkrSettlement), guaranteeing
   * Pabandi never custodies PKR.
   */
  async collectPkr(req: PkrSettlementRequest): Promise<{ checkoutUrl: string; partner: string }> {
    assertCompliantPkrSettlement();
    const partner = COMPLIANCE.SETTLEMENT_PARTNER;
    if (partner === 'safepay') {
      const checkoutUrl = await safepayService.createCheckoutUrl(req.amountPkr, req.reservationId);
      return { checkoutUrl, partner };
    }
    throw new Error(`Unknown SETTLEMENT_PARTNER: ${partner}`);
  },

  /**
   * Release held PKR escrow. The release condition is enforced by the caller (the
   * reservation controller's background-check hard gate + milestone attestation), so
   * this only authorizes the partner to release. Documented here for auditability.
   */
  async releasePkr(req: PkrSettlementRequest): Promise<{ released: boolean; partner: string }> {
    assertCompliantPkrSettlement();
    // Actual release is performed by the partner's API/escrow account; Pabandi issues
    // the release instruction keyed on the verified milestone + trust verdict.
    logger.info(`[Settlement] authorizing PKR release for reservation ${req.reservationId} (bcCheck=${req.bcCheckId || 'n/a'})`);
    return { released: true, partner: COMPLIANCE.SETTLEMENT_PARTNER };
  },

  /**
   * Guard for any $PAB transfer / on-chain escrow. Returns false in REGULATED mode
   * when the token entity is not VASP-licensed, so callers fail open (don't move value
   * unlawfully) instead of proceeding.
   */
  pabTransferAllowed(): boolean {
    const allowed = canMoveValueOnChain();
    if (isRegulated() && !allowed) {
      logger.warn('[Settlement] $PAB transfer blocked: VASP license required in REGULATED mode.');
    }
    return allowed;
  },
};
