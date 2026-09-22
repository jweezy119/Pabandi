import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/freight', label: 'Dashboard', icon: 'inventory_2', end: true },
  { path: '/freight/post-load', label: 'Post Load', icon: 'add_circle' },
  { path: '/freight/my-loads', label: 'My Loads', icon: 'list_alt' },
  { path: '/freight/carriers', label: 'Carriers', icon: 'local_shipping' },
  { path: '/freight/rates', label: 'Rate Calculator', icon: 'calculate' },
];

export default function FreightCarriersPage() {
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ state: '', verified: '' });

  useEffect(() => { loadCarriers(); }, [filter]);

  const loadCarriers = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.state) params.set('state', filter.state);
      if (filter.verified) params.set('verified', filter.verified);
      const res = await api.get(`/api/v1/saf/carriers?${params}`);
      setCarriers(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getStars = (rating: number) => {
    const stars = Math.round(rating / 20);
    return (
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="material-symbols-outlined text-[16px]"
            style={{ color: i <= stars ? 'var(--muted-ochre)' : 'var(--soft-stone)' }}
          >
            star
          </span>
        ))}
      </span>
    );
  };

  const inputStyle = { background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.3)', color: 'var(--warm-ink)' };

  return (
    <DashboardLayout osName="FreightOS" osIcon="S" osColor="amber" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Carrier Directory</h1>
          <button
            className="px-5 py-2.5 rounded-full font-medium transition hover:-translate-y-0.5"
            style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">add</span>
            Add Carrier
          </button>
        </div>
        <div className="flex gap-3">
          <input
            placeholder="Filter by state"
            value={filter.state}
            onChange={(e) => setFilter({ ...filter, state: e.target.value })}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
          <select
            value={filter.verified}
            onChange={(e) => setFilter({ ...filter, verified: e.target.value })}
            className="px-4 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          >
            <option value="">All</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {carriers.map((c: any) => (
              <div
                key={c.id}
                className="rounded-[var(--radius-card)] p-5 transition hover:-translate-y-0.5"
                style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{c.companyName}</p>
                    <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>{c.user?.firstName} {c.user?.lastName}</p>
                  </div>
                  {c.verified && (
                    <span
                      className="px-3 py-1 text-xs font-medium rounded-full"
                      style={{ background: 'var(--sage)', color: 'white' }}
                    >
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  {getStars(c.rating)}
                  <span className="text-xs" style={{ color: 'var(--soft-stone)' }}>({c.rating?.toFixed(1)})</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>Fleet: {c.fleetSize} • {c.equipmentType?.join(', ')}</p>
                <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>Max Load: {c.maxLoadLbs?.toLocaleString()} lbs</p>
                <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>Deliveries: {c.totalDeliveries} • On-time: {c.onTimeRate}%</p>
              </div>
            ))}
            {carriers.length === 0 && (
              <p className="text-center py-8 col-span-3" style={{ color: 'var(--soft-stone)' }}>No carriers found</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
