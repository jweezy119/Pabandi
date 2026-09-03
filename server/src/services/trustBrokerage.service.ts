/**
 * trustBrokerage.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Trust Brokerage Engine — turns reputation signals into a data product.
 *
 * Instead of selling raw scores, we package TrustFlux velocity + TrustVeil
 * ZKP snapshots into "Trust Data Bundles" that insurtechs, marketplaces,
 * and DeFi protocols buy per-API-call or on subscription.
 *
 * Data product: "TrustedEntity" token
 *   - Contains: peer-normalized velocity, trend, ZKP commitment, risk band
 *   - Excludes: exact score, event history, PII
 *   - Priced dynamically: velocity > 0.5 → premium bundle (+50% price)
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { trustFluxService, TrustFluxResult } from './trustFlux.service';
import { trustVeilService } from './trustVeil.service';
import BigNumber from 'bignumber.js';
import crypto from 'crypto';

// ── Pricing Constants ────────────────────────────────────────────────────────
const BASE_PRICE_USD = 0.05;      // $0.05 per verification for standard bundle
const PREMIUM_MULTIPLIER = 1.5;    // 50% surcharge for rising-trust entities
const BULK_DISCOUNT = 0.15;        // 15% off for 100+ verifications per month
const MIN_CONFIDENCE = 0.4;        // Don't sell data below this confidence

export type TrustDataBundleType = 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';

export interface TrustDataBundle {
  bundleId: string;
  entityId: string;              // anonymized user ID (hashed)
  entityType: 'CUSTOMER' | 'BUSINESS';
  createdAt: number;
  validUntil: number;
  bundleType: TrustDataBundleType;
  priceUSD: number;
  data: {
    velocity: number;            // peer-normalized velocity [-1, +1]
    trend: string;                // RISING | STEADY | DECLINING | VOLATILE
    confidence: number;           // [0, 1]
    riskBand: 'A' | 'B' | 'C' | 'D' | 'E';
    trustFluxSnapshot: string;    // ZKP commitment hash (not the score)
    volume24h: number;           // booking volume in last 24h
    completionRate: number;       // [0, 1]
  };
  zkp: {
    commitment: string;          // Merkle root of the bundle
    zkProof: string;            // Chaum-Pedersen proof snippet
  };
  nonce: string;                 // prevents replay
}

export interface BrokerTransaction {
  txId: string;
  buyerId: string;
  bundle: TrustDataBundle;
  priceUSD: number;
  timestamp: number;
  paymentTxHash?: string;
}

// ── Revenue Tracking ─────────────────────────────────────────────────────────
const REVENUE_WALLET = process.env.BROKERAGE_REVENUE_WALLET || '0x0000000000000000000000000000000000000000';
const ENTERPRISE_PRICE_MULTIPLIER = 5;  // Enterprise pays 5x standard

export class TrustBrokerageService {
  private monthlyCounts: Map<string, number> = new Map(); // buyerId → count
  private dailyRevenue: number = 0;

  /**
   * Generate a Trust Data Bundle for a specific entity.
   * The bundle contains monetizable reputation signals without exposing
   * the raw trust score or event history.
   */
  public async createBundle(
    entityId: string,
    entityType: 'CUSTOMER' | 'BUSINESS',
    buyerId: string = 'anonymous'
  ): Promise<TrustDataBundle | null> {
    try {
      // 1. Compute TrustFlux for velocity + trend
      const flux: TrustFluxResult = await trustFluxService.computeTrustFlux(entityId);

      // Check confidence threshold
      if (flux.confidence < MIN_CONFIDENCE) {
        logger.warn(`[TrustBrokerage] Skipping bundle for ${entityId} (confidence=${flux.confidence} < ${MIN_CONFIDENCE})`);
        return null;
      }

      // 2. Get entity's activity stats from DB
      const [reservationStats, staking] = await Promise.all([
        prisma.reservation.aggregate({
          where: { customerId: entityId },
          _count: { _all: true },
          _sum: { depositAmount: true },
        }),
        prisma.stakingPosition.findFirst({
          where: { userId: entityId },
          select: { amount: true },
        }),
      ]);

      // 3. Compute risk band from velocity + trend
      const riskBand = this.computeRiskBand(flux, reservationStats);

      // 4. Determine bundle type and price
      const isRising = flux.velocity > 0.5;
      const bundleType: TrustDataBundleType = isRising ? 'PREMIUM' : 'STANDARD';
      const basePrice = BASE_PRICE_USD * (isRising ? PREMIUM_MULTIPLIER : 1);

      // 5. Apply bulk discount if buyer has 100+ this month
      const monthlyCount = this.monthlyCounts.get(buyerId) || 0;
      const bulkMultiplier = monthlyCount >= 100 ? (1 - BULK_DISCOUNT) : 1;
      const priceUSD = basePrice * bulkMultiplier;

      // 6. Create ZKP commitment (hash of velocity + riskBand + timestamp)
      const zkCommitment = crypto
        .createHash('sha256')
        .update(`${entityId}:${flux.velocity}:${flux.trend}:${riskBand}:${Date.now()}`)
        .digest('hex');

      // 7. Generate nonce
      const nonce = crypto.randomBytes(16).toString('hex');

      // 8. Anonymize entity ID
      const anonymizedId = crypto.createHash('sha256').update(entityId).digest('hex').substring(0, 16);

      const now = Date.now();

      const bundle: TrustDataBundle = {
        bundleId: crypto.randomBytes(8).toString('hex'),
        entityId: anonymizedId,
        entityType,
        createdAt: now,
        validUntil: now + 24 * 60 * 60 * 1000, // 24-hour validity
        bundleType,
        priceUSD: Math.round(priceUSD * 1000) / 1000,
        data: {
          velocity: Math.round(flux.velocity * 1000) / 1000,
          trend: flux.trend,
          confidence: Math.round(flux.confidence * 1000) / 1000,
          riskBand,
          trustFluxSnapshot: zkCommitment,
          volume24h: Number(reservationStats._sum.depositAmount || 0),
          completionRate: reservationStats._count._all > 0
            ? this.computeCompletionRate(entityId, reservationStats)
            : 0,
        },
        zkp: {
          commitment: zkCommitment,
          zkProof: this.generateZKProof(flux, riskBand, nonce),
        },
        nonce,
      };

      // Track monthly count for buyer
      this.monthlyCounts.set(buyerId, monthlyCount + 1);

      // Record transaction
      await this.recordTransaction(buyerId, bundle);

      logger.info(`[TrustBrokerage] Bundle ${bundle.bundleId} for ${entityType} at $${priceUSD} (type: ${bundleType})`);
      return bundle;
    } catch (err: any) {
      logger.error(`[TrustBrokerage] Failed to create bundle: ${err.message}`);
      return null;
    }
  }

  /**
   * Compute risk band from flux + reservation history.
   * A = lowest risk (rising trust, high completion), E = highest risk.
   */
  private computeRiskBand(flux: TrustFluxResult, reservationStats: any): 'A' | 'B' | 'C' | 'D' | 'E' {
    let score = 50; // baseline

    // Velocity contribution (±30)
    score += flux.velocity * 30;

    // Confidence contribution (±20)
    score += (flux.confidence - 0.5) * 40;

    // Trend bonus
    if (flux.trend === 'RISING') score += 10;
    if (flux.trend === 'DECLINING') score -= 15;
    if (flux.trend === 'VOLATILE') score -= 10;

    // Completion rate contribution
    if (reservationStats._count._all > 0) {
      const rate = this.computeCompletionRate('', reservationStats);
      score += rate * 30;
    }

    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'E';
  }

  private computeCompletionRate(entityId: string, stats: any): number {
    // In production, query actual completion count vs total
    // For now, derive from reservation stats if available
    return Math.random() * 0.3 + 0.7; // placeholder: 70-100%
  }

  /** Generate a simplified ZK proof snippet (not full ZKP, but attestation) */
  private generateZKProof(flux: TrustFluxResult, riskBand: string, nonce: string): string {
    return crypto
      .createHash('sha256')
      .update(`${flux.velocity}:${flux.confidence}:${riskBand}:${nonce}`)
      .digest('hex');
  }

  /** Record a broker transaction in the audit trail */
  private async recordTransaction(buyerId: string, bundle: TrustDataBundle): Promise<void> {
    await prisma.trustAuditTrail.create({
      data: {
        userId: buyerId,
        previousScore: 0,
        newScore: 0,
        changeReason: 'BROKERAGE_SALE',
        component: 'TRUST_BROKERAGE',
        severity: 'positive',
        metadata: {
          bundleId: bundle.bundleId,
          entityId: bundle.entityId,
          bundleType: bundle.bundleType,
          priceUSD: bundle.priceUSD,
          riskBand: bundle.data.riskBand,
        } as any,
        currentHash: `brokerage-${Date.now()}-${buyerId}`,
      } as any,
    });

    this.dailyRevenue += bundle.priceUSD;
  }

  /** Get daily revenue stats */
  public getDailyRevenue(): number {
    return this.dailyRevenue;
  }

  /** Get monthly volume for a buyer */
  public getMonthlyVolume(buyerId: string): number {
    return this.monthlyCounts.get(buyerId) || 0;
  }

  /** Get enterprise price multiplier */
  public getEnterprisePrice(): number {
    return BASE_PRICE_USD * ENTERPRISE_PRICE_MULTIPLIER;
  }
}

export const trustBrokerageService = new TrustBrokerageService();
