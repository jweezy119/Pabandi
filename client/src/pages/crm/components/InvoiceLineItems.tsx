export function InvoiceLineItems({ items, subtotal }: { items: any[]; subtotal: number }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <label className="block text-xs text-[var(--soft-stone)] font-medium mb-2">Line Items ({items.length})</label>
      <div className="space-y-2">
        {items.map((j, i) => (
          <div key={i} className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)] text-sm">
            <span>{j.date ? new Date(j.date).toLocaleDateString() : ''} {j.date && j.service ? '·' : ''} {j.service}</span>
            <span className="font-medium">${j.price?.toLocaleString() || 0}</span>
          </div>
        ))}
        <div className="flex justify-between p-2 rounded-lg bg-[var(--soft-stone)]/20 font-bold text-sm">
          <span>Subtotal</span>
          <span>${subtotal.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
