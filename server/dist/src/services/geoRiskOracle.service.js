"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geoRiskOracle = void 0;
exports.scoreToRiskBand = scoreToRiskBand;
exports.assessProperty = assessProperty;
exports.priceWithDualRisk = priceWithDualRisk;
/** Deterministic short geohash from lat/lng/address (no external dep). */
function toGeohash(input) {
    const key = `${input.lat ?? ''},${input.lng ?? ''},${input.address ?? ''}`.toLowerCase();
    let h = 2166136261 >>> 0;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}
/** Map a 0..100 risk score to a band (A safest → E riskiest). */
function scoreToRiskBand(score) {
    if (score < 20)
        return 'A';
    if (score < 40)
        return 'B';
    if (score < 60)
        return 'C';
    if (score < 80)
        return 'D';
    return 'E';
}
/**
 * Assess a property's intrinsic (location) risk.
 * Live feeds (floodZone / crimeRatePer1k / schoolRating) take precedence;
 * otherwise a transparent geohash-seeded heuristic is used and flagged.
 */
function assessProperty(input) {
    const geohash = toGeohash(input);
    const factors = [];
    const hasLive = input.floodZone !== undefined || input.crimeRatePer1k !== undefined || input.schoolRating !== undefined;
    // ── FLOOD ──────────────────────────────────────────────────────────────
    let floodZone = input.floodZone;
    let floodScore;
    let floodLabel;
    if (floodZone === undefined) {
        // Heuristic: last 2 geohash chars → pseudo zone. Deterministic, disclosed.
        const v = parseInt(geohash.slice(-2), 36) % 100;
        if (v < 6)
            floodZone = 'X';
        else if (v < 30)
            floodZone = 'A';
        else if (v < 70)
            floodZone = 'AE';
        else
            floodZone = 'VE';
    }
    const FLOOD_MAP = {
        X: { score: 2, label: 'Minimal flood risk' },
        A: { score: 20, label: 'Low flood risk (100-yr)' },
        AE: { score: 55, label: 'Moderate flood risk (regular)' },
        VE: { score: 95, label: 'High flood risk (coastal/velocity)' },
    };
    const fm = FLOOD_MAP[floodZone] || FLOOD_MAP.AE;
    floodScore = fm.score;
    floodLabel = fm.label;
    if (floodZone !== 'X')
        factors.push(`Flood zone ${floodZone}: ${fm.label}`);
    // ── CRIME ──────────────────────────────────────────────────────────────
    let crimeRate = input.crimeRatePer1k;
    let crimeScore;
    let crimeLabel;
    if (crimeRate === undefined) {
        const v = parseInt(geohash.slice(0, 2), 36) % 100; // 0..99
        crimeRate = +(2 + (v / 99) * 38).toFixed(1); // 2.0 .. 40.0 per 1k
    }
    // 2/1k ≈ safe (score 5), 40/1k ≈ high (score 90)
    crimeScore = Math.max(0, Math.min(100, ((crimeRate - 2) / 38) * 85 + 5));
    crimeLabel = crimeScore < 25 ? 'Low crime' : crimeScore < 55 ? 'Moderate crime' : 'High crime';
    if (crimeScore >= 55)
        factors.push(`Crime ${crimeRate}/1k: ${crimeLabel}`);
    // ── SCHOOL ─────────────────────────────────────────────────────────────
    let schoolRating = input.schoolRating;
    let schoolScore;
    let schoolLabel;
    if (schoolRating === undefined) {
        const v = parseInt(geohash.slice(2, 4), 36) % 10; // 0..9
        schoolRating = v + 1; // 1..10
    }
    // Higher rating → LOWER risk (more desirable/stable). Invert 1..10 → score.
    schoolScore = Math.max(0, Math.min(100, (10 - schoolRating) * 10));
    schoolLabel = schoolRating >= 8 ? 'Top-tier schools' : schoolRating >= 5 ? 'Average schools' : 'Struggling schools';
    if (schoolRating < 5)
        factors.push(`Schools rated ${schoolRating}/10: ${schoolLabel}`);
    // ── COMPOSITE (weighted) ───────────────────────────────────────────────
    // Flood weighted highest (catastrophic), then crime, then school.
    const geoRiskScore = +((floodScore * 0.5 + crimeScore * 0.35 + schoolScore * 0.15)).toFixed(1);
    const riskBand = scoreToRiskBand(geoRiskScore);
    if (factors.length === 0)
        factors.push('No elevated location risks detected');
    return {
        geohash,
        flood: { zone: floodZone, score: floodScore, label: floodLabel },
        crime: { ratePer1k: crimeRate, score: +crimeScore.toFixed(1), label: crimeLabel },
        school: { rating: schoolRating, score: schoolScore, label: schoolLabel },
        geoRiskScore,
        riskBand,
        factors,
        simulated: !hasLive,
    };
}
/**
 * DUAL-RISK PRICING
 * ────────────────────────────────────────────────────────────────────────────
 * Dynamic rent/deposit adjustment from TWO independent risks:
 *   - Property intrinsic risk (geoRiskBand): riskier location → rent PREMIUM
 *   - Tenant trust (PTP band): higher trust → tenant DISCOUNT
 *
 * Returns the adjusted monthly rent + the delta + the band used, so the
 * caller (ppd/pyd) can show "why this price".
 *
 * Property premium: A +0%, B +1%, C +3%, D +5%, E +8%  (flood zone ~+5% at E)
 * Tenant discount: A -15%, B -10%, C -5%, D 0%, E 0%  (trust rewards)
 */
const PROPERTY_PREMIUM = { A: 0, B: 0.01, C: 0.03, D: 0.05, E: 0.08 };
const TENANT_DISCOUNT = { A: 0.15, B: 0.10, C: 0.05, D: 0, E: 0 };
function priceWithDualRisk(input) {
    const premiumPct = PROPERTY_PREMIUM[input.geoRiskBand] ?? 0;
    const discountPct = TENANT_DISCOUNT[input.tenantTrustBand] ?? 0;
    // Net multiplier: (1 + premium) * (1 - discount)
    const mult = (1 + premiumPct) * (1 - discountPct);
    const adjusted = +(input.baseRentUSD * mult).toFixed(2);
    const delta = +(adjusted - input.baseRentUSD).toFixed(2);
    const explanation = `Property risk ${input.geoRiskBand} (+${(premiumPct * 100).toFixed(0)}%) ` +
        `× Tenant trust ${input.tenantTrustBand} (-${(discountPct * 100).toFixed(0)}%) ` +
        `→ ${delta >= 0 ? '+' : ''}$${delta}/mo vs base.`;
    return {
        baseRentUSD: input.baseRentUSD,
        propertyPremiumPct: premiumPct,
        tenantDiscountPct: discountPct,
        adjustedRentUSD: adjusted,
        deltaUSD: delta,
        explanation,
    };
}
exports.geoRiskOracle = { assessProperty, priceWithDualRisk, scoreToRiskBand };
//# sourceMappingURL=geoRiskOracle.service.js.map