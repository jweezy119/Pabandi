// Sitara OS — Operator Dashboard
// Vocabulary + stats keyed by business type. Rentals see occupancy;
// everyone else sees bookings, ratings, and real upcoming activity.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';
import { sitaraApi } from '../api/sitaraApi';
import { profileForCategory, OperatorProfile } from '../utils/operatorProfile';
import SquareConnectCard from '../components/SquareConnectCard';

interface LiveData {
  businessName: string;
  reservations: any[];
  avgRating: number;
  reviewCount: number;
  activePromos: number;
  customerCount: number;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function OperatorDashboard() {
  const { user, units, bookings } = useSitaraStore();
  const [profile, setProfile] = useState<OperatorProfile>(profileForCategory(null));
  const [live, setLive] = useState<LiveData | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        if (!biz?.id) return;
        if (biz.category) setProfile(profileForCategory(biz.category));
        const [res, rev, promos, customers] = await Promise.allSettled([
          sitaraApi.businessReservations(biz.id),
          sitaraApi.operatorReviews(biz.id),
          sitaraApi.listPromos(biz.id),
          sitaraApi.businessCustomers(biz.id),
        ]);
        const reservations = res.status === 'fulfilled' && Array.isArray(res.value) ? res.value : [];
        const reviews = rev.status === 'fulfilled' && Array.isArray(rev.value) ? rev.value : [];
        const rated = reviews.filter((r: any) => typeof r.rating === 'number');
        const promoList = promos.status === 'fulfilled' ? promos.value : [];
        const customerList =
          customers.status === 'fulfilled'
            ? Array.isArray(customers.value)
              ? customers.value
              : customers.value?.customers || []
            : [];
        setLive({
          businessName: biz.name || 'Your business',
          reservations,
          avgRating: rated.length ? rated.reduce((s: number, r: any) => s + r.rating, 0) / rated.length : 0,
          reviewCount: rated.length,
          activePromos: Array.isArray(promoList) ? promoList.length : 0,
          customerCount: customerList.length,
        });
      } catch {
        // Local fallback stands.
      }
    })();
  }, []);

  const today = dayKey(new Date());
  const todaysCount =
    live?.reservations.filter((r: any) => r.reservationDate && dayKey(new Date(r.reservationDate)) === today)
      .length ?? 0;
  const upcoming =
    live?.reservations
      .filter(
        (r: any) =>
          r.reservationDate &&
          dayKey(new Date(r.reservationDate)) >= today &&
          !['CANCELLED', 'NO_SHOW'].includes(String(r.status || '').toUpperCase())
      )
      .sort((a: any, b: any) => +new Date(a.reservationDate) - +new Date(b.reservationDate))
      .slice(0, 5) ?? [];

  // ── Rental profile: occupancy view (landlord terms live here only) ──
  if (profile.rentalStyle && !live) {
    return <RentalFallback name={user?.name} units={units} bookings={bookings} />;
  }

  const stats = profile.rentalStyle
    ? [
        { label: 'Total Units', value: units.length, icon: '🏢' },
        { label: 'Occupied', value: units.filter((u) => u.status === 'occupied').length, icon: '🏠' },
        { label: 'Available', value: units.filter((u) => u.status === 'available').length, icon: '🔑' },
        { label: `${profile.bookingNounPlural} (live)`, value: live?.reservations.length ?? 0, icon: '📅' },
      ]
    : [
        { label: `${profile.bookingNounPlural} today`, value: todaysCount, icon: '📅' },
        { label: `Total ${profile.bookingNounPlural.toLowerCase()}`, value: live?.reservations.length ?? 0, icon: '📖' },
        {
          label: 'Average rating',
          value: live && live.reviewCount > 0 ? live.avgRating.toFixed(1) : '—',
          icon: '⭐',
        },
        { label: 'Active promos', value: live?.activePromos ?? 0, icon: '🎁' },
      ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          {live && (
            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">✓ Live</span>
          )}
        </div>
        <p className="text-slate-600 mt-1">Welcome back, {live?.businessName || user?.name || 'Operator'}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={stat.label} className={`tile rise rise-${Math.min(i, 5)} bg-white border border-slate-200 rounded-lg p-4 sm:p-6`}>
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <span className="text-xl sm:text-2xl">{stat.icon}</span>
              <span className="text-xs sm:text-sm text-slate-600 leading-tight">{stat.label}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Actions + integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              to="/sitara/operator/reservations"
              className="w-full px-4 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 text-left flex items-center gap-3"
            >
              <span>📅</span> View {profile.bookingNounPlural}
            </Link>
            <Link
              to="/sitara/operator/star-finder"
              className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-left flex items-center gap-3"
            >
              <span>✨</span> Find top {profile.clientNounPlural.toLowerCase()}
            </Link>
            <Link
              to="/sitara/operator/promos"
              className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-left flex items-center gap-3"
            >
              <span>🎁</span> Send a promo
            </Link>
          </div>
        </div>

        <SquareConnectCard />

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Coming up</h3>
          {!live ? (
            <p className="text-sm text-slate-500">Connect a business to see live activity.</p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">
              No upcoming {profile.bookingNounPlural.toLowerCase()} — share your booking link to fill the book.
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full shrink-0"></div>
                  <span className="text-slate-700 font-medium">{r.customerName || profile.clientNoun}</span>
                  <span className="text-slate-500">
                    {r.numberOfGuests ? `${r.numberOfGuests} ${r.numberOfGuests === 1 ? 'guest' : 'guests'} · ` : ''}
                    {r.reservationDate ? new Date(r.reservationDate).toLocaleDateString() : ''}
                    {r.reservationTime ? ` ${r.reservationTime}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          {live && live.customerCount > 0 && (
            <p className="text-sm text-slate-500 mt-4">
              {live.customerCount} {profile.clientNounPlural.toLowerCase()} on record · {live.reviewCount} reviews
            </p>
          )}
        </div>
      </div>

      {/* Star Power Insights */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6">
        <h3 className="font-semibold text-amber-900 mb-2">⭐ Star Power Insights</h3>
        <p className="text-sm text-amber-800 mb-4">
          Your best {profile.clientNounPlural.toLowerCase()} are your best marketers. Use Star Finder to identify
          them and send exclusive promos.
        </p>
        <Link
          to="/sitara/operator/star-finder"
          className="inline-block px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
        >
          Open Star Finder
        </Link>
      </div>
    </div>
  );
}

function RentalFallback({
  name,
  units,
  bookings,
}: {
  name?: string;
  units: any[];
  bookings: any[];
}) {
  const stats = [
    { label: 'Total Units', value: units.length, icon: '🏢' },
    { label: 'Occupied', value: units.filter((u) => u.status === 'occupied').length, icon: '🏠' },
    { label: 'Available', value: units.filter((u) => u.status === 'available').length, icon: '🔑' },
    { label: 'Bookings This Month', value: bookings.length, icon: '📅' },
  ];
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Welcome back, {name || 'Operator'}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-sm text-slate-600">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
