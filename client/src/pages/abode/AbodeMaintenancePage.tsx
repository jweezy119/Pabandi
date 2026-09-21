import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/abode', label: 'Dashboard', icon: '📊', end: true },
  { path: '/abode/tenants', label: 'Tenants', icon: '👥' },
  { path: '/abode/leases', label: 'Leases', icon: '📝' },
  { path: '/abode/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/haq/financials', label: 'Financials', icon: '💰' },
];

const COLUMNS = ['OPEN', 'IN_PROGRESS', 'COMPLETED'];

export default function AbodeMaintenancePage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', priority: '', status: '' });

  useEffect(() => { loadRequests(); }, [filter.status]);

  const loadRequests = async () => {
    try {
      const query = filter.status ? `?status=${filter.status}` : '';
      const res = await api.get(`/api/v1/haq/maintenance${query}`);
      setRequests(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getPriorityBadge = (p: string) => {
    switch (p?.toUpperCase()) {
      case 'LOW': return <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">Low</span>;
      case 'MEDIUM': return <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">Medium</span>;
      case 'HIGH': return <span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400">High</span>;
      case 'URGENT': return <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">Urgent</span>;
      default: return <span className="px-2 py-0.5 text-xs rounded bg-white/10 text-gray-400">{p}</span>;
    }
  };

  const getColumnRequests = (status: string) => requests.filter((r: any) => r.status === status);

  return (
    <DashboardLayout osName="AbodeOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Maintenance</h1>
          <button className="px-3 py-1.5 bg-emerald-500 text-white rounded text-sm">New Request</button>
        </div>
        <div className="flex gap-2">
          <select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm">
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        {loading ? <div className="text-center py-8"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <div key={col} className="bg-[#0a0f1a] border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white text-sm font-medium">{col.replace('_', ' ')}</h3>
                  <span className="text-gray-500 text-xs">{getColumnRequests(col).length}</span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {getColumnRequests(col).map((r: any) => (
                    <div key={r.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-white text-sm">{r.title}</p>
                        {getPriorityBadge(r.priority)}
                      </div>
                      <p className="text-gray-500 text-xs">{r.property?.title || 'Property'}</p>
                      <p className="text-gray-400 text-xs mt-1">{r.description?.slice(0, 60)}...</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
