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
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayBadge } from '../../components/primitives';
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
  const queryClient = useQueryClient();

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
