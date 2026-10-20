import { Helmet } from 'react-helmet-async';
import DashboardLayout from '../../components/DashboardLayout';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { Card } from '../../components/primitives';
import ModularDashboard from '../crm/components/ModularDashboard';
import { useAuthStore } from '../../store/authStore';
import { getAuthToken } from '../../utils/authToken';
import { HalalBanner } from '../../components/halal';
import FirstRunChecklist from './components/FirstRunChecklist';



function StatCard({ icon, value, label, color = 'clay', delay = 0 }: {
  icon: string;
  value: string;
  label: string;
  color?: string;
  delay?: number;
}) {
  const colorMap: Record<string, string> = {
    clay: 'var(--clay)',
    sage: 'var(--sage)',
    ochre: 'var(--muted-ochre)',
    'sky-wash': 'var(--sky-wash)',
    'dusty-rose': 'var(--dusty-rose)',
  };

  return (
    <div className="clay-rise" style={{ animationDelay: `${delay}ms` }}>
      <Card hover={false}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-label" style={{ color: 'var(--soft-stone)' }}>{label}</p>
            <p className="stat-number text-4xl mt-2" style={{ color: 'var(--warm-ink)' }}>{value}</p>
          </div>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center clay-stat-icon"
            style={{ backgroundColor: colorMap[color] || colorMap.clay }}
          >
            <span className="material-symbols-outlined text-[20px] text-white">{icon}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ContactOSPage() {
  const [leads, setLeads] = useState<any[]>([]);
  /**
   * Real deals, fetched rather than inferred.
   *
   * The "Active Deals" card used to be `leads.filter(l => l.stage === 'booked').length`
   * — a count of CLIENTS, labelled as deals. A business with one open deal and forty
   * booked clients was shown "40 active deals", and a business with fifty open deals
   * and no booked clients was shown zero.
   */
  const [deals, setDeals] = useState<any[]>([]);
  /**
   * Bookings — the source of the money view.
   *
   * The vault cards and the Live Escrow Feed both read from this one list,
   * fetched with the same owner-scoped endpoint the bookings page uses. No new
   * backend was added for the reframe: escrow state here is the deposit state
   * the Booking row already records (depositAmount, depositStatus, status).
   */
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  /**
   * CRM tools are collapsed by default.
   *
   * Zero-clutter rule: the pipeline, module widgets, and the halal banner do not
   * move money, so they start hidden and are one click away. They are removed
   * from the first screen, not from the product.
   */
  const [showCRMTools, setShowCRMTools] = useState(false);
  const [loading, setLoading] = useState(true);
  const [healed, setHealed] = useState(false);
  /**
   * Has the server confirmed this account can use the CRM?
   *
   * Tri-state on purpose. `null` means "not answered yet" — a two-state boolean
   * starting at false would let the redirect below fire on mount, before
   * anything is known, for every account including the ones that are fine.
   */
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const businessId = (user as any)?.business?.id || (user as any)?.businessId || localStorage.getItem('businessId') || 'default';

  /**
   * Create the service-business row this account is missing, then reload.
   *
   * Self-healing because an account that finished the wizard before enrollment
   * existed, or whose local settings were lost, has no row and every /crm route
   * 403s. Silent on failure: the dashboard still renders, just empty, and the
   * caller decides what a failure means. A modal here would block someone whose
   * CRM is fine but whose network is not.
   */
  const enrollNow = async (fallbackName: string): Promise<boolean> => {
    try {
      const user = useAuthStore.getState().user;
      const name =
        (user as any)?.business?.name || (user as any)?.businessName || fallbackName;
      // Via the store so the reissued token (with a non-null businessId) is adopted.
      await useAuthStore.getState().enrollBusiness({
        businessName: String(name),
        ownerName: (user as any)?.name || (user as any)?.firstName || String(name),
        // 'general' matches the catch-all preset the wizard offers, and the server
        // falls back to a default category for anything unrecognised.
        serviceType: (useBusinessSettings.getState?.() as any)?.vertical || 'general',
      });
      setHealed(true);
      return true;
    } catch (err) {
      // Not fatal to the page. Logged so it is diagnosable, not shown so it does
      // not become a wall.
      console.error('[ContactOS] could not enroll this account:', err);
      return false;
    }
  };

  const fetchDeals = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/deals`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setDeals(body.data || []);
    } catch (err) {
      console.error('[ContactOS] could not load deals:', err);
    }
  };

  /**
   * Bookings for the vault view. Owner-scoped server side (the endpoint checks
   * the account owns the business), so no authorization work happens here.
   *
   * A failure is not fatal to the page — it is fatal only to the *money* cards,
   * which then show an explicit "unavailable" rather than pretending everything
   * is secured at $0.
   */
  const fetchBookings = async () => {
    try {
      if (businessId === 'default') return;
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/bookings/business/${businessId}`,
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      );
      if (!res.ok) return;
      const body = await res.json();
      setBookings(body.data || []);
    } catch (err) {
      console.error('[ContactOS] could not load bookings for the vault:', err);
    } finally {
      setBookingsLoaded(true);
    }
  };

  /**
   * A deal is active until it is decided. `WON` and `LOST` are the only terminal
   * stages, so those are the only ones excluded — filtering on the open list instead
   * would break the moment the pipeline is customised, which is why PipelineSettings
   * makes it readable-only rather than letting the list drift.
   */
  const activeDeals = deals.filter((d) => d.stage !== 'WON' && d.stage !== 'LOST').length;

  /**
   * Newest first, and capped.
   *
   * This rendered `leads.map(...)` — every client the tenant has — under a heading
   * reading "Recent Clients". At 500 clients that is a 500-row wall on the page
   * someone sees every morning, and the heading is not describing it.
   */
  const recentClients = [...leads]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 6);

  // ── The vault: what the money is doing ─────────────────────────────────────
  //
  // Three questions answered from the bookings list, in descending interest:
  // what is locked for upcoming work, what no-shows paid you this month, and
  // what is one ghost away from being nothing.

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const isUpcoming = (b: any) =>
    ['pending', 'confirmed'].includes(b.status) &&
    (!b.slotStart || new Date(b.slotStart) >= new Date(Date.now() - 24 * 60 * 60 * 1000));

  /** Deposit money committed to bookings that have not happened yet. */
  const securedRevenue = bookings
    .filter((b) => isUpcoming(b) && (b.depositStatus === 'funded' || b.depositStatus === 'released'))
    .reduce((sum, b) => sum + (b.depositAmount || 0) + (b.travelFee || 0), 0);

  /** Forfeited deposits — no-shows the guarantee held this month. */
  const guaranteedIncome = bookings
    .filter(
      (b) =>
        b.status === 'no_show' &&
        (!b.slotStart || new Date(b.slotStart) >= monthStart)
    )
    .reduce((sum, b) => sum + (b.depositAmount || 0) + (b.travelFee || 0), 0);

  /**
   * Bookings not yet paid against. The brief says "low trust score and
   * hasn't paid" — client trust scores are not on the bookings payload, and
   * inventing a threshold the client cannot verify would be the CRM lying
   * again. "Secured" is used honestly: no deposit on the books yet means the
   * booking is not yet a guarantee, whatever the score says.
   */
  const atRiskBookings = bookings.filter(
    (b) => isUpcoming(b) && b.depositAmount > 0 && b.depositStatus !== 'funded'
  );

  /** The feed: secured first, then awaiting, then the forfeited — newest first. */
  const escrowFeed = [...bookings]
    .sort(
      (a, b) =>
        new Date(b.slotStart || b.updatedAt || 0).getTime() -
        new Date(a.slotStart || a.updatedAt || 0).getTime()
    )
    .slice(0, 8);

  const feedTone = (b: any): { dot: string; color: string; text: string; amount: string } => {
    const amount = `$${((b.depositAmount || 0) + (b.travelFee || 0)).toLocaleString()}`;
    const name = b.client?.name || 'The client';
    const service = b.serviceType || 'Booking';
    const when = b.slotStart
      ? new Date(b.slotStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';

    if (b.status === 'no_show') {
      return { dot: '🔴', color: 'var(--dusty-rose)', text: `Deposit Forfeited — ${name} no-showed for ${service}. ${amount} is yours.`, amount };
    }
    if (b.depositStatus === 'funded') {
      return { dot: '🟢', color: 'var(--sage)', text: `${amount} Escrow Locked — ${name} for ${service} ${when && `(${when})`}`.trim(), amount };
    }
    if (b.depositAmount > 0) {
      return { dot: '🟡', color: 'var(--muted-ochre)', text: `Deposit Awaiting — ${name} has not secured ${service} ${when && `(${when})`}`.trim(), amount };
    }
    return { dot: '⚪', color: 'var(--soft-stone)', text: `${service} booked by ${name} — no deposit asked for`, amount };
  };

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
          setLeads(data.data || []);
          setEnrolled(true);
          // Deliberately not awaited into the critical path: a slow or failing deals
          // call should not hold up the dashboard. The card renders 0 until it lands,
          // which is the honest state for "we don't know yet".
          void fetchDeals();
          void fetchBookings();
          return;
        }

        // A 403 means there is no CrmServiceBusiness for this account, so EVERY
        // /crm route 403s and the workspace is inert. This branch used to be empty,
        // which is why an unenrolled account saw a blank dashboard and a Save
        // button that did nothing, with no indication of why.
        //
        // Which of the two fixes applies depends on whether this account has been
        // through setup already, and that is a local question because only the
        // client knows whether it ever asked for a vertical and a business name.
        if (res.status === 403) {
          // Read from the store rather than from a captured `settings`: this
          // effect runs once on mount, and the value it closes over would be the
          // one from that first render.
          const local = useBusinessSettings.getState().settings;
          const looksSetUp = local.hasCompletedSetup || Boolean(local.vertical);
          if (looksSetUp) {
            // Enroll in place. This is the population that finished the wizard
            // before enrollment existed, or whose stored settings were lost: the
            // local record says done, the server has no row. Self-healing is the
            // only path that works for them, because sending them back to the
            // wizard would ask for a vertical they already chose.
            const ok = await enrollNow('Your workspace');
            if (!cancelled) setEnrolled(ok);
            return;
          }
          // Never set up. Send them to the wizard, which is the only place that
          // asks for a vertical and a business name — pre-seeding 'general' here
          // would silently give them the catch-all preset instead of their own.
          if (!cancelled) setEnrolled(false);
          return;
        }
        // Anything else says nothing about enrollment. Treating a 500 or a
        // network error as "not enrolled" would push a working account to the
        // setup wizard because the API had a bad minute.
        console.error('Failed to fetch clients:', res.status);
        setEnrolled(true);
      } catch (err) {
        console.error('Failed to fetch leads:', err);
        if (cancelled) return;
        setLeads([]);
        setEnrolled(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  // Send new users to the setup wizard — but only once the server has agreed.
  //
  // This used to read `settings.hasCompletedSetup` and `settings.vertical` alone.
  // Those are local state, and a session that predates the store being persisted
  // has nothing stored at all, so the condition was true on every load for every
  // account: /contact was answered with a `replace` hop to the wizard for people
  // who had already set up. `replace` destroyed the URL they asked for, so Back
  // dropped them wherever they had been — usually the marketing homepage, which
  // is precisely the "clicking Contact OS bounces me back to pabandi.com" report.
  //
  // resolveCrmBusiness is the same question answered server-side on every /crm
  // route, so a 200 settles it: the workspace renders, whatever the local record
  // says. Only a 403 that the self-heal could not fix sends anyone to setup.
  useEffect(() => {
    if (enrolled === false) {
      navigate('/contact/setup', { replace: true });
    }
  }, [enrolled, navigate]);

  // Refetch once enrollment lands, so the dashboard is populated rather than
  // sitting empty after a successful self-heal.
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
        setLeads(data.data || []);
      } catch {
        /* leave the list empty; nothing worse to show than an error wall */
      }
    })();
    return () => { cancelled = true; };
  }, [healed]);

  if (loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--clay)] border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>The Vault — every booking, guaranteed</title>
      </Helmet>
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* ── Greeting ─────────────────────────────────────────── */}
          <div className="clay-fade mb-8">
            <h1 className="text-3xl font-bold clay-heading">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
            </h1>
            <p className="mt-1" style={{ color: 'var(--soft-stone)', fontSize: '15px' }}>
              Here is the money secured behind your bookings.
            </p>
          </div>

          {/* Above the vault cards: it is the only thing on this page that changes
              what someone does next, so it goes where the eye lands. It renders
              nothing once the work is done or dismissed. */}
          <div className="mb-8">
            <FirstRunChecklist />
          </div>

          {/* ── The Vault: stat cards ────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <Link to="/contact/invoices" className="block" aria-label="Secured Revenue">
              <StatCard
                icon="lock"
                value={
                  bookingsLoaded
                    ? `$${securedRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : '—'
                }
                label="Secured Revenue"
                color="sage"
                delay={160}
              />
            </Link>
            <Link to="/contact/invoices" className="block" aria-label="Guaranteed Income">
              <StatCard
                icon="account_balance_wallet"
                value={
                  bookingsLoaded
                    ? `$${guaranteedIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : '—'
                }
                label="Guaranteed Income"
                color="clay"
                delay={240}
              />
            </Link>
            <Link to="/contact/deals" className="block" aria-label="At-Risk Bookings">
              <StatCard
                icon="warning_amber"
                value={bookingsLoaded ? atRiskBookings.length.toString() : '—'}
                label="At-Risk Bookings"
                color="dusty-rose"
                delay={320}
              />
            </Link>
          </div>

          {/* ── Live Escrow Feed ─────────────────────────────────── */}
          <div className="clay-rise clay-delay-3 mb-10">
            <div className="flex items-center justify-between mb-5 clay-heading" style={{ fontSize: '1.25rem' }}>
              <h2 className="font-bold" style={{ color: 'var(--warm-ink)', fontFamily: 'var(--font-headline)' }}>
                Live Escrow Feed
              </h2>
              <Link
                to="/contact/invoices"
                className="text-sm font-bold px-4 py-2 rounded-full transition-all duration-200 clay-filter-chip clay-filter-chip--active"
                style={{ color: 'white', backgroundColor: 'var(--clay)', boxShadow: 'var(--shadow-btn)' }}
              >
                Escrow &amp; Payments →
              </Link>
            </div>

            <Card hover={false} noPadding>
              {!bookingsLoaded ? (
                <div className="px-7 py-10 text-center" style={{ color: 'var(--soft-stone)', fontSize: 14 }}>
                  Loading the vault…
                </div>
              ) : escrowFeed.length === 0 ? (
                <div className="px-7 py-10 text-center">
                  <span className="material-symbols-outlined text-[44px] mb-3 block" style={{ color: 'var(--clay)' }}>
                    lock
                  </span>
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--warm-ink)', fontFamily: 'var(--font-headline)' }}>
                    Nothing secured yet
                  </h3>
                  <p style={{ color: 'var(--soft-stone)', fontSize: '14px' }}>
                    Your first guaranteed booking will appear here — deposit locked, attendance
                    watched.
                  </p>
                  <Link
                    to="/contact/deals"
                    className="inline-flex items-center gap-2 px-6 py-3 mt-5 rounded-full font-bold text-white transition-all duration-150"
                    style={{ backgroundColor: 'var(--clay)', boxShadow: 'var(--shadow-btn)' }}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Create a Guaranteed Booking
                  </Link>
                </div>
              ) : (
                <div>
                  {escrowFeed.map((b, i) => {
                    const tone = feedTone(b);
                    return (
                      <div
                        key={b.id}
                        className="flex items-center gap-4 px-7 clay-table-row"
                        style={{
                          height: 'var(--space-row-height)',
                          borderBottom: i < escrowFeed.length - 1 ? '1px solid rgba(191, 179, 163, 0.15)' : 'none',
                        }}
                      >
                        <span aria-hidden="true">{tone.dot}</span>
                        <p className="flex-1 text-sm" style={{ color: 'var(--warm-ink)' }}>
                          {tone.text}
                        </p>
                        <span className="money-number text-sm shrink-0">{tone.amount}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── CRM tools, collapsed ─────────────────────────────── */}
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
                  <HalalBanner compact />
                </div>
                <div className="clay-rise">
                  <ModularDashboard businessId={businessId} clients={leads} />
                </div>

                {/* ── Verified Clients (background CRM) ───────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-5 clay-heading" style={{ fontSize: '1.25rem' }}>
                    <h2 className="font-bold" style={{ color: 'var(--warm-ink)', fontFamily: 'var(--font-headline)' }}>
                      Verified Clients
                    </h2>
                    <Link
                      to="/contact/clients"
                      className="text-sm font-bold px-4 py-2 rounded-full transition-all duration-200 clay-filter-chip clay-filter-chip--active"
                      style={{ color: 'white', backgroundColor: 'var(--clay)', boxShadow: 'var(--shadow-btn)' }}
                    >
                      View All →
                    </Link>
                  </div>

                  {leads.length === 0 ? (
                    <Card hover={false} className="text-center">
                      <div className="py-12">
                        <span className="material-symbols-outlined text-[48px] mb-4 block" style={{ color: 'var(--clay)' }}>
                          person_add
                        </span>
                        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--warm-ink)', fontFamily: 'var(--font-headline)' }}>
                          Add your first client
                        </h3>
                        <p className="mb-6" style={{ color: 'var(--soft-stone)', fontSize: '14px', maxWidth: '320px', margin: '0 auto 24px' }}>
                          Every great relationship starts here. Add a client to start tracking.
                        </p>
                        <Link
                          to="/contact/clients"
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white transition-all duration-150"
                          style={{ backgroundColor: 'var(--clay)', boxShadow: 'var(--shadow-btn)' }}
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                          Add Client
                        </Link>
                      </div>
                    </Card>
                  ) : (
                    <Card hover={false} noPadding>
                      <div>
                        {recentClients.map((lead, i) => (
                          <Link
                            key={lead.id}
                            to={`/contact/clients/${lead.id}`}
                            className="flex items-center justify-between px-7 transition-colors duration-200 clay-table-row"
                            style={{
                              height: 'var(--space-row-height)',
                              borderBottom: i < recentClients.length - 1 ? '1px solid rgba(191, 179, 163, 0.15)' : 'none',
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, var(--warm-sand) 0%, rgba(201,123,90,0.15) 100%)' }}
                              >
                                <span className="text-sm font-bold" style={{ color: 'var(--clay)' }}>
                                  {lead.name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-sm" style={{ color: 'var(--warm-ink)' }}>
                                  {lead.name}
                                </p>
                                <p style={{ color: 'var(--soft-stone)', fontSize: '12px' }}>
                                  {lead.stage || 'lead'} • {lead.totalJobs || 0} jobs
                                </p>
                              </div>
                            </div>
                            <span className="stat-number text-sm" style={{ color: 'var(--terracotta)' }}>
                              ${(lead.totalSpent || 0).toLocaleString()}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>

                {/* The pipeline summary lives here, in the background CRM. The
                    counts are computed from deals the server returned, not from
                    clients relabelled as deals. */}
                <p style={{ color: 'var(--soft-stone)', fontSize: 13 }}>
                  {activeDeals} open booking{activeDeals === 1 ? '' : 's'} in the pipeline,{' '}
                  {leads.filter((l) => l.stage === 'repeat').length} repeat,{' '}
                  {leads.filter((l) => l.stage === 'vip').length} VIP.
                </p>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
