import axios from 'axios';
import { useAuthStore } from '../store/authStore';
// import { getToken } from 'firebase/app-check';
// import { appCheck } from '../lib/firebase';

// @ts-ignore
// Strip any trailing /api/v1 from VITE_API_URL then always re-append it.
const _rawBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://pabandi-backend-97129395003.asia-south1.run.app');
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
  /** Get public businesses for the homepage */
  getPublicBusinesses: (params?: any) => apiClient.get('/businesses', { params }),
  /** Claim an unclaimed business */
  claimBusiness: (id: string) => apiClient.post(`/businesses/${id}/claim`),
  /** Generate short booking link */
  generateBookingLink: (id: string) => apiClient.post(`/businesses/${id}/generate-link`),
  /** Get business by slug for short booking link */
  getBusinessBySlug: (slug: string) => apiClient.get(`/businesses/slug/${slug}`),
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

export const sourcingService = {
  analyzeDemand: () => apiClient.get('/sourcing/analyze'),
  confirmOrder: (orderId: string) => apiClient.post(`/sourcing/order/${orderId}/confirm`),
  getTrends: () => apiClient.get('/sourcing/trends'),
  launchTrend: (trendId: string) => apiClient.post(`/sourcing/trends/${trendId}/launch`),
  consultAdvisor: (message: string) => apiClient.post('/sourcing/consult', { message }),
};

export default apiClient;
