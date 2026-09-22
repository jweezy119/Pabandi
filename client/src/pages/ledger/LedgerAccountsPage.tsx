import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/ledger', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/ledger/invoices', label: 'Invoices', icon: 'receipt' },
  { path: '/ledger/expenses', label: 'Expenses', icon: 'money_off' },
  { path: '/ledger/accounts', label: 'Accounts', icon: 'account_balance' },
  { path: '/ledger/reports', label: 'Reports', icon: 'bar_chart' },
];

const CHART_OF_ACCOUNTS = [
  { code: '1000', name: 'Cash & Equivalents', type: 'Asset', balance: 125000 },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', balance: 45000 },
  { code: '1200', name: 'Inventory', type: 'Asset', balance: 18000 },
  { code: '2000', name: 'Accounts Payable', type: 'Liability', balance: -22000 },
  { code: '2100', name: 'Accrued Expenses', type: 'Liability', balance: -8500 },
  { code: '3000', name: 'Owner Equity', type: 'Equity', balance: -100000 },
  { code: '4000', name: 'Revenue', type: 'Revenue', balance: 250000 },
  { code: '5000', name: 'Cost of Goods Sold', type: 'Expense', balance: -75000 },
  { code: '6000', name: 'Operating Expenses', type: 'Expense', balance: -42000 },
];

export default function LedgerAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAccounts(CHART_OF_ACCOUNTS);
    setLoading(false);
  }, []);

  const getTypeStyle = (type: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      'Asset': { bg: 'var(--sage)', text: 'white' },
      'Liability': { bg: 'var(--terracotta)', text: 'white' },
      'Equity': { bg: 'var(--sky-wash)', text: 'var(--warm-ink)' },
      'Revenue': { bg: 'var(--muted-ochre)', text: 'white' },
      'Expense': { bg: 'var(--dusty-rose)', text: 'var(--warm-ink)' },
    };
    return styles[type] || { bg: 'var(--warm-sand)', text: 'var(--warm-ink)' };
  };

  return (
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Chart of Accounts</h1>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] overflow-hidden" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--warm-sand)' }}>
                  <th className="text-left p-4 font-semibold" style={{ color: 'var(--warm-ink)' }}>Code</th>
                  <th className="text-left p-4 font-semibold" style={{ color: 'var(--warm-ink)' }}>Account</th>
                  <th className="text-left p-4 font-semibold" style={{ color: 'var(--warm-ink)' }}>Type</th>
                  <th className="text-right p-4 font-semibold" style={{ color: 'var(--warm-ink)' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => {
                  const typeStyle = getTypeStyle(acc.type);
                  return (
                    <tr key={acc.code} style={{ borderTop: '1px solid rgba(191,179,163,0.2)' }}>
                      <td className="p-4 font-mono" style={{ color: 'var(--soft-stone)' }}>{acc.code}</td>
                      <td className="p-4 font-medium" style={{ color: 'var(--warm-ink)' }}>{acc.name}</td>
                      <td className="p-4">
                        <span
                          className="px-3 py-1 text-xs font-medium rounded-full"
                          style={{ background: typeStyle.bg, color: typeStyle.text }}
                        >
                          {acc.type}
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium" style={{ color: acc.balance >= 0 ? 'var(--sage)' : 'var(--terracotta)' }}>
                        ${Math.abs(acc.balance).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
