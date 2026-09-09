// Sitara OS — Star Power Utilities

export const STAR_TIERS = {
  'tara': { name: 'Tara', min: 0, max: 99, color: 'from-slate-400 to-slate-500' },
  'sitara-e-noor': { name: 'Sitara-e-Noor', min: 100, max: 499, color: 'from-amber-400 to-amber-500' },
  'sitara-e-roshan': { name: 'Sitara-e-Roshan', min: 500, max: 1999, color: 'from-amber-500 to-orange-500' },
  'sitara-e-darakshan': { name: 'Sitara-e-Darakshan', min: 2000, max: 9999, color: 'from-orange-500 to-red-500' },
  'sitara-e-izzat': { name: 'Sitara-e-Izzat', min: 10000, max: Infinity, color: 'from-purple-500 to-pink-500' },
} as const;

export type StarTier = keyof typeof STAR_TIERS;

export function calculateTier(starPower: number): StarTier {
  if (starPower >= 10000) return 'sitara-e-izzat';
  if (starPower >= 2000) return 'sitara-e-darakshan';
  if (starPower >= 500) return 'sitara-e-roshan';
  if (starPower >= 100) return 'sitara-e-noor';
  return 'tara';
}

export function getNextTier(currentTier: StarTier): StarTier | null {
  const tiers: StarTier[] = ['tara', 'sitara-e-noor', 'sitara-e-roshan', 'sitara-e-darakshan', 'sitara-e-izzat'];
  const currentIndex = tiers.indexOf(currentTier);
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
}

export function getTierProgress(starPower: number, tier: StarTier): number {
  const tierData = STAR_TIERS[tier];
  const nextTier = getNextTier(tier);
  if (!nextTier) return 100;
  const nextMin = STAR_TIERS[nextTier].min;
  const range = nextMin - tierData.min;
  const progress = starPower - tierData.min;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}

// Star Power earning rules
export const EARN_RULES = {
  CHECK_IN: 10,
  REVIEW: 25,
  UPVOTE_RECEIVED: 5,
  PROMO_REDEEMED: 15,
  REFERRAL: 50,
  STAKING_30D: 100,
  STAKING_90D: 300,
  STAKING_365D: 1500,
} as const;

export function getStarCardUrl(userId: string): string {
  return `https://pabandi.com/star-card/${userId}`;
}
