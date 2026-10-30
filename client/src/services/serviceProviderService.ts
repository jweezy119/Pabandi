import { apiClient } from './api';

export type ServiceProviderSource = 'upwork' | 'taskrabbit' | 'fiverr' | 'thumbtack' | 'manual' | 'jobber' | 'broccoli';

export type RiskBand = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ServiceProvider {
  id: string;
  handle: string;
  displayName: string;
  category: string;
  bio?: string;
  headline?: string;
  location?: string | null;
  websiteUrl?: string | null;
  avatarUrl?: string | null;
  skills: string[];
  hourlyRate: number | null;
  currency: string;
  trustScore: number;
  riskBand: RiskBand;
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
  passportId?: string;
  createdAt?: string;
  lastCheckedAt?: string | null;
}

export interface IngestProfile {
  source: ServiceProviderSource;
  sourceId: string;
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
  rating?: number;
  reviewCount?: number;
  totalEarnings?: number;
  jobsCompleted?: number;
  accountAgeDays?: number;
  isVerified?: boolean;
  accountLevel?: string;
  portfolioUrls?: string[];
}

export interface ScrapeResult {
  source: string;
  sourceId: string;
  name: string;
  handle: string;
  bio?: string;
  location?: string | null;
  websiteUrl?: string | null;
  avatarUrl?: string | null;
  hourlyRate: number | null;
  currency: string;
  skills: string[];
  category: string;
  rating: number | null;
  reviewCount: number | null;
  totalEarnings: number | null;
  jobsCompleted: number | null;
  accountAgeDays: number | null;
  isVerified: boolean;
  accountLevel: string | null;
  portfolioUrls: string[];
  rawData: Record<string, any>;
}

export interface IngestResult {
  passportId: string;
  handle: string;
  displayName: string;
  trustScore: number;
  riskBand: RiskBand;
  category: string;
  skills: string[];
  source: string;
  sourceId: string;
  attestation: any;
}

export interface BatchIngestResult {
  ingested: Array<IngestResult & { passportId: string }>;
  errors: Array<{ sourceId: string; error: string }>;
  totalIngested: number;
  totalErrors: number;
}

export interface DiscoverResult {
  providers: ServiceProvider[];
  total: number;
  hasMore: boolean;
}

export interface BookingResult {
  referenceId: string;
  escrowId: string;
  amount: number;
  currency: string;
  provider: {
    id: string;
    handle: string;
    displayName: string;
    trustScore: number;
    riskBand: RiskBand;
  };
  agentId: string;
  platformFeeRate: number;
}

export interface GigOutcomeResult {
  passportId: string;
  gigId: string;
  status: string;
}

export interface RevenueDashboard {
  summary: {
    totalRevenueUSD: number;
    escrowPlatformFeesUSD: number;
    agentMarketplaceFeesUSD: number;
    trustApiBillingUSD: number;
    totalEscrowsWithFees: number;
    totalAgentTransactions: number;
  };
  billing: any;
  recentEscrowFees: Array<{
    id: string;
    amount: number;
    platformFeeAmount: number;
    updatedAt: string;
    payerId: string;
    payeeId: string;
  }>;
  recentAgentFees: Array<{
    id: string;
    amount: number;
    platformFeeUsd: number;
    createdAt: string;
    fromAgentId: string;
    toAgentId: string;
  }>;
  generatedAt: string;
}

export interface SocialIngestResult {
  ingested: Array<{
    source: string;
    sourceId: string;
    passportId: string;
    handle: string;
    displayName: string;
    trustScore: number;
    riskBand: string;
  }>;
  total: number;
}

export const serviceProviderService = {
  /** Ingest a single external provider profile */
  ingest: (profile: IngestProfile) =>
    apiClient.post<{ success: true; data: IngestResult; message: string }>('/service-providers/ingest', profile),

  /** Batch ingest multiple providers */
  ingestBatch: (profiles: IngestProfile[]) =>
    apiClient.post<{ success: true; data: BatchIngestResult; message: string }>('/service-providers/ingest/batch', {
      profiles,
    }),

  /** Discover providers for AI agent booking */
  discover: (params?: {
    minTrustScore?: number;
    category?: string;
    skills?: string[];
    limit?: number;
    offset?: number;
  }) =>
    apiClient.get<{ success: true; data: DiscoverResult }>('/service-providers/discover', { params }),

  /** Get a single provider's public profile */
  getProvider: (passportId: string) =>
    apiClient.get<{ success: true; data: ServiceProvider }>(`/service-providers/${passportId}`),

  /** Book a service provider via escrow */
  book: (data: {
    passportId: string;
    amount: number;
    description?: string;
    scheduledDate?: string;
    skills?: string[];
  }) => apiClient.post<{ success: true; data: BookingResult }>('/service-providers/book', data),

  /** Record gig outcome for BestFitEngine tracking */
  recordGigOutcome: (data: {
    passportId: string;
    gigId: string;
    status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    clientRating?: number;
    leadTimeHours?: number;
  }) => apiClient.post<{ success: true; data: GigOutcomeResult }>('/service-providers/gig-outcome', data),

  /** Scrape a single marketplace profile URL */
  scrape: (url: string) =>
    apiClient.post<{ success: true; data: ScrapeResult }>('/service-providers/scrape', { url }),

  /** Scrape multiple URLs and ingest them all */
  scrapeAndIngest: (urls: string[]) =>
    apiClient.post<{ success: true; data: BatchIngestResult; message: string }>('/service-providers/scrape/ingest', {
      urls,
    }),

  /** Get Upwork OAuth authorization URL */
  getUpworkAuthUrl: (state?: string) =>
    apiClient.get<{ success: true; data: { authUrl: string; state: string } }>('/service-providers/upwork/auth', {
      params: { state },
    }),

  /** Ingest user's Upwork social identity */
  ingestUpwork: () =>
    apiClient.post<{ success: true; data: IngestResult; message: string }>('/service-providers/upwork/ingest'),

  /** Ingest all social identities */
  ingestSocial: () =>
    apiClient.post<{ success: true; data: SocialIngestResult; message: string }>('/service-providers/social/ingest'),

  /** Consolidated revenue dashboard (admin only) */
  revenueDashboard: () =>
    apiClient.get<{ success: true; data: RevenueDashboard }>('/billing/revenue-dashboard'),
};
