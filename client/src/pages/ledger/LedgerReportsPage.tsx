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
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Financial Reports</h1>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'pnl', label: 'Profit & Loss' },
            { id: 'cashflow', label: 'Cash Flow' },
            { id: 'balance', label: 'Balance Sheet' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id as any)}
              className="px-5 py-2.5 rounded-full text-sm font-medium transition"
              style={{
                background: activeReport === r.id ? 'var(--clay)' : 'var(--warm-sand)',
                color: activeReport === r.id ? 'white' : 'var(--warm-ink)',
                boxShadow: activeReport === r.id ? 'var(--shadow-soft)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {activeReport === 'pnl' && (
          <div className="rounded-[var(--radius-card)] p-6" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--warm-ink)' }}>Profit & Loss Statement</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--soft-stone)' }}>For the period ending September 30, 2026</p>
            <div className="space-y-4">
              {pnlData.map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between mb-1.5">
                    <span
                      className="text-sm"
                      style={{
                        color: 'var(--warm-ink)',
                        fontWeight: row.label.includes('Profit') || row.label.includes('Income') ? 700 : 400,
                      }}
                    >
                      {row.label}
                    </span>
                    <span className="text-sm font-medium" style={{ color: row.value >= 0 ? 'var(--sage)' : 'var(--terracotta)' }}>
                      ${Math.abs(row.value).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: 'var(--warm-sand)' }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${row.pct}%`,
                        background: row.value >= 0 ? 'var(--sage)' : 'var(--terracotta)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeReport === 'cashflow' && (
          <div className="rounded-[var(--radius-card)] p-6" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Cash Flow Statement</h2>
            <div className="space-y-1">
              {cashFlowData.map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center py-3"
                  style={{ borderBottom: '1px solid rgba(191,179,163,0.2)' }}
                >
                  <span style={{ color: 'var(--warm-ink)' }}>{row.label}</span>
                  <span className="font-medium" style={{ color: row.value >= 0 ? 'var(--sage)' : 'var(--terracotta)' }}>
                    ${Math.abs(row.value).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeReport === 'balance' && (
          <div className="rounded-[var(--radius-card)] p-6" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Balance Sheet</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--sage)' }}>Assets</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--warm-ink)' }}>Cash</span>
                    <span style={{ color: 'var(--warm-ink)' }}>$125,000</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--warm-ink)' }}>Accounts Receivable</span>
                    <span style={{ color: 'var(--warm-ink)' }}>$45,000</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--warm-ink)' }}>Inventory</span>
                    <span style={{ color: 'var(--warm-ink)' }}>$18,000</span>
                  </div>
                  <div
                    className="flex justify-between text-sm pt-2"
                    style={{ borderTop: '1px solid rgba(191,179,163,0.3)' }}
                  >
                    <span className="font-bold" style={{ color: 'var(--warm-ink)' }}>Total Assets</span>
                    <span className="font-bold" style={{ color: 'var(--sage)' }}>$188,000</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--terracotta)' }}>Liabilities & Equity</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--warm-ink)' }}>Accounts Payable</span>
                    <span style={{ color: 'var(--warm-ink)' }}>$22,000</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--warm-ink)' }}>Accrued Expenses</span>
                    <span style={{ color: 'var(--warm-ink)' }}>$8,500</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--warm-ink)' }}>Owner Equity</span>
                    <span style={{ color: 'var(--warm-ink)' }}>$100,000</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--warm-ink)' }}>Retained Earnings</span>
                    <span style={{ color: 'var(--warm-ink)' }}>$57,500</span>
                  </div>
                  <div
                    className="flex justify-between text-sm pt-2"
                    style={{ borderTop: '1px solid rgba(191,179,163,0.3)' }}
                  >
                    <span className="font-bold" style={{ color: 'var(--warm-ink)' }}>Total L&E</span>
                    <span className="font-bold" style={{ color: 'var(--sage)' }}>$188,000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="pt-8 text-center" style={{ borderTop: '1px solid rgba(191,179,163,0.2)' }}>
          <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
            Powered by{' '}
            <Link to="/" className="font-medium" style={{ color: 'var(--clay)' }}>
              Pabandi
            </Link>{' '}
            — The Global Trust Layer
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--soft-stone)' }}>© 2026 Pabandi. All rights reserved.</p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
