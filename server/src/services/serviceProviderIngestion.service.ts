import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { ptpEngine } from '../protocol/ptp.spec';
import { trustPassportService } from './trustPassport.service';
import { badgeService } from './badge.service';

export interface ExternalProviderProfile {
  source: 'upwork' | 'taskrabbit' | 'fiverr' | 'thumbtack' | 'manual';
  sourceId: string; // external platform's unique ID
  name: string;
  handle?: string;
  bio?: string;
  location?: string;
  websiteUrl?: string;
  avatarUrl?: string;
  hourlyRate?: number;
  currency?: string;
  skills?: string[];
  category?: string;
  rating?: number; // 1-5 stars
  reviewCount?: number;
  totalEarnings?: number;
  jobsCompleted?: number;
  accountAgeDays?: number;
  isVerified?: boolean;
  accountLevel?: string; // e.g. "Top Rated Plus", "Elite"
  portfolioUrls?: string[];
  rawData?: Record<string, any>;
}

export interface NormalizedProvider {
  handle: string;
  displayName: string;
  category: string;
  bio: string;
  location: string | null;
  websiteUrl: string | null;
  avatarUrl: string | null;
  skills: string[];
  hourlyRate: number | null;
  currency: string;
  trustScore: number; // 0-1000
  riskBand: 'A' | 'B' | 'C' | 'D' | 'E';
  source: string;
  sourceId: string;
  externalRating: number | null;
  reviewCount: number | null;
  jobsCompleted: number | null;
  totalEarnings: number | null;
  accountAgeDays: number | null;
  isVerified: boolean;
  accountLevel: string | null;
  portfolioUrls: string[];
  rawData: Record<string, any>;
}

/**
 * Normalize an external provider profile into Pabandi's trust model.
 *
 * Trust score formula (0-1000):
 *   - Base cold start: 500
 *   - Rating (1-5): up to +200 (5.0 = +200, 4.0 = +160, etc.)
 *   - Review count: up to +150 (logarithmic, 100+ reviews = +150)
 *   - Jobs completed: up to +100 (logarithmic)
 *   - Account age: up to +100 (2+ years = +100)
 *   - Verification badge: +50
 *   - Top-tier account level: +100
 *   - Portfolio items: up to +50
 *   - Total earnings: up to +50 (logarithmic)
 */
export function normalizeTrustScore(profile: ExternalProviderProfile): number {
  let score = 500; // cold start

  // ── Rating: 1-5 stars → 0-200 points ──
  if (profile.rating) {
    score += Math.round(((profile.rating - 1) / 4) * 200);
  }

  // ── Review count: logarithmic, cap at 150 ──
  if (profile.reviewCount && profile.reviewCount > 0) {
    const reviewPoints = Math.min(150, Math.round(Math.log10(profile.reviewCount + 1) * 50));
    score += reviewPoints;
  }

  // ── Jobs completed: logarithmic, cap at 100 ──
  if (profile.jobsCompleted && profile.jobsCompleted > 0) {
    const jobPoints = Math.min(100, Math.round(Math.log10(profile.jobsCompleted + 1) * 40));
    score += jobPoints;
  }

  // ── Account age: 2+ years = +100 ──
  if (profile.accountAgeDays) {
    if (profile.accountAgeDays >= 730) score += 100;
    else if (profile.accountAgeDays >= 365) score += 50;
    else if (profile.accountAgeDays >= 180) score += 25;
  }

  // ── Platform verification: +50 ──
  if (profile.isVerified) score += 50;

  // ── Account level: Top Rated / Elite = +100 ──
  if (profile.accountLevel) {
    const levelLower = profile.accountLevel.toLowerCase();
    if (levelLower.includes('top rated') || levelLower.includes('elite') || levelLower.includes('pro')) {
      score += 100;
    } else if (levelLower.includes('intermediate') || levelLower.includes('established')) {
      score += 50;
    }
  }

  // ── Portfolio: up to +50 ──
  if (profile.portfolioUrls && profile.portfolioUrls.length > 0) {
    score += Math.min(50, profile.portfolioUrls.length * 10);
  }

  // ── Total earnings: logarithmic, cap at 50 ──
  if (profile.totalEarnings && profile.totalEarnings > 0) {
    const earningPoints = Math.min(50, Math.round(Math.log10(profile.totalEarnings + 1) * 10));
    score += earningPoints;
  }

  return Math.min(1000, Math.max(0, score));
}

/**
 * Normalize an external profile into Pabandi's provider format.
 */
export function normalizeProvider(profile: ExternalProviderProfile): NormalizedProvider {
  const trustScore = normalizeTrustScore(profile);
  const riskBand = ptpEngine.scoreToRiskBand(trustScore);

  // Generate a handle from name if not provided
  const handle = profile.handle || profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) + '-' + profile.sourceId.slice(-6);

  return {
    handle,
    displayName: profile.name,
    category: profile.category || 'FREELANCER',
    bio: profile.bio || `Service provider imported from ${profile.source}.`,
    location: profile.location || null,
    websiteUrl: profile.websiteUrl || null,
    avatarUrl: profile.avatarUrl || null,
    skills: profile.skills || [],
    hourlyRate: profile.hourlyRate || null,
    currency: profile.currency || 'USD',
    trustScore,
    riskBand,
    source: profile.source,
    sourceId: profile.sourceId,
    externalRating: profile.rating || null,
    reviewCount: profile.reviewCount || null,
    jobsCompleted: profile.jobsCompleted || null,
    totalEarnings: profile.totalEarnings || null,
    accountAgeDays: profile.accountAgeDays || null,
    isVerified: profile.isVerified || false,
    accountLevel: profile.accountLevel || null,
    portfolioUrls: profile.portfolioUrls || [],
    rawData: profile.rawData || {},
  };
}

/**
 * Ingest a single external provider into Pabandi:
 *   1. Create/update TrustPassport
 *   2. Create/update SocialIdentity (if platform supported)
 *   3. Issue PTP attestation
 *   4. Return the normalized provider with passport ID
 */
export async function ingestProvider(profile: ExternalProviderProfile): Promise<NormalizedProvider & { passportId: string; attestation: any }> {
  const normalized = normalizeProvider(profile);

  // ── 1. Create/update TrustPassport ──
  const passport = await trustPassportService.upsert({
    handle: normalized.handle,
    displayName: normalized.displayName,
    category: normalized.category,
    bio: normalized.bio,
    walletAddress: undefined, // external providers don't have Pabandi wallets yet
    providerRef: `${normalized.source}:${normalized.sourceId}`,
  });

  // ── 2. Update passport with trust fields ──
  await prisma.trustPassport.update({
    where: { id: passport.id },
    data: {
      riskScore: normalized.trustScore,
      riskBand: normalized.riskBand,
      skills: normalized.skills,
      location: normalized.location,
      websiteUrl: normalized.websiteUrl,
      avatarUrl: normalized.avatarUrl,
      headline: `${normalized.displayName} — ${normalized.category}`,
      score: normalized.trustScore,
      verified: normalized.isVerified,
      socialLinks: {
        source: normalized.source,
        sourceId: normalized.sourceId,
        portfolio: normalized.portfolioUrls,
      },
      portfolioItems: normalized.portfolioUrls.map((url, i) => ({
        title: `Portfolio Item ${i + 1}`,
        url,
        type: 'link',
      })),
      lastCheckedAt: new Date(),
    },
  });

  // ── 3. Create SocialIdentity record if platform is supported ──
  const platformMap: Record<string, string> = {
    upwork: 'UPWORK',
    fiverr: 'FIVERR',
    taskrabbit: 'UPWORK', // closest match - task-based platform
    thumbtack: 'UPWORK',
  };
  const platform = platformMap[profile.source];
  if (platform) {
    await prisma.socialIdentity.upsert({
      where: {
        userId_platform: {
          userId: passport.id, // link to passport as pseudo-user
          platform: platform as any,
        },
      },
      update: {
        platformHandle: profile.sourceId,
        rating: profile.rating,
        completionRate: profile.jobsCompleted && profile.reviewCount
          ? Math.min(1, profile.jobsCompleted / Math.max(profile.reviewCount, 1))
          : undefined,
        accountLevel: profile.accountLevel,
        accountAgeDays: profile.accountAgeDays,
        isVerified: profile.isVerified,
        lastRefreshed: new Date(),
      },
      create: {
        userId: passport.id,
        platform: platform as any,
        platformHandle: profile.sourceId,
        rating: profile.rating,
        completionRate: profile.jobsCompleted && profile.reviewCount
          ? Math.min(1, profile.jobsCompleted / Math.max(profile.reviewCount, 1))
          : undefined,
        accountLevel: profile.accountLevel,
        accountAgeDays: profile.accountAgeDays,
        isVerified: profile.isVerified,
      },
    });
  }

  // ── 4. Issue PTP attestation ──
  const attestation = ptpEngine.issueAttestation(
    passport.id,
    'INDIVIDUAL',
    normalized.trustScore,
    { direction: 'STEADY', momentum: 0, confidence: 0.5 }
  );

  logger.info(
    `[ServiceProviderIngestion] Ingested ${profile.source}/${profile.sourceId} → passport ${passport.id} (score=${normalized.trustScore}, band=${normalized.riskBand})`
  );

  return { ...normalized, passportId: passport.id, attestation };
}

/**
 * Batch ingest multiple providers.
 */
export async function ingestProviders(profiles: ExternalProviderProfile[]): Promise<{
  ingested: (NormalizedProvider & { passportId: string })[];
  errors: { sourceId: string; error: string }[];
}> {
  const ingested: (NormalizedProvider & { passportId: string })[] = [];
  const errors: { sourceId: string; error: string }[] = [];

  for (const profile of profiles) {
    try {
      const result = await ingestProvider(profile);
      ingested.push(result);
    } catch (err: any) {
      errors.push({
        sourceId: profile.sourceId,
        error: err.message,
      });
      logger.error(
        `[ServiceProviderIngestion] Failed to ingest ${profile.source}/${profile.sourceId}: ${err.message}`
      );
    }
  }

  return { ingested, errors };
}

/**
 * Discover providers for AI agent booking.
 * Filters by minimum trust score, category, and availability.
 */
export async function discoverProviders(input: {
  minTrustScore?: number;
  category?: string;
  skills?: string[];
  limit?: number;
  offset?: number;
}): Promise<{
  providers: NormalizedProvider[];
  total: number;
  hasMore: boolean;
}> {
  const {
    minTrustScore = 0,
    category,
    skills = [],
    limit = 20,
    offset = 0,
  } = input;

  const where: any = {
    visibility: 'PUBLIC',
    riskScore: { gte: minTrustScore },
  };
  if (category) where.category = category;

  const [passports, total] = await Promise.all([
    prisma.trustPassport.findMany({
      where,
      orderBy: { riskScore: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.trustPassport.count({ where }),
  ]);

  const providers = passports.map((p) => ({
    handle: p.handle,
    displayName: p.displayName,
    category: p.category,
    bio: p.bio || '',
    location: p.location,
    websiteUrl: p.websiteUrl,
    avatarUrl: p.avatarUrl,
    skills: Array.isArray(p.skills) ? (p.skills as string[]) : [],
    hourlyRate: null,
    currency: 'USD',
    trustScore: p.riskScore || 500,
    riskBand: p.riskBand as any,
    source: 'pabandi',
    sourceId: p.id,
    externalRating: null,
    reviewCount: null,
    jobsCompleted: null,
    totalEarnings: null,
    accountAgeDays: null,
    isVerified: p.verified || false,
    accountLevel: null,
    portfolioUrls: (p.socialLinks as any)?.portfolio || [],
    rawData: {},
    passportId: p.id,
  }));

  // Filter by skills if specified
  let filtered: NormalizedProvider[] = providers;
  if (skills.length > 0) {
    filtered = providers.filter((p) => {
      const pSkills = Array.isArray(p.skills) ? p.skills : [];
      return skills.some((s) => pSkills.some((ps: string) => ps.toLowerCase() === s.toLowerCase()));
    });
  }

  return {
    providers: filtered.slice(0, limit),
    total,
    hasMore: offset + limit < total,
  };
}

export const serviceProviderIngestion = {
  normalizeProvider,
  normalizeTrustScore,
  ingestProvider,
  ingestProviders,
  discoverProviders,
};
