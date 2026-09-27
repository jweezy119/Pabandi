import { Card } from '../../../components/primitives';

export default function PipelineForecastWidget({ deals }: { deals: any[] }) {
  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const weightedValue = deals.reduce((sum, d) => sum + ((d.value || 0) * ((d.probability || 0) / 100)), 0);
  const activeDeals = deals.filter(d => d.stage !== 'WON' && d.stage !== 'LOST').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card variant="flat" padding="sm" className="flex items-center gap-4 clay-rise">
        <div className="w-10 h-10 rounded-xl bg-[var(--warm-sand)] flex items-center justify-center text-[var(--clay)]">
          <span className="material-symbols-outlined">payments</span>
        </div>
        <div>
          <div className="text-xs text-[var(--soft-stone)] font-label">Total Pipeline Value</div>
          <div className="text-xl font-bold text-[var(--warm-ink)]">${totalValue.toLocaleString()}</div>
        </div>
      </Card>

      <Card variant="flat" padding="sm" className="flex items-center gap-4 clay-rise clay-delay-1">
        <div className="w-10 h-10 rounded-xl bg-[var(--sage)]/20 flex items-center justify-center text-[var(--sage)]">
          <span className="material-symbols-outlined">trending_up</span>
        </div>
        <div>
          <div className="text-xs text-[var(--soft-stone)] font-label">Weighted Forecast</div>
          <div className="text-xl font-bold text-[var(--warm-ink)]">${Math.round(weightedValue).toLocaleString()}</div>
        </div>
      </Card>

      <Card variant="flat" padding="sm" className="flex items-center gap-4 clay-rise clay-delay-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--ochre)]/20 flex items-center justify-center text-[var(--ochre)]">
          <span className="material-symbols-outlined">bar_chart</span>
        </div>
        <div>
          <div className="text-xs text-[var(--soft-stone)] font-label">Active Deals</div>
          <div className="text-xl font-bold text-[var(--warm-ink)]">{activeDeals}</div>
        </div>
      </Card>
    </div>
  );
}
