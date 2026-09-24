"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictiveTrustService = void 0;
/**
 * predictiveTrust.service.ts — Pabandi Predictive Intelligence engine.
 *
 * Turns the platform from REACTIVE (score after the booking) to PREDICTIVE
 * (forecast before the action). All open-source: pure TS over Postgres
 * aggregates, zero external/paid ML dependency.
 *
 * What it predicts:
 *   1. Per-customer no-show / completion risk from REAL reservation history.
 *   2. Per-business reliability + demand-by-hour forecast.
 *   3. Forward prediction for a PROSPECTIVE booking (before it is created):
 *      predictedNoShow, predictedCompletion, confidence, top factors.
 *   4. Optimal slot recommendation (highest predicted completion, balanced demand).
 *
 * Small-sample safe: uses a Beta-binomial prior so new entities aren't overfit.
 * When history is thin we shrink toward the population prior (noShow ~ 0.12).
 */
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
// Population prior (Beta(α,β)) — calibrated to a healthy marketplace.
const PRIOR_NO_SHOW = 0.12;
const PRIOR_ALPHA = 12; // α = prior_no_show * (α+β)
const PRIOR_BETA = 88; //  β = (1-prior) * (α+β)  → α+β = 100
function posteriorNoShow(completed, noShow, cancelled) {
    // Treat cancelled as a soft no-show (50% weight) — both are lost capacity.
    const effectiveNoShow = noShow + cancelled * 0.5;
    const total = completed + noShow + cancelled;
    const alpha = PRIOR_ALPHA + effectiveNoShow;
    const beta = PRIOR_BETA + completed + cancelled * 0.5;
    return alpha / (alpha + beta); // posterior mean
}
function confidenceFor(sample) {
    // 0 at n=0, ~0.95 at n>=100 (saturating).
    return 1 - Math.exp(-sample / 25);
}
async function aggregateRisk(whereField, id) {
    const [completed, noShow, cancelled] = await Promise.all([
        database_1.prisma.reservation.count({ where: { [whereField]: id, status: 'COMPLETED' } }),
        database_1.prisma.reservation.count({ where: { [whereField]: id, status: 'NO_SHOW' } }),
        database_1.prisma.reservation.count({ where: { [whereField]: id, status: 'CANCELLED' } }),
    ]);
    const sampleSize = completed + noShow + cancelled;
    const noShowRate = posteriorNoShow(completed, noShow, cancelled);
    return {
        entityId: id,
        sampleSize,
        completed,
        noShow,
        cancelled,
        noShowRate,
        completionRate: 1 - noShowRate,
        confidence: confidenceFor(sampleSize),
    };
}
exports.predictiveTrustService = {
    /** Per-customer no-show / completion risk from history. */
    async customerRisk(customerId) {
        return aggregateRisk('customerId', customerId);
    },
    /** Per-business reliability from history. */
    async businessRisk(businessId) {
        return aggregateRisk('businessId', businessId);
    },
    /**
     * Forward prediction for a PROSPECTIVE booking (call BEFORE create).
     * Blends customer + business risk, then applies lead-time & day-of-week
     * modifiers. Returns the probability the booking completes (no no-show).
     */
    async predictBooking(input) {
        const { customerId, businessId, reservationTime } = input;
        const [cust, biz] = await Promise.all([
            customerId ? this.customerRisk(customerId) : null,
            businessId ? this.businessRisk(businessId) : null,
        ]);
        // Base rate = confidence-weighted blend of available signals.
        let base = PRIOR_NO_SHOW;
        let wSum = 0;
        if (cust) {
            base += (cust.noShowRate - PRIOR_NO_SHOW) * cust.confidence;
            wSum += cust.confidence;
        }
        if (biz) {
            base += (biz.noShowRate - PRIOR_NO_SHOW) * biz.confidence;
            wSum += biz.confidence;
        }
        if (wSum > 0)
            base = PRIOR_NO_SHOW + (base - PRIOR_NO_SHOW); // already blended above
        let predNoShow = base;
        const factors = [];
        factors.push({ label: 'Historical baseline', contribution: 0 });
        if (cust && cust.sampleSize > 0) {
            const delta = (cust.noShowRate - PRIOR_NO_SHOW) * cust.confidence;
            predNoShow += delta * 0.6;
            factors.push({ label: `Your no-show history (${cust.noShow}/${cust.sampleSize})`, contribution: +(delta * 0.6).toFixed(3) });
        }
        if (biz && biz.sampleSize > 0) {
            const delta = (biz.noShowRate - PRIOR_NO_SHOW) * biz.confidence;
            predNoShow += delta * 0.4;
            factors.push({ label: `Business reliability (${biz.completed}/${biz.sampleSize} completed)`, contribution: +(delta * 0.4).toFixed(3) });
        }
        // Lead-time modifier: shorter lead → higher no-show.
        if (reservationTime) {
            const t = new Date(reservationTime).getTime();
            const leadHrs = (t - Date.now()) / 3600000;
            if (leadHrs > 0 && leadHrs < 24) {
                const bump = 0.06 * (1 - leadHrs / 24); // up to +6% for same-day
                predNoShow += bump;
                factors.push({ label: 'Same-day booking (higher risk)', contribution: +bump.toFixed(3) });
            }
            else if (leadHrs > 24 * 7) {
                const cut = 0.03; // booked >1 week out → slightly safer
                predNoShow -= cut;
                factors.push({ label: 'Booked >7 days ahead (lower risk)', contribution: -cut });
            }
        }
        // Day-of-week modifier: Fri/Sat/Sun slightly riskier.
        if (reservationTime) {
            const dow = new Date(reservationTime).getDay(); // 0 Sun .. 6 Sat
            if (dow === 5 || dow === 6 || dow === 0) {
                const bump = 0.02;
                predNoShow += bump;
                factors.push({ label: 'Weekend slot (slightly higher risk)', contribution: bump });
            }
        }
        predNoShow = Math.max(0.01, Math.min(0.95, predNoShow));
        const confidence = Math.min(cust?.confidence ?? 0, biz?.confidence ?? 0, 1);
        return {
            predictedNoShow: +predNoShow.toFixed(3),
            predictedCompletion: +(1 - predNoShow).toFixed(3),
            confidence: +(cust && biz ? confidence : (cust?.confidence ?? biz?.confidence ?? 0)).toFixed(3),
            factors,
        };
    },
    /**
     * Demand forecast per hour-of-day for a business (from COMPLETED history).
     * Returns 24 buckets; higher count = busier hour.
     */
    async demandForecast(businessId) {
        const rows = await database_1.prisma.reservation.findMany({
            where: { businessId, status: 'COMPLETED' },
            select: { reservationTime: true },
        });
        const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
        for (const r of rows) {
            const h = new Date(r.reservationTime).getHours();
            if (h >= 0 && h < 24)
                buckets[h].count += 1;
        }
        return buckets;
    },
    /**
     * Recommend the best upcoming slots for a customer at a business.
     * Scores each candidate by predictedCompletion (higher better) with a small
     * penalty for peak-demand hours (spread load), returns top 3.
     */
    async recommendSlots(input) {
        const { customerId, businessId, daysAhead = 7 } = input;
        const demand = await this.demandForecast(businessId);
        const maxDemand = Math.max(1, ...demand.map((d) => d.count));
        const out = [];
        for (let d = 1; d <= daysAhead; d++) {
            const day = new Date(Date.now() + d * 86400000);
            // Evaluate a few representative hours (lunch + dinner + a mid slot).
            for (const hour of [12, 18, 15]) {
                const cand = new Date(day);
                cand.setHours(hour, 0, 0, 0);
                if (cand.getTime() <= Date.now())
                    continue;
                const pred = await this.predictBooking({ customerId, businessId, reservationTime: cand });
                const hourDemand = demand[cand.getHours()].count / maxDemand; // 0..1
                // Prefer high completion, lightly avoid peaks (load balancing).
                const score = pred.predictedCompletion - 0.08 * hourDemand;
                out.push({
                    slot: cand.toISOString(),
                    predictedCompletion: pred.predictedCompletion,
                    demand: +hourDemand.toFixed(2),
                });
                // stash score for sort without leaking it
                out[out.length - 1]._score = score;
            }
        }
        out.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
        return out.slice(0, 3).map(({ slot, predictedCompletion, demand }) => ({ slot, predictedCompletion, demand }));
    },
    /**
     * Persist a prediction onto a reservation (called at create time) so the
     * trust rail + guarantees can use it. Writes noShowProbability + aiFactors.
     */
    async attachPredictionToReservation(reservationId, input) {
        try {
            const pred = await this.predictBooking(input);
            await database_1.prisma.reservation.update({
                where: { id: reservationId },
                data: {
                    noShowProbability: pred.predictedNoShow,
                    aiFactors: {
                        predictedCompletion: pred.predictedCompletion,
                        confidence: pred.confidence,
                        factors: pred.factors,
                        engine: 'predictiveTrust.v1',
                    },
                },
            });
            return pred;
        }
        catch (e) {
            logger_1.logger.warn(`[PredictiveTrust] attach failed for ${reservationId}: ${e.message}`);
            return null;
        }
    },
};
exports.default = exports.predictiveTrustService;
//# sourceMappingURL=predictiveTrust.service.js.map