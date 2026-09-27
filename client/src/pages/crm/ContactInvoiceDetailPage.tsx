import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, ClaySkeletonCard } from '../../components/primitives';
import { InvoiceLineItems } from './components/InvoiceLineItems';

const CRM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;
const APP_URL = window.location.origin;

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CRM_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

type Metadata = {
  requireEscrow?: boolean;
  transactionHash?: string;
  currency?: string;
};

export default function ContactInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<Metadata>({});
  const [notesText, setNotesText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchInvoice = async () => {
      try {
        const data = await api(`/invoices/${id}`);
        setInvoice(data);
        
        let parsedMeta = {};
        let text = data.notes || '';
        try {
          const parsed = JSON.parse(data.notes || '{}');
          parsedMeta = parsed.metadata || {};
          text = parsed.text || '';
        } catch { }
        
        setMetadata(parsedMeta);
        setNotesText(text);
        
        setEditForm({
          notes: text,
          dateDue: new Date(data.dateDue).toISOString().split('T')[0]
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  if (loading) return <div className="p-8"><ClaySkeletonCard /></div>;
  if (!invoice) return <div className="p-8">Invoice not found.</div>;

  const handleSend = async () => {
    setSaving(true);
    try {
      await api(`/invoices/${id}/send`, { method: 'POST' });
      const data = await api(`/invoices/${id}`);
      setInvoice(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api(`/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      const data = await api(`/invoices/${id}`);
      setInvoice(data);
      let text = data.notes || '';
      try {
        const parsed = JSON.parse(data.notes || '{}');
        text = parsed.text || '';
      } catch { }
      setNotesText(text);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const isDraft = invoice.status === 'draft';
  const paymentLink = `${APP_URL}/pay/${invoice.id}`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 clay-fade">
      <div className="flex items-center justify-between mb-4 clay-heading">
        <h2 className="text-xl font-bold text-[var(--warm-ink)]">Invoice {invoice.number}</h2>
        <div className="flex gap-2">
          {isDraft && !isEditing && (
            <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
          )}
          {isDraft && (
            <Button variant="primary" onClick={handleSend} disabled={saving}>Send Invoice</Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-[var(--soft-stone)]/30 shadow-sm space-y-6">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-[var(--soft-stone)]">Client</p>
            <p className="font-medium text-[var(--warm-ink)]">{invoice.client?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--soft-stone)]">Status</p>
            <span className="px-2 py-1 bg-[var(--clay)]/10 text-[var(--clay)] rounded font-medium text-xs uppercase">{invoice.status}</span>
          </div>
        </div>

        <div>
          <p className="text-sm text-[var(--soft-stone)]">Due Date</p>
          {isEditing ? (
            <input 
              type="date" 
              value={editForm.dateDue} 
              onChange={e => setEditForm({ ...editForm, dateDue: e.target.value })}
              className="mt-1 px-3 py-2 border rounded"
            />
          ) : (
            <p className="font-medium">{new Date(invoice.dateDue).toLocaleDateString()}</p>
          )}
        </div>

        <InvoiceLineItems items={(invoice.lineItems as unknown[]) || []} subtotal={invoice.subtotal as number} />

        <div>
          <p className="text-sm text-[var(--soft-stone)] mb-1">Notes</p>
          {isEditing ? (
            <textarea 
              value={editForm.notes} 
              onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              rows={3}
            />
          ) : (
            <p className="text-sm bg-gray-50 p-3 rounded">{notesText || 'No notes.'}</p>
          )}
        </div>

        {metadata.requireEscrow && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-medium">
            🔒 Escrow Payment Required for this invoice.
          </div>
        )}

        {metadata.transactionHash && (
          <div>
            <p className="text-sm text-[var(--soft-stone)] mb-1">Transaction</p>
            <a 
              href={`https://solscan.io/tx/${metadata.transactionHash}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-[var(--clay)] hover:underline text-sm font-medium"
            >
              View on Solscan ↗
            </a>
          </div>
        )}

        {!isDraft && invoice.status !== 'paid' && (
          <div className="pt-4 border-t border-[var(--soft-stone)]/20">
            <p className="text-sm text-[var(--soft-stone)] mb-2">Payment Link</p>
            <div className="flex gap-2 items-center">
              <input type="text" readOnly value={paymentLink} className="flex-1 px-3 py-2 bg-gray-50 border rounded text-sm" />
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(paymentLink)}>Copy</Button>
            </div>
          </div>
        )}

        {isEditing && (
          <div className="flex gap-2 pt-4 border-t border-[var(--soft-stone)]/20">
            <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>Save Changes</Button>
            <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
}
