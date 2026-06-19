import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLanguage } from '../context/LanguageContext';

type Mode = 'login' | 'signup';
type Role = 'customer' | 'business';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854V15.47h-3.047v-3.397h3.047V9.413c0-3.007 1.791-4.667 4.53-4.667 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.397h-2.796v8.457C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zM7.119 20.452H3.554V9h3.565v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.13-3.92-5.36-.5-2.31.06-4.78 1.5-6.6 1.48-1.92 3.8-3.03 6.18-3.09h.16v4.06c-1.33.02-2.61.64-3.48 1.63-.82.91-1.22 2.16-1.07 3.39.19 1.58 1.34 3.03 2.87 3.42 1.43.37 3.01.12 4.2-1.01.76-.71 1.25-1.72 1.25-2.78V.02h-.41z"/>
  </svg>
);

const BuildingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const FieldError = ({ msg }: { msg: string }) => (
  <p className="mt-1.5 text-xs font-medium text-error">{msg}</p>
);

export default function AuthPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => {
    return location.pathname === '/register' ? 'signup' : 'login';
  });
  const [role, setRole] = useState<Role>(() => {
    const r = searchParams.get('role');
    return r === 'business' ? 'business' : 'customer';
  });
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', phone: '',
    businessName: '', googlePlaceId: '',
    fiverrUrl: '', upworkUrl: '',
  });
  const urlError = searchParams.get('error');
  const [error, setError] = useState(() => {
    if (urlError === 'facebook_not_configured') return 'Facebook login is not configured yet. Please add FACEBOOK_APP_ID in backend.';
    if (urlError === 'facebook_failed') return 'Facebook authentication failed. Please try again.';
    if (urlError === 'google_failed') return 'Google authentication failed. Please try again.';
    return '';
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const clearErrors = () => { setError(''); setFieldErrors({}); };

  useEffect(() => {
    setMode(location.pathname === '/register' ? 'signup' : 'login');
    clearErrors();
  }, [location.pathname]);

  useEffect(() => {
    const r = searchParams.get('role');
    if (r === 'business') {
      setRole('business');
    } else if (r === 'customer') {
      setRole('customer');
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[e.target.name]; return n; });
    }
  };

  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | 'twitter' | 'linkedin' | 'tiktok' | null>(null);

  const handleGoogleAuth = () => {
    setOauthLoading('google');
    const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi-backend-97129395003.asia-south1.run.app';
    const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
    window.location.href = `${backendUrl}/api/v1/auth/google?role=${role}`;
  };

  const handleFacebookAuth = () => {
    setOauthLoading('facebook');
    const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi-backend-97129395003.asia-south1.run.app';
    const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
    window.location.href = `${backendUrl}/api/v1/auth/facebook?role=${role}`;
  };

  const handleTwitterAuth = () => {
    setOauthLoading('twitter');
    const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi-backend-97129395003.asia-south1.run.app';
    const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
    window.location.href = `${backendUrl}/api/v1/auth/twitter?role=${role}`;
  };

  const handleLinkedInAuth = () => {
    setOauthLoading('linkedin');
    const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi-backend-97129395003.asia-south1.run.app';
    const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
    window.location.href = `${backendUrl}/api/v1/auth/linkedin?role=${role}`;
  };

  const handleTikTokAuth = () => {
    setOauthLoading('tiktok');
    const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi-backend-97129395003.asia-south1.run.app';
    const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
    window.location.href = `${backendUrl}/api/v1/auth/tiktok?role=${role}`;
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (mode === 'signup') {
      const errs: Record<string, string> = {};
      if (!formData.firstName.trim()) errs.firstName = 'First name is required.';
      if (!formData.lastName.trim()) errs.lastName = 'Last name is required.';
      if (isBusiness && !formData.businessName.trim()) errs.businessName = 'Business name is required.';
      if (formData.password.length < 8) errs.password = 'Password must be at least 8 characters.';
      if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
      if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else {
          await register({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || undefined,
          role: role === 'business' ? 'BUSINESS_OWNER' : 'CUSTOMER',
          ...(role === 'business' && {
            businessName: formData.businessName,
            googlePlaceId: formData.googlePlaceId || undefined,
          }),
          fiverrUrl: formData.fiverrUrl || undefined,
          upworkUrl: formData.upworkUrl || undefined,
        } as any);
      }
      navigate('/dashboard');
    } catch (err: any) {
      const data = err.response?.data;
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        setError('Cannot connect to the server. If you are on the live site, the backend might be down or redeploying.');
      } else if (data?.errors) {
        setFieldErrors(data.errors);
        setError(data.message || 'Please fix the errors below.');
      } else {
        setError(data?.message || `${mode === 'login' ? 'Login' : 'Sign up'} failed. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === 'signup';
  const isBusiness = role === 'business';

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-12 bg-surface">

      {/* Background shapes */}
      <div className="absolute w-[500px] h-[500px] -top-[15%] -left-[10%] rounded-full bg-primary/5 blur-3xl pointer-events-none mix-blend-multiply" />
      <div className="absolute w-[400px] h-[400px] -bottom-[10%] -right-[5%] rounded-full bg-tertiary-fixed-dim/10 blur-3xl pointer-events-none mix-blend-multiply" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_70%_80%_at_50%_50%,black_20%,transparent_100%)]" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <span className="text-2xl font-black tracking-tight font-headline text-primary">Pabandi</span>
          </Link>
        </div>

        {/* Auth Panel */}
        <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-md border border-outline-variant/20">

          {/* Mode tabs */}
          <div className="flex gap-2 mb-6 bg-surface-container-low p-1 rounded-xl">
            <button onClick={() => { setMode('login'); clearErrors(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'login' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {t("Sign In", "Log In")}
            </button>
            <button onClick={() => { setMode('signup'); clearErrors(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'signup' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {t("Create Account", "Account Banayein")}
            </button>
          </div>

          {/* Role selector (signup only) */}
          {isSignup && (
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setRole('customer')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                  role === 'customer'
                    ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                    : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                }`}>
                <UserIcon />
                {t("Customer", "Sarif")}
              </button>
              <button
                onClick={() => setRole('business')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                  role === 'business'
                    ? 'border-tertiary bg-tertiary-fixed/20 text-tertiary ring-1 ring-tertiary/20'
                    : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                }`}>
                <BuildingIcon />
                {t("Business", "Karobar")}
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold font-headline text-on-surface">
              {isSignup
                ? (isBusiness ? t('List Your Business', 'Apna Karobar Shamil Karein') : t('Join Pabandi', 'Pabandi Join Karein'))
                : t('Welcome Back', 'Khush Aamdeed')}
            </h1>
            <p className="mt-1.5 text-sm text-on-surface-variant font-body">
              {isSignup
                ? (isBusiness
                    ? t('Connect your Google Business profile and start accepting bookings', 'Google Business profile connect karein aur bookings lena shuru karein')
                    : t('Book top businesses globally — for free, always', 'Dunya bhar ke behtareen businesses book karein — hamesha muft'))
                : t('Sign in to access your bookings and dashboard', 'Apni bookings aur dashboard dekhne ke liye sign in karein')}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={handleGoogleAuth}
              className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low text-sm font-semibold text-on-surface transition-colors shadow-sm"
              disabled={!!oauthLoading}>
              {oauthLoading === 'google' ? (
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <><GoogleIcon />
                {isSignup ? (isBusiness ? 'Continue with Google Business' : 'Continue with Google') : 'Sign in with Google'}</>
              )}
            </button>
            <button onClick={handleFacebookAuth}
              className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low text-sm font-semibold text-on-surface transition-colors shadow-sm"
              disabled={!!oauthLoading}>
              {oauthLoading === 'facebook' ? (
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <><FacebookIcon />
                {isSignup ? 'Sign up with Facebook' : 'Sign in with Facebook'}</>
              )}
            </button>
            <div className="grid grid-cols-3 gap-3 mt-1">
              <button onClick={handleTwitterAuth} title="Continue with X"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface transition-colors shadow-sm" disabled={!!oauthLoading}>
                {oauthLoading === 'twitter' ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <XIcon />}
              </button>
              <button onClick={handleLinkedInAuth} title="Continue with LinkedIn"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface transition-colors shadow-sm" disabled={!!oauthLoading}>
                {oauthLoading === 'linkedin' ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <LinkedInIcon />}
              </button>
              <button onClick={handleTikTokAuth} title="Continue with TikTok"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface transition-colors shadow-sm" disabled={!!oauthLoading}>
                {oauthLoading === 'tiktok' ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <TikTokIcon />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 my-6">
            <hr className="flex-1 border-outline-variant/20" />
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{t("or continue with email", "ya email se jaari rakhein")}</span>
            <hr className="flex-1 border-outline-variant/20" />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-sm font-medium bg-error-container text-on-error-container border border-error/20">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Signup-only fields */}
            {isSignup && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">First Name</label>
                    <input id="firstName" name="firstName" type="text" required
                      value={formData.firstName} onChange={handleChange}
                      className={`w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm ${fieldErrors.firstName ? 'border-error ring-1 ring-error' : ''}`}
                      placeholder="Ali" />
                    {fieldErrors.firstName && <FieldError msg={fieldErrors.firstName} />}
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">Last Name</label>
                    <input id="lastName" name="lastName" type="text" required
                      value={formData.lastName} onChange={handleChange}
                      className={`w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm ${fieldErrors.lastName ? 'border-error ring-1 ring-error' : ''}`}
                      placeholder="Khan" />
                    {fieldErrors.lastName && <FieldError msg={fieldErrors.lastName} />}
                  </div>
                </div>

                {isBusiness && (
                  <>
                    <div>
                      <label htmlFor="businessName" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">Business Name</label>
                      <input id="businessName" name="businessName" type="text" required
                        value={formData.businessName} onChange={handleChange}
                        className="w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm" placeholder="e.g. Saleem's Barbershop" />
                    </div>
                    <div>
                      <label htmlFor="googlePlaceId" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">
                        Google Place ID
                        <span className="ml-1 normal-case font-medium text-on-surface-variant/70">(optional)</span>
                      </label>
                      <input id="googlePlaceId" name="googlePlaceId" type="text"
                        value={formData.googlePlaceId} onChange={handleChange}
                        className="w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm" placeholder="ChIJ..." />
                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        Find your Place ID at{' '}
                        <a href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                          target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                          Google's Place ID Finder
                        </a>
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="phone" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">
                    Phone
                    <span className="ml-1 normal-case font-medium text-on-surface-variant/70">(optional)</span>
                  </label>
                  <input id="phone" name="phone" type="tel"
                    value={formData.phone} onChange={handleChange}
                    className={`w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm ${fieldErrors.phone ? 'border-error ring-1 ring-error' : ''}`}
                    placeholder="+1 312 489 6967 or +92 300 1234567" />
                  {fieldErrors.phone && <FieldError msg={fieldErrors.phone} />}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fiverrUrl" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">Fiverr URL <span className="normal-case font-medium text-on-surface-variant/70">(Opt)</span></label>
                    <input id="fiverrUrl" name="fiverrUrl" type="url"
                      value={formData.fiverrUrl} onChange={handleChange}
                      className={`w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm ${fieldErrors.fiverrUrl ? 'border-error ring-1 ring-error' : ''}`}
                      placeholder="https://fiverr.com/..." />
                    {fieldErrors.fiverrUrl && <FieldError msg={fieldErrors.fiverrUrl} />}
                  </div>
                  <div>
                    <label htmlFor="upworkUrl" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">Upwork URL <span className="normal-case font-medium text-on-surface-variant/70">(Opt)</span></label>
                    <input id="upworkUrl" name="upworkUrl" type="url"
                      value={formData.upworkUrl} onChange={handleChange}
                      className={`w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm ${fieldErrors.upworkUrl ? 'border-error ring-1 ring-error' : ''}`}
                      placeholder="https://upwork.com/..." />
                    {fieldErrors.upworkUrl && <FieldError msg={fieldErrors.upworkUrl} />}
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required
                value={formData.email} onChange={handleChange}
                className={`w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm ${fieldErrors.email ? 'border-error ring-1 ring-error' : ''}`}
                placeholder="you@gmail.com" />
              {fieldErrors.email && <FieldError msg={fieldErrors.email} />}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Password</label>
                {!isSignup && (
                  <Link to="/forgot-password" title="Forgot password?" className="text-xs font-semibold text-primary hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <input id="password" name="password" type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
                value={formData.password} onChange={handleChange}
                className={`w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm ${fieldErrors.password ? 'border-error ring-1 ring-error' : ''}`}
                placeholder="Min. 8 characters" />
              {isSignup && !fieldErrors.password && (
                <p className="mt-1.5 text-[11px] text-on-surface-variant">At least 8 characters</p>
              )}
              {fieldErrors.password && <FieldError msg={fieldErrors.password} />}
            </div>

            {/* Confirm Password */}
            {isSignup && (
              <div>
                <label htmlFor="confirmPassword" className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide text-on-surface-variant">Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password"
                  autoComplete="new-password" required
                  value={formData.confirmPassword} onChange={handleChange}
                  className={`w-full bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm ${fieldErrors.confirmPassword ? 'border-error ring-1 ring-error' : ''}`}
                  placeholder="••••••••" />
                {fieldErrors.confirmPassword && <FieldError msg={fieldErrors.confirmPassword} />}
              </div>
            )}

            <button type="submit" disabled={loading}
              className={`w-full py-3 rounded-lg text-sm font-bold shadow-sm transition-opacity ${isBusiness && isSignup ? 'bg-tertiary text-on-tertiary' : 'bg-primary text-on-primary'} hover:opacity-90 disabled:opacity-70 mt-2`}>
              {loading
                ? (isSignup ? 'Creating account…' : 'Signing in…')
                : (isSignup
                    ? (isBusiness ? 'List My Business' : 'Create My Account')
                    : 'Sign In')}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-xs mt-6 text-on-surface-variant">
            {isSignup ? (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); }}
                  className="font-bold text-primary hover:underline">
                  Sign in
                </button>
              </>
            ) : (
              <>Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }}
                  className="font-bold text-primary hover:underline">
                  Sign up free
                </button>
              </>
            )}
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-[11px] font-bold tracking-wide text-on-surface-variant uppercase">
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Secure &amp; Encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            Always Free
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Global Scale
          </span>
        </div>
      </div>
    </div>
  );
}
