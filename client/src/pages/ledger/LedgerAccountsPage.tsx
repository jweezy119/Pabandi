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

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Asset': 'bg-emerald-500/20 text-emerald-400',
      'Liability': 'bg-red-500/20 text-red-400',
      'Equity': 'bg-blue-500/20 text-blue-400',
      'Revenue': 'bg-amber-500/20 text-amber-400',
      'Expense': 'bg-purple-500/20 text-purple-400',
    };
    return colors[type] || 'bg-white/10 text-gray-400';
  };

  return (
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="rose" navItems={navItems}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">Chart of Accounts</h1>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-3 text-gray-400">Code</th>
                  <th className="text-left p-3 text-gray-400">Account</th>
                  <th className="text-left p-3 text-gray-400">Type</th>
                  <th className="text-right p-3 text-gray-400">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.code} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-gray-400 font-mono">{acc.code}</td>
                    <td className="p-3 text-white font-medium">{acc.name}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 text-xs rounded ${getTypeColor(acc.type)}`}>{acc.type}</span></td>
                    <td className={`p-3 text-right font-medium ${acc.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${Math.abs(acc.balance).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
