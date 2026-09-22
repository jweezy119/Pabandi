import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/property', label: 'Dashboard', icon: '📊', end: true },
  { path: '/property/tenants', label: 'Tenants', icon: '👥' },
  { path: '/property/leases', label: 'Leases', icon: '📝' },
  { path: '/property/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/property/financials', label: 'Financials', icon: '💰' },
];

const COLUMNS = ['OPEN', 'IN_PROGRESS', 'COMPLETED'];

export default function PropertyMaintenancePage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', priority: '', status: '' });

  useEffect(() => { loadRequests(); }, [filter.status]);

  const loadRequests = async () => {
    try {
      const query = filter.status ? `?status=${filter.status}` : '';
      const res = await api.get(`/api/v1/property/maintenance${query}`);
      setRequests(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getPriorityBadge = (p: string) => {
    switch (p?.toUpperCase()) {
      case 'LOW': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--sky-wash)]/20 text-[var(--sky-wash)]">Low</span>;
      case 'MEDIUM': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)]">Medium</span>;
      case 'HIGH': return <span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-[var(--terracotta)]">High</span>;
      case 'URGENT': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--terracotta)]/20 text-[var(--terracotta)]">Urgent</span>;
      default: return <span className="px-2 py-0.5 text-xs rounded bg-[var(--warm-sand)] text-[var(--soft-stone)]">{p}</span>;
    }
  };

  const getColumnRequests = (status: string) => requests.filter((r: any) => r.status === status);

  return (
    <DashboardLayout osName="PropertyOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--warm-ink)]">Maintenance</h1>
          <button className="px-3 py-1.5 bg-[var(--sage)] text-[var(--warm-ink)] rounded text-sm">New Request</button>
        </div>
        <div className="flex gap-2">
          <select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded px-3 py-2 text-[var(--warm-ink)] text-sm">
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        {loading ? <div className="text-center py-8"><div className="w-8 h-8 border-4 border-[var(--sage)] border-t-transparent rounded-full animate-spin mx-auto" /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <div key={col} className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[var(--warm-ink)] text-sm font-medium">{col.replace('_', ' ')}</h3>
                  <span className="text-[var(--soft-stone)] text-xs">{getColumnRequests(col).length}</span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {getColumnRequests(col).map((r: any) => (
                    <div key={r.id} className="bg-[var(--warm-sand)] rounded-lg p-3 border border-[rgba(191,179,163,0.3)]">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[var(--warm-ink)] text-sm">{r.title}</p>
                        {getPriorityBadge(r.priority)}
                      </div>
                      <p className="text-[var(--soft-stone)] text-xs">{r.property?.title || 'Property'}</p>
                      <p className="text-[var(--soft-stone)] text-xs mt-1">{r.description?.slice(0, 60)}...</p>
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
