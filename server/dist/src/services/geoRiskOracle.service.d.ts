export type RiskBand = 'A' | 'B' | 'C' | 'D' | 'E';
export interface GeoRiskInput {
    lat?: number;
    lng?: number;
    address?: string;
    /** Optional pre-resolved external signals (for when live feeds exist) */
    floodZone?: string;
    crimeRatePer1k?: number;
    schoolRating?: number;
}
export interface GeoRiskResult {
    geohash: string;
    flood: {
        zone: string;
        score: number;
        label: string;
    };
    crime: {
        ratePer1k: number;
        score: number;
        label: string;
    };
    school: {
        rating: number;
        score: number;
        label: string;
    };
    geoRiskScore: number;
    riskBand: RiskBand;
    factors: string[];
    simulated: boolean;
}
/** Map a 0..100 risk score to a band (A safest → E riskiest). */
export declare function scoreToRiskBand(score: number): RiskBand;
/**
 * Assess a property's intrinsic (location) risk.
 * Live feeds (floodZone / crimeRatePer1k / schoolRating) take precedence;
 * otherwise a transparent geohash-seeded heuristic is used and flagged.
 */
export declare function assessProperty(input: GeoRiskInput): GeoRiskResult;
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
export declare function priceWithDualRisk(input: DualRiskPricingInput): DualRiskPricingResult;
export declare const geoRiskOracle: {
    assessProperty: typeof assessProperty;
    priceWithDualRisk: typeof priceWithDualRisk;
    scoreToRiskBand: typeof scoreToRiskBand;
};
//# sourceMappingURL=geoRiskOracle.service.d.ts.map