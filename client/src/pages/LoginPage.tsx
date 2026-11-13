import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, ShieldCheck, Terminal, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService, API_HOST } from '../services/api';
import { signMessageWithPhantom } from '../utils/web3';
import { usePrivy } from '@privy-io/react-auth';
import '../styles/pbn-tokens.css';

const GitHubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const TelegramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fill="#2AABEE"
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"
    />
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
  const { login, authenticated, user, getAccessToken } = usePrivy();
  const syncingRef = React.useRef(false);

  // Automatically exchange Privy token with Pabandi backend when Privy completes auth
  React.useEffect(() => {
    let mounted = true;

    async function handlePrivySession() {
      if (!authenticated || !user || syncingRef.current) return;
      syncingRef.current = true;
      try {
        setLoading(true);
        const privyToken = await getAccessToken();
        if (!privyToken) {
          throw new Error('Could not retrieve Privy authentication token');
        }
        const res = await authService.privyAuth(privyToken);
        const { user: authedUser, token, refreshToken } = res.data.data;
        if (mounted) {
          onAuthenticated(authedUser, token, refreshToken);
        }
      } catch (err: any) {
        syncingRef.current = false;
        if (mounted) {
          onError(err?.response?.data?.message || err?.message || 'Privy wallet authentication failed');
          setLoading(false);
        }
      }
    }

    if (authenticated && user) {
      handlePrivySession();
    }

    return () => { mounted = false; };
  }, [authenticated, user]);

  const handlePrivyClick = async () => {
    try {
      setLoading(true);
      onError('');
      if (authenticated && user) {
        const privyToken = await getAccessToken();
        if (privyToken) {
          const res = await authService.privyAuth(privyToken);
          const { user: authedUser, token, refreshToken } = res.data.data;
          onAuthenticated(authedUser, token, refreshToken);
          return;
        }
      }
      await login();
      // If modal was dismissed or closed without completing
      setTimeout(() => {
        if (!authenticated) {
          setLoading(false);
        }
      }, 1500);
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
  const [showEmailForm, setShowEmailForm] = useState(true);
  const [codeSent, setCodeSent] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const isAnyLoading = walletLoading || emailLoading || telegramLoading;
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

  // 1. GitHub OAuth
  const handleGitHubAuth = () => {
    const origin = encodeURIComponent(window.location.origin);
    const returnTo = encodeURIComponent('/onboarding');
    window.location.href = `${API_HOST}/api/v1/auth/social/github?origin=${origin}&return_to=${returnTo}`;
  };

  // 2. Telegram Authentication (Widget & WebApp / Mini App)
  const botUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string) || 'PabanBot';

  const handleTelegramAuth = async (payload: { authData?: any; initData?: string }) => {
    try {
      setTelegramLoading(true);
      setErrorMessage('');
      setStatusMessage('Authenticating via Telegram...');
      const res = await authService.telegramAuth(payload);
      const { user: authedUser, token, refreshToken } = res.data.data;
      setAuth(authedUser, token, refreshToken);
      setStatusMessage('Telegram authenticated! Routing...');
      if (!authedUser.profileType) {
        navigate('/onboarding', { replace: true });
      } else {
        const returnTo = searchParams.get('return_to');
        navigate(returnTo || '/dashboard', { replace: true });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Telegram authentication failed';
      setErrorMessage(msg);
      setStatusMessage('');
    } finally {
      setTelegramLoading(false);
    }
  };

  React.useEffect(() => {
    // Check if opened inside a Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initData) {
      handleTelegramAuth({ initData: tg.initData });
    }
  }, []);

  const handleTelegramLoginClick = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initData) {
      handleTelegramAuth({ initData: tg.initData });
      return;
    }

    // Set global callback for Telegram Widget
    (window as any).onTelegramAuth = (tgUser: any) => {
      handleTelegramAuth({ authData: tgUser });
    };

    // Open Telegram OAuth authorization window or fallback to bot
    const authUrl = `https://oauth.telegram.org/auth?bot_id=9037959556&origin=${encodeURIComponent(window.location.origin)}&return_to=${encodeURIComponent(window.location.origin + '/onboarding')}&request_access=write`;
    const popup = window.open(authUrl, 'telegram_login', 'width=550,height=470,scrollbars=yes');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = `https://t.me/${botUsername}?start=auth`;
    }
  };

  // 3. Fallback Phantom Wallet Connection (if Privy not configured)
  const handleDirectWalletAuth = async () => {
    try {
      setWalletLoading(true);
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
      setWalletLoading(false);
    }
  };

  // 3. Send Magic Code
  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setEmailLoading(true);
      setErrorMessage('');
      setStatusMessage('Sending magic verification code...');
      await authService.requestVerificationCode(cleanEmail);
      setCodeSent(true);
      setStatusMessage(`6-digit code sent to ${cleanEmail}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to send login code.';
      setErrorMessage(msg);
      setStatusMessage('');
      // Still show the 6-digit input so if the email arrived, the user can immediately enter it
      setCodeSent(true);
    } finally {
      setEmailLoading(false);
    }
  };

  // Verify Magic Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    const cleanCode = code.trim().replace(/\D/g, '').slice(0, 6);
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setEmailLoading(true);
      setErrorMessage('');
      setStatusMessage('Verifying magic code...');
      const res = await authService.verifyLoginCode(cleanEmail, cleanCode);
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
      setEmailLoading(false);
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
          {/* 1. Continue with GitHub (Crucial for builders) */}
          <button
            type="button"
            onClick={handleGitHubAuth}
            disabled={isAnyLoading}
            className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--pbn-border)] bg-[var(--pbn-surface)] px-4 py-3 text-sm font-semibold text-[var(--pbn-text)] transition-all hover:bg-[var(--pbn-surface-hover)] hover:border-[var(--pbn-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 active:scale-[0.99] disabled:opacity-50"
          >
            <GitHubIcon />
            <span>Continue with GitHub</span>
          </button>

          {/* 2. Continue with Telegram (Native for AI agents & bots) */}
          <button
            type="button"
            onClick={handleTelegramLoginClick}
            disabled={isAnyLoading}
            className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--pbn-border)] bg-[var(--pbn-surface)] px-4 py-3 text-sm font-semibold text-[var(--pbn-text)] transition-all hover:bg-[var(--pbn-surface-hover)] hover:border-[var(--pbn-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 active:scale-[0.99] disabled:opacity-50"
          >
            {telegramLoading ? <Loader2 className="h-5 w-5 animate-spin text-[var(--pbn-accent)]" /> : <TelegramIcon />}
            <span>Continue with Telegram</span>
          </button>

          {/* 3. Connect Wallet */}
          {isPrivyConfigured ? (
            <PrivyButtonInner
              onAuthenticated={(u, t, r) => {
                setAuth(u, t, r);
                navigate('/onboarding');
              }}
              onError={(msg) => setErrorMessage(msg)}
              loading={walletLoading}
              setLoading={setWalletLoading}
            />
          ) : (
            <button
              type="button"
              onClick={handleDirectWalletAuth}
              disabled={isAnyLoading}
              className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--pbn-border)] bg-[var(--pbn-surface)] px-4 py-3 text-sm font-semibold text-[var(--pbn-text)] transition-all hover:bg-[var(--pbn-surface-hover)] hover:border-[var(--pbn-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 active:scale-[0.99] disabled:opacity-50"
            >
              {walletLoading ? <Loader2 className="h-5 w-5 animate-spin text-[var(--pbn-accent)]" /> : <WalletIcon />}
              <span>Connect Wallet</span>
            </button>
          )}

          {/* 4. Continue with Email */}
          <div className="pt-2 border-t border-[var(--pbn-border)]">
            {/* Step Selector Tabs */}
            <div className="flex rounded-xl bg-[#0a1118] p-1 border border-[var(--pbn-border)] mb-4">
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setErrorMessage('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  !codeSent
                    ? 'bg-[var(--pbn-surface)] text-[var(--pbn-accent)] shadow border border-[var(--pbn-border)]'
                    : 'text-[#8a9aa8] hover:text-white'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>1. Request Code</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodeSent(true);
                  setErrorMessage('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  codeSent
                    ? 'bg-[var(--pbn-surface)] text-[var(--pbn-accent)] shadow border border-[var(--pbn-border)]'
                    : 'text-[#8a9aa8] hover:text-white'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>2. Enter 6-Digit Code</span>
              </button>
            </div>

            {!codeSent ? (
              <form onSubmit={handleSendCode} className="space-y-3">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-[#8a9aa8] mb-1.5">
                    Your Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoFocus
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailLoading}
                    className="w-full min-h-[48px] rounded-xl border border-[var(--pbn-border)] bg-[#0a1118] px-4 py-3 text-sm text-[#e8eef4] placeholder-[#5a6a78] focus:border-[var(--pbn-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/30 disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={emailLoading || !email}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pbn-accent)] px-4 py-3 text-sm font-semibold text-[#0a1118] transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)] active:scale-[0.99] disabled:opacity-50"
                >
                  {emailLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>Send Magic Code</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCodeSent(true);
                      setErrorMessage('');
                    }}
                    className="text-xs text-[var(--pbn-accent)] hover:underline transition-colors font-medium"
                  >
                    Already have a 6-digit code in your email? Click to enter it →
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="login-email-verify" className="block text-xs text-[#8a9aa8]">
                    Email address
                  </label>
                  <input
                    id="login-email-verify"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailLoading}
                    className="w-full min-h-[44px] rounded-xl border border-[var(--pbn-border)] bg-[#0a1118] px-4 py-2.5 text-sm text-[#e8eef4] placeholder-[#5a6a78] focus:border-[var(--pbn-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/30 disabled:opacity-50"
                  />
                  {email && (
                    <p className="text-[11px] text-[#8a9aa8]">
                      Enter the 6-digit code sent to <span className="text-[#e8eef4] font-semibold">{email}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="login-code" className="block text-xs font-semibold text-[var(--pbn-accent)] mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="login-code"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    maxLength={6}
                    placeholder="286715"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={emailLoading}
                    className="w-full min-h-[52px] rounded-xl border-2 border-[var(--pbn-accent)] bg-[#0a1118] px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] font-bold text-[#e8eef4] placeholder-[#3a4a58] focus:border-[var(--pbn-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--pbn-accent)]/30 disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={emailLoading || code.trim().length !== 6 || !email}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pbn-accent)] px-4 py-3 text-sm font-bold text-[#0a1118] transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)] active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-[var(--pbn-accent)]/20"
                >
                  {emailLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>Verify Code & Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <div className="flex justify-between items-center text-xs text-[#8a9aa8] pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => setCodeSent(false)}
                    className="hover:text-[var(--pbn-accent)] underline transition-colors"
                  >
                    ← Request new code
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendCode()}
                    disabled={emailLoading || !email}
                    className="text-[var(--pbn-accent)] hover:underline transition-colors font-medium disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}
          </div>
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

