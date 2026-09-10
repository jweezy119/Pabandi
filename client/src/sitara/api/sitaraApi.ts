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
    unwrap<any[]>(apiClient.get(`/businesses/${businessId}/reviews`)),

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

  // ── Auth (login/register) ─────────────────────────────────────────────────────
  login: (email: string, password: string) =>
    unwrap<any>(apiClient.post('/auth/login', { email, password })),
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string; code?: string }) =>
    unwrap<any>(apiClient.post('/auth/register', data)),
  registerWithCode: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string; code: string; role?: string }) =>
    unwrap<any>(apiClient.post('/auth/register', data)),
  requestCode: (email: string) =>
    unwrap<any>(apiClient.post('/auth/request-code', { email })),
  verifyCode: (data: { email: string; code: string }) =>
    unwrap<any>(apiClient.post('/auth/verify-code', data)),
};

export interface AuthState {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
}

export function useSitaraAuth() {
  const [auth, setAuth] = useState<AuthState>({ user: null, token: null, isAuthenticated: false });
  const login = async (email: string, password: string) => {
    const res = await sitaraApi.login(email, password);
    setAuth({ user: res.user, token: res.token, isAuthenticated: true });
    return res;
  };
  const register = async (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) => {
    const res = await sitaraApi.register(data);
    setAuth({ user: res.user, token: res.token, isAuthenticated: true });
    return res;
  };
  const logout = () => {
    setAuth({ user: null, token: null, isAuthenticated: false });
    localStorage.removeItem('auth-storage');
  };
  return { ...auth, login, register, logout };
}
