import axios from 'axios';
import { logger } from '../utils/logger';
import { serviceProviderIngestion, type ExternalProviderProfile } from './serviceProviderIngestion.service';

/**
 * Upwork Public API integration.
 *
 * Upwork's public API (developers.upwork.com) requires OAuth 2.0.
 * This service supports:
 *   1. OAuth 2.0 Authorization Code flow (users connect their Upwork account)
 *   2. Client credentials flow (for app-level access, if available)
 *   3. Fetching freelancer profile data via the Upwork API
 *
 * Environment variables:
 *   UPWORK_CLIENT_ID - Upwork OAuth 2.0 client ID
 *   UPWORK_CLIENT_SECRET - Upwork OAuth 2.0 client secret
 *   UPWORK_REDIRECT_URI - OAuth redirect URI
 */

const UPWORK_BASE_URL = 'https://www.upwork.com';
const UPWORK_API_URL = 'https://api.upwork.com';
const UPWORK_AUTH_URL = 'https://www.upwork.com/services/api/auth';
const UPWORK_TOKEN_URL = 'https://www.upwork.com/services/api/auth';
const UPWORK_PROFILE_URL = 'https://www.upwork.com/profiles/';

export interface UpworkOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface UpworkFreelancerProfile {
  upworkId: string;
  profileUrl: string;
  title: string;
  location: string;
  totalEarnings?: number;
  hourlyRate?: number;
  rating?: number;
  reviewCount?: number;
  jobsCompleted?: number;
  accountAgeDays?: number;
  isVerified?: boolean;
  accountLevel?: string;
  skills: string[];
  bio?: string;
  avatarUrl?: string;
  portfolioUrls: string[];
  rawData: Record<string, any>;
}

/**
 * Generate the Upwork OAuth 2.0 authorization URL.
 * Users are redirected here to grant Pabandi access to their Upwork profile.
 */
export function getUpworkAuthUrl(state: string): string {
  const clientId = process.env.UPWORK_CLIENT_ID;
  const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://pabandi.onrender.com/api/v1/service-providers/upwork/callback';
  const scope = 'profile:read';

  if (!clientId) {
    throw new Error('UPWORK_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  });

  return `${UPWORK_AUTH_URL}/authorize?${params.toString()}`;
}

/**
 * Exchange an Upwork authorization code for access tokens.
 */
export async function exchangeUpworkCode(code: string): Promise<UpworkOAuthTokens> {
  const clientId = process.env.UPWORK_CLIENT_ID;
  const clientSecret = process.env.UPWORK_CLIENT_SECRET;
  const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://pabandi.onrender.com/api/v1/service-providers/upwork/callback';

  if (!clientId || !clientSecret) {
    throw new Error('UPWORK_CLIENT_ID or UPWORK_CLIENT_SECRET not configured');
  }

  const response = await axios.post(`${UPWORK_TOKEN_URL}/token`, null, {
    params: {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in,
  };
}

/**
 * Refresh an Upwork access token.
 */
export async function refreshUpworkToken(refreshToken: string): Promise<UpworkOAuthTokens> {
  const clientId = process.env.UPWORK_CLIENT_ID;
  const clientSecret = process.env.UPWORK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('UPWORK_CLIENT_ID or UPWORK_CLIENT_SECRET not configured');
  }

  const response = await axios.post(`${UPWORK_TOKEN_URL}/token`, null, {
    params: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in,
  };
}

/**
 * Fetch the authenticated user's Upwork profile using the access token.
 * Uses Upwork's /api/profiles/v2/me endpoint.
 */
export async function fetchUpworkProfile(accessToken: string): Promise<UpworkFreelancerProfile> {
  // Upwork API v2: GET /api/profiles/v2/me
  const response = await axios.get(`${UPWORK_API_URL}/api/profiles/v2/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = response.data;

  return {
    upworkId: data.uid || data.id || '',
    profileUrl: data.profile_url || `${UPWORK_PROFILE_URL}${data.uid || data.id}`,
    title: data.title || data.headline || 'Upwork Freelancer',
    location: data.location || data.city || data.country || '',
    totalEarnings: data.total_earnings || data.totalEarnings,
    hourlyRate: data.hourly_rate || data.hourlyRate,
    rating: data.rating,
    reviewCount: data.review_count || data.reviewCount,
    jobsCompleted: data.jobs_completed || data.jobsCompleted,
    accountAgeDays: data.account_age_days || data.accountAgeDays,
    isVerified: data.is_verified || data.isVerified || false,
    accountLevel: data.account_level || data.accountLevel,
    skills: data.skills || data.skillSet || [],
    bio: data.bio || data.description,
    avatarUrl: data.profile_image_url || data.avatarUrl,
    portfolioUrls: data.portfolio_urls || data.portfolioUrls || [],
    rawData: data,
  };
}

/**
 * Search Upwork freelancers by keyword (public API).
 * Requires OAuth 2.0 access token.
 */
export async function searchUpworkFreelancers(
  accessToken: string,
  query: string,
  limit: number = 20
): Promise<UpworkFreelancerProfile[]> {
  const response = await axios.get(`${UPWORK_API_URL}/api/profiles/v2/search`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    params: {
      q: query,
      limit,
    },
  });

  const results = response.data.profiles || response.data.data || [];
  return results.map((p: any) => ({
    upworkId: p.uid || p.id || '',
    profileUrl: p.profile_url || `${UPWORK_PROFILE_URL}${p.uid || p.id}`,
    title: p.title || p.headline || 'Upwork Freelancer',
    location: p.location || p.city || p.country || '',
    totalEarnings: p.total_earnings || p.totalEarnings,
    hourlyRate: p.hourly_rate || p.hourlyRate,
    rating: p.rating,
    reviewCount: p.review_count || p.reviewCount,
    jobsCompleted: p.jobs_completed || p.jobsCompleted,
    accountAgeDays: p.account_age_days || p.accountAgeDays,
    isVerified: p.is_verified || p.isVerified || false,
    accountLevel: p.account_level || p.accountLevel,
    skills: p.skills || p.skillSet || [],
    bio: p.bio || p.description,
    avatarUrl: p.profile_image_url || p.avatarUrl,
    portfolioUrls: p.portfolio_urls || p.portfolioUrls || [],
    rawData: p,
  }));
}

/**
 * Convert an Upwork freelancer profile into a Pabandi ExternalProviderProfile
 * and ingest it into the trust passport system.
 */
export async function ingestUpworkProfile(
  profile: UpworkFreelancerProfile
): Promise<{
  passportId: string;
  handle: string;
  displayName: string;
  trustScore: number;
  riskBand: string;
  source: string;
  sourceId: string;
}> {
  const providerProfile: ExternalProviderProfile = {
    source: 'upwork',
    sourceId: profile.upworkId,
    name: profile.title.split('|')[0].trim() || 'Upwork Freelancer',
    handle: profile.profileUrl.split('/').pop() || profile.upworkId,
    bio: profile.bio,
    location: profile.location,
    websiteUrl: undefined,
    avatarUrl: profile.avatarUrl,
    hourlyRate: profile.hourlyRate,
    currency: 'USD',
    skills: profile.skills,
    category: 'FREELANCER',
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    totalEarnings: profile.totalEarnings,
    jobsCompleted: profile.jobsCompleted,
    accountAgeDays: profile.accountAgeDays,
    isVerified: profile.isVerified,
    accountLevel: profile.accountLevel,
    portfolioUrls: profile.portfolioUrls,
    rawData: profile.rawData,
  };

  const result = await serviceProviderIngestion.ingestProvider(providerProfile);

  return {
    passportId: result.passportId,
    handle: result.handle,
    displayName: result.displayName,
    trustScore: result.trustScore,
    riskBand: result.riskBand,
    source: result.source,
    sourceId: result.sourceId,
  };
}

/**
 * Connect an existing user's Upwork social identity to Pabandi.
 * Looks up the user's social identity record (from registration or OAuth connect)
 * and ingests the Upwork profile data.
 */
export async function ingestUserUpworkIdentity(userId: string): Promise<{
  passportId: string;
  handle: string;
  displayName: string;
  trustScore: number;
  riskBand: string;
  source: string;
  sourceId: string;
} | null> {
  const { prisma } = await import('../utils/database');

  const identity = await prisma.socialIdentity.findFirst({
    where: {
      userId,
      platform: 'UPWORK' as any,
    },
  });

  if (!identity || !identity.platformHandle) {
    logger.info(`[UpworkAPI] No Upwork social identity found for user ${userId}`);
    return null;
  }

  // If we have an access token stored, use the API. Otherwise fall back to scraping.
  const accessToken = process.env.UPWORK_ACCESS_TOKEN;
  if (accessToken) {
    try {
      const profile = await fetchUpworkProfile(accessToken);
      const result = await ingestUpworkProfile(profile);
      return result;
    } catch (err: any) {
      logger.warn(`[UpworkAPI] API fetch failed, falling back to scrape: ${err.message}`);
    }
  }

  // Fall back to Puppeteer scraping using the profile handle as URL
  const profileUrl = `https://www.upwork.com/profiles/${identity.platformHandle}`;
  const { marketplaceScraper } = await import('./marketplaceScraper.service');
  const scraped = await marketplaceScraper.scrapeUpworkProfile(profileUrl);

  const providerProfile: ExternalProviderProfile = {
    source: 'upwork',
    sourceId: identity.platformHandle,
    name: scraped.name || 'Upwork Freelancer',
    handle: scraped.handle || identity.platformHandle,
    bio: scraped.bio,
    location: scraped.location,
    websiteUrl: scraped.websiteUrl,
    avatarUrl: scraped.avatarUrl,
    hourlyRate: scraped.hourlyRate,
    currency: 'USD',
    skills: scraped.skills || [],
    category: 'FREELANCER',
    rating: scraped.rating,
    reviewCount: scraped.reviewCount,
    totalEarnings: scraped.totalEarnings,
    jobsCompleted: scraped.jobsCompleted,
    accountAgeDays: scraped.accountAgeDays,
    isVerified: scraped.isVerified,
    accountLevel: scraped.accountLevel,
    portfolioUrls: scraped.portfolioUrls || [],
    rawData: scraped.rawData,
  };

  const result = await serviceProviderIngestion.ingestProvider(providerProfile);

  return {
    passportId: result.passportId,
    handle: result.handle,
    displayName: result.displayName,
    trustScore: result.trustScore,
    riskBand: result.riskBand,
    source: result.source,
    sourceId: result.sourceId,
  };
}

/**
 * Ingest all Upwork social identities for a user (typically just one).
 */
export async function ingestAllUserUpworkIdentities(userId: string): Promise<{
  ingested: Array<{ passportId: string; handle: string; displayName: string; trustScore: number; riskBand: string }>;
  errors: Array<{ error: string }>;
}> {
  const { prisma } = await import('../utils/database');

  const identities = await prisma.socialIdentity.findMany({
    where: {
      userId,
      platform: 'UPWORK' as any,
    },
  });

  const ingested: Array<{ passportId: string; handle: string; displayName: string; trustScore: number; riskBand: string }> = [];
  const errors: Array<{ error: string }> = [];

  for (const identity of identities) {
    try {
      const result = await ingestUserUpworkIdentity(userId);
      if (result) {
        ingested.push({
          passportId: result.passportId,
          handle: result.handle,
          displayName: result.displayName,
          trustScore: result.trustScore,
          riskBand: result.riskBand,
        });
      }
    } catch (err: any) {
      errors.push({ error: err.message });
      logger.error(`[UpworkAPI] Failed to ingest Upwork identity ${identity.platformHandle}: ${err.message}`);
    }
  }

  return { ingested, errors };
}

export const upworkApi = {
  getUpworkAuthUrl,
  exchangeUpworkCode,
  refreshUpworkToken,
  fetchUpworkProfile,
  searchUpworkFreelancers,
  ingestUpworkProfile,
  ingestUserUpworkIdentity,
  ingestAllUserUpworkIdentities,
};
