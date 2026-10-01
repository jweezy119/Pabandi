import { useState, useEffect, useCallback } from 'react';
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

type TrendBucket = { label: string; income: number; expenses: number };

type CashFlow = {
  period: string;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  incomeCount: number;
  expenseCount: number;
  pendingInvoices: number;
  overdueInvoices: number;
  trend: TrendBucket[];
};

/**
 * WHY THIS PAGE USED TO BE FAKE
 * The dashboard set its own state in a useEffect: inflow 125000, outflow 87000,
 * net 38000, 24 invoices, 8 pending, 2 overdue — invented on every load, with
 * no fetch. The chart drew a literal [65, 45, 78, …] array, and the four
 * "Recent Transactions" rows were hardcoded objects.
 *
 * So a US business opening their finance tab saw numbers that looked like
 * accounts and were fiction, with no empty state and nothing to indicate they
 * were not real. That is worse than an empty page: an empty page is honest.
 *
 * It now reads GET /capital/cashflow, which is computed from the same ledger
 * invoices and expenses the other pages list. Every figure on screen and every
 * number in the chart come from that one response, so they cannot disagree with
 * each other the way the old hardcoded set did.
 */
export default function CapitalOSPage() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${LEDGER_API}/cashflow?period=${period}`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not load (${res.status})`);
      }
      const body = await res.json();
      setCashFlow(body.data as CashFlow);
    } catch (err) {
      setCashFlow(null);
      setError(err instanceof Error ? err.message : 'Could not load cash flow');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const money = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Scale the bars against the largest absolute value in the window, so a quiet
  // month is visibly small rather than being drawn as if it were large.
  const peak = Math.max(
    1,
    ...(cashFlow?.trend ?? []).flatMap((b) => [b.income, b.expenses]),
  );

  const hasActivity =
    (cashFlow?.totalIncome ?? 0) > 0 ||
    (cashFlow?.totalExpenses ?? 0) > 0 ||
    (cashFlow?.pendingInvoices ?? 0) > 0;

  return (
    <DashboardLayout osName="CapitalOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Finance Dashboard</h1>
            <p style={{ color: 'var(--soft-stone)' }}>Cash flow, invoices, and financial reporting</p>
          </div>
          <Link to="/capital/invoices/new"
            className="px-5 py-2.5 rounded-full font-medium transition hover:-translate-y-0.5"
            style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">add</span>
            New Invoice
          </Link>
        </div>

        {error && (
          <div className="clay-alert clay-alert--critical">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{error}</p>
              <button
                onClick={load}
                className="text-xs font-medium underline"
                style={{ color: 'var(--terracotta)' }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Cash In', value: cashFlow?.totalIncome, icon: 'arrow_downward', color: 'var(--sage)' },
            { label: 'Cash Out', value: cashFlow?.totalExpenses, icon: 'arrow_upward', color: 'var(--dusty-rose)' },
            { label: 'Net', value: cashFlow?.netCashFlow, icon: 'account_balance', color: 'var(--clay)' },
            { label: 'Pending Invoices', value: cashFlow?.pendingInvoices, icon: 'schedule', color: 'var(--muted-ochre)', isCount: true },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-[var(--radius-card)]"
              style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>{stat.label}</p>
                <span className="material-symbols-outlined text-[18px]" style={{ color: stat.color }} aria-hidden="true">
                  {stat.icon}
                </span>
              </div>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--warm-ink)' }}>
                {loading
                  ? '—'
                  : stat.isCount
                    ? (stat.value ?? 0).toString()
                    : money(stat.value ?? 0)}
              </p>
            </div>
          ))}
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
              Last {p === 'month' ? '30 days' : '12 months'}
            </button>
          ))}
        </div>

        <div className="rounded-[var(--radius-card)] p-6" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--warm-ink)' }}>Cash Flow</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--soft-stone)' }}>
            Paid invoices against recorded expenses, over the selected period.
          </p>

          {!loading && !cashFlow?.trend?.length && (
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>No data for this period yet.</p>
          )}

          {cashFlow?.trend && cashFlow.trend.length > 0 && (
            <>
              <div className="flex items-end gap-1 sm:gap-2 h-40">
                {cashFlow.trend.map((bucket) => (
                  <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '150px' }}>
                      <div
                        className="w-1/2 rounded-t"
                        title={`In ${bucket.label}: ${money(bucket.income)}`}
                        style={{
                          height: `${Math.max(bucket.income > 0 ? 2 : 0, (bucket.income / peak) * 100)}%`,
                          background: 'var(--sage)',
                        }}
                      />
                      <div
                        className="w-1/2 rounded-t"
                        title={`Out ${bucket.label}: ${money(bucket.expenses)}`}
                        style={{
                          height: `${Math.max(bucket.expenses > 0 ? 2 : 0, (bucket.expenses / peak) * 100)}%`,
                          background: 'var(--dusty-rose)',
                        }}
                      />
                    </div>
                    <p className="text-[10px] truncate w-full text-center" style={{ color: 'var(--soft-stone)' }}>
                      {bucket.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--soft-stone)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--sage)' }} /> In
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--dusty-rose)' }} /> Out
                </span>
              </div>
            </>
          )}
        </div>

        <div className="rounded-[var(--radius-card)] overflow-hidden" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(191,179,163,0.3)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Recent Activity</h2>
            <Link to="/capital/invoices" className="text-sm" style={{ color: 'var(--clay)' }}>
              View all
            </Link>
          </div>

          {!loading && !hasActivity && (
            <div className="p-10 text-center">
              <span
                className="material-symbols-outlined text-4xl mb-2 block"
                style={{ color: 'var(--soft-stone)', opacity: 0.4 }}
                aria-hidden="true"
              >
                receipt_long
              </span>
              <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>Nothing recorded yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--soft-stone)' }}>
                Add your first invoice or expense and your cash flow will appear here.
              </p>
            </div>
          )}

          {loading && (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--soft-stone)' }}>Loading…</div>
          )}

          {cashFlow && hasActivity && (
            <div className="divide-y" style={{ borderColor: 'rgba(191,179,163,0.2)' }}>
              <Link
                to="/capital/invoices"
                className="flex items-center justify-between p-4 hover:bg-[var(--warm-sand)]/20 transition"
              >
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--warm-ink)' }}>Paid invoices</p>
                  <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                    {cashFlow.incomeCount} received this period
                  </p>
                </div>
                <p className="font-medium" style={{ color: 'var(--sage)' }}>{money(cashFlow.totalIncome)}</p>
              </Link>

              <Link
                to="/capital/expenses"
                className="flex items-center justify-between p-4 hover:bg-[var(--warm-sand)]/20 transition"
              >
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--warm-ink)' }}>Expenses</p>
                  <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                    {cashFlow.expenseCount} recorded this period
                  </p>
                </div>
                <p className="font-medium" style={{ color: 'var(--terracotta)' }}>{money(cashFlow.totalExpenses)}</p>
              </Link>

              {cashFlow.overdueInvoices > 0 && (
                <Link
                  to="/capital/invoices"
                  className="flex items-center justify-between p-4 hover:bg-[var(--warm-sand)]/20 transition"
                >
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--terracotta)' }}>Overdue invoices</p>
                    <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>Past their due date</p>
                  </div>
                  <p className="font-medium" style={{ color: 'var(--terracotta)' }}>
                    {cashFlow.overdueInvoices}
                  </p>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
