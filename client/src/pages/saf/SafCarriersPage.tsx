import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/saf', label: 'Dashboard', icon: '📦', end: true },
  { path: '/saf/post-load', label: 'Post Load', icon: '➕' },
  { path: '/saf/my-loads', label: 'My Loads', icon: '📋' },
  { path: '/saf/carriers', label: 'Carriers', icon: '🚛' },
  { path: '/saf/rates', label: 'Rate Calculator', icon: '💰' },
];

export default function SafCarriersPage() {
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
    return '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  return (
    <DashboardLayout osName="SafOS" osIcon="S" osColor="amber" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Carrier Directory</h1>
          <button className="px-3 py-1.5 bg-amber-500 text-white rounded text-sm">Add Carrier</button>
        </div>
        <div className="flex gap-3">
          <input placeholder="Filter by state" value={filter.state} onChange={(e) => setFilter({ ...filter, state: e.target.value })} className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <select value={filter.verified} onChange={(e) => setFilter({ ...filter, verified: e.target.value })} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm">
            <option value="">All</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
        </div>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {carriers.map((c: any) => (
              <div key={c.id} className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-white font-medium">{c.companyName}</p>
                    <p className="text-gray-500 text-xs">{c.user?.firstName} {c.user?.lastName}</p>
                  </div>
                  {c.verified && <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">Verified</span>}
                </div>
                <p className="text-gray-400 text-sm mb-1">{getStars(c.rating)} ({c.rating?.toFixed(1)})</p>
                <p className="text-gray-500 text-xs">Fleet: {c.fleetSize} • {c.equipmentType?.join(', ')}</p>
                <p className="text-gray-500 text-xs">Max Load: {c.maxLoadLbs?.toLocaleString()} lbs</p>
                <p className="text-gray-500 text-xs">Deliveries: {c.totalDeliveries} • On-time: {c.onTimeRate}%</p>
              </div>
            ))}
            {carriers.length === 0 && <p className="text-gray-500 text-center py-8 col-span-3">No carriers found</p>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
