import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/primitives/ClayToast';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/primitives/ClayBadge';
import { ClaySkeletonCard } from '../components/primitives/ClaySkeleton';
import { Shield, ArrowLeft, Lock, Building2 } from 'lucide-react';
import { statsService } from '../services/statsService';

/**
 * Trust & Verification Hub — /background-check
 *
 * Premium Warm Clay entry point for identity verification. Users and agents
 * verify their identity, link government registries, and boost their Pabandi
 * Trust Score to unlock higher-paying jobs and zero-deposit bookings.
 *
 * Commit 1: shell + theme + skeleton.
 * Commit 2: breadcrumb, verification cards, mode-based back navigation,
 * Coming Soon toasts.
 */
export default function BackgroundCheckPage() {
  const [loading, setLoading] = useState(true);
  const [completedEscrows, setCompletedEscrows] = useState<number | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const comingSoon = () => {
    addToast({
      type: 'info',
      message: 'Coming Soon — this verification step is being wired to a KYC / registry provider.',
      duration: 3500,
    });
  };

  // Back to the user's mode-appropriate dashboard (Personal → /me, Business → /contact).
  const goBack = () => {
    navigate(user?.preferredMode === 'personal' ? '/me' : '/contact');
  };

  // Real onchain history: number of escrows the user has completed.
  useEffect(() => {
    let cancelled = false;
    statsService
      .me()
      .then((s) => {
        if (!cancelled) setCompletedEscrows(s.activeEscrows.count);
      })
      .catch(() => {
        if (!cancelled) setCompletedEscrows(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--warm-sand)]/30 px-3 py-1.5 mb-4">
              <Shield className="h-5 w-5 text-[var(--clay)]" />
              <span className="font-label text-xs font-bold uppercase text-[var(--clay)] tracking-wider">
                Trust & Safety
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold font-headline tracking-tight">
              Trust & Verification Hub
            </h1>
            <p className="mt-3 text-lg text-[var(--soft-stone)] leading-relaxed">
              Verify your identity, link government registries, and boost your Pabandi Trust Score to unlock higher-paying jobs and zero-deposit bookings.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <ClaySkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] p-4 md:p-6 text-[var(--warm-ink)]">
      <Breadcrumbs items={[{ label: 'Verification' }]} homePath="/" />

      <div className="max-w-3xl mx-auto">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--warm-sand)]/30 px-3 py-1.5 mb-4">
            <Shield className="h-5 w-5 text-[var(--clay)]" />
            <span className="font-label text-xs font-bold uppercase text-[var(--clay)] tracking-wider">
              Trust & Safety
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-headline tracking-tight">
            Trust & Verification Hub
          </h1>
          <p className="mt-3 text-lg text-[var(--soft-stone)] leading-relaxed">
            Verify your identity, link government registries, and boost your Pabandi Trust Score to unlock higher-paying jobs and zero-deposit bookings.
          </p>
        </div>

        {/* ── Back to Dashboard ──────────────────────────────── */}
        <div className="mb-8">
          <ClayButton
            onClick={goBack}
            variant="secondary"
            className="flex items-center gap-2 rounded-xl border border-[var(--soft-stone)]/30 bg-white px-4 py-2.5 text-sm font-bold text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/40"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </ClayButton>
        </div>

        {/* ── Verification steps ─────────────────────────────── */}
        <div className="grid gap-5 md:grid-cols-3">
          <ClayCard className="p-5 bg-white border border-[rgba(191,179,163,0.2)] shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-base text-[var(--warm-ink)]">Identity Verification</h3>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)] mt-0.5">
                  Status: Pending
                </p>
              </div>
              <ClayBadge label="Pending" variant="warning" size="sm" />
            </div>
            <p className="text-sm text-[var(--soft-stone)] mb-5 leading-relaxed">
              Government-issued ID and selfie check. Eventually connects to Stripe Identity or a KYC provider.
            </p>
            <ClayButton
              onClick={comingSoon}
              className="flex w-full items-center justify-center gap-2 py-3"
            >
              <Lock className="h-4 w-4" />
              <span>Verify ID</span>
            </ClayButton>
          </ClayCard>

          <ClayCard className="p-5 bg-white border border-[rgba(191,179,163,0.2)] shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-base text-[var(--warm-ink)]">Government Registry Match</h3>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)] mt-0.5">
                  Status: Unlinked
                </p>
              </div>
              <ClayBadge label="Unlinked" variant="info" size="sm" />
            </div>
            <p className="text-sm text-[var(--soft-stone)] mb-5 leading-relaxed">
              Link your business to government registries (OpenDirectories MCP) to prove incorporation and good standing.
            </p>
            <ClayButton
              onClick={comingSoon}
              className="flex w-full items-center justify-center gap-2 py-3"
            >
              <Building2 className="h-4 w-4" />
              <span>Link Business</span>
            </ClayButton>
          </ClayCard>

          <ClayCard className="p-5 bg-white border border-[rgba(191,179,163,0.2)] shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-base text-[var(--warm-ink)]">Onchain History</h3>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)] mt-0.5">
                  Status: Active
                </p>
              </div>
              <ClayBadge label="Active" variant="success" size="sm" />
            </div>
            <p className="text-sm text-[var(--soft-stone)] mb-5 leading-relaxed">
              Verified escrow activity on Solana. Each completed release builds your Pabandi Trust Score.
            </p>
            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">Completed Escrows</div>
              <div className="text-2xl font-black tabular-nums text-[var(--clay)]">
                {completedEscrows ?? '--'}
              </div>
            </div>
          </ClayCard>
        </div>
      </div>
    </div>
  );
}
