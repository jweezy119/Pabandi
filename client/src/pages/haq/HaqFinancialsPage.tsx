import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/haq', label: 'Dashboard', icon: '📊', end: true },
  { path: '/haq/tenants', label: 'Tenants', icon: '👥' },
  { path: '/haq/leases', label: 'Leases', icon: '📝' },
  { path: '/haq/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/haq/financials', label: 'Financials', icon: '💰' },
];

export default function HaqFinancialsPage() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFinancials(); }, [period]);

  const loadFinancials = async () => {
    try {
      const res = await api.get(`/api/v1/haq/revenue?period=${period}`);
      setSummary(res.data?.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <DashboardLayout osName="HaqOS" osIcon="H" osColor="emerald" navItems={navItems}><div className="text-center py-8"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></DashboardLayout>;

  return (
    <DashboardLayout osName="HaqOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Financials</h1>
          <div className="flex gap-2">
            <button onClick={() => setPeriod('month')} className={`px-3 py-1 rounded text-sm ${period === 'month' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400'}`}>Month</button>
            <button onClick={() => setPeriod('year')} className={`px-3 py-1 rounded text-sm ${period === 'year' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400'}`}>Year</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Revenue</p>
            <p className="text-xl font-bold text-emerald-400">${summary?.totalRevenue?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Expenses</p>
            <p className="text-xl font-bold text-red-400">${summary?.totalExpenses?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Net Income</p>
            <p className="text-xl font-bold text-white">${summary?.netIncome?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Payments</p>
            <p className="text-xl font-bold text-white">{summary?.paymentCount || 0}</p>
          </div>
        </div>
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
          <h3 className="text-white text-sm font-medium mb-3">Cash Flow Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-400">Total Revenue</span><span className="text-emerald-400">${summary?.totalRevenue?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Total Expenses</span><span className="text-red-400">-${summary?.totalExpenses?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between text-sm border-t border-white/5 pt-2"><span className="text-white font-medium">Net Cash Flow</span><span className="text-white font-bold">${summary?.netIncome?.toLocaleString() || 0}</span></div>
          </div>
        </div>
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
          <h3 className="text-white text-sm font-medium mb-3">Tax Summary</h3>
          <p className="text-gray-400 text-sm">Gross Income: ${summary?.totalRevenue?.toLocaleString() || 0}</p>
          <p className="text-gray-400 text-sm">Deductible Expenses: ${summary?.totalExpenses?.toLocaleString() || 0}</p>
          <p className="text-gray-400 text-sm">Taxable Income: ${summary?.netIncome?.toLocaleString() || 0}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
