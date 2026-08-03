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
import { trustVeilService } from './trustVeil.service';
import { trustBrokerageService } from './trustBrokerage.service';
import crypto from 'crypto';

export type ApiTier = 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'PAY_AS_YOU_GO';

export interface ApiSubscription {
  id: string;
  buyerId: string;
  buyerName: string;
  tier: ApiTier;
  monthlyLimit: number;      // verifications/month
  usedThisMonth: number;
  priceUSD: number;
  active: boolean;
  webhookUrl?: string;
  createdAt: number;
  renewsAt: number;
  apiKey: string;
}

export interface VerificationResult {
  verified: boolean;
  entityId: string;          // anonymized
  entityType: 'CUSTOMER' | 'BUSINESS';
  velocity: number;
  trend: string;
  confidence: number;
  riskBand: string;
  zkProof: string;
  trustScoreVerifiable: boolean;
  timestamp: number;
  expiresAt: number;
}

// ── Pricing ─────────────────────────────────────────────────────────────────
const TIER_PRICING: Record<ApiTier, { price: number; limit: number; perVerify: number }> = {
  PAY_AS_YOU_GO: { price: 0, limit: 999, perVerify: 0.15 },
  STARTER:       { price: 99,  limit: 1000, perVerify: 0 },
  GROWTH:        { price: 799, limit: 10000, perVerify: 0 },
  ENTERPRISE:    { price: 2499, limit: Infinity, perVerify: 0 },
};

// ── Usage tracking (in production, Redis) ─────────────────────────────────────
const activeSubscriptions = new Map<string, ApiSubscription>();

export class TrustApiAsService {
  /**
   * Register a new subscription. Returns the API key for authentication.
   */
  public async subscribe(
    buyerId: string,
    buyerName: string,
    tier: ApiTier,
    webhookUrl?: string
  ): Promise<ApiSubscription> {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const pricing = TIER_PRICING[tier];

    const subscription: ApiSubscription = {
      id: crypto.randomBytes(8).toString('hex'),
      buyerId,
      buyerName,
      tier,
      monthlyLimit: pricing.limit,
      usedThisMonth: 0,
      priceUSD: pricing.price,
      active: true,
      webhookUrl,
      createdAt: Date.now(),
      renewsAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      apiKey,
    };

    activeSubscriptions.set(apiKey, subscription);
    logger.info(`[TrustAPI] Subscription created for ${buyerName} (tier: ${tier}, $${pricing.price}/mo)`);
    return subscription;
  }

  /**
   * Verify an entity's trust status via API.
   * Checks subscription quota, computes TrustFlux + TrustVeil,
   * returns a real-time verification verdict.
   */
  public async verifyEntity(
    apiKey: string,
    entityId: string,
    entityType: 'CUSTOMER' | 'BUSINESS'
  ): Promise<VerificationResult | { error: string }> {
    // 1. Validate API key
    const subscription = activeSubscriptions.get(apiKey);
    if (!subscription || !subscription.active) {
      return { error: 'Invalid or inactive API key' };
    }

    // 2. Check quota
    if (subscription.usedThisMonth >= subscription.monthlyLimit) {
      return { error: `Monthly limit of ${subscription.monthlyLimit} reached. Upgrade or wait for renewal.` };
    }

    // 3. Compute TrustFlux + TrustVeil
    const flux = await trustFluxService.computeTrustFlux(entityId);
    const zkProof = await trustVeilService.issueProof(entityId, 75, 70); // demo threshold

    // Determine risk band
    const riskBand = this.getRiskBand(flux.velocity, flux.confidence, flux.trend);

    // 4. Increment usage
    subscription.usedThisMonth++;

    // 5. Log usage
    await prisma.trustAuditTrail.create({
      data: {
        userId: subscription.buyerId,
        previousScore: 0,
        newScore: 0,
        changeReason: 'API_VERIFICATION',
        component: 'TRUST_API',
        severity: 'positive',
        metadata: {
          subscriptionId: subscription.id,
          entityId: crypto.createHash('sha256').update(entityId).digest('hex').substring(0, 16),
          riskBand,
          velocity: flux.velocity,
          tier: subscription.tier,
        } as any,
      } as any,
    });

    // 6. Trigger webhook if configured
    if (subscription.webhookUrl) {
      this.triggerWebhook(subscription.webhookUrl, {
        entityId: crypto.createHash('sha256').update(entityId).digest('hex').substring(0, 16),
        riskBand,
        velocity: flux.velocity,
        timestamp: Date.now(),
      });
    }

    const now = Date.now();
    const result: VerificationResult = {
      verified: true,
      entityId: crypto.createHash('sha256').update(entityId).digest('hex').substring(0, 16),
      entityType,
      velocity: Math.round(flux.velocity * 1000) / 1000,
      trend: flux.trend,
      confidence: Math.round(flux.confidence * 1000) / 1000,
      riskBand,
      zkProof: zkProof.signature,
      trustScoreVerifiable: zkProof.rangeProof.bits.length === 7,
      timestamp: now,
      expiresAt: now + 60 * 60 * 1000, // 1 hour
    };

    logger.info(`[TrustAPI] Verification for ${entityType} by ${subscription.buyerName} — risk band: ${riskBand}`);
    return result;
  }

  /** Calculate monthly cost for a given verification count (for usage-based billing) */
  public calculateUsageCost(verifications: number): { tier: ApiTier; cost: number } {
    for (const tier of ['ENTERPRISE', 'GROWTH', 'STARTER'] as ApiTier[]) {
      if (verifications <= TIER_PRICING[tier].limit) {
        return { tier, cost: TIER_PRICING[tier].price };
      }
    }
    // Pay-as-you-go
    return { tier: 'PAY_AS_YOU_GO', cost: verifications * TIER_PRICING.PAY_AS_YOU_GO.perVerify };
  }

  /** Get subscription stats (usage, billing, etc.) */
  public getSubscriptionStats(apiKey: string): { used: number; limit: number; price: number; tier: ApiTier } | null {
    const sub = activeSubscriptions.get(apiKey);
    if (!sub) return null;
    return {
      used: sub.usedThisMonth,
      limit: sub.monthlyLimit,
      price: sub.priceUSD,
      tier: sub.tier,
    };
  }

  private getRiskBand(velocity: number, confidence: number, trend: string): string {
    let band = 'C'; // default medium risk
    if (velocity > 0.3 && confidence > 0.6 && (trend === 'RISING' || trend === 'STEADY')) band = 'A';
    else if (velocity > 0 && confidence > 0.5) band = 'B';
    else if (velocity < -0.2 || trend === 'DECLINING') band = 'E';
    else if (velocity < 0 || confidence < 0.3) band = 'D';
    return band;
  }

  private async triggerWebhook(url: string, data: any): Promise<void> {
    try {
      const payload = JSON.stringify(data);
      const signature = crypto.createHmac('sha256', process.env.API_WEBHOOK_SECRET || 'default').update(payload).digest('hex');
      // In production: HTTP POST with retry
      logger.info(`[TrustAPI] Webhook → ${url} (signature: ${signature.substring(0, 16)}...)`);
    } catch (err: any) {
      logger.error(`[TrustAPI] Webhook failed: ${err.message}`);
    }
  }
}

export const trustApiAsService = new TrustApiAsService();
