import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/property', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/property/tenants', label: 'Tenants', icon: 'people' },
  { path: '/property/leases', label: 'Leases', icon: 'description' },
  { path: '/property/maintenance', label: 'Maintenance', icon: 'build' },
  { path: '/property/financials', label: 'Financials', icon: 'bar_chart' },
];

export default function PropertyOSPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [summary, setSummary] = useState<any>(null);
  const [collectionRate, setCollectionRate] = useState<any>(null);
  const [topProperties, setTopProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    try {
      const [summaryRes, rateRes, propsRes] = await Promise.all([
        api.get(`/api/v1/property/revenue?period=${period}`).catch(() => ({ data: { data: null } })),
        api.get('/api/v1/property/revenue/collection-rate').catch(() => ({ data: { data: null } })),
        api.get('/api/v1/property/revenue/top-properties').catch(() => ({ data: { data: [] } })),
      ]);
      setSummary(summaryRes.data?.data);
      setCollectionRate(rateRes.data?.data);
      setTopProperties(propsRes.data?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <DashboardLayout osName="PropertyOS" osIcon="H" osColor="violet" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Dashboard</h1>
            <p className="text-[var(--soft-stone)]">Property management for landlords and builders</p>
          </div>
          <Link to="/property/tenants" className="px-4 py-2 rounded-xl bg-[var(--dusty-rose)] hover:bg-[var(--dusty-rose)] text-[var(--warm-ink)] font-medium transition">
            + Add Tenant
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
            <p className="text-sm text-[var(--soft-stone)]">Total Properties</p>
            <p className="text-2xl font-bold text-[var(--warm-ink)]">{topProperties.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
            <p className="text-sm text-[var(--soft-stone)]">Tenants</p>
            <p className="text-2xl font-bold text-[var(--warm-ink)]">0</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
            <p className="text-sm text-[var(--soft-stone)]">Collection Rate</p>
            <p className="text-2xl font-bold text-[var(--sage)]">{collectionRate?.collectionRate?.toFixed(0) || 0}%</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
            <p className="text-sm text-[var(--soft-stone)]">Revenue</p>
            <p className="text-2xl font-bold text-[var(--warm-ink)]">${summary?.totalRevenue?.toLocaleString() || 0}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === p ? 'bg-[var(--dusty-rose)] text-[var(--warm-ink)]' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] overflow-hidden">
          <div className="p-4 border-b border-[rgba(191,179,163,0.3)]">
            <h2 className="text-lg font-bold text-[var(--warm-ink)]">Properties</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[var(--soft-stone)]">Loading...</div>
          ) : topProperties.length === 0 ? (
            <div className="p-8 text-center text-[var(--soft-stone)]">
              <p className="text-4xl mb-2">🏠</p>
              <p>No properties yet. Add your first property to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(191,179,163,0.2)]">
              {topProperties.map((prop: any) => (
                <div key={prop.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[var(--warm-ink)] font-medium">{prop.unitNumber || prop.name}</p>
                    <p className="text-sm text-[var(--soft-stone)]">${prop.rentAmount?.toLocaleString() || 0}/month • {prop.status}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)] text-sm">{prop.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-8 border-t border-[rgba(191,179,163,0.3)] text-center">
          <p className="text-sm text-[var(--soft-stone)]">
            Powered by <Link to="/" className="text-[var(--dusty-rose)] hover:text-[var(--dusty-rose)] transition">Pabandi</Link> — The Global Trust Layer
          </p>
          <p className="text-xs text-[var(--soft-stone)] mt-2">
            © 2026 Pabandi. All rights reserved.
          </p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
