import axios from 'axios';
import { useAuthStore } from '../store/authStore';
// import { getToken } from 'firebase/app-check';
// import { appCheck } from '../lib/firebase';

// @ts-ignore
// Strip any trailing /api/v1 from VITE_API_URL then always re-append it.
const _rawBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://pabandi.onrender.com');
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
    code?: string;
  }) => apiClient.post('/auth/register', data),
  registerWithCode: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    code: string;
    role?: string;
  }) => apiClient.post('/auth/register', data),
  requestVerificationCode: (email: string) =>
    apiClient.post('/auth/request-code', { email }),
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
  sendVerificationCode: () => apiClient.post('/auth/verify/send-code'),
  verifyEmail: (code: string) => apiClient.post('/auth/verify/email', { code }),
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

export const agentPassportService = {
  /** Issue a scoped Agent Capability Passport for one of the user's agents. Requires auth. */
  issue: (data: { agentId: string; capabilities: string[]; ownerUserId?: string }) =>
    apiClient.post('/agent-passport/issue', data),
  /** Public verify of any passport token, optionally checking a required capability. */
  verify: (token: string, need?: string) =>
    apiClient.get('/agent-passport/verify', { params: { token, need } }),
  /** Public audit of a passport-issuance charge by idempotency key. */
  ledger: (idempotencyKey: string) =>
    apiClient.get(`/agent-passport/ledger/${idempotencyKey}`),
  /** Discovery doc (public key + capability vocabulary). */
  discover: () => apiClient.get('/agent-passport/.well-known/ptp.json'),
};

export const revenueService = {
  /** Underwrite a reputation-insurance policy for a booking (captures $PAB premium). */
  underwriteInsurance: (data: { providerId: string; customerId: string; reservationId: string; coverageAmount: number; coverageType?: string }) =>
    apiClient.post('/monetization/insurance/underwrite', data),
  /** Live tally of captured revenue (insurance premiums + platform/escrow fees). */
  captured: () => apiClient.get('/economy/revenue'),
  /** Actuarial stats for the insurance book. */
  insuranceStats: () => apiClient.get('/monetization/insurance/stats'),
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
  fileContext: (data: { contextType: string; contextId: string; againstId: string; description: string; evidenceUrls?: string[] }) =>
    apiClient.post('/disputes/context', data).then(res => res.data),
  list: (status?: string) =>
    apiClient.get(`/disputes${status ? `?status=${status}` : ''}`).then(res => res.data),
  get: (id: string) => apiClient.get(`/disputes/${id}`).then(res => res.data),
  vote: (disputeId: string, data: { voteForId: string; reason?: string }) => apiClient.post(`/disputes/${disputeId}/vote`, data).then(res => res.data),
};

export const payoutService = {
  quote: (amountUsdc: number) => apiClient.get(`/payouts/quote?amount=${amountUsdc}`).then(res => res.data),
  request: (data: { amountUsdc: number; method?: string; destinationRef?: string }) => apiClient.post('/payouts/request', data).then(res => res.data),
  history: () => apiClient.get('/payouts/history').then(res => res.data),
};

export const loanService = {
  getPower: () => apiClient.get('/loans/power').then(res => res.data),
  requestLoan: (data: { usdcAmount: number }) => apiClient.post('/loans/request', data).then(res => res.data),
  repayLoan: (loanId: string) => apiClient.post(`/loans/${loanId}/repay`).then(res => res.data),
  getReputationQuote: () => apiClient.get('/loans/reputation/quote').then(res => res.data),
  requestReputationLoan: (data: { usdcAmount: number }) => apiClient.post('/loans/reputation/request', data).then(res => res.data),
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

export const ppdService = {
  createMilestoneProject: (payload: any) => apiClient.post('/ppd/milestone-project', payload),
  releaseMilestone: (id: string, payload: any) => apiClient.post(`/ppd/milestone/${id}/release`, payload),
  underwriteBond: (payload: any) => apiClient.post('/ppd/bond', payload),
  claimBond: (id: string, payload: any) => apiClient.post(`/ppd/bond/${id}/claim`, payload),
  createCommunityPool: (payload: any) => apiClient.post('/ppd/community-pool', payload),
  routeDepositToPool: (poolId: string, payload: any) => apiClient.post(`/ppd/community-pool/${poolId}/route-deposit`, payload),
  proposeGrant: (poolId: string, payload: any) => apiClient.post(`/ppd/community-pool/${poolId}/grant`, payload),
  approveGrant: (grantId: string, payload: any) => apiClient.post(`/ppd/community-grant/${grantId}/approve`, payload),
  getCommunityDashboard: (poolId: string) => apiClient.get(`/ppd/community-pool/${poolId}/dashboard`),
  getWorkerPayouts: () => apiClient.get('/ppd/worker-payouts').then(res => res.data),
};

export const trustPassportService = {
  create: (payload: any) => apiClient.post('/trust-passport', payload),
  getPublic: (handle: string) => apiClient.get(`/trust-passport/${handle}`),
  getRequestContext: (handle: string) => apiClient.get(`/trust-passport/${handle}/request`),
  list: (params?: any) => apiClient.get('/trust-passport/directory', { params }),
};

export const treasuryService = {
  getSummary: () => apiClient.get('/treasury/summary'),
};

export const economyService = {
  getStats: () => apiClient.get('/economy/stats'),
  runDemoBooking: (body: { amountPab?: number }) => apiClient.post('/economy/demo-book', body),
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

// Refer & Earn — partner (account manager) program.
// NOTE: router is mounted at /account-manager (singular) in index.ts.
export const referralService = {
  enroll: () => apiClient.post('/account-manager/enroll'),
  validateCode: (code: string) => apiClient.get(`/account-manager/validate/${encodeURIComponent(code)}`),
  getMe: () => apiClient.get('/account-manager/me'),
  getLedger: () => apiClient.get('/account-manager/ledger'),
  getReferrals: () => apiClient.get('/account-manager/referrals'),
  getPayouts: () => apiClient.get('/account-manager/payouts'),
  requestPayout: () => apiClient.post('/account-manager/payout/request'),
};

// Marketplace partner / secured local-sale escrow (FB Marketplace, OfferUp, Craigslist, etc.)
export const marketplaceService = {
  validatePartner: (code: string) => apiClient.get(`/marketplace/validate/${encodeURIComponent(code)}`),
  openLocalSale: (payload: {
    referralCode?: string;
    listingUrl?: string;
    itemTitle?: string;
    amount: number;
    currency?: string;
    sellerEmail: string;
    buyerEmail?: string;
  }) => apiClient.post('/marketplace/escrow/local-sale', payload),
  getLocalSale: (id: string) => apiClient.get(`/marketplace/escrow/local-sale/${id}`),
  fundLocalSale: (id: string, buyerEmail: string) => apiClient.post(`/marketplace/escrow/local-sale/${id}/fund`, { buyerEmail }),
  releaseLocalSale: (id: string) => apiClient.post(`/marketplace/escrow/local-sale/${id}/release`),
  scheduleMeetup: (id: string, payload: { meetupLocation: string; meetupLat?: number; meetupLng?: number; meetupAt?: string }) => apiClient.post(`/marketplace/escrow/local-sale/${id}/meetup`, payload),
  fileDispute: (id: string, payload: { reportedByEmail: string; reason: string; type?: string; evidenceUrls?: string[] }) => apiClient.post(`/marketplace/escrow/local-sale/${id}/dispute`, payload),
  safeMeetSpots: () => apiClient.get('/marketplace/safe-meet'),
  // New unified marketplace
  listings: (params?: { type?: string; category?: string; city?: string; q?: string; page?: number; limit?: number; sort?: string }) => apiClient.get('/marketplace/listings', { params }),
  getListing: (id: string) => apiClient.get(`/marketplace/listings/${id}`),
  createListing: (payload: any) => apiClient.post('/marketplace/listings', payload),
  updateListing: (id: string, payload: any) => apiClient.patch(`/marketplace/listings/${id}`, payload),
  deleteListing: (id: string) => apiClient.delete(`/marketplace/listings/${id}`),
  bookListing: (id: string, payload: { buyerEmail: string; buyerName?: string; scheduledAt: string; notes?: string }) => apiClient.post(`/marketplace/listings/${id}/book`, payload),
  categories: () => apiClient.get('/marketplace/categories'),
};

// Escrow state machine: PENDING → FUNDED → COMPLETED | DISPUTED | CANCELLED
export const escrowService = {
  create: (payload: { itemTitle: string; amount: number; currency?: string; sellerEmail: string; buyerEmail?: string; listingUrl?: string; referralCode?: string; meetupLocation?: string; meetupLat?: number; meetupLng?: number; meetupAt?: string }) => apiClient.post('/escrow', payload),
  get: (id: string) => apiClient.get(`/escrow/${id}`),
  fund: (id: string) => apiClient.post(`/escrow/${id}/fund`),
  release: (id: string) => apiClient.post(`/escrow/${id}/release`),
  dispute: (id: string) => apiClient.post(`/escrow/${id}/dispute`),
  cancel: (id: string) => apiClient.post(`/escrow/${id}/cancel`),
  list: (email: string, status?: string) => apiClient.get('/escrow', { params: { email, status } }),
};

// Property Manager CRM + White Label (landlords, property managers).
export const propertyManagerService = {
  enroll: (payload?: { companyName?: string; phone?: string; role?: string; propertyCount?: number; propertyName?: string; address?: string; rentAmount?: number; petFee?: number; lateFee?: number; lateGraceDays?: number; utilities?: string[]; screeningEnabled?: boolean; backgroundCheckRequired?: boolean; paymentRemindersEnabled?: boolean; slug?: string; brandColor?: string; tagline?: string; businessType?: string }) => apiClient.post('/property-manager/enroll', payload || {}),
  getMe: () => apiClient.get('/property-manager/me'),
  updateProfile: (payload: any) => apiClient.patch('/property-manager/profile', payload),
  dashboard: () => apiClient.get('/property-manager/dashboard'),
  addProperty: (payload: any) => apiClient.post('/property-manager/properties', payload),
  addTenant: (payload: any) => apiClient.post('/property-manager/tenants', payload),
  screenTenant: (payload: { tenantEmail: string; tenantName?: string; source?: string; band?: string; state?: string }) => apiClient.post('/property-manager/screen', payload),
  addAppointment: (payload: { propertyId?: string; tenantEmail: string; tenantName?: string; startsAt: string; endsAt?: string; notes?: string }) => apiClient.post('/property-manager/appointments', payload),
  updateAppointment: (id: string, payload: { status?: string; notes?: string }) => apiClient.patch(`/property-manager/appointments/${id}`, payload),
  addLease: (payload: any) => apiClient.post('/property-manager/leases', payload),
  updateLease: (id: string, payload: { status?: string; notes?: string }) => apiClient.patch(`/property-manager/leases/${id}`, payload),
  addMaintenance: (payload: any) => apiClient.post('/property-manager/maintenance', payload),
  updateMaintenance: (id: string, payload: { status?: string; notes?: string }) => apiClient.patch(`/property-manager/maintenance/${id}`, payload),
  updateApplication: (id: string, payload: { status?: string; decisionNotes?: string }) => apiClient.patch(`/property-manager/applications/${id}`, payload),
  webhooks: () => apiClient.get('/property-manager/webhooks'),
  addWebhook: (payload: { url: string; events?: string[] }) => apiClient.post('/property-manager/webhooks', payload),
  deleteWebhook: (id: string) => apiClient.delete(`/property-manager/webhooks/${id}`),
  activity: () => apiClient.get('/property-manager/activity'),
  portal: (slug: string) => apiClient.get(`/property-manager/portal/${slug}`),
  // Property-specific
  units: (propertyId: string) => apiClient.get(`/property/units?propertyId=${propertyId}`),
  addUnit: (payload: any) => apiClient.post('/property/units', payload),
  rentPayments: (propertyId: string) => apiClient.get(`/property/rent-payments?propertyId=${propertyId}`),
  addRentPayment: (payload: any) => apiClient.post('/property/rent-payments', payload),
  inspections: (propertyId: string) => apiClient.get(`/property/inspections?propertyId=${propertyId}`),
  addInspection: (payload: any) => apiClient.post('/property/inspections', payload),
  financials: (propertyId: string) => apiClient.get(`/property/financials?propertyId=${propertyId}`),
  addFinancial: (payload: any) => apiClient.post('/property/financials', payload),
  financialSummary: (propertyId: string) => apiClient.get(`/property/financials/summary?propertyId=${propertyId}`),
  documents: (tenantEmail?: string) => apiClient.get(`/documents${tenantEmail ? `?tenantEmail=${tenantEmail}` : ''}`),
  uploadDocument: (payload: any) => apiClient.post('/documents', payload),
  deleteDocument: (id: string) => apiClient.delete(`/documents/${id}`),
  // AI Real Estate
  analyzeLease: (text: string) => apiClient.post('/ai/realestate/analyze-lease', { text }),
  maintenanceAdvice: (issue: string, propertyType?: string, budget?: string, urgency?: string) => apiClient.post('/ai/realestate/maintenance-advice', { issue, propertyType, budget, urgency }),
  marketInsights: (city: string, state?: string, propertyType?: string) => apiClient.post('/ai/realestate/market-insights', { city, state, propertyType }),
  generateDocument: (type: string, params: any) => apiClient.post('/ai/realestate/generate-document', { type, params }),
  propertyValuation: (payload: any) => apiClient.post('/ai/realestate/property-valuation', payload),
  aiChat: (message: string, context?: any) => apiClient.post('/ai/realestate/chat', { message, context }),
  // Booking.com hotel search
  searchHotels: (payload: any) => apiClient.post('/booking/search', payload),
  autocompleteLocation: (payload: any) => apiClient.post('/booking/autocomplete', payload),
  hotelDetails: (payload: any) => apiClient.post('/booking/details', payload),
  seedHotels: (payload: any) => apiClient.post('/booking/seed', payload),
};

// AI Real Estate Service (separate export)
export const aiRealEstateService = {
  analyzeLease: (text: string) => apiClient.post('/ai/realestate/analyze-lease', { text }),
  maintenanceAdvice: (issue: string, propertyType?: string, budget?: string, urgency?: string) => apiClient.post('/ai/realestate/maintenance-advice', { issue, propertyType, budget, urgency }),
  marketInsights: (city: string, state?: string, propertyType?: string) => apiClient.post('/ai/realestate/market-insights', { city, state, propertyType }),
  generateDocument: (type: string, params: any) => apiClient.post('/ai/realestate/generate-document', { type, params }),
  propertyValuation: (payload: any) => apiClient.post('/ai/realestate/property-valuation', payload),
  aiChat: (message: string, context?: any) => apiClient.post('/ai/realestate/chat', { message, context }),
  chat: (message: string, context?: any) => apiClient.post('/ai/realestate/chat', { message, context }),
  analyzeProperty: (payload: any) => apiClient.post('/ai/analyze-property', payload),
  analyzeInvestment: (payload: any) => apiClient.post('/ai/analyze-investment', payload),
  optimizeRent: (payload: any) => apiClient.post('/ai/optimize-rent', payload),
  matchProperties: (payload: any) => apiClient.post('/ai/match-properties', payload),
  screenTenant: (payload: any) => apiClient.post('/ai/screen-tenant', payload),
  generateListing: (payload: any) => apiClient.post('/ai/generate-listing', payload),
  maintenanceAssistant: (problem: string, propertyType?: string) => apiClient.post('/ai/maintenance', { problem, propertyType }),
};

// Tenant experience (tenant-facing endpoints).
export const tenantService = {
  portal: (slug: string) => apiClient.get(`/tenant/portal/${slug}`),
  apply: (payload: { slug: string; propertyId?: string; email: string; firstName?: string; lastName?: string; phone?: string; message?: string; desiredMoveIn?: string; monthlyIncome?: number }) => apiClient.post('/tenant/apply', payload),
  dashboard: () => apiClient.get('/tenant/dashboard'),
  applications: () => apiClient.get('/tenant/applications'),
  application: (id: string) => apiClient.get(`/tenant/applications/${id}`),
  documents: () => apiClient.get('/tenant/documents'),
  get: (id: string) => apiClient.get(`/property-manager/tenants/${id}`),
};

// Real-estate court screening (CourtListener eviction / litigation).
export const courtCheckService = {
  // On-demand screen of both parties of a reservation.
  screenBooking: (reservationId: string) =>
    apiClient.post('/realestate/screen-booking', { reservationId }),
  // Fetch persisted screening results for a reservation.
  getByReservation: (reservationId: string) =>
    apiClient.get(`/realestate/court-checks/${reservationId}`),
  // Direct name-based CourtListener search (for demo / on-demand checks).
  courtCheckByName: (name: string, state?: string, options?: {
    court?: string;
    dateFiledAfter?: string;
    dateFiledBefore?: string;
    docketNumber?: string;
    partyName?: string;
    attorneyName?: string;
  }) => apiClient.post('/realestate/court-check', { name, state, role: 'TENANT', ...options }),
  // Pakistan trust screening (BackgroundCheck-based; CourtListener is US-only).
  pakScreen: (payload: {
    businessId?: string;
    customerId?: string;
    landlordName?: string;
    tenantName?: string;
    landlordNtn?: string;
    tenantNtn?: string;
    reservationId?: string;
  }) => apiClient.post('/realestate/pak-screen', payload),
};

export const promoService = {
  stats: () => apiClient.get('/promo/stats'),
  listAmbassadors: (params?: { workType?: string; minReputation?: number; active?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.workType) q.set('workType', params.workType);
    if (params?.minReputation) q.set('minReputation', String(params.minReputation));
    if (params?.active !== undefined) q.set('active', String(params.active));
    return apiClient.get(`/promo/ambassadors?${q.toString()}`);
  },
  getAmbassador: (id: string) => apiClient.get(`/promo/ambassadors/${id}`),
  createAmbassador: (payload: any) => apiClient.post('/promo/ambassadors', payload),
  listJobs: (params?: { workType?: string; status?: string; brandId?: string }) => {
    const q = new URLSearchParams();
    if (params?.workType) q.set('workType', params.workType);
    if (params?.status) q.set('status', params.status);
    if (params?.brandId) q.set('brandId', params.brandId);
    return apiClient.get(`/promo/jobs?${q.toString()}`);
  },
  getJob: (id: string) => apiClient.get(`/promo/jobs/${id}`),
  createJob: (payload: any) => apiClient.post('/promo/jobs', payload),
  updateJobStatus: (id: string, status: string) => apiClient.patch(`/promo/jobs/${id}/status`, { status }),
  listSubmissions: (params?: { jobId?: string; ambassadorId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.jobId) q.set('jobId', params.jobId);
    if (params?.ambassadorId) q.set('ambassadorId', params.ambassadorId);
    if (params?.status) q.set('status', params.status);
    return apiClient.get(`/promo/submissions?${q.toString()}`);
  },
  createSubmission: (payload: any) => apiClient.post('/promo/submissions', payload),
  updateSubmissionStatus: (id: string, status: string, reviewNotes?: string) => apiClient.patch(`/promo/submissions/${id}/status`, { status, reviewNotes }),
  listReviews: (params?: { workType?: string; verified?: boolean; minRating?: number }) => {
    const q = new URLSearchParams();
    if (params?.workType) q.set('workType', params.workType);
    if (params?.verified !== undefined) q.set('verified', String(params.verified));
    if (params?.minRating) q.set('minRating', String(params.minRating));
    return apiClient.get(`/promo/reviews?${q.toString()}`);
  },
  createReview: (payload: any) => apiClient.post('/promo/reviews', payload),
  generateCommitment: (payload: any) => apiClient.post('/promo/zk/commitment', payload),
  verifyCommitment: (payload: any) => apiClient.post('/promo/zk/verify', payload),
  generateWorkProof: (payload: any) => apiClient.post('/promo/zk/work-proof', payload),
  // Payout & earnings
  submitWork: (payload: any) => apiClient.post('/promo/payout/submit-work', payload),
  acceptAndPay: (payload: any) => apiClient.post('/promo/payout/accept-and-pay', payload),
  submitReview: (payload: any) => apiClient.post('/promo/payout/review', payload),
  getEarnings: (ambassadorId: string) => apiClient.get(`/promo/payout/earnings/${ambassadorId}`),
  fundJob: (payload: any) => apiClient.post('/promo/payout/fund-job', payload),
};

export default apiClient;

// AI Advanced Service
export const aiAdvancedService = {
  propertyIntelligence: (payload: any) => apiClient.post('/ai/advanced/property-intelligence', payload),
  scenarioPlanner: (payload: any) => apiClient.post('/ai/advanced/scenario-planner', payload),
  portfolioAnalyzer: (payload: any) => apiClient.post('/ai/advanced/portfolio-analyzer', payload),
  tenantIntelligence: (payload: any) => apiClient.post('/ai/advanced/tenant-intelligence', payload),
  marketIntelligence: (payload: any) => apiClient.post('/ai/advanced/market-intelligence', payload),
  maintenancePredictor: (payload: any) => apiClient.post('/ai/advanced/maintenance-predictor', payload),
};
