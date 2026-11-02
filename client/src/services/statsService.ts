import { apiClient } from './api';

/**
 * Dashboard stat aggregates — the real numbers behind the dual-mode dashboards.
 *
 *   me()       → GET /users/me/stats     (Personal dashboard)
 *   business() → GET /business/stats     (Business dashboard)
 *
 * Both are expected under the response envelope { success, data } and both are
 * the polling targets of the Trust Sync loop: dashboards refetch these every
 * 30s (and immediately after release/check-in mutations) so trust movement is
 * visible without a page reload.
 */

export type ActiveEscrowItem = {
  id: string;
  reference: string;
  amountUsd: number;
  status: string;
  createdAt: string;
  businessName: string | null;
  jobStatus: string | null;
  canRelease: boolean;
};

export type MeStats = {
  activeEscrows: {
    count: number;
    totalUsd: number;
    items: ActiveEscrowItem[];
  };
  trustScore: {
    score: number | null;
    reliability: number | null;
    tier: string;
  };
  yieldEarned: number;
  yieldCurrency: string;
};

export type BusinessStats = {
  businessId: string;
  businessName: string;
  todayRevenue: number;
  todayRevenueCurrency: string;
  pendingEscrows: {
    count: number;
    totalUsd: number;
  };
  saasCredit: number;
  todayJobs: Array<{
    id: string;
    client: string;
    time: string;
    endTime: string;
    service: string;
    status: string;
  }>;
};

export const statsService = {
  me: () =>
    apiClient
      .get<{ success: boolean; data: MeStats }>('/users/me/stats')
      .then((r) => r.data.data),

  business: () =>
    apiClient
      .get<{ success: boolean; data: BusinessStats }>('/business/stats')
      .then((r) => r.data.data),

  /** VCAP release — buyer releases an escrow whose job was marked complete. */
  releaseEscrow: (escrowId: string) =>
    apiClient
      .post<{ success: boolean }>(`/solana-escrow/${escrowId}/release`, {})
      .then((r) => r.data),
};
