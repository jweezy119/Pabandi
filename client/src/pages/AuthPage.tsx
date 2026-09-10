import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/api';
import { signMessageWithPhantom } from '../utils/web3';
import { Surface, tokens } from '../design-system';

type Mode = 'login' | 'signup';
type Role = 'customer' | 'business';

const GitHubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const MetaMaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#E17726" d="M96.7,29.9c-2.4-7.4-4-11.4-4-11.4l-11.6,7.5l-12.7-8L80.8,4.9l4.5,1.7C85.3,6.6,99.1,37.3,96.7,29.9z" />
    <path fill="#E27625" d="M3.3,29.9C5.7,22.5,7.3,18.5,7.3,18.5l11.6,7.5l12.7-8L19.2,4.9L14.7,6.6C14.7,6.6,0.9,37.3,3.3,29.9z" />
    <path fill="#E27625" d="M68.4,18l-18.4,14L31.6,18l14.7-6.2l3.7,2l3.7-2L68.4,18z" />
    <path fill="#D5BFB2" d="M68.4,18l-10.3,5.6l10.3,10.6L68.4,18z" />
    <path fill="#D5BFB2" d="M31.6,18l10.3,5.6L31.6,34.2L31.6,18z" />
    <path fill="#233447" d="M68.4,34.2l12.7-8L66,41.9l21.2,5.2c-0.1,0.1-5,7-5.5,7.6L68.4,34.2z" />
    <path fill="#233447" d="M31.6,34.2l-12.7-8l15.1,15.7L12.8,47.1c0.1,0.1,5,7,5.5,7.6L31.6,34.2z" />
    <path fill="#CC6228" d="M81.7,54.7L68.4,34.2l13.3,20.5L81.7,54.7z" />
    <path fill="#CC6228" d="M18.3,54.7l13.3-20.5L18.3,54.7z" />
    <path fill="#E27525" d="M66,41.9l-16,14.6l16-14.6H66z" />
    <path fill="#E27525" d="M34,41.9l16,14.6l-16-14.6H34z" />
    <path fill="#E27525" d="M50,56.5L34,41.9l16-10.2L50,56.5z" />
    <path fill="#E27525" d="M50,56.5l16-14.6L50,31.7L50,56.5z" />
    <path fill="#F6851B" d="M81.7,54.7L66,41.9L50,56.5l16,16.5L81.7,54.7z" />
    <path fill="#F6851B" d="M18.3,54.7l15.7-12.8L50,56.5L34,73L18.3,54.7z" />
    <path fill="#C0AD9E" d="M81.7,54.7l-15.7,18.3l15.7-9.5L81.7,54.7z" />
    <path fill="#C0AD9E" d="M18.3,54.7l15.7,18.3L18.3,63.5L18.3,54.7z" />
    <path fill="#161616" d="M66,73l-16-16.5L66,73z" />
    <path fill="#161616" d="M34,73l16-16.5L34,73z" />
    <path fill="#763D16" d="M66,73l15.7-9.5L66,73z" />
    <path fill="#763D16" d="M34,73L18.3,63.5L34,73z" />
    <path fill="#F6851B" d="M66,73l-16,13.7L50,86.7L66,73z" />
    <path fill="#F6851B" d="M34,73l16,13.7L50,86.7L34,73z" />
    <path fill="#F6851B" d="M66,73l-16,13.7l16-13.7H66z" />
    <path fill="#F6851B" d="M34,73l16,13.7L34,73H34z" />
    <path fill="#F6851B" d="M81.7,63.5l-15.7,9.5L66,73l15.7-9.5L81.7,63.5z" />
    <path fill="#F6851B" d="M18.3,63.5l15.7,9.5L34,73L18.3,63.5z" />
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
  <p className="mt-1.5 text-xs font-medium text-red-300">{msg}</p>
);

const getBackendUrl = () => {
  const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
  return rawBase.replace(/\/api\/v\d+\/?$/, '');
};

const EmailCodeLogin = ({ email, onEmailChange, onVerified, onError }: {
  email: string;
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVerified: () => void;
  onError: (msg: string) => void;
}) => {
  const [codeSent, setCodeSent] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      onError('Please enter your email first');
      return;
    }
    setLoading(true);
    onError('');
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/v1/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setCodeSent(true);
      } else {
        onError(data.message || 'Failed to send code');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!codeInput.trim()) {
      onError('Please enter the verification code');
      return;
    }
    setLoading(true);
    onError('');
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/v1/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: codeInput }),
      });
      const data = await res.json();
      if (data.success) {
        // Persist the session — without this the user "verifies" but stays logged out.
        const payload = data.data ?? data;
        if (payload?.token && payload?.user) {
          useAuthStore.getState().setAuth(payload.user, payload.token);
        }
        onVerified();
      } else {
        onError(data.message || 'Invalid code');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white">Quick Login (No Password)</p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={onEmailChange}
          placeholder="you@gmail.com"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400 touch-target"
        />
        <button
          type="button"
          onClick={handleSendCode}
          disabled={loading}
          className="px-4 py-3 rounded-lg bg-indigo-500 text-white text-sm font-bold touch-target disabled:opacity-50"
        >
          {loading ? '...' : 'Send Code'}
        </button>
      </div>
      {codeSent && (
        <div className="flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Enter 6-digit code"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400 touch-target"
          />
          <button
            type="button"
            onClick={handleVerifyCode}
            disabled={loading}
            className="px-4 py-3 rounded-lg bg-green-500 text-white text-sm font-bold touch-target disabled:opacity-50"
          >
            {loading ? '...' : 'Verify'}
          </button>
        </div>
      )}
    </div>
  );
};

export default function AuthPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => location.pathname === '/register' ? 'signup' : 'login');
  const [role, setRole] = useState<Role>(() => {
    const r = searchParams.get('role');
    return r === 'business' ? 'business' : 'customer';
  });
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    businessName: '',
    googlePlaceId: '',
    fiverrUrl: '',
    upworkUrl: '',
  });
  const urlError = searchParams.get('error');
  const [error, setError] = useState(() => {
    if (urlError === 'linkedin_failed') return 'LinkedIn authentication failed. Please try again.';
    if (urlError === 'tiktok_failed') return 'TikTok authentication failed. Please try again.';
    if (urlError === 'oauth_failed') return 'Authentication failed. Please try again.';
    if (urlError === 'token_parse_failed') return 'Login succeeded, but we could not read your session token. Please try again.';
    // OAuth providers redirect back with ?error=<provider>&message=<detail>
    if (urlError) {
      const detail = searchParams.get('message');
      const provider = urlError === 'github' ? 'GitHub' : urlError;
      return `${provider} sign-in failed${detail && detail !== 'undefined' ? `: ${detail}` : '. Please try again.'}`;
    }
    return '';
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const { login, register, loginWithWallet } = useAuthStore();
  const navigate = useNavigate();
  const clearErrors = () => { setError(''); setFieldErrors({}); }

  useEffect(() => {
    setMode(location.pathname === '/register' ? 'signup' : 'login');
    clearErrors();
  }, [location.pathname]);

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

  const getPostLoginTarget = () => {
    const redirect = searchParams.get('redirect');
    if (redirect && !redirect.includes('/login')) return redirect;
    return '/freelance';
  };

  const handleWalletAuth = async () => {
    try {
      setOauthLoading('wallet');
      const provider = (window as any).solana;
      if (!provider || !provider.isPhantom) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          const url = encodeURIComponent(window.location.href);
          const ref = encodeURIComponent(window.location.origin);
          window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
          return;
        }
        throw new Error('Phantom wallet not detected. Please install it.');
      }
      const resp = await provider.connect();
      const address = resp.publicKey.toString();
      const res = await authService.getWalletNonce(address);
      const nonce = res.data?.data?.nonce || res.data?.nonce;
      const message = `Welcome to Pabandi!\n\nClick to sign in and accept the Pabandi Terms of Service: https://pabandi.app/tos\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${address}\n\nNonce:\n${nonce}`;
      const { signature } = await signMessageWithPhantom(message);
      await loginWithWallet(address, signature);
      navigate(getPostLoginTarget());
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Wallet authentication failed.');
    } finally {
      setOauthLoading(null);
    }
  };

  const handleGitHubAuth = () => {
    setOauthLoading('github');
    const backendUrl = getBackendUrl();
    window.location.href = `${backendUrl}/api/v1/auth/social/github?role=${role}`;
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
      if (!/^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/.test(formData.password)) errs.password = 'Use 8+ characters with upper + lower case, a number, and a symbol (!@#$&*).';
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

  const socialLogins = [
    { id: 'github', name: 'GitHub', icon: <GitHubIcon />, color: 'bg-gray-800 hover:bg-gray-700', onClick: handleGitHubAuth },
  ] as const;

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
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          {/* Mode tabs */}
          <div className="mb-6 flex gap-2 bg-white/5 p-1.5 rounded-xl">
            <button onClick={() => { setMode('login'); clearErrors(); }}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all touch-target sm:py-2 ${mode === 'login' ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Sign In
            </button>
            <button onClick={() => { setMode('signup'); clearErrors(); }}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all touch-target sm:py-2 ${mode === 'signup' ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}>
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
                <>
                  <MetaMaskIcon />
                  {isSignup ? 'Sign up with Wallet' : 'Sign in with Wallet'}
                </>
              )}
            </button>
            <div className="mt-1 grid grid-cols-3 gap-3">
              {socialLogins.map((login) => (
                <button key={login.id} onClick={login.onClick} title={`Continue with ${login.name}`}
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 py-3.5 text-white transition-colors shadow-sm touch-target sm:py-2.5" disabled={!!oauthLoading}>
                  {oauthLoading === login.id ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
                  ) : (
                    login.icon
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="my-6 flex items-center gap-3">
            <hr className="flex-1 border-white/10" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">or continue with email</span>
            <hr className="flex-1 border-white/10" />
          </div>

          {/* Email Code Login */}
          <div className="mb-6">
            <EmailCodeLogin
              email={formData.email}
              onEmailChange={(e) => setFormData({...formData, email: e.target.value})}
              onVerified={() => {
                if (mode === 'login') {
                  navigate(getPostLoginTarget());
                }
              }}
              onError={setError}
            />
          </div>

          <div className="mb-6 flex items-center gap-3">
            <hr className="flex-1 border-white/10" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">or use password</span>
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
              {fieldErrors.password && <FieldError msg={fieldErrors.password} />}
              {isSignup && !fieldErrors.password && (
                <p className="mt-1 text-xs text-white/50">8+ characters, upper + lower case, a number, and a symbol (!@#$&*).</p>
              )}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Secure &amp; Encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            Always Free
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Global Scale
          </span>
        </div>
      </div>
    </div>
  );
}
