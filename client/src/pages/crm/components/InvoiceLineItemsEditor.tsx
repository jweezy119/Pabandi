import { useState } from 'react';

/**
 * Edit the line items of a draft invoice.
 *
 * `updateInvoice` has always accepted `lineItems` and `subtotal`, and the detail
 * page's edit mode only ever sent `notes` and `dateDue`. So a draft invoice with the
 * wrong line items could not be corrected — the only options were to send it wrong or
 * to delete it and recreate it, which loses the number, the client relationship and
 * any notes already written on it.
 *
 * The subtotal is recomputed from the rows rather than accepted from the client. The
 * column is the one thing rails and payment links are derived from, and a form that
 * let a person type a total which then disagreed with the items above it would be
 * storing two different amounts for one invoice.
 *
 * Only rendered while the invoice is a draft, because `updateInvoice` refuses
 * anything else and offering an editor that always fails is worse than none.
 */

interface LineItem {
  date?: string | null;
  service?: string | null;
  price?: number | null;
  [key: string]: unknown;
}

export function InvoiceLineItemsEditor({
  items,
  onSave,
  onCancel,
  saving,
}: {
  items: LineItem[];
  onSave: (items: LineItem[], subtotal: number) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [rows, setRows] = useState<LineItem[]>(
    Array.isArray(items) && items.length ? items : [{ service: '', price: 0 }],
  );
  const [error, setError] = useState<string | null>(null);

  const subtotal = rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

  const setRow = (i: number, patch: Partial<LineItem>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const cleaned = rows
      .filter((r) => (r.service || '').trim() || Number(r.price) > 0)
      .map((r) => ({ ...r, service: (r.service || '').trim() }));

    if (cleaned.length === 0) {
      // An invoice with no priced lines is not an invoice, and sending one would
      // produce a zero-amount invoice that still looks payable.
      setError('A draft invoice needs at least one line with a description and a price.');
      return;
    }
    const bad = cleaned.find((r) => !(Number(r.price) >= 0));
    if (bad) {
      setError('Every line needs a price of zero or more.');
      return;
    }

    setError(null);
    await onSave(cleaned, subtotal);
  };

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="date"
            value={row.date ? String(row.date).slice(0, 10) : ''}
            onChange={(e) => setRow(i, { date: e.target.value || null })}
            aria-label={`Line ${i + 1} date`}
            className="px-3 py-2 rounded-xl border border-[var(--soft-stone)]/40 text-sm"
          />
          <input
            value={row.service || ''}
            onChange={(e) => setRow(i, { service: e.target.value })}
            placeholder="Description"
            aria-label={`Line ${i + 1} description`}
            className="flex-1 px-3 py-2 rounded-xl border border-[var(--soft-stone)]/40 text-sm"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={row.price ?? 0}
            onChange={(e) => setRow(i, { price: e.target.value === '' ? 0 : Number(e.target.value) })}
            aria-label={`Line ${i + 1} price`}
            className="w-28 px-3 py-2 rounded-xl border border-[var(--soft-stone)]/40 text-sm text-right"
          />
          <button
            onClick={() => setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))}
            disabled={rows.length === 1}
            aria-label={`Remove line ${i + 1}`}
            title="Remove this line"
            className="text-[var(--dusty-rose)] disabled:opacity-30 px-1"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          onClick={() => setRows((prev) => [...prev, { service: '', price: 0 }])}
          className="px-3 py-1.5 rounded-full text-sm border border-[var(--soft-stone)]/40"
        >
          Add line
        </button>
        <span className="font-bold text-[var(--warm-ink)]">
          Subtotal ${subtotal.toLocaleString()}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--dusty-rose)' }}>{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--clay)' }}
        >
          Save lines
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-full text-sm border border-[var(--soft-stone)]/40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default InvoiceLineItemsEditor;