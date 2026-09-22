import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/ledger', label: 'Overview', icon: 'dashboard', end: true },
  { path: '/ledger/invoices', label: 'Invoices', icon: 'receipt' },
  { path: '/ledger/expenses', label: 'Expenses', icon: 'money_off' },
  { path: '/ledger/accounts', label: 'Accounts', icon: 'account_balance' },
  { path: '/ledger/reports', label: 'Reports', icon: 'bar_chart' },
];

export default function LedgerInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/ledger/invoices`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch invoices:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'Paid': 'bg-emerald-500/20 text-emerald-400',
      'Pending': 'bg-amber-500/20 text-amber-400',
      'Overdue': 'bg-red-500/20 text-red-400',
      'Draft': 'bg-slate-500/20 text-slate-400',
    };
    return <span className={`px-2 py-0.5 text-xs rounded ${colors[status] || 'bg-white/10 text-gray-400'}`}>{status}</span>;
  };

  const filtered = invoices.filter((inv) => filter === 'all' || inv.status?.toLowerCase() === filter);

  return (
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="#B8C9D4" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Invoices</h1>
        </div>

        <div className="flex gap-2">
          {['all', 'paid', 'pending', 'overdue', 'draft'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium capitalize"
              style={{ background: filter === f ? 'var(--clay)' : 'var(--warm-sand)', color: filter === f ? 'white' : 'var(--warm-ink)' }}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center rounded-xl" style={{ background: 'var(--warm-sand)' }}>
            <p style={{ color: 'var(--soft-stone)' }}>No invoices found.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--soft-stone)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--warm-sand)' }}>
                  <th className="text-left p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Invoice</th>
                  <th className="text-left p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Client</th>
                  <th className="text-right p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Amount</th>
                  <th className="text-left p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Status</th>
                  <th className="text-left p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-t" style={{ borderColor: 'var(--soft-stone)' }}>
                    <td className="p-3" style={{ color: 'var(--warm-ink)' }}>{inv.number}</td>
                    <td className="p-3" style={{ color: 'var(--soft-stone)' }}>{inv.clientName || inv.client || '—'}</td>
                    <td className="p-3 text-right" style={{ color: 'var(--terracotta)' }}>${(inv.amount || 0).toLocaleString()}</td>
                    <td className="p-3">{getStatusBadge(inv.status)}</td>
                    <td className="p-3" style={{ color: 'var(--soft-stone)' }}>{inv.dueDate || '—'}</td>
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
