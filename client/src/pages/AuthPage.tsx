import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/api';
import { Surface, tokens } from '../design-system';

type Mode = 'login' | 'signup' | 'verify';
type Role = 'customer' | 'business';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [mode, setMode] = useState<Mode>(() => (searchParams.get('mode') === 'signup' ? 'signup' : 'login'));
  const [role, setRole] = useState<Role>(() => (searchParams.get('role') === 'business' ? 'business' : 'customer'));
  const [step, setStep] = useState<'form' | 'verify'>('form');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    businessName: '',
    code: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const clearErrors = () => { setError(''); setFieldErrors({}); };

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'signup' || m === 'login') setMode(m);
    const r = searchParams.get('role');
    if (r === 'business') setRole('business');
    else if (r === 'customer') setRole('customer');
    clearErrors();
    setStep('form');
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[e.target.name]; return n; });
    }
  };

  const validateSignup = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.firstName.trim()) errs.firstName = 'First name is required.';
    if (!formData.lastName.trim()) errs.lastName = 'Last name is required.';
    if (role === 'business' && !formData.businessName.trim()) errs.businessName = 'Business name is required.';
    if (formData.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendCode = async () => {
    if (!formData.email.trim()) {
      setFieldErrors({ email: 'Email is required.' });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authService.requestVerificationCode(formData.email);
      const data = res.data?.data ?? res.data;
      if (!data?.success) throw new Error(data?.message || 'Could not send code');
      setPendingEmail(formData.email);
      setStep('verify');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not send verification code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSubmit = async () => {
    if (!formData.code.trim()) {
      setFieldErrors({ code: 'Enter the verification code.' });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const codeRes = await authService.requestVerificationCode(formData.email);
      const codeData = codeRes.data?.data ?? codeRes.data;
      if (!codeData?.success) throw new Error(codeData?.message || 'Verification failed');

      if (mode === 'signup') {
        if (!validateSignup()) { setLoading(false); return; }
        const regRes = await authService.registerWithCode({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || undefined,
          code: formData.code,
          role: role === 'business' ? 'BUSINESS_OWNER' : 'CUSTOMER',
        });
        const payload = regRes.data?.data ?? regRes.data;
        if (!payload?.accessToken) throw new Error(payload?.message || 'Registration failed');
        useAuthStore.getState().setAuth(payload.user, payload.accessToken);
      } else {
        await login(formData.email, formData.password);
      }
      const redirect = searchParams.get('redirect');
      navigate(redirect && !redirect.includes('/login') ? redirect : (role === 'business' ? '/property-manager' : '/freelance'));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);
    try {
      await login(formData.email, formData.password);
      const redirect = searchParams.get('redirect');
      navigate(redirect && !redirect.includes('/login') ? redirect : '/freelance');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === 'signup';
  const isBusiness = role === 'business';

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden px-4 py-12" style={{ background: tokens.color.background }}>
      <div className="pointer-events-none absolute -top-[15%] -left-[10%] h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-3xl mix-blend-multiply" />
      <div className="pointer-events-none absolute -bottom-[10%] -right-[5%] h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-3xl mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.25)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative z-10 w-full max-w-md reveal">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <span className="text-2xl font-black tracking-tight font-headline text-indigo-300">Pabandi</span>
          </Link>
          <p className="mt-2 text-sm text-white/60">Trust layer for every transaction.</p>
        </div>

        <Surface>
          <div className="mb-6 flex gap-2 bg-white/5 p-1.5 rounded-xl">
            <button onClick={() => { setMode('login'); clearErrors(); setStep('form'); }}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all touch-target sm:py-2.5 ${mode === 'login' && step === 'form' ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Sign In
            </button>
            <button onClick={() => { setMode('signup'); clearErrors(); setStep('form'); }}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all touch-target sm:py-2.5 ${mode === 'signup' && step === 'form' ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Create Account
            </button>
          </div>

          {(mode === 'signup' && step === 'form') && (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setRole('customer')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all touch-target sm:py-2.5 ${role === 'customer' ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-200' : 'border-white/10 text-white/70 hover:bg-white/10'}`}>
                👤 Customer
              </button>
              <button onClick={() => setRole('business')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all touch-target sm:py-2.5 ${role === 'business' ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-200' : 'border-white/10 text-white/70 hover:bg-white/10'}`}>
                🏢 Business / Property Manager
              </button>
            </div>
          )}

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold font-headline text-white">
              {step === 'verify' ? 'Verify your email' : isSignup ? (isBusiness ? 'List Your Business' : 'Join Pabandi') : 'Welcome Back'}
            </h1>
            <p className="mt-1.5 text-sm text-white/70 font-body">
              {step === 'verify'
                ? `Enter the 6-digit code sent to ${pendingEmail}`
                : isSignup
                  ? (isBusiness ? 'Create your property manager or business account' : 'Create your account to get started')
                  : 'Sign in to access your dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={isSignup ? (e) => { e.preventDefault(); handleSendCode(); } : handleLoginSubmit} className="space-y-4">
              {isSignup && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="firstName" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">First Name</label>
                      <input id="firstName" name="firstName" type="text" required value={formData.firstName} onChange={handleChange}
                        className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.firstName ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                        placeholder="Ali" />
                      {fieldErrors.firstName && <p className="mt-1.5 text-xs font-medium text-red-300">{fieldErrors.firstName}</p>}
                    </div>
                    <div>
                      <label htmlFor="lastName" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Last Name</label>
                      <input id="lastName" name="lastName" type="text" required value={formData.lastName} onChange={handleChange}
                        className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.lastName ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                        placeholder="Khan" />
                      {fieldErrors.lastName && <p className="mt-1.5 text-xs font-medium text-red-300">{fieldErrors.lastName}</p>}
                    </div>
                  </div>

                  {isBusiness && (
                    <div>
                      <label htmlFor="businessName" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Business / Property Company Name</label>
                      <input id="businessName" name="businessName" type="text" required value={formData.businessName} onChange={handleChange}
                        className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.businessName ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                        placeholder="e.g. Sunrise Properties" />
                      {fieldErrors.businessName && <p className="mt-1.5 text-xs font-medium text-red-300">{fieldErrors.businessName}</p>}
                    </div>
                  )}
                </>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleChange}
                  className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.email ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                  placeholder="you@gmail.com" />
                {fieldErrors.email && <p className="mt-1.5 text-xs font-medium text-red-300">{fieldErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Password</label>
                <input id="password" name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required value={formData.password} onChange={handleChange}
                  className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.password ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                  placeholder="Min. 8 characters" />
                {fieldErrors.password && <p className="mt-1.5 text-xs font-medium text-red-300">{fieldErrors.password}</p>}
              </div>

              {isSignup && (
                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Confirm Password</label>
                  <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required value={formData.confirmPassword} onChange={handleChange}
                    className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.confirmPassword ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                    placeholder="Repeat password" />
                  {fieldErrors.confirmPassword && <p className="mt-1.5 text-xs font-medium text-red-300">{fieldErrors.confirmPassword}</p>}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-4 text-sm font-bold shadow-sm transition-opacity touch-target sm:py-3 hover:opacity-90 disabled:opacity-70 mt-2 bg-indigo-500 text-white">
                {loading ? (isSignup ? 'Sending code…' : 'Signing in…') : (isSignup ? 'Continue with email' : 'Sign In')}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="code" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">Verification Code</label>
                <input id="code" name="code" type="text" inputMode="numeric" required value={formData.code} onChange={handleChange}
                  className={`w-full rounded-lg border bg-white/5 px-4 py-3 font-body text-sm text-white outline-none focus:border-indigo-400 sm:px-3 sm:py-2 touch-target ${fieldErrors.code ? 'border-red-500/60 ring-1 ring-red-500' : 'border-white/10'}`}
                  placeholder="123456" maxLength={6} />
                {fieldErrors.code && <p className="mt-1.5 text-xs font-medium text-red-300">{fieldErrors.code}</p>}
              </div>
              <button type="button" onClick={handleVerifyAndSubmit} disabled={loading}
                className="w-full rounded-xl py-4 text-sm font-bold shadow-sm transition-opacity touch-target sm:py-3 hover:opacity-90 disabled:opacity-70 bg-indigo-500 text-white">
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </button>
              <button type="button" onClick={handleSendCode} disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white/80 hover:text-white transition-colors touch-target">
                Resend code
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-white/70">
            {isSignup ? (
              <>Already have an account? <button onClick={() => { setMode('login'); clearErrors(); setStep('form'); }} className="font-bold text-indigo-300 hover:underline">Sign in</button></>
            ) : (
              <>Don't have an account? <button onClick={() => { setMode('signup'); clearErrors(); setStep('form'); }} className="font-bold text-indigo-300 hover:underline">Create one</button></>
            )}
          </p>
        </Surface>
      </div>
    </div>
  );
}
