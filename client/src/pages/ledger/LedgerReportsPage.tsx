import { useState, useEffect, useCallback, useMemo } from 'react';
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

type MonthPoint = { label: string; income: number; expenses: number; net: number };

type ProfitLoss = {
  period: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  months: MonthPoint[];
  expensesByCategory: { category: string; amount: number }[];
};

type Account = { id: string; name: string; type: string; balance: number };

/**
 * WHY THIS PAGE USED TO BE FAKE
 * Two hardcoded arrays, no fetch and no useEffect: Revenue $250,000, COGS
 * -$75,000, Gross Profit $175,000, Net Income $133,000, and a four-line cash
 * flow. "Balance Sheet" rendered a third hardcoded block. Switching between
 * the three tabs changed which set of invented numbers was on screen.
 *
 * It now reads /capital/profit-loss and /capital/accounts. The P&L is computed
 * from paid ledger invoices and recorded expenses, the twelve-month series is
 * real, and the balance sheet is the sum of the accounts the user has entered.
 *
 * The old server endpoint backed this with propertyFinancial (real-estate rent
 * by property manager), so the CapitalOS P&L was reporting someone else's rent
 * roll. That has been corrected on the server side too.
 */
export default function LedgerReportsPage() {
  const [activeReport, setActiveReport] = useState<'pnl' | 'cashflow' | 'balance'>('pnl');
  const [pnl, setPnl] = useState<ProfitLoss | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pnlRes, accountsRes] = await Promise.all([
        fetch(`${LEDGER_API}/profit-loss`, {
          headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
        }),
        fetch(`${LEDGER_API}/accounts`, {
          headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
        }),
      ]);

      if (!pnlRes.ok) {
        const body = await pnlRes.json().catch(() => null);
        throw new Error(body?.error || `Could not load reports (${pnlRes.status})`);
      }

      const pnlBody = await pnlRes.json();
      setPnl(pnlBody.data as ProfitLoss);

      if (accountsRes.ok) {
        const accountsBody = await accountsRes.json();
        setAccounts((accountsBody.data ?? []) as Account[]);
      }
    } catch (err) {
      setPnl(null);
      setError(err instanceof Error ? err.message : 'Could not load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const money = (n: number) =>
    `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const hasData =
    (pnl?.totalIncome ?? 0) > 0 || (pnl?.totalExpenses ?? 0) > 0 || accounts.length > 0;

  const peak = useMemo(
    () => Math.max(1, ...(pnl?.months ?? []).flatMap((m) => [m.income, m.expenses])),
    [pnl],
  );

  return (
    <DashboardLayout osName="CapitalOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Financial Reports</h1>

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
          {[
            { id: 'pnl', label: 'Profit & Loss' },
            { id: 'cashflow', label: 'Cash Flow' },
            { id: 'balance', label: 'Balance Sheet' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id as 'pnl' | 'cashflow' | 'balance')}
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

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !hasData ? (
          <div
            className="rounded-[var(--radius-card)] p-10 text-center"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span
              className="material-symbols-outlined text-4xl mb-2 block"
              style={{ color: 'var(--soft-stone)', opacity: 0.4 }}
              aria-hidden="true"
            >
              {error ? 'cloud_off' : 'query_stats'}
            </span>
            <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>
              {error ? 'Could not load reports' : 'Nothing to report yet'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--soft-stone)' }}>
              These figures come from your paid invoices and recorded expenses. Mark an invoice paid or
              add an expense and the reports fill in.
            </p>
          </div>
        ) : activeReport === 'pnl' && pnl && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Revenue', value: pnl.totalIncome, color: 'var(--sage)' },
                { label: 'Expenses', value: -pnl.totalExpenses, color: 'var(--dusty-rose)' },
                { label: 'Net', value: pnl.netProfit, color: pnl.netProfit >= 0 ? 'var(--sage)' : 'var(--terracotta)' },
              ].map((row) => (
                <div
                  key={row.label}
                  className="p-5 rounded-[var(--radius-card)]"
                  style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>{row.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: row.color }}>
                    {row.value < 0 ? '-' : ''}{money(row.value)}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
              Profit margin {pnl.profitMargin}% · last 12 months
            </p>

            {pnl.months.length > 0 && (
              <div className="rounded-[var(--radius-card)] p-6" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Monthly Income vs Expenses</h2>
                <div className="flex items-end gap-1 sm:gap-2 h-40">
                  {pnl.months.map((m) => (
                    <div key={m.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '140px' }}>
                        <div
                          className="w-1/2 rounded-t"
                          title={`${m.label} in: ${money(m.income)}`}
                          style={{
                            height: `${Math.max(m.income > 0 ? 2 : 0, (m.income / peak) * 100)}%`,
                            background: 'var(--sage)',
                          }}
                        />
                        <div
                          className="w-1/2 rounded-t"
                          title={`${m.label} out: ${money(m.expenses)}`}
                          style={{
                            height: `${Math.max(m.expenses > 0 ? 2 : 0, (m.expenses / peak) * 100)}%`,
                            background: 'var(--dusty-rose)',
                          }}
                        />
                      </div>
                      <p className="text-[10px] truncate w-full text-center" style={{ color: 'var(--soft-stone)' }}>
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pnl.expensesByCategory.length > 0 && (
              <div className="rounded-[var(--radius-card)] p-6" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Where the money went</h2>
                <div className="space-y-2">
                  {pnl.expensesByCategory.map((c) => {
                    const pct = pnl.totalExpenses > 0 ? (c.amount / pnl.totalExpenses) * 100 : 0;
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize" style={{ color: 'var(--warm-ink)' }}>
                            {c.category.replace(/-/g, ' ')}
                          </span>
                          <span style={{ color: 'var(--soft-stone)' }}>
                            {money(c.amount)} · {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: 'var(--warm-sand)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(2, pct)}%`, background: 'var(--clay)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {activeReport === 'cashflow' && pnl && (
          <div className="rounded-[var(--radius-card)] p-6" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Cash Flow, last 12 months</h2>
            <div className="space-y-2">
              {pnl.months.map((m) => (
                <div
                  key={m.label}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--cream)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--warm-ink)' }}>{m.label}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span style={{ color: 'var(--sage)' }}>+{money(m.income)}</span>
                    <span style={{ color: 'var(--terracotta)' }}>-{money(m.expenses)}</span>
                    <span
                      className="font-medium min-w-[90px] text-right"
                      style={{ color: m.net >= 0 ? 'var(--warm-ink)' : 'var(--terracotta)' }}
                    >
                      {m.net >= 0 ? '+' : '-'}{money(m.net)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeReport === 'balance' && (
          <div className="rounded-[var(--radius-card)] p-6" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--warm-ink)' }}>Balance Sheet</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--soft-stone)' }}>
              The accounts you have recorded. CapitalOS tracks these balances as entered; it does not
              derive them from the ledger.
            </p>

            {accounts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
                No accounts recorded yet. Add them under Accounts to see a balance sheet.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'var(--cream)' }}
                  >
                    <div>
                      <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{a.name}</p>
                      <p className="text-xs capitalize" style={{ color: 'var(--soft-stone)' }}>{a.type}</p>
                    </div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: Number(a.balance) < 0 ? 'var(--terracotta)' : 'var(--warm-ink)' }}
                    >
                      {Number(a.balance) < 0 ? '-' : ''}{money(Number(a.balance))}
                    </p>
                  </div>
                ))}
                <div
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--warm-sand)' }}
                >
                  <p className="text-sm font-bold" style={{ color: 'var(--warm-ink)' }}>Total</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--warm-ink)' }}>
                    {money(accounts.reduce((s, a) => s + Number(a.balance || 0), 0))}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
