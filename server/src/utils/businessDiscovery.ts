/**
 * Utilities for Business Discovery list formatting & name normalization
 */

export function deriveDisplayName(name?: string | null, website?: string | null): string {
  const isUrl = (s: string) => /^https?:\/\//i.test(s) || /^www\./i.test(s);
  if (name && !isUrl(name.trim())) {
    return name.trim();
  }
  const raw = (name && isUrl(name.trim()) ? name : website) || '';
  if (!raw) return 'Verified Provider';
  try {
    const urlStr = raw.startsWith('http') ? raw : `https://${raw}`;
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.replace(/^www\./i, '');
    const clean = hostname.split('.')[0];
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : hostname;
  } catch {
    const stripped = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    return stripped || 'Verified Provider';
  }
}

export function computeTrustBand(trustScore?: number | null): string {
  const score = trustScore ?? 85;
  if (score >= 90) return 'ELITE';
  if (score >= 75) return 'GOLD';
  if (score >= 60) return 'SILVER';
  return 'VERIFIED';
}

export interface FormattedBusinessDiscoveryItem {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
  reviewCount: number;
  avatarUrl: string | null;
  startingPrice: number;
  escrowEnabled: boolean;
  trustBand: string;
  // Supplemental fields for full UI rendering & deep linking
  slug?: string;
  description?: string;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  isVerified?: boolean;
}

export function formatBusinessDiscoveryItem(b: any): FormattedBusinessDiscoveryItem {
  const name = deriveDisplayName(b.name, b.website);
  const trustBand = computeTrustBand(b.trustScore);
  const avatarUrl = b.logoUrl || b.coverImageUrl || null;
  const startingPrice = typeof b.depositAmount === 'number' && b.depositAmount > 0
    ? b.depositAmount
    : (b.startingPrice || 50);
  const escrowEnabled = typeof b.requireDeposit === 'boolean' ? b.requireDeposit : true;

  return {
    id: b.id,
    name,
    category: b.category || 'SERVICES',
    city: b.city || 'Remote',
    rating: b.rating != null ? Number(Number(b.rating).toFixed(1)) : 4.8,
    reviewCount: b.reviewCount != null ? Number(b.reviewCount) : 12,
    avatarUrl,
    startingPrice,
    escrowEnabled,
    trustBand,
    slug: b.slug || b.id,
    description: b.description || undefined,
    address: b.address || undefined,
    website: b.website || undefined,
    phone: b.phone || undefined,
    isVerified: Boolean(b.isVerified),
  };
}

