import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import api from '../services/api';

const navItems = [
  { path: '/haq', label: 'Dashboard', icon: '📊', end: true },
  { path: '/haq/tenants', label: 'Tenants', icon: '👥' },
  { path: '/haq/leases', label: 'Leases', icon: '📝' },
  { path: '/haq/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/haq/financials', label: 'Financials', icon: '💰' },
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
      <DashboardLayout osName="HaqOS" osIcon="H" osColor="emerald" navItems={navItems}>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="HaqOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Property Dashboard</h1>
          <div className="flex gap-2">
            {(['week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-sm ${period === p ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400'}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Total Revenue</p>
            <p className="text-2xl font-bold text-white">${summary?.totalRevenue?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Expenses</p>
            <p className="text-2xl font-bold text-red-400">${summary?.totalExpenses?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Net Income</p>
            <p className="text-2xl font-bold text-emerald-400">${summary?.netIncome?.toLocaleString() || 0}</p>
          </div>
        </div>

        {/* Collection Rate */}
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
          <p className="text-gray-400 text-sm mb-2">Rent Collection Rate</p>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${collectionRate?.collectionRate || 0}%` }}
              />
            </div>
            <span className="text-white font-bold">{collectionRate?.collectionRate?.toFixed(1) || 0}%</span>
          </div>
        </div>

        {/* Top Properties */}
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
          <p className="text-gray-400 text-sm mb-3">Top Properties</p>
          <div className="space-y-2">
            {topProperties.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="text-white text-sm">{p.title}</p>
                  <p className="text-gray-500 text-xs">{p.address}</p>
                </div>
                <p className="text-emerald-400 font-medium">${p.rentAmount?.toLocaleString()}/mo</p>
              </div>
            ))}
            {topProperties.length === 0 && <p className="text-gray-500 text-sm">No properties yet</p>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to="/haq/tenants" className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 text-center hover:border-emerald-500/30">
            <span className="text-2xl">👥</span>
            <p className="text-white text-sm mt-1">Add Tenant</p>
          </Link>
          <Link to="/haq/leases" className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 text-center hover:border-emerald-500/30">
            <span className="text-2xl">📝</span>
            <p className="text-white text-sm mt-1">Create Lease</p>
          </Link>
          <Link to="/haq/maintenance" className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 text-center hover:border-emerald-500/30">
            <span className="text-2xl">🔧</span>
            <p className="text-white text-sm mt-1">Post Maintenance</p>
          </Link>
          <Link to="/haq/financials" className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 text-center hover:border-emerald-500/30">
            <span className="text-2xl">📊</span>
            <p className="text-white text-sm mt-1">View Reports</p>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
