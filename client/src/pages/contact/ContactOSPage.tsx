import { Helmet } from 'react-helmet-async';
import DashboardLayout from '../../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import {
  Handshake,
  Lock,
  Wallet,
  CreditCard,
  ClipboardPlus,
  CheckCircle2,
} from 'lucide-react';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { useAuthStore } from '../../store/authStore';
import { getAuthToken } from '../../utils/authToken';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayBadge } from '../../components/primitives';
import { FirstRunChecklist } from './components/FirstRunChecklist';
import ModularDashboard from '../crm/components/ModularDashboard';
import { AssistiveBanner } from '../../components/AssistiveBanner';
import { statsService, type BusinessStats } from '../../services/statsService';
import { apiClient } from '../../services/api';

export default function ContactOSPage() {
  const [businessName, setBusinessName] = useState<string>('Your Business');
  const [loading, setLoading] = useState(true);
  const [showCRMTools, setShowCRMTools] = useState(false);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const businessId = (user as { business?: { id?: string } | null } | null)?.business?.id
    || (user as { businessId?: string | null } | null)?.businessId
    || localStorage.getItem('businessId')
    || undefined;

  const enrollNow = async (fallbackName: string): Promise<boolean> => {
    try {
      const user = useAuthStore.getState().user;
      const name =
        (user as { business?: { name?: string } | null } | null)?.business?.name
        || (user as { businessName?: string } | null)?.businessName
        || fallbackName;
      await useAuthStore.getState().enrollBusiness({
        businessName: String(name),
        ownerName: (user as { name?: string | null } | null)?.name || (user as { firstName?: string | null } | null)?.firstName || String(name),
        serviceType: (useBusinessSettings.getState?.() as { vertical?: string } | null)?.vertical || 'general',
      });
      setHealed(true);
      return true;
    } catch (err) {
      console.error('[ContactOS] could not enroll this account:', err);
      return false;
    }
  };

  const [healed, setHealed] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // ── REAL business stats from the backend aggregate ──
  // /business/stats returns today's invoice revenue, pending escrow count+value,
  // SaaS credit and today's scheduled jobs (with CRM client names). Polled every
  // 30s and invalidated after a check-in so trust movement shows immediately.
  const { data: stats, isLoading: statsLoading } = useQuery<BusinessStats>(
    'businessDashboardStats',
    statsService.business,
    { refetchInterval: 30_000, retry: 1 },
  );

  const todayRevenue = stats?.todayRevenue ?? 0;
  const pendingEscrows = stats?.pendingEscrows.count ?? 0;
  const pendingEscrowUsd = stats?.pendingEscrows.totalUsd ?? 0;
  const saasCreditReal = stats?.saasCredit ?? null;
  const todaysRealJobs = stats?.todayJobs ?? [];
  const deals: Array<{ stage?: string }> = [];
  const activeDeals = deals.filter((d) => d.stage !== 'WON' && d.stage !== 'LOST').length;
  const recentClients = ([] as Array<{ createdAt?: string }>)
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 5);
  void activeDeals;
  void recentClients;

  /** Owner check-in — flips the booking to attended server-side. */
  const checkIn = async (bookingId: string) => {
    setCheckingInId(bookingId);
    try {
      await apiClient.post(`/bookings/public/${bookingId}/attend`, {});
    } finally {
      setCheckingInId(null);
      // Trust Sync — attendance moves the trust score; refresh now + on next tick.
      await queryClient.invalidateQueries('businessDashboardStats');
    }
  };

  // Registration/fallback lookups only — the numbers above come from the stats API.
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        if (!businessId || businessId === 'undefined') {
          setLoading(false);
          return;
        }

        const token = getAuthToken();
        const headers = { Authorization: `Bearer ${token}` };

        // Business profile name (stats API supplies everything else)
        const bizRes = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/businesses/${businessId}`,
          { headers }
        );
        if (!cancelled && bizRes.ok) {
          const biz = await bizRes.json();
          setBusinessName(biz.data?.name || biz.name || 'Your Business');
        }

        if (cancelled) return;
      } catch (err) {
        console.error('[ContactOS] dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [businessId]);

  // ... enrollment self-heal logic preserved from original
  useEffect(() => {
    let cancelled = false;
    const fetchLeads = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/crm/clients`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        if (cancelled) return;
        if (res.ok) {
          setEnrolled(true);
          return;
        }
        if (res.status === 403) {
          const local = useBusinessSettings.getState().settings;
          const looksSetUp = local.hasCompletedSetup || Boolean(local.vertical);
          if (looksSetUp) {
            const ok = await enrollNow('Your workspace');
            if (!cancelled) setEnrolled(ok);
            return;
          }
          if (!cancelled) setEnrolled(false);
          return;
        }
        console.error('Failed to fetch clients:', res.status);
        setEnrolled(true);
      } catch (err) {
        console.error('Failed to fetch leads:', err);
        if (cancelled) return;
        setEnrolled(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  useEffect(() => {
    if (enrolled === false) {
      navigate('/contact/setup', { replace: true });
    }
  }, [enrolled, navigate]);

  useEffect(() => {
    if (!healed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/crm/clients`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        // leads not needed for business dashboard, but keep enrolment state fresh
        void data;
      } catch {
        /* leave silent */
      }
    })();
    return () => { cancelled = true; };
  }, [healed]);

  if (loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }} className="space-y-6">
          {/* greeting skeleton */}
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--warm-sand)] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 bg-[var(--warm-sand)] rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-[var(--warm-sand)] rounded animate-pulse" />
            </div>
          </div>
          {/* stat card skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[var(--radius-card)] border border-[rgba(191,179,163,0.5)] bg-[var(--warm-sand)]/40 p-5 space-y-4">
                <div className="h-3 w-1/3 bg-[var(--warm-sand)] rounded animate-pulse" />
                <div className="h-10 w-1/2 rounded-full bg-[var(--warm-sand)] animate-pulse" />
                <div className="h-3 w-1/3 bg-[var(--warm-sand)] rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* today's schedule skeleton */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[var(--radius-card)] border border-[rgba(191,179,163,0.5)] bg-[var(--warm-sand)]/40 p-3 space-y-2">
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-full bg-[var(--warm-sand)] animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-2/3 bg-[var(--warm-sand)] rounded animate-pulse" />
                    <div className="h-2 w-1/2 bg-[var(--warm-sand)] rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-3 w-1/3 bg-[var(--warm-sand)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const now = new Date();
  void now;
  return (
    <>
      <Helmet>
        <title>{businessName} — Business Dashboard</title>
      </Helmet>
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* ── Greeting + Assistive AI Banner ────────────────── */}
          <div className="clay-fade mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold text-[var(--warm-ink)]">{businessName}</h1>
                <p className="text-sm text-[var(--soft-stone)]">Business dashboard — escrow, gigs, and agent activity</p>
              </div>
            </div>
            <AnimatePresence>
              {pendingEscrows > 0 ? (
                <AssistiveBanner
                  variant="overdue_invoices"
                  title={`${pendingEscrows} pending escrow${pendingEscrows === 1 ? '' : 's'} to verify`}
                  body={`$${pendingEscrowUsd.toFixed(2)} is held for your work. Verify and release from the bookings page once jobs complete.`}
                  actionLabel="Review Escrows"
                  actionHref="/contact/bookings"
                />
              ) : (
                <AssistiveBanner
                  variant="all_well"
                  title="All escrows settled"
                  body="Nothing needs your attention right now. Post a gig or take a new booking to grow today's revenue."
                  actionLabel="Post Gig"
                  actionHref="/gig"
                />
              )}
            </AnimatePresence>
          </div>

          {/* ── First Run Checklist ──────────────────────────────── */}
          <div className="mb-6">
            <FirstRunChecklist />
          </div>

          {/* ── Key Metrics — REAL numbers from /business/stats ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <ClayCard className="border border-[rgba(191,179,163,0.5)] bg-[var(--cream)] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--terracotta)]">Today's Revenue</p>
                  <p className="font-headline text-3xl font-black tabular-nums text-[var(--warm-ink)]">
                    ${todayRevenue.toFixed(2)}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">Paid invoices today</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--sage)]/20 text-[var(--sage)]">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>
            </ClayCard>
            <ClayCard className="border border-[rgba(191,179,163,0.5)] bg-[var(--cream)] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--terracotta)]">Pending Escrows</p>
                  {statsLoading ? (
                    <p className="font-headline text-3xl font-black text-[var(--soft-stone)]">—</p>
                  ) : (
                    <p className="font-headline text-3xl font-black tabular-nums text-[var(--warm-ink)]">
                      {pendingEscrows}
                      <span className="ml-2 text-sm font-bold text-[var(--terracotta)]">${pendingEscrowUsd.toFixed(2)}</span>
                    </p>
                  )}
                  <p className="text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">Funds held for you, awaiting verification</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--clay)]/20 text-[var(--terracotta)]">
                  <Lock className="h-6 w-6" />
                </div>
              </div>
            </ClayCard>
            <ClayCard className="border border-[var(--sage)]/40 bg-[var(--sage)]/10 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--terracotta)]">SaaS Credit</p>
                  {statsLoading ? (
                    <p className="font-headline text-3xl font-black text-[var(--soft-stone)]">—</p>
                  ) : (
                    <p className="font-headline text-3xl font-black tabular-nums text-[var(--warm-ink)]">
                      ${(saasCreditReal ?? 0).toFixed(2)}
                    </p>
                  )}
                  <p className="text-xs text-[var(--soft-stone)] mt-1">Earned from Solana escrow yield. Applies to your next subscription.</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--sage)] text-[var(--warm-ink)]">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </ClayCard>
          </div>

          {/* ── Today's Schedule — REAL jobs from /business/stats ─ */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[var(--warm-ink)] text-lg">Today's Schedule</h2>
              <Link to="/contact/bookings" className="text-xs font-bold text-[var(--terracotta)] hover:underline">View all →</Link>
            </div>
            <div className="space-y-3">
              {todaysRealJobs.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-[rgba(191,179,163,0.5)] bg-[var(--warm-sand)]/40">
                  <p className="text-sm font-semibold text-[var(--warm-ink)]">No bookings scheduled today</p>
                  <p className="text-xs text-[var(--soft-stone)] mt-1">Everything is clear — a good day to focus on delivery.</p>
                </div>
              ) : (
                todaysRealJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-xl border border-[rgba(191,179,163,0.5)] bg-[var(--cream)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--warm-ink)] text-[var(--cream)] font-bold text-sm">
                        {job.client?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <p className="font-bold text-[var(--warm-ink)] text-sm">{job.client}</p>
                        <p className="text-xs text-[var(--soft-stone)]">{job.service} • {new Date(job.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <ClayBadge
                        label={job.status === 'attended' ? 'Attended' : job.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        variant={job.status === 'attended' ? 'success' : job.status === 'confirmed' ? 'info' : 'neutral'}
                        size="sm"
                      />
                      {job.status !== 'attended' && (
                        <button
                          onClick={() => checkIn(job.id)}
                          disabled={checkingInId === job.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--clay)] px-3 py-1.5 font-label text-[10px] font-bold uppercase tracking-widest text-[var(--cream)] shadow-[var(--shadow-btn)] disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {checkingInId === job.id ? 'Checking in…' : 'Check-in'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Quick Actions ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <ClayButton className="flex w-full items-center justify-center gap-2 py-4" onClick={() => navigate('/contact/invoices')}>
              <ClipboardPlus className="h-5 w-5" /> New Invoice
            </ClayButton>
            <ClayButton className="flex w-full items-center justify-center gap-2 py-4" onClick={() => navigate('/gig')}>
              <Handshake className="h-5 w-5" /> Post Gig
            </ClayButton>
            <ClayButton className="flex w-full items-center justify-center gap-2 py-4" onClick={() => navigate('/wallet')}>
              <Wallet className="h-5 w-5" /> View Wallet
            </ClayButton>
          </div>

          {/* ── CRM tools, collapsed (background) ────────────────── */}
          <div className="mb-10">
            <button
              type="button"
              onClick={() => setShowCRMTools((v) => !v)}
              aria-expanded={showCRMTools}
              className="w-full flex items-center justify-between px-5 py-3 rounded-2xl bg-[var(--cream)] transition-all"
              style={{ boxShadow: 'var(--shadow-soft)', color: 'var(--soft-stone)' }}
            >
              <span className="text-sm font-bold">
                {showCRMTools ? 'Hide CRM tools' : 'CRM tools — pipeline, modules, compliance'}
              </span>
              <span className="material-symbols-outlined text-[20px]">
                {showCRMTools ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showCRMTools && (
              <div className="mt-6 space-y-8">
                <p style={{ color: 'var(--soft-stone)', fontSize: 13 }}>
                  Background features: who your high-value clients are and what each could be worth.
                </p>
                <div>
                  <ModularDashboard businessId={businessId} clients={[]} />
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
