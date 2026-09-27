import { Card } from '../../../components/primitives';
import { Link } from 'react-router-dom';

export default function DealKanbanBoard({ STAGES, deals, onUpdateStage }: any) {
  
  const getDealsByStage = (stageId: string) => deals.filter((d: any) => d.stage === stageId);

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 mobile-scroll">
      {STAGES.map((stage: any) => {
        const stageDeals = getDealsByStage(stage.id);
        const stageTotal = stageDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);

        return (
          <div key={stage.id} className="min-w-[280px] w-[280px] flex-shrink-0 clay-kanban-column rounded-2xl p-3 flex flex-col h-[calc(100vh-280px)] min-h-[500px] clay-rise">
            <div className="flex justify-between items-center mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <h3 className="font-bold text-sm text-[var(--warm-ink)] font-label">{stage.label}</h3>
                <span className="text-xs bg-white px-2 py-0.5 rounded-full text-[var(--soft-stone)] font-medium shadow-xs">
                  {stageDeals.length}
                </span>
              </div>
              <span className="text-xs font-bold text-[var(--warm-ink)]">
                ${stageTotal.toLocaleString()}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
              {stageDeals.map((deal: any) => (
                <Card key={deal.id} variant="default" padding="sm" hover className="border border-[var(--warm-sand)] hover:border-[var(--clay)] transition-all clay-card--interactive">
                  <div className="flex justify-between items-start mb-1.5">
                    <Link to={`/contact/deals/${deal.id}`} className="font-semibold text-sm text-[var(--warm-ink)] hover:text-[var(--clay)] line-clamp-1">{deal.title}</Link>
                    <span className="text-xs font-bold text-[var(--clay)]">${(deal.value || 0).toLocaleString()}</span>
                  </div>

                  {deal.client && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--soft-stone)] mb-2">
                      <span className="material-symbols-outlined text-[14px]">person</span>
                      <span className="line-clamp-1">
                        {deal.client.name}
                        {deal.client.reliabilityScore < 60 && (
                          <span className="text-[var(--dusty-rose)] ml-1 font-bold">(Risk)</span>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--warm-sand)]/40 text-[11px] text-[var(--soft-stone)]">
                    <span>Prob: {deal.probability}%</span>
                    <select
                      value={deal.stage}
                      onChange={(e) => onUpdateStage(deal.id, e.target.value)}
                      className="text-[11px] bg-white text-[var(--warm-ink)] border border-[var(--warm-sand)] rounded-lg px-1.5 py-0.5 outline-none cursor-pointer hover:border-[var(--clay)]"
                    >
                      {STAGES.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
