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
  StarIcon,
  ShieldCheckIcon,
  PlusIcon,
  Cog6ToothIcon,
  XCircleIcon,
  ClockIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import BusinessMap from '../components/BusinessMap';
import ReviewCarousel from '../components/ReviewCarousel';

/* ── Day names ── */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'rgba(52,211,153,0.15)', text: '#34d399' },
  MODERATE: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  HIGH: { bg: 'rgba(249,115,22,0.15)', text: '#fb923c' },
  CRITICAL: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
};

/* ── Stat Card ── */
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4"
      style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18', color }}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-slate-700" >
          {label}
        </p>
        <p className="text-2xl font-black text-slate-900" >{value}</p>
      </div>
    </div>
  );
}

/* ── Revenue Card ── */
function RevenueCard({ label, amount, sub, icon, gradient }: {
  label: string; amount: string; sub: string;
  icon: React.ReactNode; gradient: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 text-white"
      style={{ background: gradient, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
      <div className="absolute -right-4 -top-4 opacity-10">
        <div className="w-24 h-24">{icon}</div>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">{label}</p>
      <p className="text-3xl font-black mb-1">{amount}</p>
      <p className="text-xs opacity-70 flex items-center gap-1">{sub}</p>
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-lg font-bold text-slate-900" >{title}</h2>
      {action}
    </div>
  );
}

/* ── Risk Level Badge ── */
function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'MODERATE' : 'LOW';
  const c = RISK_COLORS[level];
  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: c.bg, color: c.text }}>
      {level} ({score})
    </span>
  );
}

/* ── Heatmap Cell ── */
function HeatCell({ rate, label }: { rate: number; label: string }) {
  const intensity = Math.min(rate / 40, 1); // 40% = max red
  const bg = rate === 0
    ? 'rgba(52,211,153,0.08)'
    : `rgba(239,68,68,${0.08 + intensity * 0.35})`;
  const color = rate === 0 ? '#34d399' : rate < 15 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
        style={{ background: bg, color }} title={`${label}: ${rate}% no-show`}>
        {rate}%
      </div>
      <span className="text-[9px] text-slate-600 font-medium">{label}</span>
    </div>
  );
}

/* ── Status Config ── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  CONFIRMED: { label: 'Confirmed', bg: 'rgba(16,185,129,0.12)', color: '#34d399', icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
  PENDING: { label: 'Pending', bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', icon: <ClockIcon className="h-3.5 w-3.5" /> },
  CANCELLED: { label: 'Cancelled', bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', icon: <XCircleIcon className="h-3.5 w-3.5" /> },
  NO_SHOW: { label: 'No-Show', bg: 'rgba(239,68,68,0.12)', color: '#f87171', icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" /> },
  COMPLETED: { label: 'Completed', bg: 'rgba(52,211,153,0.12)', color: '#34d399', icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
};

export default function BusinessDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [business, setBusiness] = useState<any>(null);

  // Fetch the owner's business
  const { data: bizData } = useQuery('my-business', async () => {
    // Try to get business by owner — use the businesses list endpoint
    const res = await businessService.getMyBusiness().catch(() => null);
    return res?.data?.data?.business || null;
  });

  useEffect(() => {
    if (bizData) setBusiness(bizData);
  }, [bizData]);

  const businessId = business?.id;

  // Analytics
  const { data: dashData } = useQuery(
    'dashboard-analytics',
    () => analyticsService.getDashboardAnalytics(),
    { enabled: true, refetchInterval: 60000 }
  );

  // Business-specific analytics
  const { data: bizAnalytics } = useQuery(
    ['business-analytics', businessId],
    () => businessId && businessService.getBusinessAnalytics(businessId),
    { enabled: !!businessId }
  );

  // Recent reservations
  const { data: recentRes } = useQuery(
    ['biz-reservations', businessId],
    () => businessId && businessService.getBusinessReservations(businessId, { limit: 8 }),
    { enabled: !!businessId }
  );

  const a = dashData?.data?.data?.analytics || bizAnalytics?.data?.data?.analytics || {};
  const reservations = recentRes?.data?.data?.reservations || [];
  const noShowByDay = a.noShowByDay || [];
  const upcomingRisky = a.upcomingRiskyBookings || [];

  const mockReviews = [
    { id: '1', authorName: 'Ali Khan', rating: 5, text: 'Fantastic service! Highly recommend for anyone in Karachi.', time: new Date().toISOString(), sentimentLabel: 'positive' },
    { id: '2', authorName: 'Sara Ahmed', rating: 4, text: 'The booking process was smooth and the staff was polite.', time: new Date(Date.now() - 100000).toISOString(), sentimentLabel: 'positive' },
  ];

  // ── Mutations ──
  const completeMutation = useMutation(
    (id: string) => reservationService.completeReservation(id),
    { onSuccess: () => { qc.invalidateQueries('biz-reservations'); qc.invalidateQueries('dashboard-analytics'); } }
  );
  const noShowMutation = useMutation(
    (id: string) => reservationService.markNoShow(id),
    { onSuccess: () => { qc.invalidateQueries('biz-reservations'); qc.invalidateQueries('dashboard-analytics'); } }
  );

  // Risk gauge value
  const overallRisk = a.averageUpcomingRisk || a.noShowRate || 0;
  const riskLevel = overallRisk >= 60 ? 'CRITICAL' : overallRisk >= 40 ? 'HIGH' : overallRisk >= 20 ? 'MODERATE' : 'LOW';

  if (!business) {
    return (
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}
        className="flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(59,130,246,0.12)' }}>
            <CurrencyDollarIcon className="h-8 w-8" style={{ color: '#60a5fa' }} />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-slate-900" >No Business Registered</h2>
          <p className="mb-6 text-sm text-slate-600" >
            Register your business to start managing reservations.
          </p>
          <Link to="/business/register" className="btn-primary">Register Your Business</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900" >
              Business Dashboard
            </h1>
            <p className="mt-1.5 text-sm text-slate-600" >
              Welcome back, <span style={{ color: '#60a5fa', fontWeight: 600 }}>{user?.firstName}</span>! Here's your AI business pulse.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/business/settings"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Cog6ToothIcon className="h-4 w-4" /> Settings
            </Link>
            <Link to="/reservations/new"
              className="btn-primary flex items-center gap-2 text-sm py-2.5 px-4">
              <PlusIcon className="h-4 w-4" /> Add Reservation
            </Link>
          </div>
        </div>

        {/* ── Revenue Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <RevenueCard
            label="Protected Revenue"
            amount={`PKR ${(a.protectedRevenue || 0).toLocaleString()}`}
            sub="Deposit-secured bookings"
            gradient="linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)"
            icon={<ShieldCheckIcon className="w-full h-full" style={{ color: '#60a5fa' }} />}
          />
          <RevenueCard
            label="Total Revenue"
            amount={`PKR ${(a.revenue || 0).toLocaleString()}`}
            sub={`${a.completionRate || 0}% completion rate`}
            gradient="linear-gradient(135deg, #064e3b 0%, #022c22 100%)"
            icon={<CurrencyDollarIcon className="w-full h-full" style={{ color: '#34d399' }} />}
          />
          <RevenueCard
            label="Revenue at Risk"
            amount={`PKR ${(a.revenueAtRisk || 0).toLocaleString()}`}
            sub={`${upcomingRisky.length} high-risk upcoming`}
            gradient="linear-gradient(135deg, #4c1d95 0%, #2d1163 100%)"
            icon={<ExclamationTriangleIcon className="w-full h-full" style={{ color: '#a78bfa' }} />}
          />
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<CalendarIcon className="h-5 w-5" />} label="Total Bookings" value={a.totalReservations || 0} color="#60a5fa" />
          <StatCard icon={<CheckCircleIcon className="h-5 w-5" />} label="Completion" value={`${a.completionRate || 0}%`} color="#34d399" />
          <StatCard icon={<ExclamationTriangleIcon className="h-5 w-5" />} label="No-Show Rate" value={`${a.noShowRate || 0}%`} color="#f87171" />
          <StatCard icon={<StarIcon className="h-5 w-5" />} label="Upcoming Risk" value={`${a.averageUpcomingRisk || 0}%`} color="#fbbf24" />
        </div>

        {/* ── AI Risk Radar + No-Show Heatmap ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Risk Radar */}
          <div className="rounded-2xl p-6"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader title="AI Risk Radar" action={
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: RISK_COLORS[riskLevel].bg, color: RISK_COLORS[riskLevel].text }}>
                {riskLevel}
              </span>
            } />
            <div className="flex items-center justify-center py-6">
              <div className="relative w-40 h-40">
                {/* Background ring */}
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none"
                    stroke={RISK_COLORS[riskLevel].text}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${overallRisk * 2.64} 264`}
                    style={{ transition: 'stroke-dasharray 1s ease' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900">{overallRisk}%</span>
                  <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide">Risk</span>
                </div>
              </div>
            </div>
            {/* Top risk factors */}
            {(a.topRiskFactors || []).length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">Top Risk Factors</p>
                <div className="flex flex-wrap gap-2">
                  {(a.topRiskFactors || []).slice(0, 4).map((f: any, i: number) => (
                    <span key={i} className="text-[10px] font-medium px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                      {f.factor.replace(/([A-Z])/g, ' $1').trim()} ({f.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* No-Show Heatmap by Day */}
          <div className="rounded-2xl p-6"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader title="No-Show Heatmap" action={
              <span className="text-xs text-slate-600 font-medium">By Day of Week</span>
            } />
            <div className="flex items-end justify-between gap-2 mt-4">
              {noShowByDay.length > 0 ? noShowByDay.map((d: any) => (
                <HeatCell key={d.day} rate={d.rate} label={DAY_NAMES[d.day]} />
              )) : DAY_NAMES.map((name, i) => (
                <HeatCell key={i} rate={0} label={name} />
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-4 text-center">
              {noShowByDay.length > 0
                ? `Highest no-show: ${DAY_NAMES[noShowByDay.reduce((max: any, d: any) => d.rate > max.rate ? d : max, noShowByDay[0]).day]}`
                : 'No historical data yet — heatmap populates as bookings complete'}
            </p>
          </div>
        </div>

        {/* ── Deposit Recommendations (risky upcoming) ── */}
        {upcomingRisky.length > 0 && (
          <div className="rounded-2xl p-6 mb-8"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader title="AI Deposit Recommendations" action={
              <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
                <BoltIcon className="h-3.5 w-3.5" /> {upcomingRisky.length} flagged
              </span>
            } />
            <div className="space-y-3">
              {upcomingRisky.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3">
                    <RiskBadge score={r.riskScore || 0} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {r.customer?.firstName} {r.customer?.lastName}
                      </p>
                      <p className="text-xs text-slate-600">
                        {new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      PKR {(r.depositAmount || 1000).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {r.depositRequired ? 'Deposit required' : 'Recommended'} · Applied to bill
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Overbooking Advisor (Event Venues) ── */}
        {a.overbookingAdvice && (
          <div className="rounded-2xl p-6 mb-8"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))', border: '1px solid rgba(139,92,246,0.15)' }}>
            <SectionHeader title="Overbooking Advisor" action={
              <span className="text-xs font-bold text-violet-400">EVENT VENUE</span>
            } />
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-black text-slate-900">{a.overbookingAdvice.predictedNoShowPercent}%</p>
                <p className="text-xs text-slate-600 mt-1">Predicted No-Show</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black" style={{ color: '#a78bfa' }}>{a.overbookingAdvice.safeOverbookMargin}%</p>
                <p className="text-xs text-slate-600 mt-1">Safe Overbook Margin</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black" style={{ color: '#34d399' }}>
                  {Math.round(100 * (1 + a.overbookingAdvice.safeOverbookMargin / 100))}
                </p>
                <p className="text-xs text-slate-600 mt-1">Sell per 100 Capacity</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Map + Reviews ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 rounded-2xl p-6"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader title="Business Location" />
            <div className="w-full h-72 rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <BusinessMap
                latitude={business?.latitude || 24.8607}
                longitude={business?.longitude || 67.0011}
                name={business?.name || 'My Business'}
              />
            </div>
          </div>
          <div className="rounded-2xl p-6"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader title="Latest Google Reviews" action={
              <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                ★ {business?.rating?.toFixed(1) || '4.5'}
              </span>
            } />
            <ReviewCarousel reviews={a.reviews || mockReviews} />
          </div>
        </div>

        {/* ── Recent Reservations Table ── */}
        <div className="rounded-2xl p-6"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <SectionHeader
            title="Recent Reservations"
            action={
              <Link to="/reservations" className="text-sm font-semibold flex items-center gap-1" style={{ color: '#60a5fa' }}>
                View All →
              </Link>
            }
          />
          {reservations.length > 0 ? (
            <div className="space-y-3">
              {reservations.map((r: any) => {
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                return (
                  <div key={r.id} className="flex items-center justify-between p-4 rounded-xl transition-all"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{r.customerName || `${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`}</p>
                        <p className="text-xs text-slate-600">
                          {new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.riskScore != null && <RiskBadge score={r.riskScore} />}
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
                        style={{ background: sc.bg, color: sc.color }}>
                        {sc.icon} {sc.label}
                      </span>
                      {/* Action buttons for CONFIRMED reservations */}
                      {(r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                        <div className="flex gap-1.5 ml-2">
                          <button onClick={() => { if (confirm('Mark as completed?')) completeMutation.mutate(r.id); }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
                            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                            ✓ Complete
                          </button>
                          <button onClick={() => { if (confirm('Mark as no-show?')) noShowMutation.mutate(r.id); }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            ✕ No-Show
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl py-14 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <CalendarIcon className="h-10 w-10 mx-auto mb-3 text-slate-800" />
              <p className="text-sm font-medium mb-1 text-slate-600" >No recent reservations yet</p>
              <p className="text-xs text-slate-800" >Once you receive bookings, they'll appear here.</p>
              <Link to="/reservations/new"
                className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                <PlusIcon className="h-4 w-4" /> Add First Reservation
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
