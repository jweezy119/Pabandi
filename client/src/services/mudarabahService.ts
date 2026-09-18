import apiClient from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';
export type PoolStatus = 'OPEN' | 'ACTIVE' | 'FULLY_SUBSCRIBED' | 'CLOSED' | 'DRAFT';
export type DistributionFreq = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
export type ProfitCalcMethod = 'REVENUE_SHARE' | 'PROFIT_SHARE' | 'FIXED_RETURN';

export interface MudarabahPool {
  id: string;
  title: string;
  description: string;
  businessId: string;
  businessName?: string;
  category: string;
  profitShareRatio: string; // e.g. "70/30"
  targetAmount: number;
  currentAmount: number;
  minInvestment: number;
  maxInvestment: number | null;
  expectedApy: number;
  revenueSource: string;
  useOfFunds: string;
  businessPlanUrl: string | null;
  profitCalcMethod: ProfitCalcMethod;
  marginPercent: number;
  reserveRatio: number;
  allowEarlyWithdraw: boolean;
  earlyWithdrawPenalty: number;
  riskBand: RiskBand;
  riskDisclosure: string;
  legalDisclaimer: string;
  shariaCompliant: boolean;
  accreditedOnly: boolean;
  lockupPeriodDays: number;
  distributionFreq: DistributionFreq;
  autoDistribute: boolean;
  distributionDay: number;
  minDistribution: number;
  status: PoolStatus;
  featured: boolean;
  investorCount: number;
  ownerId?: string;
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
  category?: string;
  useOfFunds?: string;
  businessPlanUrl?: string;
  profitCalcMethod?: ProfitCalcMethod;
  marginPercent?: number;
  reserveRatio?: number;
  allowEarlyWithdraw?: boolean;
  earlyWithdrawPenalty?: number;
  riskBand?: RiskBand;
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
  pool?: MudarabahPool;
  investorId: string;
  amount: number;
  totalProfitReceived: number;
  status: string;
  lastDistributionAt?: string;
  createdAt: string;
}

export interface InvestmentSummary {
  totalInvested: number;
  totalProfitReceived: number;
  activePositions: number;
}

export interface MyInvestmentsResponse {
  investments: Investment[];
  summary: InvestmentSummary;
}

export interface Distribution {
  id: string;
  poolId: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  totalProfit: number;
  investorShare: number;
  pabandiShare: number;
  perUnitProfit?: number;
  status: string;
  distributedAt?: string;
  createdAt: string;
}

export interface TransparencyReport {
  poolId: string;
  title: string;
  business: { name: string; category: string };
  revenueSource: string;
  useOfFunds: string;
  riskBand: RiskBand;
  profitShareRatio: string;
  profitCalcMethod: string;
  marginPercent: number;
  reserveRatio: number;
  allowEarlyWithdraw: boolean;
  earlyWithdrawPenalty: number;
  lockupPeriodDays: number;
  investorPercentage: string;
  pabandiPercentage: string;
  targetAmount: number;
  currentAmount: number;
  expectedApy: number;
  distributionFreq: DistributionFreq;
  autoDistribute: boolean;
  distributionDay: number;
  minDistribution: number;
  shariaCompliant: boolean;
  accreditedOnly: boolean;
  investorCount: number;
  totalRevenueAllTime: number;
  totalProfitDistributed: number;
  distributionHistory: Distribution[];
  shariaCompliance: {
    noRiba: boolean;
    noGharar: boolean;
    profitSharing: string;
    model: string;
    transparency: string;
  };
}

export interface PoolInvestment {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  totalProfitReceived: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const mudarabahService = {
  // Public endpoints
  listPools: (params?: { status?: PoolStatus; riskBand?: RiskBand; featured?: boolean; page?: number; limit?: number }) =>
    apiClient.get('/mudarabah/pools', { params }),

  getPool: (id: string) => apiClient.get(`/mudarabah/pools/${id}`),

  getFeaturedPools: () => apiClient.get('/mudarabah/pools/featured'),

  getPoolTransparency: (id: string) => apiClient.get(`/mudarabah/pools/${id}/transparency`),

  getPoolInvestments: (id: string) => apiClient.get(`/mudarabah/pools/${id}/investments`),

  getPoolDistributionsPublic: (id: string) => apiClient.get(`/mudarabah/pools/${id}/distributions/public`),

  // Authenticated: Investments
  myInvestments: () => apiClient.get('/mudarabah/investments/me'),

  myPools: () => apiClient.get('/mudarabah/pools/me'),

  // Authenticated: Pool management (business owner)
  createPool: (data: CreatePoolData) => apiClient.post('/mudarabah/pools', data),

  updatePool: (id: string, data: UpdatePoolData) => apiClient.patch(`/mudarabah/pools/${id}`, data),

  closePool: (id: string) => apiClient.post(`/mudarabah/pools/${id}/close`),

  // Authenticated: Invest / Withdraw
  invest: (poolId: string, amount: number) =>
    apiClient.post(`/mudarabah/pools/${poolId}/invest`, { amount }),

  withdraw: (poolId: string) =>
    apiClient.post(`/mudarabah/pools/${poolId}/withdraw`),

  // Authenticated: Profit distribution (business owner)
  distributeProfits: (
    poolId: string,
    data: { totalRevenue: number; periodStart: string; periodEnd: string }
  ) => apiClient.post(`/mudarabah/pools/${poolId}/distribute`, data),

  getDistributions: (poolId: string) =>
    apiClient.get(`/mudarabah/pools/${poolId}/distributions`),

  // Validation
  validatePool: (data: Partial<CreatePoolData>) => apiClient.post('/mudarabah/pools/validate', data),

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
