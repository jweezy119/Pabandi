import { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '../../../utils/authToken';
import { withBusinessId } from '../../../utils/businessContext';

/**
 * Trust-adjusted payment terms.
 *
 * `buildTermsRecommendation` computed this and had no caller. It reads the payment
 * score already on every client's passport, and the create form has always set
 * `dateDue` to the end of the current month for everyone — so someone who has paid on
 * time twenty times is quoted the same terms as one who has defaulted twice.
 *
 * It is shown as advice with its reasoning attached, and applying it is an explicit
 * act with a button. Nothing is applied just because the panel was opened, which
 * would move a due date nobody asked to move.
 *
 * Overriding asks for a reason because `recordTermsDecision` writes one to a
 * SystemAuditLog row and to the client's visible timeline. An override with no reason
 * makes "why did this client get net-60" permanently unanswerable, so the field is
 * required and the server enforces it — this is the convenience layer, not the
 * guarantee.
 *
 * Escrow is stated as advised, never as applied. `requireEscrow` is real advice but
 * escrow lives on the job (`CrmJob.escrowStatus`); an invoice cannot enforce it, so
 * nothing here claims it did.
 */

interface Recommendation {
  recommendation: { label: string; dueInDays: number; requireEscrow: boolean; paymentScore: number };
  suggestedDueDate: string;
  railReasoning: string | null;
  clientCountry: string | null;
  defaulted: boolean;
  invoiceStatus: string;
}

const SETTLED = ['paid', 'void', 'cancelled', 'refunded'];

const TIER_STYLES: Record<string, string> = {
  'net-30': 'bg-[var(--sage)]/20 text-[var(--sage)]',
};

export function TermsRecommendationPanel({
  invoiceId,
  onApplied,
}: {
  invoiceId: string;
  onApplied?: () => void;
}) {
  const [data, setData] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const base = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/invoices/${invoiceId}/terms-recommendation?${withBusinessId().replace(/^\?/, '')}`, {
      headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load a recommendation');
        return res.json();
      })
      .then((body) => { if (!cancelled) setData(body.data); })
      // Silence rather than an error panel: the recommendation is an aid, and a
      // visible failure here would read as the invoice being broken.
      .catch(() => { if (!cancelled) setData(null); });

    return () => { cancelled = true; };
  }, [invoiceId]);

  const apply = useCallback(
    async (action: 'accept' | 'override') => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${base}/invoices/${invoiceId}/terms?${withBusinessId().replace(/^\?/, '')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken() || ''}`,
          },
          body: JSON.stringify(
            action === 'accept'
              ? { action }
              : { action, dueInDays: Number(days), overrideReason: reason },
          ),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || 'Could not set terms');

        setOverriding(false);
        setReason('');
        // Said plainly rather than left implied. The invoice cannot set escrow.
        setNotice(
          body.data?.escrowRecommended
            ? 'Terms set. Escrow was recommended but lives on the job, not the invoice — set it there.'
            : 'Terms set and recorded.',
        );
        onApplied?.();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [base, invoiceId, days, reason, onApplied],
  );

  if (!data) return null;

  const settled = SETTLED.includes(data.invoiceStatus);
  const r = data.recommendation;

  return (
    <section className="rounded-2xl bg-white border border-[var(--soft-stone)]/30 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-[var(--soft-stone)]">Recommended terms</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                TIER_STYLES[r.label] ?? 'bg-[var(--warm-sand)]/40 text-[var(--soft-stone)]'
              }`}
            >
              {r.label}
            </span>
            <span className="text-sm text-[var(--warm-ink)]">
              due {new Date(data.suggestedDueDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm text-[var(--soft-stone)] mt-3">
        Based on a payment score of {Math.round(r.paymentScore)}.
        {data.defaulted
          ? ' They have no payment history yet, so this is the default tier rather than a judgement about them.'
          : ''}
      </p>

      {data.railReasoning && (
        <p className="text-xs text-[var(--soft-stone)] mt-2">
          Rail: {data.railReasoning}
          {data.clientCountry ? ` (${data.clientCountry})` : ''}
        </p>
      )}

      {r.requireEscrow && (
        <p className="text-xs mt-2 p-2.5 rounded-xl bg-[var(--warm-sand)]/25">
          Escrow is recommended for this client. Escrow is held against a job, not an
          invoice, so nothing here sets it — set it on the job when you schedule the work.
        </p>
      )}

      {settled ? (
        <p className="text-xs text-[var(--soft-stone)] mt-4">
          This invoice is {data.invoiceStatus}, so its terms can no longer be changed.
        </p>
      ) : overriding ? (
        <div className="mt-4 space-y-2">
          <label className="block text-xs text-[var(--soft-stone)]" htmlFor="terms-days">
            Days to pay
          </label>
          <input
            id="terms-days"
            type="number"
            min={0}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-28 px-3 py-2 rounded-xl border border-[var(--soft-stone)]/40 text-sm"
          />
          <label className="block text-xs text-[var(--soft-stone)]" htmlFor="terms-reason">
            Why are you overriding? This is recorded so the decision can be explained later.
          </label>
          <textarea
            id="terms-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Known personally, longstanding arrangement…"
            className="w-full px-3 py-2 rounded-xl border border-[var(--soft-stone)]/40 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => apply('override')}
              disabled={busy || !reason.trim()}
              className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'var(--clay)' }}
            >
              Set these terms
            </button>
            <button
              onClick={() => { setOverriding(false); setError(null); }}
              className="px-4 py-2 rounded-full text-sm border border-[var(--soft-stone)]/40"
            >
              Cancel
            </button>
          </div>
          {!reason.trim() && (
            <p className="text-xs text-[var(--soft-stone)]">A reason is required before this can be saved.</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => apply('accept')}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--clay)' }}
          >
            Use these terms
          </button>
          <button
            onClick={() => setOverriding(true)}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm border border-[var(--soft-stone)]/40 disabled:opacity-40"
          >
            Set different terms
          </button>
        </div>
      )}

      {notice && <p className="text-xs mt-3" style={{ color: 'var(--sage)' }}>{notice}</p>}
      {error && <p className="text-xs mt-3" style={{ color: 'var(--dusty-rose)' }}>{error}</p>}
    </section>
  );
}

export default TermsRecommendationPanel;