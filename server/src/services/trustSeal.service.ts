import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { ptpEngine, PTPAttestation, PTP_RISK_BANDS, PTPRiskBand } from '../protocol/ptp.spec';
import { trustFluxService } from './trustFlux.service';

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
  domain: string;               // Authorized domain (anti-tampering)
  riskBand: PTPRiskBand;
  attestation: PTPAttestation;
  createdAt: number;
  lastRefreshedAt: number;
  impressions: number;
  clicks: number;
  active: boolean;
  monthlyPriceUSD: number;
}

const SEAL_TIER_PRICING: Record<SealTier, { priceUSD: number; features: string[] }> = {
  STARTER: {
    priceUSD: 29,
    features: ['Static trust badge', 'Risk band display', 'Basic verification page'],
  },
  PROFESSIONAL: {
    priceUSD: 99,
    features: ['Animated trust badge', 'Risk band + trend arrow', 'Full verification page', 'Click analytics'],
  },
  ENTERPRISE: {
    priceUSD: 499,
    features: ['Custom-branded badge', 'Full PTP attestation display', 'Warranty badge', 'Guarantee coverage indicator', 'White-label verification page'],
  },
};

// In-memory seal store (production: Redis + DB)
const activeSealStore = new Map<string, TrustSeal>();

export class TrustSealService {

  /**
   * Register a new trust seal for a merchant.
   * Returns the seal ID and embed code.
   */
  public async registerSeal(
    merchantId: string,
    merchantName: string,
    domain: string,
    tier: SealTier = 'STARTER'
  ): Promise<{ seal: TrustSeal; embedCode: string }> {
    const sealId = `seal_${crypto.randomBytes(12).toString('hex')}`;
    const pricing = SEAL_TIER_PRICING[tier];

    // Get merchant's trust data
    const trustData = await this.getMerchantTrustData(merchantId);

    // Issue PTP attestation
    const attestation = ptpEngine.issueAttestation(
      merchantId,
      'BUSINESS',
      trustData.trustScore,
      trustData.velocity
    );

    const seal: TrustSeal = {
      sealId,
      merchantId,
      merchantName,
      tier,
      domain,
      riskBand: attestation.assessment.riskBand,
      attestation,
      createdAt: Date.now(),
      lastRefreshedAt: Date.now(),
      impressions: 0,
      clicks: 0,
      active: true,
      monthlyPriceUSD: pricing.priceUSD,
    };

    activeSealStore.set(sealId, seal);

    const baseUrl = process.env.API_BASE_URL || 'https://api.pabandi.com';
    const embedCode = `<!-- Pabandi Trust Seal -->\n<div id="pabandi-trust-seal" data-seal-id="${sealId}"></div>\n<script src="${baseUrl}/sdk/seal.js" async></script>`;

    logger.info(`[TrustSeal] Seal registered: ${sealId} for ${merchantName} (${tier}, $${pricing.priceUSD}/mo)`);

    return { seal, embedCode };
  }

  /**
   * Render the seal data for the embedded widget.
   * This is called by the seal.js SDK on every page load → metered impression.
   */
  public async renderSeal(sealId: string, requestDomain?: string): Promise<{
    html: string;
    data: any;
  } | null> {
    const seal = activeSealStore.get(sealId);
    if (!seal || !seal.active) return null;

    // Anti-tampering: check domain if provided
    if (requestDomain && !this.isDomainAuthorized(seal.domain, requestDomain)) {
      logger.warn(`[TrustSeal] Unauthorized domain ${requestDomain} attempted to render seal ${sealId}`);
      return null;
    }

    // Refresh attestation if stale (>15 minutes)
    if (Date.now() - seal.lastRefreshedAt > 15 * 60 * 1000) {
      await this.refreshSeal(seal);
    }

    // Record impression
    seal.impressions++;

    const bandSpec = PTP_RISK_BANDS[seal.riskBand];
    const velocity = seal.attestation.assessment.velocity;

    // Generate the seal visual data
    const sealData = {
      sealId,
      merchantName: seal.merchantName,
      riskBand: seal.riskBand,
      riskLabel: bandSpec.label,
      color: bandSpec.sealColor,
      trend: velocity.direction,
      trendArrow: velocity.direction === 'RISING' ? '↗' : velocity.direction === 'DECLINING' ? '↘' : '→',
      confidence: velocity.confidence,
      guaranteeMax: seal.attestation.guarantee?.maxAmountUSD || 0,
      isGuaranteed: !!seal.attestation.guarantee,
      verifyUrl: `https://pabandi.com/verify/${sealId}`,
      protocolVersion: 'PTP/1.0',
      tier: seal.tier,
    };

    // Generate HTML based on tier
    const html = this.generateSealHTML(sealData, seal.tier);

    return { html, data: sealData };
  }

  /**
   * Handle seal click-through — returns the full verification page data.
   */
  public async verifySeal(sealId: string): Promise<{
    merchantName: string;
    attestation: PTPAttestation;
    verification: any;
    sealTier: SealTier;
  } | null> {
    const seal = activeSealStore.get(sealId);
    if (!seal || !seal.active) return null;

    // Record click
    seal.clicks++;

    // Verify the attestation
    const verification = ptpEngine.verifyAttestation(seal.attestation);

    return {
      merchantName: seal.merchantName,
      attestation: seal.attestation,
      verification,
      sealTier: seal.tier,
    };
  }

  /**
   * Get seal analytics (impressions, clicks, CTR).
   */
  public getSealStats(sealId: string): {
    impressions: number;
    clicks: number;
    ctr: number;
    tier: SealTier;
    monthlyPriceUSD: number;
    riskBand: PTPRiskBand;
  } | null {
    const seal = activeSealStore.get(sealId);
    if (!seal) return null;

    return {
      impressions: seal.impressions,
      clicks: seal.clicks,
      ctr: seal.impressions > 0 ? Math.round((seal.clicks / seal.impressions) * 10000) / 100 : 0,
      tier: seal.tier,
      monthlyPriceUSD: seal.monthlyPriceUSD,
      riskBand: seal.riskBand,
    };
  }

  /**
   * Get available seal tiers and pricing.
   */
  public getTierPricing(): typeof SEAL_TIER_PRICING {
    return SEAL_TIER_PRICING;
  }

  // ── Private Methods ──────────────────────────────────────────────────

  private async refreshSeal(seal: TrustSeal): Promise<void> {
    try {
      const trustData = await this.getMerchantTrustData(seal.merchantId);
      seal.attestation = ptpEngine.issueAttestation(
        seal.merchantId,
        'BUSINESS',
        trustData.trustScore,
        trustData.velocity
      );
      seal.riskBand = seal.attestation.assessment.riskBand;
      seal.lastRefreshedAt = Date.now();
    } catch (err: any) {
      logger.warn(`[TrustSeal] Refresh failed for ${seal.sealId}: ${err.message}`);
    }
  }

  private async getMerchantTrustData(merchantId: string): Promise<{
    trustScore: number;
    velocity: { direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE'; momentum: number; confidence: number };
  }> {
    try {
      const flux = await trustFluxService.computeTrustFlux(merchantId);
      const user = await prisma.user.findUnique({
        where: { id: merchantId },
        select: { trustScore: true },
      }).catch(() => null);

      return {
        trustScore: user?.trustScore || 50,
        velocity: {
          direction: flux.trend as any,
          momentum: Math.abs(flux.velocity),
          confidence: flux.confidence,
        },
      };
    } catch {
      return {
        trustScore: 50,
        velocity: { direction: 'STEADY', momentum: 0, confidence: 0.1 },
      };
    }
  }

  private isDomainAuthorized(authorized: string, requested: string): boolean {
    const authDomain = authorized.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    const reqDomain = requested.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    return reqDomain.endsWith(authDomain) || authDomain === '*';
  }

  /**
   * Generate the seal HTML based on tier.
   */
  private generateSealHTML(data: any, tier: SealTier): string {
    const baseStyles = `
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      background: linear-gradient(135deg, ${data.color}15, ${data.color}08);
      border: 1.5px solid ${data.color}40;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
    `;

    const shieldSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 7V12C3 17.5 6.8 22.7 12 24C17.2 22.7 21 17.5 21 12V7L12 2Z" fill="${data.color}" opacity="0.15" stroke="${data.color}" stroke-width="1.5"/><path d="M9 12L11 14L15 10" stroke="${data.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    if (tier === 'STARTER') {
      return `<a href="${data.verifyUrl}" target="_blank" rel="noopener" style="${baseStyles}" title="Verified by Pabandi Trust Protocol">${shieldSVG}<span style="font-size:12px;font-weight:600;color:${data.color}">PTP Verified</span></a>`;
    }

    const trendHTML = (tier as string) !== 'STARTER' ? `<span style="font-size:11px;color:${data.color};opacity:0.8">${data.trendArrow} Band ${data.riskBand}</span>` : '';
    const guaranteeHTML = data.isGuaranteed && tier === 'ENTERPRISE' ? `<span style="font-size:10px;color:${data.color};opacity:0.7">🛡️ Up to $${data.guaranteeMax} guaranteed</span>` : '';

    return `<a href="${data.verifyUrl}" target="_blank" rel="noopener" style="${baseStyles}" title="Verified by Pabandi Trust Protocol">
      ${shieldSVG}
      <div style="display:flex;flex-direction:column;gap:1px">
        <span style="font-size:12px;font-weight:600;color:${data.color}">PTP Verified · ${data.riskLabel}</span>
        ${trendHTML}
        ${guaranteeHTML}
      </div>
    </a>`;
  }
}

export const trustSealService = new TrustSealService();
