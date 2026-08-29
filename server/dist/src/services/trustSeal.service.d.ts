import { PTPAttestation, PTPRiskBand } from '../protocol/ptp.spec';
/**
 * TrustSealService — Embeddable Trust Badges for Merchants
 * ────────────────────────────────────────────────────────────────────────────
 * The "Norton Secured" / "Verified by Visa" equivalent for informal commerce.
 *
 * Merchants embed a single line of HTML on their website:
 *   <div id="pabandi-trust-seal" data-seal-id="seal_abc123"></div>
 *   <script src="https://api.pabandi.com/sdk/seal.js"></script>
 *
 * The seal displays their live PTP trust status as an animated badge.
 * Every render is a metered impression. Every click-through is tracked.
 *
 * Revenue Model:
 *   Starter     = $29/mo   → static badge, basic trust level
 *   Professional = $99/mo  → animated badge, risk band, trend arrow
 *   Enterprise   = $499/mo → custom branding, full attestation, warranty badge
 */
export type SealTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export interface TrustSeal {
    sealId: string;
    merchantId: string;
    merchantName: string;
    tier: SealTier;
    domain: string;
    riskBand: PTPRiskBand;
    attestation: PTPAttestation;
    createdAt: number;
    lastRefreshedAt: number;
    impressions: number;
    clicks: number;
    active: boolean;
    monthlyPriceUSD: number;
}
declare const SEAL_TIER_PRICING: Record<SealTier, {
    priceUSD: number;
    features: string[];
}>;
export declare class TrustSealService {
    /**
     * Register a new trust seal for a merchant.
     * Returns the seal ID and embed code.
     */
    registerSeal(merchantId: string, merchantName: string, domain: string, tier?: SealTier): Promise<{
        seal: TrustSeal;
        embedCode: string;
    }>;
    /**
     * Render the seal data for the embedded widget.
     * This is called by the seal.js SDK on every page load → metered impression.
     */
    renderSeal(sealId: string, requestDomain?: string): Promise<{
        html: string;
        data: any;
    } | null>;
    /**
     * Handle seal click-through — returns the full verification page data.
     */
    verifySeal(sealId: string): Promise<{
        merchantName: string;
        attestation: PTPAttestation;
        verification: any;
        sealTier: SealTier;
    } | null>;
    /**
     * Get seal analytics (impressions, clicks, CTR).
     */
    getSealStats(sealId: string): {
        impressions: number;
        clicks: number;
        ctr: number;
        tier: SealTier;
        monthlyPriceUSD: number;
        riskBand: PTPRiskBand;
    } | null;
    /**
     * Get available seal tiers and pricing.
     */
    getTierPricing(): typeof SEAL_TIER_PRICING;
    private refreshSeal;
    private getMerchantTrustData;
    private isDomainAuthorized;
    /**
     * Generate the seal HTML based on tier.
     */
    private generateSealHTML;
}
export declare const trustSealService: TrustSealService;
export {};
//# sourceMappingURL=trustSeal.service.d.ts.map