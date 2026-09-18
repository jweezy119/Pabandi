import apiClient from './api';

export interface AdminSetupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  isEmailVerified?: boolean;
  createdAt: string;
  _count?: { reservations: number };
  business?: { id: string; name: string; isVerified: boolean };
}

export interface AdminBusiness {
  id: string;
  name: string;
  category?: string;
  description?: string;
  isVerified: boolean;
  status?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  owner?: { firstName: string; lastName: string; email: string };
  _count?: { reservations: number };
}

export interface AdminReservation {
  id: string;
  status: string;
  date?: string;
  createdAt: string;
  business?: { name: string; category?: string };
  customer?: { firstName: string; lastName: string; email: string };
}

export interface AdminProperty {
  id: string;
  name: string;
  address?: string;
  status?: string;
  manager?: { firstName: string; lastName: string; email: string };
  _count?: { tenants: number };
}

export interface AdminTenant {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  riskBand?: string;
  status?: string;
  property?: { name: string };
}

export interface AdminLease {
  id: string;
  status?: string;
  rentAmount?: number;
  startDate?: string;
  endDate?: string;
  tenant?: { firstName: string; lastName: string; email: string };
  property?: { name: string };
}

export interface AdminStats {
  funnel: {
    signedUp: number;
    madeReservation: number;
    completedBooking: number;
  };
  totals: {
    users: number;
    businesses: number;
    reservations: number;
  };
}

export const adminService = {
  setup: (data: AdminSetupData) =>
    apiClient.post('/admin/setup', data),

  stats: () =>
    apiClient.get('/admin/stats'),

  listUsers: (params?: { role?: string; page?: number; limit?: number }) =>
    apiClient.get('/admin/users', { params }),

  getUser: (id: string) =>
    apiClient.get(`/admin/users/${id}`),

  updateUserRole: (id: string, role: string) =>
    apiClient.patch(`/admin/users/${id}/role`, { role }),

  deleteUser: (id: string) =>
    apiClient.delete(`/admin/users/${id}`),

  listBusinesses: (params?: { verified?: boolean }) =>
    apiClient.get('/admin/businesses', { params }),

  verifyBusiness: (id: string) =>
    apiClient.patch(`/admin/businesses/${id}/verify`),

  updateBusiness: (id: string, data: Partial<AdminBusiness>) =>
    apiClient.patch(`/admin/businesses/${id}`, data),

  deleteBusiness: (id: string) =>
    apiClient.delete(`/admin/businesses/${id}`),

  listReservations: (params?: { status?: string }) =>
    apiClient.get('/admin/reservations', { params }),

  listProperties: () =>
    apiClient.get('/admin/properties'),

  listTenants: () =>
    apiClient.get('/admin/tenants'),

  listLeases: () =>
    apiClient.get('/admin/leases'),
};
