import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/primitives';

const PAGE_SIZE = 25;

export interface InvoiceListRow {
  id: string;
  number: string;
  status: string;
  subtotal: number;
  dateDue: string;
  client?: {
    name?: string;
    reliabilityScore?: number;
    paymentScore?: number;
  } | null;
}

/**
 * onDelete is optional. When it is absent no delete control is rendered at all
 * — a visible destructive button that quietly does nothing is worse than no
 * button, because the user believes the invoice is gone.
 */
export function InvoiceList({
  invoices,
  onDelete,
  deletingId,
}: {
  invoices: InvoiceListRow[];
  onDelete?: (invoice: InvoiceListRow) => void;
  deletingId?: string | null;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => setVisible(PAGE_SIZE), [invoices.length]);

  if (invoices.length === 0) {
    return null;
  }

  const shown = invoices.slice(0, visible);

  return (
    <div className="space-y-3">
      {shown.map((inv) => {
        // Only drafts are deletable. DELETE /crm/invoices/:id enforces this
        // server-side too, but offering the button on a sent invoice would just
        // produce a 400 the user cannot act on.
        const canDelete = Boolean(onDelete) && inv.status?.toLowerCase() === 'draft';

        return (
          <div key={inv.id} className="flex flex-col sm:flex-row sm:items-stretch gap-2">
            <Link
              to={`/contact/invoices/${inv.id}`}
              className="flex-1 flex items-center justify-between p-4 rounded-xl border border-[var(--soft-stone)]/30 bg-white hover:border-[var(--clay)]/30 transition clay-card--interactive clay-table-row"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--warm-ink)]">{inv.number}</p>
                  {inv.client?.reliabilityScore ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(138,154,123,0.1)] text-[var(--sage)]">
                      Trust {inv.client.reliabilityScore}
                    </span>
                  ) : null}
                  {inv.client?.paymentScore !== undefined ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(180,130,90,0.1)] text-[var(--clay)]">
                      {inv.client.paymentScore}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-[var(--soft-stone)]">
                  {inv.client?.name || 'Unknown'} · ${inv.subtotal?.toLocaleString() || 0}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium capitalize inline-flex items-center"
                  style={{ background: 'var(--warm-sand)', color: 'var(--warm-ink)' }}
                >
                  {inv.status}
                </span>
                <p className="text-xs text-[var(--soft-stone)] mt-1">
                  Due {new Date(inv.dateDue).toLocaleDateString()}
                </p>
              </div>
            </Link>

            <div className="flex items-center justify-end gap-2 sm:contents">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hi ${inv.client?.name || 'there'}, here is your secure invoice link: ${typeof window !== 'undefined' ? window.location.origin : 'https://pabandi.com'}/pay/${inv.id}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Share to WhatsApp"
              className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 self-center transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
            </a>

            {canDelete && (
              <Button
                variant="ghost"
                icon="delete"
                title={`Delete draft ${inv.number}`}
                aria-label={`Delete draft ${inv.number}`}
                loading={deletingId === inv.id}
                onClick={() => onDelete?.(inv)}
                className="shrink-0 self-center"
              />
            )}
            </div>
          </div>
        );
      })}

      {visible < invoices.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="w-full min-h-[44px] rounded-xl border border-[var(--warm-sand)] text-[var(--soft-stone)] touch-target"
        >
          Load {Math.min(PAGE_SIZE, invoices.length - visible)} more ({invoices.length - visible} remaining)
        </button>
      )}
    </div>
  );
}
