import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { ptpEngine, PTP_RISK_BANDS, PTPRiskBand } from '../protocol/ptp.spec';

/**
 * TrustGuaranteeService — Financial Guarantees Backed by Trust Scores
 * ────────────────────────────────────────────────────────────────────────────
 * The highest-revenue-ceiling product in PTP.
 *
 * When a merchant uses PTP to verify a buyer, and the buyer has Band A/B trust,
 * Pabandi offers a FINANCIAL GUARANTEE — if the buyer commits fraud or no-shows,
 * Pabandi covers the merchant's loss up to the guaranteed amount.
 *
 * Why this works:
 *   - Band A has <0.5% fraud probability → expected loss on $500 guarantee = $2.50
 *   - We charge 0.5% fee → $2.50 per guarantee
 *   - Net expected profit per guarantee = ~$0 at Band A (break-even = trust)
 *   - But at scale with blended Band A/B: expected profit margin is ~40-60%
 *   - This is literally how insurance works, but backed by real intelligence
 *
 * Revenue example:
 *   10,000 guaranteed transactions/month × $50 avg × 1% avg fee = $5,000/month
 *   Expected payout: ~$250-500/month (Band A/B fraud rate)
 *   Net margin: ~$4,500/month
 *
 * This makes PTP economically rational for merchants — they save more on fraud
 * losses than they pay for PTP guarantees.
 */

export interface GuaranteePolicy {
  id: string;
  merchantId: string;
  buyerId: string;
  buyerRiskBand: PTPRiskBand;
  transactionAmountUSD: number;
  guaranteedAmountUSD: number;
  feeUSD: number;
  feePercent: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'PAID_OUT' | 'DENIED';
  coverageType: 'FRAUD' | 'NO_SHOW' | 'BOTH';
  createdAt: number;
  expiresAt: number;
  transactionId?: string;
  claimId?: string;
}

export interface GuaranteeClaim {
  id: string;
  policyId: string;
  merchantId: string;
  claimType: 'FRAUD' | 'NO_SHOW';
  claimAmountUSD: number;
  evidence: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED' | 'PAID_OUT';
  submittedAt: number;
  resolvedAt?: number;
  payoutAmountUSD?: number;
  denialReason?: string;
}

// In-memory stores (production: DB + Stripe)
const activePolicies = new Map<string, GuaranteePolicy>();
const claims = new Map<string, GuaranteeClaim>();

// Platform-level risk pool
let totalGuaranteedUSD = 0;
let totalFeesCollectedUSD = 0;
let totalPayoutsUSD = 0;

export class TrustGuaranteeService {

  /**
   * Purchase a transaction guarantee.
   * Only available for Band A and Band B buyers.
   */
  public async purchaseGuarantee(
    merchantId: string,
    buyerId: string,
    transactionAmountUSD: number,
    buyerTrustScore: number
  ): Promise<GuaranteePolicy | { error: string }> {
    const riskBand = ptpEngine.scoreToRiskBand(buyerTrustScore);
    const bandSpec = PTP_RISK_BANDS[riskBand];

    // Only Band A and B are eligible for guarantees
    if (bandSpec.guaranteeMaxUSD <= 0) {
      return {
        error: `Buyer's risk band (${riskBand}: ${bandSpec.label}) is not eligible for guarantees. Band A or B required.`,
      };
    }

    // Cap the guarantee at the band's maximum
    const guaranteedAmount = Math.min(transactionAmountUSD, bandSpec.guaranteeMaxUSD);

    // Calculate fee
    const feePercent = bandSpec.guaranteeFeePercent;
    const feeUSD = Math.round(guaranteedAmount * (feePercent / 100) * 100) / 100;

    // Issue policy
    const policy: GuaranteePolicy = {
      id: `guar_${crypto.randomBytes(8).toString('hex')}`,
      merchantId,
      buyerId,
      buyerRiskBand: riskBand,
      transactionAmountUSD,
      guaranteedAmountUSD: guaranteedAmount,
      feeUSD,
      feePercent,
      status: 'ACTIVE',
      coverageType: 'BOTH',
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    activePolicies.set(policy.id, policy);
    totalGuaranteedUSD += guaranteedAmount;
    totalFeesCollectedUSD += feeUSD;

    // Record in audit trail
    await prisma.trustAuditTrail.create({
      data: {
        userId: merchantId,
        previousScore: 0,
        newScore: 0,
        changeReason: 'GUARANTEE_PURCHASED',
        component: 'PTP_GUARANTEE',
        severity: 'positive',
        metadata: {
          policyId: policy.id,
          guaranteedAmountUSD: guaranteedAmount,
          feeUSD,
          buyerRiskBand: riskBand,
          transactionAmountUSD,
        } as any,
      } as any,
    }).catch(err => logger.warn(`[Guarantee] Audit trail write failed: ${err.message}`));

    logger.info(`[Guarantee] Policy ${policy.id}: $${guaranteedAmount} guaranteed for Band ${riskBand} buyer (fee: $${feeUSD})`);

    return policy;
  }

  /**
   * File a guarantee claim when a guaranteed transaction goes wrong.
   */
  public async fileClaim(
    policyId: string,
    merchantId: string,
    claimType: 'FRAUD' | 'NO_SHOW',
    claimAmountUSD: number,
    evidence: string
  ): Promise<GuaranteeClaim | { error: string }> {
    const policy = activePolicies.get(policyId);

    if (!policy) {
      return { error: 'Guarantee policy not found' };
    }

    if (policy.merchantId !== merchantId) {
      return { error: 'Unauthorized: you are not the policy holder' };
    }

    if (policy.status !== 'ACTIVE') {
      return { error: `Policy is ${policy.status}, not claimable` };
    }

    if (Date.now() > policy.expiresAt) {
      policy.status = 'EXPIRED';
      return { error: 'Guarantee policy has expired' };
    }

    if (claimAmountUSD > policy.guaranteedAmountUSD) {
      return { error: `Claim amount ($${claimAmountUSD}) exceeds guaranteed amount ($${policy.guaranteedAmountUSD})` };
    }

    const claim: GuaranteeClaim = {
      id: `claim_${crypto.randomBytes(8).toString('hex')}`,
      policyId,
      merchantId,
      claimType,
      claimAmountUSD,
      evidence,
      status: 'PENDING',
      submittedAt: Date.now(),
    };

    claims.set(claim.id, claim);
    policy.status = 'CLAIMED';
    policy.claimId = claim.id;

    // Auto-adjudicate small claims (< $50) for Band A buyers
    if (claimAmountUSD < 50 && policy.buyerRiskBand === 'A') {
      claim.status = 'APPROVED';
      claim.payoutAmountUSD = claimAmountUSD;
      claim.resolvedAt = Date.now();
      policy.status = 'PAID_OUT';
      totalPayoutsUSD += claimAmountUSD;

      logger.info(`[Guarantee] Auto-approved claim ${claim.id}: $${claimAmountUSD} (Band A, small claim)`);
    } else {
      claim.status = 'UNDER_REVIEW';
      logger.info(`[Guarantee] Claim ${claim.id} submitted for review: $${claimAmountUSD} (${claimType})`);
    }

    return claim;
  }

  /**
   * Adjudicate a claim (admin action).
   */
  public async adjudicateClaim(
    claimId: string,
    decision: 'APPROVE' | 'DENY',
    payoutAmount?: number,
    denialReason?: string
  ): Promise<GuaranteeClaim | { error: string }> {
    const claim = claims.get(claimId);
    if (!claim) return { error: 'Claim not found' };

    const policy = activePolicies.get(claim.policyId);

    if (decision === 'APPROVE') {
      const payout = payoutAmount || claim.claimAmountUSD;
      claim.status = 'APPROVED';
      claim.payoutAmountUSD = payout;
      claim.resolvedAt = Date.now();
      totalPayoutsUSD += payout;

      if (policy) policy.status = 'PAID_OUT';

      // Penalize the buyer's trust score
      try {
        const { trustScoreService } = await import('./trustScore.service');
        await trustScoreService.processEvent(claim.merchantId, {
          component: 'PTP_GUARANTEE',
          reason: `Guarantee claim paid: ${claim.claimType}`,
          severity: 'negative',
        });
      } catch {}

      logger.info(`[Guarantee] Claim ${claimId} APPROVED: $${payout} payout`);
    } else {
      claim.status = 'DENIED';
      claim.denialReason = denialReason || 'Insufficient evidence';
      claim.resolvedAt = Date.now();

      if (policy) policy.status = 'ACTIVE'; // Reactivate policy

      logger.info(`[Guarantee] Claim ${claimId} DENIED: ${denialReason}`);
    }

    return claim;
  }

  /**
   * Get platform-wide guarantee risk pool stats.
   */
  public getRiskPoolStats(): {
    totalGuaranteedUSD: number;
    totalFeesCollectedUSD: number;
    totalPayoutsUSD: number;
    netRevenueUSD: number;
    lossRatio: number;           // payouts / fees (< 1 = profitable)
    activePolicies: number;
    pendingClaims: number;
  } {
    const pendingClaims = Array.from(claims.values()).filter(
      c => c.status === 'PENDING' || c.status === 'UNDER_REVIEW'
    ).length;

    return {
      totalGuaranteedUSD: Math.round(totalGuaranteedUSD * 100) / 100,
      totalFeesCollectedUSD: Math.round(totalFeesCollectedUSD * 100) / 100,
      totalPayoutsUSD: Math.round(totalPayoutsUSD * 100) / 100,
      netRevenueUSD: Math.round((totalFeesCollectedUSD - totalPayoutsUSD) * 100) / 100,
      lossRatio: totalFeesCollectedUSD > 0
        ? Math.round((totalPayoutsUSD / totalFeesCollectedUSD) * 1000) / 1000
        : 0,
      activePolicies: Array.from(activePolicies.values()).filter(p => p.status === 'ACTIVE').length,
      pendingClaims,
    };
  }

  /**
   * Get guarantee eligibility and pricing for a specific buyer.
   */
  public getEligibility(buyerTrustScore: number, transactionAmountUSD: number): {
    eligible: boolean;
    riskBand: PTPRiskBand;
    guaranteedAmountUSD: number;
    feeUSD: number;
    feePercent: number;
    coverageDescription: string;
  } {
    const riskBand = ptpEngine.scoreToRiskBand(buyerTrustScore);
    const bandSpec = PTP_RISK_BANDS[riskBand];

    if (bandSpec.guaranteeMaxUSD <= 0) {
      return {
        eligible: false,
        riskBand,
        guaranteedAmountUSD: 0,
        feeUSD: 0,
        feePercent: 0,
        coverageDescription: `Band ${riskBand} (${bandSpec.label}) is not eligible for guarantees. Minimum Band B required.`,
      };
    }

    const guaranteedAmount = Math.min(transactionAmountUSD, bandSpec.guaranteeMaxUSD);
    const feePercent = bandSpec.guaranteeFeePercent;
    const feeUSD = Math.round(guaranteedAmount * (feePercent / 100) * 100) / 100;

    return {
      eligible: true,
      riskBand,
      guaranteedAmountUSD: guaranteedAmount,
      feeUSD,
      feePercent,
      coverageDescription: `Band ${riskBand} (${bandSpec.label}): Up to $${guaranteedAmount} guaranteed against fraud and no-shows. Expected fraud rate: ${(bandSpec.fraudProbability * 100).toFixed(1)}%.`,
    };
  }
}

export const trustGuaranteeService = new TrustGuaranteeService();
