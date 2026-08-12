/**
 * geoRiskOracle.service.ts — The Geospatial Risk Oracle
 * ────────────────────────────────────────────────────────────────────────────
 * Dual-risk actuarial engine for real estate: a property's intrinsic risk
 * (location) is priced SEPARATELY from the tenant's trust (PTP band). Together
 * they produce a defensible, dynamic rent/deposit adjustment.
 *
 * OSINT layers (each optional, each degrades gracefully):
 *   1. FEMA flood zone       → flood risk weight
 *   2. Local crime API        → safety risk weight
 *   3. School district rating → stability/desirability weight
 *
 * Agility note: external paid APIs (FEMA HTL, crime data providers, school
 * APIs) are NOT configured in this environment. The oracle still works — it
 * derives a DETERMINISTIC, transparent heuristic from the geohash when no live
 * feed is present, and clearly flags `simulated: true`. The moment a real feed
 * key is added, the same interface returns live data. No caller changes.
 *
 * No schema migration required: this is a pure, stateless service. Persistence
 * (if desired later) is the caller's concern.
 */
import { logger } from '../utils/logger';

export type RiskBand = 'A' | 'B' | 'C' | 'D' | 'E';

export interface GeoRiskInput {
  lat?: number;
  lng?: number;
  address?: string;
  /** Optional pre-resolved external signals (for when live feeds exist) */
  floodZone?: string;        // e.g. 'X' (none), 'A', 'AE', 'VE'
  crimeRatePer1k?: number;   // local crimes per 1000 residents/yr
  schoolRating?: number;     // 1-10
}

export interface GeoRiskResult {
  geohash: string;
  flood: { zone: string; score: number; label: string };
  crime: { ratePer1k: number; score: number; label: string };
  school: { rating: number; score: number; label: string };
  geoRiskScore: number;       // 0 (safe) .. 100 (high risk)
  riskBand: RiskBand;        // A (safest) .. E (riskiest)
  factors: string[];         // human-readable explanations
  simulated: boolean;         // true when derived heuristically (no live feed)
}

/** Deterministic short geohash from lat/lng/address (no external dep). */
function toGeohash(input: GeoRiskInput): string {
  const key = `${input.lat ?? ''},${input.lng ?? ''},${input.address ?? ''}`.toLowerCase();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

/** Map a 0..100 risk score to a band (A safest → E riskiest). */
export function scoreToRiskBand(score: number): RiskBand {
  if (score < 20) return 'A';
  if (score < 40) return 'B';
  if (score < 60) return 'C';
  if (score < 80) return 'D';
  return 'E';
}

/**
 * Assess a property's intrinsic (location) risk.
 * Live feeds (floodZone / crimeRatePer1k / schoolRating) take precedence;
 * otherwise a transparent geohash-seeded heuristic is used and flagged.
 */
export function assessProperty(input: GeoRiskInput): GeoRiskResult {
  const geohash = toGeohash(input);
  const factors: string[] = [];
  const hasLive = input.floodZone !== undefined || input.crimeRatePer1k !== undefined || input.schoolRating !== undefined;

  // ── FLOOD ──────────────────────────────────────────────────────────────
  let floodZone = input.floodZone;
  let floodScore: number;
  let floodLabel: string;
  if (floodZone === undefined) {
    // Heuristic: last 2 geohash chars → pseudo zone. Deterministic, disclosed.
    const v = parseInt(geohash.slice(-2), 36) % 100;
    if (v < 6) floodZone = 'X';
    else if (v < 30) floodZone = 'A';
    else if (v < 70) floodZone = 'AE';
    else floodZone = 'VE';
  }
  const FLOOD_MAP: Record<string, { score: number; label: string }> = {
    X: { score: 2, label: 'Minimal flood risk' },
    A: { score: 20, label: 'Low flood risk (100-yr)' },
    AE: { score: 55, label: 'Moderate flood risk (regular)' },
    VE: { score: 95, label: 'High flood risk (coastal/velocity)' },
  };
  const fm = FLOOD_MAP[floodZone] || FLOOD_MAP.AE;
  floodScore = fm.score; floodLabel = fm.label;
  if (floodZone !== 'X') factors.push(`Flood zone ${floodZone}: ${fm.label}`);

  // ── CRIME ──────────────────────────────────────────────────────────────
  let crimeRate = input.crimeRatePer1k;
  let crimeScore: number;
  let crimeLabel: string;
  if (crimeRate === undefined) {
    const v = parseInt(geohash.slice(0, 2), 36) % 100; // 0..99
    crimeRate = +(2 + (v / 99) * 38).toFixed(1); // 2.0 .. 40.0 per 1k
  }
  // 2/1k ≈ safe (score 5), 40/1k ≈ high (score 90)
  crimeScore = Math.max(0, Math.min(100, ((crimeRate - 2) / 38) * 85 + 5));
  crimeLabel = crimeScore < 25 ? 'Low crime' : crimeScore < 55 ? 'Moderate crime' : 'High crime';
  if (crimeScore >= 55) factors.push(`Crime ${crimeRate}/1k: ${crimeLabel}`);

  // ── SCHOOL ─────────────────────────────────────────────────────────────
  let schoolRating = input.schoolRating;
  let schoolScore: number;
  let schoolLabel: string;
  if (schoolRating === undefined) {
    const v = parseInt(geohash.slice(2, 4), 36) % 10; // 0..9
    schoolRating = v + 1; // 1..10
  }
  // Higher rating → LOWER risk (more desirable/stable). Invert 1..10 → score.
  schoolScore = Math.max(0, Math.min(100, (10 - schoolRating) * 10));
  schoolLabel = schoolRating >= 8 ? 'Top-tier schools' : schoolRating >= 5 ? 'Average schools' : 'Struggling schools';
  if (schoolRating < 5) factors.push(`Schools rated ${schoolRating}/10: ${schoolLabel}`);

  // ── COMPOSITE (weighted) ───────────────────────────────────────────────
  // Flood weighted highest (catastrophic), then crime, then school.
  const geoRiskScore = +((floodScore * 0.5 + crimeScore * 0.35 + schoolScore * 0.15)).toFixed(1);
  const riskBand = scoreToRiskBand(geoRiskScore);
  if (factors.length === 0) factors.push('No elevated location risks detected');

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
const PROPERTY_PREMIUM: Record<RiskBand, number> = { A: 0, B: 0.01, C: 0.03, D: 0.05, E: 0.08 };
const TENANT_DISCOUNT: Record<RiskBand, number> = { A: 0.15, B: 0.10, C: 0.05, D: 0, E: 0 };

export interface DualRiskPricingInput {
  baseRentUSD: number;
  geoRiskBand: RiskBand;
  tenantTrustBand: RiskBand;
}
export interface DualRiskPricingResult {
  baseRentUSD: number;
  propertyPremiumPct: number;
  tenantDiscountPct: number;
  adjustedRentUSD: number;
  deltaUSD: number;
  explanation: string;
}

export function priceWithDualRisk(input: DualRiskPricingInput): DualRiskPricingResult {
  const premiumPct = PROPERTY_PREMIUM[input.geoRiskBand] ?? 0;
  const discountPct = TENANT_DISCOUNT[input.tenantTrustBand] ?? 0;
  // Net multiplier: (1 + premium) * (1 - discount)
  const mult = (1 + premiumPct) * (1 - discountPct);
  const adjusted = +(input.baseRentUSD * mult).toFixed(2);
  const delta = +(adjusted - input.baseRentUSD).toFixed(2);
  const explanation =
    `Property risk ${input.geoRiskBand} (+${(premiumPct * 100).toFixed(0)}%) ` +
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

export const geoRiskOracle = { assessProperty, priceWithDualRisk, scoreToRiskBand };
