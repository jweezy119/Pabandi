/**
 * `verificationTier` is written by two different writers and they do not agree
 * on a vocabulary:
 *
 *   - seed data and signup write human tiers: `BASIC`, `VERIFIED`
 *   - the Privy trust-band sync writes `BAND_A` … `BAND_D`
 *
 * Profile screens render the column verbatim, so after a sync a user would see
 * the raw machine string `BAND_A` where everyone else shows `VERIFIED`. These
 * helpers normalise it to something a person can read, and expose what the band
 * actually means for deposits.
 */

export type TrustBand = 'A' | 'B' | 'C' | 'D';

/** The band encoded in a tier, or null when the tier is not a band. */
export function parseTrustBand(tier?: string | null): TrustBand | null {
  if (!tier) return null;
  const match = /^BAND_([A-D])$/i.exec(tier.trim());
  return match ? (match[1].toUpperCase() as TrustBand) : null;
}

/** Display label. Bands read as "Trust Band A"; legacy tiers pass through. */
export function tierLabel(tier?: string | null): string {
  const band = parseTrustBand(tier);
  if (band) return `Trust Band ${band}`;
  return tier && tier.trim() ? tier.trim() : 'BASIC';
}

/**
 * What the band costs the user, matching the rules published at
 * GET /api/v1/privy/trust-band-rules. Used as a badge tooltip.
 */
export const TRUST_BAND_DEPOSIT: Record<TrustBand, string> = {
  A: 'Zero deposit',
  B: 'Low deposit',
  C: 'Standard deposit',
  D: 'Full deposit',
};

/** Tooltip text for a tier, or undefined when there is nothing to explain. */
export function tierTitle(tier?: string | null): string | undefined {
  const band = parseTrustBand(tier);
  return band ? `${TRUST_BAND_DEPOSIT[band]} — scored from your linked Privy identity` : undefined;
}
