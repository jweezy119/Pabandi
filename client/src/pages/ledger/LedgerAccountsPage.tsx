import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button } from '../../components/primitives';
import { getAuthToken } from '../../utils/authToken';

const LEDGER_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/capital`;

const navItems = [
  { path: '/capital', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/capital/invoices', label: 'Invoices', icon: 'receipt' },
  { path: '/capital/expenses', label: 'Expenses', icon: 'money_off' },
  { path: '/capital/accounts', label: 'Accounts', icon: 'account_balance' },
  { path: '/capital/reports', label: 'Reports', icon: 'bar_chart' },
];

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
};

const ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'credit', 'loan', 'other'] as const;

/**
 * WHY THIS PAGE USED TO BE FAKE
 * A hardcoded nine-row chart of accounts — Cash $125,000, Revenue $250,000,
 * Owner Equity -$100,000 — assigned straight into state with no fetch. Those
 * are a plausible-looking balance sheet for a company that does not exist, and
 * they did not move.
 *
 * There is a real GET /capital/accounts, and it always returned [] because no
 * route could create a LedgerAccount. So this page now reads the real accounts
 * and can add one, which is the minimum needed for a chart of accounts to be
 * enterable at all.
 *
 * Balances here are opening balances the user records. CapitalOS does not
 * derive them from the ledger, and the page says so rather than implying the
 * figures are computed.
 */
export default function LedgerAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('checking');
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${LEDGER_API}/accounts`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not load (${res.status})`);
      }
      const body = await res.json();
      setAccounts((body.data ?? []) as Account[]);
    } catch (err) {
      setAccounts([]);
      setError(err instanceof Error ? err.message : 'Could not load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`${LEDGER_API}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken() || ''}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          balance: balance === '' ? 0 : Number(balance),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not save (${res.status})`);
      }
      setName('');
      setBalance('');
      setType('checking');
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the account');
    } finally {
      setSaving(false);
    }
  };

  const total = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  return (
    <DashboardLayout osName="CapitalOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Accounts</h1>
            <p style={{ color: 'var(--soft-stone)' }}>Balances you track for this business</p>
          </div>
          <Button
            variant="primary"
            icon={showForm ? 'close' : 'add'}
            onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          >
            {showForm ? 'Cancel' : 'Add Account'}
          </Button>
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

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="rounded-[var(--radius-card)] p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <div className="sm:col-span-2">
              <label htmlFor="acct-name" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
                Account name *
              </label>
              <input
                id="acct-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Operating checking"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'rgba(191,179,163,0.4)' }}
              />
            </div>

            <div>
              <label htmlFor="acct-type" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
                Type
              </label>
              <select
                id="acct-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm capitalize"
                style={{ borderColor: 'rgba(191,179,163,0.4)' }}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="acct-balance" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
                Balance
              </label>
              <input
                id="acct-balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'rgba(191,179,163,0.4)' }}
              />
            </div>

            {formError && (
              <div className="sm:col-span-4 clay-alert clay-alert--critical">
                <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{formError}</p>
              </div>
            )}

            <div className="sm:col-span-4">
              <Button type="submit" variant="primary" loading={saving} disabled={!name.trim() || saving}>
                {saving ? 'Saving…' : 'Save Account'}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div
            className="rounded-[var(--radius-card)] p-10 text-center"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span
              className="material-symbols-outlined text-4xl mb-2 block"
              style={{ color: 'var(--soft-stone)', opacity: 0.4 }}
              aria-hidden="true"
            >
              {error ? 'cloud_off' : 'account_balance'}
            </span>
            <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>
              {error ? 'Could not load accounts' : 'No accounts yet'}
            </p>
            {!error && (
              <>
                <p className="text-sm mt-1 mb-4" style={{ color: 'var(--soft-stone)' }}>
                  Add the accounts you move money through — checking, card, cash.
                </p>
                <Button variant="primary" onClick={() => setShowForm(true)}>Add your first account</Button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)]" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--warm-sand)' }}>
                  <th className="p-4 text-left text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Account</th>
                  <th className="p-4 text-left text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Type</th>
                  <th className="p-4 text-right text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid rgba(191,179,163,0.2)' }}>
                    <td className="p-4 text-sm" style={{ color: 'var(--warm-ink)' }}>{a.name}</td>
                    <td className="p-4 text-sm capitalize" style={{ color: 'var(--soft-stone)' }}>{a.type}</td>
                    <td
                      className="p-4 text-right text-sm font-medium"
                      style={{ color: (Number(a.balance) || 0) < 0 ? 'var(--terracotta)' : 'var(--warm-ink)' }}
                    >
                      {a.balance < 0 ? '-' : ''}${Math.abs(Number(a.balance)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid rgba(191,179,163,0.4)', background: 'var(--cream)' }}>
                  <td className="p-4 text-sm font-bold" style={{ color: 'var(--warm-ink)' }} colSpan={2}>
                    Total
                  </td>
                  <td className="p-4 text-right text-sm font-bold" style={{ color: 'var(--warm-ink)' }}>
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
