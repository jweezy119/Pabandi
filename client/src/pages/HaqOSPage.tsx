import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import api from '../services/api';

const navItems = [
  { path: '/haq', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/haq/tenants', label: 'Tenants', icon: 'groups' },
  { path: '/haq/leases', label: 'Leases', icon: 'description' },
  { path: '/haq/maintenance', label: 'Maintenance', icon: 'build' },
  { path: '/haq/financials', label: 'Financials', icon: 'account_balance' },
];

export default function HaqOSPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [summary, setSummary] = useState<any>(null);
  const [collectionRate, setCollectionRate] = useState<any>(null);
  const [topProperties, setTopProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      const [summaryRes, rateRes, propsRes] = await Promise.all([
        api.get(`/api/v1/haq/revenue?period=${period}`),
        api.get('/api/v1/haq/revenue/collection-rate'),
        api.get('/api/v1/haq/revenue/top-properties'),
      ]);
      setSummary(summaryRes.data?.data);
      setCollectionRate(rateRes.data?.data);
      setTopProperties(propsRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load HaqOS data', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout osName="HaqOS" osIcon="H" osColor="sage" navItems={navItems}>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--sage)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="HaqOS" osIcon="H" osColor="sage" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Property Dashboard</h1>
          <div className="flex gap-2">
            {(['week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-4 py-2 rounded-full text-sm font-medium capitalize transition"
                style={{
                  background: period === p ? 'var(--clay)' : 'var(--warm-sand)',
                  color: period === p ? 'white' : 'var(--warm-ink)',
                  boxShadow: period === p ? 'var(--shadow-soft)' : 'none',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-[var(--radius-card)] p-5 transition hover:-translate-y-0.5" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Total Revenue</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--sage)' }}>${summary?.totalRevenue?.toLocaleString() || 0}</p>
          </div>
          <div className="rounded-[var(--radius-card)] p-5 transition hover:-translate-y-0.5" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Expenses</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--terracotta)' }}>${summary?.totalExpenses?.toLocaleString() || 0}</p>
          </div>
          <div className="rounded-[var(--radius-card)] p-5 transition hover:-translate-y-0.5" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Net Income</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--sage)' }}>${summary?.netIncome?.toLocaleString() || 0}</p>
          </div>
        </div>

        {/* Collection Rate */}
        <div className="rounded-[var(--radius-card)] p-5" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--soft-stone)' }}>Rent Collection Rate</p>
          <div className="flex items-center gap-4">
            <div className="flex-1 rounded-full h-4 overflow-hidden" style={{ background: 'var(--warm-sand)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${collectionRate?.collectionRate || 0}%`, background: 'var(--sage)' }}
              />
            </div>
            <span className="font-bold" style={{ color: 'var(--warm-ink)' }}>{collectionRate?.collectionRate?.toFixed(1) || 0}%</span>
          </div>
        </div>

        {/* Top Properties */}
        <div className="rounded-[var(--radius-card)] p-5" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--soft-stone)' }}>Top Properties</p>
          <div className="space-y-1">
            {topProperties.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-3"
                style={{ borderBottom: '1px solid rgba(191,179,163,0.2)' }}
              >
                <div>
                  <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{p.title}</p>
                  <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>{p.address}</p>
                </div>
                <p className="font-medium" style={{ color: 'var(--sage)' }}>${p.rentAmount?.toLocaleString()}/mo</p>
              </div>
            ))}
            {topProperties.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>No properties yet</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/haq/tenants"
            className="rounded-[var(--radius-card)] p-5 text-center transition hover:-translate-y-0.5"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--clay)' }}>person_add</span>
            <p className="text-sm mt-2" style={{ color: 'var(--warm-ink)' }}>Add Tenant</p>
          </Link>
          <Link
            to="/haq/leases"
            className="rounded-[var(--radius-card)] p-5 text-center transition hover:-translate-y-0.5"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--clay)' }}>description</span>
            <p className="text-sm mt-2" style={{ color: 'var(--warm-ink)' }}>Create Lease</p>
          </Link>
          <Link
            to="/haq/maintenance"
            className="rounded-[var(--radius-card)] p-5 text-center transition hover:-translate-y-0.5"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--clay)' }}>build</span>
            <p className="text-sm mt-2" style={{ color: 'var(--warm-ink)' }}>Post Maintenance</p>
          </Link>
          <Link
            to="/haq/financials"
            className="rounded-[var(--radius-card)] p-5 text-center transition hover:-translate-y-0.5"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--clay)' }}>bar_chart</span>
            <p className="text-sm mt-2" style={{ color: 'var(--warm-ink)' }}>View Reports</p>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
