import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  Shield,
  Key,
  Smartphone,
  Mail,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Info,
  Wallet,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  FileCheck2,
  EyeOff,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import DashboardLayout from '../../components/DashboardLayout';
import { privyTrustService } from '../../services/api';
import { getAuthToken } from '../../utils/authToken';
import { EmbeddedCheckoutModal, type DepositPrompt } from '../../components/EmbeddedCheckoutModal';

type LinkFn = (options?: unknown) => Promise<void> | void;
type UnlinkFn = (identifier?: string) => Promise<void> | void;

const GitHubIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const TwitterIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const AppleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.61 1.34-.56.64-.97 1.7-.85 2.73 1 .08 2.02-.52 2.54-1.22z" />
  </svg>
);

interface ProviderConfig {
  id: string;
  type: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  isPhishingResistant?: boolean;
  isOAuth?: boolean;
  linkFn: LinkFn;
  unlinkFn?: UnlinkFn;
}

export default function TrustVerificationPage() {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;
  const isConfigured = Boolean(appId && typeof appId === 'string' && appId.length === 25);

  return (
    <DashboardLayout>
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-[var(--terracotta)]/15 text-[var(--terracotta)]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Trust & Identity Verification</h1>
              <p className="text-sm text-[var(--soft-stone)]">
                Link verified identity credentials to upgrade your Pabandi Trust Band and eliminate booking deposits.
              </p>
            </div>
          </div>
        </div>

        {/* Security Alert: Account access is wallet access */}
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[var(--warm-ink)] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-amber-900">
              Account access is wallet access.
            </p>
            <p className="text-amber-800">
              Your linked credentials directly control your Pabandi programmatic key infrastructure. We strongly advise
              registering a <strong>Passkey</strong> or <strong>verified phone (MFA)</strong> before linking public social accounts.
            </p>
          </div>
        </div>

        {isConfigured ? (
          <TrustVerificationActive />
        ) : (
          <div className="p-8 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] text-center">
            <Info className="w-10 h-10 text-[var(--soft-stone)] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[var(--warm-ink)] mb-1">
              Privy Infrastructure Initializing
            </h3>
            <p className="text-sm text-[var(--soft-stone)] max-w-md mx-auto">
              Privy programmatic key-management infrastructure is awaiting production App ID configuration.
              Verification scoring is evaluated server-side against your Privy identity.
            </p>
          </div>
        )}

        {/* Legal Footnote for Guardrail 5 */}
        <div className="mt-12 pt-6 border-t border-[rgba(191,179,163,0.3)] text-xs text-[var(--soft-stone)] leading-relaxed">
          <p>
            * Privy provides programmatic key-management infrastructure. Cryptographic keys and embedded wallets are generated
            and held in isolated security enclaves (TEEs) and are never accessible to Pabandi servers without user authorization.
            Trust Bands are determined strictly via server-side verification of your Privy identity.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface CounterfactualAction {
  actionId: string;
  title: string;
  description: string;
  providerToLink: string;
  estimatedScoreDelta: number;
  unlocksBand: 'A' | 'B' | 'C' | null;
  depositReductionSummary: string;
}

interface CounterfactualResult {
  currentBand: 'A' | 'B' | 'C' | 'D';
  currentScore: number;
  nextTargetBand: 'A' | 'B' | 'C' | null;
  pointsToNextBand: number;
  recommendedActions: CounterfactualAction[];
  summary: string;
}

interface SignedAttestationReceipt {
  version: string;
  modelId: string;
  modelHash: string;
  subjectDid: string;
  inputFeatureHash: string;
  predictedScore: number;
  trustBand: 'A' | 'B' | 'C' | 'D';
  shapVectorHash: string;
  nonce: string;
  timestamp: string;
  publicKeyHex: string;
  signature: string;
}

interface SdJwtBundle {
  minimalPresentation: string;
  sdJwtFull: string;
  expiresAt: string;
}

function TrustVerificationActive() {
  const privyState = usePrivy();
  const { user, authenticated, login, getAccessToken } = privyState;

  // In Privy React SDK, link & unlink methods are exposed on usePrivy
  const privyMethods = privyState as unknown as Record<string, LinkFn | undefined>;

  // ── Pull-based trust-band sync ────────────────────────────────────────────
  // Privy webhooks are Enterprise-only, so the server is never pushed events.
  // We hand it our Privy access token instead; it verifies the token, re-reads
  // our identity from Privy and records the band. Runs once on mount, and
  // again whenever an identity is linked.
  const [sync, setSync] = useState<{
    status: 'idle' | 'syncing' | 'synced' | 'error';
    band?: 'A' | 'B' | 'C' | 'D';
    score?: number;
    reason?: string;
    message?: string;
    bayesianScore?: {
      blendedScore: number;
      coldStartPriorWeight: number;
      featureAttributions: Record<string, number>;
    };
    counterfactual?: CounterfactualResult;
    attestation?: SignedAttestationReceipt;
    sdJwt?: SdJwtBundle;
  }>({ status: 'idle' });
  const [attestationVerified, setAttestationVerified] = useState<boolean | null>(null);
  const [sdJwtVerifiedClaims, setSdJwtVerifiedClaims] = useState<Record<string, unknown> | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedSdJwt, setCopiedSdJwt] = useState(false);
  const [mcpAgentKey, setMcpAgentKey] = useState<{
    apiKey: string;
    starterCreditUsdc: number;
    mcpEndpoint: string;
    mcpConfig: Record<string, unknown>;
  } | null>(null);
  const [generatingMcpKey, setGeneratingMcpKey] = useState(false);
  const [copiedMcpConfig, setCopiedMcpConfig] = useState(false);
  const [mcpTestLoading, setMcpTestLoading] = useState(false);
  const [mcpTestOutput, setMcpTestOutput] = useState<string | null>(null);
  const [agentWalletName, setAgentWalletName] = useState('Pabandi Concierge Agent');
  const [maxPerTxUsdc, setMaxPerTxUsdc] = useState<number>(250);
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [provisioningWallet, setProvisioningWallet] = useState(false);
  const [provisionedWallet, setProvisionedWallet] = useState<Record<string, unknown> | null>(null);
  const [mcpTopupPrompt, setMcpTopupPrompt] = useState<DepositPrompt | null>(null);
  const [mcpTopupAmount, setMcpTopupAmount] = useState<number>(25);
  const autoSyncStarted = useRef(false);

  const runSync = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      setSync((prev) => ({ ...prev, status: 'syncing', message: undefined }));
      setAttestationVerified(null);
      setSdJwtVerifiedClaims(null);

      try {
        if (!getAuthToken()) {
          setSync({ status: 'idle', message: 'Sign in to Pabandi to record your trust band.' });
          if (!silent) toast.error('Sign in to Pabandi first, then retry.');
          return;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
          setSync({
            status: 'idle',
            message: 'Your Privy session is not active. Sign in again, then retry.',
          });
          if (!silent) toast.error('Your Privy session is not active. Sign in again.');
          return;
        }

        const response = await privyTrustService.sync(accessToken);
        const data = response.data as {
          band: 'A' | 'B' | 'C' | 'D';
          score: number;
          reason: string;
          bayesianScore?: {
            blendedScore: number;
            coldStartPriorWeight: number;
            featureAttributions: Record<string, number>;
          };
          counterfactual?: CounterfactualResult;
          attestation?: SignedAttestationReceipt;
          sdJwt?: SdJwtBundle;
        };

        setSync({
          status: 'synced',
          band: data.band,
          score: data.score,
          reason: data.reason,
          bayesianScore: data.bayesianScore,
          counterfactual: data.counterfactual,
          attestation: data.attestation,
          sdJwt: data.sdJwt,
        });
        if (!silent) toast.success(`Trust Band ${data.band} recorded (score ${data.score})`);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        const message = e?.response?.data?.error || e?.message || 'Could not reach the server.';
        setSync({ status: 'error', message });
        if (!silent) toast.error(message);
      }
    },
    [getAccessToken]
  );

  // One automatic sync per mount so the recorded band is never stale after the
  // user links something new elsewhere in the app.
  useEffect(() => {
    if (!authenticated || autoSyncStarted.current) return;
    autoSyncStarted.current = true;
    void runSync({ silent: true });
  }, [authenticated, runSync]);

  const linkedAccounts = useMemo(() => {
    return user?.linkedAccounts || [];
  }, [user]);

  const totalLinked = linkedAccounts.length;
  const isOnlyAccount = totalLinked <= 1;

  // Determine which categories are satisfied
  const hasPhishingResistant = linkedAccounts.some((acc) => {
    const t = (acc.type || '').toLowerCase();
    return t === 'passkey' || t === 'phone';
  }) || Boolean(user?.mfaMethods?.length);

  const hasOAuth = linkedAccounts.some((acc) => {
    const t = (acc.type || '').toLowerCase();
    return t.includes('oauth') || ['google', 'apple', 'github', 'twitter', 'discord', 'linkedin'].includes(t);
  });

  // Safe wrapper for linking
  const handleLink = async (name: string, fn?: LinkFn) => {
    if (!fn) {
      toast.error(`Linking for ${name} is coming soon or handled via account settings.`);
      return;
    }
    try {
      await fn();
      toast.success(`Identity link initiated for ${name}`);
      // Re-score immediately so the recorded band reflects the new link.
      void runSync({ silent: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already linked')) {
        toast.error(`${name} is already linked to another account.`);
      } else if (msg !== 'User exited link flow') {
        toast.error(`Could not link ${name}: ${msg || 'Cancelled'}`);
      }
    }
  };

  // Safe wrapper for unlinking
  const handleUnlink = async (name: string, unlinkFn?: UnlinkFn) => {
    if (isOnlyAccount) {
      toast.error('Cannot unlink your only authentication method. Add another method first.');
      return;
    }
    if (!unlinkFn) {
      toast.error(`Unlinking is not directly supported for ${name} from this screen.`);
      return;
    }
    try {
      await unlinkFn();
      toast.success(`Unlinked ${name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not unlink ${name}: ${msg || 'Failed'}`);
    }
  };

  // Check if account of type exists
  const getLinked = (typePrefix: string) => {
    return linkedAccounts.find((a) => (a.type || '').toLowerCase().includes(typePrefix.toLowerCase()));
  };

  const getAccountDetail = (account?: { type: string; [key: string]: unknown }) => {
    if (!account) return null;
    const strOrNull = (val: unknown) => (typeof val === 'string' ? val : null);
    return (
      strOrNull(account.email) ||
      strOrNull(account.address) ||
      strOrNull(account.phoneNumber) ||
      strOrNull(account.username) ||
      strOrNull(account.subject) ||
      'Connected'
    );
  };

  const providers: ProviderConfig[] = [
    {
      id: 'passkey',
      type: 'passkey',
      name: 'Passkey (Biometric / Hardware Key)',
      icon: Key,
      isPhishingResistant: true,
      linkFn: privyMethods.linkPasskey || privyMethods.linkPhone || (() => {}),
      unlinkFn: privyMethods.unlinkPasskey,
    },
    {
      id: 'phone',
      type: 'phone',
      name: 'Verified Phone (SMS OTP)',
      icon: Smartphone,
      isPhishingResistant: true,
      linkFn: privyMethods.linkPhone || (() => {}),
      unlinkFn: privyMethods.unlinkPhone,
    },
    {
      id: 'google',
      type: 'google',
      name: 'Google Identity',
      icon: Globe,
      isOAuth: true,
      linkFn: privyMethods.linkGoogle || (() => {}),
      unlinkFn: privyMethods.unlinkGoogle,
    },
    {
      id: 'apple',
      type: 'apple',
      name: 'Apple ID',
      icon: AppleIcon,
      isOAuth: true,
      linkFn: privyMethods.linkApple || (() => {}),
      unlinkFn: privyMethods.unlinkApple,
    },
    {
      id: 'github',
      type: 'github',
      name: 'GitHub',
      icon: GitHubIcon,
      isOAuth: true,
      linkFn: privyMethods.linkGithub || (() => {}),
      unlinkFn: privyMethods.unlinkGithub,
    },
    {
      id: 'twitter',
      type: 'twitter',
      name: 'X (Twitter)',
      icon: TwitterIcon,
      isOAuth: true,
      linkFn: privyMethods.linkTwitter || (() => {}),
      unlinkFn: privyMethods.unlinkTwitter,
    },
    {
      id: 'discord',
      type: 'discord',
      name: 'Discord',
      icon: Globe,
      isOAuth: true,
      linkFn: privyMethods.linkDiscord || (() => {}),
      unlinkFn: privyMethods.unlinkDiscord,
    },
    {
      id: 'linkedin',
      type: 'linkedin',
      name: 'LinkedIn',
      icon: Globe,
      isOAuth: true,
      linkFn: privyMethods.linkLinkedIn || (() => {}),
      unlinkFn: privyMethods.unlinkLinkedIn,
    },
    {
      id: 'wallet',
      type: 'wallet',
      name: 'Solana / External Wallet',
      icon: Wallet,
      linkFn: privyMethods.linkWallet || (() => {}),
      unlinkFn: privyMethods.unlinkWallet,
    },
    {
      id: 'email',
      type: 'email',
      name: 'Email Address',
      icon: Mail,
      linkFn: privyMethods.linkEmail || (() => {}),
      unlinkFn: privyMethods.unlinkEmail,
    },
  ];

  if (!authenticated) {
    return (
      <div className="p-8 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] text-center">
        <Lock className="w-10 h-10 text-[var(--soft-stone)] mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-[var(--warm-ink)] mb-2">Sign In to Manage Verifications</h3>
        <p className="text-sm text-[var(--soft-stone)] max-w-md mx-auto mb-6">
          Authenticate using your primary identity or wallet to view and manage linked accounts.
        </p>
        <button
          onClick={() => login()}
          className="px-6 py-2.5 rounded-xl font-medium bg-[var(--clay)] text-white hover:opacity-90 transition-opacity"
        >
          Sign In with Privy
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Server-recorded trust band — the pull-based sync result */}
      <div className="p-6 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`p-2.5 rounded-xl ${
                sync.status === 'synced' && sync.band
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : 'bg-[var(--terracotta)]/15 text-[var(--terracotta)]'
              }`}
            >
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">
                Recorded Trust Band
              </p>
              {sync.status === 'synced' && sync.band ? (
                <>
                  <p className="text-xl font-bold text-[var(--warm-ink)]">
                    Band {sync.band} <span className="text-sm font-medium">· score {sync.score}</span>
                  </p>
                  <p className="text-xs text-[var(--soft-stone)]">{sync.reason}</p>
                </>
              ) : sync.status === 'syncing' ? (
                <p className="text-sm text-[var(--soft-stone)]">Evaluating your identity…</p>
              ) : sync.status === 'error' ? (
                <p className="text-sm text-red-700">{sync.message}</p>
              ) : (
                <p className="text-sm text-[var(--soft-stone)]">
                  {sync.message || 'Not evaluated yet for this session.'}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => runSync()}
            disabled={sync.status === 'syncing'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--clay)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${sync.status === 'syncing' ? 'animate-spin' : ''}`} />
            {sync.status === 'syncing' ? 'Evaluating…' : 'Re-evaluate'}
          </button>
        </div>

        <p className="mt-4 text-xs text-[var(--soft-stone)] leading-relaxed">
          Your band is computed on our server by re-reading your Privy identity — linked accounts
          and MFA — and is stored against your Pabandi profile. Privy webhooks are unavailable on
          our plan, so scoring happens here instead of in the background.
        </p>
      </div>

      {/* Trust Band A Roadmap Box */}
      <div className="p-6 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-[var(--terracotta)]/20 text-[var(--terracotta)]">
              Target: Trust Band A (Zero Deposit)
            </span>
          </div>
          <span className="text-sm font-medium text-[var(--warm-ink)]">
            {totalLinked} of 4 minimum links
          </span>
        </div>

        <p className="text-sm text-[var(--warm-ink)] mb-4 leading-relaxed">
          Pabandi waives booking deposits entirely for users in <strong>Trust Band A</strong>. To qualify, your profile
          must satisfy:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            totalLinked >= 4
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900'
              : 'bg-[var(--cream)] border-[rgba(191,179,163,0.4)] text-[var(--soft-stone)]'
          }`}>
            <CheckCircle2 className={`w-4 h-4 ${totalLinked >= 4 ? 'text-emerald-600' : 'text-stone-400'}`} />
            <span>At least <strong>4 verified links</strong> ({totalLinked}/4 active)</span>
          </div>

          <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            hasPhishingResistant
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900'
              : 'bg-[var(--cream)] border-[rgba(191,179,163,0.4)] text-[var(--soft-stone)]'
          }`}>
            <CheckCircle2 className={`w-4 h-4 ${hasPhishingResistant ? 'text-emerald-600' : 'text-stone-400'}`} />
            <span>At least 1 <strong>Passkey</strong> or <strong>Verified Phone</strong></span>
          </div>
        </div>

        {totalLinked >= 4 && hasPhishingResistant ? (
          <div className="mt-4 p-3 rounded-xl bg-emerald-600/10 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {sync.status === 'synced' && sync.band === 'A'
                ? 'Criteria met and recorded server-side as Trust Band A.'
                : 'Criteria met! Use Re-evaluate above to record Trust Band A with the server.'}
            </span>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-xl bg-[var(--cream)] text-[var(--soft-stone)] text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--terracotta)] shrink-0" />
            <span>
              {!hasPhishingResistant
                ? 'Action needed: Link a Passkey or Phone number below to satisfy the phishing-resistant requirement.'
                : `Action needed: Link ${4 - totalLinked} more identity provider(s) to reach Band A.`}
            </span>
          </div>
        )}
      </div>

      {/* Year-0 Piece 1: Counterfactual Recourse & Bayesian Cold-Start Breakdown */}
      {sync.status === 'synced' && sync.counterfactual && (
        <div className="p-6 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--clay)]" />
              <h2 className="text-base font-bold text-[var(--warm-ink)]">
                Counterfactual Recourse &amp; Next Best Actions
              </h2>
            </div>
            {sync.bayesianScore && (
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] text-[var(--soft-stone)]">
                Bayesian Prior α={(sync.bayesianScore.coldStartPriorWeight * 100).toFixed(0)}% · Blended:{' '}
                <strong className="text-[var(--warm-ink)]">{sync.bayesianScore.blendedScore}</strong>
              </span>
            )}
          </div>

          <p className="text-xs text-[var(--warm-ink)] leading-relaxed">{sync.counterfactual.summary}</p>

          {sync.counterfactual.recommendedActions.length > 0 && (
            <div className="space-y-2.5">
              {sync.counterfactual.recommendedActions.map((rec) => {
                const matchingProvider = providers.find((p) =>
                  rec.providerToLink.toLowerCase().includes(p.id.toLowerCase())
                );
                return (
                  <div
                    key={rec.actionId}
                    className="p-3.5 rounded-xl bg-[var(--cream)] border border-[rgba(191,179,163,0.35)] flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--warm-ink)]">{rec.title}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700">
                          +{rec.estimatedScoreDelta} pts
                        </span>
                        {rec.unlocksBand && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[var(--clay)]/15 text-[var(--clay)]">
                            Unlocks Band {rec.unlocksBand}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--soft-stone)]">{rec.description}</p>
                      <p className="text-[11px] font-medium text-[var(--clay)]">{rec.depositReductionSummary}</p>
                    </div>

                    {matchingProvider && (
                      <button
                        type="button"
                        onClick={() => handleLink(matchingProvider.name, matchingProvider.linkFn)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--clay)] text-white hover:opacity-90 transition-opacity shrink-0"
                      >
                        Connect {matchingProvider.name.split(' ')[0]}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Year-0 Piece 2 & 3: Ed25519 Signed Attestation Receipt + W3C SD-JWT Selective Disclosure */}
      {sync.status === 'synced' && (sync.attestation || sync.sdJwt) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sync.attestation && (
            <div className="p-5 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-emerald-700" />
                    <h3 className="text-sm font-bold text-[var(--warm-ink)]">
                      Ed25519 Signed Score Receipt
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-800">
                    Tier 2 Attested
                  </span>
                </div>
                <p className="text-xs text-[var(--soft-stone)] leading-relaxed">
                  Cryptographically binds your score ({sync.attestation.predictedScore}), Trust Band (
                  {sync.attestation.trustBand}), and SHAP attribution vector hash to model{' '}
                  <code className="font-mono">{sync.attestation.modelId}</code>.
                </p>

                <div className="p-3 rounded-xl bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] font-mono text-[11px] text-[var(--warm-ink)] space-y-1">
                  <div className="truncate">Model Hash: {sync.attestation.modelHash}</div>
                  <div className="truncate">SHAP Hash: {sync.attestation.shapVectorHash}</div>
                  <div className="truncate">PubKey: {sync.attestation.publicKeyHex}</div>
                  <div className="truncate">Sig: {sync.attestation.signature}</div>
                </div>

                {attestationVerified === true && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Ed25519 signature &amp; model digest verified server-side.</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!sync.attestation) return;
                    try {
                      const res = await privyTrustService.verifyAttestation(
                        sync.attestation as unknown as Record<string, unknown>
                      );
                      const valid = Boolean((res.data as { valid?: boolean })?.valid);
                      setAttestationVerified(valid);
                      if (valid) toast.success('Ed25519 attestation verified!');
                      else toast.error('Attestation verification failed');
                    } catch {
                      toast.error('Failed to verify attestation');
                    }
                  }}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-[var(--clay)] text-white hover:opacity-90 transition-opacity"
                >
                  Verify Signature
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!sync.attestation) return;
                    await navigator.clipboard.writeText(JSON.stringify(sync.attestation, null, 2));
                    setCopiedReceipt(true);
                    setTimeout(() => setCopiedReceipt(false), 2000);
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-semibold border border-[rgba(191,179,163,0.4)] bg-[var(--cream)] text-[var(--warm-ink)] flex items-center gap-1"
                >
                  {copiedReceipt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedReceipt ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
            </div>
          )}

          {sync.sdJwt && (
            <div className="p-5 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-5 h-5 text-[var(--clay)]" />
                    <h3 className="text-sm font-bold text-[var(--warm-ink)]">
                      Selective Disclosure (W3C VC / SD-JWT)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--clay)]/15 text-[var(--clay)]">
                    Tier 1 Privacy
                  </span>
                </div>
                <p className="text-xs text-[var(--soft-stone)] leading-relaxed">
                  Prove your Trust Band and deposit eligibility to merchants or AI agents using salted SHA-256
                  disclosures without revealing your email, phone, wallet address, or exact score.
                </p>

                <div className="p-3 rounded-xl bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] text-[11px] space-y-1">
                  <div className="text-emerald-800 font-medium">
                    ✓ Disclosed: <code>trust_band</code>, <code>deposit_basis_points</code>,{' '}
                    <code>zero_deposit_eligible</code>
                  </div>
                  <div className="text-[var(--soft-stone)]">
                    🔒 Blinded (Salted SHA-256): <code>exact_score</code>, <code>total_linked_accounts</code>, raw PII
                  </div>
                </div>

                {sdJwtVerifiedClaims && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-mono">
                    ✓ Verified Claims: {JSON.stringify(sdJwtVerifiedClaims)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!sync.sdJwt) return;
                    try {
                      const res = await privyTrustService.verifySdJwt(sync.sdJwt.minimalPresentation);
                      const payload = res.data as {
                        valid?: boolean;
                        disclosedClaims?: Record<string, unknown>;
                      };
                      if (payload.valid && payload.disclosedClaims) {
                        setSdJwtVerifiedClaims(payload.disclosedClaims);
                        toast.success('SD-JWT selective disclosure verified!');
                      } else {
                        toast.error('SD-JWT verification failed');
                      }
                    } catch {
                      toast.error('Failed to verify SD-JWT');
                    }
                  }}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-[var(--clay)] text-white hover:opacity-90 transition-opacity"
                >
                  Verify SD-JWT
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!sync.sdJwt) return;
                    await navigator.clipboard.writeText(sync.sdJwt.minimalPresentation);
                    setCopiedSdJwt(true);
                    setTimeout(() => setCopiedSdJwt(false), 2000);
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-semibold border border-[rgba(191,179,163,0.4)] bg-[var(--cream)] text-[var(--warm-ink)] flex items-center gap-1"
                >
                  {copiedSdJwt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSdJwt ? 'Copied' : 'Copy SD-JWT'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase 3 — Connect Your AI Agent (MCP) & Privy TEE Policy-Enforced Agent Wallet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Panel 1: 1-Click MCP Agent Connect */}
        <div className="p-6 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[var(--clay)]" />
                <h3 className="text-sm font-bold text-[var(--warm-ink)]">
                  Connect AI Agent (Claude / Cursor / MCP)
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-800 font-semibold">
                Streamable HTTP MCP
              </span>
            </div>

            <p className="text-xs text-[var(--soft-stone)] leading-relaxed">
              Give Claude Desktop, Cursor, Windsurf, or LangChain direct access to Pabandi discovery, SD-JWT verification,
              and Chicago contractor escrow booking. Discovery & verification calls are free; minting an agent key grants{' '}
              <strong>$0.25 USDC (250 paid calls)</strong> starter x402 credit.
            </p>

            <div className="p-3 rounded-xl bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] font-mono text-[11px] space-y-1 overflow-x-auto">
              <div className="text-[var(--soft-stone)]">// Add to claude_desktop_config.json or .cursor/mcp.json</div>
              <pre className="text-[var(--warm-ink)] whitespace-pre-wrap break-all">
                {JSON.stringify(
                  mcpAgentKey?.mcpConfig || {
                    mcpServers: {
                      pabandi: {
                        url: 'https://pabandi.onrender.com/mcp',
                        headers: {
                          Authorization: `Bearer ${mcpAgentKey?.apiKey || 'YOUR_AGENT_API_KEY'}`,
                        },
                      },
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            {mcpTestOutput && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-900 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {mcpTestOutput}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={generatingMcpKey}
              onClick={async () => {
                setGeneratingMcpKey(true);
                try {
                  const res = await privyTrustService.generateMcpAgentKey();
                  const data = (res.data as { data?: Record<string, unknown> })?.data;
                  if (data?.apiKey) {
                    setMcpAgentKey({
                      apiKey: String(data.apiKey),
                      starterCreditUsdc: Number(data.starterCreditUsdc ?? 0.25),
                      mcpEndpoint: String(data.mcpEndpoint || 'https://pabandi.onrender.com/mcp'),
                      mcpConfig: (data.mcpConfig as Record<string, unknown>) || {},
                    });
                    toast.success('Minted MCP Agent Key + $0.25 starter x402 credit!');
                  }
                } catch {
                  toast.error('Sign in to Pabandi account to mint a dedicated M2M key, or use the public MCP endpoint.');
                } finally {
                  setGeneratingMcpKey(false);
                }
              }}
              className="py-2 px-3 rounded-xl text-xs font-semibold bg-[var(--clay)] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {generatingMcpKey ? 'Minting Key…' : 'Mint Agent Key (+$0.25 Credit)'}
            </button>

            <button
              type="button"
              disabled={mcpTestLoading}
              onClick={async () => {
                setMcpTestLoading(true);
                try {
                  const res = await privyTrustService.testMcpToolCall(
                    'pabandi_search_services',
                    { city: 'Chicago', category: 'ROOFING' },
                    mcpAgentKey?.apiKey
                  );
                  const text =
                    res.data?.result?.content?.[0]?.text || JSON.stringify(res.data, null, 2);
                  setMcpTestOutput(text);
                  toast.success('Live MCP tool call succeeded!');
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : 'MCP test call failed');
                } finally {
                  setMcpTestLoading(false);
                }
              }}
              className="py-2 px-3 rounded-xl text-xs font-semibold border border-[rgba(191,179,163,0.4)] bg-[var(--cream)] text-[var(--warm-ink)] hover:border-[var(--clay)] transition-colors"
            >
              {mcpTestLoading ? 'Calling /mcp…' : 'Test Live MCP Call (Chicago Roofers)'}
            </button>

            <button
              type="button"
              onClick={async () => {
                const cfg = JSON.stringify(
                  mcpAgentKey?.mcpConfig || {
                    mcpServers: {
                      pabandi: {
                        url: 'https://pabandi.onrender.com/mcp',
                        headers: {
                          Authorization: `Bearer ${mcpAgentKey?.apiKey || 'YOUR_AGENT_API_KEY'}`,
                        },
                      },
                    },
                  },
                  null,
                  2
                );
                await navigator.clipboard.writeText(cfg);
                setCopiedMcpConfig(true);
                setTimeout(() => setCopiedMcpConfig(false), 2000);
              }}
              className="py-2 px-3 rounded-xl text-xs font-semibold border border-[rgba(191,179,163,0.4)] bg-[var(--cream)] text-[var(--warm-ink)] flex items-center gap-1"
            >
              {copiedMcpConfig ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedMcpConfig ? 'Copied' : 'Copy Config'}
            </button>
          </div>

          {/* Self-Serve MCP Prepaid Balance Top-Up */}
          <div className="pt-2 border-t border-[rgba(191,179,163,0.3)] flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[var(--soft-stone)]">
              Top Up x402 MCP Prepaid Credit:
            </span>
            <div className="flex items-center gap-1.5">
              {[10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={async () => {
                    try {
                      setMcpTopupAmount(amt);
                      const res = await privyTrustService.quoteMcpTopup(amt, mcpAgentKey?.apiKey);
                      const quote = res.data?.data;
                      if (!quote?.checkoutUrl) throw new Error('Could not generate top-up quote');
                      setMcpTopupPrompt({
                        title: `Top Up $${amt} USDC MCP Prepaid Credit`,
                        checkoutUrl: quote.checkoutUrl,
                        description: quote.description,
                        amount: amt,
                        currency: 'USDC',
                        referenceId: quote.referenceId,
                      });
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : 'Could not quote MCP top-up');
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--warm-ink)] text-[var(--cream)] hover:opacity-90 transition-opacity"
                >
                  +${amt} USDC
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 2: Phase 3 Privy TEE Policy-Enforced Agent Wallet */}
        <div className="p-6 rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[var(--clay)]" />
                <h3 className="text-sm font-bold text-[var(--warm-ink)]">
                  Phase 3: Privy TEE Policy Agent Wallet
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-800 font-semibold">
                TEE policy_ids
              </span>
            </div>

            <p className="text-xs text-[var(--soft-stone)] leading-relaxed">
              Delegate an autonomous Solana USDC escrow budget to your AI agent. Spending caps, SPL token mint restrictions,
              and expiry timestamps are attached via Privy <code>policy_ids</code> and evaluated inside Privy&apos;s TEE
              programmatic key-management infrastructure—never enforced in application code alone.
            </p>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--soft-stone)] mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentWalletName}
                  onChange={(e) => setAgentWalletName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--soft-stone)] mb-1">
                  Max / Tx (USDC)
                </label>
                <select
                  value={maxPerTxUsdc}
                  onChange={(e) => setMaxPerTxUsdc(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)]"
                >
                  <option value={100}>$100 USDC</option>
                  <option value={250}>$250 USDC</option>
                  <option value={500}>$500 USDC</option>
                  <option value={1000}>$1,000 USDC</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--soft-stone)] mb-1">
                  Time Window
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)]"
                >
                  <option value={24}>24 Hours</option>
                  <option value={72}>72 Hours</option>
                  <option value={168}>7 Days</option>
                </select>
              </div>
            </div>

            {provisionedWallet && (
              <div className="p-3 rounded-xl bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] font-mono text-[11px] space-y-1 overflow-x-auto max-h-44">
                <div className="text-emerald-800 font-semibold">
                  ✓ Policy ID: {String(provisionedWallet.policyId)} · Wallet ID: {String(provisionedWallet.agentWalletId)}
                </div>
                <div className="text-[var(--soft-stone)]">
                  Vault Allowlist: {String(provisionedWallet.allowlistedEscrowVault)}
                </div>
                <pre className="text-[10px] text-[var(--warm-ink)] whitespace-pre-wrap">
                  {JSON.stringify(provisionedWallet.policyPayload, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={provisioningWallet}
              onClick={async () => {
                setProvisioningWallet(true);
                try {
                  const res = await privyTrustService.provisionAgentWallet({
                    agentName: agentWalletName,
                    maxPerTransactionUsdc: maxPerTxUsdc,
                    dailyBudgetUsdc: maxPerTxUsdc * 2,
                    expiresInHours,
                  });
                  const wallet = (res.data as { wallet?: Record<string, unknown> })?.wallet;
                  if (wallet) {
                    setProvisionedWallet(wallet);
                    toast.success(`Provisioned Privy TEE Policy (${String(wallet.policyId)})!`);
                  }
                } catch {
                  toast.error('Sign in to your Pabandi account first to provision a Privy TEE Policy Agent Wallet.');
                } finally {
                  setProvisioningWallet(false);
                }
              }}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-[var(--clay)] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {provisioningWallet ? 'Provisioning TEE Policy…' : 'Provision Privy TEE Policy Wallet'}
            </button>
          </div>
        </div>
      </div>

      {/* Linked Accounts List */}
      <div className="rounded-2xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-1">Identity & Authentication Methods</h2>
        <p className="text-xs text-[var(--soft-stone)] mb-6">
          Connect your accounts below. At least one method must always remain linked to maintain account access.
        </p>

        <div className="space-y-3">
          {providers.map((provider) => {
            const linkedAccount = getLinked(provider.type);
            const isLinked = Boolean(linkedAccount);
            const detail = getAccountDetail(linkedAccount);
            const Icon = provider.icon;

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 rounded-xl bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2 rounded-lg ${isLinked ? 'bg-emerald-500/10 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--warm-ink)]">{provider.name}</span>
                      {provider.isPhishingResistant && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700">
                          Phishing-Resistant
                        </span>
                      )}
                      {provider.isOAuth && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700">
                          OAuth
                        </span>
                      )}
                    </div>
                    {isLinked ? (
                      <p className="text-xs text-emerald-700 font-mono mt-0.5 truncate max-w-xs md:max-w-md">
                        Linked: {detail}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--soft-stone)] mt-0.5">Not connected</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isLinked ? (
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                      <button
                        onClick={() => handleUnlink(provider.name, provider.unlinkFn)}
                        disabled={isOnlyAccount}
                        title={isOnlyAccount ? 'Cannot unlink your only remaining sign-in method' : 'Unlink account'}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
                          isOnlyAccount
                            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            : 'bg-red-500/10 text-red-700 hover:bg-red-500/20'
                        }`}
                      >
                        Unlink
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleLink(provider.name, provider.linkFn)}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[var(--clay)] text-white hover:opacity-90 transition-opacity"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isOnlyAccount && (
          <p className="mt-4 text-xs text-amber-700 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
            ℹ️ The <strong>Unlink</strong> button is disabled on your active method because at least one authentication method must
            remain linked so you do not lose access to your account.
          </p>
        )}
      </div>

      <EmbeddedCheckoutModal
        prompt={mcpTopupPrompt}
        onClose={() => setMcpTopupPrompt(null)}
        onFunded={async (txHash, fromWallet) => {
          const currentPrompt = mcpTopupPrompt;
          setMcpTopupPrompt(null);
          try {
            const res = await privyTrustService.confirmMcpTopup({
              amountUsdc: mcpTopupAmount,
              txHash: txHash || `topup_${Date.now().toString(36)}`,
              apiKey: mcpAgentKey?.apiKey,
              fromWallet,
              referenceId: currentPrompt?.referenceId,
            });
            const newBal = res.data?.data?.newBalanceUsdc;
            if (mcpAgentKey && typeof newBal === 'number') {
              setMcpAgentKey({ ...mcpAgentKey, starterCreditUsdc: newBal });
            }
            toast.success(`Credited $${mcpTopupAmount} USDC to MCP prepaid balance!`);
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Mint an MCP Agent Key first to credit your balance.');
          }
        }}
      />
    </div>
  );
}
