import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  StarIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  PlusIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import BusinessMap from '../components/BusinessMap';
import ReviewCarousel from '../components/ReviewCarousel';

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
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#5a7490' }}>
          {label}
        </p>
        <p className="text-2xl font-black" style={{ color: '#e8edf3' }}>{value}</p>
      </div>
    </div>
  );
}

/* ── Revenue Card ── */
function RevenueCard({ label, amount, sub, icon, gradient, iconBg }: {
  label: string; amount: string; sub: string;
  icon: React.ReactNode; gradient: string; iconBg: string;
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
      <h2 className="text-lg font-bold" style={{ color: '#e8edf3' }}>{title}</h2>
      {action}
    </div>
  );
}

export default function BusinessDashboard() {
  const { user } = useAuthStore();
  const [business] = useState<any>({ id: 'mock-biz' });

  useEffect(() => {}, []);

  const { data: analytics } = useQuery(
    'business-analytics',
    () => business?.id && businessService.getBusinessAnalytics(business.id),
    { enabled: !!business?.id }
  );

  const mockReviews = [
    { id: '1', authorName: 'Ali Khan', rating: 5, text: 'Fantastic service! Highly recommend for anyone in Karachi.', time: new Date().toISOString(), sentimentLabel: 'positive' },
    { id: '2', authorName: 'Sara Ahmed', rating: 4, text: 'The booking process was smooth and the staff was polite.', time: new Date(Date.now() - 100000).toISOString(), sentimentLabel: 'positive' },
  ];

  if (!business) {
    return (
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}
        className="flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(59,130,246,0.12)' }}>
            <CurrencyDollarIcon className="h-8 w-8" style={{ color: '#60a5fa' }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#e8edf3' }}>No Business Registered</h2>
          <p className="mb-6 text-sm" style={{ color: '#7a90a8' }}>
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
            <h1 className="text-3xl font-black tracking-tight" style={{ color: '#e8edf3' }}>
              Business Dashboard
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: '#7a90a8' }}>
              Welcome back, <span style={{ color: '#60a5fa', fontWeight: 600 }}>{user?.firstName}</span>! Here's your AI business pulse.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/business/settings"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#a0b4c8', border: '1px solid rgba(255,255,255,0.08)' }}>
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
            amount={`PKR ${(analytics?.data?.analytics?.protectedRevenue || 45000).toLocaleString()}`}
            sub="Fiat & Web3 Escrow Secured"
            gradient="linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)"
            iconBg="rgba(99,179,237,0.2)"
            icon={<ShieldCheckIcon className="w-full h-full" style={{ color: '#60a5fa' }} />}
          />
          <RevenueCard
            label="Total Revenue"
            amount={`PKR ${(analytics?.data?.analytics?.revenue || 125000).toLocaleString()}`}
            sub="Growth +12% this month"
            gradient="linear-gradient(135deg, #064e3b 0%, #022c22 100%)"
            iconBg="rgba(52,211,153,0.2)"
            icon={<CurrencyDollarIcon className="w-full h-full" style={{ color: '#34d399' }} />}
          />
          <RevenueCard
            label="No-Show Protection"
            amount={`PKR ${(analytics?.data?.analytics?.reimbursedRevenue || 8500).toLocaleString()}`}
            sub="Web3 Escrow Deductions Captured"
            gradient="linear-gradient(135deg, #4c1d95 0%, #2d1163 100%)"
            iconBg="rgba(167,139,250,0.2)"
            icon={<ExclamationTriangleIcon className="w-full h-full" style={{ color: '#a78bfa' }} />}
          />
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Total Bookings"
            value={analytics?.data?.analytics?.totalReservations || 142}
            color="#60a5fa"
          />
          <StatCard
            icon={<CheckCircleIcon className="h-5 w-5" />}
            label="Completion"
            value={analytics?.data?.analytics
              ? ((analytics.data.analytics.upcomingReservations / analytics.data.analytics.totalReservations) * 100).toFixed(1) + '%'
              : '94.2%'}
            color="#34d399"
          />
          <StatCard
            icon={<ShieldCheckIcon className="h-5 w-5" />}
            label="Reliability Score"
            value={analytics?.data?.analytics?.reliabilityScore?.toFixed(1) || '4.8'}
            color="#818cf8"
          />
          <StatCard
            icon={<StarIcon className="h-5 w-5" />}
            label="Google Rating"
            value={analytics?.data?.analytics?.googleRating?.toFixed(1) || '4.5'}
            color="#fbbf24"
          />
        </div>

        {/* ── Map + Reviews ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Map */}
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

          {/* Reviews */}
          <div className="rounded-2xl p-6"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionHeader
              title="Latest Google Reviews"
              action={
                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                  ★ {analytics?.data?.analytics?.googleRating?.toFixed(1) || '4.5'}
                </span>
              }
            />
            <ReviewCarousel reviews={analytics?.data?.analytics?.reviews || mockReviews} />
          </div>
        </div>

        {/* ── Recent Reservations ── */}
        <div className="rounded-2xl p-6"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <SectionHeader
            title="Recent Reservations"
            action={
              <Link to="/reservations"
                className="text-sm font-semibold flex items-center gap-1"
                style={{ color: '#60a5fa' }}>
                View All →
              </Link>
            }
          />
          <div className="rounded-xl py-14 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <CalendarIcon className="h-10 w-10 mx-auto mb-3" style={{ color: '#3d5068' }} />
            <p className="text-sm font-medium mb-1" style={{ color: '#7a90a8' }}>No recent reservations yet</p>
            <p className="text-xs" style={{ color: '#3d5068' }}>Once you receive bookings, they'll appear here.</p>
            <Link to="/reservations/new"
              className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              <PlusIcon className="h-4 w-4" /> Add First Reservation
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
