/**
 * blockchain.types.ts
 * ─────────────────────────────────────────────
 * Shared types for Pabandi's blockchain integration (BSC + Solana).
 * Defined here so server code doesn't cross rootDir boundaries.
 */

export enum BadgeTier {
  Bronze   = 0,
  Silver   = 1,
  Gold     = 2,
  Platinum = 3,
}

export const BADGE_TIER_NAMES: Record<BadgeTier, string> = {
  [BadgeTier.Bronze]:   'Bronze Patron',
  [BadgeTier.Silver]:   'Silver Reliable',
  [BadgeTier.Gold]:     'Gold Trustee',
  [BadgeTier.Platinum]: 'Platinum Oracle',
};

export const BADGE_TIER_CONFIG: Record<BadgeTier, { name: string; emoji: string; minBookings: number; minShowRate: number }> = {
  [BadgeTier.Bronze]:   { name: 'Bronze Patron',   emoji: '🥉', minBookings: 1,  minShowRate: 70 },
  [BadgeTier.Silver]:   { name: 'Silver Reliable', emoji: '🥈', minBookings: 5,  minShowRate: 80 },
  [BadgeTier.Gold]:     { name: 'Gold Trustee',    emoji: '🥇', minBookings: 10, minShowRate: 90 },
  [BadgeTier.Platinum]: { name: 'Platinum Oracle', emoji: '💎', minBookings: 25, minShowRate: 97 },
};

/**
 * Compute which badge tier a user is eligible for based on stats.
 */
export function computeEligibleTier(
  totalBookings: number,
  showRate: number
): BadgeTier | null {
  if (totalBookings >= 25 && showRate >= 97) return BadgeTier.Platinum;
  if (totalBookings >= 10 && showRate >= 90) return BadgeTier.Gold;
  if (totalBookings >= 5  && showRate >= 80) return BadgeTier.Silver;
  if (totalBookings >= 1  && showRate >= 70) return BadgeTier.Bronze;
  return null;
}

export interface MintBadgeResult {
  success: boolean;
  chain: 'bsc' | 'solana' | 'simulated';
  tokenId?: string;
  txHash?: string;
  badgePDA?: string;
  tier: BadgeTier;
  tierName: string;
  error?: string;
}

export interface EscrowResult {
  success: boolean;
  txHash?: string;
  reservationIdHash: string;
  error?: string;
}
