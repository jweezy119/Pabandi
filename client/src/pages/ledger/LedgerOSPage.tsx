import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/ledger', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/ledger/invoices', label: 'Invoices', icon: 'receipt' },
  { path: '/ledger/expenses', label: 'Expenses', icon: 'money_off' },
  { path: '/ledger/accounts', label: 'Accounts', icon: 'account_balance' },
  { path: '/ledger/reports', label: 'Reports', icon: 'bar_chart' },
];

export default function LedgerOSPage() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCashFlow({
      inflow: 125000,
      outflow: 87000,
      net: 38000,
      invoices: 24,
      pendingInvoices: 8,
      overdue: 2,
    });
    setLoading(false);
  }, [period]);

  return (
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="rose" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Finance Dashboard</h1>
            <p className="text-slate-400">Cash flow, invoices, and financial reporting</p>
          </div>
          <Link to="/ledger/invoices/new" className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium transition">
            + New Invoice
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Total Inflow</p>
            <p className="text-2xl font-bold text-emerald-400">${cashFlow?.inflow?.toLocaleString() || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Total Outflow</p>
            <p className="text-2xl font-bold text-red-400">${cashFlow?.outflow?.toLocaleString() || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Net Cash Flow</p>
            <p className="text-2xl font-bold text-white">${cashFlow?.net?.toLocaleString() || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Pending Invoices</p>
            <p className="text-2xl font-bold text-amber-400">{cashFlow?.pendingInvoices || 0}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['month', 'year'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === p ? 'bg-rose-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Cash Flow Trend</h2>
          <div className="flex items-end gap-2 h-40">
            {[65, 45, 78, 52, 88, 95, 72, 60, 85, 92, 68, 75].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gradient-to-t from-rose-500 to-rose-400 rounded-t transition-all" style={{ height: `${h}%` }} />
                <p className="text-[10px] text-slate-500 mt-1">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (
            <div className="divide-y divide-white/5">
              {[
                { id: '1', desc: 'Payment from Acme Corp', amount: 15000, type: 'income', date: '2026-09-18' },
                { id: '2', desc: 'Office Rent', amount: -3500, type: 'expense', date: '2026-09-15' },
                { id: '3', desc: 'Software Subscription', amount: -299, type: 'expense', date: '2026-09-14' },
                { id: '4', desc: 'Consulting Revenue', amount: 8500, type: 'income', date: '2026-09-12' },
              ].map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{tx.desc}</p>
                    <p className="text-sm text-slate-400">{tx.date}</p>
                  </div>
                  <span className={`font-medium ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-8 border-t border-white/5 text-center">
          <p className="text-sm text-slate-500">
            Powered by <Link to="/" className="text-rose-400 hover:text-rose-300 transition">Pabandi</Link> — The Global Trust Layer
          </p>
          <p className="text-xs text-slate-600 mt-2">© 2026 Pabandi. All rights reserved.</p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
