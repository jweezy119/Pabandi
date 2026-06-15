import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { analyticsService, reservationService, businessService } from '../services/api';
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
} from '@heroicons/react/24/outline';
import BusinessMap from '../components/BusinessMap';
import ReviewCarousel from '../components/ReviewCarousel';
import BusinessPabRewards from '../components/BusinessPabRewards';

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

export default function BusinessDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [business, setBusiness] = useState<any>(null);

  const { data: bizData } = useQuery('my-business', async () => {
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

  if (!business) {
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
    <div className="bg-surface min-h-screen text-on-surface pb-24 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-headline text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
                Dashboard
              </h1>
              <LiveIndicator />
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              Welcome back, <span className="font-semibold text-primary">{user?.firstName}</span> · {business.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/business/settings" className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant">
              <Cog6ToothIcon className="h-4 w-4" /> Settings
            </Link>
            <Link to="/reservations/new" className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-on-primary hover:opacity-90 transition-opacity shadow-sm">
              <PlusIcon className="h-4 w-4" /> Create Booking
            </Link>
          </div>
        </div>

        {/* ── Revenue Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <RevenueCard
            label="Protected Revenue"
            amount={`PKR ${(a.protectedRevenue || 0).toLocaleString()}`}
            sub="Deposit-secured bookings"
            bgClass="bg-primary"
            textClass="text-on-primary"
            icon={<ShieldCheckIcon className="w-full h-full" />}
          />
          <RevenueCard
            label="Total Revenue"
            amount={`PKR ${(a.revenue || 0).toLocaleString()}`}
            sub={`${a.completionRate || 0}% completion rate`}
            bgClass="bg-secondary-container"
            textClass="text-on-secondary-container"
            icon={<CurrencyDollarIcon className="w-full h-full" />}
          />
          <RevenueCard
            label="Revenue at Risk"
            amount={`PKR ${(a.revenueAtRisk || 0).toLocaleString()}`}
            sub={`${upcomingRisky.length} high-risk upcoming`}
            bgClass="bg-error-container"
            textClass="text-on-error-container"
            icon={<ExclamationTriangleIcon className="w-full h-full" />}
          />
        </div>

        <BusinessPabRewards />

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<CalendarIcon className="h-6 w-6" />} label="Total Bookings" value={a.totalReservations || 0} colorClass="bg-primary-fixed" textClass="text-on-primary-fixed" />
          <StatCard icon={<CheckCircleIcon className="h-6 w-6" />} label="Completion" value={`${a.completionRate || 0}%`} colorClass="bg-tertiary-fixed" textClass="text-on-tertiary-fixed" />
          <StatCard icon={<ExclamationTriangleIcon className="h-6 w-6" />} label="No-Show Rate" value={`${a.noShowRate || 0}%`} colorClass="bg-error-container" textClass="text-on-error-container" />
          <StatCard icon={<ArrowTrendingUpIcon className="h-6 w-6" />} label="Upcoming Risk" value={`${a.averageUpcomingRisk || 0}%`} colorClass="bg-secondary-fixed" textClass="text-on-secondary-fixed" />
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
              <div className="mt-2">
                <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Top Risk Factors</p>
                <div className="flex flex-wrap gap-2">
                  {(a.topRiskFactors || []).slice(0, 4).map((f: any, i: number) => (
                    <span key={i} className="font-label text-[9px] font-bold px-2 py-1 rounded-full bg-secondary-container text-on-secondary-container border border-secondary-container/50">
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
            <div className="flex items-end justify-between gap-2 mt-6">
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
                    <p className="font-headline text-sm font-bold text-on-surface">PKR {(r.depositAmount || 1000).toLocaleString()}</p>
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
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Predicted No-Show', value: `${a.overbookingAdvice.predictedNoShowPercent}%`, colorClass: 'text-error' },
                { label: 'Safe Overbook Margin', value: `${a.overbookingAdvice.safeOverbookMargin}%`, colorClass: 'text-primary' },
                { label: 'Sell per 100 Capacity', value: Math.round(100 * (1 + a.overbookingAdvice.safeOverbookMargin / 100)), colorClass: 'text-tertiary' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-lg bg-surface-container-lowest">
                  <p className={`font-headline text-2xl font-bold ${s.colorClass}`}>{s.value}</p>
                  <p className="font-body text-[10px] text-on-surface-variant mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-container-low border border-outline-variant/30 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-headline text-xs font-bold bg-primary-container text-on-primary-container">
                        {(r.customerName || r.customer?.firstName || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-body text-sm font-bold text-on-surface">{r.customerName || `${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`}</p>
                        <p className="font-body text-[11px] text-on-surface-variant">{new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.riskScore != null && <RiskBadge score={r.riskScore} />}
                      
                      {r.depositStatus === 'PAID' && r.cryptoDepositTxHash?.startsWith('STAKED_') && (
                        <span className="flex items-center gap-1 font-label text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container uppercase tracking-widest">
                          <ShieldCheckIcon className="h-3.5 w-3.5" />
                          {r.cryptoDepositTxHash.split('_')[1]} PAB Staked
                        </span>
                      )}

                      <span className="flex items-center gap-1 font-label text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest" style={{ background: sc.bg, color: sc.color }}>
                        {sc.icon} {sc.label}
                      </span>
                      {(r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                        <div className="flex gap-1 ml-1">
                          <button onClick={() => { if (confirm('Mark as completed?')) completeMutation.mutate(r.id); }}
                            className="font-label text-[9px] font-bold px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container hover:opacity-80 transition-opacity">
                            ✓ Done
                          </button>
                          <button onClick={() => { if (confirm('Mark as no-show? This will slash any staked deposit.')) noShowMutation.mutate(r.id); }}
                            className="font-label text-[9px] font-bold px-2 py-0.5 rounded-full bg-error-container text-on-error-container hover:opacity-80 transition-opacity">
                            ✕ {r.cryptoDepositTxHash?.startsWith('STAKED_') ? 'Slash Stake' : 'No-Show'}
                          </button>
                        </div>
                      )}
                    </div>
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
