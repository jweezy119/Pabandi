import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { analyticsService, reservationService, businessService, sourcingService, openwaService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  PlusIcon,
  Cog6ToothIcon,
  XCircleIcon,
  ClockIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  ShoppingCartIcon,
  SparklesIcon,
  ArrowUpRightIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { Surface, tokens } from '../design-system';
import BusinessMap from '../components/BusinessMap';
import ReviewCarousel from '../components/ReviewCarousel';
import BusinessPabRewards from '../components/BusinessPabRewards';
import AccioDemandSourcingWidget from '../components/AccioDemandSourcingWidget';
import AlibabaQwenConsultantWidget from '../components/AlibabaQwenConsultantWidget';
import LiveSellerPanel from '../components/LiveSellerPanel';
import HospitalityPropertiesPanel from '../components/HospitalityPropertiesPanel';
import PaymentLinkGenerator from '../components/PaymentLinkGenerator';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RISK_COLORS: Record<string, { bg: string; text: string; }> = {
  LOW:      { bg: 'rgba(129,140,248,0.12)', text: tokens.color.primary },
  MODERATE: { bg: 'rgba(192,132,252,0.12)', text: tokens.color.secondary },
  HIGH:     { bg: 'rgba(56,189,248,0.12)', text: tokens.color.accent },
  CRITICAL: { bg: 'rgba(239,68,68,0.12)', text: tokens.color.danger },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  CONFIRMED:  { label: 'Confirmed', bg: 'rgba(129,140,248,0.12)', color: tokens.color.primary, icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
  PENDING:    { label: 'Pending',   bg: 'rgba(192,132,252,0.12)', color: tokens.color.secondary, icon: <ClockIcon className="h-3.5 w-3.5" /> },
  CANCELLED:  { label: 'Cancelled', bg: 'rgba(148,163,184,0.10)', color: tokens.color.muted,           icon: <XCircleIcon className="h-3.5 w-3.5" /> },
  NO_SHOW:    { label: 'No-Show',   bg: 'rgba(239,68,68,0.10)', color: tokens.color.danger, icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" /> },
  COMPLETED:  { label: 'Completed', bg: 'rgba(34,197,94,0.10)', color: tokens.color.success, icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
};

/* ── Clean Stat Card ── */
function StatCard({ icon, label, value, color, textColor }: {
  icon: React.ReactNode; label: string; value: string | number; color: string; textColor: string;
}) {
  return (
    <Surface className="items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: color, color: textColor }}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: tokens.color.muted }}>
          {label}
        </p>
        <p className="font-headline text-2xl font-bold leading-none" style={{ color: tokens.color.text }}>{value}</p>
      </div>
    </Surface>
  );
}

/* ── Revenue Card ── */
function RevenueCard({ label, amount, sub, icon, color }: {
  label: string; amount: string; sub: string; icon: React.ReactNode; color: string; textColor: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]" style={{ background: color }}>
      <div className="absolute -top-4 -right-4 opacity-10 w-24 h-24">{icon}</div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>{label}</p>
      <p className="font-headline text-3xl font-bold mb-1" style={{ color: '#ffffff' }}>{amount}</p>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{sub}</p>
    </div>
  );
}

/* ── Risk Badge ── */
function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'MODERATE' : 'LOW';
  const c = RISK_COLORS[level];
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 9999,
      background: c.bg, color: c.text, border: `1px solid ${c.text}30`,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {level} {score}
    </span>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, action, subtitle }: { title: string; action?: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between">
        <h2 className="font-headline text-lg font-bold tracking-tight" style={{ color: tokens.color.text }}>{title}</h2>
        {action}
      </div>
      {subtitle && <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>{subtitle}</p>}
    </div>
  );
}

/* ── Heatmap Cell ── */
function HeatCell({ rate, label }: { rate: number; label: string }) {
  const intensity = Math.min(rate / 40, 1);
  const isZero = rate === 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg text-[11px] font-bold transition-all"
        style={{
          background: isZero ? 'rgba(129,140,248,0.10)' : 'rgba(239,68,68,0.12)',
          color: isZero ? tokens.color.primary : tokens.color.danger,
          opacity: isZero ? 1 : 0.4 + (intensity * 0.6)
        }}
        title={`${label}: ${rate}% no-show`}
      >
        {rate}%
      </div>
      <span className="text-[9px] font-semibold" style={{ color: tokens.color.muted }}>{label}</span>
    </div>
  );
}

/* ── Live Pulse Indicator ── */
function LiveIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ background: 'rgba(129,140,248,0.10)', borderColor: 'rgba(129,140,248,0.25)' }}>
      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: tokens.color.primary }} />
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: tokens.color.primary }}>Live</span>
    </div>
  );
}

/* ── Accio Work Growth Widget (Trend-to-Service) ── */
function AccioGrowthWidget({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(['trends', businessId], () => sourcingService.getTrends(), { enabled: !!businessId });
  const launchMutation = useMutation((trendId: string) => sourcingService.launchTrend(trendId), {
    onSuccess: () => qc.invalidateQueries(['trends', businessId]),
  });

  if (isLoading || !data?.data) return null;

  const trends = data.data.trends || [];

  if (trends.length === 0) return null;

  return (
    <Surface className="mb-6">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-lg font-bold tracking-tight" style={{ color: tokens.color.text }}>Accio Work: Growth Opportunities</h2>
            <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>AI-curated business expansion trends and equipment sourcing.</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full text-white shadow-sm uppercase tracking-widest" style={{ background: '#FF6A00' }}>
            <SparklesIcon className="h-3.5 w-3.5" /> Powered by Alibaba
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {trends.map((trend: any) => (
          <div key={trend.id} className="rounded-xl p-5 shadow-sm border transition-colors flex flex-col md:flex-row justify-between gap-6" style={{ background: tokens.color.surface, borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-headline text-lg font-bold" style={{ color: tokens.color.text }}>{trend.equipmentName}</h3>
                {trend.status === 'SERVICE_LAUNCHED' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e' }}>
                    Service Active
                  </span>
                )}
              </div>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>{trend.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: tokens.color.muted }}>Est. Cost</p>
                  <p className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>$ {(trend.estimatedCostPKR ? Number(trend.estimatedCostPKR).toLocaleString() : 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: tokens.color.muted }}>Service Price</p>
                  <p className="font-headline text-sm font-bold" style={{ color: '#22c55e' }}>${trend.suggestedServicePrice}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: tokens.color.muted }}>Proj. Bookings</p>
                  <p className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>{trend.projectedBookings}/mo</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: tokens.color.muted }}>Proj. ROI</p>
                  <p className="font-headline text-sm font-bold" style={{ color: tokens.color.primary }}>{trend.projectedRoiPercent}%</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l md:pl-6 min-w-[200px]" style={{ borderColor: tokens.color.borderSubtle }}>
              {trend.status === 'SERVICE_LAUNCHED' ? (
                <div className="text-center p-3 rounded-xl border" style={{ background: tokens.color.background, borderColor: tokens.color.borderSubtle }}>
                  <CheckCircleIcon className="h-6 w-6 mx-auto mb-1" style={{ color: '#22c55e' }} />
                  <p className="text-xs font-bold" style={{ color: tokens.color.text }}>Equipment Ordered &amp; Service Live</p>
                </div>
              ) : (
                <>
                  <a href={trend.accioWorkUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg border text-center transition-colors" style={{ borderColor: 'rgba(255,106,0,0.5)', color: '#FF6A00' }}>
                    <ArrowUpRightIcon className="h-4 w-4" />
                    Source on Alibaba
                  </a>
                  <button
                    onClick={() => { if (confirm('Order equipment via Accio and launch this new service automatically?')) launchMutation.mutate(trend.id); }}
                    disabled={launchMutation.isLoading}
                    className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg text-white transition-opacity shadow-md disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #FF6A00, #FF0000)' }}
                  >
                    <ShoppingCartIcon className="h-4 w-4" />
                    {launchMutation.isLoading ? 'Launching...' : '1-Click Launch'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export default function BusinessDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [business, setBusiness] = useState<any>(null);

  const { data: bizData, isLoading: isBizLoading, isFetching } = useQuery('my-business', async () => {
    const res = await businessService.getMyBusiness().catch(() => null);
    return res?.data?.data?.business || null;
  });

  useEffect(() => { if (bizData) setBusiness(bizData); }, [bizData]);

  const businessId = business?.id;

  const { data: dashData } = useQuery('dashboard-analytics', () => analyticsService.getDashboardAnalytics(), { enabled: true, refetchInterval: 60000 });
  const { data: bizAnalytics } = useQuery(['business-analytics', businessId], () => businessId && businessService.getBusinessAnalytics(businessId), { enabled: !!businessId });
  const { data: recentRes } = useQuery(['biz-reservations', businessId], () => businessId && businessService.getBusinessReservations(businessId, { limit: 8 }), { enabled: !!businessId });

  const a = dashData?.data?.data?.analytics || bizAnalytics?.data?.data?.analytics || {};
  const reservations = recentRes?.data?.data?.reservations || [];
  const noShowByDay = a.noShowByDay || [];
  const upcomingRisky = a.upcomingRiskyBookings || [];

  const { data: reviewsData } = useQuery(
    ['business-reviews', businessId],
    () => businessId && businessService.getBusinessReviews(businessId),
    { enabled: !!businessId }
  );

  const realReviews = reviewsData?.data?.data?.reviews || [];

  const completeMutation = useMutation((id: string) => reservationService.completeReservation(id), {
    onSuccess: () => { qc.invalidateQueries('biz-reservations'); qc.invalidateQueries('dashboard-analytics'); qc.invalidateQueries('business-pab-rewards'); },
  });
  const noShowMutation = useMutation((id: string) => reservationService.markNoShow(id), {
    onSuccess: () => { qc.invalidateQueries('biz-reservations'); qc.invalidateQueries('dashboard-analytics'); qc.invalidateQueries('business-pab-rewards'); },
  });

  const overallRisk = a.averageUpcomingRisk || a.noShowRate || 0;
  const riskLevel = overallRisk >= 60 ? 'CRITICAL' : overallRisk >= 40 ? 'HIGH' : overallRisk >= 20 ? 'MODERATE' : 'LOW';
  const riskC = RISK_COLORS[riskLevel];

  if (isBizLoading || (!business && isFetching)) {
    return (
      <div className="min-h-screen p-8 animate-pulse text-center" style={{ background: tokens.color.background }}>
        Loading your business dashboard...
      </div>
    );
  }

  if (!business && !isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: tokens.color.background }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center border" style={{ background: 'rgba(129,140,248,0.15)', color: tokens.color.primary, borderColor: 'rgba(129,140,248,0.25)' }}>
            <CurrencyDollarIcon className="h-8 w-8" />
          </div>
          <h2 className="font-headline text-2xl font-bold mb-3" style={{ color: tokens.color.text }}>No Business Registered</h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: tokens.color.muted }}>
            Register your business to start managing reservations and earning with AI insights.
          </p>
          <Link to="/business/register" className="block w-full py-3 text-center rounded-xl text-white font-bold">Register Your Business</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-12 mobile-safe-bottom" style={{ background: tokens.color.background }}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-headline text-2xl md:text-3xl font-bold tracking-tight" style={{ color: tokens.color.text }}>
                Dashboard
              </h1>
              <LiveIndicator />
              <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border shadow-sm">
                <span style={{ fontSize: 14 }}>✨</span>
                <span className="text-[10px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FF6A00] to-[#FF0000]">
                  Powered by Alibaba DashScope AI
                </span>
              </div>
            </div>
            <p className="text-sm" style={{ color: tokens.color.muted }}>
              Welcome back, <span className="font-semibold" style={{ color: tokens.color.primary }}>{user?.firstName}</span> · {business.name}
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <Link to="/business/analytics" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 sm:py-2 rounded-xl border transition-colors flex-1 sm:flex-auto" style={{ background: tokens.color.surface, borderColor: tokens.color.border, color: tokens.color.muted }}>
              <ChartBarIcon className="h-4 w-4" /> Analytics
            </Link>
            <Link to="/business/settings" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 sm:py-2 rounded-xl border transition-colors flex-1 sm:flex-auto" style={{ background: tokens.color.surface, borderColor: tokens.color.border, color: tokens.color.muted }}>
              <Cog6ToothIcon className="h-4 w-4" /> Settings
            </Link>
            <Link to="/reservations/new" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 sm:py-2 rounded-xl shadow-sm w-full sm:w-auto transition-opacity hover:opacity-90" style={{ background: tokens.color.primary, color: tokens.color.background }}>
              <PlusIcon className="h-4 w-4" /> Create Booking
            </Link>
          </div>
        </div>

        {/* ── Revenue Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <RevenueCard
            label="Protected Revenue"
            amount={`$${(a.protectedRevenue || 0).toLocaleString()}`}
            sub="Deposit-secured bookings"
            color={tokens.color.primary}
            textColor={tokens.color.background}
            icon={<ShieldCheckIcon className="w-full h-full" />}
          />
          <RevenueCard
            label="Total Revenue"
            amount={`$${(a.revenue || 0).toLocaleString()}`}
            sub={`${a.completionRate || 0}% completion rate`}
            color={tokens.color.secondary}
            textColor={tokens.color.background}
            icon={<CurrencyDollarIcon className="w-full h-full" />}
          />
          <RevenueCard
            label="Revenue at Risk"
            amount={`$${(a.revenueAtRisk || 0).toLocaleString()}`}
            sub={`${upcomingRisky.length} high-risk upcoming`}
            color={tokens.color.danger}
            textColor="#ffffff"
            icon={<ExclamationTriangleIcon className="w-full h-full" />}
          />
        </div>

        <BusinessPabRewards />
        {/* ── WhatsApp OpenWA Status ── */}
        <OpenWAStatusPanel />

        {/* ── Passport Dashboard Link ── */}
        <div className="rounded-xl p-6 mb-8 border" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: tokens.color.muted }}>Breakthrough Trust</p>
              <h3 className="font-headline text-lg font-bold" style={{ color: tokens.color.text }}>Passport Dashboard</h3>
              <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Review your multi-axis score, vouch strength, and staked proof.</p>
            </div>
            <Link to="/passport/dashboard" className="px-3 py-2 rounded-xl text-sm font-bold shadow-sm" style={{ background: tokens.color.primary, color: tokens.color.background }}>Open</Link>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={<CalendarIcon className="h-6 w-6" />} label="Total Bookings" value={a.totalReservations || 0} color="rgba(129,140,248,0.10)" textColor={tokens.color.primary} />
          <StatCard icon={<CurrencyDollarIcon className="h-6 w-6" />} label="Avg. LTV" value={`$${(a.averageLtv || 154).toLocaleString()}`} color="rgba(192,132,252,0.10)" textColor={tokens.color.secondary} />
          <StatCard icon={<ExclamationTriangleIcon className="h-6 w-6" />} label="No-Show Rate" value={`${a.noShowRate || 0}%`} color="rgba(239,68,68,0.10)" textColor={tokens.color.danger} />
          <StatCard icon={<CheckCircleIcon className="h-6 w-6" />} label="Completion" value={`${a.completionRate || 0}%`} color="rgba(192,132,252,0.10)" textColor={tokens.color.secondary} />
          <StatCard icon={<BoltIcon className="h-6 w-6" />} label="API Usage" value={`${(a.apiCallsThisMonth || 12450).toLocaleString()}`} color="rgba(148,163,184,0.08)" textColor={tokens.color.text} />
          <StatCard icon={<ArrowTrendingUpIcon className="h-6 w-6" />} label="Upcoming Risk" value={`${a.averageUpcomingRisk || 0}%`} color="rgba(192,132,252,0.10)" textColor={tokens.color.secondary} />
        </div>

        {/* ── Risk Radar + Heatmap ── */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* AI Risk Radar */}
          <div className="rounded-xl p-6 relative overflow-hidden border" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
            <SectionHeader title="AI Risk Radar" action={
              <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 9999, background: riskC.bg, color: riskC.text, border: `1px solid ${riskC.text}30`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {riskLevel}
              </span>
            } />
            <div className="flex items-center justify-center py-6">
              <div className="relative h-40 w-40">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" className="stroke-surface-container-high" strokeWidth="8" style={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={riskC.text} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${overallRisk * 2.64} 264`} style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-headline text-3xl font-bold leading-none" style={{ color: riskC.text }}>{overallRisk}%</span>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: tokens.color.muted }}>Risk Score</span>
                </div>
              </div>
            </div>
            {(a.topRiskFactors || []).length > 0 && (
              <div className="mt-2 w-full overflow-hidden">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: tokens.color.muted }}>Top Risk Factors</p>
                <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2">
                  {(a.topRiskFactors || []).slice(0, 4).map((f: any, i: number) => (
                    <span key={i} className="whitespace-nowrap text-[9px] font-bold px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(192,132,252,0.10)', color: tokens.color.secondary }}>
                      {f.factor.replace(/([A-Z])/g, ' $1').trim()} ({f.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* No-Show Heatmap */}
          <div className="rounded-xl p-6 border" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
            <SectionHeader title="No-Show Heatmap" subtitle="By day of week · % no-show rate" />
            <div className="mt-6 flex flex-nowrap overflow-x-auto items-end justify-between gap-3 sm:gap-2 pb-2">
              {noShowByDay.length > 0 ? noShowByDay.map((d: any) => (
                <HeatCell key={d.day} rate={d.rate} label={DAY_NAMES[d.day]} />
              )) : DAY_NAMES.map((name, i) => (
                <HeatCell key={i} rate={0} label={name} />
              ))}
            </div>
            <p className="mt-6 text-center text-xs" style={{ color: tokens.color.muted }}>
              {noShowByDay.length > 0
                ? `Highest no-show: ${DAY_NAMES[noShowByDay.reduce((max: any, d: any) => d.rate > max.rate ? d : max, noShowByDay[0]).day]}`
                : 'Heatmap populates as bookings complete'}
            </p>
          </div>
        </div>

        {/* ── AI Deposit Recommendations ── */}
        {upcomingRisky.length > 0 && (
          <div className="mb-6 rounded-xl p-6 border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)' }}>
            <SectionHeader title="AI Deposit Recommendations" action={
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full text-white uppercase tracking-widest">
                <BoltIcon className="h-3.5 w-3.5" /> {upcomingRisky.length} flagged
              </span>
            } />
            <div className="flex flex-col gap-2">
              {upcomingRisky.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-colors" style={{ background: tokens.color.background, borderColor: tokens.color.border }}>
                  <div className="flex items-center gap-3">
                    <RiskBadge score={r.riskScore || 0} />
                    <div>
                      <p className="text-sm font-bold" style={{ color: tokens.color.text }}>{r.customer?.firstName} {r.customer?.lastName}</p>
                      <p className="text-xs" style={{ color: tokens.color.muted }}>{new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>${(r.depositAmount || 25).toLocaleString()}</p>
                    <p className="text-[10px] font-medium" style={{ color: tokens.color.muted }}>{r.depositRequired ? 'Required' : 'Recommended'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Overbooking Advisor ── */}
        {a.overbookingAdvice && (
          <div className="mb-6 rounded-xl p-6 border" style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.20)' }}>
            <SectionHeader title="Overbooking Advisor" action={<span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: tokens.color.accent }}>Event Venue</span>} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: 'Predicted No-Show', value: `${a.overbookingAdvice.predictedNoShowPercent}%`, color: tokens.color.danger },
                { label: 'Safe Overbook Margin', value: `${a.overbookingAdvice.safeOverbookMargin}%`, color: tokens.color.primary },
                { label: 'Sell per 100 Capacity', value: Math.round(100 * (1 + a.overbookingAdvice.safeOverbookMargin / 100)), color: tokens.color.accent },
              ].map(s => (
                <div key={s.label} className="text-center p-4 sm:p-3 rounded-lg border" style={{ background: tokens.color.background, borderColor: tokens.color.borderSubtle }}>
                  <p className="font-headline text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="mt-1 text-[10px]" style={{ color: tokens.color.muted }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Live Selling ── */}
        <div className="mb-6 rounded-xl p-6 border" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <SectionHeader title="Live Selling" action={<span className="text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-widest" style={{ background: 'rgba(192,132,252,0.10)', color: tokens.color.secondary, borderColor: 'rgba(192,132,252,0.25)' }}>Connected channels earn while you serve</span>} />
          <LiveSellerPanel businessId={businessId} user={user} />
        </div>

        {/* ── Accio Demand Sourcing Widget ── */}
        {businessId && <AccioDemandSourcingWidget businessId={businessId} />}

        {businessId && (
          <div className="mb-6">
            <PaymentLinkGenerator />
          </div>
        )}

        {businessId && <HospitalityPropertiesPanel />}

        {/* ── Accio Work Growth & Chat Grid ── */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {businessId && <AccioGrowthWidget businessId={businessId} />}
          </div>
          <div>
            <AlibabaQwenConsultantWidget />
          </div>
        </div>

        {/* ── Map + Reviews ── */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl p-6 border" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
            <SectionHeader title="Business Location" />
            <div className="h-[280px] w-full overflow-hidden rounded-lg border" style={{ borderColor: tokens.color.border }}>
              <BusinessMap latitude={business?.latitude || 24.8607} longitude={business?.longitude || 67.0011} name={business?.name || 'My Business'} />
            </div>
          </div>
          <div className="rounded-xl p-6 border" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
            <SectionHeader title="Latest Reviews" action={
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(192,132,252,0.10)', color: tokens.color.secondary }}>
                ★ {business?.rating?.toFixed(1) || '4.5'}
              </span>
            } />
            <ReviewCarousel reviews={realReviews} />
          </div>
        </div>

        {/* ── Recent Reservations ── */}
        <div className="rounded-xl p-6 border" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
          <SectionHeader
            title="Recent Reservations"
            action={
              <Link to="/reservations" className="text-xs font-bold hover:underline" style={{ color: tokens.color.primary }}>
                View All →
              </Link>
            }
          />
          {reservations.length > 0 ? (
            <div className="flex flex-col gap-2">
              {reservations.map((r: any) => {
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                return (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-2 p-4 sm:p-3 rounded-xl sm:rounded-lg border transition-colors" style={{ background: tokens.color.background, borderColor: tokens.color.borderSubtle }}>
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-headline text-sm sm:text-xs font-bold" style={{ background: 'rgba(129,140,248,0.15)', color: tokens.color.primary }}>
                        {(r.customerName || r.customer?.firstName || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-base sm:text-sm font-bold" style={{ color: tokens.color.text }}>{r.customerName || `${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`}</p>
                        <p className="text-xs sm:text-[11px]" style={{ color: tokens.color.muted }}>{new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                      {r.riskScore != null && <RiskBadge score={r.riskScore} />}

                      {r.depositStatus === 'PAID' && r.cryptoDepositTxHash?.startsWith('STAKED_') && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest" style={{ background: 'rgba(129,140,248,0.12)', color: tokens.color.primary }}>
                          <ShieldCheckIcon className="h-3.5 w-3.5" />
                          {r.cryptoDepositTxHash.split('_')[1]} PAB Staked
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest" style={{ background: sc.bg, color: sc.color }}>
                        {sc.icon} {sc.label}
                      </span>
                      {(r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                        <div className="flex flex-wrap gap-2 sm:gap-1 w-full sm:w-auto mt-2 sm:mt-0 sm:ml-1">
                          <button onClick={() => { if (confirm('Mark as completed?')) completeMutation.mutate(r.id); }}
                            className="flex-1 sm:flex-auto flex items-center justify-center text-xs sm:text-[9px] font-bold px-3 py-2.5 sm:px-2 sm:py-0.5 rounded-xl sm:rounded-full transition-opacity" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                            ✓ Done
                          </button>
                          <button onClick={() => { if (confirm('Mark as no-show? We will automatically handle any deposit or staked funds.')) noShowMutation.mutate(r.id); }}
                            className="flex-1 sm:flex-auto flex items-center justify-center text-xs sm:text-[9px] font-bold px-3 py-2.5 sm:px-2 sm:py-0.5 rounded-xl sm:rounded-full transition-opacity" style={{ background: 'rgba(239,68,68,0.10)', color: tokens.color.danger }}>
                            ✕ {r.cryptoDepositTxHash?.startsWith('STAKED_') ? 'Process No-Show' : 'No-Show'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center" style={{ borderColor: tokens.color.border }}>
              <CalendarIcon className="mx-auto mb-3 h-10 w-10" style={{ color: 'rgba(148,163,184,0.35)' }} />
              <p className="mb-1 text-sm font-bold" style={{ color: tokens.color.text }}>No reservations yet</p>
              <p className="mb-4 text-[11px]" style={{ color: tokens.color.muted }}>Once you receive bookings, they'll appear here.</p>
              <Link to="/reservations/new" className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg transition-colors" style={{ background: 'rgba(129,140,248,0.12)', color: tokens.color.primary }}>
                <PlusIcon className="h-4 w-4" /> Add First Booking
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ── OpenWA WhatsApp Status Panel ── */
function OpenWAStatusPanel() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [connectedCount, setConnectedCount] = useState(0);
  const [bestSessionId, setBestSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await openwaService.getStatus();
        const data = res.data as any;
        if (cancelled) return;
        setStatus(data?.status === 'connected' ? 'connected' : 'disconnected');
        setConnectedCount(typeof data?.connectedCount === 'number' ? data.connectedCount : 0);
        setBestSessionId(typeof data?.bestSessionId === 'string' ? data.bestSessionId : null);
      } catch {
        if (!cancelled) setStatus('disconnected');
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const tone =
    status === 'connected'
      ? 'rgba(34,197,94,0.10)'
      : 'rgba(255,255,255,0.05)';
  const borderTone =
    status === 'connected'
      ? 'rgba(34,197,94,0.30)'
      : 'rgba(255,255,255,0.10)';
  const textTone =
    status === 'connected'
      ? '#4ade80'
      : 'rgba(255,255,255,0.80)';
  const label =
    status === 'connected'
      ? 'OpenWA Connected'
      : status === 'loading'
        ? 'Checking OpenWA...'
        : 'OpenWA Disconnected';

  return (
    <div className="mb-8 rounded-xl p-6 border" style={{ background: tokens.color.surface, borderColor: tokens.color.border }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: tokens.color.muted }}>Customer Messaging</p>
          <h3 className="font-headline text-lg font-bold" style={{ color: tokens.color.text }}>WhatsApp Outreach</h3>
          <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>
            {connectedCount > 0 ? `${connectedCount} session${connectedCount === 1 ? '' : 's'} ready` : 'No active WhatsApp sessions'}{bestSessionId ? ` • ${bestSessionId}` : ''}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border" style={{ background: tone, borderColor: borderTone, color: textTone }}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {label}
        </span>
      </div>
    </div>
  );
}
