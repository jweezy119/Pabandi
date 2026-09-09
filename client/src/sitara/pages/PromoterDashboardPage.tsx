// Sitara OS — Promoter Dashboard
// Guest lists, referrals, and earnings for nightlife promoters —
// wired to the existing promoter backend, in Sitara branding.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { sitaraApi } from '../api/sitaraApi';

export default function PromoterDashboardPage() {
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [referral, setReferral] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [tier, setTier] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [dash, ref, books, tr] = await Promise.allSettled([
        sitaraApi.promoterDashboard(),
        sitaraApi.promoterReferralLink(),
        sitaraApi.promoterBookings(),
        sitaraApi.promoterTier(),
      ]);
      if (dash.status === 'fulfilled') setStats(dash.value);
      if (ref.status === 'fulfilled') setReferral(ref.value);
      if (books.status === 'fulfilled') setBookings(Array.isArray(books.value) ? books.value : []);
      if (tr.status === 'fulfilled') setTier(tr.value);
      setLoading(false);
    })();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎤</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Promote. Fill rooms. Earn.</h1>
        <p className="text-slate-600 mb-6">Sign in to access your promoter dashboard.</p>
        <Link to="/login" className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800">
          Sign In
        </Link>
      </div>
    );
  }

  const s = stats?.stats || stats || {};
  const referralUrl: string | null =
    referral?.url || referral?.link || referral?.referralLink || referral?.code
      ? referral?.url || referral?.link || referral?.referralLink || `https://pabandi.com/r/${referral?.code}`
      : null;

  const cards = [
    { label: 'Total Guests', value: s.totalGuests ?? s.guests ?? 0, icon: '👥' },
    { label: 'Arrived', value: s.arrivedGuests ?? s.arrived ?? 0, icon: '✅' },
    { label: 'Arrival Rate', value: s.arrivalRate != null ? `${Math.round(Number(s.arrivalRate) * 100)}%` : '—', icon: '📈' },
    { label: 'Earnings', value: s.earnings != null ? `$${s.earnings}` : s.payout != null ? `$${s.payout}` : '—', icon: '💰' },
  ];

  const copyReferral = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-slate-900">Promoter Dashboard</h1>
        {tier && (
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
            ★ {typeof tier === 'string' ? tier : tier?.tier || tier?.name || 'Promoter'}
          </span>
        )}
      </div>
      <p className="text-slate-600 mb-8">Your lists, your crowd, your cut — plus Star Power on every referral.</p>

      {loading ? (
        <p className="text-slate-500 text-center py-12">Loading your promoter stats…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((c) => (
              <div key={c.label} className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span>{c.icon}</span>
                  <span className="text-sm text-slate-600">{c.label}</span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Referral link */}
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white mb-8">
            <h3 className="font-semibold mb-1">Your referral link</h3>
            <p className="text-sm opacity-80 mb-4">Every guest who books through it earns you +50 Star Power.</p>
            {referralUrl ? (
              <div className="flex gap-2">
                <input readOnly value={referralUrl} className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white placeholder-white/60" />
                <button onClick={() => void copyReferral()} className="px-4 py-2 bg-white text-orange-600 text-sm font-semibold rounded-lg hover:bg-orange-50">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <p className="text-sm opacity-80">No referral link yet — run one guest list to unlock it.</p>
            )}
          </div>

          {/* Recent bookings */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Recent promoter bookings</h3>
              <Link to="/promoter" className="text-sm text-amber-600 font-medium hover:text-amber-700">
                Open full PromoterOS →
              </Link>
            </div>
            {bookings.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500 text-center">No bookings attributed to you yet.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Guest</th>
                    <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Event</th>
                    <th className="px-5 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bookings.slice(0, 10).map((b: any, i: number) => (
                    <tr key={b.id || i} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm text-slate-900">{b.guestName || b.name || b.email || '—'}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{b.eventName || b.event || b.venue || '—'}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{b.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
