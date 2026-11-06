/**
 * Trust Band Scoring Configuration.
 * 
 * Configurable via environment variables so risk parameters can be adjusted
 * without requiring a code redeploy.
 */

export interface TrustBandConfig {
  bandA: {
    minLinks: number;
    requirePhishingResistant: boolean; // Passkey or verified phone
    targetScore: number;
  };
  bandB: {
    minLinks: number;
    requireOAuth: boolean; // Google, Apple, GitHub, etc.
    targetScore: number;
  };
  bandC: {
    minLinks: number; // Beyond email (at least 1 non-email link)
    targetScore: number;
  };
  bandD: {
    targetScore: number;
  };
}

export const trustScoringConfig: TrustBandConfig = {
  bandA: {
    minLinks: parseInt(process.env.TRUST_BAND_A_MIN_LINKS || '4', 10),
    requirePhishingResistant: process.env.TRUST_BAND_A_REQUIRE_PHISHING_RESISTANT !== 'false',
    targetScore: parseFloat(process.env.TRUST_BAND_A_SCORE || '90.0'),
  },
  bandB: {
    minLinks: parseInt(process.env.TRUST_BAND_B_MIN_LINKS || '3', 10),
    requireOAuth: process.env.TRUST_BAND_B_REQUIRE_OAUTH !== 'false',
    targetScore: parseFloat(process.env.TRUST_BAND_B_SCORE || '75.0'),
  },
  bandC: {
    minLinks: parseInt(process.env.TRUST_BAND_C_MIN_LINKS || '1', 10),
    targetScore: parseFloat(process.env.TRUST_BAND_C_SCORE || '55.0'),
  },
  bandD: {
    targetScore: parseFloat(process.env.TRUST_BAND_D_SCORE || '25.0'),
  },
};
