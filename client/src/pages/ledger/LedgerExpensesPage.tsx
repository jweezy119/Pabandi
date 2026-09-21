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

export default function LedgerExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setExpenses([
      { id: '1', desc: 'Office Rent', amount: 3500, category: 'Rent', date: '2026-09-15', recurring: true },
      { id: '2', desc: 'AWS Services', amount: 890, category: 'Software', date: '2026-09-14', recurring: true },
      { id: '3', desc: 'Marketing Campaign', amount: 2500, category: 'Marketing', date: '2026-09-12', recurring: false },
      { id: '4', desc: 'Team Lunch', amount: 180, category: 'Meals', date: '2026-09-10', recurring: false },
      { id: '5', desc: 'SaaS Subscriptions', amount: 299, category: 'Software', date: '2026-09-08', recurring: true },
    ]);
    setLoading(false);
  }, []);

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      'Rent': 'bg-blue-500/20 text-blue-400',
      'Software': 'bg-purple-500/20 text-purple-400',
      'Marketing': 'bg-amber-500/20 text-amber-400',
      'Meals': 'bg-emerald-500/20 text-emerald-400',
    };
    return colors[cat] || 'bg-white/10 text-gray-400';
  };

  const filtered = expenses.filter((e) => filter === 'all' || e.category.toLowerCase() === filter);

  return (
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="rose" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Expenses</h1>
          <Link to="/ledger/expenses/new" className="px-3 py-1.5 bg-rose-500 text-white rounded text-sm">Add Expense</Link>
        </div>
        <div className="flex gap-2">
          {['all', 'rent', 'software', 'marketing', 'meals'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded text-sm ${filter === s ? 'bg-rose-500 text-white' : 'bg-white/5 text-gray-400'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div key={e.id} className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-white text-sm font-medium">{e.desc}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs rounded ${getCategoryColor(e.category)}`}>{e.category}</span>
                    {e.recurring && <span className="text-xs text-slate-500">🔄 Recurring</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-red-400 font-medium">-${e.amount.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">{e.date}</p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-gray-500 text-center py-8">No expenses found</p>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
