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
          fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/bookings/my-bookings`, { headers }),
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

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-main)]">My Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)]">Welcome to your personal space</p>
      </div>

      {/* Trust Passport Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-[var(--border-radius)] bg-[var(--bg-surface)] border border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Trust Score</div>
          <div className="text-2xl font-bold text-[var(--color-primary)]">{passport?.data?.score || '—'}</div>
        </div>
        <div className="p-4 rounded-[var(--border-radius)] bg-[var(--bg-surface)] border border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Level</div>
          <div className="text-2xl font-bold text-[var(--sage)]">{passport?.data?.level || '—'}</div>
        </div>
        <div className="p-4 rounded-[var(--border-radius)] bg-[var(--bg-surface)] border border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Upcoming Bookings</div>
          <div className="text-2xl font-bold text-[var(--text-main)]">{bookings.length}</div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/me/passport" className="p-4 rounded-[var(--border-radius)] bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--color-primary)] transition text-center">
          <div className="text-2xl mb-2">🛂</div>
          <div className="text-sm font-medium text-[var(--text-main)]">Passport</div>
        </Link>
        <Link to="/me/bookings" className="p-4 rounded-[var(--border-radius)] bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--color-primary)] transition text-center">
          <div className="text-2xl mb-2">📅</div>
          <div className="text-sm font-medium text-[var(--text-main)]">Bookings</div>
        </Link>
        <Link to="/me/rewards" className="p-4 rounded-[var(--border-radius)] bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--color-primary)] transition text-center">
          <div className="text-2xl mb-2">💰</div>
          <div className="text-sm font-medium text-[var(--text-main)]">Rewards</div>
        </Link>
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-wallet-modal'))} className="p-4 rounded-[var(--border-radius)] bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--color-primary)] transition text-center w-full">
          <div className="text-2xl mb-2">👛</div>
          <div className="text-sm font-medium text-[var(--text-main)]">Wallet</div>
        </button>
      </div>

      {/* Network Bridge / Suggested Connections */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-[var(--text-main)] mb-1">Your Network</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">Leverage your business relationships. Here are top-rated clients you can connect with personally.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 1, name: 'Alice Chen', role: 'Completed 3 Jobs with you', score: 98 },
            { id: 2, name: 'Marcus Johnson', role: 'Repeat VIP Client', score: 95 }
          ].map(client => (
            <div key={client.id} className="flex items-center justify-between p-4 rounded-[var(--border-radius)] bg-[var(--bg-surface)] border border-[var(--border-color)] hover:shadow-sm transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--sage)]/10 text-[var(--sage)] font-bold">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-[var(--text-main)] text-sm">{client.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{client.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase text-[var(--text-muted)] font-bold">Trust</div>
                  <div className="text-sm font-bold text-[var(--color-primary)]">{client.score}</div>
                </div>
                <button className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:opacity-90 transition">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
