// Sitara OS — API client
// Thin typed wrapper over the main app's authenticated apiClient.
// All auth (JWT from useAuthStore) is handled by the shared interceptor,
// so Sitara pages get real backend data with zero auth plumbing.
import apiClient, {
  reservationService,
  businessService,
  promoterService,
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

  getStarFinder: (businessId: string, minTier = 'tara', limit = 50) =>
    unwrap<any[]>(apiClient.get('/sitara/star-finder', { params: { businessId, minTier, limit } })),

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

  /** Logged-in owner's business (CRM anchor). */
  myBusiness: () =>
    businessService
      .getMyBusiness()
      .then((r: any) => r?.data?.data?.business ?? r?.data?.data ?? null),

  /** Distinct patrons who booked at a business (existing CRM data). */
  businessCustomers: (businessId: string) =>
    unwrap<any>(businessService.getBusinessCustomers(businessId)),

  // ── Promoter ──────────────────────────────────────────────────────
  promoterDashboard: () => unwrap<any>(promoterService.getDashboard()),
  promoterReferralLink: () => unwrap<any>(promoterService.getReferralLink()),
  promoterBookings: () => unwrap<any[]>(promoterService.getRecentBookings()),
  promoterTier: () => unwrap<any>(promoterService.getTier()),
  promoterWallet: () => unwrap<any>(promoterService.getWallet()),
};
