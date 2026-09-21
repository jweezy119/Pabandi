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

export default function LedgerInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setInvoices([
      { id: '1', number: 'INV-001', client: 'Acme Corp', amount: 15000, status: 'Paid', dueDate: '2026-09-15' },
      { id: '2', number: 'INV-002', client: 'TechStart Inc', amount: 8500, status: 'Pending', dueDate: '2026-09-25' },
      { id: '3', number: 'INV-003', client: 'Global Ventures', amount: 12000, status: 'Overdue', dueDate: '2026-09-01' },
      { id: '4', number: 'INV-004', client: 'NextGen Solutions', amount: 5500, status: 'Draft', dueDate: '2026-10-01' },
    ]);
    setLoading(false);
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

  const filtered = invoices.filter((inv) => filter === 'all' || inv.status.toLowerCase() === filter);

  return (
    <DashboardLayout osName="LedgerOS" osIcon="L" osColor="rose" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Invoices</h1>
          <Link to="/ledger/invoices/new" className="px-3 py-1.5 bg-rose-500 text-white rounded text-sm">New Invoice</Link>
        </div>
        <div className="flex gap-2">
          {['all', 'paid', 'pending', 'overdue', 'draft'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded text-sm ${filter === s ? 'bg-rose-500 text-white' : 'bg-white/5 text-gray-400'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-3 text-gray-400">Invoice</th>
                  <th className="text-left p-3 text-gray-400">Client</th>
                  <th className="text-left p-3 text-gray-400">Amount</th>
                  <th className="text-left p-3 text-gray-400">Status</th>
                  <th className="text-left p-3 text-gray-400">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-white font-medium">{inv.number}</td>
                    <td className="p-3 text-gray-400">{inv.client}</td>
                    <td className="p-3 text-white">${inv.amount.toLocaleString()}</td>
                    <td className="p-3">{getStatusBadge(inv.status)}</td>
                    <td className="p-3 text-gray-400">{inv.dueDate}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-gray-500">No invoices found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
