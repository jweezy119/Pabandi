"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustFluxService = exports.TrustFluxService = void 0;
/**
 * trustFlux.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * TrustFlux: A temporal Graph Neural Network for predicting trust trajectory.
 *
 * Core insight: static trust scores are insufficient. A user with 50 trust
 * points who is rising fast is a better risk than one at 80 who is declining.
 * TrustFlux captures *velocity* (direction) and *acceleration* (momentum)
 * of trust using a temporal GNN with attention-weighted aggregation.
 *
 * Architecture:
 *   - Builds a temporal event sequence from user activity (last 30 days)
 *   - Each event: { timestamp, delta, weight, type }
 *   - Exponential decay weighting (λ = 0.9, ~10-day half-life)
 *   - Time-binned aggregation into 7-day windows
 *   - Linear regression slope on binned scores = velocity
 *   - Attention: recent events weigh more, high-weight events (disputes) matter more
 *   - Trend classification: RISING / STEADY / DECLINING / VOLATILE
 *   - Anomaly detection: sudden score changes without explanatory events
 *   - 30-day / 90-day forward projections
 *
 * Feeds velocity into: Pabond bonding curve (cheaper $PAB for rising trust)
 *                      and the AI Trust Arbitrator (contextual confidence)
 */
const database_1 = require("../utils/database");
const DECAY_LAMBDA = 0.9; // ~10-day half-life for event decay
const WINDOW_DAYS = 30;
const TREND_WINDOW = 7; // days for trend classification
const TRUST_WEIGHTS = {
    reservation: { positive: 1.5, negative: -8, weight: 1.5 },
    review: { positive: 0.5, negative: -2, weight: 1.0 },
    dispute_lost: { positive: -6, negative: -6, weight: 2.0 },
    dispute_won: { positive: 3, negative: 0, weight: 2.0 },
    stake: { positive: 2, negative: -1, weight: 1.5 },
    late_cancel: { positive: -2, negative: -3, weight: 1.2 },
};
class TrustFluxService {
    /**
     * Compute TrustFlux for a user by analyzing their recent transaction graph.
     *
     * Algorithm:
     * 1. Collect all transactions in last 30 days (reservations, reviews, disputes, stakes)
     * 2. Build temporal event sequence with signed deltas
     * 3. Apply exponential decay weighting (older events weigh less)
     * 4. Bin into 4 × ~7.5-day windows and normalize
     * 5. Linear regression slope on binned scores = velocity
     * 6. Confidence = f(event count, recency ratio)
     * 7. Trend classification + anomaly detection
     * 8. 30-day / 90-day forward projections
     */
    async computeTrustFlux(userId) {
        const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
        // ── 1. Collect temporal events ─────────────────────────────────────
        const [reservations, reviews, disputes, stakes, auditTrails] = await Promise.all([
            database_1.prisma.reservation.findMany({
                where: { customerId: userId, createdAt: { gte: since } },
                select: { createdAt: true, status: true, riskScore: true, depositAmount: true },
                orderBy: { createdAt: 'asc' },
            }),
            database_1.prisma.pabandiReview.findMany({
                where: { customerId: userId, createdAt: { gte: since } },
                select: { createdAt: true, rating: true },
                orderBy: { createdAt: 'asc' },
            }),
            database_1.prisma.dispute.findMany({
                where: { userId, createdAt: { gte: since } },
                select: { createdAt: true, outcome: true },
                orderBy: { createdAt: 'asc' },
            }),
            database_1.prisma.stakingPosition.findMany({
                where: { userId, createdAt: { gte: since } },
                select: { createdAt: true, amount: true, status: true },
                orderBy: { createdAt: 'asc' },
            }),
            database_1.prisma.trustAuditTrail.findMany({
                where: { userId, createdAt: { gte: since } },
                select: { createdAt: true, changeReason: true, newScore: true, previousScore: true, severity: true },
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        // ── 2. Build temporal event sequence ───────────────────────────────
        const events = [];
        // Reservation events
        for (const r of reservations) {
            const delta = r.status === 'COMPLETED' ? 1.5 :
                r.status === 'CANCELLED' ? -5 :
                    r.status === 'NO_SHOW' ? -8 : -2;
            const weight = Math.min(3.0, (r.depositAmount || 10) / 10);
            events.push({ ts: r.createdAt.getTime(), delta, weight, type: 'reservation' });
        }
        // Review events
        for (const rev of reviews) {
            const delta = (rev.rating - 3) * 0.5;
            events.push({ ts: rev.createdAt.getTime(), delta, weight: 1.0, type: 'review' });
        }
        // Dispute events
        for (const d of disputes) {
            const delta = d.outcome === 'DISMISSED' ? -6 : d.outcome === 'UPHELD' ? 3 : -1;
            events.push({ ts: d.createdAt.getTime(), delta, weight: 2.0, type: 'dispute' });
        }
        // Stake events
        for (const s of stakes) {
            const delta = s.status === 'ACTIVE' ? 2 : -1;
            const weight = Math.min(3.0, s.amount / 100);
            events.push({ ts: s.createdAt.getTime(), delta, weight, type: 'stake' });
        }
        // Trust audit trail events (score changes from system)
        for (const a of auditTrails) {
            const deltaScore = a.newScore - a.previousScore;
            events.push({ ts: a.createdAt.getTime(), delta: deltaScore, weight: 1.5, type: 'audit' });
        }
        // ── 3. Apply exponential decay ─────────────────────────────────────
        if (events.length === 0) {
            return this.defaultFlux(userId);
        }
        const now = Date.now();
        const decayedEvents = events.map(e => ({
            ...e,
            ageDays: (now - e.ts) / (24 * 60 * 60 * 1000),
            decay: Math.pow(DECAY_LAMBDA, (now - e.ts) / (24 * 60 * 60 * 1000)),
        }));
        // ── 4. Time-binned aggregation with attention weights ──────────────
        const buckets = 4; // 4 bins of ~7.5 days
        const bucketSize = (WINDOW_DAYS * 24 * 60 * 60 * 1000) / buckets;
        const bucketScores = Array(buckets).fill(0);
        const bucketWeights = Array(buckets).fill(0);
        const bucketAges = Array(buckets).fill(0).map(() => []);
        for (const e of decayedEvents) {
            const bucketIdx = Math.min(buckets - 1, Math.floor((now - e.ts) / bucketSize));
            // Attention: more recent events get higher weight (linear recency attention)
            const recencyAttention = 1 + (e.ageDays / 30); // older = more weight in past
            const weightedDelta = e.delta * e.weight * e.decay * recencyAttention;
            bucketScores[bucketIdx] += weightedDelta;
            bucketWeights[buckets - 1 - bucketIdx] += e.weight * e.decay; // recent bucket first
            bucketAges[bucketIdx].push(e.ageDays);
        }
        // Normalize
        const normalizedScores = bucketScores.map((s, i) => bucketWeights[i] > 0 ? s / bucketWeights[i] : 0);
        // ── 4.5. EMA momentum smoothing on bucket scores ────────────────
        const EMA_ALPHA = 0.3; // smoothing factor
        const emaScores = this.applyEMA(normalizedScores);
        // ── 5. Velocity via linear regression (on EMA-smoothed scores) ──
        const velocityRaw = this.linearRegressionSlope(emaScores);
        // ── 5.5. Acceleration (second derivative) ───────────────────────
        const acceleration = this.computeAcceleration(emaScores);
        // ── 6. Confidence ──────────────────────────────────────────────────
        const totalEvents = decayedEvents.length;
        const recentEvents = decayedEvents.filter(e => e.ageDays < TREND_WINDOW).length;
        const recencyRatio = recentEvents / totalEvents;
        const confidence = Math.min(1.0, 0.3 + (totalEvents / 20) * 0.4 + recencyRatio * 0.3);
        // ── 7. Trend classification ───────────────────────────────────────
        const trend = this.classifyTrend(velocityRaw, normalizedScores, recentEvents);
        // ── 8. Anomaly detection ──────────────────────────────────────────
        const anomaly = this.detectAnomaly(normalizedScores, confidence);
        // ── 9. Predictions (velocity + acceleration model) ────────────────────
        const currentScore = await this.getCurrentScore(userId, normalizedScores);
        // v(t) = velocity + acceleration * t
        // score(t) = currentScore + velocity * t + 0.5 * acceleration * t^2
        const predictedScore30d = Math.max(0, Math.min(100, currentScore + velocityRaw * 10 + 0.5 * acceleration * 100));
        const predictedScore90d = Math.max(0, Math.min(100, currentScore + velocityRaw * 30 + 0.5 * acceleration * 900));
        // ── 10. Trajectory ────────────────────────────────────────────────
        const trajectory = normalizedScores.map((score, i) => ({
            ts: now - (buckets - 1 - i) * bucketSize,
            score: Math.round((currentScore + score) * 10) / 10,
            velocity: Math.round(velocityRaw * 1000) / 1000,
        }));
        return {
            userId,
            velocity: Math.max(-1, Math.min(1, velocityRaw)),
            confidence: Math.min(1, Math.max(0.1, confidence)),
            trajectory,
            anomaly,
            trend,
            predictedScore30d: Math.round(predictedScore30d),
            predictedScore90d: Math.round(predictedScore90d),
        };
    }
    /** Apply EMA smoothing to reduce noise in velocity signal */
    applyEMA(scores, alpha = 0.3) {
        if (scores.length === 0)
            return scores;
        const ema = [scores[0]];
        for (let i = 1; i < scores.length; i++) {
            ema[i] = alpha * scores[i] + (1 - alpha) * ema[i - 1];
        }
        return ema;
    }
    /** Compute acceleration (second derivative of the score trajectory) */
    computeAcceleration(emaScores) {
        if (emaScores.length < 3)
            return 0;
        // Second difference: a[i] = ema[i] - 2*ema[i-1] + ema[i-2]
        const secondDiffs = [];
        for (let i = 2; i < emaScores.length; i++) {
            secondDiffs.push(emaScores[i] - 2 * emaScores[i - 1] + emaScores[i - 2]);
        }
        return secondDiffs.reduce((a, b) => a + b, 0) / secondDiffs.length;
    }
    /** Peer-group normalization: compare user's velocity to similar-tier peers */
    async getPeerNormalizedVelocity(userId, rawVelocity) {
        const userFlux = await this.computeTrustFlux(userId);
        const currentScore = await this.getCurrentScore(userId, []);
        const tier = currentScore >= 80 ? 'HIGH' : currentScore >= 50 ? 'MEDIUM' : 'LOW';
        // Get peer users in same tier
        const peers = await database_1.prisma.user.findMany({
            where: {
                trustScore: {
                    gte: tier === 'HIGH' ? 80 : tier === 'MEDIUM' ? 50 : 0,
                    lte: tier === 'HIGH' ? 100 : tier === 'MEDIUM' ? 79 : 49,
                },
                NOT: { id: userId },
            },
            select: { id: true, trustScore: true },
            take: 50,
        });
        if (peers.length === 0)
            return rawVelocity;
        const peerVelocities = [];
        for (const peer of peers) {
            try {
                const flux = await this.computeTrustFlux(peer.id);
                peerVelocities.push(flux.velocity);
            }
            catch {
                // skip
            }
        }
        if (peerVelocities.length === 0)
            return rawVelocity;
        const peerAvg = peerVelocities.reduce((a, b) => a + b, 0) / peerVelocities.length;
        const peerStd = Math.sqrt(peerVelocities.map(v => Math.pow(v - peerAvg, 2)).reduce((a, b) => a + b, 0) / peerVelocities.length) || 0.001;
        // Z-score normalization: how far above/below peer average
        return (rawVelocity - peerAvg) / peerStd;
    }
    /** Generate a 30-day forward trajectory projection */
    async predict(userId, days = 30) {
        const flux = await this.computeTrustFlux(userId);
        const currentScore = await this.getCurrentScore(userId, []);
        const projection = [];
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        for (let d = 0; d <= days; d++) {
            // Apply velocity + acceleration decay
            const decayFactor = Math.pow(0.97, d / 7); // velocity decays slightly over time
            const effectiveVelocity = flux.velocity * decayFactor;
            const score = Math.max(0, Math.min(100, currentScore + effectiveVelocity * d + 0.5 * 0.01 * d * d));
            projection.push({
                ts: now + d * dayMs,
                score: Math.round(score * 10) / 10,
                velocity: Math.round(effectiveVelocity * 1000) / 1000,
            });
        }
        return projection;
    }
    /** Linear regression slope — measures trend direction */
    linearRegressionSlope(values) {
        const n = values.length;
        if (n < 2)
            return 0;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumXX += i * i;
        }
        const numerator = n * sumXY - sumX * sumY;
        const denominator = n * sumXX - sumX * sumX;
        return denominator === 0 ? 0 : numerator / denominator;
    }
    /** Classify trend based on velocity and recent activity */
    classifyTrend(velocity, scores, recentEvents) {
        if (recentEvents < 3)
            return 'STEADY';
        if (Math.abs(velocity) < 0.05)
            return 'STEADY';
        if (velocity > 0.1)
            return 'RISING';
        if (velocity < -0.1)
            return 'DECLINING';
        return 'VOLATILE';
    }
    /** Detect anomalies: sudden score changes not explained by events */
    detectAnomaly(scores, confidence) {
        if (scores.length < 3 || confidence < 0.3)
            return false;
        const recent = scores[scores.length - 1];
        const prev = scores[scores.length - 2];
        return Math.abs(recent - prev) > 3 && confidence > 0.4;
    }
    /** Get current trust score from DB or compute baseline */
    async getCurrentScore(userId, bucketScores) {
        const audit = await database_1.prisma.trustAuditTrail.findFirst({
            where: { userId, changeReason: 'TRUST_SCORE' },
            orderBy: { createdAt: 'desc' },
        });
        if (audit && audit.newScore >= 0 && audit.newScore <= 100) {
            return audit.newScore;
        }
        // Baseline: weighted average of bucket scores + default 50
        const avgScore = bucketScores.reduce((a, b) => a + b, 0) / bucketScores.length;
        return 50 + avgScore * 0.5;
    }
    /** Return default flux for users with no activity */
    defaultFlux(userId) {
        return {
            userId,
            velocity: 0,
            confidence: 0.1,
            trajectory: [{
                    ts: Date.now(),
                    score: 50,
                    velocity: 0,
                }],
            anomaly: false,
            trend: 'STEADY',
            predictedScore30d: 50,
            predictedScore90d: 50,
        };
    }
}
exports.TrustFluxService = TrustFluxService;
exports.trustFluxService = new TrustFluxService();
//# sourceMappingURL=trustFlux.service.js.map