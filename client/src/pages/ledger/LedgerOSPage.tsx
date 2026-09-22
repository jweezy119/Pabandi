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
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Finance Dashboard</h1>
            <p style={{ color: 'var(--soft-stone)' }}>Cash flow, invoices, and financial reporting</p>
          </div>
          <Link to="/ledger/invoices/new"
            className="px-5 py-2.5 rounded-full font-medium transition hover:-translate-y-0.5"
            style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">add</span>
            New Invoice
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-[var(--radius-card)] transition hover:-translate-y-0.5"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Total Inflow</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--sage)' }}>${cashFlow?.inflow?.toLocaleString() || 0}</p>
          </div>
          <div className="p-5 rounded-[var(--radius-card)] transition hover:-translate-y-0.5"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Total Outflow</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--dusty-rose)' }}>${cashFlow?.outflow?.toLocaleString() || 0}</p>
          </div>
          <div className="p-5 rounded-[var(--radius-card)] transition hover:-translate-y-0.5"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Net Cash Flow</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>${cashFlow?.net?.toLocaleString() || 0}</p>
          </div>
          <div className="p-5 rounded-[var(--radius-card)] transition hover:-translate-y-0.5"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Pending Invoices</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--muted-ochre)' }}>{cashFlow?.pendingInvoices || 0}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['month', 'year'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-5 py-2 rounded-full text-sm font-medium transition"
              style={{
                background: period === p ? 'var(--clay)' : 'var(--warm-sand)',
                color: period === p ? 'white' : 'var(--warm-ink)',
                boxShadow: period === p ? 'var(--shadow-soft)' : 'none',
              }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="rounded-[var(--radius-card)] p-6"
          style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Cash Flow Trend</h2>
          <div className="flex items-end gap-2 h-40">
            {[65, 45, 78, 52, 88, 95, 72, 60, 85, 92, 68, 75].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full rounded-t transition-all"
                  style={{ height: `${h}%`, background: 'var(--sky-wash)' }} />
                <p className="text-[10px] mt-1" style={{ color: 'var(--soft-stone)' }}>{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] overflow-hidden"
          style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <div className="p-5" style={{ borderBottom: '1px solid rgba(191,179,163,0.3)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Recent Transactions</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
          ) : (
            <div>
              {[
                { id: '1', desc: 'Payment from Acme Corp', amount: 15000, type: 'income', date: '2026-09-18' },
                { id: '2', desc: 'Office Rent', amount: -3500, type: 'expense', date: '2026-09-15' },
                { id: '3', desc: 'Software Subscription', amount: -299, type: 'expense', date: '2026-09-14' },
                { id: '4', desc: 'Consulting Revenue', amount: 8500, type: 'income', date: '2026-09-12' },
              ].map((tx, idx, arr) => (
                <div key={tx.id} className="p-5 flex items-center justify-between"
                  style={{ borderBottom: idx < arr.length - 1 ? '1px solid rgba(191,179,163,0.2)' : 'none' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{tx.desc}</p>
                    <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>{tx.date}</p>
                  </div>
                  <span className="font-medium" style={{ color: tx.amount > 0 ? 'var(--sage)' : 'var(--dusty-rose)' }}>
                    {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-8 text-center" style={{ borderTop: '1px solid rgba(191,179,163,0.3)' }}>
          <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
            Powered by <Link to="/" className="hover:opacity-80 transition" style={{ color: 'var(--clay)' }}>Pabandi</Link> — The Global Trust Layer
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--soft-stone)' }}>© 2026 Pabandi. All rights reserved.</p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
