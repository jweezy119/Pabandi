import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { CSVExportButton } from './CSVExportButton';

export function ActivityMetricsWidget({ data, loading }: { data: any, loading: boolean }) {
  if (loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[300px]" />;

  const { total = 0, completionRate = 0, timeline = [] } = data || {};
  const maxVal = Math.max(...timeline.map((t: any) => t.count), 1);

  return (
    <Card padding="lg" className="h-full relative flex flex-col justify-between">
      <div className="absolute top-4 right-4 flex gap-2">
        <CSVExportButton data={timeline} filename="activity-timeline" label="" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-1">Activity Metrics</h3>
        <p className="text-sm text-[var(--soft-stone)] mb-6">Total activities and completion</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Total Activities</div>
          <div className="text-3xl font-black text-[var(--warm-ink)]">{total}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Task Completion</div>
          <div className="text-3xl font-black text-[var(--clay)]">{completionRate}%</div>
        </div>
      </div>

      <div className="flex-1 flex items-end gap-1 h-16 border-b border-[var(--warm-sand)] pb-1">
        {timeline.slice(-14).map((t: any) => (
          <div 
            key={t.date} 
            className="flex-1 bg-[var(--clay)]/40 hover:bg-[var(--clay)] rounded-t-sm transition-colors"
            style={{ height: `${Math.max((t.count / maxVal) * 100, 5)}%` }}
            title={`${t.date}: ${t.count}`}
          />
        ))}
      </div>
      <div className="text-xs text-[var(--soft-stone)] mt-2 text-center">Last {Math.min(timeline.length, 14)} recorded days</div>
    </Card>
  );
}
