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

  const getCategoryStyle = (cat: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      'Rent': { bg: 'var(--sky-wash)', text: 'var(--warm-ink)' },
      'Software': { bg: 'var(--dusty-rose)', text: 'var(--warm-ink)' },
      'Marketing': { bg: 'var(--muted-ochre)', text: 'white' },
      'Meals': { bg: 'var(--sage)', text: 'white' },
    };
    return styles[cat] || { bg: 'var(--warm-sand)', text: 'var(--warm-ink)' };
  };

  const filtered = expenses.filter((e) => filter === 'all' || e.category.toLowerCase() === filter);

  return (
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Expenses</h1>
          <Link
            to="/ledger/expenses/new"
            className="px-5 py-2.5 rounded-full font-medium transition hover:-translate-y-0.5"
            style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">add</span>
            Add Expense
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['all', 'rent', 'software', 'marketing', 'meals'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-4 py-2 rounded-full text-sm font-medium capitalize transition"
              style={{
                background: filter === s ? 'var(--clay)' : 'var(--warm-sand)',
                color: filter === s ? 'white' : 'var(--warm-ink)',
                boxShadow: filter === s ? 'var(--shadow-soft)' : 'none',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => {
              const catStyle = getCategoryStyle(e.category);
              return (
                <div
                  key={e.id}
                  className="rounded-[var(--radius-card)] p-5 flex justify-between items-center transition hover:-translate-y-0.5"
                  style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
                >
                  <div>
                    <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{e.desc}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="px-3 py-1 text-xs font-medium rounded-full"
                        style={{ background: catStyle.bg, color: catStyle.text }}
                      >
                        {e.category}
                      </span>
                      {e.recurring && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--soft-stone)' }}>
                          <span className="material-symbols-outlined text-[14px]">autorenew</span>
                          Recurring
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium" style={{ color: 'var(--terracotta)' }}>-${e.amount.toLocaleString()}</p>
                    <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>{e.date}</p>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center py-8" style={{ color: 'var(--soft-stone)' }}>No expenses found</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
