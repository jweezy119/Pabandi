import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import api from '../services/api';

const navItems = [
  { path: '/saf', label: 'Dashboard', icon: '📦', end: true },
  { path: '/saf/post-load', label: 'Post Load', icon: '➕' },
  { path: '/saf/my-loads', label: 'My Loads', icon: '📋' },
  { path: '/saf/carriers', label: 'Carriers', icon: '🚛' },
  { path: '/saf/rates', label: 'Rate Calculator', icon: '💰' },
];

export default function SafOSPage() {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({ origin: '', dest: '', cargoType: '' });

  useEffect(() => { loadLoads(); }, []);

  const loadLoads = async () => {
    try {
      const res = await api.get('/api/v1/saf/loads?status=OPEN');
      setLoads(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <DashboardLayout osName="SafOS" osIcon="S" osColor="amber" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Freight Dashboard</h1>
          <Link to="/saf/post-load" className="px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium">Post Load</Link>
        </div>

        {/* Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Origin City" value={search.origin} onChange={(e) => setSearch({ ...search, origin: e.target.value })} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <input placeholder="Destination City" value={search.dest} onChange={(e) => setSearch({ ...search, dest: e.target.value })} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <select value={search.cargoType} onChange={(e) => setSearch({ ...search, cargoType: e.target.value })} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm">
            <option value="">All Cargo Types</option>
            <option value="GENERAL">General</option>
            <option value="REFRIGERATED">Refrigerated</option>
            <option value="HAZARDOUS">Hazardous</option>
            <option value="OVERSIZED">Oversized</option>
            <option value="FRAGILE">Fragile</option>
          </select>
        </div>

        {/* Load Board */}
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
          <h3 className="text-white text-sm font-medium mb-3">Available Loads ({loads.length})</h3>
          {loading ? (
            <div className="text-center py-8"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-2">
              {loads.slice(0, 10).map((l: any) => (
                <div key={l.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white text-sm font-medium">{l.title}</p>
                      <p className="text-gray-500 text-xs">{l.originCity}, {l.originState} → {l.destCity}, {l.destState}</p>
                      <p className="text-gray-400 text-xs">{l.weightLbs?.toLocaleString()} lbs • {l.cargoType}</p>
                    </div>
                    <p className="text-amber-400 font-medium">${l.budgetUsd?.toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {loads.length === 0 && <p className="text-gray-500 text-center py-4">No loads available</p>}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{loads.length}</p>
            <p className="text-gray-500 text-xs">Open Loads</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">0</p>
            <p className="text-gray-500 text-xs">Active Shipments</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">0</p>
            <p className="text-gray-500 text-xs">Carriers Online</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-purple-400">0</p>
            <p className="text-gray-500 text-xs">Completed Today</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
