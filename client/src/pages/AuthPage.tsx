import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService, propertyManagerService } from '../services/api';
import { signMessageWithWallet } from '../utils/web3';
import { Surface, tokens } from '../design-system';

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

const GithubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 015.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.68.8.56A11.51 11.51 0 0023.5 12C23.5 5.73 18.27.5 12 .5z"/>
  </svg>
);

const PaypalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#003087" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.207 0 3.98.642 5.063 1.92 1.078 1.27 1.39 3.06 1.02 4.94-.37 1.88-1.36 3.5-2.79 4.62-1.43 1.12-3.36 1.74-5.48 1.74H9.6c-.46 0-.86.32-.96.78L7.076 21.337z"/>
    <path d="M9.12 7.86l-.78 4.97c-.09.46-.52.78-.99.78H5.34l2.95-18.74h4.62c1.9 0 3.42.55 4.36 1.65.94 1.1 1.21 2.65.84 4.29-.35 1.78-1.29 3.32-2.65 4.38-1.36 1.06-3.19 1.65-5.2 1.65h-1.4l-.95 4.83H9.12z" fill="#009cde"/>
  </svg>
);
const MetaMaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#E17726" d="M96.7,29.9c-2.4-7.4-4-11.4-4-11.4l-11.6,7.5l-12.7-8L80.8,4.9l4.5,1.7C85.3,6.6,99.1,37.3,96.7,29.9z"/>
    <path fill="#E27625" d="M3.3,29.9C5.7,22.5,7.3,18.5,7.3,18.5l11.6,7.5l12.7-8L19.2,4.9L14.7,6.6C14.7,6.6,0.9,37.3,3.3,29.9z"/>
    <path fill="#E27625" d="M68.4,18l-18.4,14L31.6,18l14.7-6.2l3.7,2l3.7-2L68.4,18z"/>
    <path fill="#D5BFB2" d="M68.4,18l-10.3,5.6l10.3,10.6L68.4,18z"/>
    <path fill="#D5BFB2" d="M31.6,18l10.3,5.6L31.6,34.2L31.6,18z"/>
    <path fill="#233447" d="M68.4,34.2l12.7-8L66,41.9l21.2,5.2c-0.1,0.1-5,7-5.5,7.6L68.4,34.2z"/>
    <path fill="#233447" d="M31.6,34.2l-12.7-8l15.1,15.7L12.8,47.1c0.1,0.1,5,7,5.5,7.6L31.6,34.2z"/>
    <path fill="#CC6228" d="M81.7,54.7L68.4,34.2l13.3,20.5L81.7,54.7z"/>
    <path fill="#CC6228" d="M18.3,54.7l13.3-20.5L18.3,54.7z"/>
    <path fill="#E27525" d="M66,41.9l-16,14.6l16-14.6H66z"/>
    <path fill="#E27525" d="M34,41.9l16,14.6l-16-14.6H34z"/>
    <path fill="#E27525" d="M50,56.5L34,41.9l16-10.2L50,56.5z"/>
    <path fill="#E27525" d="M50,56.5l16-14.6L50,31.7L50,56.5z"/>
    <path fill="#F6851B" d="M81.7,54.7L66,41.9L50,56.5l16,16.5L81.7,54.7z"/>
    <path fill="#F6851B" d="M18.3,54.7l15.7-12.8L50,56.5L34,73L18.3,54.7z"/>
    <path fill="#C0AD9E" d="M81.7,54.7l-15.7,18.3l15.7-9.5L81.7,54.7z"/>
    <path fill="#C0AD9E" d="M18.3,54.7l15.7,18.3L18.3,63.5L18.3,54.7z"/>
    <path fill="#161616" d="M66,73l-16-16.5L66,73z"/>
    <path fill="#161616" d="M34,73l16-16.5L34,73z"/>
    <path fill="#763D16" d="M66,73l15.7-9.5L66,73z"/>
    <path fill="#763D16" d="M34,73L18.3,63.5L34,73z"/>
    <path fill="#F6851B" d="M66,73l-16,13.7L50,86.7L66,73z"/>
    <path fill="#F6851B" d="M34,73l16,13.7L50,86.7L34,73z"/>
    <path fill="#F6851B" d="M66,73l-16,13.7l16-13.7H66z"/>
    <path fill="#F6851B" d="M34,73l16,13.7L34,73H34z"/>
    <path fill="#F6851B" d="M81.7,63.5l-15.7,9.5L66,73l15.7-9.5L81.7,63.5z"/>
    <path fill="#F6851B" d="M18.3,63.5l15.7,9.5L34,73L18.3,63.5z"/>
  </svg>
);

const BuildingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"/>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
  </svg>
);

const FieldError = ({ msg }: { msg: string }) => (
  <p className="mt-1.5 text-xs font-medium text-red-300">{msg}</p>
);

export default function AuthPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => location.pathname === '/register' ? 'signup' : 'login');
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
  const demoMode = searchParams.get('demo'); // 'migrate' | 'import' | 'webhook' | null
  const [demoData, setDemoData] = useState<any>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);
  const [error, setError] = useState(() => {
    if (urlError === 'facebook_not_configured') return 'Facebook login is not configured yet. Please add FACEBOOK_APP_ID in backend.';
    if (urlError === 'facebook_failed') return 'Facebook authentication failed. Please try again.';
    if (urlError === 'google_failed') return 'Google authentication failed. Please try again.';
    if (urlError === 'twitter_failed') return 'X/Twitter authentication failed. Please try again.';
    if (urlError === 'linkedin_failed') return 'LinkedIn authentication failed. Please try again.';
    if (urlError === 'tiktok_failed') return 'TikTok authentication failed. Please try again.';
    if (urlError === 'oauth_failed') return 'Authentication failed. Please try again.';
    if (urlError === 'token_parse_failed') return 'Login succeeded, but we could not read your session token. Please try again.';
    return '';
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithWallet } = useAuthStore();
  const navigate = useNavigate();
  const clearErrors = () => { setError(''); setFieldErrors({}); };

  useEffect(() => {
    setMode(location.pathname === '/register' ? 'signup' : 'login');
    clearErrors();
  }, [location.pathname]);

  // Load demo data for migration
  useEffect(() => {
    if (demoMode === 'migrate') {
      const stored = localStorage.getItem('pabandi_demo_data');
      if (stored) {
        try { setDemoData(JSON.parse(stored)); } catch { /* ignore */ }
      }
    }
  }, [demoMode]);

  const migrateDemoData = async () => {
    if (!demoData) return;
    setMigrating(true);
    try {
      // Enroll as property manager
      await propertyManagerService.enroll({ companyName: 'My Business', businessType: 'PROPERTY_MANAGEMENT' });
      // Add properties
      for (const p of demoData.properties || []) {
        await propertyManagerService.addProperty(p);
      }
      // Add tenants
      for (const t of demoData.tenants || []) {
        await propertyManagerService.addTenant(t);
      }
      localStorage.removeItem('pabandi_demo_data');
      setMigrationDone(true);
    } catch {
      // Migration failed silently — user can add manually
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    const r = searchParams.get('role');
    if (r === 'business') setRole('business');
    else if (r === 'customer') setRole('customer');
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[e.target.name]; return n; });
    }
  };

  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | 'paypal' | 'wallet' | null>(null);

  const getPostLoginTarget = () => {
    const redirect = searchParams.get('redirect');
    if (redirect && !redirect.includes('/login')) return redirect;
    return '/freelance';
  };

  const handleWalletAuth = async () => {
    try {
      setOauthLoading('wallet');
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error('MetaMask not detected. Please install it.');
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const res = await authService.getWalletNonce(address);
      const nonce = res.data?.data?.nonce || res.data?.nonce;
      const message = `Welcome to Pabandi!\n\nClick to sign in and accept the Pabandi Terms of Service: https://pabandi.app/tos\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${address}\n\nNonce:\n${nonce}`;
      const { signature } = await signMessageWithWallet(message);
      await loginWithWallet(address, signature);
      navigate(getPostLoginTarget());
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Wallet authentication failed.');
    } finally {
      setOauthLoading(null);
    }
  };

  const handleGoogleAuth = () => {
    setOauthLoading('google');
    const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
    window.location.href = `${backendUrl}/api/v1/auth/google?role=${role}`;
  };

  const handleGithubAuth = () => {
    setOauthLoading('github');
    const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
    window.location.href = `${backendUrl}/api/v1/auth/github?role=${role}`;
  };

  const handlePaypalAuth = () => {
    setOauthLoading('paypal');
    const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
    window.location.href = `${backendUrl}/api/v1/auth/paypal?role=${role}`;
  };

  const isSignup = mode === 'signup';
  const isBusiness = role === 'business';

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
          refCode: searchParams.get('ref') || undefined,
        } as any);
      }
      navigate(getPostLoginTarget());
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

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden px-4 py-12" style={{ background: tokens.color.background }}>
      {/* Background shapes */}
      <div className="pointer-events-none absolute -top-[15%] -left-[10%] h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-3xl mix-blend-multiply" />
      <div className="pointer-events-none absolute -bottom-[10%] -right-[5%] h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-3xl mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.25)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative z-10 w-full max-w-md reveal">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <span className="text-2xl font-black tracking-tight font-headline text-indigo-300">Pabandi</span>
          </Link>
        </div>

        {/* Auth Panel */}
        <Surface>
          {/* Mode tabs */}
          <div className="mb-6 flex gap-2 bg-white/5 p-1.5 rounded-xl">
            <button onClick={() => { setMode('login'); clearErrors(); }}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all touch-target sm:py-2 ${mode === 'login' ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Sign In
            </button>
            <button onClick={() => { setMode('signup'); clearErrors(); }}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all touch-target sm:py-2 ${mode === 'signup' ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Create Account
            </button>
          </div>

          {/* Role selector (signup only) */}
          {isSignup && (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setRole('customer')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all duration-200 touch-target sm:py-2.5 ${
                  role === 'customer'
                    ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-200'
                    : 'border-white/10 text-white/70 hover:bg-white/10'
                }`}>
                <UserIcon />
                Customer
              </button>
              <button
                onClick={() => setRole('business')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all duration-200 touch-target sm:py-2.5 ${
                  role === 'business'
                    ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-200'
                    : 'border-white/10 text-white/70 hover:bg-white/10'
                }`}>
                <BuildingIcon />
                Business
              </button>
            </div>
          )}

          {/* Demo migration banner */}
          {demoMode === 'migrate' && demoData && !migrationDone && (
            <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-bold text-emerald-200 mb-2">📋 You have demo data ready to migrate</p>
              <p className="text-xs text-emerald-300/80 mb-3">
                {demoData.properties?.length || 0} properties, {demoData.tenants?.length || 0} tenants, {demoData.pabEarned || 0} $PAB earned
              </p>
              <button onClick={migrateDemoData} disabled={migrating}
                className="w-full rounded-lg bg-emerald-500/20 border border-emerald-400/30 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60">
                {migrating ? 'Migrating…' : 'Migrate my demo data'}
              </button>
            </div>
          )}
          {migrationDone && (
            <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-bold text-emerald-200">✅ Demo data migrated! Sign up to see it.</p>
            </div>
          )}

          {/* Import/Webhook options from demo */}
          {(demoMode === 'import' || demoMode === 'webhook') && (
            <div className="mb-6 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
              <p className="text-sm font-bold text-indigo-200 mb-2">
                {demoMode === 'import' ? '📥 Import from your CRM' : '🔗 Webhook integration'}
              </p>
              <p className="text-xs text-indigo-300/80 mb-3">
                {demoMode === 'import'
                  ? 'Upload a CSV or connect your existing property management software.'
                  : 'Connect Pabandi as a trust layer on top of your existing CRM.'}
              </p>
              {demoMode === 'import' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {['Buildium', 'AppFolio', 'Rent Manager', 'Yardi'].map((crm) => (
                      <div key={crm} className="p-2 rounded-lg bg-white/5 text-center text-xs text-slate-300 border border-white/10">{crm}</div>
                    ))}
                  </div>
                  <p className="text-[10px] text-indigo-300/60">CSV upload available after signup</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {['tenant.created → auto-screen', 'lease.signed → escrow deposit', 'sale.completed → release funds'].map((e) => (
                    <div key={e} className="text-xs text-indigo-300/80">→ {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Heading */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold font-headline text-white">
              {isSignup
                ? (isBusiness ? 'List Your Business' : 'Join Pabandi')
                : 'Welcome Back'}
            </h1>
            <p className="mt-1.5 text-sm text-white/70 font-body">
              {isSignup
                ? (isBusiness
                    ? 'Connect your Google Business profile and start accepting bookings'
                    : 'Book top businesses globally — for free, always')
                : 'Sign in to access your bookings and dashboard'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={handleWalletAuth} type="button"
              className="flex items-center justify-center gap-3 w-full rounded-xl border border-[#E17726]/30 bg-[#E17726]/5 py-3.5 text-sm font-semibold text-white transition-colors shadow-sm touch-target sm:py-2.5"
              disabled={!!oauthLoading}>
              {oauthLoading === 'wallet' ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E17726]/30 border-t-[#E17726]" />
              ) : (
                <><MetaMaskIcon />
                {isSignup ? 'Sign up with Wallet' : 'Sign in with Wallet'}</>
              )}
            </button>
            <button onClick={handleGoogleAuth} type="button"
              className="flex items-center justify-center gap-3 w-full rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-semibold text-white shadow-sm touch-target sm:py-2.5 transition-all duration-150 active:scale-[0.98] hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-60 disabled:active:scale-100"
              disabled={!!oauthLoading}>
              {oauthLoading === 'google' ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
              ) : (
                <><GoogleIcon />
                {isSignup ? (isBusiness ? 'Continue with Google Business' : 'Continue with Google') : 'Sign in with Google'}</>
              )}
            </button>
            <button onClick={handleGithubAuth}
              className="flex items-center justify-center gap-3 w-full rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-semibold text-white transition-colors shadow-sm touch-target sm:py-2.5"
              disabled={!!oauthLoading}>
              {oauthLoading === 'github' ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
              ) : (
                <><GithubIcon />
                {isSignup ? 'Sign up with GitHub' : 'Sign in with GitHub'}</>
              )}
            </button>
            <button onClick={handlePaypalAuth}
              className="flex items-center justify-center gap-3 w-full rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-semibold text-white transition-colors shadow-sm touch-target sm:py-2.5"
              disabled={!!oauthLoading}>
              {oauthLoading === 'paypal' ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
              ) : (
                <><PaypalIcon />
                {isSignup ? 'Sign up with PayPal' : 'Sign in with PayPal'}</>
              )}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <hr className="flex-1 border-white/10" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">or continue with email</span>
            <hr className="flex-1 border-white/10" />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Signup-only fields */}
            {isSignup && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">First Name</label>
                    <input id="firstName" name="firstName" type="text" required value={formData.firstName} onChange={handleChange}
                      className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.firstName ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                      placeholder="Ali" />
                    {fieldErrors.firstName && <FieldError msg={fieldErrors.firstName} />}
                  </div>
                  <div>
                    <label htmlFor="lastName" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Last Name</label>
                    <input id="lastName" name="lastName" type="text" required value={formData.lastName} onChange={handleChange}
                      className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.lastName ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                      placeholder="Khan" />
                    {fieldErrors.lastName && <FieldError msg={fieldErrors.lastName} />}
                  </div>
                </div>

                {isBusiness && (
                  <>
                    <div className="mb-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
                      <p className="mb-2 text-sm font-bold text-indigo-200">Specialized Solutions:</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Link to="/live-selling" className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:text-indigo-200">
                          🎥 Live Sellers & Drops <span>→</span>
                        </Link>
                        <Link to="/freelance" className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:text-indigo-200">
                          💻 Freelancers & Gig Work <span>→</span>
                        </Link>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="businessName" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Business Name</label>
                      <input id="businessName" name="businessName" type="text" required value={formData.businessName} onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2"
                        placeholder="e.g. Saleem's Barbershop" />
                    </div>
                    <div>
                      <label htmlFor="googlePlaceId" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">
                        Google Place ID
                        <span className="ml-1 normal-case font-medium text-white/50">(optional)</span>
                      </label>
                      <input id="googlePlaceId" name="googlePlaceId" type="text" value={formData.googlePlaceId} onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2"
                        placeholder="ChIJ..." />
                      <p className="mt-1.5 text-xs text-white/70">
                        Find your Place ID at{' '}
                        <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline font-medium">
                          Google's Place ID Finder
                        </a>
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">
                    Phone
                    <span className="ml-1 normal-case font-medium text-white/50">(optional)</span>
                  </label>
                  <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange}
                    className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.phone ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                    placeholder="+1 312 489 6967 or +92 300 1234567" />
                  {fieldErrors.phone && <FieldError msg={fieldErrors.phone} />}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="fiverrUrl" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Fiverr URL <span className="normal-case font-medium text-white/50">(Opt)</span></label>
                    <input id="fiverrUrl" name="fiverrUrl" type="url" value={formData.fiverrUrl} onChange={handleChange}
                      className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.fiverrUrl ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                      placeholder="https://fiverr.com/..." />
                    {fieldErrors.fiverrUrl && <FieldError msg={fieldErrors.fiverrUrl} />}
                  </div>
                  <div>
                    <label htmlFor="upworkUrl" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Upwork URL <span className="normal-case font-medium text-white/50">(Opt)</span></label>
                    <input id="upworkUrl" name="upworkUrl" type="url" value={formData.upworkUrl} onChange={handleChange}
                      className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.upworkUrl ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                      placeholder="https://upwork.com/..." />
                    {fieldErrors.upworkUrl && <FieldError msg={fieldErrors.upworkUrl} />}
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleChange}
                className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.email ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                placeholder="you@gmail.com" />
              {fieldErrors.email && <FieldError msg={fieldErrors.email} />}
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wide text-white/70">Password</label>
                {!isSignup && (
                  <Link to="/forgot-password" title="Forgot password?" className="text-xs font-semibold text-indigo-300 hover:underline touch-target flex items-center">
                    Forgot password?
                  </Link>
                )}
              </div>
              <input id="password" name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required value={formData.password} onChange={handleChange}
                className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.password ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                placeholder="Min. 8 characters" />
              {isSignup && !fieldErrors.password && (<p className="mt-1.5 text-[11px] text-white/70">At least 8 characters</p>)}
              {fieldErrors.password && <FieldError msg={fieldErrors.password} />}
            </div>

            {/* Confirm Password */}
            {isSignup && (
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required value={formData.confirmPassword} onChange={handleChange}
                  className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.confirmPassword ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                  placeholder="••••••••" />
                {fieldErrors.confirmPassword && <FieldError msg={fieldErrors.confirmPassword} />}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl py-4 text-sm font-bold shadow-sm transition-opacity touch-target sm:py-3 hover:opacity-90 disabled:opacity-70 mt-2 bg-indigo-500 text-white">
              {loading
                ? (isSignup ? 'Creating account…' : 'Signing in…')
                : (isSignup
                    ? (isBusiness ? 'List My Business' : 'Create My Account')
                    : 'Sign In')}
            </button>
          </form>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-white/70">
            {isSignup ? (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); }}
                  className="font-bold text-indigo-300 hover:underline">
                  Sign in
                </button>
              </>
            ) : (
              <>Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }}
                  className="font-bold text-indigo-300 hover:underline">
                  Sign up free
                </button>
              </>
            )}
          </p>
        </Surface>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] font-bold tracking-wide text-white/70 uppercase">
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
            </svg>
            Secure &amp; Encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/>
            </svg>
            Always Free
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
            </svg>
            Global Scale
          </span>
        </div>
      </div>
    </div>
  );
}
