import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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

type LedgerInvoice = {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt: string | null;
  description?: string | null;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
] as const;

/**
 * The only CapitalOS page that already fetched real data, so most of this is
 * fixing the parts around it:
 *
 *  - The filter list was ['all','paid','pending','overdue','draft'] but it
 *    compared `inv.status?.toLowerCase() === filter`. The server stores
 *    'sent', never 'pending', so the "pending" chip matched nothing and always
 *    showed the empty state.
 *  - `getStatusBadge` keyed on title-case names ('Paid', 'Pending') that the
 *    lowercase status never equalled, so every badge fell through to the
 *    default style.
 *  - There was no way to change a status or delete a draft, so the ledger was
 *    write-once from the UI's point of view.
 *  - A failed fetch left the list silently empty with no error and no retry.
 */
export default function LedgerInvoicesPage() {
  const [invoices, setInvoices] = useState<LedgerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${LEDGER_API}/invoices`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not load (${res.status})`);
      }
      const body = await res.json();
      setInvoices((body.data ?? []) as LedgerInvoice[]);
    } catch (err) {
      setInvoices([]);
      setError(err instanceof Error ? err.message : 'Could not load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    setRowError(null);
    try {
      const res = await fetch(`${LEDGER_API}/invoices/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken() || ''}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not update (${res.status})`);
      }
      await load();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Could not update the invoice');
    } finally {
      setBusyId(null);
    }
  };

  const removeDraft = async (id: string) => {
    setBusyId(id);
    setRowError(null);
    try {
      const res = await fetch(`${LEDGER_API}/invoices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not delete (${res.status})`);
      }
      await load();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Could not delete the invoice');
    } finally {
      setBusyId(null);
    }
  };

  const statusStyle = (status: string): { bg: string; text: string } => {
    switch (status) {
      case 'paid': return { bg: 'var(--sage)', text: 'white' };
      case 'sent': return { bg: 'var(--muted-ochre)', text: 'white' };
      case 'overdue': return { bg: 'var(--terracotta)', text: 'white' };
      case 'draft': return { bg: 'var(--soft-stone)', text: 'white' };
      default: return { bg: 'var(--warm-sand)', text: 'var(--warm-ink)' };
    }
  };

  const filtered = invoices.filter((inv) => filter === 'all' || inv.status === filter);

  const outstanding = invoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.amount, 0);

  return (
    <DashboardLayout osName="CapitalOS" osIcon="L" osColor="sky-wash" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Invoices</h1>
            {outstanding > 0 && (
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
                ${outstanding.toLocaleString()} outstanding
              </p>
            )}
          </div>
          <Link
            to="/capital/invoices/new"
            className="px-5 py-2.5 rounded-full font-medium transition hover:-translate-y-0.5"
            style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">add</span>
            New Invoice
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

        {rowError && (
          <div className="clay-alert clay-alert--critical">
            <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{rowError}</p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-4 py-2 rounded-full text-sm font-medium transition"
              style={{
                background: filter === f.key ? 'var(--clay)' : 'var(--warm-sand)',
                color: filter === f.key ? 'white' : 'var(--warm-ink)',
                boxShadow: filter === f.key ? 'var(--shadow-soft)' : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center rounded-[var(--radius-card)]" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <span
              className="material-symbols-outlined text-4xl mb-2 block"
              style={{ color: 'var(--soft-stone)', opacity: 0.4 }}
              aria-hidden="true"
            >
              {error ? 'cloud_off' : 'receipt_long'}
            </span>
            <p style={{ color: 'var(--warm-ink)' }} className="font-medium">
              {error ? 'Could not load invoices' : filter === 'all' ? 'No invoices yet' : `No ${filter} invoices`}
            </p>
            {filter === 'all' && !error && (
              <p className="text-sm mt-1 mb-4" style={{ color: 'var(--soft-stone)' }}>
                Create one to start tracking what you are owed.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] overflow-x-auto" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--warm-sand)' }}>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Invoice</th>
                  <th className="text-right p-4 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Amount</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Status</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Due</th>
                  <th className="text-right p-4 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const s = statusStyle(inv.status);
                  const isDraft = inv.status === 'draft';
                  const isSettled = inv.status === 'paid';
                  return (
                    <tr key={inv.id} style={{ borderTop: '1px solid rgba(191,179,163,0.2)' }}>
                      <td className="p-4" style={{ color: 'var(--warm-ink)' }}>
                        <p className="font-medium">{inv.number}</p>
                        {inv.description && (
                          <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>{inv.description}</p>
                        )}
                      </td>
                      <td className="p-4 text-right font-medium" style={{ color: 'var(--warm-ink)' }}>
                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4">
                        <span
                          className="px-3 py-1 text-xs font-medium rounded-full capitalize"
                          style={{ background: s.bg, color: s.text }}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm" style={{ color: 'var(--soft-stone)' }}>
                        {inv.paidAt
                          ? `Paid ${new Date(inv.paidAt).toLocaleDateString()}`
                          : new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-end">
                          {isDraft && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={busyId === inv.id}
                                onClick={() => setStatus(inv.id, 'sent')}
                              >
                                Mark sent
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="delete"
                                title={`Delete ${inv.number}`}
                                onClick={() => removeDraft(inv.id)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                          {!isDraft && !isSettled && (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={busyId === inv.id}
                              onClick={() => setStatus(inv.id, 'paid')}
                            >
                              Mark paid
                            </Button>
                          )}
                          {isSettled && (
                            <span className="text-xs" style={{ color: 'var(--soft-stone)' }}>Settled</span>
                          )}
                        </div>
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
