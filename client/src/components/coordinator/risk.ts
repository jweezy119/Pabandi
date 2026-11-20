import type { RiskBand } from './types';

/**
 * Risk bands and the plain language that goes with them.
 *
 * The thresholds mirror `HITL_RISK_LOW` / `HITL_RISK_HIGH` on the server (§5,
 * default 0.35 / 0.70). They are duplicated here only as a fallback for when
 * the API has not supplied a band; Phase 4 should return `band` explicitly so
 * the server stays the single source of truth. If these numbers change, they
 * change in both places.
 */
export const RISK_LOW_THRESHOLD = 0.35;
export const RISK_HIGH_THRESHOLD = 0.7;

export function riskBand(score: number, override?: RiskBand): RiskBand {
  if (override) return override;
  if (score < RISK_LOW_THRESHOLD) return 'low';
  if (score > RISK_HIGH_THRESHOLD) return 'high';
  return 'medium';
}

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};

/** Data, so mono — see the typography rule in §2. */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * The one-sentence explanation every risk chip carries (§4.2). Worded for a
 * business owner with no SaaS experience: no "score", no "probability", no
 * "model". Higher always means more likely to go wrong.
 */
export function riskTooltip(band: RiskBand, score: number): string {
  const percent = Math.round(score * 100);
  const lead = 'Higher means we think this job is more likely to go wrong.';
  if (band === 'high') {
    return `${lead} ${percent}% means there is a meaningful chance of a problem.`;
  }
  if (band === 'medium') {
    return `${lead} ${percent}% means the chance of a problem is neither small nor large.`;
  }
  return `${lead} ${percent}% means a problem is unlikely.`;
}

export const OUT_OF_RANGE_TOOLTIP =
  'This estimate is outside the range our model was trained on, so we are less confident in it than the other numbers.';

/**
 * Formats the merchant-facing DRPE summary line shown on the Coordinator Dashboard:
 * - Verified / Low-risk client (Trust Score 90+ or low risk band): "Client Risk: LOW. Deposit Required: 0%."
 * - Brand new / Medium-risk client (Trust Score 70): "Client Risk: MEDIUM. Deposit Required: 20%."
 * - Elevated-risk client: "Client Risk: HIGH. Deposit Required: 20%."
 */
export function formatClientRiskDepositSummary(params: {
  clientTrustScore?: number;
  depositRequiredPercent?: number;
  riskScore?: number;
  riskBandOverride?: RiskBand;
}): string | null {
  if (typeof params.clientTrustScore === 'number' && Number.isFinite(params.clientTrustScore)) {
    const normalized =
      params.clientTrustScore > 100
        ? Math.round(params.clientTrustScore / 10)
        : Math.round(params.clientTrustScore);
    if (normalized >= 90) {
      const pct = typeof params.depositRequiredPercent === 'number' ? params.depositRequiredPercent : 0;
      return `Client Risk: LOW. Deposit Required: ${pct}%.`;
    }
    const level = normalized < 50 ? 'HIGH' : 'MEDIUM';
    const pct = typeof params.depositRequiredPercent === 'number' ? params.depositRequiredPercent : 20;
    return `Client Risk: ${level}. Deposit Required: ${pct}%.`;
  }

  if (typeof params.riskScore === 'number' && Number.isFinite(params.riskScore)) {
    const band = riskBand(params.riskScore, params.riskBandOverride);
    const level = band === 'low' ? 'LOW' : band === 'high' ? 'HIGH' : 'MEDIUM';
    const pct =
      typeof params.depositRequiredPercent === 'number'
        ? params.depositRequiredPercent
        : band === 'low'
          ? 0
          : 20;
    return `Client Risk: ${level}. Deposit Required: ${pct}%.`;
  }

  return null;
}
