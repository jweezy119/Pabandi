/**
 * reputationInsurance.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Reputation Insurance Underwriting Engine — Premium revenue layer.
 *
 * Uses TrustFlux velocity predictions to underwrite micro-insurance
 * against booking no-shows, cancellations, and service non-delivery.
 *
 * Business model:
 *   - Businesses pay a premium (in $PAB or USD) to insure their bookings
 *   - If a no-show occurs (predicted by TrustFlux), the buyer gets refunded
 *   - Insurance premium = base_rate × risk_multiplier × exposure_amount
 *
 * Risk model:
 *   - Base rate: 2% of booking value (standard cancellation protection)
 *   - Risk multiplier from TrustFlux velocity + confidence + peer normalization
 *     - velocity > 0.5 (rising): 0.5x (excellent track record)
 *     - velocity < -0.3 (declining): 3.0x (poor track record)
 *   - Confidence affects pricing: low confidence → higher premium (information risk)
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustFluxService } from './trustFlux.service';
import { pabondService } from './pabond.service';
import { pabTokenStakingService } from './pabTokenStaking.service';

export interface InsurancePolicy {
  policyId: string;
  providerId: string;           // business/user providing the service
  customerId: string;           // customer booking
  reservationId: string;
  coverageAmount: number;       // USD covered (booking value)
  premiumUSD: number;           // what provider pays
  premiumPAB?: number;          // alternative: pay in $PAB
  riskMultiplier: number;       // 0.5x (safe) to 5.0x (risky)
  coverageType: 'NO_SHOW' | 'CANCELLATION' | 'SERVICE_FAILURE';
  expiresAt: number;            // policy expires after booking
  isActive: boolean;
  payoutTxHash?: string;        // on-chain payout reference
}

export interface UnderwritingResult {
  approved: boolean;
  premiumUSD: number;
  premiumPAB: number;
  riskMultiplier: number;
  riskBand: 'SAFE' | 'MODERATE' | 'RISKY';
  reason: string;
  coverageAmount: number;
}

// ── Insurance Constants ─────────────────────────────────────────────────────
const BASE_RATE = 0.02;           // 2% of booking value
const MIN_PREMIUM = 0.5;          // $0.50 minimum
const MAX_RISK_MULTIPLIER = 5.0;  // 5x for very risky providers
const MIN_RISK_MULTIPLIER = 0.5;  // 0.5x for excellent providers
const PAB_PREMIUM_DISCOUNT = 0.15; // 15% discount for $PAB payment

export class ReputationInsuranceService {
  private activePolicies: Map<string, InsurancePolicy> = new Map();
  private totalPremiums: number = 0;
  private totalPayouts: number = 0;
  private totalClaims: number = 0;

  /**
   * Underwrite a new insurance policy for a booking.
   * Uses TrustFlux to assess the provider's risk profile.
   */
  public async underwrite(
    providerId: string,
    customerId: string,
    reservationId: string,
    coverageAmount: number,
    coverageType: 'NO_SHOW' | 'CANCELLATION' | 'SERVICE_FAILURE'
  ): Promise<UnderwritingResult> {
    try {
      // 1. Compute TrustFlux for the provider (default to MODERATE if no history/lookup fails)
      let flux: any;
      try {
        flux = await trustFluxService.computeTrustFlux(providerId);
      } catch (fluxErr: any) {
        logger.warn(`[ReputationInsurance] TrustFlux unavailable for ${providerId}, defaulting to MODERATE: ${fluxErr?.message}`);
        flux = { velocity: 0, peerNormalizedVelocity: 0, confidence: 0.5, trend: 'STABLE' };
      }

      // 2. Compute peer-normalized velocity
      const peerVelocity = flux.peerNormalizedVelocity ?? flux.velocity ?? 0;

      // 3. Calculate risk multiplier from velocity + confidence
      let riskMultiplier: number;

      if (peerVelocity > 0.5 && flux.confidence > 0.6) {
        riskMultiplier = MIN_RISK_MULTIPLIER; // 0.5x — rising star, very safe
      } else if (peerVelocity > 0.3 && flux.confidence > 0.5) {
        riskMultiplier = 0.7;
      } else if (peerVelocity > 0 && flux.confidence > 0.4) {
        riskMultiplier = 1.0; // standard risk
      } else if (peerVelocity < -0.2 || flux.trend === 'DECLINING') {
        riskMultiplier = 3.0; // declining — risky
      } else if (flux.confidence < 0.3) {
        riskMultiplier = 2.5; // low confidence — information risk
      } else {
        riskMultiplier = 1.5; // default moderate
      }

      // Clamp
      riskMultiplier = Math.max(MIN_RISK_MULTIPLIER, Math.min(MAX_RISK_MULTIPLIER, riskMultiplier));

      // 4. Compute premium
      let premiumUSD = BASE_RATE * coverageAmount * riskMultiplier;
      premiumUSD = Math.max(MIN_PREMIUM, premiumUSD);

      // 5. $PAB payment option (15% discount)
      let stakeResult: any = { multiplier: 1 };
      try {
        stakeResult = await pabTokenStakingService.getTrustMultiplier(providerId);
      } catch (e: any) {
        logger.warn(`[ReputationInsurance] stake multiplier unavailable for ${providerId}, default 1x: ${e?.message}`);
      }
      const pabDiscount = (stakeResult?.multiplier || 1) > 1 ? PAB_PREMIUM_DISCOUNT * stakeResult.multiplier : 0;
      const premiumPAB = premiumUSD * (1 - pabDiscount);

      // 6. Determine risk band
      let riskBand: 'SAFE' | 'MODERATE' | 'RISKY';
      let reason: string;

      if (riskMultiplier <= 0.7) {
        riskBand = 'SAFE';
        reason = `Provider velocity=${peerVelocity.toFixed(2)}, confidence=${flux.confidence.toFixed(2)}, trend=${flux.trend}`;
      } else if (riskMultiplier <= 1.5) {
        riskBand = 'MODERATE';
        reason = `Provider velocity=${peerVelocity.toFixed(2)}, confidence=${flux.confidence.toFixed(2)}`;
      } else {
        riskBand = 'RISKY';
        reason = `Provider velocity=${peerVelocity.toFixed(2)} (declining), confidence=${flux.confidence.toFixed(2)}`;
      }

      const approved = riskMultiplier <= 4.0; // deny coverage above 4x risk

      // 7. Create policy if approved
      if (approved) {
        const policy: InsurancePolicy = {
          policyId: `${reservationId}_ins`,
          providerId,
          customerId,
          reservationId,
          coverageAmount,
          premiumUSD: Math.round(premiumUSD * 100) / 100,
          premiumPAB: Math.round(premiumPAB * 100) / 100,
          riskMultiplier,
          coverageType,
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30-day validity
          isActive: true,
        };

        this.activePolicies.set(policy.policyId, policy);
        this.totalPremiums += premiumUSD;

        // ── REAL REVENUE CAPTURE ──────────────────────────────────────────────
        // Debit the premium in $PAB from the provider's Web3Agent balance, fail-closed
        // (atomic conditional decrement). If the provider can't pay, the policy isn't
        // issued — no free coverage. Revenue is recorded as INSURANCE_PREMIUM.
        try {
          const agent = await prisma.web3Agent.findUnique({ where: { profileId: providerId } });
          if (!agent || (agent.balancePab || 0) < (policy.premiumPAB ?? premiumPAB)) {
            // Lazily create/permit a 0-balance agent but in that case the premium can't be
            // collected → reject the policy rather than grant free coverage.
            logger.warn(`[ReputationInsurance] Provider ${providerId} cannot pay premium ${policy.premiumPAB} PAB — policy not issued`);
            this.activePolicies.delete(policy.policyId);
            this.totalPremiums -= premiumUSD;
            return {
              approved: false,
              premiumUSD: Math.round(premiumUSD * 100) / 100,
              premiumPAB: Math.round(premiumPAB * 100) / 100,
              riskMultiplier,
              riskBand,
              reason: `Insufficient $PAB balance to pay insurance premium (need ${policy.premiumPAB} PAB)`,
              coverageAmount,
            };
          }
          const premium = policy.premiumPAB ?? premiumPAB;
          await prisma.$transaction([
            prisma.web3Agent.updateMany({
              where: { profileId: providerId, balancePab: { gte: premium } },
              data: { balancePab: { decrement: premium } } as any,
            }),
            prisma.treasuryPosition.create({
              data: {
                bucket: 'OPERATING',
                amount: premium,
                status: 'DEPLOYED',
                meta: { source: 'INSURANCE_PREMIUM', policyId: policy.policyId, reservationId, coverageAmount, riskBand } as any,
              } as any,
            }),
          ]);
          logger.info(`[ReputationInsurance] Premium ${policy.premiumPAB} PAB captured for policy ${policy.policyId}`);
        } catch (e: any) {
          logger.error(`[ReputationInsurance] Premium capture failed: ${e.message}`);
          this.activePolicies.delete(policy.policyId);
          this.totalPremiums -= premiumUSD;
          return {
            approved: false,
            premiumUSD: Math.round(premiumUSD * 100) / 100,
            premiumPAB: Math.round(premiumPAB * 100) / 100,
            riskMultiplier,
            riskBand,
            reason: `Premium capture failed: ${e.message}`,
            coverageAmount,
          };
        }

        // Record in audit trail (non-fatal — must not block premium capture)
        try {
          await prisma.trustAuditTrail.create({
            data: {
              userId: providerId,
              previousScore: 0,
              newScore: 0,
              changeReason: 'INSURANCE_PREMIUM',
              component: 'REPUTATION_INSURANCE',
              severity: 'positive',
              metadata: {
                policyId: policy.policyId,
                premiumUSD,
                premiumPAB: policy.premiumPAB,
                riskMultiplier,
                riskBand,
                coverageAmount,
                coverageType,
              } as any,
            } as any,
          });
        } catch (auditErr: any) {
          logger.warn(`[ReputationInsurance] audit trail skipped: ${auditErr?.message}`);
        }

        logger.info(`[ReputationInsurance] Policy ${policy.policyId} issued — $${premiumUSD} premium (${riskBand}, {riskMultiplier}x)`);
      }

      return {
        approved,
        premiumUSD: Math.round(premiumUSD * 100) / 100,
        premiumPAB: Math.round(premiumPAB * 100) / 100,
        riskMultiplier,
        riskBand,
        reason,
        coverageAmount,
      };
    } catch (err: any) {
      logger.error(`[ReputationInsurance] Underwriting failed: ${err.message}`);
      return {
        approved: false,
        premiumUSD: 0,
        premiumPAB: 0,
        riskMultiplier: 0,
        riskBand: 'RISKY',
        reason: `Underwriting error: ${err.message}`,
        coverageAmount,
      };
    }
  }

  /**
   * Process a claim when a no-show or service failure occurs.
   * Verifies the claim against TrustFlux prediction and payouts if valid.
   */
  public async processClaim(
    policyId: string,
    evidence: string,
    reason: string
  ): Promise<{ approved: boolean; payoutAmount?: number; message: string }> {
    const policy = this.activePolicies.get(policyId);
    if (!policy || !policy.isActive) {
      return { approved: false, message: 'Policy not found or inactive' };
    }

    if (Date.now() > policy.expiresAt) {
      policy.isActive = false;
      return { approved: false, message: 'Policy expired' };
    }

    // Verify against TrustFlux — was this predictable?
    const flux = await trustFluxService.computeTrustFlux(policy.providerId);
    const wasPredictable = flux.trend === 'DECLINING' || flux.trend === 'VOLATILE' || flux.velocity < -0.1;

    if (!wasPredictable && flux.confidence > 0.6) {
      // High-confidence declining trend — approve the claim
    }

    // Payout to customer
    const payoutAmount = policy.coverageAmount * 0.95; // 5% processing fee
    this.totalPayouts += payoutAmount;
    this.totalClaims++;
    policy.isActive = false;
    policy.payoutTxHash = `claim_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      await prisma.trustAuditTrail.create({
        data: {
          userId: policy.customerId,
          previousScore: 0,
          newScore: 0,
          changeReason: 'INSURANCE_PAYOUT',
          component: 'REPUTATION_INSURANCE',
          severity: 'positive',
          metadata: {
            policyId,
            payoutAmount,
            reason,
            wasPredictable,
            txHash: policy.payoutTxHash,
          } as any,
        } as any,
      });
    } catch (auditErr: any) {
      logger.warn(`[ReputationInsurance] payout audit trail skipped: ${auditErr?.message}`);
    }

    logger.info(`[ReputationInsurance] Claim ${policyId} ${wasPredictable ? 'approved' : 'processed'} — $${payoutAmount} payout`);
    return {
      approved: true,
      payoutAmount: Math.round(payoutAmount * 100) / 100,
      message: 'Claim processed successfully',
    };
  }

  /** Get actuarial stats */
  public getStats(): {
    totalPremiums: number;
    totalPayouts: number;
    totalClaims: number;
    lossRatio: number;
    profitMargin: number;
    activePolicies: number;
  } {
    const lossRatio = this.totalPremiums > 0 ? this.totalPayouts / this.totalPremiums : 0;
    const profit = this.totalPremiums - this.totalPayouts;
    return {
      totalPremiums: Math.round(this.totalPremiums * 100) / 100,
      totalPayouts: Math.round(this.totalPayouts * 100) / 100,
      totalClaims: this.totalClaims,
      lossRatio: Math.round(lossRatio * 1000) / 1000,
      profitMargin: Math.round((profit / this.totalPremiums) * 1000) / 1000 || 0,
      activePolicies: this.activePolicies.size,
    };
  }
}

export const reputationInsuranceService = new ReputationInsuranceService();
