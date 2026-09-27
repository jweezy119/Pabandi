import { useState, useEffect, useCallback } from 'react';
import { Button, ClaySkeletonCard } from '../../components/primitives';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceFormModal } from './components/InvoiceFormModal';

const CRM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CRM_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

type InvoiceData = { id: string; number: string; client: { name: string }; subtotal: number; status: string; dateDue: string };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (search) params.append('search', search);
      
      const data = await api(`/invoices?${params.toString()}`);
      setInvoices(data.data || []);
    } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);
  useEffect(() => { api('/clients').then(d => setClients(d.data || [])).catch(() => {}); }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-8">
        <ClaySkeletonCard />
        <ClaySkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-4 clay-fade">
    <div className="flex items-center justify-between clay-heading">
      <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Invoices</h2>
      <Button onClick={() => setShowCreate(true)} icon="add">
        New Invoice
      </Button>
    </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex gap-2">
          {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`clay-filter-chip px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              filter === f ? 'clay-filter-chip--active' : 'clay-filter-chip--inactive'
            }`}>{f}</button>
          ))}
        </div>
        
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search by invoice number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm"
          />
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-12 text-center clay-scale-in">
          <p className="text-[var(--soft-stone)]">No invoices yet. <button onClick={() => setShowCreate(true)} className="text-[var(--clay)] hover:underline clay-filter-chip--active" style={{ color: 'white', backgroundColor: 'var(--clay)', padding: '4px 12px', borderRadius: '9999px' }}>Create your first invoice</button></p>
        </div>
      ) : (
        <InvoiceList invoices={invoices} />
      )}

      {showCreate && <InvoiceFormModal clients={clients} onClose={() => setShowCreate(false)} onSave={() => { setShowCreate(false); loadInvoices(); }} />}
    </div>
  );
}
