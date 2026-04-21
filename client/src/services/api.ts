import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// @ts-ignore
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api/v1'
  : (import.meta.env.VITE_API_URL || 'http://10.0.2.2:5000/api/v1'); // 10.0.2.2 is the special IP for Android emulator host loopback

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

export default apiClient;
