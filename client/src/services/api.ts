import axios from 'axios';
import { useAuthStore } from '../store/authStore';
// import { getToken } from 'firebase/app-check';
// import { appCheck } from '../lib/firebase';

// @ts-ignore
// Strip any trailing /api/v1 from VITE_API_URL then always re-append it.
const _rawBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://pabandi-server-zhopggtwla-uc.a.run.app');
const _baseHost = _rawBase.replace(/\/api\/v\d+\/?$/, '');
export const API_HOST = _baseHost;
const API_BASE_URL = `${_baseHost}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and App Check token
apiClient.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Try-catch block for App Check is disabled to prevent hangs on the live site/localhost
  /*
  try {
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (!isLocalhost) {
      const appCheckTokenResponse = await getToken(appCheck, false);
      if (appCheckTokenResponse.token) {
        config.headers['X-Firebase-AppCheck'] = appCheckTokenResponse.token;
      }
    }
  } catch (error) {
    console.error('Failed to get App Check token', error);
  }
  */

  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Do not auto-logout on 401 to avoid redirect loops; let pages handle it
    return Promise.reject(error);
  }
);

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => apiClient.post('/auth/register', data),
  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),
  updateProfile: (data: { firstName: string; lastName: string }) =>
    apiClient.put('/auth/profile', data),
  requestProfileChange: (data: { firstName?: string; lastName?: string; profilePictureUrl?: string }) =>
    apiClient.post('/auth/request-change', data),
  getProfileChangeStatus: () =>
    apiClient.get('/auth/change-status'),
  updatePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put('/auth/update-password', data),
  getWalletNonce: (walletAddress: string) =>
    apiClient.post('/auth/wallet/nonce', { walletAddress }),
  verifyWalletLogin: (data: { walletAddress: string; signature: string }) =>
    apiClient.post('/auth/wallet/verify', data),
};

export const businessService = {
  getBusiness: (id: string) => apiClient.get(`/businesses/${id}`),
  createBusiness: (data: any) => apiClient.post('/businesses', data),
  updateBusiness: (id: string, data: any) =>
    apiClient.put(`/businesses/${id}`, data),
  getBusinessReservations: (id: string, params?: any) =>
    apiClient.get(`/businesses/${id}/reservations`, { params }),
  getBusinessAnalytics: (id: string, params?: any) =>
    apiClient.get(`/businesses/${id}/analytics`, { params }),
  getBusinessReviews: (id: string) => apiClient.get(`/businesses/${id}/reviews`),
  /** Get all distinct patrons who have booked at this business */
  getBusinessCustomers: (id: string) => apiClient.get(`/businesses/${id}/customers`),
  /** Get the logged-in owner's business */
  getMyBusiness: () => apiClient.get('/businesses/me'),
  /** Public businesses for the homepage */
  getPublicBusinesses: (params?: any) => apiClient.get('/businesses', { params }),
  /** Claim an unclaimed business */
  claimBusiness: (id: string) => apiClient.post(`/businesses/${id}/claim`),
  /** Generate short booking link */
  generateBookingLink: (id: string) => apiClient.post(`/businesses/${id}/generate-link`),
  /** Get business by slug for short booking link */
  getBusinessBySlug: (slug: string) => apiClient.get(`/businesses/slug/${slug}`),
  /** Services Management */
  getServices: (id: string) => apiClient.get(`/businesses/${id}/services`),
  createService: (id: string, data: any) => apiClient.post(`/businesses/${id}/services`, data),
  updateService: (id: string, serviceId: string, data: any) => apiClient.put(`/businesses/${id}/services/${serviceId}`, data),
  deleteService: (id: string, serviceId: string) => apiClient.delete(`/businesses/${id}/services/${serviceId}`),

  connectChannex: (businessId: string) =>
    apiClient.post(`/businesses/${businessId}/channex-connect`),
  getRaastPayoutStatus: (businessId: string, payoutReference: string) =>
    apiClient.get(`/businesses/${businessId}/payouts/raast`, { params: { payoutReference } }),
};

export const reservationService = {
  createReservation: (data: any) =>
    apiClient.post('/reservations', data),
  getReservation: (id: string) => apiClient.get(`/reservations/${id}`),
  updateReservation: (id: string, data: any) =>
    apiClient.put(`/reservations/${id}`, data),
  cancelReservation: (id: string) =>
    apiClient.post(`/reservations/${id}/cancel`),
  getUserReservations: (params?: any) =>
    apiClient.get('/reservations/user', { params }),
  completeReservation: (id: string) =>
    apiClient.patch(`/reservations/${id}/complete`),
  markNoShow: (id: string) =>
    apiClient.patch(`/reservations/${id}/noshow`),
};

export const paymentService = {
  createPayment: (data: any) => apiClient.post('/payments', data),
  getPayment: (id: string) => apiClient.get(`/payments/${id}`),
  createSubscriptionCheckout: (data: { planId?: string; amount: number; planName?: string }) => apiClient.post('/payments/subscription-checkout', data),
};

export const analyticsService = {
  /** Fetches the full AI-powered dashboard analytics for the logged-in business owner */
  getDashboardAnalytics: () => apiClient.get('/analytics'),
  /** Fetches extended time-series, deposit, and customer analytics for the dedicated analytics page */
  getDetailedAnalytics: () => apiClient.get('/analytics/detailed'),
};

export const cryptoService = {
  getRewardRules: () => apiClient.get('/crypto/reward-rules'),
  getWallet: () => apiClient.get('/crypto/wallet'),
  getBusinessRewards: () => apiClient.get('/crypto/rewards/business'),
  connectSolana: (address: string) =>
    apiClient.put('/crypto/wallet/solana', { address }),
  requestSolanaTransfer: (amount?: number) =>
    apiClient.post('/crypto/wallet/solana/transfer', { amount }),
  /** Get deployed contract addresses (public) */
  getContractAddresses: () => apiClient.get('/crypto/contracts'),
  /** Mint soulbound NFT badge for the user's connected wallet */
  mintBadge: () => apiClient.post('/crypto/mint-badge'),
};

export const socialService = {
  getIdentities: () => apiClient.get('/social/identities'),
  /** Get the full computed badge with social boost applied */
  getMyBadge: () => apiClient.get('/social/my-badge'),
  connect: (platform: string, platformHandle?: string) => apiClient.post(`/social/connect/${platform}`, { platformHandle }),
  disconnect: (platform: string) => apiClient.delete(`/social/disconnect/${platform}`),
  connectMeta: () => apiClient.post('/social/connect/META'),
  disconnectMeta: () => apiClient.delete('/social/disconnect/META'),
};

export const walletService = {
  getBalances: () => apiClient.get('/wallet/balances'),
};

export const reliabilityService = {
  getGuidelines: () => apiClient.get('/reliability/guidelines'),
  getHistory: () => apiClient.get('/reliability/history'),
};

export const stakingService = {
  stake: (data: { reservationId: string; amount: number }) => apiClient.post('/staking/stake', data),
  slash: (data: { reservationId: string }) => apiClient.post('/staking/slash', data),
  // Yield Staking Pool
  getPoolStatus: () => apiClient.get('/staking/pool/status'),
  stakeYield: (amount: number) => apiClient.post('/staking/pool/stake', { amount }),
  unstakeYield: (positionId: string) => apiClient.post('/staking/pool/unstake', { positionId }),
};

// $PAB Token Staking for Trust Multipliers
export const tokenStakingService = {
  stake: (data: { amount: number; txHash?: string }) => apiClient.post('/token-staking/stake', data).then(res => res.data),
  unstake: (positionId: string) => apiClient.post('/token-staking/unstake', { positionId }).then(res => res.data),
  getPositions: () => apiClient.get('/token-staking/positions').then(res => res.data),
  getMultiplier: (userId: string) => apiClient.get(`/token-staking/multiplier/${userId}`).then(res => res.data),
  getDepositMultiplier: (userId: string, baseDeposit: number) =>
    apiClient.get(`/token-staking/deposit-multiplier/${userId}?baseDeposit=${baseDeposit}`).then(res => res.data),
};

export const disputeService = {
  fileDispute: (data: { reservationId: string; againstId: string; reason: string; stakedAmount: number; evidenceUrls?: string[] }) => apiClient.post('/disputes', data).then(res => res.data),
  vote: (disputeId: string, data: { voteForId: string; reason?: string }) => apiClient.post(`/disputes/${disputeId}/vote`, data).then(res => res.data),
};

export const loanService = {
  getPower: () => apiClient.get('/loans/power').then(res => res.data),
  requestLoan: (data: { usdcAmount: number }) => apiClient.post('/loans/request', data).then(res => res.data),
  repayLoan: (loanId: string) => apiClient.post(`/loans/${loanId}/repay`).then(res => res.data),
};

export const sourcingService = {
  analyzeDemand: () => apiClient.get('/sourcing/analyze'),
  confirmOrder: (orderId: string) => apiClient.post(`/sourcing/order/${orderId}/confirm`),
  getTrends: () => apiClient.get('/sourcing/trends'),
  launchTrend: (trendId: string) => apiClient.post(`/sourcing/trends/${trendId}/launch`),
  consultAdvisor: (message: string) => apiClient.post('/sourcing/consult', { message }),
};

export const userService = {
  searchUsers: (params?: any) => apiClient.get('/users/search', { params }),
  getPublicProfile: (id: string) => apiClient.get(`/users/${id}/public`),
};

export const passportService = {
  getPublicSummary: (sellerId: string) =>
    apiClient.get(`/passport/public/${encodeURIComponent(sellerId)}`),
  getPublicReviews: (sellerId: string) =>
    apiClient.get(`/passport/public/${encodeURIComponent(sellerId)}/reviews`),
  getMyPassport: () => apiClient.get('/passport/me'),
  getVCs: () => apiClient.get('/passport/vc').then(res => res.data),
  createPresentation: (vcId: string, disclosedFields: string[]) =>
    apiClient.post('/passport/vc/presentation', { vcId, disclosedFields }).then(res => res.data),
  verifyCredential: (jwtProof: string) =>
    apiClient.post('/passport/vc/verify', { jwtProof }).then(res => res.data),
  computeScore: (userId: string, category: string = 'general') =>
    apiClient.post('/passport/score', { userId, category }),
  vouchForUser: (sourceUserId: string, targetUserId: string) =>
    apiClient.post('/passport/vouch', { sourceUserId, targetUserId }),
  recordWhatsAppChannelSignal: (data: unknown) =>
    apiClient.post('/passport/signal/whatsapp-channel', data),
  recordSocialGraphSignal: (data: unknown) =>
    apiClient.post('/passport/signal/social-graph', data),
  recordWeb3Stake: ({ userId, stakeAmount }: { userId: string; stakeAmount: number }) =>
    apiClient.post('/passport/web3/stake', { userId, stakeAmount }),
  exportPassport: () => apiClient.get('/passport/export'),
  dynamicEscrow: (data: { userId: string; category: string; transactionValue: number; currency?: string }) => apiClient.post('/passport/dynamic-escrow', data),
};

export const popService = {
  recordIntent: (data: { userId: string; reservationId: string; businessId?: string; meta?: Record<string, any> }) =>
    apiClient.post('/pop/intent', data),
  recordArrived: (data: { userId: string; reservationId: string; businessId?: string }) =>
    apiClient.post('/pop/arrived', data),
  getReservation: (reservationId: string) =>
    apiClient.get(`/pop/reservation/${encodeURIComponent(reservationId)}`),
};

export const textSearchService = {
  getSuggestions: (query: string) =>
    apiClient.get(`/text-search/suggestions`, { params: { q: query } }),
  getCategories: (query: string) =>
    apiClient.get(`/text-search/categories`, { params: { q: query } }),
};

export const tapService = {
  createIntent: (data: { sellerId: string; amount: number; currency?: string; memo?: string; reference?: string }) =>
    apiClient.post('/tap/intents', data),
  verifyPayment: (data: { signature: string; sellerId: string; expectedAmount: number; mint?: string }) =>
    apiClient.post('/tap/verify', data),
  getMerchant: (sellerId: string) =>
    apiClient.get(`/tap/merchant/${encodeURIComponent(sellerId)}`),
};

export const liveSellerService = {
  list: () => apiClient.get('/integrations/livesell'),
  connect: (platform: string) => apiClient.get(`/integrations/livesell/connect/${platform}`),
  disconnect: (platform: string) => apiClient.delete(`/integrations/livesell/${platform}`),
  getShowState: (platform: string) => apiClient.get(`/integrations/livesell/${platform}/state`),
  patchShowState: (platform: string, data: any) => apiClient.patch(`/integrations/livesell/${platform}/state`, data),
  addOrder: (platform: string, order: any) => apiClient.post(`/integrations/livesell/${platform}/orders`, order),
  getShowCatalog: (platform: string) => apiClient.get(`/integrations/livesell/${platform}/catalog`),
  getSchedule: (platform: string) => apiClient.get(`/integrations/livesell/${platform}/schedule`),
  setSchedule: (platform: string, schedule: any[]) => apiClient.post(`/integrations/livesell/${platform}/schedule`, { schedule }),
};

export const hospitalityService = {
  /** Connect a property's PMS to Pabandi escrow */
  connectProperty: (data: {
    provider: string;
    pmsPropertyId: string;
    apiKey: string;
    propertyName: string;
    propertyType: string;
    country?: string;
  }) => apiClient.post('/hospitality/connect', data),
  /** List all connected properties for the current business */
  getProperties: () => apiClient.get('/hospitality/properties'),
  /** Get a single connected property */
  getProperty: (id: string) => apiClient.get(`/hospitality/property/${id}`),
  /** Verify a connected property's health/connection status */
  getHealth: () => apiClient.get('/hospitality/health'),
  /** Get availability for a business on a date */
  getAvailability: (businessId: string, date: string, guests?: number) => apiClient.get(`/hospitality/property/${encodeURIComponent(businessId)}/availability`, { params: { date, guests } }),
  /** Create receptionist checkout session from chat */
  createReceptionistCheckout: (data: { businessId: string; customerPhone: string; summary?: string }) => apiClient.post('/hospitality/receptionist/checkout', data),
  /** Receptionist analytics for a business */
  receptionistAnalytics: (businessId: string) => apiClient.get(`/hospitality/receptionist/analytics/${encodeURIComponent(businessId)}`),
};

export const adminService = {
  getProfileRequests: () => apiClient.get('/admin/profile-requests'),
  approveProfileRequest: (id: string) => apiClient.put(`/admin/profile-requests/${id}/approve`),
  rejectProfileRequest: (id: string) => apiClient.put(`/admin/profile-requests/${id}/reject`),
};
export const partnerService = {
  getDashboard: () => apiClient.get('/partners/dashboard'),
  createInvite: (data: { code?: string; note?: string }) => apiClient.post('/partners/invite/create', data),
};

export const openwaService = {
  getStatus: () => apiClient.get('/openwa/status'),
};

export const linkedinSeedService = {
  seedProfiles: () => apiClient.post('/linkedin/seed'),
  seedWithWallets: () => apiClient.post('/linkedin/seed/with-wallets'),
  getStats: () => apiClient.get('/linkedin/seed/stats'),
  simulateEconomy: () => apiClient.post('/linkedin/seed/simulate-economy'),
  getBadge: (linkedinId: string) => apiClient.get(`/linkedin/seed/badge/${encodeURIComponent(linkedinId)}`),
  getAgentLoopStatus: () => apiClient.get('/linkedin/seed/agent-loop/status'),
};

export const backgroundCheckService = {
  create: (payload: any) => apiClient.post('/background-check', payload),
  preBooking: (payload: any) => apiClient.post('/background-check/pre-booking', payload),
  get: (id: string) => apiClient.get(`/background-check/${id}`),
  list: (params?: any) => apiClient.get('/background-check', { params }),
  batch: (requests: any[]) => apiClient.post('/background-check/batch', { requests }),
  recheckDue: () => apiClient.post('/background-check/recheck-due'),
};

export const treasuryService = {
  getSummary: () => apiClient.get('/treasury/summary'),
};

export const accountManagerService = {
  getSummary: () => apiClient.get('/account-manager/summary'),
  getReferrals: () => apiClient.get('/account-manager/referrals'),
  getLedger: () => apiClient.get('/account-manager/ledger'),
  generateCode: () => apiClient.post('/account-manager/generate-code'),
};

export const offrampLpService = {
  getIntents: (lpWallet: string, apiKey: string) => 
    apiClient.get('/offramp/lp/intents', { 
      params: { wallet: lpWallet },
      headers: { 'x-api-key': apiKey } 
    }),
  submitProof: (intentId: string, lpWallet: string, imageBase64: string, apiKey: string) => 
    apiClient.post('/offramp/lp/submit-proof', { intentId, lpWallet, imageBase64 }, {
      headers: { 'x-api-key': apiKey }
    }),
  createStreamUrl: (lpWallet: string, apiKey: string) => `${API_HOST}/api/v1/offramp/lp/stream?wallet=${lpWallet}&apiKey=${apiKey}`
};

export default apiClient;
