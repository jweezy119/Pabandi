// Sitara OS — API client
// Thin typed wrapper over the main app's authenticated apiClient.
// All auth (JWT from useAuthStore) is handled by the shared interceptor,
// so Sitara pages get real backend data with zero auth plumbing.
import apiClient, {
  reservationService,
  businessService,
} from '../../services/api';

// Unwrap the standard { success, data } envelope (fall back to raw data).
async function unwrap<T>(p: Promise<any>): Promise<T> {
  const res = await p;
  return (res?.data?.data ?? res?.data) as T;
}

export interface StarPowerProfile {
  totalPoints: number;
  tier: string;
  tierName: string;
  tierNameUrdu: string;
  tierColor: string;
  reviews: any[];
  upvotesReceived: number;
  starCard: {
    totalPoints: number;
    currentTier: string;
    tierName: string;
    verifiedCheckIns: number;
    upvotesReceived: number;
    reliabilityScore: number;
  };
}

export interface StarPromoItem {
  id: string;
  title: string;
  description: string;
  value: number;
  promoType: string;
  code: string;
  expiresAt: string;
  targetTier: string | null;
  alreadyRedeemed?: boolean;
  business?: { name: string; logoUrl?: string };
}

export const sitaraApi = {
  // ── Star Power + reviews ──────────────────────────────────────────
  getStarPower: (userId: string) =>
    unwrap<StarPowerProfile>(apiClient.get(`/reviews/star-power/${userId}`)),

  createReview: (data: { businessId: string; reservationId: string; rating: number; text?: string }) =>
    unwrap<any>(apiClient.post('/reviews', data)),

  upvoteReview: (reviewId: string) =>
    unwrap<any>(apiClient.post(`/reviews/${reviewId}/upvote`)),

  getBusinessLeaderboard: (businessId: string, tier?: string) =>
    unwrap<any[]>(
      apiClient.get(`/reviews/star-power/business/${businessId}`, { params: tier ? { tier } : {} })
    ),

  // ── Promos (consumer + operator) ──────────────────────────────────
  getMyPromos: () => unwrap<StarPromoItem[]>(apiClient.get('/sitara/my-promos')),

  redeemPromo: (code: string) => unwrap<any>(apiClient.post(`/sitara/redeem/${code}`)),

  /** POS seam: operator marks a customer redemption as consumed at the venue. */
  markRedemptionUsed: (redemptionId: string) =>
    unwrap<any>(apiClient.post(`/sitara/redemptions/${redemptionId}/use`)),

  // ── Discovery + booking loop ────────────────────────────────────
  /** Public businesses for discovery (falls back to mock data on failure). */
  publicBusinesses: (params?: any) =>
    unwrap<any[]>(businessService.getPublicBusinesses(params)),

  /**
   * Real geo-discovery via Foursquare/Yelp/OSM.
   * Frugal: aggressive caching, slim payloads, free-tier-friendly limits.
   * Returns real venues ready to be booked.
   */
  discover: (params: {
    lat: number;
    lng: number;
    q?: string;
    radius?: number;
    limit?: number;
    category?: string;
  }) =>
    unwrap<any>(apiClient.get('/venues/sitara/discover', { params })),

  /** Create a real platform reservation for the logged-in customer. */
  createReservation: (data: {
    businessId: string;
    reservationDate: string;
    reservationTime: string;
    numberOfGuests: number;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    specialRequests?: string;
  }) => unwrap<any>(apiClient.post('/reservations', data)),

  /** Verify a check-in (QR code, manual code, or reservation reference). */
  verifyCheckIn: (data: { code?: string; reservationId?: string; lat?: number; lng?: number; method?: string }) =>
    unwrap<any>(apiClient.post('/checkin/verify', data)),

  /** Operator: list own promos with redemption counts. */
  listPromos: (businessId: string) =>
    unwrap<any[]>(apiClient.get('/sitara/promos', { params: { businessId } })),

  // ── Payment rails (reservation → payment → gateway) ───────────────
  /** Create a deposit/escrow payment against a reservation. Returns payment + pay URL. */
  createDepositPayment: (data: { reservationId: string; amount: number; paymentMethod?: string }) =>
    unwrap<any>(apiClient.post('/payments', data)),

  getPayment: (id: string) => unwrap<any>(apiClient.get(`/payments/${id}`)),

  // ── Tenant portal (leases by email) ───────────────────────────────
  tenantDashboard: () => unwrap<any>(apiClient.get('/tenant/dashboard')),

  // ── Operator data ─────────────────────────────────────────────────
  businessReservations: (businessId: string, params?: any) =>
    unwrap<any[]>(apiClient.get(`/businesses/${businessId}/reservations`, { params })),
  businessReviews: (businessId: string) =>
    unwrap<any>(apiClient.get(`/businesses/${businessId}/reviews`)),

  /**
   * Operator: all reviews for a business as one flat list.
   * Backend returns { reviews (Google), pabandiReviews (verified) } —
   * merged here, verified first, each tagged with its source.
   */
  operatorReviews: async (businessId: string) => {
    const raw: any = await unwrap<any>(apiClient.get(`/businesses/${businessId}/reviews`));
    const google = (raw?.reviews || []).map((r: any) => ({
      id: r.id || r.googleReviewId,
      author: r.authorName || 'Google reviewer',
      rating: r.rating,
      text: r.text,
      date: r.time,
      source: 'Google',
      verified: false,
    }));
    const verified = (raw?.pabandiReviews || []).map((r: any) => ({
      id: r.id,
      author:
        [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(' ') || 'Verified guest',
      rating: r.rating,
      text: r.text,
      date: r.createdAt,
      source: 'Sitara verified',
      verified: true,
      starPoints: r.starPoints,
    }));
    return [...verified, ...google];
  },

  getStarFinder: (businessId: string, minTier = 'tara', limit = 50) =>
    unwrap<any[]>(apiClient.get('/sitara/star-finder', { params: { businessId, minTier, limit } })),

  /**
   * Stars a business has EARNED from verified customers.
   * { verifiedAvg, verifiedCount, distribution, trustScore, recent }
   */
  businessStars: (businessId: string) =>
    unwrap<any>(apiClient.get(`/sitara/business/${businessId}/stars`)),

  sendPromo: (data: {
    businessId: string;
    targetTier?: string | null;
    title: string;
    description: string;
    value: number;
    promoType: string;
    expiresAt: string;
    maxRedemptions?: number | null;
  }) => unwrap<any>(apiClient.post('/sitara/promos', data)),

  // ── Passthrough to existing platform services ─────────────────────
  /** Real reservations for the logged-in customer. */
  myReservations: () => unwrap<any[]>(reservationService.getUserReservations()),

  /** Cancel a reservation (policy enforced server-side). */
  cancelReservation: (id: string) =>
    unwrap<any>(apiClient.post(`/reservations/${id}/cancel`)),

  // ── Square (merchant geo import + future rails) ───────────────────
  squareStatus: (businessId: string) =>
    unwrap<any>(apiClient.get('/square/status', { params: { businessId } })),
  /** Resolve the Square OAuth URL (authed) then navigate there. */
  squareConnect: async (businessId: string): Promise<string> => {
    const res: any = await apiClient.get('/square/connect', { params: { businessId } });
    const url = res?.data?.data?.url;
    if (!url) throw new Error('No redirect URL returned from Square connect');
    return url;
  },
  squareSync: (businessId: string) =>
    unwrap<any>(apiClient.post('/square/sync', { businessId })),

  /** Logged-in owner's business (CRM anchor). */
  myBusiness: () =>
    businessService
      .getMyBusiness()
      .then((r: any) => r?.data?.data?.business ?? r?.data?.data ?? null),

  /** Distinct patrons who booked at a business (existing CRM data). */
  businessCustomers: (businessId: string) =>
    unwrap<any>(businessService.getBusinessCustomers(businessId)),

  // ── Promoter (real /promoters/* backend) ──────────────────────────
  promoterMe: () => unwrap<any>(apiClient.get('/promoters/me')),
  promoterStats: () => unwrap<any>(apiClient.get('/promoters/stats')),
  promoterBookings: () => unwrap<any[]>(apiClient.get('/promoters/bookings')),
  promoterWallet: () => unwrap<any>(apiClient.get('/promoters/wallet')),
  promoterLeaderboard: (limit = 10) =>
    unwrap<any[]>(apiClient.get('/promoters/leaderboard', { params: { limit } })),
  promoterRefLink: () => unwrap<any>(apiClient.get('/promoters/ref-link')),
  promoterRegister: (data: { name: string; phone?: string; instagram?: string; bio?: string }) =>
    unwrap<any>(apiClient.post('/promoters/register', data)),
};
