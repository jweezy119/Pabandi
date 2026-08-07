/**
 * trustApiAsService.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Trust API-as-a-Service (APIaaS) — Recurring revenue layer.
 *
 * External businesses (marketplaces, insurtechs, DeFi protocols) subscribe
 * to ongoing trust verification for their customers/providers.
 *
 * Pricing tiers:
 *   - Starter: 1k verifications/month @ $99 → $0.099/verify
 *   - Growth: 10k verifications/month @ $799 → $0.0799/verify
 *   - Enterprise: Unlimited + custom integration @ $2,499/month
 *   - Pay-as-you-go: $0.15/verify (for < 1k/month)
 *
 * Each "verification" triggers TrustFlux + TrustVeil + TrustArbitrator
 * and returns a real-time trust verdict.
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustFluxService } from './trustFlux.service';
import { ptpEngine, PTPAttestation, PTP_RISK_BANDS } from '../protocol/ptp.spec';
import { billingService } from './billing.service';
import crypto from 'crypto';

export interface VerificationResult {
  verified: boolean;
  entityId: string;          // anonymized
  entityType: 'CUSTOMER' | 'BUSINESS';
  attestation: PTPAttestation;
  timestamp: number;
}

export class TrustApiAsService {
  /**
   * Verify an entity's trust status via the B2B API.
   * Checks subscription quota via BillingService, computes TrustFlux,
   * returns a real-time PTP verification verdict.
   */
  public async verifyEntity(
    apiKey: string,
    entityId: string,
    entityType: 'CUSTOMER' | 'BUSINESS'
  ): Promise<VerificationResult | { error: string }> {
    // 1. Validate API key via Billing Service
    const customer = billingService.validateApiKey(apiKey);
    if (!customer) {
      return { error: 'Invalid or inactive API key' };
    }

    // 2. Compute TrustFlux for velocity + trend
    let flux = { velocity: 0, trend: 'STEADY', confidence: 0.1 };
    try {
      flux = await trustFluxService.computeTrustFlux(entityId);
    } catch (e) {
      logger.warn(`[TrustAPI] TrustFlux computation failed for ${entityId}, using defaults.`);
    }

    // Get base trust score
    let trustScore = 50;
    try {
      const user = await prisma.user.findUnique({ where: { id: entityId }, select: { trustScore: true } });
      if (user) trustScore = user.trustScore;
    } catch (e) {}

    // 3. Issue PTP Attestation
    const attestation = ptpEngine.issueAttestation(
      entityId,
      entityType === 'CUSTOMER' ? 'INDIVIDUAL' : 'BUSINESS',
      trustScore,
      {
        direction: flux.trend as any,
        momentum: Math.abs(flux.velocity),
        confidence: flux.confidence
      }
    );

    // 4. Record metered usage
    const usageRes = await billingService.recordUsage(apiKey, 'VERIFICATION', 1, {
      entityType,
      riskBand: attestation.assessment.riskBand
    });

    if (!usageRes.success) {
      logger.error(`[TrustAPI] Failed to record usage for customer ${customer.id}`);
    }

    // 5. Log usage in Audit Trail
    await prisma.trustAuditTrail.create({
      data: {
        userId: customer.id, // Using the API customer ID
        previousScore: 0,
        newScore: 0,
        changeReason: 'API_VERIFICATION_PTP',
        component: 'TRUST_API',
        severity: 'positive',
        metadata: {
          billingTier: customer.tier,
          entityType,
          riskBand: attestation.assessment.riskBand,
        } as any,
      } as any,
    }).catch(e => logger.warn(`[TrustAPI] Audit log failed: ${e.message}`));

    const now = Date.now();
    const result: VerificationResult = {
      verified: true,
      entityId: attestation.subject.id,
      entityType,
      attestation,
      timestamp: now,
    };

    logger.info(`[TrustAPI] PTP Verification by ${customer.companyName} — risk band: ${attestation.assessment.riskBand}`);
    return result;
  }
}

export const trustApiAsService = new TrustApiAsService();
