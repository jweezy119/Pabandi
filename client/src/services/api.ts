import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// @ts-ignore
// Strip any trailing /api/v1 from VITE_API_URL then always re-append it.
// This makes it safe whether the GitHub secret includes /api/v1 or not.
const _rawBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://pabandi-server-97129395003.asia-south1.run.app');
const _baseHost = _rawBase.replace(/\/api\/v\d+\/?$/, '');
const API_BASE_URL = `${_baseHost}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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
  /** Get the logged-in owner's business */
  getMyBusiness: () => apiClient.get('/businesses/me'),
  /** Get public businesses for the homepage */
  getPublicBusinesses: (params?: any) => apiClient.get('/businesses', { params }),
  /** Claim an unclaimed business */
  claimBusiness: (id: string) => apiClient.post(`/businesses/${id}/claim`),
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
};

export default apiClient;
