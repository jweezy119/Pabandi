import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, ShieldCheck, Terminal, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService, API_HOST } from '../services/api';
import { signMessageWithPhantom } from '../utils/web3';
import { usePrivy } from '@privy-io/react-auth';
import '../styles/pbn-tokens.css';

// SVG Icons
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
    />
    <path
      fill="#4285F4"
      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
    />
    <path
      fill="#FBBC05"
      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
    />
    <path
      fill="#34A853"
      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const WalletIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

// Inner helper that uses Privy if configured
function PrivyButtonInner({ onAuthenticated, onError, loading, setLoading }: {
  onAuthenticated: (user: any, token: string, refreshToken?: string) => void;
  onError: (msg: string) => void;
  loading: boolean;
  setLoading: (val: boolean) => void;
}) {
  const { login } = usePrivy();

  const handlePrivyClick = async () => {
    try {
      setLoading(true);
      await login();
      // Privy auth handled via event/state
    } catch (err: any) {
      onError(err?.message || 'Privy wallet connection failed');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePrivyClick}
      disabled={loading}
      className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--pbn-border)] bg-[var(--pbn-surface)] px-4 py-3 text-sm font-semibold text-[var(--pbn-text)] transition-all hover:bg-[var(--pbn-surface-hover)] hover:border-[var(--pbn-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 active:scale-[0.99] disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-[var(--pbn-accent)]" /> : <WalletIcon />}
      <span>Connect Wallet</span>
    </button>
  );
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth, loginWithWallet, user, isAuthenticated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(searchParams.get('message') || '');

  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
  const isPrivyConfigured = Boolean(privyAppId && typeof privyAppId === 'string' && privyAppId.length === 25);

  // If already authenticated, redirect appropriately
  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (!user.profileType) {
        navigate('/onboarding', { replace: true });
      } else {
        const returnTo = searchParams.get('return_to');
        navigate(returnTo || '/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, searchParams]);

  // 1. Google OAuth
  const handleGoogleAuth = () => {
    const origin = encodeURIComponent(window.location.origin);
    const returnTo = encodeURIComponent('/onboarding');
    window.location.href = `${API_HOST}/api/v1/auth/google?origin=${origin}&return_to=${returnTo}`;
  };

  // 2. GitHub OAuth
  const handleGitHubAuth = () => {
    const origin = encodeURIComponent(window.location.origin);
    const returnTo = encodeURIComponent('/onboarding');
    window.location.href = `${API_HOST}/api/v1/auth/social/github?origin=${origin}&return_to=${returnTo}`;
  };

  // 3. Fallback Phantom Wallet Connection (if Privy not configured)
  const handleDirectWalletAuth = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setStatusMessage('Connecting Solana wallet...');
      const { address, signature } = await signMessageWithPhantom(
        'Welcome to Pabandi!\n\nSign this message to authenticate your account and claim cold-start trust privileges.'
      );
      setStatusMessage('Verifying signature on-chain...');
      await loginWithWallet(address, signature);
      setStatusMessage('Authenticated successfully!');
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Wallet connection cancelled or failed.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Send Magic Code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStatusMessage('Sending magic verification code...');
      await authService.requestVerificationCode(email.trim().toLowerCase());
      setCodeSent(true);
      setStatusMessage(`6-digit code sent to ${email.trim()}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to send login code.';
      setErrorMessage(msg);
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  // Verify Magic Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStatusMessage('Verifying magic code...');
      const res = await authService.verifyLoginCode(email.trim().toLowerCase(), code.trim());
      const { user: authedUser, token, refreshToken } = res.data.data;
      setAuth(authedUser, token, refreshToken);

      setStatusMessage('Authentication successful! Routing...');
      if (!authedUser.profileType) {
        navigate('/onboarding', { replace: true });
      } else {
        const returnTo = searchParams.get('return_to');
        navigate(returnTo || '/dashboard', { replace: true });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Invalid or expired verification code.';
      setErrorMessage(msg);
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a1118] px-4 py-12 text-[#e8eef4] selection:bg-[var(--pbn-accent)]/30">
      {/* Live accessibility region */}
      <div className="sr-only" aria-live="polite">
        {statusMessage || errorMessage}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-[420px]"
      >
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pbn-accent)]/10 text-[var(--pbn-accent)] border border-[var(--pbn-accent)]/20 shadow-lg shadow-[var(--pbn-accent)]/5">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#e8eef4] sm:text-3xl">
            Sign in to Pabandi
          </h1>
          <p className="mt-2 text-sm text-[#8a9aa8]">
            The trust layer for the agent economy.
          </p>
        </div>

        {/* Error / Status Alerts */}
        <AnimatePresence mode="wait">
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
          {statusMessage && !errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center gap-2.5 rounded-xl border border-[var(--pbn-accent)]/30 bg-[var(--pbn-accent)]/10 p-3.5 text-xs text-[var(--pbn-accent)]"
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth Action Stack */}
        <div className="space-y-3 rounded-2xl border border-[var(--pbn-border)] bg-[#101a24]/90 p-6 shadow-2xl backdrop-blur-sm">
          {/* 1. Continue with Google */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--pbn-border)] bg-[var(--pbn-surface)] px-4 py-3 text-sm font-semibold text-[var(--pbn-text)] transition-all hover:bg-[var(--pbn-surface-hover)] hover:border-[var(--pbn-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 active:scale-[0.99] disabled:opacity-50"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          {/* 2. Continue with GitHub (Crucial for builders) */}
          <button
            type="button"
            onClick={handleGitHubAuth}
            disabled={loading}
            className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--pbn-border)] bg-[var(--pbn-surface)] px-4 py-3 text-sm font-semibold text-[var(--pbn-text)] transition-all hover:bg-[var(--pbn-surface-hover)] hover:border-[var(--pbn-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 active:scale-[0.99] disabled:opacity-50"
          >
            <GitHubIcon />
            <span>Continue with GitHub</span>
          </button>

          {/* 3. Connect Wallet */}
          {isPrivyConfigured ? (
            <PrivyButtonInner
              onAuthenticated={(u, t, r) => {
                setAuth(u, t, r);
                navigate('/onboarding');
              }}
              onError={(msg) => setErrorMessage(msg)}
              loading={loading}
              setLoading={setLoading}
            />
          ) : (
            <button
              type="button"
              onClick={handleDirectWalletAuth}
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--pbn-border)] bg-[var(--pbn-surface)] px-4 py-3 text-sm font-semibold text-[var(--pbn-text)] transition-all hover:bg-[var(--pbn-surface-hover)] hover:border-[var(--pbn-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-[var(--pbn-accent)]" /> : <WalletIcon />}
              <span>Connect Wallet</span>
            </button>
          )}

          {/* 4. Continue with Email (Reveals simple email input + Send Magic Code) */}
          {!showEmailForm ? (
            <button
              type="button"
              onClick={() => {
                setShowEmailForm(true);
                setErrorMessage('');
              }}
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--pbn-border)] bg-[var(--pbn-surface)] px-4 py-3 text-sm font-semibold text-[var(--pbn-text)] transition-all hover:bg-[var(--pbn-surface-hover)] hover:border-[var(--pbn-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 active:scale-[0.99] disabled:opacity-50"
            >
              <Mail className="h-5 w-5 text-[#8a9aa8]" />
              <span>Continue with Email</span>
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="pt-2 border-t border-[var(--pbn-border)]"
            >
              {!codeSent ? (
                <form onSubmit={handleSendCode} className="space-y-3">
                  <div>
                    <label htmlFor="login-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      autoFocus
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full min-h-[48px] rounded-xl border border-[var(--pbn-border)] bg-[#0a1118] px-4 py-3 text-sm text-[#e8eef4] placeholder-[#5a6a78] focus:border-[var(--pbn-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/30 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pbn-accent)] px-4 py-3 text-sm font-semibold text-[#0a1118] transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)] active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>Send Magic Code</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-3">
                  <div>
                    <label htmlFor="login-code" className="sr-only">
                      6-digit code
                    </label>
                    <input
                      id="login-code"
                      type="text"
                      autoFocus
                      required
                      maxLength={8}
                      placeholder="Enter 6-digit code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={loading}
                      className="w-full min-h-[48px] rounded-xl border border-[var(--pbn-border)] bg-[#0a1118] px-4 py-3 text-center font-mono text-lg tracking-widest text-[#e8eef4] placeholder-[#5a6a78] focus:border-[var(--pbn-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/30 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !code}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pbn-accent)] px-4 py-3 text-sm font-semibold text-[#0a1118] transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)] active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>Verify & Sign In</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <div className="flex justify-between items-center text-xs text-[#8a9aa8] pt-1">
                    <button
                      type="button"
                      onClick={() => setCodeSent(false)}
                      className="hover:text-[var(--pbn-accent)] underline transition-colors"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={loading}
                      className="hover:text-[var(--pbn-accent)] underline transition-colors"
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer Link: Developer Sandbox */}
        <div className="mt-8 text-center">
          <Link
            to="/developers"
            className="inline-flex items-center gap-1.5 text-xs text-[#8a9aa8] transition-colors hover:text-[var(--pbn-accent)]"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Just want to test the API? Go to the Developer Sandbox</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

