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

const RISK_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  LOW:      { bg: 'rgba(0,255,176,0.12)',   text: '#00FFB0', glow: 'rgba(0,255,176,0.3)' },
  MODERATE: { bg: 'rgba(255,184,48,0.12)',  text: '#FFB830', glow: 'rgba(255,184,48,0.3)' },
  HIGH:     { bg: 'rgba(255,107,157,0.12)', text: '#FF6B9D', glow: 'rgba(255,107,157,0.3)' },
  CRITICAL: { bg: 'rgba(255,76,106,0.12)',  text: '#FF4C6A', glow: 'rgba(255,76,106,0.3)' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; glow: string; icon: React.ReactNode }> = {
  CONFIRMED:  { label: 'Confirmed', bg: 'rgba(0,255,176,0.1)',   color: '#00FFB0', glow: 'rgba(0,255,176,0.2)',   icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
  PENDING:    { label: 'Pending',   bg: 'rgba(255,184,48,0.1)',  color: '#FFB830', glow: 'rgba(255,184,48,0.2)',  icon: <ClockIcon className="h-3.5 w-3.5" /> },
  CANCELLED:  { label: 'Cancelled', bg: 'rgba(107,127,163,0.1)', color: '#6b7fa3', glow: 'transparent',           icon: <XCircleIcon className="h-3.5 w-3.5" /> },
  NO_SHOW:    { label: 'No-Show',   bg: 'rgba(255,76,106,0.1)',  color: '#FF4C6A', glow: 'rgba(255,76,106,0.2)',  icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" /> },
  COMPLETED:  { label: 'Completed', bg: 'rgba(0,229,255,0.1)',   color: '#00E5FF', glow: 'rgba(0,229,255,0.2)',   icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
};



/* ── Neon Stat Card ── */
function StatCard({ icon, label, value, color, glow }: {
  icon: React.ReactNode; label: string; value: string | number; color: string; glow: string;
}) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${color}22`,
      borderRadius: '1.25rem', padding: '1.25rem',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'all 0.3s ease',
      boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px rgba(0,0,0,0.4), 0 0 30px ${glow}`;
        (e.currentTarget as HTMLElement).style.borderColor = color + '44';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px rgba(0,0,0,0.3)`;
        (e.currentTarget as HTMLElement).style.borderColor = color + '22';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Glow orb bg */}
      <div style={{
        position: 'absolute', width: 80, height: 80, top: -20, right: -20,
        borderRadius: '50%', background: `radial-gradient(circle, ${glow}, transparent)`,
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: color + '18', color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${color}30`,
        boxShadow: `0 0 16px ${glow}`,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>{value}</p>
      </div>
    </div>
  );
}

/* ── Revenue Card ── */
function RevenueCard({ label, amount, sub, icon, gradient, glowColor }: {
  label: string; amount: string; sub: string; icon: React.ReactNode; gradient: string; glowColor: string;
}) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: '1.25rem', padding: '1.5rem',
      background: gradient,
      border: `1px solid ${glowColor}30`,
      boxShadow: `0 12px 40px rgba(0,0,0,0.4), 0 0 40px ${glowColor}15`,
      transition: 'all 0.3s ease',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.01)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px rgba(0,0,0,0.5), 0 0 60px ${glowColor}25`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px rgba(0,0,0,0.4), 0 0 40px ${glowColor}15`;
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.12, width: 80, height: 80 }}>{icon}</div>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.7, marginBottom: 10, color: '#e8eef8' }}>{label}</p>
      <p style={{ fontSize: '1.875rem', fontWeight: 900, fontFamily: 'Space Grotesk, sans-serif', color: '#e8eef8', marginBottom: 4 }}>{amount}</p>
      <p style={{ fontSize: 11, opacity: 0.6, color: '#e8eef8' }}>{sub}</p>
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
      boxShadow: `0 0 10px ${c.glow}`,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {level} {score}
    </span>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, action, subtitle }: { title: string; action?: React.ReactNode; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.01em' }}>{title}</h2>
        {action}
      </div>
      {subtitle && <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</p>}
    </div>
  );
}

/* ── Heatmap Cell ── */
function HeatCell({ rate, label }: { rate: number; label: string }) {
  const intensity = Math.min(rate / 40, 1);
  const bg = rate === 0 ? 'rgba(0,255,176,0.1)' : `rgba(255,76,106,${0.1 + intensity * 0.4})`;
  const color = rate === 0 ? '#00FFB0' : rate < 15 ? '#FFB830' : '#FF4C6A';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color, background: bg,
        border: `1px solid ${color}25`,
        transition: 'all 0.3s',
        boxShadow: `0 0 10px ${color}25`,
      }} title={`${label}: ${rate}% no-show`}>
        {rate}%
      </div>
      <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

/* ── Live Pulse Indicator ── */
function LiveIndicator() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, background: 'rgba(0,255,176,0.08)', border: '1px solid rgba(0,255,176,0.2)' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FFB0', display: 'inline-block', animation: 'pulseGlow 1.5s ease-in-out infinite', boxShadow: '0 0 8px #00FFB0' }} />
      <span style={{ fontSize: 9, fontWeight: 800, color: '#00FFB0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live</span>
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

  const mockReviews = [
    { id: '1', authorName: 'Ali Khan', rating: 5, text: 'Fantastic service! Smooth Pabandi booking.', time: new Date().toISOString(), sentimentLabel: 'positive' },
    { id: '2', authorName: 'Sara Ahmed', rating: 4, text: 'Smooth booking, polite staff. Highly recommend!', time: new Date(Date.now() - 100000).toISOString(), sentimentLabel: 'positive' },
  ];

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
      <div style={{ background: 'transparent', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '1.25rem', margin: '0 auto 1.5rem',
            background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(14,165,233,0.2)',
          }}>
            <CurrencyDollarIcon className="h-9 w-9" style={{ color: '#0ea5e9' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 12, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>No Business Registered</h2>
          <p style={{ marginBottom: 24, fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
            Register your business to start managing reservations and earning with AI insights.
          </p>
          <Link to="/business/register" className="btn-primary">Register Your Business</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'var(--color-text)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="animate-fade-up mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2rem)', fontWeight: 900, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
                AI Command Center
              </h1>
              <LiveIndicator />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Welcome back, <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{user?.firstName}</span> · {business.name}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/business/settings"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600,
                padding: '10px 16px', borderRadius: 12, transition: 'all 0.2s',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-muted)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.35)';
                (e.currentTarget as HTMLElement).style.color = '#e8eef8';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
              }}
            >
              <Cog6ToothIcon className="h-4 w-4" /> Settings
            </Link>
            <Link to="/reservations/new" className="btn-primary flex items-center gap-2 text-sm" style={{ padding: '10px 18px' }}>
              <PlusIcon className="h-4 w-4" /> Add Booking
            </Link>
          </div>
        </div>

        {/* ── Revenue Cards ── */}
        <div className="animate-fade-up-delay-1 grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <RevenueCard
            label="Protected Revenue"
            amount={`PKR ${(a.protectedRevenue || 0).toLocaleString()}`}
            sub="Deposit-secured bookings"
            gradient="linear-gradient(135deg, rgba(14,165,233,0.25) 0%, rgba(12,20,38,0.95) 100%)"
            glowColor="#0ea5e9"
            icon={<ShieldCheckIcon className="w-full h-full" style={{ color: '#0ea5e9' }} />}
          />
          <RevenueCard
            label="Total Revenue"
            amount={`PKR ${(a.revenue || 0).toLocaleString()}`}
            sub={`${a.completionRate || 0}% completion rate`}
            gradient="linear-gradient(135deg, rgba(0,255,176,0.18) 0%, rgba(12,20,38,0.95) 100%)"
            glowColor="#00FFB0"
            icon={<CurrencyDollarIcon className="w-full h-full" style={{ color: '#00FFB0' }} />}
          />
          <RevenueCard
            label="Revenue at Risk"
            amount={`PKR ${(a.revenueAtRisk || 0).toLocaleString()}`}
            sub={`${upcomingRisky.length} high-risk upcoming`}
            gradient="linear-gradient(135deg, rgba(255,76,106,0.18) 0%, rgba(12,20,38,0.95) 100%)"
            glowColor="#FF4C6A"
            icon={<ExclamationTriangleIcon className="w-full h-full" style={{ color: '#FF4C6A' }} />}
          />
        </div>

        <BusinessPabRewards />

        {/* ── Stats Grid ── */}
        <div className="animate-fade-up-delay-2 grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<CalendarIcon className="h-5 w-5" />} label="Total Bookings" value={a.totalReservations || 0} color="#0ea5e9" glow="rgba(14,165,233,0.2)" />
          <StatCard icon={<CheckCircleIcon className="h-5 w-5" />} label="Completion" value={`${a.completionRate || 0}%`} color="#00FFB0" glow="rgba(0,255,176,0.2)" />
          <StatCard icon={<ExclamationTriangleIcon className="h-5 w-5" />} label="No-Show Rate" value={`${a.noShowRate || 0}%`} color="#FF4C6A" glow="rgba(255,76,106,0.2)" />
          <StatCard icon={<ArrowTrendingUpIcon className="h-5 w-5" />} label="Upcoming Risk" value={`${a.averageUpcomingRisk || 0}%`} color="#FFB830" glow="rgba(255,184,48,0.2)" />
        </div>

        {/* ── Risk Radar + Heatmap ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* AI Risk Radar */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            {/* Scan line effect */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(to right, transparent, rgba(14,165,233,0.5), transparent)', animation: 'scanLine 4s linear infinite', pointerEvents: 'none' }} />
            <SectionHeader title="AI Risk Radar" action={
              <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 9999, background: riskC.bg, color: riskC.text, border: `1px solid ${riskC.text}30`, boxShadow: `0 0 12px ${riskC.glow}`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {riskLevel}
              </span>
            } />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 0' }}>
              <div style={{ position: 'relative', width: 160, height: 160 }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  {/* Track */}
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  {/* Glow track */}
                  <circle cx="50" cy="50" r="42" fill="none" stroke={riskC.text} strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${overallRisk * 2.64} 264`}
                    style={{
                      filter: `drop-shadow(0 0 8px ${riskC.glow})`,
                      transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: riskC.text, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{overallRisk}%</span>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Risk Score</span>
                </div>
              </div>
            </div>
            {(a.topRiskFactors || []).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top Risk Factors</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(a.topRiskFactors || []).slice(0, 4).map((f: any, i: number) => (
                    <span key={i} style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 9999, background: 'rgba(255,184,48,0.1)', color: '#FFB830', border: '1px solid rgba(255,184,48,0.2)' }}>
                      {f.factor.replace(/([A-Z])/g, ' $1').trim()} ({f.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* No-Show Heatmap */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.5rem' }}>
            <SectionHeader title="No-Show Heatmap" subtitle="By day of week · % no-show rate" />
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, marginTop: 20 }}>
              {noShowByDay.length > 0 ? noShowByDay.map((d: any) => (
                <HeatCell key={d.day} rate={d.rate} label={DAY_NAMES[d.day]} />
              )) : DAY_NAMES.map((name, i) => (
                <HeatCell key={i} rate={0} label={name} />
              ))}
            </div>
            <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 16, textAlign: 'center' }}>
              {noShowByDay.length > 0
                ? `Highest no-show: ${DAY_NAMES[noShowByDay.reduce((max: any, d: any) => d.rate > max.rate ? d : max, noShowByDay[0]).day]}`
                : 'Heatmap populates as bookings complete'}
            </p>
          </div>
        </div>

        {/* ── AI Deposit Recommendations ── */}
        {upcomingRisky.length > 0 && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '1.25rem', padding: '1.5rem', marginBottom: 24, boxShadow: '0 0 40px rgba(14,165,233,0.05)' }}>
            <SectionHeader title="AI Deposit Recommendations" action={
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 9999, background: 'rgba(14,165,233,0.12)', color: '#a5b4fc', border: '1px solid rgba(14,165,233,0.25)' }}>
                <BoltIcon className="h-3.5 w-3.5" /> {upcomingRisky.length} flagged
              </span>
            } />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingRisky.slice(0, 5).map((r: any) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
                  borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <RiskBadge score={r.riskScore || 0} />
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8eef8' }}>{r.customer?.firstName} {r.customer?.lastName}</p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#e8eef8' }}>PKR {(r.depositAmount || 1000).toLocaleString()}</p>
                    <p style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{r.depositRequired ? 'Required' : 'Recommended'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Overbooking Advisor ── */}
        {a.overbookingAdvice && (
          <div style={{ borderRadius: '1.25rem', padding: '1.5rem', marginBottom: 24, background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(0,229,255,0.05))', border: '1px solid rgba(14,165,233,0.2)' }}>
            <SectionHeader title="Overbooking Advisor" action={<span style={{ fontSize: 9, fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Event Venue</span>} />
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Predicted No-Show', value: `${a.overbookingAdvice.predictedNoShowPercent}%`, color: '#FF4C6A' },
                { label: 'Safe Overbook Margin', value: `${a.overbookingAdvice.safeOverbookMargin}%`, color: '#0ea5e9' },
                { label: 'Sell per 100 Capacity', value: Math.round(100 * (1 + a.overbookingAdvice.safeOverbookMargin / 100)), color: '#00FFB0' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.02)' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Map + Reviews ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2" style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.5rem' }}>
            <SectionHeader title="Business Location" />
            <div style={{ width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <BusinessMap latitude={business?.latitude || 24.8607} longitude={business?.longitude || 67.0011} name={business?.name || 'My Business'} />
            </div>
          </div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.5rem' }}>
            <SectionHeader title="Latest Reviews" action={
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'rgba(255,184,48,0.12)', color: '#FFB830', border: '1px solid rgba(255,184,48,0.2)' }}>
                ★ {business?.rating?.toFixed(1) || '4.5'}
              </span>
            } />
            <ReviewCarousel reviews={a.reviews || mockReviews} />
          </div>
        </div>

        {/* ── Recent Reservations ── */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.5rem' }}>
          <SectionHeader
            title="Recent Reservations"
            action={
              <Link to="/reservations" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: 4 }}>
                View All →
              </Link>
            }
          />
          {reservations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reservations.map((r: any, idx: number) => {
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                return (
                  <div key={r.id} className="animate-fade-up" style={{
                    animationDelay: `${idx * 50}ms`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                      (e.currentTarget as HTMLElement).style.borderColor = `${sc.color}25`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${sc.color}30, ${sc.color}15)`,
                        border: `1px solid ${sc.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, color: sc.color,
                      }}>
                        {(r.customerName || r.customer?.firstName || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8eef8' }}>{r.customerName || `${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`}</p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{new Date(r.reservationDate).toLocaleDateString()} · {r.reservationTime} · {r.numberOfGuests} guests</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.riskScore != null && <RiskBadge score={r.riskScore} />}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 9999, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}25`, boxShadow: `0 0 8px ${sc.glow}`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {sc.icon} {sc.label}
                      </span>
                      {(r.status === 'CONFIRMED' || r.status === 'PENDING') && (
                        <div style={{ display: 'flex', gap: 5, marginLeft: 4 }}>
                          <button onClick={() => { if (confirm('Mark as completed?')) completeMutation.mutate(r.id); }}
                            style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 9999, background: 'rgba(0,255,176,0.1)', color: '#00FFB0', border: '1px solid rgba(0,255,176,0.2)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            ✓ Done
                          </button>
                          <button onClick={() => { if (confirm('Mark as no-show?')) noShowMutation.mutate(r.id); }}
                            style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 9999, background: 'rgba(255,76,106,0.1)', color: '#FF4C6A', border: '1px solid rgba(255,76,106,0.2)', cursor: 'pointer', transition: 'all 0.2s' }}>
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
            <div style={{
              borderRadius: 12, padding: '3.5rem', textAlign: 'center',
              background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)',
            }}>
              <CalendarIcon className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-text-dim)' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4, color: 'var(--color-text-muted)' }}>No reservations yet</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Once you receive bookings, they'll appear here.</p>
              <Link to="/reservations/new" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 20,
                fontSize: '0.8rem', fontWeight: 700, padding: '8px 16px', borderRadius: 10, transition: 'all 0.2s',
                background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.25)',
              }}>
                <PlusIcon className="h-4 w-4" /> Add First Booking
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
