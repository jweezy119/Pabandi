import { Card, Button } from '../../../components/primitives';
import ReliabilityChip from '../../../components/reliability/ReliabilityChip';

export default function ClientSidebar({ client, outstanding, onScheduleTask }: any) {
  const paymentScore = client.reliabilityScore || 85;
  const showUpScore = client.customData?.showUpScore || 90;
  const deliveryScore = client.customData?.deliveryScore || 88;

  return (
    <div className="space-y-6">
      <Card hover={false} className="clay-rise">
        <h2 className="text-lg font-bold clay-heading mb-4">Trust & Reliability Engine</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-3.5 bg-[var(--warm-sand)]/50 rounded-2xl">
            <div>
              <p className="text-sm font-bold text-[var(--warm-ink)]">Payment Reliability</p>
              <p className="text-[11px] text-[var(--soft-stone)]">On-time payment track record</p>
            </div>
            <div className="flex items-center gap-2">
              <ReliabilityChip score={paymentScore} showLabel={false} size="md" />
              <span className="text-[var(--warm-ink)] font-bold text-sm">{paymentScore}/100</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[var(--warm-sand)]/50 rounded-2xl">
            <div>
              <p className="text-sm font-bold text-[var(--warm-ink)]">Show-Up Score</p>
              <p className="text-[11px] text-[var(--soft-stone)]">Service appointment attendance</p>
            </div>
            <div className="flex items-center gap-2">
              <ReliabilityChip score={showUpScore} showLabel={false} size="md" />
              <span className="text-[var(--warm-ink)] font-bold text-sm">{showUpScore}/100</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[var(--warm-sand)]/50 rounded-2xl">
            <div>
              <p className="text-sm font-bold text-[var(--warm-ink)]">Delivery Score</p>
              <p className="text-[11px] text-[var(--soft-stone)]">Fulfillment reliability</p>
            </div>
            <div className="flex items-center gap-2">
              <ReliabilityChip score={deliveryScore} showLabel={false} size="md" />
              <span className="text-[var(--warm-ink)] font-bold text-sm">{deliveryScore}/100</span>
            </div>
          </div>
        </div>
      </Card>
      
      {outstanding > 0 && (
        <Card hover={false} className="clay-rise clay-delay-2">
          <h2 className="text-lg font-bold clay-heading mb-4">Next Recommended Action</h2>
          <div className="p-4 rounded-2xl bg-[var(--clay)]/10 border border-[var(--clay)]/30 space-y-2">
            <div className="flex items-center gap-2 text-[var(--clay)] font-bold text-sm">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
              Follow-up Call Suggested
            </div>
            <p className="text-xs text-[var(--soft-stone)]">
              Client has an open invoice of ${outstanding.toLocaleString()}. Schedule a reminder call or send payment link.
            </p>
            <Button variant="secondary" size="sm" onClick={onScheduleTask}>Schedule Task</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
