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

export default function PropertyFinancialsPage() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFinancials(); }, [period]);

  const loadFinancials = async () => {
    try {
      const res = await api.get(`/api/v1/property/revenue?period=${period}`);
      setSummary(res.data?.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <DashboardLayout osName="PropertyOS" osIcon="H" osColor="emerald" navItems={navItems}><div className="text-center py-8"><div className="w-8 h-8 border-4 border-[var(--sage)] border-t-transparent rounded-full animate-spin mx-auto" /></div></DashboardLayout>;

  return (
    <DashboardLayout osName="PropertyOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--warm-ink)]">Financials</h1>
          <div className="flex gap-2">
            <button onClick={() => setPeriod('month')} className={`px-3 py-1 rounded text-sm ${period === 'month' ? 'bg-[var(--sage)] text-[var(--warm-ink)]' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}>Month</button>
            <button onClick={() => setPeriod('year')} className={`px-3 py-1 rounded text-sm ${period === 'year' ? 'bg-[var(--sage)] text-[var(--warm-ink)]' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}>Year</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm">Revenue</p>
            <p className="text-xl font-bold text-[var(--sage)]">${summary?.totalRevenue?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm">Expenses</p>
            <p className="text-xl font-bold text-[var(--terracotta)]">${summary?.totalExpenses?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm">Net Income</p>
            <p className="text-xl font-bold text-[var(--warm-ink)]">${summary?.netIncome?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm">Payments</p>
            <p className="text-xl font-bold text-[var(--warm-ink)]">{summary?.paymentCount || 0}</p>
          </div>
        </div>
        <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
          <h3 className="text-[var(--warm-ink)] text-sm font-medium mb-3">Cash Flow Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-[var(--soft-stone)]">Total Revenue</span><span className="text-[var(--sage)]">${summary?.totalRevenue?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--soft-stone)]">Total Expenses</span><span className="text-[var(--terracotta)]">-${summary?.totalExpenses?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between text-sm border-t border-[rgba(191,179,163,0.3)] pt-2"><span className="text-[var(--warm-ink)] font-medium">Net Cash Flow</span><span className="text-[var(--warm-ink)] font-bold">${summary?.netIncome?.toLocaleString() || 0}</span></div>
          </div>
        </div>
        <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-xl p-4">
          <h3 className="text-[var(--warm-ink)] text-sm font-medium mb-3">Tax Summary</h3>
          <p className="text-[var(--soft-stone)] text-sm">Gross Income: ${summary?.totalRevenue?.toLocaleString() || 0}</p>
          <p className="text-[var(--soft-stone)] text-sm">Deductible Expenses: ${summary?.totalExpenses?.toLocaleString() || 0}</p>
          <p className="text-[var(--soft-stone)] text-sm">Taxable Income: ${summary?.netIncome?.toLocaleString() || 0}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
