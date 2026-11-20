/**
 * PersonalDashboardPage — the Personal (Consumer/Standard) dashboard at /me.
 *
 * Strict Warm Clay palette: every color comes from the tokens in
 * styles/warm-clay.css (var(--cream), var(--warm-ink), var(--clay)…). No
 * default Tailwind grays/blues/ambers anywhere.
 *
 * Data is REAL: one aggregate call to GET /api/v1/users/me/stats via
 * statsService, wrapped in React Query with a 30s refetch and immediate
 * invalidate on release (the Trust Sync loop).
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from 'react-query';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Lock,
  LockOpen,
  Sparkles,
  Camera,
  Coins,
  CheckCircle2,
  Circle,
  Trophy,
  X,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayBadge } from '../../components/primitives';
import { LiveNetworkWidget } from '../../components/live-network/LiveNetworkWidget';
import { AssistiveBanner } from '../../components/AssistiveBanner';
import ClayVaultLock from '../../components/clay/ClayVaultLock';
import { useAuthStore } from '../../store/authStore';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  statsService,
  type MeStats,
  type ActiveEscrowItem,
} from '../../services/statsService';

export default function PersonalDashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [showWelcomeBanner, setShowWelcomeBanner] = useState(
    () => searchParams.get('welcome') === '1'
  );
  const [questCollapsed, setQuestCollapsed] = useState(false);

  const dismissWelcome = () => {
    setShowWelcomeBanner(false);
    if (searchParams.has('welcome')) {
      const next = new URLSearchParams(searchParams);
      next.delete('welcome');
      setSearchParams(next, { replace: true });
    }
  };

  // Real aggregate data, polled every 30s (Trust Sync).
  const {
    data: stats,
    isLoading: loading,
  } = useQuery<MeStats>('meDashboardStats', statsService.me, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const [showProofModal, setShowProofModal] = useState<ActiveEscrowItem | null>(null);
  const [showVault, setShowVault] = useState(false);
  const [proofTaken, setProofTaken] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const escrows = stats?.activeEscrows.items ?? [];
  const score = stats?.trustScore.score;
  const tier = stats?.trustScore.tier ?? null;
  const yieldEarned = stats?.yieldEarned ?? null;
  const hasReleaseable = escrows.some((e) => e.canRelease);

  // Light gamification: endowed-progress Customer Quick-Start Quest
  const hasContactDetails = Boolean(user?.phone || user?.location);
  const hasBookedOrScored = escrows.length > 0 || (score != null && score > 0);
  const hasReleasedEscrow = yieldEarned != null && yieldEarned > 0;
  const questSteps = [
    {
      id: 'profile',
      label: 'Personal Profile Created',
      detail: 'Your Trust Passport & Personal Hub are live.',
      done: true,
      actionLabel: null as string | null,
      actionTo: null as string | null,
    },
    {
      id: 'contact',
      label: 'Add Phone or City for 1-Tap Bookings',
      detail: 'Auto-fills your contact info whenever you reserve a business.',
      done: hasContactDetails,
      actionLabel: 'Update Profile',
      actionTo: '/me/profile',
    },
    {
      id: 'first-booking',
      label: 'Book or Reserve Your First Business',
      detail: 'Browse verified local & remote pros with escrow protection.',
      done: hasBookedOrScored,
      actionLabel: 'Browse Businesses',
      actionTo: '/booking',
    },
    {
      id: 'first-release',
      label: 'Verify & Release Your First Escrow',
      detail: 'Unlocks your next Trust Tier & 50% yield rebate.',
      done: hasReleasedEscrow,
      actionLabel: 'View Escrows',
      actionTo: '#escrows',
    },
  ];
  const completedQuestCount = questSteps.filter((s) => s.done).length;
  const questProgressPct = Math.round((completedQuestCount / questSteps.length) * 100);
  const showQuickStartQuest = completedQuestCount < questSteps.length;

  const handleRelease = async (escrow: ActiveEscrowItem) => {
    setReleasing(true);
    try {
      await statsService.releaseEscrow(escrow.id);
      setShowProofModal(null);
      setProofTaken(false);
      setShowVault(true);
      await queryClient.invalidateQueries('meDashboardStats');
    } finally {
      setReleasing(false);
    }
  };

  const sectionTitle = 'font-headline text-lg font-bold tracking-tight text-[var(--warm-ink)]';

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] pb-[env(safe-area-inset-bottom)] text-[var(--warm-ink)] p-4">
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--warm-sand)] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-[var(--warm-sand)] rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-[var(--warm-sand)] rounded animate-pulse" />
            </div>
          </div>
          <div className="rounded-[var(--radius-card)] border border-[rgba(191,179,163,0.5)] bg-[var(--warm-sand)]/40 p-5 space-y-4">
            <div className="h-3 w-1/3 bg-[var(--warm-sand)] rounded animate-pulse" />
            <div className="h-10 w-1/2 rounded-full bg-[var(--warm-sand)] animate-pulse" />
            <div className="h-2.5 w-full rounded-full bg-[var(--warm-sand)] animate-pulse" />
            <div className="h-3 w-1/4 bg-[var(--warm-sand)] rounded animate-pulse" />
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--sage)]/40 bg-[var(--sage)]/10 p-5 space-y-4">
            <div className="h-3 w-1/2 bg-[var(--warm-sand)] rounded animate-pulse" />
            <div className="h-8 w-1/3 rounded-full bg-[var(--warm-sand)] animate-pulse" />
            <div className="h-3 w-1/3 bg-[var(--warm-sand)] rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[var(--radius-card)] border border-[rgba(191,179,163,0.5)] bg-[var(--warm-sand)]/40 p-5 space-y-3">
                <div className="flex gap-2">
                  <div className="h-3 w-1/3 bg-[var(--warm-sand)] rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-[var(--warm-sand)] rounded animate-pulse" />
                </div>
                <div className="h-8 w-1/2 rounded-full bg-[var(--warm-sand)] animate-pulse" />
                <div className="h-3 w-1/3 bg-[var(--warm-sand)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--cream)] pb-[env(safe-area-inset-bottom)] text-[var(--warm-ink)]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-6">
          {/* ── Greeting ─────────────────────────────────────────── */}
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sage)]/20 text-[var(--sage)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user?.firstName || 'there'}</h1>
              <p className="text-xs text-[var(--soft-stone)]">Your personal trust &amp; escrow hub</p>
            </div>
          </div>

          {/* ── Celebratory Welcome Banner (?welcome=1) ─────────── */}
          <AnimatePresence>
            {showWelcomeBanner && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                data-testid="welcome-banner"
                className="mb-6 relative rounded-[var(--radius-card)] border border-[var(--sage)]/45 bg-gradient-to-br from-[var(--sage)]/18 via-[var(--cream)] to-[var(--warm-sand)]/50 p-5 shadow-[var(--shadow-soft)]"
              >
                <button
                  type="button"
                  onClick={dismissWelcome}
                  aria-label="Dismiss welcome banner"
                  className="absolute right-3.5 top-3.5 p-1 rounded-full text-[var(--soft-stone)] hover:text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/60 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#4f6142]">
                      <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Personal Profile Unlocked</span>
                    </span>
                    <h2 className="font-headline text-lg sm:text-xl font-bold text-[var(--warm-ink)] mt-1">
                      Welcome to Pabandi, {user?.firstName && user.firstName !== 'User' ? user.firstName : 'friend'}!
                    </h2>
                    <p className="text-xs text-[#5a5348] mt-1">
                      Your standard personal profile &amp; Trust Passport are live. You&apos;re ready to book or reserve any verified business.
                    </p>
                  </div>
                  <Link
                    to="/booking"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white shrink-0 shadow-[var(--shadow-btn)] transition-all hover:opacity-95"
                    style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
                  >
                    <span>Explore &amp; Book a Business</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Customer Quick-Start Quest (Endowed Progress) ───── */}
          {showQuickStartQuest && (
            <div className="mb-6" data-testid="customer-quickstart-quest">
              <ClayCard className="border border-[rgba(191,179,163,0.45)] bg-white/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--clay)]/14 text-[var(--terracotta)] flex items-center justify-center shrink-0">
                      <Trophy className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-headline text-base font-bold text-[var(--warm-ink)]">
                        Quick-Start Progress
                      </h2>
                      <p className="text-xs text-[#6c6258]">
                        {completedQuestCount} of {questSteps.length} milestones complete · {questProgressPct}%
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuestCollapsed((v) => !v)}
                    aria-expanded={!questCollapsed}
                    className="text-xs font-semibold text-[var(--terracotta)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>{questCollapsed ? 'Show' : 'Hide'}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${questCollapsed ? '' : 'rotate-180'}`} />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--warm-sand)]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--clay)] to-[var(--sage)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${questProgressPct}%` }}
                    transition={{ type: 'spring', stiffness: 130, damping: 20 }}
                  />
                </div>

                {!questCollapsed && (
                  <ul className="mt-4 space-y-2.5">
                    {questSteps.map((q) => (
                      <li
                        key={q.id}
                        className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                          q.done
                            ? 'bg-[var(--sage)]/10 border-[var(--sage)]/25'
                            : 'bg-[var(--cream)]/60 border-[rgba(191,179,163,0.3)]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {q.done ? (
                            <CheckCircle2 className="h-4 w-4 text-[var(--sage)] shrink-0 mt-0.5" aria-hidden="true" />
                          ) : (
                            <Circle className="h-4 w-4 text-[var(--soft-stone)] shrink-0 mt-0.5" aria-hidden="true" />
                          )}
                          <div className="min-w-0">
                            <p className={`text-xs font-bold ${q.done ? 'text-[#4f6142] line-through' : 'text-[var(--warm-ink)]'}`}>
                              {q.label}
                            </p>
                            <p className="text-[11px] text-[#6c6258] truncate">{q.detail}</p>
                          </div>
                        </div>
                        {!q.done && q.actionLabel && q.actionTo && (
                          q.actionTo.startsWith('#') ? (
                            <a
                              href={q.actionTo}
                              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--clay)] hover:text-white transition-colors"
                            >
                              {q.actionLabel}
                            </a>
                          ) : (
                            <Link
                              to={q.actionTo}
                              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] transition-colors"
                            >
                              {q.actionLabel}
                            </Link>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </ClayCard>
            </div>
          )}

          {/* ── Assistive banner ────────────────────────────────── */}
          <AnimatePresence>
            {hasReleaseable ? (
              <AssistiveBanner
                variant="job_complete"
                actionLabel="Verify & Release Now"
                actionHref="#escrows"
              />
            ) : (score == null || score < 50) ? (
              <AssistiveBanner variant="score_dropping" actionLabel="Book a Service" actionHref="/booking" />
            ) : (
              <AssistiveBanner variant="all_well" actionLabel="Discover" actionHref="/booking" />
            )}
          </AnimatePresence>

          {/* ── Trust Passport ──────────────────────────────────── */}
          <div className="mb-6">
            <ClayCard className="border border-dashed border-[rgba(191,179,163,0.5)] bg-[var(--cream)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className={sectionTitle}>Trust Passport</h2>
                  <p className="text-xs text-[var(--soft-stone)]">Your portable reputation across Pabandi</p>
                </div>
                {score != null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline text-4xl font-black text-[var(--terracotta)] tabular-nums">{score}</span>
                    <span className="text-lg font-bold text-[var(--soft-stone)]">· {tier ?? '—'}</span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="font-headline text-lg font-bold text-[var(--clay)]">Building Trust</span>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">
                      Complete an escrowed booking to start
                    </p>
                  </div>
                )}
              </div>
              {/* Trust band bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--warm-sand)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--clay)] to-[var(--sage)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, score ?? 0)}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <ClayBadge
                  label={tier ?? 'Building Trust'}
                  variant={tier === 'GOLD' ? 'success' : tier === 'SILVER' ? 'info' : 'neutral'}
                  size="sm"
                />
                {stats?.trustScore.reliability != null && (
                  <span className="font-label text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">
                    Reliability {stats.trustScore.reliability}/100
                  </span>
                )}
              </div>
            </ClayCard>
          </div>

          {/* ── Yield widget ────────────────────────────────────── */}
          <div className="mb-6">
            <ClayCard className="border border-[var(--sage)]/40 bg-[var(--sage)]/10 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--soft-stone)]">
                    Total Yield Earned
                  </p>
                  {yieldEarned != null ? (
                    <p className="font-headline text-2xl font-black tabular-nums text-[var(--sage)]">
                      +${yieldEarned.toFixed(2)} USDC
                    </p>
                  ) : (
                    <p className="font-headline text-2xl font-black text-[var(--soft-stone)]">— USDC</p>
                  )}
                  <p className="mt-1 max-w-xs text-xs text-[var(--soft-stone)]">
                    Your locked funds earn yield on Solana. Get 50% as a rebate when you release escrow.
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--sage)] text-[var(--warm-ink)]">
                  <Coins className="h-6 w-6" />
                </div>
              </div>
            </ClayCard>
          </div>

          {/* ── Active Escrows ──────────────────────────────────── */}
          <div id="escrows" className="mb-6 scroll-mt-20">
            <div className="mb-4 flex items-center justify-between">
              <h2 className={sectionTitle}>Active Escrows</h2>
              {stats && stats.activeEscrows.count > 0 && (
                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-[var(--terracotta)]">
                  ${stats.activeEscrows.totalUsd.toFixed(2)} held
                </span>
              )}
            </div>

            {escrows.length === 0 ? (
              <ClayCard className="border border-dashed border-[rgba(191,179,163,0.5)] bg-[var(--warm-sand)]/40 p-8 text-center">
                <Lock className="mx-auto mb-3 h-8 w-8 text-[var(--soft-stone)]" />
                <p className="text-sm font-semibold text-[var(--warm-ink)]">No active escrows. Book a service to get started.</p>
                <p className="mt-1 text-xs text-[var(--soft-stone)]">Funds are held safely until the work is verified.</p>
                <ClayButton variant="primary" className="mt-4" onClick={() => navigate('/booking')}>
                  <ArrowRight className="mr-1 inline h-4 w-4" /> Discover Services
                </ClayButton>
              </ClayCard>
            ) : (
              escrows.map((escrow, i) => (
                <motion.div
                  key={escrow.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="mb-3 rounded-[var(--radius-card)] border border-[rgba(191,179,163,0.5)] bg-[var(--cream)] p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-[var(--warm-ink)]">{escrow.businessName ?? 'Service provider'}</h3>
                      <p className="font-label text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">
                        {escrow.reference}
                      </p>
                    </div>
                    <ClayBadge
                      label={escrow.canRelease ? 'Ready to release' : escrow.jobStatus === 'IN_PROGRESS' ? 'Work under way' : 'Escrow funded'}
                      variant={escrow.canRelease ? 'warning' : 'info'}
                      size="sm"
                    />
                  </div>
                  <div className="mb-3 flex items-baseline gap-1">
                    <span className="font-headline text-2xl font-black tabular-nums text-[var(--warm-ink)]">
                      ${escrow.amountUsd.toFixed(2)}
                    </span>
                    <span className="text-xs text-[var(--soft-stone)]">in escrow</span>
                  </div>

                  {escrow.canRelease ? (
                    <button
                      onClick={() => {
                        setProofTaken(false);
                        setShowProofModal(escrow);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--clay)] py-3 font-label text-sm font-bold uppercase tracking-widest text-[var(--warm-ink)] shadow-[var(--shadow-btn)] transition-shadow hover:shadow-[var(--shadow-btn-hover)]"
                    >
                      <LockOpen className="h-4 w-4" />
                      <span>Verify &amp; Release Funds (VCAP)</span>
                    </button>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--soft-stone)]">
                      <Clock className="h-3 w-3" />
                      <span>Awaiting provider action — funds stay pooled and earning yield meanwhile</span>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {/* ── Discover CTA ────────────────────────────────────── */}
          <div className="mb-8">
            <h2 className={`${sectionTitle} mb-4`}>Discover</h2>
            <Link to="/booking" className="block">
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-between rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--clay)] to-[var(--terracotta)] p-6 shadow-[var(--shadow-lift)]"
              >
                <div className="text-left">
                  <p className="font-headline text-xl font-bold text-[var(--cream)]">Find new services</p>
                  <p className="text-xs text-[var(--cream)]/80">Escrow-protected bookings, trusted pros, real reviews</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cream)]/20 text-[var(--cream)]">
                  <ArrowRight className="h-5 w-5" />
                </span>
              </motion.div>
            </Link>
          </div>

          {/* ── Live Network ────────────────────────────────────── */}
          <div className="mb-8">
            <h2 className={`${sectionTitle} mb-4`}>Live Network</h2>
            <LiveNetworkWidget className="rounded-[var(--radius-card)] border border-[rgba(191,179,163,0.5)] bg-[var(--warm-sand)]/20 p-4" />
          </div>

          {/* ── VCAP proof modal ──────────────────────────────────── */}
          <AnimatePresence>
            {showProofModal && (
              <VcapModal
                escrow={showProofModal}
                proofTaken={proofTaken}
                releasing={releasing}
                onTakePhoto={() => setProofTaken(true)}
                onSubmit={() => handleRelease(showProofModal)}
                onClose={() => {
                  setShowProofModal(null);
                  setProofTaken(false);
                }}
              />
            )}
          </AnimatePresence>

          {/* Vault ritual — plays on release */}
          <ClayVaultLock
            open={showVault}
            message="Funds Released — rebate on its way."
            onClose={() => setShowVault(false)}
          />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}

interface VcapModalProps {
  escrow: ActiveEscrowItem;
  proofTaken: boolean;
  releasing: boolean;
  onTakePhoto: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

/** VCAP — simulated photo capture before release, same ritual as the demo. */
function VcapModal({ escrow, proofTaken, releasing, onTakePhoto, onSubmit, onClose }: VcapModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Verify work before release"
    >
      <div className="absolute inset-0 bg-[rgba(42,37,32,0.6)] backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className="relative w-full max-w-md rounded-[var(--radius-card)] border border-dashed border-[var(--clay)]/60 bg-[var(--cream)] p-6 shadow-[var(--shadow-modal)]"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4">
          <ChevronDown className="h-5 w-5 text-[var(--soft-stone)]" />
        </button>
        <h3 className="font-headline text-lg font-bold text-[var(--warm-ink)]">
          Verify the work (VCAP)
        </h3>
        <p className="mt-1 text-xs text-[var(--soft-stone)]">
          Verify the work (VCAP)
        </p>
        <button
          onClick={onTakePhoto}
          className={`mt-4 flex aspect-video w-full items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${proofTaken ? 'border-[var(--sage)] bg-[var(--sage)]/10' : 'border-[var(--clay)]/50 bg-[var(--warm-sand)]/50 hover:bg-[var(--warm-sand)]'}`}
        >
          {proofTaken ? (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-1.5 text-[var(--sage)]">
              <Camera className="h-8 w-8" />
              <span className="font-label text-[10px] uppercase tracking-widest">Proof captured ✓</span>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-[var(--terracotta)]">
              <Camera className="h-8 w-8" />
              <span className="font-label text-[10px] uppercase tracking-widest">Simulate taking a photo</span>
            </div>
          )}
        </button>

        <button
          disabled={!proofTaken || releasing}
          onClick={onSubmit}
          className={`mt-4 w-full rounded-[var(--radius-btn)] py-3 font-label text-sm font-bold uppercase tracking-widest transition-colors ${proofTaken && !releasing ? 'bg-[var(--clay)] text-[var(--cream)] shadow-[var(--shadow-btn)]' : 'cursor-not-allowed bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}
        >
          {releasing ? 'Releasing…' : 'Verify & Release'}
        </button>
      </motion.div>
    </motion.div>
  );
}
