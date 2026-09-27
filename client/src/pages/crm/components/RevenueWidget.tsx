import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { CSVExportButton } from './CSVExportButton';

export function RevenueWidget({ data, loading }: { data: any, loading: boolean }) {
  if (loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[300px]" />;

  const { billed = 0, collected = 0, outstanding = 0 } = data || {};

  return (
    <Card padding="lg" className="h-full relative flex flex-col justify-between">
      <div className="absolute top-4 right-4">
        <CSVExportButton data={[{ billed, collected, outstanding }]} filename="revenue-report" label="" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-1">Revenue</h3>
        <p className="text-sm text-[var(--soft-stone)] mb-6">Billed, collected, outstanding</p>
      </div>

      <div className="space-y-6">
        <div className="text-center">
          <div className="text-sm font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Total Billed</div>
          <div className="text-4xl font-black text-[var(--warm-ink)]">${billed.toLocaleString()}</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--warm-sand)]">
          <div>
            <div className="text-xs font-semibold text-[var(--sage)] uppercase tracking-wider mb-1">Collected</div>
            <div className="text-xl font-bold text-[var(--warm-ink)]">${collected.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--rose)] uppercase tracking-wider mb-1">Outstanding</div>
            <div className="text-xl font-bold text-[var(--warm-ink)]">${outstanding.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
