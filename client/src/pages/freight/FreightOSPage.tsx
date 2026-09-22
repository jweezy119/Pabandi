import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/freight', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/freight/post-load', label: 'Post Load', icon: 'add_circle' },
  { path: '/freight/my-loads', label: 'My Loads', icon: 'receipt_long' },
  { path: '/freight/carriers', label: 'Carriers', icon: 'local_shipping' },
  { path: '/freight/rates', label: 'Rate Calculator', icon: 'calculate' },
];

function ClayCard({ children, className = '', hover = true, ...props }: any) {
  return (
    <div
      className={`rounded-[28px] bg-white transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{ boxShadow: '0 4px 20px rgba(180,130,90,0.12)' }}
      {...props}
    >
      {children}
    </div>
  );
}

function ClayStat({ icon, value, label, color = 'sage' }: { icon: string; value: string; label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    terracotta: 'bg-[var(--clay)]',
    sage: 'bg-[var(--sage)]',
    'dusty-rose': 'bg-[var(--dusty-rose)]',
    ochre: 'bg-[var(--muted-ochre)]',
    'sky-wash': 'bg-[var(--sky-wash)]',
  };
  return (
    <ClayCard className="p-5" hover={false}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm mb-1" style={{ color: 'var(--soft-stone)' }}>{label}</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl ${colorMap[color]} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-[var(--warm-ink)] text-[20px]">{icon}</span>
        </div>
      </div>
    </ClayCard>
  );
}

export default function FreightOSPage() {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLoads(); }, []);

  const loadLoads = async () => {
    try {
      const res = await api.get('/api/v1/saf/loads?status=OPEN').catch(() => ({ data: { data: [] } }));
      setLoads(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <DashboardLayout osName="FreightOS" osIcon="S" osColor="sage" navItems={navItems}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--warm-ink)' }}>Dashboard</h1>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Freight & logistics management platform</p>
          </div>
          <Link
            to="/saf/post-load"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border-2 bg-[var(--sage)] text-[var(--warm-ink)] border-[var(--sage)] hover:bg-[var(--sage)]/90 hover:border-[var(--sage)]/90 hover:-translate-y-0.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Post Load
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ClayStat icon="local_shipping" value={String(loads.length)} label="Active Loads" color="sage" />
          <ClayStat icon="check_circle" value="0" label="Completed" color="terracotta" />
          <ClayStat icon="account_balance_wallet" value="$0" label="Total Spent" color="ochre" />
          <ClayStat icon="shield" value="50" label="Trust Score" color="dusty-rose" />
        </div>

        {/* Recent Loads */}
        <ClayCard hover={false}>
          <div className="p-5" style={{ borderBottom: '1px solid rgba(191,179,163,0.3)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Recent Loads</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
          ) : loads.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--warm-sand)' }}>
                <span className="material-symbols-outlined text-[32px]" style={{ color: 'var(--soft-stone)' }}>inventory_2</span>
              </div>
              <p style={{ color: 'var(--warm-ink)' }}>No loads yet. Post your first load to get started!</p>
              <Link
                to="/saf/post-load"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border-2 bg-[var(--sage)] text-[var(--warm-ink)] border-[var(--sage)] hover:bg-[var(--sage)]/90 hover:border-[var(--sage)]/90 hover:-translate-y-0.5 active:scale-95 mt-4"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Post a Load
              </Link>
            </div>
          ) : (
            <div>
              {loads.map((load: any) => (
                <div
                  key={load.id}
                  className="p-5 flex items-center justify-between"
                  style={{ borderBottom: '1px solid rgba(191,179,163,0.15)' }}
                >
                  <div>
                    <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{load.title || 'Load'}</p>
                    <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>{load.origin} → {load.destination}</p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{ background: 'rgba(138,154,123,0.15)', color: 'var(--sage)' }}
                  >
                    {load.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ClayCard>

        {/* Footer */}
        <footer className="pt-8 text-center" style={{ borderTop: '1px solid rgba(191,179,163,0.3)' }}>
          <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
            Powered by{' '}
            <Link to="/" className="hover:underline transition" style={{ color: 'var(--sage)' }}>
              Pabandi
            </Link>{' '}
            — The Global Trust Layer
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--soft-stone)' }}>
            © 2026 Pabandi. All rights reserved.
          </p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
