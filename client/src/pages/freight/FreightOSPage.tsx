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
  const [clients, setClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [avgTrust, setAvgTrust] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => { loadLoads(); }, []);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.data || [];
          setClients(list);
          if (list.length > 0) {
            const avg = list.reduce((s: number, c: any) => s + (c.reliabilityScore || 0), 0) / list.length;
            setAvgTrust(Math.round(avg));
          }
        }
      } catch (e) { console.error(e); } finally { setLoadingClients(false); }
    };
    fetchClients();
  }, []);

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

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
          <ClayStat icon="shield" value={avgTrust !== null ? String(avgTrust) : '50'} label="Avg Trust Score" color="dusty-rose" />
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

        {/* Shared ContactOS Clients */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Your Clients</h2>
            <Link to="/contact/clients" className="text-sm font-medium" style={{ color: 'var(--clay)' }}>View all →</Link>
          </div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search clients..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-full text-sm focus:outline-none"
              style={{ background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.3)', color: 'var(--warm-ink)' }}
            />
          </div>
          {loadingClients ? (
            <ClayCard className="p-8 text-center" hover={false}>
              <p style={{ color: 'var(--soft-stone)' }}>Loading clients...</p>
            </ClayCard>
          ) : filteredClients.length === 0 ? (
            <ClayCard className="p-8 text-center" hover={false}>
              <p style={{ color: 'var(--soft-stone)' }}>{clientSearch ? 'No matching clients.' : 'No clients yet. Add your first client in ContactOS.'}</p>
            </ClayCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.slice(0, 6).map((client: any) => (
                <Link key={client.id} to={`/contact/clients/${client.id}`} className="block">
                  <ClayCard className="p-4" hover={true}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--warm-sand)', color: 'var(--warm-ink)' }}>
                        {client.name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--warm-ink)' }}>{client.name}</p>
                        <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>{client.email || 'No email'}</p>
                      </div>
                    </div>
                  </ClayCard>
                </Link>
              ))}
            </div>
          )}
        </div>

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
