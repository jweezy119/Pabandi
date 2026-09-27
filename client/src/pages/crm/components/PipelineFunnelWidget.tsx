import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { CSVExportButton } from './CSVExportButton';

export function PipelineFunnelWidget({ data, loading }: { data: any[], loading: boolean }) {
  if (loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[300px]" />;

  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <Card padding="lg" className="h-full flex flex-col relative">
      <div className="absolute top-4 right-4">
        <CSVExportButton data={data} filename="pipeline-funnel" label="" />
      </div>
      <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-1">Pipeline Funnel</h3>
      <p className="text-sm text-[var(--soft-stone)] mb-6">Deals by stage and value</p>
      
      <div className="flex-1 flex flex-col gap-3 justify-center">
        {data.length === 0 && <div className="text-center text-[var(--soft-stone)]">No deals found</div>}
        {data.map((d, i) => (
          <div key={d.stage} className="space-y-1">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-[var(--warm-ink)]">{d.stage} ({d.count})</span>
              <span className="text-[var(--clay)]">${d.value.toLocaleString()}</span>
            </div>
            <div className="h-4 bg-[var(--warm-sand)] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000" 
                style={{ 
                  width: `${(d.value / maxVal) * 100}%`,
                  backgroundColor: `var(--clay)`
                }} 
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
