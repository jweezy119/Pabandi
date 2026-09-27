import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { CSVExportButton } from './CSVExportButton';

export function TrustInsightsWidget({ data, loading }: { data: any, loading: boolean }) {
  if (loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[300px]" />;

  const { scoreDistribution = {}, events = [], escalations = 0 } = data || {};

  return (
    <Card padding="lg" className="h-full relative">
      <div className="absolute top-4 right-4 flex gap-2">
        <CSVExportButton data={events} filename="trust-events" label="" />
      </div>
      <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-1">Trust Insights</h3>
      <p className="text-sm text-[var(--soft-stone)] mb-6">Network reliability</p>

      <div className="flex items-center gap-6 mb-6">
        <div className="flex-1 space-y-2">
          {Object.entries(scoreDistribution).map(([band, count]: any) => (
            <div key={band} className="flex items-center text-sm">
              <div className="w-16 font-semibold text-[var(--soft-stone)]">{band}</div>
              <div className="flex-1 h-3 bg-[var(--warm-sand)] rounded-r-full overflow-hidden ml-2">
                <div className="h-full bg-[var(--sage)]/80" style={{ width: `${(count / 20) * 100}%` }} />
              </div>
              <div className="w-8 text-right font-medium text-[var(--warm-ink)]">{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--warm-sand)]">
        <div>
          <div className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Escalations</div>
          <div className="text-xl font-bold text-[var(--terracotta)]">{escalations}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Top Event</div>
          <div className="text-sm font-semibold text-[var(--warm-ink)] truncate" title={events[0]?.type}>
            {events[0]?.type || 'N/A'}
          </div>
        </div>
      </div>
    </Card>
  );
}
