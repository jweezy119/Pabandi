import { businessService, reservationService, paymentService } from '../services/api';

export interface CleaningService {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface CleaningReservation {
  services?: any[];
  address?: string;
  assignedEmployeeId?: string;
  notes?: string;
}

/**
 * CleaningBusinessService
 *
 * Thin integration layer between the cleaning vertical and Pabandi core.
 * - Business + BusinessService = service catalog
 * - Reservation = job/appointment
 * - Payment = payment tracking
 * - PabandiReview = verified reviews
 * - Promoter/ReferralLedger = referral commissions
 * - InventoryProduct/InventoryVendor = supplies
 */
export class CleaningBusinessService {
  private businessId: string | null = null;

  setBusinessId(businessId: string) {
    this.businessId = businessId;
  }

  getBusinessId(): string | null {
    return this.businessId;
  }

  // ── Business ──────────────────────────────────────────────────────────
  async getMyBusiness() {
    const res = await businessService.getMyBusiness();
    return res?.data?.data?.business ?? null;
  }

  async createBusiness(data: {
    name: string;
    description?: string;
    category?: string;
    address: string;
    city?: string;
    phone?: string;
    email?: string;
    website?: string;
    timezone?: string;
    refCode?: string;
  }) {
    const res = await businessService.createBusiness({
      ...data,
      category: data.category ?? 'CLEANING',
    });
    const business = res?.data?.data;
    if (business?.id) {
      this.businessId = business.id;
    }
    return business;
  }

  // ── Services (cleaning catalog) ──────────────────────────────────────
  async getServices(businessId?: string) {
    const id = businessId || this.businessId;
    if (!id) return [];
    const res = await businessService.getServices(id);
    return res?.data?.data ?? [];
  }

  async createService(
    businessId: string,
    data: Omit<CleaningService, 'id' | 'businessId'>
  ) {
    const res = await businessService.createService(businessId, {
      ...data,
      duration: data.durationMinutes,
    });
    return res?.data?.data;
  }

  async updateService(
    businessId: string,
    serviceId: string,
    data: Partial<Omit<CleaningService, 'id' | 'businessId'>>
  ) {
    const res = await businessService.updateService(businessId, serviceId, {
      ...data,
      duration: data.durationMinutes,
    });
    return res?.data?.data;
  }

  // ── Reservations (jobs) ──────────────────────────────────────────────
  async createReservation(data: {
    customerId: string;
    reservationDate: string;
    reservationTime: string;
    numberOfGuests: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    specialRequests?: string;
    services?: Array<{ serviceId: string; priceAtBooking: number }>;
    address?: string;
    assignedEmployeeId?: string;
    notes?: string;
    totalAmount?: number;
    depositRequired?: boolean;
    depositAmount?: number;
  }) {
    const payload = {
      businessId: this.businessId,
      ...data,
      source: 'CLEANING',
    };

    const res = await reservationService.createReservation(payload);
    return res?.data?.data;
  }

  async getReservations(params?: any) {
    const res = await reservationService.getUserReservations(params);
    return res?.data?.data ?? [];
  }

  async getBusinessReservations(businessId?: string, params?: any) {
    const id = businessId || this.businessId;
    if (!id) return [];
    const res = await businessService.getBusinessReservations(id, params);
    return res?.data?.data ?? [];
  }

  async completeReservation(id: string) {
    const res = await reservationService.completeReservation(id);
    return res?.data?.data;
  }

  async cancelReservation(id: string) {
    const res = await reservationService.cancelReservation(id);
    return res?.data?.data;
  }

  async markNoShow(id: string) {
    const res = await reservationService.markNoShow(id);
    return res?.data?.data;
  }

  // ── Payments ─────────────────────────────────────────────────────────
  async createPayment(data: {
    reservationId: string;
    amount: number;
    paymentMethod: string;
    currency?: string;
  }) {
    const res = await paymentService.createPayment({
      ...data,
      currency: data.currency || 'USD',
    });
    return res?.data?.data;
  }

  async getPayment(id: string) {
    const res = await paymentService.getPayment(id);
    return res?.data?.data;
  }

  // ── Reviews ──────────────────────────────────────────────────────────
  async createReview(data: {
    businessId: string;
    reservationId: string;
    rating: number;
    text?: string;
  }) {
    const { sitaraApi } = await import('../sitara/api/sitaraApi');
    const res = await sitaraApi.createReview(data);
    return res?.data?.data;
  }

  async getBusinessReviews(businessId?: string) {
    const id = businessId || this.businessId;
    if (!id) return [];
    const res = await businessService.getBusinessReviews(id);
    return res?.data?.data ?? [];
  }

  // ── Promoter / Referrals ─────────────────────────────────────────────
  async getPromoterMe() {
    const { sitaraApi } = await import('../sitara/api/sitaraApi');
    const res = await sitaraApi.promoterMe();
    return res?.data?.data ?? null;
  }

  async getPromoterStats() {
    const { sitaraApi } = await import('../sitara/api/sitaraApi');
    const res = await sitaraApi.promoterStats();
    return res?.data?.data ?? null;
  }

  async getPromoterWallet() {
    const { sitaraApi } = await import('../sitara/api/sitaraApi');
    const res = await sitaraApi.promoterWallet();
    return res?.data?.data ?? null;
  }

  async getPromoterLeaderboard(limit = 10) {
    const { sitaraApi } = await import('../sitara/api/sitaraApi');
    const res = await sitaraApi.promoterLeaderboard(limit);
    return res?.data?.data ?? [];
  }

  async getPromoterRefLink() {
    const { sitaraApi } = await import('../sitara/api/sitaraApi');
    const res = await sitaraApi.promoterRefLink();
    return res?.data?.data ?? null;
  }

  async registerPromoter(data: { name: string; phone?: string; instagram?: string; bio?: string }) {
    const { sitaraApi } = await import('../sitara/api/sitaraApi');
    const res = await sitaraApi.promoterRegister(data);
    return res?.data?.data;
  }

  // ── Inventory (existing Pabandi inventory) ───────────────────────────
  async getInventoryProducts(venueId?: string) {
    return [];
  }

  async getInventoryVendors(venueId?: string) {
    return [];
  }

  async createInventoryProduct(data: any) {
    return null;
  }

  async updateInventoryProduct(id: string, data: any) {
    return null;
  }

  async createPurchaseOrder(data: any) {
    return null;
  }

  // ── Dashboard / Analytics ────────────────────────────────────────────
  async getBusinessAnalytics(businessId?: string) {
    const id = businessId || this.businessId;
    if (!id) return null;
    const res = await businessService.getBusinessAnalytics(id);
    return res?.data?.data ?? null;
  }

  async getBusinessCustomers(businessId?: string) {
    const id = businessId || this.businessId;
    if (!id) return [];
    const res = await businessService.getBusinessCustomers(id);
    return res?.data?.data ?? [];
  }

  async getDashboardAnalytics() {
    const { analyticsService } = await import('../services/api');
    const res = await analyticsService.getDashboardAnalytics();
    return res?.data?.data ?? null;
  }
}

export const cleaningBusinessService = new CleaningBusinessService();
