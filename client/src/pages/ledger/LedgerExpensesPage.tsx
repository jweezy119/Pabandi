import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { getAuthToken } from '../../utils/authToken';

const LEDGER_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/capital`;

const navItems = [
  { path: '/capital', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/capital/invoices', label: 'Invoices', icon: 'receipt' },
  { path: '/capital/expenses', label: 'Expenses', icon: 'money_off' },
  { path: '/capital/accounts', label: 'Accounts', icon: 'account_balance' },
  { path: '/capital/reports', label: 'Reports', icon: 'bar_chart' },
];

type Expense = {
  id: string;
  description: string | null;
  category: string;
  amount: number;
  currency: string;
  incurredAt: string;
};

/**
 * WHY THIS PAGE USED TO BE FAKE
 * `useState([])` and then a useEffect that assigned five invented expenses —
 * Office Rent $3,500, AWS $890, Marketing $2,500 — with no fetch at all. The
 * filters were driven off that array, so choosing "Rent" filtered fiction.
 * GET /capital/expenses existed on the server and had never been called.
 *
 * It now reads the real ledger, and the filter chips are derived from the
 * categories actually present rather than a hardcoded list — so a chip never
 * appears for a category that has no expenses, and a real category is never
 * missing one.
 */
export default function LedgerExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${LEDGER_API}/expenses`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not load (${res.status})`);
      }
      const body = await res.json();
      setExpenses((body.data ?? []) as Expense[]);
    } catch (err) {
      setExpenses([]);
      setError(err instanceof Error ? err.message : 'Could not load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.category))).sort(),
    [expenses],
  );

  const filtered = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter],
  );

  const total = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const categoryColor = (category: string): { bg: string; text: string } => {
    // Hash the category onto the existing clay palette rather than introducing
    // new colours, so a category the user invents still gets a stable swatch.
    const palette = [
      { bg: 'var(--sky-wash)', text: 'var(--warm-ink)' },
      { bg: 'var(--dusty-rose)', text: 'var(--warm-ink)' },
      { bg: 'var(--muted-ochre)', text: 'white' },
      { bg: 'var(--sage)', text: 'white' },
      { bg: 'var(--warm-sand)', text: 'var(--warm-ink)' },
    ];
    let hash = 0;
    for (let i = 0; i < category.length; i += 1) {
      hash = (hash + category.charCodeAt(i)) % palette.length;
    }
    return palette[hash];
  };

  return (
    <DashboardLayout osName="CapitalOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Expenses</h1>
          <Link
            to="/capital/expenses/new"
            className="px-5 py-2.5 rounded-full font-medium transition hover:-translate-y-0.5"
            style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">add</span>
            Add Expense
          </Link>
        </div>

        {error && (
          <div className="clay-alert clay-alert--critical">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{error}</p>
              <button onClick={load} className="text-xs font-medium underline" style={{ color: 'var(--terracotta)' }}>
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {['all', ...categories].map((s) => (
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
        ) : filtered.length === 0 ? (
          <div
            className="rounded-[var(--radius-card)] p-10 text-center"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span
              className="material-symbols-outlined text-4xl mb-2 block"
              style={{ color: 'var(--soft-stone)', opacity: 0.4 }}
              aria-hidden="true"
            >
              {error ? 'cloud_off' : 'receipt_long'}
            </span>
            <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>
              {error ? 'Could not load expenses' : filter === 'all' ? 'No expenses recorded' : `Nothing in ${filter}`}
            </p>
            {!error && filter === 'all' && (
              <>
                <p className="text-sm mt-1 mb-4" style={{ color: 'var(--soft-stone)' }}>
                  Record what you spend and it will show up here and in your cash flow.
                </p>
                <Link
                  to="/capital/expenses/new"
                  className="inline-block px-5 py-2.5 rounded-full font-medium"
                  style={{ background: 'var(--clay)', color: 'white' }}
                >
                  Add your first expense
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
              {filtered.length} expense{filtered.length === 1 ? '' : 's'} ·{' '}
              <span className="font-medium" style={{ color: 'var(--warm-ink)' }}>
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{' '}
              total
            </p>

            <div className="space-y-3">
              {filtered.map((e) => {
                const catStyle = categoryColor(e.category);
                return (
                  <div
                    key={e.id}
                    className="rounded-[var(--radius-card)] p-5 flex justify-between items-center transition hover:-translate-y-0.5"
                    style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
                  >
                    <div className="min-w-0">
                      <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>
                        {e.description || e.category}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="px-3 py-1 text-xs font-medium rounded-full capitalize"
                          style={{ background: catStyle.bg, color: catStyle.text }}
                        >
                          {e.category.replace(/-/g, ' ')}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                          {new Date(e.incurredAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="font-medium ml-4 shrink-0" style={{ color: 'var(--terracotta)' }}>
                      -${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
