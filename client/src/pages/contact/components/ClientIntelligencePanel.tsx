import { useEffect, useState } from 'react';
import { getAuthToken } from '../../../utils/authToken';

/**
 * What the model makes of this client, and why.
 *
 * `customerIntelligence.service` computed CLV, churn probability, segmentation and a
 * next-best-action and had no caller anywhere in the product. It is now reachable,
 * with two conditions attached:
 *
 *   - it is fed the client's real CRM rows (completed jobs, paid invoices) rather
 *     than the nightlife `Reservation` table it was written against, and
 *   - below three completed jobs it refuses to answer, and says why.
 *
 * That refusal is the important part of the design and it is visible on purpose. The
 * model's own confidence metric starts at 50 and never falls below 40, so gating on
 * confidence would have meant showing a confident verdict about a client added this
 * morning. "Not enough history yet" is more useful than a plausible number nobody
 * can check, and it is the honest answer.
 *
 * The facts row underneath is always populated from real counts, so the panel is
 * never blank — a client with no verdict still tells you what is true about them.
 */

interface Facts {
  completedJobs: number;
  paidInvoices: number;
  totalSpent: number;
  lastJobAt: string | null;
  daysSinceLastJob: number | null;
  cancelledJobs: number;
}

interface Intelligence {
  hasVerdict: boolean;
  reason?: string;
  facts: Facts;
  segment?: string;
  valueTier?: string;
  predictedCLV?: number;
  churnProbability?: number;
  riskLevel?: string;
  confidence?: number;
  nextBestAction?: string;
  keyRiskFactors?: string[];
  retentionActions?: string[];
}

const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-[var(--sage)]/20 text-[var(--sage)]',
  MODERATE: 'bg-[var(--warm-sand)]/20 text-[var(--warm-sand)]',
  HIGH: 'bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)]',
  CRITICAL: 'bg-[var(--dusty-rose)]/30 text-[var(--dusty-rose)]',
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function ClientIntelligencePanel({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Intelligence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

    fetch(`${base}/api/v1/crm/clients/${clientId}/intelligence`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load');
        return res.json();
      })
      .then((body) => { if (!cancelled) setData(body.data); })
      .catch(() => {
        if (cancelled) return;
        // Distinct from "no verdict": this is the panel failing, and the facts we would
        // have shown are unavailable. Saying "not enough history" here would be a lie
        // about the server rather than a statement about the client.
        setError('Could not load insights for this client.');
      });

    return () => { cancelled = true; };
  }, [clientId]);

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--warm-sand)]/10 border border-[rgba(191,179,163,0.3)]">
        <p className="text-sm text-[var(--soft-stone)]">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--warm-sand)]/10 border border-[rgba(191,179,163,0.3)]">
        <p className="text-sm text-[var(--soft-stone)]">Working out where this client stands…</p>
      </div>
    );
  }

  const f = data.facts;

  return (
    <div className="p-6 rounded-2xl bg-white shadow-sm border border-[rgba(191,179,163,0.3)]">
      <h3 className="text-xl font-bold clay-heading mb-1">Where this client stands</h3>

      {data.hasVerdict ? (
        <>
          <div className="flex flex-wrap items-center gap-3 my-4">
            <span className="font-bold text-[var(--warm-ink)]">{data.segment}</span>
            {data.riskLevel && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_STYLES[data.riskLevel] ?? ''}`}>
                {data.riskLevel.toLowerCase()} churn risk
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <Stat label="Predicted lifetime value" value={money(data.predictedCLV ?? 0)} />
            <Stat label="Chance they leave" value={`${data.churnProbability ?? 0}%`} />
            <Stat label="Revenue actually received" value={money(f.totalSpent)} />
          </div>

          {data.nextBestAction && (
            <div className="p-4 rounded-xl bg-[var(--clay)]/10 mb-4">
              <p className="text-xs text-[var(--soft-stone)] mb-1">Suggested next step</p>
              <p className="text-[var(--warm-ink)] font-medium">{data.nextBestAction}</p>
            </div>
          )}

          {data.keyRiskFactors && data.keyRiskFactors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-[var(--soft-stone)]">
                Why ({data.keyRiskFactors.length})
              </summary>
              <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--warm-ink)]">
                {data.keyRiskFactors.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </details>
          )}

          <p className="text-xs text-[var(--soft-stone)] mt-4">
            Based on {f.completedJobs} completed job{f.completedJobs === 1 ? '' : 's'} and{' '}
            {f.paidInvoices} paid invoice{f.paidInvoices === 1 ? '' : 's'}.
          </p>
        </>
      ) : (
        <>
          <p className="text-[var(--warm-ink)] mt-2">{data.reason}</p>
          <p className="text-xs text-[var(--soft-stone)] mt-1">
            Nothing to do here — this updates itself once there is a history.
          </p>
        </>
      )}

      {/* Always shown. These are counts, not predictions, and they are the reason the
          panel is still useful on a brand-new client. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[var(--soft-stone)]/20">
        <Stat label="Completed jobs" value={String(f.completedJobs)} />
        <Stat label="Paid invoices" value={String(f.paidInvoices)} />
        <Stat label="Cancelled" value={String(f.cancelledJobs)} />
        <Stat
          label="Last job"
          value={f.daysSinceLastJob === null ? 'Never' : `${f.daysSinceLastJob}d ago`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--soft-stone)]">{label}</p>
      <p className="font-bold text-[var(--warm-ink)]">{value}</p>
    </div>
  );
}