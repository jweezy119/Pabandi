import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { CSVExportButton } from './CSVExportButton';

export function ClientHealthWidget({ data, loading }: { data: any, loading: boolean }) {
  if (loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[300px]" />;

  const { atRisk = [], newClients = [], topClients = [] } = data || {};

  return (
    <Card padding="lg" className="h-full relative">
      <div className="absolute top-4 right-4 flex gap-2">
        <CSVExportButton data={atRisk} filename="at-risk-clients" label="Risk" />
      </div>
      <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-1">Client Health</h3>
      <p className="text-sm text-[var(--soft-stone)] mb-6">At-risk, new, and top clients</p>
      
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-[var(--rose)]/10 rounded-xl border border-[var(--rose)]/20">
          <div className="text-3xl font-black text-[var(--rose)]">{atRisk.length}</div>
          <div className="text-xs font-semibold text-[var(--rose)]/80 uppercase tracking-wider mt-1">At Risk</div>
        </div>
        <div className="p-3 bg-[var(--sage)]/10 rounded-xl border border-[var(--sage)]/20">
          <div className="text-3xl font-black text-[var(--sage)]">{newClients.length}</div>
          <div className="text-xs font-semibold text-[var(--sage)]/80 uppercase tracking-wider mt-1">New</div>
        </div>
        <div className="p-3 bg-[var(--clay)]/10 rounded-xl border border-[var(--clay)]/20">
          <div className="text-3xl font-black text-[var(--clay)]">{topClients.length}</div>
          <div className="text-xs font-semibold text-[var(--clay)]/80 uppercase tracking-wider mt-1">VIP</div>
        </div>
      </div>
      
      {atRisk.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-semibold text-[var(--warm-ink)] mb-2">Attention Needed:</div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {atRisk.slice(0, 3).map((c: any) => (
              <div key={c.id} className="text-sm text-[var(--rose)] bg-[var(--rose)]/5 px-3 py-1.5 rounded-lg border border-[var(--rose)]/10 truncate">
                {c.name}
              </div>
            ))}
            {atRisk.length > 3 && (
              <div className="text-xs text-[var(--soft-stone)] italic text-center">+ {atRisk.length - 3} more</div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
