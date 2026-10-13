import { useEffect, useState } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives';
import { getAuthToken } from '../../../utils/authToken';
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  STAGE_PROBABILITY,
} from '@shared/crm';

/**
 * Pipeline stages, shown rather than edited.
 *
 * WHAT THIS PAGE USED TO BE
 *
 * A drag-to-reorder editor: rename any stage, change its probability, change its
 * colour, add new ones, delete existing ones. Every one of those controls wrote to
 * `/settings/config`, and nothing read it back.
 *
 * The stage names were the dangerous half. `parseStage` on the server accepts six
 * constants — LEAD, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST — and rejects
 * anything else with a 400. So renaming a stage here did not rename anything: it
 * produced a value the server refuses, which is exactly how `settings.pipelineStages`
 * ended up feeding `stage-1` into the kanban and breaking it for anyone who had
 * been through the setup wizard. The colour picker had the same problem in milder
 * form — the board reads its colours from the shared vocabulary, so a chosen hex
 * was stored and never shown.
 *
 * WHY IT IS NOT SIMPLY WIRING UP
 *
 * Supporting custom stages properly means teaching the server to accept them and
 * deciding what a stage means to the forecast, the probability defaults and the
 * won/lost transitions. That is a product decision, not a settings screen. Until
 * it is made, an editor here can only promise something the API will not do.
 *
 * So this page shows the real stages and says plainly why they are fixed. The
 * editing affordances come back with the server change, not before — a control
 * that accepts input and stores nothing is the same defect this repo just spent
 * three commits removing from the client, deal, activity and job forms.
 */
export default function PipelineSettingsPage() {
  // Kept so the settings navigation still has something to land on, and so the
  // page is inside the same auth context as its siblings.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Touch the token so this page behaves like the other settings pages if it ever
    // gains real content; nothing here is tenant-scoped, because there is nothing
    // tenant-scoped to read.
    void getAuthToken();
    setReady(true);
  }, []);

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="clay-heading pb-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Pipeline</h1>
          <p className="text-sm text-[var(--soft-stone)] mt-0.5">
            The stages a deal moves through.
          </p>
        </div>

        <Card padding="lg" className="space-y-4">
          <div className="space-y-2">
            {DEAL_STAGES.map((stage) => (
              <div
                key={stage}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[var(--warm-sand)]"
                style={{ background: 'var(--warm-sand) / 0.2' }}
              >
                <div>
                  <p className="font-bold" style={{ color: 'var(--warm-ink)' }}>
                    {DEAL_STAGE_LABELS[stage]}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                    {stage}
                  </p>
                </div>
                <span
                  className="text-sm tabular-nums px-3 py-1 rounded-full"
                  style={{ background: 'rgba(201,123,90,0.10)', color: 'var(--clay)' }}
                >
                  {STAGE_PROBABILITY[stage]}%
                </span>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: 'var(--warm-sand) / 0.4', color: 'var(--soft-stone)' }}
          >
            <p className="font-semibold mb-1" style={{ color: 'var(--warm-ink)' }}>
              These stages are fixed for now
            </p>
            <p>
              Every deal is checked against this list when it is saved, so a stage
              outside it would be rejected rather than shown. Renaming or adding
              stages needs a change on the server first — this page will get its
              editor back when that happens, rather than offering one that quietly
              does nothing now.
            </p>
            <p className="mt-2">
              A deal&apos;s chance of closing follows its stage, unless you set a
              different figure on the deal itself.
            </p>
          </div>

          {ready && null}
        </Card>
      </div>
    </DashboardLayout>
  );
}