import apiClient from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';
export type PoolStatus = 'ACTIVE' | 'CLOSED' | 'DRAFT';
export type DistributionFreq = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export interface MudarabahPool {
  id: string;
  title: string;
  description: string;
  businessName?: string;
  profitShareRatio: string; // e.g. "70/30"
  targetAmount: number;
  currentAmount: number;
  minInvestment: number;
  maxInvestment: number;
  expectedApy: number;
  revenueSource: string;
  riskBand: RiskBand;
  distributionFreq: DistributionFreq;
  status: PoolStatus;
  investorCount: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePoolData {
  title: string;
  description: string;
  profitShareRatio: string;
  targetAmount: number;
  minInvestment: number;
  maxInvestment?: number;
  expectedApy: number;
  revenueSource: string;
  riskBand?: RiskBand;
  distributionFreq?: DistributionFreq;
  category?: string;
  useOfFunds?: string;
  businessPlanUrl?: string;
  profitCalcMethod?: string;
  marginPercent?: number;
  reserveRatio?: number;
  allowEarlyWithdraw?: boolean;
  earlyWithdrawPenalty?: number;
  riskDisclosure?: string;
  legalDisclaimer?: string;
  shariaCompliant?: boolean;
  accreditedOnly?: boolean;
  lockupPeriodDays?: number;
  autoDistribute?: boolean;
  distributionDay?: number;
  minDistribution?: number;
}

export interface UpdatePoolData extends Partial<CreatePoolData> {
  status?: PoolStatus;
}

export interface Investment {
  id: string;
  poolId: string;
  pool: MudarabahPool;
  amount: number;
  profitReceived: number;
  status: string;
  createdAt: string;
}

export interface Distribution {
  id: string;
  poolId: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  profitAmount: number;
  investorShare: number;
  pabandiShare: number;
  createdAt: string;
}

export interface TransparencyReport {
  poolId: string;
  poolTitle: string;
  revenueSource: string;
  profitFormula: string;
  distributions: Distribution[];
  totalInvestors: number;
  totalDistributed: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const mudarabahService = {
  listPools: (params?: { status?: PoolStatus; riskBand?: RiskBand; page?: number; limit?: number }) =>
    apiClient.get('/mudarabah/pools', { params }),

  getPool: (id: string) => apiClient.get(`/mudarabah/pools/${id}`),

  createPool: (data: CreatePoolData) => apiClient.post('/mudarabah/pools', data),

  updatePool: (id: string, data: UpdatePoolData) => apiClient.put(`/mudarabah/pools/${id}`, data),

  closePool: (id: string) => apiClient.post(`/mudarabah/pools/${id}/close`),

  invest: (poolId: string, amount: number) =>
    apiClient.post(`/mudarabah/pools/${poolId}/invest`, { amount }),

  withdraw: (poolId: string) =>
    apiClient.post(`/mudarabah/pools/${poolId}/withdraw`),

  myInvestments: () => apiClient.get('/mudarabah/investments/me'),

  myPools: () => apiClient.get('/mudarabah/pools/me'),

  distributeProfits: (
    poolId: string,
    data: { totalRevenue: number; periodStart: string; periodEnd: string }
  ) => apiClient.post(`/mudarabah/pools/${poolId}/distribute`, data),

  getDistributions: (poolId: string) =>
    apiClient.get(`/mudarabah/pools/${poolId}/distributions`),

  getTransparency: (poolId: string) =>
    apiClient.get(`/mudarabah/pools/${poolId}/transparency`),

  // ── Matching Engine ──────────────────────────────────────────────────────
  getRecommendations: (params?: { limit?: number }) =>
    apiClient.get('/mudarabah-matcher/recommendations', { params }),
  getRecommendedInvestors: (poolId: string, params?: { limit?: number }) =>
    apiClient.get(`/mudarabah-matcher/investors/${poolId}`, { params }),
  getInvestorProfile: () => apiClient.get('/mudarabah-matcher/profile'),
  upsertInvestorProfile: (data: any) => apiClient.post('/mudarabah-matcher/profile', data),
  getMatchInsights: () => apiClient.get('/mudarabah-matcher/insights'),
  recordMatchFeedback: (data: { poolId: string; action: 'viewed' | 'saved' | 'invested' }) =>
    apiClient.post('/mudarabah-matcher/feedback', data),
  getMatchStats: () => apiClient.get('/mudarabah-matcher/stats'),
};

export default mudarabahService;
