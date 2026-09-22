import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/property', label: 'Dashboard', icon: '📊', end: true },
  { path: '/property/tenants', label: 'Tenants', icon: '👥' },
  { path: '/property/leases', label: 'Leases', icon: '📝' },
  { path: '/property/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/property/financials', label: 'Financials', icon: '💰' },
];

export default function PropertyTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadTenants(); }, []);

  const loadTenants = async () => {
    try {
      const res = await api.get('/api/v1/property/tenants');
      setTenants(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) return <span className="px-2 py-0.5 text-xs rounded bg-[var(--sage)]/20 text-[var(--sage)]">Low Risk</span>;
    if (score >= 40) return <span className="px-2 py-0.5 text-xs rounded bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)]">Medium Risk</span>;
    return <span className="px-2 py-0.5 text-xs rounded bg-[var(--terracotta)]/20 text-[var(--terracotta)]">High Risk</span>;
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--sage)]/20 text-[var(--sage)]">Active</span>;
      case 'LATE': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)]">Late</span>;
      case 'EXPIRED': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--terracotta)]/20 text-[var(--terracotta)]">Expired</span>;
      default: return <span className="px-2 py-0.5 text-xs rounded bg-[var(--warm-sand)] text-[var(--soft-stone)]">{status || 'Unknown'}</span>;
    }
  };

  const filtered = tenants.filter((t: any) => {
    const matchesSearch = !search || `${t.firstName} ${t.lastName} ${t.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || t.status?.toLowerCase() === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout osName="PropertyOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--warm-ink)]">Tenants</h1>
          <Link to="/property/tenants/new" className="px-3 py-1.5 bg-[var(--sage)] text-[var(--warm-ink)] rounded text-sm">Add Tenant</Link>
        </div>
        <div className="flex gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenants..." className="flex-1 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded px-3 py-2 text-[var(--warm-ink)] text-sm" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded px-3 py-2 text-[var(--warm-ink)] text-sm">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="late">Late</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-[var(--sage)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(191,179,163,0.3)]">
                  <th className="text-left p-3 text-[var(--soft-stone)]">Name</th>
                  <th className="text-left p-3 text-[var(--soft-stone)]">Email</th>
                  <th className="text-left p-3 text-[var(--soft-stone)]">Status</th>
                  <th className="text-left p-3 text-[var(--soft-stone)]">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t.id} className="border-b border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]">
                    <td className="p-3"><Link to={`/property/tenants/${t.id}`} className="text-[var(--warm-ink)] hover:text-[var(--sage)]">{t.firstName} {t.lastName}</Link></td>
                    <td className="p-3 text-[var(--soft-stone)]">{t.email}</td>
                    <td className="p-3">{getStatusBadge(t.status)}</td>
                    <td className="p-3">{getRiskBadge(t.riskScore)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-[var(--soft-stone)]">No tenants found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
