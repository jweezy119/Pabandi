import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  UserCheck,
  Bot,
  Tag,
  Sparkles,
  ShieldCheck,
  CalendarCheck,
  Award,
  ArrowRight,
  CheckCircle2,
  Mail,
  KeyRound,
  Phone,
  MapPin,
  Loader2,
  AlertCircle,
  Compass,
  User,
  Repeat,
  Star,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLanguage } from '../context/LanguageContext';
import { apiClient, authService } from '../services/api';
import { effectiveMode } from '../utils/accountMode';

interface PreviewBusiness {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
  reviewCount: number;
  avatarUrl?: string | null;
  startingPrice?: number;
  escrowEnabled?: boolean;
  trustBand?: string;
  description?: string;
}

const PREVIEW_CATEGORIES = [
  { id: 'ALL', label: 'All Businesses' },
  { id: 'RESTAURANT', label: 'Restaurants' },
  { id: 'SALON', label: 'Salons & Spas' },
  { id: 'CLINIC', label: 'Clinics' },
  { id: 'ROOFING', label: 'Home & Trade' },
  { id: 'FREELANCE', label: 'Freelancers' },
];

export default function CustomersPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, setAuth, setUser, setToken, toggleMode } = useAuthStore();
  const { language, setLanguage, isRTL, t } = useLanguage();

  const initialFirst = user?.firstName && user.firstName !== 'User' ? user.firstName : '';
  const initialLast = user?.lastName || '';

  // Frictionless personal profile form state
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [location, setLocation] = useState(user?.location || '');
  const [showOptionalExtras, setShowOptionalExtras] = useState(Boolean(user?.phone || user?.location));

  // 2-step magic code auth state (for signed-out visitors)
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Public business preview state
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [businesses, setBusinesses] = useState<PreviewBusiness[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingBusinesses(true);
    const params: Record<string, string | number> = { limit: 6 };
    if (selectedCategory !== 'ALL') {
      params.category = selectedCategory;
    }
    apiClient
      .get('/booking/businesses', { params })
      .then((res) => {
        if (!active) return;
        const list = res.data?.items ?? res.data?.data ?? [];
        setBusinesses(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setBusinesses([]);
      })
      .finally(() => {
        if (active) setLoadingBusinesses(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCategory]);

  // Light gamification: live Profile Readiness Meter (endowed progress starts at 20%)
  const readiness = useMemo(() => {
    let pct = 20;
    const hasName = firstName.trim().length >= 2;
    const hasEmail = email.trim().includes('@') && email.trim().includes('.');
    const hasPhone = phone.trim().length >= 7;
    const hasCity = location.trim().length >= 2;

    if (hasName) pct += 25;
    if (isAuthenticated || hasEmail) pct += 30;
    if (hasPhone) pct += 15;
    if (hasCity) pct += 10;

    let label = 'Almost there — add your name & email';
    if (pct >= 100) label = 'Trust Passport Ready';
    else if (pct >= 75) label = 'Ready to book — add phone or city for +25%';
    else if (pct >= 45) label = 'Great start — add your email to unlock';

    return { pct: Math.min(100, pct), label, hasName, hasEmail, hasPhone, hasCity };
  }, [firstName, email, phone, location, isAuthenticated]);

  const currentMode = effectiveMode(user);
  const needsOnboarding = isAuthenticated && user && !user.profileType;

  // Step 1 (Signed-out): Request 6-digit email verification code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirst) {
      setErrorMessage('Please enter your first name so businesses know who is booking.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      setStatusMessage('Sending your 6-digit verification code...');
      await authService.requestVerificationCode(cleanEmail);
      setStep('verify');
      setStatusMessage(`6-digit code sent to ${cleanEmail}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not send verification code.';
      setErrorMessage(msg);
      setStatusMessage('');
      // Still allow entering the code if email arrived
      setStep('verify');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 (Signed-out): Verify code + immediately finalize personal CLIENT profile -> /me?welcome=1
  const handleVerifyAndCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setErrorMessage('Please enter the 6-digit code from your email.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      setStatusMessage('Verifying code and unlocking your Personal Hub...');

      const verifyRes = await authService.verifyLoginCode(cleanEmail, cleanCode);
      const verifyPayload = verifyRes.data?.data ?? verifyRes.data;
      const { user: authedUser, token, refreshToken } = verifyPayload;
      setAuth(authedUser, token, refreshToken);

      // Finalize standard personal profile (CLIENT) with the visitor's real details
      const onboardRes = await authService.completeOnboarding({
        profileType: 'CLIENT',
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
      });
      const onboardPayload = onboardRes.data?.data ?? onboardRes.data;
      if (onboardPayload?.user) {
        setUser({
          ...authedUser,
          ...onboardPayload.user,
          preferredMode: 'personal',
        });
      }
      if (onboardPayload?.token) {
        setToken(onboardPayload.token);
      }

      setStatusMessage('Personal Profile unlocked! Opening your Personal Hub...');
      navigate('/me?welcome=1', { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Invalid or expired code. Please double-check and try again.';
      setErrorMessage(msg);
      setStatusMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  // 1-step finish for signed-in users who have not picked a profileType yet
  const handleFinishSignedInProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setErrorMessage('Please enter your first name.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      setStatusMessage('Activating your Personal Profile...');

      const res = await authService.completeOnboarding({
        profileType: 'CLIENT',
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
      });
      const payload = res.data?.data ?? res.data;
      if (payload?.user) {
        setUser({
          ...(user as any),
          ...payload.user,
          preferredMode: 'personal',
        });
      }
      if (payload?.token) {
        setToken(payload.token);
      }

      navigate('/me?welcome=1', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not save your profile.';
      setErrorMessage(msg);
      setStatusMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchToPersonalHub = async () => {
    try {
      setSwitchingMode(true);
      await toggleMode('personal');
      navigate('/me');
    } finally {
      setSwitchingMode(false);
    }
  };

  return (
    <div className={`landing ${isRTL ? 'landing-rtl' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>{t('For Customers — Create Your Personal Profile | Pabandi', 'صارفین کے لیے — اپنا ذاتی پروفائل بنائیں | پابندی')}</title>
        <meta
          name="description"
          content="Create a free standard personal profile on Pabandi in 30 seconds to book, reserve, and utilize trusted businesses with escrow protection."
        />
      </Helmet>

      {/* Ambient Orbs */}
      <div className="orbs-container" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Consistent Home Header with Icons */}
      <header className="header">
        <div className="container">
          <Link to="/" className="logo">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </Link>
          <nav className="nav-list" aria-label="Main">
            <Link to="/contact" className="nav-tab-link">
              <Building2 className="nav-tab-icon" size={15} aria-hidden="true" />
              <span>{t('For Businesses', 'کاروبار کے لیے')}</span>
            </Link>
            <Link to="/customers" className="nav-tab-link is-active" aria-current="page">
              <UserCheck className="nav-tab-icon" size={15} aria-hidden="true" />
              <span>{t('For Customers', 'صارفین کے لیے')}</span>
            </Link>
            <Link to="/agents" className="nav-tab-link">
              <Bot className="nav-tab-icon" size={15} aria-hidden="true" />
              <span>{t('For AI Developers', 'اے آئی ڈویلپرز')}</span>
            </Link>
            <Link to="/pricing" className="nav-tab-link">
              <Tag className="nav-tab-icon" size={15} aria-hidden="true" />
              <span>{t('Pricing', 'قیمتیں')}</span>
            </Link>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(191,179,163,0.35)' }}>
              <button
                type="button"
                onClick={() => setLanguage('EN')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: language === 'EN' ? 700 : 400,
                  background: language === 'EN' ? '#C97B5A' : 'transparent',
                  color: language === 'EN' ? '#fff' : '#6c6258',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('UR')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: language === 'UR' ? 700 : 400,
                  background: language === 'UR' ? '#C97B5A' : 'transparent',
                  color: language === 'UR' ? '#fff' : '#6c6258',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                اردو
              </button>
            </div>

            {isAuthenticated ? (
              <Link to="/me" className="cta-nav">{t('Personal Hub', 'ذاتی ہب')}</Link>
            ) : (
              <Link to="/login?intent=customer&return_to=/me" className="cta-nav">{t('Sign In', 'سائن ان')}</Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Split: Value Prop + Instant Personal Profile Card */}
        <section className="py-12 sm:py-16 px-4 sm:px-6" aria-labelledby="customers-hero-title">
          <div className="container max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left Column: Customer Value Prop */}
              <div className="lg:col-span-6 lg:pt-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--warm-sand)] text-[var(--terracotta)] text-xs font-bold uppercase tracking-wider mb-5">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('Personal Profile · Ready in 30 Seconds', 'ذاتی پروفائل · 30 سیکنڈ میں تیار')}</span>
                </div>

                <h1
                  id="customers-hero-title"
                  className="font-headline text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--warm-ink)] leading-[1.12]"
                >
                  {t(
                    'Book, Reserve & Utilize Trusted Businesses — Effortlessly.',
                    'قابل اعتماد کاروبار بک اور ریزرو کریں — آسانی کے ساتھ۔'
                  )}
                </h1>

                <p className="mt-4 text-base sm:text-lg text-[#5a5348] leading-relaxed max-w-xl">
                  {t(
                    'Create a free standard personal profile once. Every booking, reservation, deposit, and trust milestone lives in your Personal Hub — with zero passwords to remember.',
                    'ایک بار مفت ذاتی پروفائل بنائیں۔ آپ کی ہر بکنگ، ریزرویشن اور اسکرو تحفظ آپ کے ذاتی ہب میں محفوظ رہے گا۔'
                  )}
                </p>

                {/* Crisp Benefit Grid */}
                <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="rounded-2xl bg-white/80 border border-[rgba(191,179,163,0.4)] p-4 flex items-start gap-3 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-[var(--clay)]/12 text-[var(--terracotta)] flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--warm-ink)]">One-Tap Bookings</p>
                      <p className="text-xs text-[#6c6258] mt-0.5">Auto-fill your name &amp; contact info at any business on Pabandi.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 border border-[rgba(191,179,163,0.4)] p-4 flex items-start gap-3 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-[var(--sage)]/18 text-[#4f6142] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--warm-ink)]">Escrow Protection</p>
                      <p className="text-xs text-[#6c6258] mt-0.5">Deposits stay locked until your appointment or service is delivered.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 border border-[rgba(191,179,163,0.4)] p-4 flex items-start gap-3 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-[var(--muted-ochre)]/20 text-[#8a6518] flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--warm-ink)]">Portable Trust Passport</p>
                      <p className="text-xs text-[#6c6258] mt-0.5">Level up your reliability score &amp; earn $PAB rebates every visit.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 border border-[rgba(191,179,163,0.4)] p-4 flex items-start gap-3 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-[var(--clay)]/12 text-[var(--terracotta)] flex items-center justify-center shrink-0">
                      <Compass className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--warm-ink)]">Everything in One Hub</p>
                      <p className="text-xs text-[#6c6258] mt-0.5">Track active reservations, escrows, and receipts in /me.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive State-Aware Personal Profile Card */}
              <div className="lg:col-span-6">
                <div className="rounded-3xl bg-white border border-[rgba(191,179,163,0.45)] shadow-[var(--shadow-xl)] p-6 sm:p-8">
                  {/* Case A: Signed-in + already completed onboarding in Personal Mode */}
                  {isAuthenticated && !needsOnboarding && currentMode === 'personal' ? (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-[var(--sage)]/20 text-[#4f6142] flex items-center justify-center font-bold text-lg">
                            {(user?.firstName?.[0] || 'U').toUpperCase()}
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#4f6142]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Personal Profile Active
                            </span>
                            <h2 className="font-headline text-xl font-bold text-[var(--warm-ink)]">
                              Welcome back, {user?.firstName || 'Customer'}!
                            </h2>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-[#5a5348]">
                        Your standard personal profile is live. Jump straight into your Personal Hub or reserve a verified business now.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Link
                          to="/me"
                          className="flex items-center justify-between gap-2 px-4 py-3.5 rounded-2xl text-white font-bold text-sm shadow-[var(--shadow-btn)] transition-all hover:opacity-95"
                          style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
                        >
                          <span>Open Personal Hub</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                          to="/booking"
                          className="flex items-center justify-between gap-2 px-4 py-3.5 rounded-2xl bg-[var(--warm-ink)] text-white font-bold text-sm transition-all hover:opacity-90"
                        >
                          <span>Browse Businesses</span>
                          <Compass className="w-4 h-4" />
                        </Link>
                        <Link
                          to="/me/bookings"
                          className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] font-semibold text-sm hover:bg-[var(--warm-sand)]/60 transition-colors"
                        >
                          <span>My Bookings</span>
                          <CalendarCheck className="w-4 h-4 text-[var(--clay)]" />
                        </Link>
                        <Link
                          to="/me/profile"
                          className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] font-semibold text-sm hover:bg-[var(--warm-sand)]/60 transition-colors"
                        >
                          <span>Edit Personal Profile</span>
                          <User className="w-4 h-4 text-[var(--clay)]" />
                        </Link>
                      </div>
                    </div>
                  ) : isAuthenticated && !needsOnboarding && currentMode === 'business' ? (
                    /* Case B: Signed-in in Business Mode -> 1-click switch to Personal Hub */
                    <div className="space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--clay)]/15 text-[var(--terracotta)] flex items-center justify-center">
                          <Repeat className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--terracotta)]">
                            Business Mode Active
                          </span>
                          <h2 className="font-headline text-xl font-bold text-[var(--warm-ink)]">
                            Want to book as a customer?
                          </h2>
                        </div>
                      </div>

                      <p className="text-sm text-[#5a5348] leading-relaxed">
                        You&apos;re currently viewing Pabandi in Business Mode. Switch to your Personal Hub in one tap to book, reserve, and track personal appointments — your business data stays untouched.
                      </p>

                      <button
                        type="button"
                        onClick={handleSwitchToPersonalHub}
                        disabled={switchingMode}
                        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-btn)] transition-all hover:opacity-95 disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
                      >
                        {switchingMode ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <span>Switch to Personal Hub &amp; Book Businesses</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      <div className="text-center">
                        <Link to="/booking" className="text-xs font-semibold text-[var(--terracotta)] hover:underline">
                          Or browse verified businesses right now →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    /* Case C: Signed-out OR Signed-in needing onboarding -> Frictionless Gamified Profile Builder */
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--terracotta)]">
                            {needsOnboarding
                              ? 'Final Step · Personal Profile'
                              : step === 'details'
                                ? 'Step 1 of 2 · Standard Personal Profile'
                                : 'Step 2 of 2 · Quick Email Verification'}
                          </span>
                          <h2 className="font-headline text-2xl font-bold text-[var(--warm-ink)] mt-0.5">
                            {needsOnboarding
                              ? 'Finish Your Personal Profile'
                              : 'Create Your Personal Profile'}
                          </h2>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${
                            readiness.pct >= 100
                              ? 'bg-[var(--sage)]/20 text-[#4f6142]'
                              : 'bg-[var(--warm-sand)] text-[var(--terracotta)]'
                          }`}
                          data-testid="profile-readiness-pct"
                        >
                          {readiness.pct}% Ready
                        </span>
                      </div>

                      {/* Gamified Live Profile Readiness Meter */}
                      <div className="mb-5 p-3.5 rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.35)]">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-[var(--warm-ink)] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[var(--clay)]" aria-hidden="true" />
                            <span>{readiness.label}</span>
                          </span>
                          {readiness.pct >= 100 && (
                            <span className="text-[11px] font-bold text-[#4f6142]">✓ Unlocked</span>
                          )}
                        </div>
                        <div className="h-2 w-full rounded-full bg-[var(--warm-sand)] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--clay)] to-[var(--sage)]"
                            initial={{ width: '20%' }}
                            animate={{ width: `${readiness.pct}%` }}
                            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                          />
                        </div>
                      </div>

                      {/* Alerts */}
                      <AnimatePresence mode="wait">
                        {errorMessage && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            role="alert"
                            className="mb-4 flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMessage}</span>
                          </motion.div>
                        )}
                        {statusMessage && !errorMessage && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--sage)]/40 bg-[var(--sage)]/12 px-3.5 py-2.5 text-xs text-[#3f5034] font-medium"
                          >
                            <ShieldCheck className="w-4 h-4 shrink-0 text-[var(--sage)]" />
                            <span>{statusMessage}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {needsOnboarding ? (
                        <form onSubmit={handleFinishSignedInProfile} className="space-y-3.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="cust-first-finish" className="block text-xs font-semibold text-[#5a5348] mb-1">
                                First Name *
                              </label>
                              <input
                                id="cust-first-finish"
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Amina"
                                className="w-full min-h-[44px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 px-3.5 py-2.5 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] focus:ring-2 focus:ring-[var(--clay)]/20"
                              />
                            </div>
                            <div>
                              <label htmlFor="cust-last-finish" className="block text-xs font-semibold text-[#5a5348] mb-1">
                                Last Name <span className="font-normal text-[#8b8072]">(optional)</span>
                              </label>
                              <input
                                id="cust-last-finish"
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Khan"
                                className="w-full min-h-[44px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 px-3.5 py-2.5 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] focus:ring-2 focus:ring-[var(--clay)]/20"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="cust-phone-finish" className="block text-xs font-semibold text-[#5a5348] mb-1">
                                Phone <span className="font-normal text-[#4f6142]">(+15% ready)</span>
                              </label>
                              <input
                                id="cust-phone-finish"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+1 (312) 555-0199"
                                className="w-full min-h-[44px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 px-3.5 py-2.5 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] focus:ring-2 focus:ring-[var(--clay)]/20"
                              />
                            </div>
                            <div>
                              <label htmlFor="cust-city-finish" className="block text-xs font-semibold text-[#5a5348] mb-1">
                                City <span className="font-normal text-[#4f6142]">(+10% ready)</span>
                              </label>
                              <input
                                id="cust-city-finish"
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Chicago or Lahore"
                                className="w-full min-h-[44px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 px-3.5 py-2.5 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] focus:ring-2 focus:ring-[var(--clay)]/20"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={submitting || !firstName.trim()}
                            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-btn)] transition-all hover:opacity-95 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
                          >
                            {submitting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <span>Unlock My Personal Hub</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </form>
                      ) : step === 'details' ? (
                        <form onSubmit={handleSendCode} className="space-y-3.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="cust-first-name" className="block text-xs font-semibold text-[#5a5348] mb-1">
                                First Name *
                              </label>
                              <input
                                id="cust-first-name"
                                type="text"
                                required
                                autoComplete="given-name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Amina"
                                disabled={submitting}
                                className="w-full min-h-[44px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 px-3.5 py-2.5 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] focus:ring-2 focus:ring-[var(--clay)]/20"
                              />
                            </div>
                            <div>
                              <label htmlFor="cust-last-name" className="block text-xs font-semibold text-[#5a5348] mb-1">
                                Last Name <span className="font-normal text-[#8b8072]">(optional)</span>
                              </label>
                              <input
                                id="cust-last-name"
                                type="text"
                                autoComplete="family-name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Khan"
                                disabled={submitting}
                                className="w-full min-h-[44px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 px-3.5 py-2.5 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] focus:ring-2 focus:ring-[var(--clay)]/20"
                              />
                            </div>
                          </div>

                          <div>
                            <label htmlFor="cust-email" className="block text-xs font-semibold text-[#5a5348] mb-1">
                              Email Address *
                            </label>
                            <div className="relative">
                              <Mail className="w-4 h-4 text-[#8b8072] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                              <input
                                id="cust-email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                disabled={submitting}
                                className="w-full min-h-[44px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 pl-10 pr-3.5 py-2.5 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] focus:ring-2 focus:ring-[var(--clay)]/20"
                              />
                            </div>
                          </div>

                          {/* Optional Phone & City (collapsed behind a friendly +25% bonus toggle to minimize friction) */}
                          {!showOptionalExtras ? (
                            <button
                              type="button"
                              onClick={() => setShowOptionalExtras(true)}
                              className="w-full text-left px-3.5 py-2.5 rounded-xl border border-dashed border-[var(--clay)]/45 bg-[var(--cream)]/50 text-xs font-semibold text-[var(--terracotta)] hover:bg-[var(--warm-sand)]/50 transition-colors flex items-center justify-between"
                            >
                              <span>+ Add phone &amp; city for instant booking pre-fill</span>
                              <span className="px-2 py-0.5 rounded-full bg-[var(--sage)]/20 text-[#4f6142] text-[10px] font-bold">
                                +25% Ready
                              </span>
                            </button>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div>
                                <label htmlFor="cust-phone" className="block text-xs font-semibold text-[#5a5348] mb-1">
                                  Phone <span className="font-normal text-[#4f6142]">(+15%)</span>
                                </label>
                                <div className="relative">
                                  <Phone className="w-3.5 h-3.5 text-[#8b8072] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                                  <input
                                    id="cust-phone"
                                    type="tel"
                                    autoComplete="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1 (312) 555-0199"
                                    disabled={submitting}
                                    className="w-full min-h-[42px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 pl-9 pr-3 py-2 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                                  />
                                </div>
                              </div>
                              <div>
                                <label htmlFor="cust-city" className="block text-xs font-semibold text-[#5a5348] mb-1">
                                  City <span className="font-normal text-[#4f6142]">(+10%)</span>
                                </label>
                                <div className="relative">
                                  <MapPin className="w-3.5 h-3.5 text-[#8b8072] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                                  <input
                                    id="cust-city"
                                    type="text"
                                    autoComplete="address-level2"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Chicago or Lahore"
                                    disabled={submitting}
                                    className="w-full min-h-[42px] rounded-xl border border-[rgba(191,179,163,0.55)] bg-[var(--cream)]/40 pl-9 pr-3 py-2 text-sm text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={submitting || !firstName.trim() || !email.trim()}
                            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-btn)] transition-all hover:opacity-95 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
                          >
                            {submitting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <span>Create Personal Profile &amp; Send Code</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>

                          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6c6258] border-t border-[rgba(191,179,163,0.28)]">
                            <Link
                              to="/login?intent=customer&return_to=/me"
                              className="font-semibold text-[var(--terracotta)] hover:underline"
                            >
                              Already have an account? Sign in
                            </Link>
                            <Link
                              to="/login?intent=customer&return_to=/me"
                              className="text-[#6c6258] hover:text-[var(--warm-ink)]"
                            >
                              Use Telegram, GitHub, or Wallet →
                            </Link>
                          </div>
                        </form>
                      ) : (
                        <form onSubmit={handleVerifyAndCreateProfile} className="space-y-4">
                          <div className="rounded-2xl bg-[var(--cream)] p-3.5 text-xs text-[#5a5348] flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-[var(--warm-ink)]">Code sent to {email}</span>
                              <p className="text-[11px] mt-0.5">Enter the 6-digit code to launch your Personal Hub.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setStep('details');
                                setErrorMessage('');
                              }}
                              className="text-xs font-bold text-[var(--terracotta)] hover:underline shrink-0"
                            >
                              Change
                            </button>
                          </div>

                          <div>
                            <label htmlFor="cust-code" className="block text-xs font-semibold text-[#5a5348] mb-1.5 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-[var(--clay)]" />
                              <span>6-Digit Verification Code</span>
                            </label>
                            <input
                              id="cust-code"
                              type="text"
                              inputMode="numeric"
                              autoFocus
                              required
                              maxLength={6}
                              value={code}
                              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="123456"
                              disabled={submitting}
                              className="w-full min-h-[54px] rounded-2xl border-2 border-[var(--clay)] bg-[var(--cream)]/40 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] font-bold text-[var(--warm-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--clay)]/20"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={submitting || code.trim().length !== 6}
                            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-btn)] transition-all hover:opacity-95 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
                          >
                            {submitting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <span>Verify &amp; Open My Personal Hub</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>

                          <div className="flex items-center justify-between text-xs text-[#6c6258]">
                            <button
                              type="button"
                              onClick={() => setStep('details')}
                              className="hover:text-[var(--warm-ink)] underline"
                            >
                              ← Back to details
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleSendCode({ preventDefault: () => {} } as React.FormEvent)}
                              className="font-semibold text-[var(--terracotta)] hover:underline"
                            >
                              Resend code
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Verified Businesses Preview Section */}
        <section className="py-12 px-4 sm:px-6 bg-[var(--warm-sand)]/35 border-y border-[rgba(191,179,163,0.3)]" aria-labelledby="discover-preview-title">
          <div className="container max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--terracotta)]">
                  Live on Pabandi
                </span>
                <h2 id="discover-preview-title" className="font-headline text-2xl sm:text-3xl font-extrabold text-[var(--warm-ink)] mt-1">
                  Businesses You Can Book &amp; Reserve Today
                </h2>
              </div>
              <Link
                to={isAuthenticated ? '/booking' : '/login?intent=customer&return_to=/booking'}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--terracotta)] hover:underline"
              >
                <span>Explore full directory</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {PREVIEW_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all ${
                      active
                        ? 'bg-[var(--warm-ink)] text-white shadow-sm'
                        : 'bg-white text-[var(--warm-ink)] border border-[rgba(191,179,163,0.45)] hover:bg-[var(--cream)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {loadingBusinesses ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-2xl bg-white/80 border border-[rgba(191,179,163,0.35)] p-5 h-44 animate-pulse" />
                ))}
              </div>
            ) : businesses.length === 0 ? (
              <div className="rounded-2xl bg-white border border-dashed border-[rgba(191,179,163,0.55)] p-8 text-center">
                <p className="font-semibold text-[var(--warm-ink)]">No businesses matched this filter yet.</p>
                <p className="text-xs text-[#6c6258] mt-1">Try &quot;All Businesses&quot; or create your personal profile to unlock full local discovery.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {businesses.map((biz) => (
                  <div
                    key={biz.id}
                    className="rounded-2xl bg-white border border-[rgba(191,179,163,0.4)] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-headline font-bold text-base text-[var(--warm-ink)] line-clamp-1">
                            {biz.name}
                          </h3>
                          <p className="text-xs text-[#6c6258] mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[var(--clay)]" aria-hidden="true" />
                            <span>{biz.city || 'Remote / Local'}</span>
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--cream)] text-xs font-bold text-[var(--warm-ink)] shrink-0">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" aria-hidden="true" />
                          <span>{(biz.rating ?? 5).toFixed(1)}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--warm-sand)]/70 text-[var(--warm-ink)]">
                          {(biz.category || 'SERVICE').replace(/_/g, ' ')}
                        </span>
                        {biz.escrowEnabled !== false && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--sage)]/20 text-[#4f6142]">
                            Escrow Protected
                          </span>
                        )}
                      </div>

                      {biz.description && (
                        <p className="text-xs text-[#6c6258] mt-2.5 line-clamp-2">{biz.description}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[rgba(191,179,163,0.25)] flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#5a5348]">
                        From ${biz.startingPrice && biz.startingPrice > 0 ? biz.startingPrice : 50}
                      </span>
                      <Link
                        to={`/book/${biz.id}`}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold text-white transition-all hover:opacity-95"
                        style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
                      >
                        <span>Book / Reserve</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* How It Works — 3 Simple Moves */}
        <section className="py-14 px-4 sm:px-6" aria-labelledby="customer-steps-title">
          <div className="container max-w-5xl mx-auto text-center">
            <h2 id="customer-steps-title" className="font-headline text-2xl sm:text-3xl font-extrabold text-[var(--warm-ink)]">
              Almost Too Easy — Three Moves
            </h2>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {[
                {
                  num: '01',
                  title: 'Make Your Personal Profile',
                  body: 'Enter your name and email, confirm the 6-digit code, and unlock your Personal Hub in 30 seconds.',
                },
                {
                  num: '02',
                  title: 'Book or Reserve Any Business',
                  body: 'Browse verified restaurants, salons, clinics, home pros, and freelancers with your info pre-filled.',
                },
                {
                  num: '03',
                  title: 'Protected Service & Rewards',
                  body: 'Your deposit stays safe in escrow until work is done — and every completed visit boosts your Trust Passport.',
                },
              ].map((item) => (
                <div
                  key={item.num}
                  className="rounded-2xl bg-white border border-[rgba(191,179,163,0.4)] p-6 shadow-sm"
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--warm-sand)] font-mono text-sm font-bold text-[var(--terracotta)] mb-4">
                    {item.num}
                  </span>
                  <h3 className="font-headline font-bold text-lg text-[var(--warm-ink)]">{item.title}</h3>
                  <p className="mt-2 text-sm text-[#5a5348] leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
