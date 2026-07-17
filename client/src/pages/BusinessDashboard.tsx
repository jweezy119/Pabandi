import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { analyticsService, reservationService, businessService, sourcingService } from '../services/api';
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
import BusinessMap from '../components/BusinessMap';
import ReviewCarousel from '../components/ReviewCarousel';
import BusinessPabRewards from '../components/BusinessPabRewards';
import AccioDemandSourcingWidget from '../components/AccioDemandSourcingWidget';
import AlibabaQwenConsultantWidget from '../components/AlibabaQwenConsultantWidget';
import LiveSellerPanel from '../components/LiveSellerPanel';
import HospitalityPropertiesPanel from '../components/HospitalityPropertiesPanel';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RISK_COLORS: Record<string, { bg: string; text: string; }> = {
  LOW:      { bg: 'var(--color-primary-container)',   text: 'var(--color-on-primary-container)' },
  MODERATE: { bg: 'var(--color-secondary-container)',  text: 'var(--color-on-secondary-container)' },
  HIGH:     { bg: 'var(--color-tertiary-container)', text: 'var(--color-on-tertiary-container)' },
  CRITICAL: { bg: 'var(--color-error-container)',  text: 'var(--color-on-error-container)' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  CONFIRMED:  { label: 'Confirmed', bg: 'var(--color-primary-container)',   color: 'var(--color-on-primary-container)',   icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
  PENDING:    { label: 'Pending',   bg: 'var(--color-secondary-container)',  color: 'var(--color-on-secondary-container)',  icon: <ClockIcon className="h-3.5 w-3.5" /> },
  CANCELLED:  { label: 'Cancelled', bg: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)',           icon: <XCircleIcon className="h-3.5 w-3.5" /> },
  NO_SHOW:    { label: 'No-Show',   bg: 'var(--color-error-container)',  color: 'var(--color-on-error-container)',  icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" /> },
  COMPLETED:  { label: 'Completed', bg: 'var(--color-tertiary-container)',   color: 'var(--color-on-tertiary-container)',   icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
};


/* ── Clean Stat Card ── */
function StatCard({ icon, label, value, colorClass, textClass }: {
  icon: React.ReactNode; label: string; value: string | number; colorClass: string; textClass: string;
}) {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colorClass} ${textClass}`}>
        {icon}
      </div>
      <div>
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          {label}
        </p>
        <p className="font-headline text-2xl font-bold text-on-surface leading-none">{value}</p>
      </div>
    </div>
  );
}

/* ── Revenue Card ── */
function RevenueCard({ label, amount, sub, icon, bgClass, textClass }: {
  label: string; amount: string; sub: string; icon: React.ReactNode; bgClass: string; textClass: string;
}) {
  return (
    <div className={`${bgClass} relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}>
      <div className={`absolute -top-4 -right-4 opacity-10 w-24 h-24 ${textClass}`}>{icon}</div>
      <p className={`font-label text-[10px] font-bold uppercase tracking-widest ${textClass} opacity-80 mb-2`}>{label}</p>
      <p className={`font-headline text-3xl font-bold ${textClass} mb-1`}>{amount}</p>
      <p className={`font-body text-xs ${textClass} opacity-75`}>{sub}</p>
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
        <h2 className="font-headline text-lg font-bold text-on-surface tracking-tight">{title}</h2>
        {action}
      </div>
      {subtitle && <p className="font-body text-xs text-on-surface-variant mt-1">{subtitle}</p>}
    </div>
  );
}

/* ── Heatmap Cell ── */
function HeatCell({ rate, label }: { rate: number; label: string }) {
  const intensity = Math.min(rate / 40, 1);
  const isZero = rate === 0;
  const bgClass = isZero ? 'bg-primary-fixed/20 text-on-primary-fixed' : 'bg-error-container text-on-error-container';
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-label text-[11px] font-bold transition-all ${bgClass}`}
           style={{ opacity: isZero ? 1 : 0.4 + (intensity * 0.6) }}
           title={`${label}: ${rate}% no-show`}>
        {rate}%
      </div>
      <span className="font-label text-[9px] text-on-surface-variant font-semibold">{label}</span>
    </div>
  );
}

/* ── Live Pulse Indicator ── */
function LiveIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-fixed/20 border border-primary-fixed">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      <span className="font-label text-[9px] font-bold text-primary tracking-widest uppercase">Live</span>
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
    <div className="bg-gradient-to-br from-[#FF6A00]/10 to-[#FF0000]/5 border border-[#FF6A00]/30 rounded-xl p-6 mb-6">
      <SectionHeader 
        title="Accio Work: Growth Opportunities" 
        subtitle="AI-curated business expansion trends and equipment sourcing."
        action={
          <span className="flex items-center gap-1 font-label text-[10px] font-bold px-3 py-1 rounded-full bg-white text-[#FF6A00] shadow-sm uppercase tracking-widest">
            <SparklesIcon className="h-3.5 w-3.5" /> Powered by Alibaba
          </span>
        } 
      />
      
      <div className="space-y-4">
        {trends.map((trend: any) => (
          <div key={trend.id} className="bg-white rounded-lg p-5 shadow-sm border border-[#FF6A00]/20 flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-headline text-lg font-bold text-on-surface">{trend.equipmentName}</h3>
                {trend.status === 'SERVICE_LAUNCHED' && (
                  <span className="font-label text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#059669]/10 text-[#059669] uppercase tracking-wider">
                    Service Active
                  </span>
                )}
              </div>
              <p className="font-body text-sm text-on-surface-variant mb-4">{trend.description}</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Est. Cost</p>
                  <p className="font-headline text-sm font-bold">$ {(trend.estimatedCostPKR ? Number(trend.estimatedCostPKR).toLocaleString() : 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Service Price</p>
                  <p className="font-headline text-sm font-bold text-[#059669]">${trend.suggestedServicePrice}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Proj. Bookings</p>
                  <p className="font-headline text-sm font-bold">{trend.projectedBookings}/mo</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Proj. ROI</p>
                  <p className="font-headline text-sm font-bold text-primary">{trend.projectedRoiPercent}%</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-outline-variant/30 pt-4 md:pt-0 md:pl-6 min-w-[200px]">
              {trend.status === 'SERVICE_LAUNCHED' ? (
                <div className="text-center p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                  <CheckCircleIcon className="h-6 w-6 text-[#059669] mx-auto mb-1" />
                  <p className="font-body text-xs font-bold text-on-surface">Equipment Ordered & Service Live</p>
                </div>
              ) : (
                <>
                  <a href={trend.accioWorkUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 font-body text-sm font-bold px-4 py-2.5 rounded-lg border border-[#FF6A00]/50 text-[#FF6A00] hover:bg-[#FF6A00]/10 transition-colors text-center">
                    <ArrowUpRightIcon className="h-4 w-4" />
                    Source on Alibaba
                  </a>
                  <button 
                    onClick={() => { if (confirm('Order equipment via Accio and launch this new service automatically?')) launchMutation.mutate(trend.id); }}
                    disabled={launchMutation.isLoading}
                    className="flex items-center justify-center gap-2 font-body text-sm font-bold px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#FF6A00] to-[#FF0000] text-white hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
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
    </div>
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
      <div className="bg-surface min-h-screen p-8 animate-pulse text-center">
        Loading your business dashboard...
      </div>
    );
  }

  if (!business && !isFetching) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
            <CurrencyDollarIcon className="h-8 w-8" />
          </div>
          <h2 className="font-headline text-2xl font-bold mb-3 text-on-surface">No Business Registered</h2>
          <p className="font-body text-sm text-on-surface-variant leading-relaxed mb-6">
            Register your business to start managing reservations and earning with AI insights.
          </p>
          <Link to="/business/register" className="btn-primary block w-full py-3 text-center">Register Your Business</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen text-on-surface pb-24 md:pb-12 mobile-safe-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-headline text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
                Dashboard
              </h1>
              <LiveIndicator />
              <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md bg-surface-container-high border border-outline-variant/30 shadow-sm">
                <span style={{ fontSize: 14 }}>✨</span>
                <span className="font-label text-[10px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FF6A00] to-[#FF0000]">
                  Powered by Alibaba DashScope AI
                </span>
              </div>
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              Welcome back, <span className="font-semibold text-primary">{user?.firstName}</span> · {business.name}
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <Link to="/business/analytics" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 sm:py-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant touch-target flex-1 sm:flex-auto">
              <ChartBarIcon className="h-4 w-4" /> Analytics
            </Link>
            <Link to="/business/settings" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 sm:py-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant touch-target flex-1 sm:flex-auto">
              <Cog6ToothIcon className="h-4 w-4" /> Settings
            </Link>
            <Link to="/reservations/new" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 sm:py-2 rounded-xl bg-primary text-on-primary hover:opacity-90 transition-opacity shadow-sm touch-target w-full sm:w-auto">
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
            bgClass="bg-primary"
            textClass="text-on-primary"
            icon={<ShieldCheckIcon className="w-full h-full" />}
          />
          <RevenueCard
            label="Total Revenue"
            amount={`$${(a.revenue || 0).toLocaleString()}`}
            sub={`${a.completionRate || 0}% completion rate`}
            bgClass="bg-secondary-container"
            textClass="text-on-secondary-container"
            icon={<CurrencyDollarIcon className="w-full h-full" />}
          />
          <RevenueCard
            label="Revenue at Risk"
            amount={`$${(a.revenueAtRisk || 0).toLocaleString()}`}
            sub={`${upcomingRisky.length} high-risk upcoming`}
            bgClass="bg-error-container"
            textClass="text-on-error-container"
            icon={<ExclamationTriangleIcon className="w-full h-full" />}
          />
        </div>

        <BusinessPabRewards />

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard icon={<CalendarIcon className="h-6 w-6" />} label="Total Bookings" value={a.totalReservations || 0} colorClass="bg-primary-fixed" textClass="text-on-primary-fixed" />
          <StatCard icon={<CurrencyDollarIcon className="h-6 w-6" />} label="Avg. LTV" value={`$${(a.averageLtv || 154).toLocaleString()}`} colorClass="bg-tertiary-fixed" textClass="text-on-tertiary-fixed" />
          <StatCard icon={<ExclamationTriangleIcon className="h-6 w-6" />} label="No-Show Rate" value={`${a.noShowRate || 0}%`} colorClass="bg-error-container" textClass="text-on-error-container" />
          <StatCard icon={<CheckCircleIcon className="h-6 w-6" />} label="Completion" value={`${a.completionRate || 0}%`} colorClass="bg-secondary-fixed" textClass="text-on-secondary-fixed" />
          <StatCard icon={<BoltIcon className="h-6 w-6" />} label="API Usage" value={`${(a.apiCallsThisMonth || 12450).toLocaleString()}`} colorClass="bg-surface-container-high" textClass="text-on-surface" />
          <StatCard icon={<ArrowTrendingUpIcon className="h-6 w-6" />} label="Upcoming Risk" value={`${a.averageUpcomingRisk || 0}%`} colorClass="bg-secondary-container" textClass="text-on-secondary-container" />
        </div>

        {/* ── Risk Radar + Heatmap ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* AI Risk Radar */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 relative overflow-hidden">
            <SectionHeader title="AI Risk Radar" action={
              <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 9999, background: riskC.bg, color: riskC.text, border: `1px solid ${riskC.text}30`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {riskLevel}
              </span>
            } />
            <div className="flex items-center justify-center py-6">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" className="stroke-surface-container-high" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={riskC.text} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${overallRisk * 2.64} 264`} style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-headline text-3xl font-bold leading-none" style={{ color: riskC.text }}>{overallRisk}%</span>
                  <span className="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">Risk Score</span>
                </div>
              </div>
            </div>
            {(a.topRiskFactors || []).length > 0 && (
              <div className="mt-2 w-full overflow-hidden">
                <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Top Risk Factors</p>
                <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 no-scrollbar scroll-smooth">
                  {(a.topRiskFactors || []).slice(0, 4).map((f: any, i: number) => (
                    <span key={i} className="whitespace-nowrap font-label text-[9px] font-bold px-2.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-container border border-secondary-container/50">
                      {f.factor.replace(/([A-Z])/g, ' $1').trim()} ({f.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* No-Show Heatmap */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
            <SectionHeader title="No-Show Heatmap" subtitle="By day of week · % no-show rate" />
            <div className="flex flex-nowrap overflow-x-auto items-end justify-start sm:justify-between gap-3 sm:gap-2 mt-6 pb-2 no-scrollbar">
              {noShowByDay.length > 0 ? noShowByDay.map((d: any) => (
                <HeatCell key={d.day} rate={d.rate} label={DAY_NAMES[d.day]} />
              )) : DAY_NAMES.map((name, i) => (
                <HeatCell key={i} rate={0} label={name} />
              ))}
            </div>
            <p className="font-body text-xs text-on-surface-variant mt-6 text-center">
              {noShowByDay.length > 0
                ? `Highest no-show: ${DAY_NAMES[noShowByDay.reduce((max: any, d: any) => d.rate > max.rate ? d : max, noShowByDay[0]).day]}`
                : 'Heatmap populates as bookings complete'}
            </p>
          </div>
        </div>

        {/* ── AI Deposit Recommendations ── */}
        {upcomingRisky.length > 0 && (
          <div className="bg-error-container border border-error-container/50 rounded-xl p-6 mb-6">
            <SectionHeader title="AI Deposit Recommendations" action={
              <span className="flex items-center gap-1 font-label text-[9px] font-bold px-2.5 py-1 rounded-full bg-error text-on-error uppercase tracking-widest">
                <BoltIcon className="h-3.5 w-3.5" /> {upcomingRisky.length} flagged
              </span>
            } />
            <div className="flex flex-col gap-2">
              {upcomingRisky.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 transition-colors hover:bg-surface">
                  <div className="flex items-center gap-3">
                    <RiskBadge score={r.riskScore || 0} />
                    <div>
                      <p className="font-body text-sm font-bold text-on-surface">{r.customer?.firstName} {r.customer?.lastName}</p>
                      <p className="font-body text-xs text-on-surface-variant">{new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-headline text-sm font-bold text-on-surface">${(r.depositAmount || 25).toLocaleString()}</p>
                    <p className="font-body text-[10px] text-on-surface-variant">{r.depositRequired ? 'Required' : 'Recommended'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Overbooking Advisor ── */}
        {a.overbookingAdvice && (
          <div className="bg-secondary-container rounded-xl p-6 mb-6">
            <SectionHeader title="Overbooking Advisor" action={<span className="font-label text-[9px] font-bold text-on-secondary-container uppercase tracking-widest">Event Venue</span>} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Predicted No-Show', value: `${a.overbookingAdvice.predictedNoShowPercent}%`, colorClass: 'text-error' },
                { label: 'Safe Overbook Margin', value: `${a.overbookingAdvice.safeOverbookMargin}%`, colorClass: 'text-primary' },
                { label: 'Sell per 100 Capacity', value: Math.round(100 * (1 + a.overbookingAdvice.safeOverbookMargin / 100)), colorClass: 'text-tertiary' },
              ].map(s => (
                <div key={s.label} className="text-center p-4 sm:p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/10">
                  <p className={`font-headline text-2xl font-bold ${s.colorClass}`}>{s.value}</p>
                  <p className="font-body text-[10px] text-on-surface-variant mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Live Selling ── */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 mb-6">
          <SectionHeader title="Live Selling" action={<span className="font-label text-[10px] font-bold px-2 py-1 rounded-full bg-secondary-container text-on-secondary-container uppercase tracking-widest">Connected channels earn while you serve</span>} />
          <LiveSellerPanel businessId={businessId} user={user} />
        </div>

        {/* ── Accio Demand Sourcing Widget ── */}
        {businessId && <AccioDemandSourcingWidget businessId={businessId} />}

        {businessId && <LiveSellerPanel businessId={businessId} />}

        {businessId && <HospitalityPropertiesPanel />}

        {/* ── Accio Work Growth & Chat Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            {businessId && <AccioGrowthWidget businessId={businessId} />}
          </div>
          <div>
            <AlibabaQwenConsultantWidget />
          </div>
        </div>

        {/* ── Map + Reviews ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
            <SectionHeader title="Business Location" />
            <div className="w-full h-[280px] rounded-lg overflow-hidden border border-outline-variant/30">
              <BusinessMap latitude={business?.latitude || 24.8607} longitude={business?.longitude || 67.0011} name={business?.name || 'My Business'} />
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
            <SectionHeader title="Latest Reviews" action={
              <span className="font-label text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                ★ {business?.rating?.toFixed(1) || '4.5'}
              </span>
            } />
            <ReviewCarousel reviews={realReviews} />
          </div>
        </div>

        {/* ── Recent Reservations ── */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6">
          <SectionHeader
            title="Recent Reservations"
            action={
              <Link to="/reservations" className="font-body text-xs font-bold text-primary hover:underline">
                View All →
              </Link>
            }
          />
          {reservations.length > 0 ? (
            <div className="flex flex-col gap-2">
              {reservations.map((r: any) => {
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                return (
                  <div key={r.id} className="flex flex-col p-4 sm:p-3 rounded-xl sm:rounded-lg bg-surface hover:bg-surface-container-low border border-outline-variant/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4 sm:gap-2">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-full shrink-0 flex items-center justify-center font-headline text-sm sm:text-xs font-bold bg-primary-container text-on-primary-container">
                        {(r.customerName || r.customer?.firstName || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-body text-base sm:text-sm font-bold text-on-surface">{r.customerName || `${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`}</p>
                        <p className="font-body text-xs sm:text-[11px] text-on-surface-variant">{new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                      {r.riskScore != null && <RiskBadge score={r.riskScore} />}
                      
                      {r.depositStatus === 'PAID' && r.cryptoDepositTxHash?.startsWith('STAKED_') && (
                        <span className="flex items-center gap-1 font-label text-[9px] font-bold px-2.5 py-1 rounded-full bg-primary-container text-on-primary-container uppercase tracking-widest">
                          <ShieldCheckIcon className="h-3.5 w-3.5" />
                          {r.cryptoDepositTxHash.split('_')[1]} PAB Staked
                        </span>
                      )}

                      <span className="flex items-center gap-1 font-label text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest" style={{ background: sc.bg, color: sc.color }}>
                        {sc.icon} {sc.label}
                      </span>
                      {(r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                        <div className="flex flex-wrap gap-2 sm:gap-1 w-full sm:w-auto mt-2 sm:mt-0 sm:ml-1">
                          <button onClick={() => { if (confirm('Mark as completed?')) completeMutation.mutate(r.id); }}
                            className="flex-1 sm:flex-auto flex items-center justify-center font-label text-xs sm:text-[9px] font-bold px-3 py-2.5 sm:px-2 sm:py-0.5 rounded-xl sm:rounded-full bg-tertiary-container text-on-tertiary-container hover:opacity-80 transition-opacity touch-target">
                            ✓ Done
                          </button>
                          <button onClick={() => { if (confirm('Mark as no-show? We will automatically handle any deposit or staked funds.')) noShowMutation.mutate(r.id); }}
                            className="flex-1 sm:flex-auto flex items-center justify-center font-label text-xs sm:text-[9px] font-bold px-3 py-2.5 sm:px-2 sm:py-0.5 rounded-xl sm:rounded-full bg-error-container text-on-error-container hover:opacity-80 transition-opacity touch-target">
                            ✕ {r.cryptoDepositTxHash?.startsWith('STAKED_') ? 'Process No-Show' : 'No-Show'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {r.specialRequests && (
                    <div className="w-full mt-3 p-3 rounded bg-surface-container-lowest border border-outline-variant/20">
                      {r.specialRequests.startsWith('E2EE:') ? (
                        <div className="flex flex-col gap-2">
                           <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded w-fit uppercase tracking-wider">
                              <ShieldCheckIcon className="w-3 h-3" /> E2E Encrypted Note
                           </div>
                           <label className="cursor-pointer text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 w-fit">
                              Upload .pem Private Key to Decrypt
                              <input type="file" className="hidden" accept=".pem" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const text = await file.text();
                                  const base64 = text.replace(/(-----(BEGIN|END) PRIVATE KEY-----|\n|\r)/g, '');
                                  const binaryDerString = atob(base64);
                                  const binaryDer = new Uint8Array(binaryDerString.length);
                                  for (let i = 0; i < binaryDerString.length; i++) {
                                    binaryDer[i] = binaryDerString.charCodeAt(i);
                                  }
                                  const privKey = await window.crypto.subtle.importKey(
                                    "pkcs8",
                                    binaryDer.buffer,
                                    { name: "RSA-OAEP", hash: "SHA-256" },
                                    true,
                                    ["decrypt"]
                                  );
                                  
                                  const encryptedData = atob(r.specialRequests.replace('E2EE:', ''));
                                  const encryptedBuffer = new Uint8Array(encryptedData.length);
                                  for (let i = 0; i < encryptedData.length; i++) {
                                    encryptedBuffer[i] = encryptedData.charCodeAt(i);
                                  }
                                  
                                  const decryptedBuffer = await window.crypto.subtle.decrypt(
                                    { name: "RSA-OAEP" },
                                    privKey,
                                    encryptedBuffer
                                  );
                                  
                                  const decoder = new TextDecoder();
                                  alert("Decrypted Note: \n\n" + decoder.decode(decryptedBuffer));
                                } catch (err) {
                                  alert("Decryption failed. Ensure you uploaded the correct private key.");
                                }
                              }} />
                           </label>
                        </div>
                      ) : (
                        <p className="font-body text-xs text-on-surface-variant italic">"{r.specialRequests}"</p>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl p-10 text-center bg-surface border border-dashed border-outline-variant">
              <CalendarIcon className="h-10 w-10 mx-auto mb-3 text-outline" />
              <p className="font-headline text-sm font-bold mb-1 text-on-surface">No reservations yet</p>
              <p className="font-body text-[11px] text-on-surface-variant mb-4">Once you receive bookings, they'll appear here.</p>
              <Link to="/reservations/new" className="inline-flex items-center gap-2 font-body text-xs font-bold px-4 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary transition-colors">
                <PlusIcon className="h-4 w-4" /> Add First Booking
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
