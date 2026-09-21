import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/abode', label: 'Dashboard', icon: '📊', end: true },
  { path: '/abode/tenants', label: 'Tenants', icon: '👥' },
  { path: '/abode/leases', label: 'Leases', icon: '📝' },
  { path: '/abode/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/abode/financials', label: 'Financials', icon: '💰' },
];

export default function AbodeTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadTenants(); }, []);

  const loadTenants = async () => {
    try {
      const res = await api.get('/api/v1/haq/tenants');
      setTenants(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) return <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">Low Risk</span>;
    if (score >= 40) return <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">Medium Risk</span>;
    return <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">High Risk</span>;
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">Active</span>;
      case 'LATE': return <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">Late</span>;
      case 'EXPIRED': return <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">Expired</span>;
      default: return <span className="px-2 py-0.5 text-xs rounded bg-white/10 text-gray-400">{status || 'Unknown'}</span>;
    }
  };

  const filtered = tenants.filter((t: any) => {
    const matchesSearch = !search || `${t.firstName} ${t.lastName} ${t.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || t.status?.toLowerCase() === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout osName="AbodeOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Tenants</h1>
          <Link to="/haq/tenants/new" className="px-3 py-1.5 bg-emerald-500 text-white rounded text-sm">Add Tenant</Link>
        </div>
        <div className="flex gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenants..." className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="late">Late</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-3 text-gray-400">Name</th>
                  <th className="text-left p-3 text-gray-400">Email</th>
                  <th className="text-left p-3 text-gray-400">Status</th>
                  <th className="text-left p-3 text-gray-400">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3"><Link to={`/haq/tenants/${t.id}`} className="text-white hover:text-emerald-400">{t.firstName} {t.lastName}</Link></td>
                    <td className="p-3 text-gray-400">{t.email}</td>
                    <td className="p-3">{getStatusBadge(t.status)}</td>
                    <td className="p-3">{getRiskBadge(t.riskScore)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-500">No tenants found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
