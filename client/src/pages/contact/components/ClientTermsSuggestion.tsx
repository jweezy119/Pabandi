import { useEffect, useState } from 'react';
import { getAuthToken } from '../../../utils/authToken';

/**
 * What terms to offer this client, before an invoice exists.
 *
 * `buildTermsRecommendation` reads the payment score already sitting on the client's
 * passport. It was reachable only from an invoice — the wrong moment, because terms are
 * set when the invoice is created and by then you are looking at a form rather than at
 * the person. This is the same model, shown where the decision actually happens.
 *
 * Strictly read-only. Applying terms is the invoice route's job: an invoice is what
 * has a due date to change, and the audit that records the decision is written against
 * an invoice id.
 *
 * Renders nothing when the client has no payment history, because `defaulted` means
 * the tier is the default rather than a judgement about them, and presenting "net 30"
 * next to that would read as a recommendation.
 */

interface Suggestion {
  recommendation: {
    label: string;
    dueInDays: number;
    requireEscrow: boolean;
    paymentScore: number;
  };
  suggestedDueDate: string;
  railReasoning: string | null;
  clientCountry: string | null;
  defaulted: boolean;
}

export function ClientTermsSuggestion({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Suggestion | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

    fetch(`${base}/api/v1/crm/clients/${clientId}/terms-recommendation`, {
      headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => { if (!cancelled) setData(body?.data ?? null); })
      .catch(() => { if (!cancelled) setData(null); });

    return () => { cancelled = true; };
  }, [clientId]);

  if (!data || data.defaulted) return null;

  const r = data.recommendation;

  return (
    <div className="p-4 rounded-xl bg-[var(--warm-sand)]/20 mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-[var(--soft-stone)]">Suggested terms when you invoice them</p>
        <span className="text-sm font-bold text-[var(--warm-ink)]">{r.label}</span>
      </div>
      <p className="text-xs text-[var(--soft-stone)] mt-1">
        Based on a payment score of {Math.round(r.paymentScore)}
        {data.railReasoning ? ` · ${data.railReasoning}` : ''}
      </p>
      {r.requireEscrow && (
        <p className="text-xs text-[var(--soft-stone)] mt-2">
          Escrow is advisable for this client. It is held against a job, so set it when
          you schedule the work rather than on the invoice.
        </p>
      )}
    </div>
  );
}

export default ClientTermsSuggestion;
