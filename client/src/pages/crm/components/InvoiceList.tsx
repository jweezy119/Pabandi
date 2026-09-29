import { Link } from 'react-router-dom';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

export function InvoiceList({ invoices }: { invoices: any[] }) {
  if (invoices.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-3">
      {invoices.map(inv => (
        <Link key={inv.id} to={`/contact/invoices/${inv.id}`} className="flex items-center justify-between p-4 rounded-xl border border-[var(--soft-stone)]/30 bg-white hover:border-[var(--clay)]/30 transition clay-card--interactive clay-table-row">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-[var(--warm-ink)]">{inv.number}</p>
              {inv.client?.reliabilityScore && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(138,154,123,0.1)] text-[var(--sage)]">
                  Trust {inv.client.reliabilityScore}
                </span>
              )}
              {inv.client?.paymentScore !== undefined && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(180,130,90,0.1)] text-[var(--clay)]">
                  {inv.client.paymentScore}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--soft-stone)]">{inv.client?.name || 'Unknown'} · ${inv.subtotal?.toLocaleString() || 0}</p>
          </div>
          <div className="text-right">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize inline-flex items-center ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
            <p className="text-xs text-[var(--soft-stone)] mt-1">Due {new Date(inv.dateDue).toLocaleDateString()}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
