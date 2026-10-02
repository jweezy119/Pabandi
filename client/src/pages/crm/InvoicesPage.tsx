import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button, ClaySkeletonCard, Modal } from '../../components/primitives';
import { InvoiceList, InvoiceListRow } from './components/InvoiceList';
import { InvoiceFormModal } from './components/InvoiceFormModal';
import { getAuthToken } from '../../utils/authToken';
import { withBusinessId } from '../../utils/businessContext';
import { useParams, Link } from 'react-router-dom';
import { FiPlus, FiTrash2, FiSend, FiCheckCircle, FiClock, FiAlertCircle, FiEye, FiX } from 'react-icons/fi';

const CRM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CRM_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

type InvoiceData = {
  id: string;
  number: string;
  client: { name: string; reliabilityScore?: number; paymentScore?: number } | null;
  subtotal: number;
  status: string;
  dateDue: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  // Draft deletion. The server route existed and was correct (draft-only, tenant
  // scoped) but had no UI at all, so a mistyped draft invoice was unremovable
  // from the product.
  const [pendingDelete, setPendingDelete] = useState<InvoiceListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The filter lives in the URL so the Money Flow tab can deep-link into a
  // filtered list. It was local state before, which silently discarded
  // ?status= and made every cross-link land on 'all'.
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('status') || 'all';
  // User has no businessId field; ContactJobsPage falls back to 'default' for the same reason.
  const businessId = useAuthStore((s) => (s.user as { businessId?: string } | undefined)?.businessId);

  const setFilter = useCallback((next: string) => {
    setSearchParams(next === 'all' ? {} : { status: next }, { replace: true });
  }, [setSearchParams]);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (search) params.append('search', search);
      if (businessId) params.append('businessId', businessId);
      
      const data = await api(`/invoices?${params.toString()}`);
      setInvoices(data.data || []);
    } finally { setLoading(false); }
  }, [filter, search, businessId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);
  useEffect(() => { api('/clients').then(d => setClients(d.data || [])).catch(() => {}); }, []);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/invoices/${pendingDelete.id}?${withBusinessId()}`, { method: 'DELETE' });
      setPendingDelete(null);
      await loadInvoices();
    } catch (err) {
      // Keep the dialog open and report the failure. Closing it on error would
      // tell the user the invoice was deleted when it still exists.
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the invoice');
    } finally {
      setDeleting(false);
    }
  };

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
        <div className="flex flex-wrap gap-2">
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
        <InvoiceList
          invoices={invoices}
          deletingId={deleting ? pendingDelete?.id ?? null : null}
          onDelete={(invoice) => { setDeleteError(null); setPendingDelete(invoice); }}
        />
      )}

      {showCreate && <InvoiceFormModal clients={clients} businessId={businessId || undefined} onClose={() => setShowCreate(false)} onSave={() => { setShowCreate(false); loadInvoices(); }} />}

      <Modal
        isOpen={!!pendingDelete}
        onClose={() => { if (!deleting) { setPendingDelete(null); setDeleteError(null); } }}
        title="Delete draft invoice?"
        actionText={deleting ? 'Deleting…' : 'Delete'}
        actionVariant="danger"
        onAction={confirmDelete}
      >
        <p className="text-[var(--soft-stone)] mb-4 text-sm">
          <strong style={{ color: 'var(--warm-ink)' }}>{pendingDelete?.number}</strong> for{' '}
          ${pendingDelete?.subtotal?.toLocaleString() ?? 0} will be removed. This cannot be undone.
        </p>
        <p className="text-[var(--soft-stone)] mb-4 text-sm">
          Only drafts can be deleted. Once an invoice has been sent it stays on the record.
        </p>
        {deleteError && (
          <div className="clay-alert clay-alert--critical">
            <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{deleteError}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
