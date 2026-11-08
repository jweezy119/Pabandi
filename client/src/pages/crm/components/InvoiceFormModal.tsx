import { useState, useEffect, useCallback, useMemo } from 'react';
import { FiX, FiSearch, FiTrash2 } from 'react-icons/fi';
import { Button } from '../../../components/primitives';
import { ClayBadge } from '../../../components/primitives/ClayBadge';
import { getAuthToken } from '../../../utils/authToken';

const CRM_API = `${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/crm`;

type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  passportId?: string;
  paymentScore?: number;
};

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

type InvoiceFormModalProps = {
  onClose: () => void;
  onSave: () => void;
  clients?: Client[];
  businessId?: string;
};

export function InvoiceFormModal({ onClose, onSave, clients: initialClients = [], businessId }: InvoiceFormModalProps) {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [clientsLoading, setClientsLoading] = useState(false);

  const [invoiceDate, setInvoiceDate] = useState('');
  const [dateDue, setDateDue] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 },
  ]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [requireEscrow, setRequireEscrow] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  useEffect(() => {
    setInvoiceDate(today);
    setDateDue(thirtyDaysLater);
  }, []);

  // Fetch real clients from the API (searchable)
  const fetchClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientSearch.trim()) params.set('search', clientSearch.trim());
      if (businessId) params.set('businessId', businessId);
      const res = await fetch(`${CRM_API}/clients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      if (!res.ok) throw new Error('Failed to load clients');
      const d = await res.json();
      setClients(d.data || d || []);
    } catch {
      setClients(initialClients);
    } finally {
      setClientsLoading(false);
    }
  }, [clientSearch, businessId, initialClients]);

  useEffect(() => {
    const t = setTimeout(fetchClients, 300);
    return () => clearTimeout(t);
  }, [fetchClients]);

  // Line item amount auto-calculation
  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        next.amount = Number(next.quantity) * Number(next.rate);
      }
      return next;
    }));
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = useMemo(() => lineItems.reduce((s, item) => s + item.amount, 0), [lineItems]);
  const taxAmount = useMemo(() => subtotal * (taxPercent / 100), [subtotal, taxPercent]);
  const grandTotal = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);
  const depositAmount = useMemo(() => grandTotal * (depositPercent / 100), [grandTotal, depositPercent]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)));
  }, [clients, clientSearch]);

  const handleSave = async () => {
    if (!selectedClient) {
      setSaveError('Please select a client');
      return;
    }
    if (lineItems.some(item => !item.description.trim() || item.amount <= 0)) {
      setSaveError('Please complete all line items with a description and positive amount');
      return;
    }
    if (!dateDue) {
      setSaveError('Due date is required');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        clientId: selectedClient,
        invoiceDate,
        dateDue,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
        subtotal,
        taxPercent,
        taxAmount,
        grandTotal,
        notes,
        requireEscrow,
        ...(requireEscrow && { depositPercent, depositAmount }),
      };

      const res = await fetch(`${CRM_API}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create invoice');
      }

      onSave();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  if (saveError) {
    // Auto-dismiss error after 5 seconds
    setTimeout(() => setSaveError(null), 5000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cream)]/30 p-4 md:p-6" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-[var(--soft-stone)]/30 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6 clay-heading">
          <h3 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Create Invoice</h3>
          <button onClick={onClose} className="p-2 rounded-lg clay-card--interactive" style={{ backgroundColor: 'rgba(232, 217, 197, 0.3)', color: 'var(--soft-stone)' }}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {saveError && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--dusty-rose)]/10 border border-[var(--dusty-rose)]/30">
            <p className="text-sm text-[var(--dusty-rose)]">{saveError}</p>
          </div>
        )}

        <form onSubmit={e => e.preventDefault()} className="space-y-5">
          {/* ── Client Selector ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-bold uppercase text-[var(--soft-stone)]">Client *</label>
              {clientsLoading && <span className="text-xs text-[var(--clay)] animate-pulse">loading…</span>}
            </div>
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 h-4 w-4 text-[var(--soft-stone)]" />
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Search clients…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
              />
            </div>
            {filteredClients.length === 0 && clientSearch.trim() && (
              <p className="text-xs mt-1 text-[var(--soft-stone)]">No matching clients</p>
            )}
            <div className="mt-2 max-h-48 overflow-y-auto border border-[var(--soft-stone)]/30 rounded-lg bg-white">
              {filteredClients.length === 0 && !clientSearch.trim() ? (
                <p className="px-3 py-2 text-xs text-[var(--soft-stone)]">Start typing to search clients</p>
              ) : (
                filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClient(c.id); setClientSearch(c.name); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--warm-sand)]/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-[var(--warm-ink)]">{c.name}</div>
                      <div className="text-xs text-[var(--soft-stone)]">{c.email || c.phone || 'No contact info'}</div>
                    </div>
                    {selectedClient === c.id && (
                      <span className="material-symbols-outlined text-xs text-[var(--clay)]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Dates ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-[var(--soft-stone)] block mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--soft-stone)] block mb-1">Due Date *</label>
              <input
                type="date"
                value={dateDue}
                onChange={e => setDateDue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
              />
            </div>
          </div>

          {/* ── Line Items ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase text-[var(--soft-stone)]">Line Items</label>
              <Button variant="secondary" size="sm" onClick={addLineItem} icon="add">
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {lineItems.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl border border-[var(--soft-stone)]/30 bg-white">
                  <div className="col-span-4">
                    <label className="text-xs text-[var(--soft-stone)] block mb-1">Description</label>
                    <input
                      value={item.description}
                      onChange={e => handleLineItemChange(index, 'description', e.target.value)}
                      placeholder="e.g. Web design services"
                      className="w-full px-2.5 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[var(--soft-stone)] block mb-1">Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity}
                      onChange={e => handleLineItemChange(index, 'quantity', e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-[var(--soft-stone)] block mb-1">Rate</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={e => handleLineItemChange(index, 'rate', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2.5 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[var(--soft-stone)] block mb-1">Amount</label>
                    <div className="w-full px-2.5 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/20 text-sm font-medium text-[var(--warm-ink)] flex items-center">
                      ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeLineItem(item.id)}
                      className="p-2 rounded-lg text-[var(--dusty-rose)] hover:bg-[var(--dusty-rose)]/10 transition-colors"
                      disabled={lineItems.length === 1}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="rounded-xl border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/20 p-4">
            <div className="grid grid-cols-4 gap-4 mb-3">
              <div>
                <div className="text-xs text-[var(--soft-stone)] uppercase tracking-wider font-bold">Subtotal</div>
                <div className="text-lg font-bold text-[var(--warm-ink)]">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--soft-stone)] uppercase tracking-wider font-bold">Tax</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxPercent}
                    onChange={e => setTaxPercent(Number(e.target.value || 0))}
                    className="w-16 px-2 py-1.5 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
                  />
                  <span className="text-xs text-[var(--soft-stone)]">%</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--soft-stone)] uppercase tracking-wider font-bold">Tax Amount</div>
                <div className="text-lg font-medium text-[var(--warm-ink)]">${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--soft-stone)] uppercase tracking-wider font-bold">Grand Total</div>
                <div className="text-lg font-black text-[var(--clay)]">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* ── Escrow Toggle ── */}
          <div className="rounded-xl border border-[var(--soft-stone)]/30 bg-[var(--warm-sand)]/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-xs font-bold uppercase text-[var(--soft-stone)] block">Escrow Deposit</label>
                <p className="text-xs text-[var(--soft-stone)]">Hold part of the payment in escrow until work is accepted.</p>
              </div>
              <ClayBadge label={requireEscrow ? 'Enabled' : 'Disabled'} variant={requireEscrow ? 'success' : 'neutral'} size="sm" />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="escrowToggle"
                checked={requireEscrow}
                onChange={(e) => setRequireEscrow(e.target.checked)}
                className="w-4 h-4 text-[var(--clay)] border-[var(--soft-stone)]/30 rounded focus:ring-[var(--clay)]"
              />
              <label htmlFor="escrowToggle" className="text-sm font-medium text-[var(--warm-ink)] cursor-pointer">
                Require Deposit in Escrow
              </label>
            </div>
            {requireEscrow && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--soft-stone)] block mb-1">Deposit Percentage</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={depositPercent}
                    onChange={e => setDepositPercent(Number(e.target.value || 0))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
                  />
                </div>
                <div className="flex items-end">
                  <div className="text-lg font-medium text-[var(--warm-ink)] mr-2">${depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <span className="text-xs text-[var(--soft-stone)]">deposit</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="text-xs font-bold uppercase text-[var(--soft-stone)] block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Terms, thank-you message, or special instructions…"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:border-[var(--clay)]"
            />
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-6 border-t border-[var(--soft-stone)]/20">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !selectedClient} className="flex-1">
              {saving ? 'Creating…' : 'Save Invoice'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
