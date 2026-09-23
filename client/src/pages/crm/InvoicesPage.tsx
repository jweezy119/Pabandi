import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiPlus, FiTrash2, FiSend, FiCheckCircle, FiClock, FiAlertCircle, FiEye, FiX } from 'react-icons/fi';

const CRM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CRM_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const query = filter !== 'all' ? `?status=${filter}` : '';
      const data = await api(`/invoices${query}`);
      setInvoices(data.data || []);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  if (loading) return <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--clay)]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--warm-ink)]">Invoices</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === f ? 'bg-[var(--clay)] text-white' : 'bg-white border border-[var(--soft-stone)]/30 text-[var(--warm-ink)]'}`}>{f}</button>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-12 text-center">
          <p className="text-[var(--soft-stone)]">No invoices yet. <button onClick={() => setShowCreate(true)} className="text-[var(--clay)] hover:underline">Create your first invoice</button></p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <Link key={inv.id} to={`/contact/invoices/${inv.id}`} className="flex items-center justify-between p-4 rounded-xl border border-[var(--soft-stone)]/30 bg-white hover:border-[var(--clay)]/30 transition">
              <div>
                <p className="font-medium text-[var(--warm-ink)]">{inv.number}</p>
                <p className="text-sm text-[var(--soft-stone)]">{inv.client?.name || 'Unknown'} · ${inv.subtotal?.toLocaleString() || 0}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
                <p className="text-xs text-[var(--soft-stone)] mt-1">Due {new Date(inv.dateDue).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onSave={() => { setShowCreate(false); loadInvoices(); }} />}
    </div>
  );
}

function CreateInvoiceModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [jobs, setJobs] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/clients').then(d => setClients(d.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    // Fetch completed jobs for this client
    api('/jobs?status=COMPLETED').then(d => {
      const clientJobs = (d.data || []).filter((j: any) => j.clientId === selectedClient);
      setJobs(clientJobs);
    }).catch(() => {});
  }, [selectedClient]);

  const subtotal = jobs.reduce((s, j) => s + (j.price || 0), 0);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const handleSave = async (status: 'draft' | 'sent') => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          clientId: selectedClient,
          dateDue: lastDay.toISOString(),
          lineItems: jobs.map(j => ({ date: j.scheduledDate, service: j.serviceType, price: j.price })),
          subtotal,
          notes,
          ...(status === 'sent' && { status: 'sent' }),
        }),
      });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[var(--soft-stone)]/30 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--warm-ink)]">Create Invoice</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--warm-sand)]"><FiX className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Client *</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm">
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">From</label>
              <input type="date" value={dateRange.from || firstDay.toISOString().split('T')[0]} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">To</label>
              <input type="date" value={dateRange.to || lastDay.toISOString().split('T')[0]} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm" />
            </div>
          </div>

          {jobs.length > 0 && (
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-2">Line Items ({jobs.length} completed jobs)</label>
              <div className="space-y-2">
                {jobs.map(j => (
                  <div key={j.id} className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)] text-sm">
                    <span>{new Date(j.scheduledDate).toLocaleDateString()} · {j.serviceType}</span>
                    <span className="font-medium">${j.price?.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between p-2 rounded-lg bg-[var(--soft-stone)]/20 font-bold text-sm">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm" placeholder="Optional notes..." />
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => handleSave('draft')} disabled={saving || !selectedClient} className="flex-1 py-2 rounded-xl border border-[var(--soft-stone)]/30 text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] disabled:opacity-50">Save as Draft</button>
            <button onClick={() => handleSave('sent')} disabled={saving || !selectedClient} className="flex-1 py-2 rounded-xl bg-[var(--clay)] text-white text-sm font-medium hover:bg-[var(--terracotta)] disabled:opacity-50">Save & Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
