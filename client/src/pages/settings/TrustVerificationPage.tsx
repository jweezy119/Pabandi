import React, { useMemo } from 'react';
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
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import DashboardLayout from '../../components/DashboardLayout';

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
              Verification scoring is evaluated via verified webhooks.
            </p>
          </div>
        )}

        {/* Legal Footnote for Guardrail 5 */}
        <div className="mt-12 pt-6 border-t border-[rgba(191,179,163,0.3)] text-xs text-[var(--soft-stone)] leading-relaxed">
          <p>
            * Privy provides programmatic key-management infrastructure. Cryptographic keys and embedded wallets are generated
            and held in isolated security enclaves (TEEs) and are never accessible to Pabandi servers without user authorization.
            Trust Bands are determined strictly via server-side verification webhooks.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function TrustVerificationActive() {
  const privyState = usePrivy();
  const { user, authenticated, login } = privyState;

  // In Privy React SDK, link & unlink methods are exposed on usePrivy
  const privyMethods = privyState as unknown as Record<string, LinkFn | undefined>;

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
            <span>Criteria met! Your backend Trust Band A status will be registered automatically via webhook.</span>
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
    </div>
  );
}
