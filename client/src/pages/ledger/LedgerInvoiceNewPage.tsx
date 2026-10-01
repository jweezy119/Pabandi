import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/primitives';
import { getAuthToken } from '../../utils/authToken';

const LEDGER_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/capital`;

/**
 * Create a ledger invoice.
 *
 * Reached from the CapitalOS dashboard's "New Invoice" button, which pointed at
 * /capital/invoices/new — a path with no route, so the primary action on the
 * finance dashboard blanked the app.
 *
 * Note this is the CapitalOS ledger (accounting records). Billing a client is
 * the ContactOS invoice flow at /contact/invoices, which has its own rail
 * routing and payment links. They are different systems; this one is the books.
 */
export default function LedgerInvoiceNewPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [sendNow, setSendNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount);
  const canSubmit = Number.isFinite(numericAmount) && numericAmount > 0 && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${LEDGER_API}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken() || ''}`,
        },
        body: JSON.stringify({
          amount: numericAmount,
          dueDate: new Date(`${dueDate}T12:00:00`).toISOString(),
          status: sendNow ? 'sent' : 'draft',
          lineItems: description.trim()
            ? [{ description: description.trim(), amount: numericAmount }]
            : [{ description: 'Services', amount: numericAmount }],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Could not save (${res.status})`);
      }

      navigate('/capital/invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the invoice');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/capital/invoices')} icon="arrow_back">
          Invoices
        </Button>
      </div>

      <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>New Invoice</h1>

      <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
        A record in your books. To bill a client with a payment link and trust
        scoring, use <Link to="/contact/invoices" className="underline" style={{ color: 'var(--clay)' }}>ContactOS Invoices</Link>.
      </p>

      <form
        onSubmit={handleSubmit}
        className="rounded-[var(--radius-card)] p-6 space-y-5"
        style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
      >
        <div>
          <label htmlFor="amount" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
            Amount (USD) *
          </label>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'rgba(191,179,163,0.4)' }}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
            Description
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you invoicing for?"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'rgba(191,179,163,0.4)' }}
          />
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
            Due date *
          </label>
          <input
            id="dueDate"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'rgba(191,179,163,0.4)' }}
          />
        </div>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--warm-ink)' }}>
          <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
          Mark as sent (counts toward expected incoming)
        </label>

        {error && (
          <div className="clay-alert clay-alert--critical">
            <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/capital/invoices')} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!canSubmit}>
            {saving ? 'Saving…' : sendNow ? 'Create & Mark Sent' : 'Save as Draft'}
          </Button>
        </div>
      </form>
    </div>
  );
}
