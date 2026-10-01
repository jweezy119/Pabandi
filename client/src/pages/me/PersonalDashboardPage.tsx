import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthToken } from '../../utils/authToken';

export default function PersonalDashboardPage() {
  const [passport, setPassport] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getAuthToken();
        const headers = { Authorization: `Bearer ${token}` };
        
        const [passportRes, bookingsRes, rewardsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/trust-passport/me`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/bookings/me`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/rewards/me`, { headers }),
        ]);

        if (passportRes.ok) setPassport(await passportRes.json());
        if (bookingsRes.ok) setBookings((await bookingsRes.json()).data || []);
        if (rewardsRes.ok) setRewards(await rewardsRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--warm-ink)]">My Dashboard</h1>
        <p className="text-sm text-[var(--soft-stone)]">Welcome to your personal space</p>
      </div>

      {/* Trust Passport Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">Trust Score</div>
          <div className="text-2xl font-bold text-[var(--clay)]">{passport?.data?.score || '—'}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">Level</div>
          <div className="text-2xl font-bold text-[var(--sage)]">{passport?.data?.level || '—'}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">Upcoming Bookings</div>
          <div className="text-2xl font-bold text-[var(--warm-ink)]">{bookings.length}</div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/me/passport" className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)] hover:border-[var(--clay)]/40 transition text-center">
          <div className="text-2xl mb-2">🛂</div>
          <div className="text-sm font-medium text-[var(--warm-ink)]">Passport</div>
        </Link>
        <Link to="/me/bookings" className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)] hover:border-[var(--clay)]/40 transition text-center">
          <div className="text-2xl mb-2">📅</div>
          <div className="text-sm font-medium text-[var(--warm-ink)]">Bookings</div>
        </Link>
        <Link to="/me/rewards" className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)] hover:border-[var(--clay)]/40 transition text-center">
          <div className="text-2xl mb-2">💰</div>
          <div className="text-sm font-medium text-[var(--warm-ink)]">Rewards</div>
        </Link>
        <Link to="/me/wallet" className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)] hover:border-[var(--clay)]/40 transition text-center">
          <div className="text-2xl mb-2">👛</div>
          <div className="text-sm font-medium text-[var(--warm-ink)]">Wallet</div>
        </Link>
      </div>
    </div>
  );
}
