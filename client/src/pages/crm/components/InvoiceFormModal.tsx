import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { Button } from '../../../components/primitives';

type Client = { id: string; name: string; passportId?: string; paymentScore?: number };

export function InvoiceFormModal({ onClose, onSave, clients }: { onClose: () => void; onSave: () => void; clients: Client[] }) {
  const [selectedClient, setSelectedClient] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [jobs, setJobs] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [requireEscrow, setRequireEscrow] = useState(false);

  useEffect(() => {
    if (!selectedClient) return;
    const fetchJobs = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs?status=COMPLETED`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const d = await res.json();
        const clientJobs = (d.data || []).filter((j: any) => j.clientId === selectedClient);
        setJobs(clientJobs);
      } catch (err) {}
    };
    fetchJobs();
  }, [selectedClient]);

  const subtotal = jobs.reduce((s, j) => s + (j.price || 0), 0);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const selectedClientData = clients.find(c => c.id === selectedClient);
  const showEscrowToggle = selectedClientData?.paymentScore !== undefined && selectedClientData.paymentScore < 40;

  const handleSave = async (status: 'draft' | 'sent') => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({
          clientId: selectedClient,
          dateDue: lastDay.toISOString(),
          lineItems: jobs.map(j => ({ date: j.scheduledDate, service: j.serviceType, price: j.price })),
          subtotal,
          notes,
          requireEscrow: showEscrowToggle && requireEscrow,
          ...(status === 'sent' && { status: 'sent' }),
        }),
      });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[var(--soft-stone)]/30 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 clay-heading">
          <h3 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Create Invoice</h3>
          <button onClick={onClose} className="p-2 rounded-lg clay-card--interactive" style={{ backgroundColor: 'rgba(232, 217, 197, 0.3)', color: 'var(--soft-stone)' }}><FiX className="w-5 h-5" /></button>
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

          {showEscrowToggle && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <input 
                type="checkbox" 
                id="escrowToggle" 
                checked={requireEscrow} 
                onChange={(e) => setRequireEscrow(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded"
              />
              <label htmlFor="escrowToggle" className="text-sm text-red-800 font-medium">
                Client has low trust score ({selectedClientData?.paymentScore}). Require escrow payment.
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => handleSave('draft')} disabled={saving || !selectedClient}>Save as Draft</Button>
            <Button variant="primary" onClick={() => handleSave('sent')} disabled={saving || !selectedClient}>Save & Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
