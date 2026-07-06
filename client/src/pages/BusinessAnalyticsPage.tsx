import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { analyticsService } from '../services/api';
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  CalendarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LockClosedIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

/* ── Utility: format currency ── */
const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

/* ── Mini Spark-Bar Chart (pure CSS) ── */
function SparkBar({ data, maxVal, color, label }: { data: number[]; maxVal: number; color: string; label?: string }) {
  const safeMax = maxVal || 1;
  return (
    <div className="flex items-end gap-px h-16" title={label}>
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-500 hover:opacity-80"
          style={{
            height: `${Math.max(2, (v / safeMax) * 100)}%`,
            background: v > 0 ? color : 'var(--color-surface-container-high)',
            minWidth: 2,
          }}
          title={`${v}`}
        />
      ))}
    </div>
  );
}

/* ── Donut Chart (SVG) ── */
function DonutChart({ segments, size = 120 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 42;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" className="stroke-surface-container-high" strokeWidth="12" />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const gap = circ - dash;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease' }}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-headline text-2xl font-bold text-on-surface leading-none">{total}</span>
        <span className="font-label text-[8px] text-on-surface-variant font-bold uppercase tracking-widest mt-0.5">Total</span>
      </div>
    </div>
  );
}

/* ── Metric Tile ── */
function MetricTile({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-5 flex items-start gap-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent} transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 truncate">{label}</p>
        <p className="font-headline text-2xl font-bold text-on-surface leading-none">{value}</p>
        {sub && <p className="font-body text-[11px] text-on-surface-variant mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Hourly Heatmap ── */
function HourlyHeatmap({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="grid grid-cols-12 gap-1.5">
      {data.map((v, i) => {
        const intensity = v / max;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="w-full aspect-square rounded-md flex items-center justify-center font-label text-[9px] font-bold transition-all"
              style={{
                background: v > 0
                  ? `rgba(var(--color-primary-rgb, 20,241,149), ${0.15 + intensity * 0.7})`
                  : 'var(--color-surface-container)',
                color: v > 0 ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
              }}
              title={`${i}:00 — ${v} bookings`}
            >
              {v || '·'}
            </div>
            <span className="font-label text-[8px] text-on-surface-variant font-semibold">
              {i < 10 ? `0${i}` : i}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Section Card Wrapper ── */
function Section({ title, subtitle, icon, action, children, className = '' }: {
  title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6 ${className}`}>
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          {icon && <div className="text-primary">{icon}</div>}
          <div>
            <h3 className="font-headline text-base font-bold text-on-surface tracking-tight">{title}</h3>
            {subtitle && <p className="font-body text-[11px] text-on-surface-variant mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════ MAIN PAGE ═══════════════════════════ */

export default function BusinessAnalyticsPage() {

  const { data: baseData } = useQuery('dashboard-analytics', () => analyticsService.getDashboardAnalytics(), { refetchInterval: 60000 });
  const { data: detailedData, isLoading } = useQuery('detailed-analytics', () => analyticsService.getDetailedAnalytics(), { refetchInterval: 60000 });

  const base = baseData?.data?.data?.analytics || {};
  const detail = detailedData?.data?.data?.analytics || {};

  const dailySeries = detail.dailySeries || [];
  const deposit = detail.depositStats || {};
  const hourly = detail.hourlyVolume || new Array(24).fill(0);
  const topCustomers = detail.topCustomers || [];
  const riskDist = detail.riskDistribution || { low: 0, moderate: 0, high: 0, critical: 0 };

  // Derived chart data
  const bookingsPerDay = useMemo(() => dailySeries.map((d: any) => d.bookings), [dailySeries]);
  const noShowsPerDay = useMemo(() => dailySeries.map((d: any) => d.noShows), [dailySeries]);
  const guestsPerDay = useMemo(() => dailySeries.map((d: any) => d.guests), [dailySeries]);
  const maxBookings = useMemo(() => Math.max(...bookingsPerDay, 1), [bookingsPerDay]);
  const maxGuests = useMemo(() => Math.max(...guestsPerDay, 1), [guestsPerDay]);

  // Deposit donut segments
  const depositSegments = useMemo(() => [
    { value: deposit.cryptoDeposits || 0, color: '#14f195', label: 'Crypto' },
    { value: deposit.fiatDeposits || 0, color: '#06b6d4', label: 'Fiat' },
    { value: deposit.pendingDeposits || 0, color: '#f59e0b', label: 'Pending' },
    { value: deposit.refundedDeposits || 0, color: '#ef4444', label: 'Refunded' },
  ], [deposit]);

  // Risk donut segments
  const riskSegments = useMemo(() => [
    { value: riskDist.low, color: '#14f195', label: 'Low' },
    { value: riskDist.moderate, color: '#f59e0b', label: 'Moderate' },
    { value: riskDist.high, color: '#f97316', label: 'High' },
    { value: riskDist.critical, color: '#ef4444', label: 'Critical' },
  ], [riskDist]);

  if (isLoading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ChartBarIcon className="h-6 w-6 text-primary" />
          </div>
          <p className="font-body text-sm text-on-surface-variant animate-pulse">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen text-on-surface pb-24 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="mb-10">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium mb-6 transition-colors text-on-surface-variant hover:text-primary"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Back to Dashboard
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface flex items-center gap-3">
                <ChartBarIcon className="h-8 w-8 text-primary" />
                Analytics
              </h1>
              <p className="mt-2 font-body text-sm text-on-surface-variant">
                Deep-dive into your business performance, deposit protection, and customer reliability.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/30">
              <ClockIcon className="h-4 w-4 text-on-surface-variant" />
              <span className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Last 30 Days</span>
            </div>
          </div>
        </div>

        {/* ── Top Metrics Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricTile
            icon={<CalendarIcon className="h-6 w-6" />}
            label="Total Bookings"
            value={base.totalReservations || detail.totalReservations30d || 0}
            sub={`${detail.totalGuests30d || 0} total guests`}
            accent="bg-primary-fixed text-on-primary-fixed"
          />
          <MetricTile
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
            label="No-Show Rate"
            value={`${base.noShowRate || 0}%`}
            sub={`${base.noShowCount || 0} no-shows total`}
            accent="bg-error-container text-on-error-container"
          />
          <MetricTile
            icon={<LockClosedIcon className="h-6 w-6" />}
            label="Deposits Collected"
            value={deposit.totalDepositsCollected || 0}
            sub={`PKR ${fmt(deposit.totalDepositAmount || 0)} secured`}
            accent="bg-tertiary-fixed text-on-tertiary-fixed"
          />
          <MetricTile
            icon={<ShieldCheckIcon className="h-6 w-6" />}
            label="Revenue Saved"
            value={`PKR ${fmt(deposit.revenueSavedByDeposits || 0)}`}
            sub="By deposit protection"
            accent="bg-secondary-fixed text-on-secondary-fixed"
          />
        </div>

        {/* ── Booking Volume Chart + Deposit Breakdown ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Booking Volume */}
          <Section
            title="Booking Volume"
            subtitle="Daily bookings · last 30 days"
            icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
            className="lg:col-span-2"
          >
            <SparkBar data={bookingsPerDay} maxVal={maxBookings} color="var(--color-primary)" label="Daily bookings" />
            <div className="flex items-center justify-between mt-3">
              <span className="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">30 days ago</span>
              <span className="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">Today</span>
            </div>

            {/* No-show overlay */}
            <div className="mt-5 pt-4 border-t border-outline-variant/20">
              <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">No-Show Occurrences</p>
              <SparkBar data={noShowsPerDay} maxVal={Math.max(...noShowsPerDay, 1)} color="var(--color-error)" label="Daily no-shows" />
            </div>
          </Section>

          {/* Deposit Breakdown Donut */}
          <Section title="Deposit Breakdown" subtitle="By type" icon={<CurrencyDollarIcon className="h-5 w-5" />}>
            <div className="flex flex-col items-center">
              <DonutChart segments={depositSegments} size={140} />
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-5 w-full">
                {depositSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                    <span className="font-body text-xs text-on-surface-variant">{seg.label}</span>
                    <span className="font-headline text-xs font-bold text-on-surface ml-auto">{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deposit impact stats */}
            <div className="mt-5 pt-4 border-t border-outline-variant/20 grid grid-cols-2 gap-3">
              <div className="text-center p-2.5 rounded-lg bg-surface-container">
                <p className="font-headline text-lg font-bold text-error">{deposit.noShowsWithoutDeposit || 0}</p>
                <p className="font-label text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">No-Shows (No Deposit)</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-surface-container">
                <p className="font-headline text-lg font-bold text-primary">{deposit.noShowsWithDeposit || 0}</p>
                <p className="font-label text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">No-Shows (Deposit Paid)</p>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Guest Volume + Hourly Heatmap ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Section title="Guest Volume" subtitle="Daily guest count · last 30 days" icon={<UserGroupIcon className="h-5 w-5" />}>
            <SparkBar data={guestsPerDay} maxVal={maxGuests} color="#06b6d4" label="Daily guests" />
            <div className="flex items-center justify-between mt-3">
              <span className="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">30 days ago</span>
              <span className="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">Today</span>
            </div>
          </Section>

          <Section title="Peak Hours" subtitle="Booking volume by hour of day" icon={<ClockIcon className="h-5 w-5" />}>
            <HourlyHeatmap data={hourly} />
          </Section>
        </div>

        {/* ── Risk Distribution + Top Customers ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Risk Distribution */}
          <Section title="Risk Distribution" subtitle="AI-scored booking risk levels" icon={<ExclamationTriangleIcon className="h-5 w-5" />}>
            <div className="flex flex-col items-center">
              <DonutChart segments={riskSegments} size={140} />
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-5 w-full">
                {riskSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                    <span className="font-body text-xs text-on-surface-variant">{seg.label}</span>
                    <span className="font-headline text-xs font-bold text-on-surface ml-auto">{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Top Customers */}
          <Section
            title="Top Customers"
            subtitle="Most frequent bookers (30d)"
            icon={<UserGroupIcon className="h-5 w-5" />}
            className="lg:col-span-2"
          >
            {topCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/20">
                      <th className="font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant pb-3 pr-4">#</th>
                      <th className="font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant pb-3 pr-4">Customer</th>
                      <th className="font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant pb-3 pr-4 text-center">Bookings</th>
                      <th className="font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant pb-3 pr-4 text-center">Guests</th>
                      <th className="font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant pb-3 pr-4 text-center">No-Shows</th>
                      <th className="font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant pb-3 text-center">Reliability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c: any, i: number) => (
                      <tr key={c.id} className="border-b border-outline-variant/10 hover:bg-surface-container/50 transition-colors">
                        <td className="py-3 pr-4">
                          <span className="font-headline text-xs font-bold text-on-surface-variant">{i + 1}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline text-xs font-bold shrink-0">
                              {(c.name || '?')[0]?.toUpperCase()}
                            </div>
                            <span className="font-body text-sm font-bold text-on-surface truncate max-w-[150px]">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-center font-headline text-sm font-bold text-on-surface">{c.bookings}</td>
                        <td className="py-3 pr-4 text-center font-body text-sm text-on-surface-variant">{c.totalGuests}</td>
                        <td className="py-3 pr-4 text-center">
                          <span className={`font-headline text-sm font-bold ${c.noShows > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                            {c.noShows}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${c.reliability}%`,
                                  background: c.reliability >= 80 ? '#14f195' : c.reliability >= 50 ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                            <span className="font-label text-[10px] font-bold text-on-surface-variant">{c.reliability}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10">
                <UserGroupIcon className="h-8 w-8 mx-auto mb-3 text-outline" />
                <p className="font-body text-sm text-on-surface-variant">Customer data populates as bookings come in.</p>
              </div>
            )}
          </Section>
        </div>

        {/* ── Escrow Protection Summary ── */}
        <div className="rounded-xl p-6 bg-gradient-to-r from-primary/10 via-[#06b6d4]/10 to-primary/5 border border-primary/20 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center">
              <LockClosedIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-headline text-base font-bold text-on-surface">Escrow Protection Summary</h3>
              <p className="font-body text-[11px] text-on-surface-variant">How deposits protect your revenue from no-shows</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-4 text-center border border-outline-variant/20">
              <p className="font-headline text-2xl font-bold text-primary">{deposit.totalDepositsCollected || 0}</p>
              <p className="font-label text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Deposits Locked</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-4 text-center border border-outline-variant/20">
              <p className="font-headline text-2xl font-bold text-[#06b6d4]">PKR {fmt(deposit.totalDepositAmount || 0)}</p>
              <p className="font-label text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Total Secured</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-4 text-center border border-outline-variant/20">
              <p className="font-headline text-2xl font-bold text-emerald-500">{deposit.cryptoDeposits || 0}</p>
              <p className="font-label text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">On-Chain (Crypto)</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-4 text-center border border-outline-variant/20">
              <p className="font-headline text-2xl font-bold text-amber-500">{deposit.pendingDeposits || 0}</p>
              <p className="font-label text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Pending</p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
          <p className="font-body text-[11px] text-on-surface-variant">
            Data refreshes every 60 seconds · Powered by Pabandi AI
          </p>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-3.5 w-3.5 text-primary" />
            <span className="font-label text-[10px] font-bold text-primary uppercase tracking-widest">Live</span>
          </div>
        </div>

      </div>
    </div>
  );
}
