"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pabondService = exports.PabondService = void 0;
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
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const trustFlux_service_1 = require("./trustFlux.service");
// ── Pabond Curve Constants ─────────────────────────────────────────
const BASE_RESERVE_USD = 50000; // Initial liquidity pool seeded
const INITIAL_SUPPLY = 1000000; // Starting $PAB supply
const MIN_VELOCITY_MULT = 0.5; // 2x price for declining trust
const MAX_VELOCITY_MULT = 2.0; // 0.5x price for surging trust
const MAX_SLIPPAGE = 0.02; // 2% max slippage per trade
class PabondService {
    constructor() {
        this.reserveUSD = new bignumber_js_1.default(BASE_RESERVE_USD);
        this.totalSupplyPAB = new bignumber_js_1.default(INITIAL_SUPPLY);
        // Persist supply/reserve across restarts
        this.loadState();
        setInterval(() => this.saveState(), 30000);
    }
    /** Get current PAB price in USD (before velocity adjustment) */
    getCurrentPrice() {
        // pabondPrice = reserveUSD / supply² — concave curve, price increases with supply
        return Number(this.reserveUSD.div(this.totalSupplyPAB.pow(2)).times(1e6));
    }
    /**
     * Mint $PAB via the bonding curve.
     * Uses TrustFlux velocity to compute a multiplier that makes
     * rising-trust users pay less and declining-trust users pay more.
     */
    async mint(params) {
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
                velocityBonus: 1.0,
                totalSupply: Number(this.totalSupplyPAB),
                reserveUSD: Number(this.reserveUSD),
                effectiveApr: 0,
                error: 'Amount must be positive',
            };
        }
        // 1. Get user's TrustFlux velocity
        const flux = await trustFlux_service_1.trustFluxService.computeTrustFlux(userId);
        const velocity = flux.velocity; // [-1, +1]
        // 2. Velocity multiplier: positive velocity = discount, negative = premium
        //    Map [-1, +1] → [0.5, 2.0]
        const velocityMult = MIN_VELOCITY_MULT + ((velocity + 1) / 2) * (MAX_VELOCITY_MULT - MIN_VELOCITY_MULT);
        // 3. Apply slippage cap
        const slippageFactor = Math.min(1 + MAX_SLIPPAGE, Math.max(1 - MAX_SLIPPAGE, velocityMult));
        // 4. Pabond curve: deltaPAB = velocityMult × sqrt(amountUSD) × (reserve / supply^1.5)
        const amountBN = new bignumber_js_1.default(amountUSD);
        const supplyBN = this.totalSupplyPAB;
        const reserveBN = this.reserveUSD;
        // Curve formula: more reserve per token = higher price floor
        const curveFactor = reserveBN.div(supplyBN.pow(1.5));
        const pabTokens = amountBN.sqrt().times(curveFactor).times(slippageFactor);
        // 5a. Apply velocity bonus (rising trust = extra $PAB)
        const velocityBonus = this.getVelocityBonus(velocity);
        const finalPabTokens = pabTokens.times(velocityBonus);
        // 5. Update reserve and supply
        this.reserveUSD = this.reserveUSD.plus(amountBN);
        this.totalSupplyPAB = this.totalSupplyPAB.plus(finalPabTokens);
        const pricePerPAB = Number(amountBN.div(finalPabTokens));
        // Record the mint via TrustAuditTrail (has JSON metadata field)
        await database_1.prisma.trustAuditTrail.create({
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
                },
            },
        });
        // 7. Compute effective APR based on velocity trend
        const effectiveApr = this.computeEffectiveApr(velocity, amountUSD, Number(finalPabTokens));
        logger_1.logger.info(`[Pabond] Minted ${Number(finalPabTokens).toFixed(4)} $PAB for user ${userId} ` +
            `(${velocityMult.toFixed(2)}x velocity mult, +${(velocityBonus - 1) * 100}% bonus, price $${pricePerPAB.toFixed(4)}/PAB)`);
        return {
            success: true,
            userId,
            amountUSD,
            pabTokens: Number(finalPabTokens.toFixed(8)),
            pricePerPAB: Math.round(pricePerPAB * 1e6) / 1e6,
            velocity: Math.round(velocity * 1000) / 1000,
            velocityMultiplier: Math.round(velocityMult * 1000) / 1000,
            totalSupply: Number(this.totalSupplyPAB),
            reserveUSD: Number(this.reserveUSD),
            velocityBonus: Math.round(velocityBonus * 1000) / 1000,
            effectiveApr,
        };
    }
    /**
     * Burn $PAB to reduce reserve (e.g., for redemption or fee payment).
     * Burn ratio = pabTokens / supply → returns proportional reserve share.
     */
    async burn(userId, pabAmount) {
        if (pabAmount <= 0 || new bignumber_js_1.default(pabAmount).gt(this.totalSupplyPAB)) {
            return { success: false, usdReturn: 0 };
        }
        const burnRatio = new bignumber_js_1.default(pabAmount).div(this.totalSupplyPAB);
        const usdReturn = this.reserveUSD.times(burnRatio).times(0.98); // 2% burn penalty
        this.reserveUSD = this.reserveUSD.minus(usdReturn);
        this.totalSupplyPAB = this.totalSupplyPAB.minus(pabAmount);
        await database_1.prisma.trustAuditTrail.create({
            data: {
                userId,
                previousScore: 0,
                newScore: 0,
                changeReason: 'PABOND_BURN',
                component: 'SYSTEM',
                severity: 'neutral',
                metadata: { usdReturn: Number(usdReturn), burnRatio: Number(burnRatio) },
            },
        });
        return { success: true, usdReturn: Number(usdReturn.toFixed(2)) };
    }
    /** Compute implied APR from velocity trend. Positive velocity = higher future rewards. */
    computeEffectiveApr(velocity, amountUSD, pabTokens) {
        // APR scales with velocity: rising trust → higher expected $PAB appreciation
        const baseApr = 4.5; // 4.5% base (conservative)
        const velocityAprBoost = velocity * 15; // ±15% based on momentum
        const volumeBonus = Math.min(15, Math.log10(amountUSD + 1) * 2); // larger deposits get slight bonus
        return Math.round((baseApr + velocityAprBoost + volumeBonus) * 100) / 100;
    }
    /**
     * AMM-style batch redemption: burn $PAB to get proportional reserve share.
     * Batch processing with yield claim (accumulated fees from curve trades).
     */
    async batchRedeem(userId, pabAmount) {
        if (pabAmount <= 0 || new bignumber_js_1.default(pabAmount).gt(this.totalSupplyPAB)) {
            return { success: false, usdReturn: 0, yield: 0 };
        }
        const burnRatio = new bignumber_js_1.default(pabAmount).div(this.totalSupplyPAB);
        // Proportional reserve share
        const reserveShare = this.reserveUSD.times(burnRatio);
        // Yield claim: accumulated trading fees (simplified: 0.05% of reserve)
        const yieldClaim = reserveShare.times(0.0005);
        const usdReturn = reserveShare.minus(yieldClaim).times(0.97); // 3% exit fee
        this.reserveUSD = this.reserveUSD.minus(reserveShare);
        this.totalSupplyPAB = this.totalSupplyPAB.minus(pabAmount);
        await database_1.prisma.trustAuditTrail.create({
            data: {
                userId,
                previousScore: 0,
                newScore: 0,
                changeReason: 'PABOND_BATCH_REDEEM',
                component: 'SYSTEM',
                severity: 'neutral',
                metadata: { usdReturn: Number(usdReturn), yieldClaim: Number(yieldClaim), pabBurned: pabAmount },
            },
        });
        logger_1.logger.info(`[Pabond] Batch redeem: ${pabAmount} $PAB → $${Number(usdReturn).toFixed(2)} + $${Number(yieldClaim).toFixed(4)} yield`);
        return { success: true, usdReturn: Number(usdReturn.toFixed(2)), yield: Number(yieldClaim.toFixed(4)) };
    }
    /**
     * Compute comprehensive Pabond statistics for dashboards.
     * Returns current price, APY, TVL, daily volume, top 10 velocity leaders.
     */
    async getStats() {
        // Get recent mint events for daily volume (last 24h)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentMints = await database_1.prisma.trustAuditTrail.findMany({
            where: {
                changeReason: { startsWith: 'PABOND_MINT_' },
                createdAt: { gte: yesterday },
            },
            select: { metadata: true },
        });
        const dailyVolume = recentMints.reduce((sum, audit) => {
            const meta = audit.metadata;
            return sum + (Number(meta?.amountUSD) || 0);
        }, 0);
        // Top velocity leaders (users with highest positive TrustFlux velocity)
        const topUsers = await database_1.prisma.user.findMany({
            where: { trustScore: { gt: 50 } },
            select: { id: true, trustScore: true },
            take: 50,
        });
        const leaders = [];
        for (const user of topUsers) {
            try {
                const flux = await trustFlux_service_1.trustFluxService.computeTrustFlux(user.id);
                if (flux.velocity > 0.1) {
                    leaders.push({
                        userId: user.id,
                        velocity: Math.round(flux.velocity * 1000) / 1000,
                        pabBalance: user.trustScore * 100, // placeholder — in prod query staking positions
                    });
                }
            }
            catch { /* skip */ }
        }
        leaders.sort((a, b) => b.velocity - a.velocity);
        return {
            pricePerPAB: this.getCurrentPrice(),
            apy: this.computeEffectiveApr(0.5, 1000, this.totalSupplyPAB.toNumber()) / 100,
            tvl: Number(this.reserveUSD),
            dailyVolume,
            totalSupply: Number(this.totalSupplyPAB),
            topVelocityLeaders: leaders.slice(0, 10),
        };
    }
    /**
     * Compute daily reward rate for velocity bonus.
     * Users with velocity > 0.5 get a 10% bonus on minted $PAB.
     */
    getVelocityBonus(velocity) {
        if (velocity > 0.5)
            return 1.10; // 10% bonus for high rising trust
        if (velocity > 0.3)
            return 1.05; // 5% bonus for moderate rising
        if (velocity > 0.1)
            return 1.02; // 2% bonus for slight rising
        return 1.0;
    }
    /**
     * Load persisted state from DB */
    async loadState() {
        try {
            const state = await database_1.prisma.trustAuditTrail.findFirst({
                where: { userId: 'SYSTEM', changeReason: 'PABOND_STATE' },
                orderBy: { createdAt: 'desc' },
            });
            if (state && state.metadata) {
                const meta = state.metadata;
                this.reserveUSD = new bignumber_js_1.default(meta.reserveUSD || BASE_RESERVE_USD);
                this.totalSupplyPAB = new bignumber_js_1.default(meta.totalSupply || INITIAL_SUPPLY);
            }
        }
        catch (err) {
            logger_1.logger.warn('[Pabond] Failed to load state, using defaults');
        }
    }
    /** Save current state to DB */
    async saveState() {
        try {
            await database_1.prisma.trustAuditTrail.create({
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
                    },
                },
            });
        }
        catch (err) {
            logger_1.logger.error(`[Pabond] Failed to save state: ${err.message}`);
        }
    }
}
exports.PabondService = PabondService;
exports.pabondService = new PabondService();
//# sourceMappingURL=pabond.service.js.map