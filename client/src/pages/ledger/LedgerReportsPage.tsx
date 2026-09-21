import { useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/ledger', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/ledger/invoices', label: 'Invoices', icon: 'receipt' },
  { path: '/ledger/expenses', label: 'Expenses', icon: 'money_off' },
  { path: '/ledger/accounts', label: 'Accounts', icon: 'account_balance' },
  { path: '/ledger/reports', label: 'Reports', icon: 'bar_chart' },
];

export default function LedgerReportsPage() {
  const [activeReport, setActiveReport] = useState<'pnl' | 'cashflow' | 'balance'>('pnl');

  const pnlData = [
    { label: 'Revenue', value: 250000, pct: 100 },
    { label: 'Cost of Goods Sold', value: -75000, pct: 30 },
    { label: 'Gross Profit', value: 175000, pct: 70 },
    { label: 'Operating Expenses', value: -42000, pct: 16.8 },
    { label: 'Net Income', value: 133000, pct: 53.2 },
  ];

  const cashFlowData = [
    { label: 'Operating Activities', value: 145000 },
    { label: 'Investing Activities', value: -25000 },
    { label: 'Financing Activities', value: -50000 },
    { label: 'Net Change in Cash', value: 70000 },
  ];

  return (
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="rose" navItems={navItems}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">Financial Reports</h1>
        <div className="flex gap-2">
          {[
            { id: 'pnl', label: 'Profit & Loss' },
            { id: 'cashflow', label: 'Cash Flow' },
            { id: 'balance', label: 'Balance Sheet' },
          ].map((r) => (
            <button key={r.id} onClick={() => setActiveReport(r.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeReport === r.id ? 'bg-rose-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
              {r.label}
            </button>
          ))}
        </div>

        {activeReport === 'pnl' && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Profit & Loss Statement</h2>
            <p className="text-sm text-slate-400 mb-4">For the period ending September 30, 2026</p>
            <div className="space-y-3">
              {pnlData.map((row) => (
                <div key={row.label} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className={`text-sm ${row.label.includes('Profit') || row.label.includes('Income') ? 'text-white font-bold' : 'text-slate-300'}`}>{row.label}</span>
                      <span className={`text-sm font-medium ${row.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${Math.abs(row.value).toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div className={`h-2 rounded-full ${row.value >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeReport === 'cashflow' && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Cash Flow Statement</h2>
            <div className="space-y-3">
              {cashFlowData.map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-slate-300">{row.label}</span>
                  <span className={`font-medium ${row.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${Math.abs(row.value).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeReport === 'balance' && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Balance Sheet</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-emerald-400 mb-2">Assets</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-300">Cash</span><span className="text-white">$125,000</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-300">Accounts Receivable</span><span className="text-white">$45,000</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-300">Inventory</span><span className="text-white">$18,000</span></div>
                  <div className="flex justify-between text-sm border-t border-white/10 pt-2"><span className="text-white font-bold">Total Assets</span><span className="text-emerald-400 font-bold">$188,000</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-400 mb-2">Liabilities & Equity</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-300">Accounts Payable</span><span className="text-white">$22,000</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-300">Accrued Expenses</span><span className="text-white">$8,500</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-300">Owner Equity</span><span className="text-white">$100,000</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-300">Retained Earnings</span><span className="text-white">$57,500</span></div>
                  <div className="flex justify-between text-sm border-t border-white/10 pt-2"><span className="text-white font-bold">Total L&E</span><span className="text-emerald-400 font-bold">$188,000</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

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
