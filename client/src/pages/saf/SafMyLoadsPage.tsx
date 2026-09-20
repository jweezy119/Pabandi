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

export default function SafMyLoadsPage() {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLoads(); }, []);

  const loadLoads = async () => {
    try {
      const res = await api.get('/api/v1/saf/loads');
      setLoads(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'bg-green-500/20 text-green-400',
      ASSIGNED: 'bg-blue-500/20 text-blue-400',
      IN_TRANSIT: 'bg-yellow-500/20 text-yellow-400',
      DELIVERED: 'bg-purple-500/20 text-purple-400',
      COMPLETED: 'bg-emerald-500/20 text-emerald-400',
      CANCELLED: 'bg-red-500/20 text-red-400',
    };
    return <span className={`px-2 py-0.5 text-xs rounded ${colors[status] || 'bg-white/10 text-gray-400'}`}>{status}</span>;
  };

  return (
    <DashboardLayout osName="SafOS" osIcon="S" osColor="amber" navItems={navItems}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">My Shipments</h1>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-3 text-gray-400">Load</th>
                  <th className="text-left p-3 text-gray-400">Route</th>
                  <th className="text-left p-3 text-gray-400">Status</th>
                  <th className="text-left p-3 text-gray-400">Budget</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((l: any) => (
                  <tr key={l.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <p className="text-white">{l.title}</p>
                      <p className="text-gray-500 text-xs">{l.weightLbs?.toLocaleString()} lbs • {l.cargoType}</p>
                    </td>
                    <td className="p-3 text-gray-400 text-xs">{l.originCity} → {l.destCity}</td>
                    <td className="p-3">{getStatusBadge(l.status)}</td>
                    <td className="p-3 text-amber-400">${l.budgetUsd?.toLocaleString()}</td>
                  </tr>
                ))}
                {loads.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No shipments found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
