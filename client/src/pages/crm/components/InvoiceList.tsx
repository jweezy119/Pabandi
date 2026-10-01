import { Link } from 'react-router-dom';
import { Button } from '../../../components/primitives';

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
  if (invoices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {invoices.map((inv) => {
        // Only drafts are deletable. DELETE /crm/invoices/:id enforces this
        // server-side too, but offering the button on a sent invoice would just
        // produce a 400 the user cannot act on.
        const canDelete = Boolean(onDelete) && inv.status?.toLowerCase() === 'draft';

        return (
          <div key={inv.id} className="flex items-stretch gap-2">
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
        );
      })}
    </div>
  );
}
