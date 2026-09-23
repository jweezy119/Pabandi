import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiSend, FiCheckCircle, FiTrash2, FiClock, FiAlertCircle } from 'react-icons/fi';

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

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/invoices/${id}`).then(d => setInvoice(d.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    await api(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    const data = await api(`/invoices/${id}`);
    setInvoice(data.data);
  };

  const deleteInvoice = async () => {
    if (!confirm('Delete this invoice?')) return;
    await api(`/invoices/${id}`, { method: 'DELETE' });
    window.location.href = '/contact/invoices';
  };

  if (loading) return <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--clay)]" /></div>;
  if (!invoice) return <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center"><p className="text-[var(--soft-stone)]">Invoice not found</p></div>;

  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : JSON.parse(invoice.lineItems || '[]');

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <Link to="/contact/invoices" className="flex items-center gap-2 text-sm text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">
        <FiArrowLeft className="w-4 h-4" /> Back to invoices
      </Link>

      <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[var(--soft-stone)]">Invoice</p>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">{invoice.number}</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_COLORS[invoice.status] || ''}`}>{invoice.status}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-[var(--soft-stone)]">Client</p>
            <p className="font-medium text-[var(--warm-ink)]">{invoice.client?.name || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--soft-stone)]">Amount</p>
            <p className="font-bold text-xl text-[var(--warm-ink)]">${invoice.subtotal?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--soft-stone)]">Date Issued</p>
            <p className="text-sm text-[var(--warm-ink)]">{new Date(invoice.dateIssued).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--soft-stone)]">Due Date</p>
            <p className="text-sm text-[var(--warm-ink)]">{new Date(invoice.dateDue).toLocaleDateString()}</p>
          </div>
        </div>

        {lineItems.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-[var(--soft-stone)] font-medium mb-2">Line Items</p>
            <div className="space-y-2">
              {lineItems.map((item: any, i: number) => (
                <div key={i} className="flex justify-between p-3 rounded-lg bg-[var(--warm-sand)] text-sm">
                  <span>{item.date ? new Date(item.date).toLocaleDateString() : ''} · {item.service}</span>
                  <span className="font-medium">${item.price?.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between p-3 rounded-lg bg-[var(--soft-stone)]/20 font-bold">
                <span>Total</span>
                <span>${invoice.subtotal?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {invoice.notes && (
          <div className="mb-6">
            <p className="text-xs text-[var(--soft-stone)] font-medium mb-1">Notes</p>
            <p className="text-sm text-[var(--warm-ink)]">{invoice.notes}</p>
          </div>
        )}

        <div className="flex gap-3">
          {invoice.status === 'draft' && (
            <button onClick={() => updateStatus('sent')} className="px-4 py-2 bg-[var(--muted-ochre)] text-white rounded-xl text-sm font-medium flex items-center gap-2">
              <FiSend className="w-4 h-4" /> Mark as Sent
            </button>
          )}
          {invoice.status === 'sent' && (
            <button onClick={() => updateStatus('paid')} className="px-4 py-2 bg-[var(--sage)] text-white rounded-xl text-sm font-medium flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4" /> Mark as Paid
            </button>
          )}
          {invoice.status === 'draft' && (
            <button onClick={deleteInvoice} className="px-4 py-2 bg-[var(--terracotta)] text-white rounded-xl text-sm font-medium flex items-center gap-2">
              <FiTrash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
