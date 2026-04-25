import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

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
  <p className="mt-1.5 text-xs font-medium" style={{ color: '#f87171' }}>{msg}</p>
);

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<Role>('customer');
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', phone: '',
    businessName: '', googlePlaceId: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuthStore();
  const navigate = useNavigate();

  const clearErrors = () => { setError(''); setFieldErrors({}); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error for this field as user types
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[e.target.name]; return n; });
    }
  };

  const handleGoogleAuth = () => {
    const backendUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : (import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '');
    window.location.href = `${backendUrl}/api/v1/auth/google?role=${role}`;
  };

  const handleFacebookAuth = () => {
    const backendUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : (import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '');
    window.location.href = `${backendUrl}/api/v1/auth/facebook?role=${role}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    // Client-side validation first
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
        } as any);
      }
      navigate('/dashboard');
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.errors) {
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-12"
      style={{ background: 'var(--color-bg)' }}>

      {/* Background glow blobs */}
      <div className="glow-blob w-[600px] h-[600px] top-[-200px] left-[-200px]"
        style={{ background: 'rgba(37,99,235,0.07)' }} />
      <div className="glow-blob w-[500px] h-[500px] bottom-[-100px] right-[-100px]"
        style={{ background: 'rgba(16,185,129,0.06)' }} />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>
              P
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900" >Pabandi</span>
          </Link>
        </div>

        {/* Auth Panel */}
        <div className="auth-panel p-8">

          {/* Mode tabs */}
          <div className="tab-bar mb-6">
            <button id="tab-login" onClick={() => { setMode('login'); clearErrors(); }}
              className={`tab-item ${mode === 'login' ? 'active' : ''}`}>
              Sign In
            </button>
            <button id="tab-signup" onClick={() => { setMode('signup'); clearErrors(); }}
              className={`tab-item ${mode === 'signup' ? 'active' : ''}`}>
              Create Account
            </button>
          </div>

          {/* Role selector (signup only) */}
          {isSignup && (
            <div className="flex gap-3 mb-6">
              <button
                id="role-customer"
                onClick={() => setRole('customer')}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-200 ${
                  role === 'customer'
                    ? 'border-blue-500/60 text-blue-300 bg-blue-500/10'
                    : 'border-white/08 text-[#7a90a8] hover:border-white/15 hover:text-[#a0b4c8]'
                }`}
                style={{ borderColor: role === 'customer' ? 'rgba(99,179,237,0.5)' : 'rgba(255,255,255,0.08)' }}>
                <UserIcon />
                Customer
              </button>
              <button
                id="role-business"
                onClick={() => setRole('business')}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-200 ${
                  role === 'business'
                    ? 'text-emerald-300 bg-emerald-500/10'
                    : 'text-[#7a90a8] hover:text-[#a0b4c8]'
                }`}
                style={{
                  borderColor: role === 'business' ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.08)',
                }}>
                <BuildingIcon />
                Business
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900" >
              {isSignup
                ? (isBusiness ? 'List Your Business' : 'Join Pabandi')
                : 'Welcome Back'}
            </h1>
            <p className="mt-1 text-sm text-slate-600" >
              {isSignup
                ? (isBusiness
                    ? 'Connect your Google Business profile and start accepting bookings'
                    : 'Book top businesses in Karachi — for free, always')
                : 'Sign in to access your bookings and dashboard'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button id="btn-google-auth" onClick={handleGoogleAuth} className="btn-google">
              <GoogleIcon />
              {isSignup
                ? (isBusiness ? 'Continue with Google Business' : 'Continue with Google')
                : 'Sign in with Google'}
            </button>
            <button id="btn-facebook-auth" onClick={handleFacebookAuth} className="btn-google" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <FacebookIcon />
              {isSignup ? 'Sign up with Facebook' : 'Sign in with Facebook'}
            </button>
          </div>

          <div className="divider">or continue with email</div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
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
                    <label htmlFor="firstName" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-slate-700" >First Name</label>
                    <input id="firstName" name="firstName" type="text" required
                      value={formData.firstName} onChange={handleChange}
                      className={`input-field ${fieldErrors.firstName ? 'border-red-500/50' : ''}`}
                      placeholder="Ali" />
                    {fieldErrors.firstName && <FieldError msg={fieldErrors.firstName} />}
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-slate-700" >Last Name</label>
                    <input id="lastName" name="lastName" type="text" required
                      value={formData.lastName} onChange={handleChange}
                      className={`input-field ${fieldErrors.lastName ? 'border-red-500/50' : ''}`}
                      placeholder="Khan" />
                    {fieldErrors.lastName && <FieldError msg={fieldErrors.lastName} />}
                  </div>
                </div>

                {isBusiness && (
                  <>
                    <div>
                      <label htmlFor="businessName" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-slate-700" >Business Name</label>
                      <input id="businessName" name="businessName" type="text" required
                        value={formData.businessName} onChange={handleChange}
                        className="input-field" placeholder="e.g. Saleem's Barbershop" />
                    </div>
                    <div>
                      <label htmlFor="googlePlaceId" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-slate-700" >
                        Google Place ID
                        <span className="ml-1 normal-case font-normal text-slate-800" >(optional)</span>
                      </label>
                      <input id="googlePlaceId" name="googlePlaceId" type="text"
                        value={formData.googlePlaceId} onChange={handleChange}
                        className="input-field" placeholder="ChIJ..." />
                      <p className="mt-1.5 text-xs text-slate-800" >
                        Find your Place ID at{' '}
                        <a href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                          target="_blank" rel="noreferrer" className="underline" style={{ color: '#60a5fa' }}>
                          Google's Place ID Finder
                        </a>
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-slate-700" >
                    Phone
                    <span className="ml-1 normal-case font-normal text-slate-800" >(optional)</span>
                  </label>
                  <input id="phone" name="phone" type="tel"
                    value={formData.phone} onChange={handleChange}
                    className={`input-field ${fieldErrors.phone ? 'border-red-500/50' : ''}`}
                    placeholder="+1 312 489 6967 or +92 300 1234567" />
                  {fieldErrors.phone && <FieldError msg={fieldErrors.phone} />}
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-slate-700" >Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required
                value={formData.email} onChange={handleChange}
                className={`input-field ${fieldErrors.email ? 'border-red-500/50' : ''}`}
                placeholder="you@gmail.com" />
              {fieldErrors.email && <FieldError msg={fieldErrors.email} />}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-slate-700" >Password</label>
                {!isSignup && (
                  <Link to="/forgot-password" title="Forgot password?" className="text-xs font-semibold hover:underline" style={{ color: '#60a5fa' }}>
                    Forgot password?
                  </Link>
                )}
              </div>
              <input id="password" name="password" type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
                value={formData.password} onChange={handleChange}
                className={`input-field ${fieldErrors.password ? 'border-red-500/50' : ''}`}
                placeholder="Min. 8 characters" />
              {isSignup && !fieldErrors.password && (
                <p className="mt-1 text-xs text-slate-800" >At least 8 characters</p>
              )}
              {fieldErrors.password && <FieldError msg={fieldErrors.password} />}
            </div>

            {/* Confirm Password */}
            {isSignup && (
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide text-slate-700" >Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password"
                  autoComplete="new-password" required
                  value={formData.confirmPassword} onChange={handleChange}
                  className={`input-field ${fieldErrors.confirmPassword ? 'border-red-500/50' : ''}`}
                  placeholder="••••••••" />
                {fieldErrors.confirmPassword && <FieldError msg={fieldErrors.confirmPassword} />}
              </div>
            )}

            <button id="btn-submit-auth" type="submit" disabled={loading}
              className="btn-primary w-full mt-2"
              style={{
                background: isBusiness && isSignup
                  ? 'linear-gradient(135deg,#059669,#047857)'
                  : undefined,
                boxShadow: isBusiness && isSignup
                  ? '0 4px 20px rgba(5,150,105,0.35)'
                  : undefined,
              }}>
              {loading
                ? (isSignup ? 'Creating account…' : 'Signing in…')
                : (isSignup
                    ? (isBusiness ? 'List My Business' : 'Create My Account')
                    : 'Sign In')}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-xs mt-6 text-slate-800" >
            {isSignup ? (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); }}
                  className="font-semibold hover:underline" style={{ color: '#60a5fa' }}>
                  Sign in
                </button>
              </>
            ) : (
              <>Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }}
                  className="font-semibold hover:underline" style={{ color: '#60a5fa' }}>
                  Sign up free
                </button>
              </>
            )}
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-6 text-xs text-slate-800" >
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Secure &amp; encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            Always free
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Karachi-first
          </span>
        </div>
      </div>
    </div>
  );
}
