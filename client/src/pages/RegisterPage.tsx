import React, { useState, useMemo } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Check, ArrowLeft, Sparkles, ShieldCheck, Mail, RefreshCw } from 'lucide-react';
import { authService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import GlassNavHeader from '../components/GlassNavHeader';

type Step = 'details' | 'verify';

export const RegisterPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const isCrm = query.get('module') === 'contact';

  const [step, setStep] = useState<Step>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentNotice, setResentNotice] = useState(false);
  const [error, setError] = useState('');

  const pwChecks = useMemo(() => {
    return {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const pwScore = Object.values(pwChecks).filter(Boolean).length;

  if (isAuthenticated) {
    return <Navigate to={isCrm ? '/contact?wizard=true' : '/onboarding'} replace />;
  }

  const requestCode = async (isResend = false) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (isResend) {
      setResending(true);
    } else {
      setLoading(true);
    }
    setError('');
    setResentNotice(false);
    try {
      const res = await authService.requestVerificationCode(trimmedEmail);
      const data = res.data?.data ?? res.data;
      if (!data?.success) throw new Error(data?.message || 'Could not send verification code');
      setStep('verify');
      if (isResend) setResentNotice(true);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Could not send verification code. Please check your email and try again.');
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      setError('Please choose a password with at least 8 characters.');
      return;
    }
    void requestCode(false);
  };

  const complete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length < 4) {
      setError('Please enter the verification code from your email.');
      return;
    }
    if (!tosAccepted || !riskAccepted) {
      setError('Please accept the Terms of Service and Risk Disclosure to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authService.registerWithCode({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        code: code.trim(),
        tosAccepted,
        riskAccepted,
      });
      const data = res.data?.data ?? res.data;
      if (!data?.accessToken) throw new Error(data?.message || 'Registration failed');
      useAuthStore.setState({ user: data.user, token: data.accessToken, isAuthenticated: true });
      window.location.href = isCrm ? '/contact?wizard=true' : '/onboarding';
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Registration failed. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const canContinue = Boolean(firstName.trim() && lastName.trim() && email.trim() && password.length >= 8);

  return (
    <div className="pg-root flex flex-col">
      <div className="pg-grid-bg" aria-hidden="true" />
      <div className="pg-aurora a1" aria-hidden="true" />
      <div className="pg-aurora a2" aria-hidden="true" />

      <GlassNavHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 relative z-10">
        <div className="w-full max-w-[460px]">
          {/* Welcoming Header */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{
                background: 'rgba(224, 138, 99, 0.14)',
                border: '1px solid rgba(224, 138, 99, 0.35)',
                color: '#ffd2b8',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--pg-clay)' }} />
              <span>{isCrm ? 'Free CRM & Escrow · 2-minute setup' : 'Free pilot · No card required'}</span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--pg-display)',
                fontSize: 'clamp(26px, 6vw, 34px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                margin: '0 0 8px',
              }}
            >
              {step === 'details'
                ? isCrm
                  ? 'Welcome to your free workspace'
                  : 'Create your Pabandi account'
                : 'Check your inbox'}
            </h1>
            <p className="text-sm sm:text-[15px] m-0" style={{ color: 'var(--pg-muted)', lineHeight: 1.55 }}>
              {step === 'details' ? (
                'Get your Trust Passport and start protecting bookings in under a minute.'
              ) : (
                <>
                  We sent a verification code to{' '}
                  <strong style={{ color: 'var(--pg-ink)' }}>{email}</strong>
                </>
              )}
            </p>
          </div>

          {/* 2-Step Progress Indicator */}
          <div className="flex items-center gap-2 mb-5 px-1" aria-label="Registration progress">
            <div className="flex-1 flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                style={{
                  background: step === 'verify' ? 'var(--pg-green)' : 'var(--pg-clay)',
                  color: '#1a0f0a',
                }}
              >
                {step === 'verify' ? <Check className="w-3.5 h-3.5" /> : '1'}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--pg-ink)' }}>
                Your details
              </span>
            </div>
            <div
              className="h-[2px] flex-1 rounded-full transition-colors"
              style={{ background: step === 'verify' ? 'var(--pg-green)' : 'var(--pg-line-strong)' }}
            />
            <div className="flex-1 flex items-center justify-end gap-2">
              <span
                className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                style={{
                  background: step === 'verify' ? 'var(--pg-clay)' : 'rgba(255,255,255,0.08)',
                  color: step === 'verify' ? '#1a0f0a' : 'var(--pg-muted)',
                  border: step === 'verify' ? 'none' : '1px solid var(--pg-line-strong)',
                }}
              >
                2
              </span>
              <span className="text-xs font-medium" style={{ color: step === 'verify' ? 'var(--pg-ink)' : 'var(--pg-dim)' }}>
                Verify email
              </span>
            </div>
          </div>

          {/* Main Frosted Glass Card */}
          <div className="pg-glass p-5 sm:p-7">
            {error && (
              <div
                role="alert"
                className="mb-5 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
                style={{
                  background: 'rgba(255, 122, 144, 0.12)',
                  border: '1px solid rgba(255, 122, 144, 0.35)',
                  color: '#ffd0d8',
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {step === 'details' && (
              <form onSubmit={handleDetailsSubmit} className="space-y-4" noValidate>
                {/* Side-by-side names */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-first" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--pg-muted)' }}>
                      First name
                    </label>
                    <input
                      id="reg-first"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pg-input"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-last" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--pg-muted)' }}>
                      Last name
                    </label>
                    <input
                      id="reg-last"
                      type="text"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="pg-input"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--pg-muted)' }}>
                    Work or personal email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pg-input"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="reg-phone" className="text-xs font-medium" style={{ color: 'var(--pg-muted)' }}>
                      Phone number
                    </label>
                    <span className="text-[11px]" style={{ color: 'var(--pg-dim)' }}>Optional · WhatsApp alerts</span>
                  </div>
                  <input
                    id="reg-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pg-input"
                    placeholder="+1 555 0123"
                  />
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--pg-muted)' }}>
                    Create a password
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pg-input"
                      style={{ paddingRight: 44 }}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                      style={{ color: 'var(--pg-muted)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Friendly live password strength pills */}
                  {password.length > 0 ? (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <div
                            key={lvl}
                            className="h-1 flex-1 rounded-full transition-colors"
                            style={{
                              background:
                                pwScore >= lvl
                                  ? pwScore >= 4
                                    ? 'var(--pg-green)'
                                    : pwScore >= 3
                                    ? 'var(--pg-amber)'
                                    : 'var(--pg-clay)'
                                  : 'rgba(255,255,255,0.1)',
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { ok: pwChecks.length, label: '8+ chars' },
                          { ok: pwChecks.upper, label: 'A–Z' },
                          { ok: pwChecks.lower, label: 'a–z' },
                          { ok: pwChecks.number, label: '0–9' },
                          { ok: pwChecks.symbol, label: '!@#' },
                        ].map((c) => (
                          <span
                            key={c.label}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors"
                            style={{
                              background: c.ok ? 'rgba(94, 227, 154, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                              color: c.ok ? 'var(--pg-green)' : 'var(--pg-dim)',
                              border: `1px solid ${c.ok ? 'rgba(94, 227, 154, 0.35)' : 'var(--pg-line)'}`,
                            }}
                          >
                            {c.ok && <Check className="w-3 h-3" />}
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs m-0" style={{ color: 'var(--pg-dim)' }}>
                      Mix 8+ letters, numbers &amp; a symbol to keep your escrow account safe.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !canContinue}
                  className="pg-btn pg-btn-primary pg-btn-lg w-full mt-2"
                >
                  <Mail className="w-4 h-4" />
                  {loading ? 'Sending verification code…' : 'Continue & send code'}
                </button>

                <div className="pt-2 text-center text-sm" style={{ color: 'var(--pg-muted)' }}>
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--pg-clay)' }}>
                    Sign in
                  </Link>
                </div>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={complete} className="space-y-5" noValidate>
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setError('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: 'var(--pg-muted)' }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change email address
                </button>

                <div>
                  <label htmlFor="reg-code" className="block text-xs font-medium mb-2" style={{ color: 'var(--pg-muted)' }}>
                    6-digit verification code
                  </label>
                  <input
                    id="reg-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    className="pg-input text-center font-mono text-xl tracking-[0.35em]"
                    placeholder="123456"
                    maxLength={8}
                  />
                  {resentNotice && (
                    <p className="mt-2 text-xs text-center m-0" style={{ color: 'var(--pg-green)' }}>
                      ✓ Fresh verification code sent to {email}
                    </p>
                  )}
                </div>

                {/* Tactile Glass Consent Checkboxes */}
                <div className="space-y-2.5 pt-3 border-t" style={{ borderColor: 'var(--pg-line)' }}>
                  <label
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{
                      background: tosAccepted ? 'rgba(94, 227, 154, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${tosAccepted ? 'rgba(94, 227, 154, 0.3)' : 'var(--pg-line)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={tosAccepted}
                      onChange={(e) => setTosAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-[#e08a63] shrink-0"
                    />
                    <span className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--pg-muted)' }}>
                      I agree to the{' '}
                      <Link to="/terms" className="font-medium underline" style={{ color: 'var(--pg-ink)' }}>
                        Terms of Service
                      </Link>
                    </span>
                  </label>

                  <label
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{
                      background: riskAccepted ? 'rgba(94, 227, 154, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${riskAccepted ? 'rgba(94, 227, 154, 0.3)' : 'var(--pg-line)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={riskAccepted}
                      onChange={(e) => setRiskAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-[#e08a63] shrink-0"
                    />
                    <span className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--pg-muted)' }}>
                      I have read and accept the{' '}
                      <Link to="/risk" className="font-medium underline" style={{ color: 'var(--pg-ink)' }}>
                        Risk Disclosure
                      </Link>
                    </span>
                  </label>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="submit"
                    disabled={loading || code.trim().length < 4 || !tosAccepted || !riskAccepted}
                    className="pg-btn pg-btn-primary pg-btn-lg w-full"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {loading ? 'Creating your account…' : 'Verify & Create Account'}
                  </button>

                  <button
                    type="button"
                    disabled={resending}
                    onClick={() => void requestCode(true)}
                    className="pg-btn pg-btn-ghost w-full"
                  >
                    <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                    {resending ? 'Resending…' : 'Resend code'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Reassuring Trust Strip */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs" style={{ color: 'var(--pg-dim)' }}>
            <span>🔒 Non-custodial escrow</span>
            <span>◈ Free Trust Passport</span>
            <span>⚡ Cancel anytime</span>
          </div>
        </div>
      </main>
    </div>
  );
};
