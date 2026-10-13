import { useEffect, useState } from 'react';
import { getAuthToken } from '../../../utils/authToken';

/**
 * The trust score, taken apart.
 *
 * `trust-core.explainScore()` itemises a reliability score into its four weighted
 * inputs with the arithmetic for each one shown. It is pure, tested, and had no caller
 * anywhere in the codebase — the platform's one real piece of explainability, entirely
 * unreachable.
 *
 * It matters most now that it is next to `ClientIntelligencePanel`: two panels making
 * claims about the same person should be able to show their working.
 *
 * "Not tracked" is rendered rather than hidden. The dispute signal is genuinely
 * unmeasurable for a CRM client — a Dispute links to a user, a reservation or an API
 * client, and `CrmClient` has none of those columns — so its contribution is neutral.
 * Showing "100 / 100 (dispute rate 0%)" for something nobody has checked would be a
 * clean record that does not exist.
 */

interface Row {
  signal: string;
  value: string;
  contribution: number;
}

interface Breakdown {
  score: number;
  sampleSize: number;
  breakdown: Row[] | null;
  reason: string | null;
}

export function TrustScoreBreakdown({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

    fetch(`${base}/api/v1/crm/clients/${clientId}/explain-score`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load');
        return res.json();
      })
      .then((body) => { if (!cancelled) setData(body.data); })
      .catch(() => { if (!cancelled) setError('Could not load the trust score breakdown.'); });

    return () => { cancelled = true; };
  }, [clientId]);

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--warm-sand)]/10 border border-[rgba(191,179,163,0.3)]">
        <p className="text-sm text-[var(--soft-stone)]">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <details className="p-6 rounded-2xl bg-white shadow-sm border border-[rgba(191,179,163,0.3)]">
      <summary className="cursor-pointer clay-heading text-lg font-bold">
        How the trust score of {Math.round(data.score)} is made up
      </summary>

      {data.reason ? (
        <p className="text-sm text-[var(--soft-stone)] mt-3">{data.reason}</p>
      ) : (
        <>
          <table className="w-full mt-4 text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--soft-stone)]">
                <th className="pb-2 font-medium">Signal</th>
                <th className="pb-2 font-medium">Measured</th>
                <th className="pb-2 font-medium text-right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {data.breakdown?.map((row) => (
                <tr key={row.signal} className="border-t border-[var(--soft-stone)]/20">
                  <td className="py-2 text-[var(--warm-ink)]">{row.signal}</td>
                  <td className="py-2 text-[var(--soft-stone)]">{row.value}</td>
                  <td className={`py-2 text-right font-medium ${row.contribution < 0 ? 'text-[var(--dusty-rose)]' : 'text-[var(--warm-ink)]'}`}>
                    {row.contribution > 0 ? '+' : ''}{row.contribution.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-[var(--soft-stone)] mt-3">
            From {data.sampleSize} completed job{data.sampleSize === 1 ? '' : 's'} and settled
            invoice{data.sampleSize === 1 ? '' : 's'}.
          </p>
        </>
      )}
    </details>
  );
}