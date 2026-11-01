import { Helmet } from 'react-helmet-async';
import DashboardLayout from '../../components/DashboardLayout';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { useAuthStore } from '../../store/authStore';
import { getAuthToken } from '../../utils/authToken';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayBadge } from '../../components/primitives';
import { FirstRunChecklist } from './components/FirstRunChecklist';
import ModularDashboard from '../crm/components/ModularDashboard';
import { AssistiveBanner } from '../../components/AssistiveBanner';

type Booking = {
  id: string;
  clientName?: string;
  client?: { name?: string };
  serviceType?: string;
  slotStart?: string;
  status?: 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  depositAmount?: number;
  depositStatus?: 'pending' | 'funded' | 'released';
  travelFee?: number;
};

type Gig = {
  id: string;
  title: string;
  category?: string;
  budgetUsd?: number;
  status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  createdBy?: string;
};

type AgentActivity = {
  id: string;
  agentName: string;
  action: string;
  amount?: number;
  timestamp: string;
};

function formatTime(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ContactOSPage() {
  const [businessName, setBusinessName] = useState<string>('Your Business');
  const [todaysRevenue, setTodaysRevenue] = useState(0);
  const [pendingEscrows, setPendingEscrows] = useState(0);
  const [activeGigs, setActiveGigs] = useState(0);
  const [trustScore, setTrustScore] = useState(500);
  const [todaysBookings, setTodaysBookings] = useState<Booking[]>([]);
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCRMTools, setShowCRMTools] = useState(false);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const businessId = (user as { business?: { id?: string } | null } | null)?.business?.id
    || (user as { businessId?: string | null } | null)?.businessId
    || localStorage.getItem('businessId')
    || 'default';

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

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const token = getAuthToken();
        const headers = { Authorization: `Bearer ${token}` };

        // Business profile name
        const bizRes = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/businesses/${businessId}`,
          { headers }
        );
        if (bizRes.ok) {
          const biz = await bizRes.json();
          setBusinessName(biz.data?.name || biz.name || 'Your Business');
        }

        // Trust score from passport
        const passportRes = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/trust-passport/me`,
          { headers }
        );
        if (passportRes.ok) {
          const passportData = await passportRes.json();
          setTrustScore(passportData.data?.score ?? 500);
        }

        // Today's revenue from bookings
        const bookingsRes = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/bookings/business/${businessId}`,
          { headers }
        );
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          const bookings: Booking[] = bookingsData.data || bookingsData.bookings || [];
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todays = bookings.filter((b) => {
            const d = b.slotStart ? new Date(b.slotStart) : null;
            return d && d >= today && d < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          });
          setTodaysBookings(todays);
          const revenue = todays.reduce((sum, b) => sum + (b.depositAmount || 0) + (b.travelFee || 0), 0);
          setTodaysRevenue(revenue);

          // Pending escrows
          const pending = bookings.filter(b => b.depositStatus === 'pending' || b.depositStatus === 'funded').length;
          setPendingEscrows(pending);
        }

        // Active marketplace gigs
        const gigsRes = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/marketplace/gigs`,
          { headers }
        );
        if (gigsRes.ok) {
          const gigsData = await gigsRes.json();
          const gigs: Gig[] = gigsData.data || gigsData.gigs || [];
          setActiveGigs(gigs.filter(g => g.status === 'OPEN' || g.status === 'IN_PROGRESS').length);
        }

        // Agent activity (mocked from agent marketplace)
        setAgentActivity([
          { id: '1', agentName: 'ScoutBot', action: 'Found 5 new targets', amount: 0, timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
          { id: '2', agentName: 'BookerAgent', action: 'Booked a $150 job', amount: 150, timestamp: new Date(Date.now() - 2 * 60 * 60000).toISOString() },
          { id: '3', agentName: 'VerifyAgent', action: 'Verified 2 client identities', amount: 0, timestamp: new Date(Date.now() - 4 * 60 * 60000).toISOString() },
        ]);
      } catch (err) {
        console.error('[ContactOS] dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [businessId, token]);

  // ... enrollment self-heal logic preserved from original
  useEffect(() => {
    let cancelled = false;
    const fetchLeads = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
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
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
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
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--clay)] border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const now = new Date();
  const todays = todaysBookings.filter(b => {
    const d = b.slotStart ? new Date(b.slotStart) : null;
    return d && d >= now && d < new Date(now.getTime() + 24 * 60 * 60 * 1000);
  });

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
                <h1 className="text-3xl font-bold text-amber-900">{businessName}</h1>
                <p className="text-sm text-amber-600">Business dashboard — escrow, gigs, and agent activity</p>
              </div>
            </div>
            <AnimatePresence>
              {pendingEscrows > 2 ? (
                <AssistiveBanner
                  variant="overdue_invoices"
                  actionLabel="Send Reminder"
                  actionHref="/contact/invoices"
                />
              ) : trustScore < 500 ? (
                <AssistiveBanner
                  variant="score_dropping"
                  actionLabel="Book a Service"
                  actionHref="/booking"
                />
              ) : (
                <AssistiveBanner
                  variant="all_well"
                  actionLabel="Continue"
                  actionHref="/booking"
                />
              )}
            </AnimatePresence>
          </div>

          {/* ── First Run Checklist ──────────────────────────────── */}
          <div className="mb-6">
            <FirstRunChecklist />
          </div>

          {/* ── Key Metrics ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <ClayCard className="bg-white border border-amber-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Today's Revenue</p>
                  <p className="text-3xl font-black text-amber-900">${todaysRevenue.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
              </div>
            </ClayCard>
            <ClayCard className="bg-white border border-amber-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Escrows</p>
                  <p className="text-3xl font-black text-amber-900">{pendingEscrows}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <span className="text-2xl">🔒</span>
                </div>
              </div>
            </ClayCard>
            <ClayCard className="bg-white border border-amber-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Active Marketplace Gigs</p>
                  <p className="text-3xl font-black text-amber-900">{activeGigs}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <span className="text-2xl">🤝</span>
                </div>
              </div>
            </ClayCard>
          </div>

          {/* ── Today's Schedule ─────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-amber-900 text-lg">Today's Schedule</h2>
              <Link to="/contact/bookings" className="text-xs font-bold text-amber-500 hover:underline">View all →</Link>
            </div>
            <div className="space-y-3">
              {todays.length === 0 ? (
                <div className="p-6 text-center bg-white rounded-xl border border-amber-200">
                  <p className="text-amber-600 text-sm">No bookings scheduled today</p>
                  <p className="text-xs text-amber-500 mt-1">Everything is clear — a good day to focus on delivery.</p>
                </div>
              ) : (
                todays.map((b) => {
                  const statusColor = b.status === 'confirmed' ? 'text-emerald-700 bg-emerald-50' : b.status === 'pending' ? 'text-amber-700 bg-amber-50' : 'text-slate-700 bg-slate-50';
                  return (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                          {b.clientName?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <p className="font-bold text-amber-900 text-sm">{b.clientName || 'Client'}</p>
                          <p className="text-xs text-amber-600">{b.serviceType || 'Booking'} • {formatDate(b.slotStart)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-1 rounded-full font-bold ${statusColor}`}>
                          {b.status === 'confirmed' ? 'Upcoming' : b.status === 'pending' ? 'Pending' : b.status === 'no_show' ? 'No-show' : 'Completed'}
                        </span>
                        <span className="text-amber-600 font-medium">{formatTime(b.slotStart)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Agent Activity Feed ───────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-amber-900 text-lg">Agent Activity</h2>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">AI Scout Active</span>
            </div>
            <div className="space-y-2">
              {agentActivity.map((a) => (
                <div key={a.id} className="flex items-start justify-between p-3 bg-white rounded-xl border border-amber-200">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900">{a.agentName}</p>
                    <p className="text-xs text-amber-600">{a.action}</p>
                    {a.amount > 0 && (
                      <p className="text-xs font-bold text-emerald-700 mt-1">+${a.amount.toLocaleString()}</p>
                    )}
                  </div>
                  <span className="text-xs text-amber-500">{new Date(a.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick Actions ────────────────────────────────────── */}
          <div className="mb-8">
            <h2 className="font-bold text-amber-900 text-lg mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ClayButton
                onClick={() => navigate('/contact/invoices')}
                variant="primary"
                className="w-full py-4 flex items-center justify-center gap-2"
              >
                <span>📄</span> New Invoice
              </ClayButton>
              <ClayButton
                onClick={() => navigate('/gigs')}
                variant="secondary"
                className="w-full py-4 flex items-center justify-center gap-2"
              >
                <span>🤝</span> Post to Gig Board
              </ClayButton>
              <ClayButton
                onClick={() => navigate('/me/wallet')}
                variant="secondary"
                className="w-full py-4 flex items-center justify-center gap-2"
              >
                <span>👛</span> View Wallet
              </ClayButton>
            </div>
          </div>

          {/* ── CRM tools, collapsed (background) ────────────────── */}
          <div className="mb-10">
            <button
              type="button"
              onClick={() => setShowCRMTools((v) => !v)}
              aria-expanded={showCRMTools}
              className="w-full flex items-center justify-between px-5 py-3 rounded-2xl bg-white transition-all"
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
