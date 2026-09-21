import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/abode', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/abode/tenants', label: 'Tenants', icon: 'people' },
  { path: '/abode/leases', label: 'Leases', icon: 'description' },
  { path: '/abode/maintenance', label: 'Maintenance', icon: 'build' },
  { path: '/abode/financials', label: 'Financials', icon: 'bar_chart' },
];

export default function AbodeOSPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [summary, setSummary] = useState<any>(null);
  const [collectionRate, setCollectionRate] = useState<any>(null);
  const [topProperties, setTopProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    try {
      const [summaryRes, rateRes, propsRes] = await Promise.all([
        api.get(`/api/v1/haq/revenue?period=${period}`).catch(() => ({ data: { data: null } })),
        api.get('/api/v1/haq/revenue/collection-rate').catch(() => ({ data: { data: null } })),
        api.get('/api/v1/haq/revenue/top-properties').catch(() => ({ data: { data: [] } })),
      ]);
      setSummary(summaryRes.data?.data);
      setCollectionRate(rateRes.data?.data);
      setTopProperties(propsRes.data?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <DashboardLayout osName="AbodeOS" osIcon="H" osColor="violet" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400">Property management for landlords and builders</p>
          </div>
          <Link to="/haq/tenants" className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium transition">
            + Add Tenant
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Total Properties</p>
            <p className="text-2xl font-bold text-white">{topProperties.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Tenants</p>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Collection Rate</p>
            <p className="text-2xl font-bold text-emerald-400">{collectionRate?.collectionRate?.toFixed(0) || 0}%</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Revenue</p>
            <p className="text-2xl font-bold text-white">${summary?.totalRevenue?.toLocaleString() || 0}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === p ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white">Properties</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : topProperties.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="text-4xl mb-2">🏠</p>
              <p>No properties yet. Add your first property to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {topProperties.map((prop: any) => (
                <div key={prop.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{prop.unitNumber || prop.name}</p>
                    <p className="text-sm text-slate-400">${prop.rentAmount?.toLocaleString() || 0}/month • {prop.status}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-sm">{prop.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-8 border-t border-white/5 text-center">
          <p className="text-sm text-slate-500">
            Powered by <Link to="/" className="text-violet-400 hover:text-violet-300 transition">Pabandi</Link> — The Global Trust Layer
          </p>
          <p className="text-xs text-slate-600 mt-2">
            © 2026 Pabandi. All rights reserved.
          </p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
