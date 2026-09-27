import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Button, Input } from '../../../components/primitives';

export default function DealListTable({ STAGES, deals, onUpdateStage }: any) {
  const [search, setSearch] = useState('');
  
  const filteredDeals = deals.filter((d: any) => 
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.client && d.client.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[rgba(191,179,163,0.3)] overflow-hidden">
      <div className="p-4 border-b border-[rgba(191,179,163,0.3)] flex justify-between items-center bg-[var(--warm-sand)]/30">
        <div className="w-full max-w-md">
          <Input placeholder="Search deals..." value={search} onChange={(e: any) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--warm-sand)]">
              <th className="p-4 text-sm font-semibold text-[var(--warm-ink)]">Deal Title</th>
              <th className="p-4 text-sm font-semibold text-[var(--warm-ink)]">Client</th>
              <th className="p-4 text-sm font-semibold text-[var(--warm-ink)]">Stage</th>
              <th className="p-4 text-sm font-semibold text-[var(--warm-ink)] text-right">Value</th>
              <th className="p-4 text-sm font-semibold text-[var(--warm-ink)] text-right">Probability</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeals.map((deal: any) => (
              <tr key={deal.id} className="border-t border-[rgba(191,179,163,0.2)] hover:bg-[var(--warm-sand)]/20">
                <td className="p-4 font-medium text-[var(--warm-ink)]">
                  <Link to={`/contact/deals/${deal.id}`} className="hover:text-[var(--clay)] transition">
                    {deal.title}
                  </Link>
                </td>
                <td className="p-4 text-[var(--soft-stone)] text-sm">
                  {deal.client ? deal.client.name : '—'}
                  {deal.client && deal.client.reliabilityScore < 60 && (
                    <span className="text-[var(--dusty-rose)] ml-1 font-bold" title="At Risk">(Risk)</span>
                  )}
                </td>
                <td className="p-4">
                  <select
                    value={deal.stage}
                    onChange={(e) => onUpdateStage(deal.id, e.target.value)}
                    className="text-xs bg-white text-[var(--warm-ink)] border border-[var(--warm-sand)] rounded-lg px-2 py-1"
                  >
                    {STAGES.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </td>
                <td className="p-4 text-right font-bold text-[var(--clay)]">
                  ${(deal.value || 0).toLocaleString()}
                </td>
                <td className="p-4 text-right text-sm text-[var(--soft-stone)]">
                  {deal.probability}%
                </td>
              </tr>
            ))}
            {filteredDeals.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-[var(--soft-stone)]">No deals found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
