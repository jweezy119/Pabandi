import { useEffect, useState } from 'react';
import TrustGauge from '../../../components/TrustGauge';
import { getAuthToken } from '../../../utils/authToken';

interface DossierJob {
  id: string;
  serviceType: string;
  scheduledTime?: string | null;
  price: number;
  status: string; // SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
  escrowStatus: string; // NONE | HELD | RELEASED | REFUNDED | DISPUTED
}

/**
 * The Trust Passport dossier — the client profile as a security document.
 *
 * ─── WHY ONE BIG GAUGE ───────────────────────────────────────────────────────
 * Everything else on the page describes activity; this instrument describes
 * standing, and standing is what you consult before you dispatch a crew. So the
 * score is rendered at gauge size, first in the sidebar, and everything below it
 * is evidence for the needle's position rather than the needle's rival.
 *
 * ─── WHERE THE NUMBERS COME FROM ─────────────────────────────────────────────
 * The gauge reads the client's reliability score — the same
 * `trust-core` figure the public passport page and the deposit policy both
 * price against. It is fetched from `/crm/clients/:id/explain-score`, which is
 * the platform's one genuine explainability endpoint: a score nobody can send
 * the arithmetic for is a score nobody can argue with when it is wrong.
 *
 * The CRM reliability score is a 0–100 scale; the passport family (and the
 * escrow band policy that reads it) works in 0–1000. The ×10 conversion here is
 * not decoration — it is the same convert-when-mixed rule the deposit policy's
 * `normalizeScore()` applies, so the gauge, the bands, and the storefront all
 * agree on what "700" means.
 *
 * "Verified History" counts are aggregated from this business's own jobs and
 * invoices — released escrows, completed bookings, settled invoices — the data
 * an on-chain attestation would be minted from. When there is no history yet,
 * the section says so instead of showing zeros dressed up as facts.
 */
export function TrustDossier({
  clientId,
  fallbackScore,
  passportId,
  jobs,
  invoices,
}: {
  clientId: string;
  /** The client row's reliability score, rendered until the explain-score fetch lands. */
  fallbackScore?: number | null;
  /** Public passport link, when this client carries one. */
  passportId?: string | null;
  jobs: DossierJob[];
  invoices: Array<{ id: string; status: string; subtotal: number }>;
}) {
  const [score100, setScore100] = useState<number | null>(typeof fallbackScore === 'number' ? fallbackScore : null);
  const [samples, setSamples] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    fetch(`${base}/api/v1/crm/clients/${clientId}/explain-score`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.data) return;
        if (typeof body.data.score === 'number') setScore100(body.data.score);
        if (typeof body.data.sampleSize === 'number') setSamples(body.data.sampleSize);
      })
      .catch(() => {
        /* The gauge keeps showing the client row's score, or "—" if neither is
           available. It must not show 0 as if the client had been measured at
           zero. */
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // The gauge speaks the passport scale: 0–1000. ×10 mirrors
  // deposit-policy normalizeScore() so every surface agrees on thresholds.
  const gaugeScore = score100 == null ? null : Math.round(score100 * 10);

  // ── Verified history: counted, not asserted ──────────────────────────────────
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');
  const escrowReleased = jobs.filter((j) => j.escrowStatus === 'RELEASED');
  const escrowHeld = jobs.filter((j) => j.escrowStatus === 'HELD');
  const cancelled = jobs.filter((j) => j.status === 'CANCELLED');
  const invoicesPaid = invoices.filter((i) => i.status === 'paid');
  const invoicesOverdue = invoices.filter((i) => i.status === 'overdue');

  const history: Array<{ icon: string; label: string; detail: string; tone: 'good' | 'neutral' | 'warn' }> = [];
  if (escrowReleased.length > 0)
    history.push({ icon: 'workspace_premium', label: `${escrowReleased.length} successful escrow${escrowReleased.length === 1 ? '' : 's'}`, detail: 'Deposit released on attendance', tone: 'good' });
  if (escrowHeld.length > 0)
    history.push({ icon: 'lock', label: `${escrowHeld.length} escrow${escrowHeld.length === 1 ? '' : 's'} currently held`, detail: 'Secured for upcoming bookings', tone: 'neutral' });
  if (completedJobs.length > 0)
    history.push({ icon: 'event_available', label: `${completedJobs.length} completed booking${completedJobs.length === 1 ? '' : 's'}`, detail: 'Showed up for the work', tone: 'good' });
  if (invoicesPaid.length > 0)
    history.push({ icon: 'receipt_long', label: `${invoicesPaid.length} invoice${invoicesPaid.length === 1 ? '' : 's'} settled`, detail: 'Paid on or before terms', tone: 'good' });
  if (cancelled.length > 0)
    history.push({ icon: 'event_busy', label: `${cancelled.length} cancelled`, detail: 'Bookings called off in advance', tone: 'warn' });
  if (invoicesOverdue.length > 0)
    history.push({ icon: 'report', label: `${invoicesOverdue.length} overdue invoice${invoicesOverdue.length === 1 ? '' : 's'}`, detail: 'Worth a conversation before the next booking', tone: 'warn' });

  return (
    <div className="clay-card p-6" style={{ boxShadow: 'var(--shadow-lift)' }}>
      <p className="clay-label mb-4">Trust Passport</p>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {gaugeScore != null ? (
          <TrustGauge
            score={gaugeScore}
            sublabel={
              samples != null && samples > 0
                ? `${samples} verdict${samples === 1 ? '' : 's'} on record`
                : 'Insufficient history to grade'
            }
          />
        ) : (
          <div className="flex flex-col items-center py-4">
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--warm-sand)' }}>
              verified_user
            </span>
            <p style={{ color: 'var(--soft-stone)', fontSize: 13, marginTop: 8 }}>
              No measured score yet — it appears after the first completed job
            </p>
          </div>
        )}
      </div>

      {passportId && (
        <a
          href={`/trust/${passportId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 mt-4 text-xs font-bold"
          style={{ color: 'var(--clay)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
          View the public passport
        </a>
      )}

      {/* ── Verified history ─────────────────────────────────────────────── */}
      <div className="mt-6">
        <p className="clay-label mb-2">Verified History</p>
        {history.length === 0 ? (
          <p style={{ color: 'var(--soft-stone)', fontSize: 13 }}>
            No bookings or invoices on record yet — the dossier fills in as work happens. Every
            attendance is counted against the score.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.label} className="flex items-start gap-3">
                <span
                  className="material-symbols-outlined shrink-0 mt-0.5"
                  style={{
                    fontSize: 18,
                    color: h.tone === 'good' ? 'var(--sage)' : h.tone === 'warn' ? 'var(--dusty-rose)' : 'var(--soft-stone)',
                  }}
                >
                  {h.icon}
                </span>
                <div>
                  <p style={{ color: 'var(--warm-ink)', fontSize: 13, fontWeight: 600 }}>{h.label}</p>
                  <p style={{ color: 'var(--soft-stone)', fontSize: 12 }}>{h.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Financial outcome of every booking ───────────────────────────── */}
      <div className="mt-6">
        <p className="clay-label mb-2">Booking Ledger</p>
        {jobs.length === 0 ? (
          <p style={{ color: 'var(--soft-stone)', fontSize: 13 }}>No bookings yet.</p>
        ) : (
          <div className="space-y-1.5">
            {jobs
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.scheduledTime || 0).getTime() - new Date(a.scheduledTime || 0).getTime()
              )
              .map((j) => {
                let outcome = 'Scheduled';
                let tone = 'var(--soft-stone)';
                if (j.escrowStatus === 'RELEASED') {
                  outcome = 'Released — they showed up';
                  tone = 'var(--sage)';
                } else if (j.escrowStatus === 'HELD') {
                  outcome = 'Escrow Held';
                  tone = 'var(--clay)';
                } else if (j.escrowStatus === 'REFUNDED') {
                  outcome = 'Escrow Refunded';
                  tone = 'var(--soft-stone)';
                } else if (j.escrowStatus === 'DISPUTED') {
                  outcome = 'In Dispute';
                  tone = 'var(--muted-ochre)';
                } else if (j.status === 'CANCELLED') {
                  outcome = 'Cancelled';
                  tone = 'var(--dusty-rose)';
                }
                const when = j.scheduledTime
                  ? new Date(j.scheduledTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—';
                return (
                  <div
                    key={j.id}
                    className="flex items-center gap-3 py-2"
                    style={{ borderTop: '1px solid rgba(191, 179, 163, 0.15)' }}
                  >
                    <span style={{ color: 'var(--soft-stone)', fontSize: 11, minWidth: 64 }}>{when}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ color: 'var(--warm-ink)', fontSize: 12, fontWeight: 600 }}>
                        {j.serviceType}
                      </span>
                      <span className="block" style={{ color: tone, fontSize: 10, fontWeight: 600 }}>
                        {outcome}
                      </span>
                    </span>
                    <span className="money-number shrink-0" style={{ fontSize: 13 }}>
                      ${j.price.toLocaleString()}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrustDossier;
