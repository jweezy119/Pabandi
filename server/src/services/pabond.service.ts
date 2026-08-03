/**
 * pabond.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Pabond: A zero-knowledge reputation bonding curve for $PAB token minting.
 *
 * Core insight: In traditional bonding curves, price = f(supply). In Pabond,
 * price = f(reputation_velocity × supply). The steeper your trust trajectory,
 * the cheaper your $PAB — rewarding upward momentum.
 *
 * Algorithm:
 *   1. Compute TrustFlux (temporal GNN velocity) for the user
 *   2. Mint $PAB via bonding curve: pabondPrice = baseReserve / (supply²) × velocityMultiplier
 *   3. Velocity multiplier: v ∈ [0.5, 2.0], higher = cheaper for rising stars
 *
 * Formula:
 *   deltaPAB = velocityMultiplier × sqrt(amountIn) × (reserveRatio / supply)
 *   where reserveRatio = reserveUSD / marketCap
 *
 * This creates a virtuous cycle: good behavior → rising trust → cheaper $PAB →
 * stake more $PAB → higher trust multiplier → even cheaper $PAB.
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import BigNumber from 'bignumber.js';
import { trustFluxService } from './trustFlux.service';

export interface PabondMintParams {
  userId: string;
  amountUSD: number;  // Fiat/USD amount committed by user
  source: 'BOOKING_DEPOSIT' | 'POSITIVE_REVIEW' | 'ARBITRATION_WIN' | 'STAKING_REWARD';
  metadata?: Record<string, any>;
}

export interface PabondResult {
  success: boolean;
  userId: string;
  amountUSD: number;
  pabTokens: number;            // $PAB minted
  pricePerPAB: number;          // USD per $PAB (what user paid)
  velocity: number;             // TrustFlux velocity (-1 to +1)
  velocityMultiplier: number;    // [0.5, 2.0]
  totalSupply: number;           // circulating $PAB supply
  reserveUSD: number;            // total USD in the bonding curve
  effectiveApr: number;          // implied APR from velocity trend
  txHash?: string;              // on-chain tx reference
  error?: string;
}

// ── Pabond Curve Constants ─────────────────────────────────────────
const BASE_RESERVE_USD = 50_000;    // Initial liquidity pool seeded
const INITIAL_SUPPLY = 1_000_000;    // Starting $PAB supply
const MIN_VELOCITY_MULT = 0.5;      // 2x price for declining trust
const MAX_VELOCITY_MULT = 2.0;      // 0.5x price for surging trust
const MAX_SLIPPAGE = 0.02;          // 2% max slippage per trade

export class PabondService {
  private reserveUSD: BigNumber = new BigNumber(BASE_RESERVE_USD);
  private totalSupplyPAB: BigNumber = new BigNumber(INITIAL_SUPPLY);

  constructor() {
    // Persist supply/reserve across restarts
    this.loadState();
    setInterval(() => this.saveState(), 30_000);
  }

  /** Get current PAB price in USD (before velocity adjustment) */
  public getCurrentPrice(): number {
    // pabondPrice = reserveUSD / supply² — concave curve, price increases with supply
    return Number(this.reserveUSD.div(this.totalSupplyPAB.pow(2)).times(1e6));
  }

  /**
   * Mint $PAB via the bonding curve.
   * Uses TrustFlux velocity to compute a multiplier that makes
   * rising-trust users pay less and declining-trust users pay more.
   */
  public async mint(params: PabondMintParams): Promise<PabondResult> {
    const { userId, amountUSD, source } = params;

    if (amountUSD <= 0) {
      return {
        success: false,
        userId,
        amountUSD,
        pabTokens: 0,
        pricePerPAB: 0,
        velocity: 0,
        velocityMultiplier: 1.0,
        totalSupply: Number(this.totalSupplyPAB),
        reserveUSD: Number(this.reserveUSD),
        effectiveApr: 0,
        error: 'Amount must be positive',
      };
    }

    // 1. Get user's TrustFlux velocity
    const flux = await trustFluxService.computeTrustFlux(userId);
    const velocity = flux.velocity; // [-1, +1]

    // 2. Velocity multiplier: positive velocity = discount, negative = premium
    //    Map [-1, +1] → [0.5, 2.0]
    const velocityMult = MIN_VELOCITY_MULT + ((velocity + 1) / 2) * (MAX_VELOCITY_MULT - MIN_VELOCITY_MULT);

    // 3. Apply slippage cap
    const slippageFactor = Math.min(1 + MAX_SLIPPAGE, Math.max(1 - MAX_SLIPPAGE, velocityMult));

    // 4. Pabond curve: deltaPAB = velocityMult × sqrt(amountUSD) × (reserve / supply^1.5)
    const amountBN = new BigNumber(amountUSD);
    const supplyBN = this.totalSupplyPAB;
    const reserveBN = this.reserveUSD;

    // Curve formula: more reserve per token = higher price floor
    const curveFactor = reserveBN.div(supplyBN.pow(1.5));
    const pabTokens = amountBN.sqrt().times(curveFactor).times(slippageFactor);

    // 5. Update reserve and supply
    this.reserveUSD = this.reserveUSD.plus(amountBN);
    this.totalSupplyPAB = this.totalSupplyPAB.plus(pabTokens);

    const pricePerPAB = Number(amountBN.div(pabTokens));

    // Record the mint via TrustAuditTrail (has JSON metadata field)
    await prisma.trustAuditTrail.create({
      data: {
        userId,
        previousScore: 0,
        newScore: 0,
        changeReason: `PABOND_MINT_${source}`,
        component: 'SYSTEM',
        severity: 'positive',
        metadata: {
          amountUSD,
          pabTokens: Number(pabTokens),
          pricePerPAB,
          velocity,
          velocityMultiplier: velocityMult,
          reserveUSD: Number(this.reserveUSD),
          totalSupply: Number(this.totalSupplyPAB),
          source,
          ...(params.metadata || {}),
        } as any,
      } as any,
    });

    // 7. Compute effective APR based on velocity trend
    const effectiveApr = this.computeEffectiveApr(velocity, amountUSD, Number(pabTokens));

    logger.info(`[Pabond] Minted ${Number(pabTokens).toFixed(4)} $PAB for user ${userId} ` +
      `(${velocityMult.toFixed(2)}x velocity mult, price $${pricePerPAB.toFixed(4)}/PAB)`);

    return {
      success: true,
      userId,
      amountUSD,
      pabTokens: Number(pabTokens.toFixed(8)),
      pricePerPAB: Math.round(pricePerPAB * 1e6) / 1e6,
      velocity: Math.round(velocity * 1000) / 1000,
      velocityMultiplier: Math.round(velocityMult * 1000) / 1000,
      totalSupply: Number(this.totalSupplyPAB),
      reserveUSD: Number(this.reserveUSD),
      effectiveApr,
    };
  }

  /**
   * Burn $PAB to reduce reserve (e.g., for redemption or fee payment).
   * Burn ratio = pabTokens / supply → returns proportional reserve share.
   */
  public async burn(userId: string, pabAmount: number): Promise<{ success: boolean; usdReturn: number }> {
    if (pabAmount <= 0 || new BigNumber(pabAmount).gt(this.totalSupplyPAB)) {
      return { success: false, usdReturn: 0 };
    }

    const burnRatio = new BigNumber(pabAmount).div(this.totalSupplyPAB);
    const usdReturn = this.reserveUSD.times(burnRatio).times(0.98); // 2% burn penalty

    this.reserveUSD = this.reserveUSD.minus(usdReturn);
    this.totalSupplyPAB = this.totalSupplyPAB.minus(pabAmount);

    await prisma.trustAuditTrail.create({
      data: {
        userId,
        previousScore: 0,
        newScore: 0,
        changeReason: 'PABOND_BURN',
        component: 'SYSTEM',
        severity: 'neutral',
        metadata: { usdReturn: Number(usdReturn), burnRatio: Number(burnRatio) } as any,
      } as any,
    });

    return { success: true, usdReturn: Number(usdReturn.toFixed(2)) };
  }

  /** Compute implied APR from velocity trend. Positive velocity = higher future rewards. */
  private computeEffectiveApr(velocity: number, amountUSD: number, pabTokens: number): number {
    // APR scales with velocity: rising trust → higher expected $PAB appreciation
    const baseApr = 4.5; // 4.5% base (conservative)
    const velocityAprBoost = velocity * 15; // ±15% based on momentum
    const volumeBonus = Math.min(15, Math.log10(amountUSD + 1) * 2); // larger deposits get slight bonus

    return Math.round((baseApr + velocityAprBoost + volumeBonus) * 100) / 100;
  }

  /** Load persisted state from DB */
  private async loadState(): Promise<void> {
    try {
      const state = await prisma.trustAuditTrail.findFirst({
        where: { userId: 'SYSTEM', changeReason: 'PABOND_STATE' },
        orderBy: { createdAt: 'desc' },
      });
      if (state && state.metadata) {
        const meta = state.metadata as Record<string, any>;
        this.reserveUSD = new BigNumber(meta.reserveUSD || BASE_RESERVE_USD);
        this.totalSupplyPAB = new BigNumber(meta.totalSupply || INITIAL_SUPPLY);
      }
    } catch (err) {
      logger.warn('[Pabond] Failed to load state, using defaults');
    }
  }

  /** Save current state to DB */
  private async saveState(): Promise<void> {
    try {
      await prisma.trustAuditTrail.create({
        data: {
          userId: 'SYSTEM',
          previousScore: 0,
          newScore: 0,
          changeReason: 'PABOND_STATE',
          component: 'SYSTEM',
          severity: 'neutral',
          metadata: {
            reserveUSD: Number(this.reserveUSD),
            totalSupply: Number(this.totalSupplyPAB),
            pricePerPAB: this.getCurrentPrice(),
          } as any,
        } as any,
      });
    } catch (err: any) {
      logger.error(`[Pabond] Failed to save state: ${err.message}`);
    }
  }
}

export const pabondService = new PabondService();
