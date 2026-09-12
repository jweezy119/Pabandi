// Sitara API client
// Thin typed wrapper over the main app's authenticated apiClient.
// All auth (JWT from useAuthStore) is handled by the shared interceptor,
// so Sitara pages get real backend data with zero auth plumbing.
import apiClient, {
  reservationService,
  businessService,
} from '../../services/api';

// Unwrap the standard { success, data } envelope (fall back to raw data).
// All events are tracked for product analytics and customer insights.
async function unwrap<T>(p: Promise<any>): Promise<T> {
  const res = await p;
  
  // Track key events for product analytics
  if (typeof res === 'object' && res !== null) {
    trackEvent('api_call', {
      endpoint: res.endpoint || 'unknown',
      method: res.method || 'unknown',
      duration_ms: res.duration || 0,
      user_id: res.user_id || undefined,
      device: res.device || 'unknown',
      page: res.page || 'unknown'
    });
  }
  
  return (res?.data?.data ?? res?.data) as T;
}

/**
 * Track a user action for product analytics
 * @param event_name - Name of the event (e.g., 'product_view', 'recommendation_clicked')
 * @param parameters - Additional context about the action
 */
function trackEvent(eventName: string, parameters?: Record<string, any>) {
  console.log(`[analytics] ${eventName}:`, parameters);
  // In production, this would send to your analytics service (e.g., Mixpanel, Amplitude)
}

/**
 * Fire a custom analytics event
 * @param event_name - Name of the event
 * @param payload - Event-specific data
 */
function fireAnalyticsEvent(eventName: string, payload?: Record<string, any>) {
  trackEvent(eventName, payload);
}

// Interface definitions - consolidated and organized
interface StarPowerProfile {
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
    hospitalityScore: number;
    freelanceScore: number;
    appointmentScore: number;
    walletAddress: string;
    business: any;
  };
}

interface StarPromoItem {
  id: string;
  title: string;
  description: string;
  value: number;
  promoType: string;
  expiresAt: string;
  targetTier: string | null;
  alreadyRedeemed?: boolean;
  business?: { name: string; logoUrl?: string };
}

interface GetBusinessLeaderboard {
  businessId: string;
  minTier?: string;
  limit?: number;
}

interface CreateReservation {
  businessId: string;
  reservationDate: string;
  reservationTime: string;
  numberOfGuests: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  specialRequests?: string;
}

interface MarkRedemptionUsed {
  redemptionId: string;
  reservationId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

interface ListPromos {
  businessId: string;
  tier?: string | null;
  title: string;
  description: string;
  value: number;
  promoType: string;
  expiresAt: string;
  maxRedemptions?: number | null;
}

interface GetStarFinder {
  businessId: string;
  minTier: string;
  limit: number;
}

interface SendPromo {
  businessId: string;
  targetTier?: string | null;
  title: string;
  description: string;
  value: number;
  promoType: string;
  expiresAt: string;
  maxRedemptions?: number | null;
}

interface MyReservations {
  userId: string;
  reservations: any[];
}

interface MyBusiness {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  email: string;
  googlePlaceId?: string;
  customers: any[];
}

interface MyProfileChangeRequest {
  firstName: string;
  lastName: string;
}

interface NonceRequest {
  walletAddress: string;
}

interface VerifyWallet {
  walletAddress: string;
  signature: string;
}

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

interface VerifyLoginCodeResponse {
  success: boolean;
  message: string;
}

interface SendVerificationCodeResponse {
  success: boolean;
  message: string;
}

interface UpdateProfileResponse {
  success: boolean;
  message: string;
}

// Helper: resolve role to enum
function resolveRole(role?: string): 'BUSINESS_OWNER' | 'CUSTOMER' {
  if (!role) return 'CUSTOMER';
  const roles = ['BUSINESS_OWNER', 'CUSTOMER'];
  return roles.includes(role) ? role : 'CUSTOMER';
}

// Helper: create business profile if applicable
function createBusinessProfile(user: any, businessName?: string, googlePlaceId?: string): void {
  if (!businessName) return;
  
  const businessData: any = {
    create: {
      name: businessName,
      category: 'RESTAURANT',
      address: 'Global',
      phone: (user.phone || '').trim(),
      email: user.email,
      googlePlaceId: googlePlaceId,
      ...(businessName ? { businessName: businessName } : {}),
      ...(user.fiverrUrl ? { fiverrUrl: user.fiverrUrl } : {}),
      ...(user.upworkUrl ? { upworkUrl: user.upworkUrl } : {})
    }
  };
  
  await businessService.createBusiness(businessData);
}

// Helper: create frictionless Solana wallet
async function createSolanaWallet(): Promise<string> {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey;
  const address = publicKey.toBase58();
  const secret = keypair.secretKey;
  return address;
}

// Main sitara API client
// Organized by domain for clarity and maintainability
const sitaraApi = {
  // ── Star Power + reviews ──────────────────────────────────────────────
  getStarPower: (userId: string) =>
    unwrap<StarPowerProfile>(apiClient.get(`/reviews/star-power/${userId}`)),

  createReview: (data: { businessId: string; reservationId: string; rating: number; text?: string }) =>
    unwrap<any>(apiClient.post('/reviews', data)),

  upvoteReview: (reviewId: string) =>
    unwrap<any>(apiClient.post(`/reviews/${reviewId}/upvote`),
    () => ({ success: true }))

  getBusinessLeaderboard: (businessId: string, tier?: string) =>
    unwrap<GetBusinessLeaderboard>(apiClient.get(`/reviews/star-power/business/${businessId}`, { params: { tier } })),

  // ── Promos (consumer + operator) ─────────────────────────────────────
  getMyPromos: () =>
    unwrap<StarPromoItem[]>(apiClient.get('/sitara/my-promos')),

  redeemPromo: (code: string) =>
    unwrap<any>(apiClient.post('/sitara/redeem/', { promoCode: code })),

  markRedemptionUsed: (redemptionId: string) =>
    unwrap<MarkRedemptionUsed>(apiClient.post(`/reservations/${redemptionId}/use`)),

  getPromos: (businessId: string) =>
    unwrap<ListPromos>(apiClient.get('/sitara/promos', { params: { businessId } })),

  sendPromo: (data: {
    businessId: string;
    targetTier?: string | null;
    title: string;
    description: string;
    value: number;
    promoType: string;
    expiresAt: string;
    maxRedemptions?: number | null;
  }) =>
    unwrap<SendPromo>(apiClient.post('/sitara/promos', data)),

  // ── Discovery + booking loop ──────────────────────────────────────────
  discover: (params: {
    lat: number;
    lng: number;
    q?: string;
    radius?: number;
    limit?: number;
    category?: string;
  }) =>
    unwrap<GetBusinessLeaderboard>(apiClient.get(`/venues/sitara/discover`, { params })),

  createReservation: (data: {
    businessId: string;
    reservationDate: string;
    reservationTime: string;
    numberOfGuests: number;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    specialRequests?: string;
  }) =>
    unwrap<CreateReservation>(apiClient.post('/reservations', data)),

  verifyCheckIn: (data: {
    code?: string;
    reservationId?: string;
    lat?: number;
    lng?: number;
    method?: string;
  }) =>
    unwrap<any>(apiClient.post('/checkin/verify', data)),

  getBusinessLeaderboard: (businessId: string, minTier?: string, limit?: number) =>
    unwrap<GetBusinessLeaderboard>(apiClient.get(`/reviews/star-power/business/${businessId}`, { params: { minTier, limit } })),

  // ── Payment rails ─────────────────────────────────────────────────────
  createDepositPayment: (data: {
    reservationId: string;
    amount: number;
    paymentMethod?: string;
  }) =>
    unwrap<any>(apiClient.post('/payments', data)),

  getPayment: (id: string) =>
    unwrap<any>(apiClient.get(`/payments/${id}`)),

  // ── Tenant portal ─────────────────────────────────────────────────────
  tenantDashboard: () =>
    unwrap<MyReservations>(apiClient.get('/tenant/dashboard')),

  // ── Operator data ─────────────────────────────────────────────────────
  myReservations: () =>
    unwrap<MyReservations>(apiClient.get('/tenant/dashboard')),

  myBusiness: () =>
    businessService.getMyBusiness(),

  businessReservations: (businessId: string, params?: any) =>
    unwrap<MyReservations>(apiClient.get(`/businesses/${businessId}/reservations`, { params })),

  businessReviews: (businessId: string) =>
    unwrap<StarPromoItem[]>(apiClient.get(`/businesses/${businessId}/reviews`)),

  getStarFinder: (businessId: string, minTier = 'tara', limit = 50) =>
    unwrap<GetStarFinder>(apiClient.get(`/sitara/star-finder`, { params: { businessId, minTier, limit } })),

  sendPromo: (data: {
    businessId: string;
    targetTier?: string | null;
    title: string;
    description: string;
    value: number;
    promoType: string;
    expiresAt: string;
    maxRedemptions?: number | null;
  }) =>
    unwrap<SendPromo>(apiClient.post('/sitara/promos', data)),

  // ── Promoter (real /promoters/* backend) ─────────────────────────────
  promoterMe: () =>
    unwrap<any>(apiClient.get('/promoters/me')),

  promoterStats: () =>
    unwrap<any>(apiClient.get('/promoters/stats')),

  promoterBookings: () =>
    unwrap<any[]>(apiClient.get('/promoters/bookings')),

  promoterWallet: () =>
    unwrap<any>(apiClient.get('/promoters/wallet')),

  promoterLeaderboard: (limit = 10) =>
    unwrap<GetBusinessLeaderboard>(apiClient.get('/promoters/leaderboard', { params: { limit } })),

  promoterRefLink: () =>
    unwrap<any>(apiClient.get('/promoters/ref-link')),

  promoterRegister: (data: {
    name: string;
    phone?: string;
    instagram?: string;
    bio?: string;
  }) =>
    unwrap<any>(apiClient.post('/promoters/register', data)),

  // ── Auth (login/register) ─────────────────────────────────────────────
  login: (email: string, password: string) =>
    unwrap<any>(apiClient.post('/auth/login', { email, password })),

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: string;
    businessName?: string;
    googlePlaceId?: string;
    fiverrUrl?: string;
    upworkUrl?: string;
    refCode?: string;
    code?: string;
  }) =>
    unwrap<any>(apiClient.post('/auth/register', data)),

  registerWithCode: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    code: string;
    role?: string;
  }) =>
    unwrap<any>(apiClient.post('/auth/register', data)),

  requestCode: (email: string) =>
    unwrap<any>(apiClient.post('/auth/request-code', { email })),

  verifyCode: (data: {
    email: string;
    code: string;
  }) =>
    unwrap<VerifyLoginCodeResponse>(apiClient.post('/auth/verify-code', data)),

  verifyLoginCode: (email: string, code: string) =>
    unwrap<VerifyLoginCodeResponse>(apiClient.post('/auth/verify-code', { email, code })),

  // ── Email verification (registration flow) ────────────────────────────
  verifyEmail: (email: string) =>
    unwrap<ForgotPasswordResponse>(apiClient.post('/auth/verify-email', { email })),

  // ── Password reset (public endpoint) ─────────────────────────────────
  forgotPassword: (email: string) =>
    unwrap<ForgotPasswordResponse>(apiClient.post('/auth/forgot-password', { email })),

  resetPassword: (data: {
    token: string;
    password: string;
  }) =>
    unwrap<UpdatePasswordResponse>(apiClient.post('/auth/reset-password', data)),

  // ── Wallet verification (protected endpoint) ──────────────────────────
  verifyWallet: (data: {
    walletAddress: string;
    signature: string;
  }) =>
    unwrap<VerifyWalletResponse>(apiClient.post('/wallet/verify', data));
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

  const register = async (data: RegisterBody) => {
    const res = await sitaraApi.register(data);
    setAuth({ user: res.user, token: res.token, isAuthenticated: true });
    return res;
  };

  const refreshToken = async (token: string) => {
    const res = await sitaraApi.refreshToken(token);
    setAuth({ user: res.user, token: res.token, isAuthenticated: true });
    return res;
  };

  const verifyEmail = async (email: string) => {
    const res = await sitaraApi.verifyEmail(email);
    setAuth({ user: res.data, token: res.data.token, isAuthenticated: true });
    return res;
  };

  const requestLoginCode = async (email: string) => {
    const res = await sitaraApi.requestLoginCode(email);
    setAuth({ user: res.data, token: res.data.token, isAuthenticated: true });
    return res;
  };

  const verifyLoginCode = async (email: string, code: string) => {
    const res = await sitaraApi.verifyLoginCode({ email, code });
    setAuth({ user: res.data, token: res.data.token, isAuthenticated: true });
    return res;
  };

  const forgotPassword = async (email: string) => {
    const res = await sitaraApi.forgotPassword(email);
    setAuth({ user: res.data, token: res.data.token, isAuthenticated: true });
    return res;
  };

  const resetPassword = async (token: string, password: string) => {
    const res = await sitaraApi.resetPassword({ token, password });
    setAuth({ user: res.data, token: res.data.token, isAuthenticated: true });
    return res;
  };

  const updateProfile = async (data: UpdateProfileRequest) => {
    const res = await sitaraApi.updateProfile(data);
    setAuth({ user: res.data, token: res.data.token, isAuthenticated: true });
    return res;
  };

  const getNonce = async (walletAddress: string) => {
    const res = await sitaraApi.getNonce(walletAddress);
    setAuth({ user: res.data, token: res.data.token, isAuthenticated: true });
    return res;
  };

  const verifyWallet = async (data: VerifyWalletRequest) => {
    const res = await sitaraApi.verifyWallet(data);
    setAuth({ user: res.data, token: res.data.token, isAuthenticated: true });
    return res;
  };
}
