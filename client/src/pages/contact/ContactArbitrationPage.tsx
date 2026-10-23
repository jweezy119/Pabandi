import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { sulhaService, trustPassportService, type SulhaDisputeRow } from '../../services/api';

/**
 * The Sulha staked arbitrator panel — human review for escrow disputes the
 * Jev machine arbitrator left at human_review (or escalated outright).
 *
 * Kept INSIDE the ContactOS dashboard deliberately: this is not a standalone
 * arbitration app, it is one more card in the CRM the ops team already lives
 * in. An arbitrator reviews the file — the claim, Jev's preliminary read and
 * recorded confidence, both evidence stacks — and settles with one click:
 * "Release to Seller" or "Refund Buyer". The server re-checks the passport's
 * isArbitrator flag on every resolve, so a dashboard without a panelist
 * passport is read-only regardless of what this UI renders.
 */

const navItems = [
  { path: '/contact/leads', label: 'Leads', icon: 'person_add' },
  { path: '/contact/deals', label: 'Guaranteed Bookings', icon: 'workspace_premium' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
  { path: '/contact/arbitration', label: 'Arbitration', icon: 'gavel' },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  ai_review: 'Jev reviewing',
  human_review: 'Human review',
};

function evidenceCount(d: SulhaDisputeRow): number {
  const urls = d.evidenceJson.urls?.length ?? 0;
  const hashes = d.evidenceJson.hashes?.length ?? 0;
  const appended = d.evidenceJson.appended?.length ?? 0;
  return urls + hashes + appended;
}

export default function ContactArbitrationPage() {
  const [queue, setQueue] = useState<SulhaDisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [passportId, setPassportId] = useState<string | null>(null);
  const [isArbitrator, setIsArbitrator] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sulhaService.queue();
      setQueue(data.data?.queue ?? []);
    } catch {
      setError('Could not load the arbitration queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // The resolving passport is the signed-in account's TrustPassport; its
    // isArbitrator flag decides whether the buttons below can actually settle.
    trustPassportService
      .getMyPassport()
      .then((res) => {
        const passport = (res as { data?: { id?: string; isArbitrator?: boolean } }).data;
        setPassportId(passport?.id ?? null);
        setIsArbitrator(passport?.isArbitrator === true);
      })
      .catch(() => {
        // No passport (or no session) — the queue still renders, read-only.
      });
  }, [load]);

  async function resolve(disputeId: string, verdict: 'seller' | 'buyer') {
    if (!passportId) {
      setError('No TrustPassport linked to this account — arbitration is unavailable.');
      return;
    }
    setBusyId(disputeId);
    setError(null);
    setNotice(null);
    try {
      const result = await sulhaService.resolve(disputeId, { passportId, verdict });
      const settled = result.data?.dispute;
      setNotice(
        settled
          ? `Case ${settled.id} settled for the ${verdict === 'seller' ? 'seller (escrow released)' : 'buyer (escrow refunded)'}.`
          : 'Settled.'
      );
      await load();
    } catch (err) {
      setError(
        // Server errors are authorization-shaped here, so surface them gently.
        `Could not settle case ${disputeId}${err instanceof Error ? ` — ${err.message}` : ''}.`
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Arbitration</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--soft-stone)' }}>
            Sulha panel for escrow disputes. Jev arbitrates first; cases it could not
            settle with high confidence wait here for a staked human ruling.
          </p>
          {!isArbitrator && !loading && (
            <p className="text-xs mt-2" style={{ color: 'var(--soft-stone)' }}>
              You are viewing read-only: this account's TrustPassport is not marked as a
              staked arbitrator, so settlements cannot be cast from here.
            </p>
          )}
        </div>

        {notice && (
          <div className="p-4 rounded-[var(--radius-card)] text-sm" style={{ background: 'rgba(134,151,113,0.12)', color: 'var(--warm-ink)' }}>
            {notice}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-[var(--radius-card)] text-sm" style={{ background: 'rgba(196,98,80,0.12)', color: 'var(--warm-ink)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading…</div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center rounded-[var(--radius-card)]" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <p style={{ color: 'var(--soft-stone)' }}>No disputes waiting for review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((d) => (
              <div key={d.id} className="rounded-[var(--radius-card)] p-5 space-y-3" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--warm-ink)' }}>{d.reason}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
                      Escrow {d.escrowId} · raised by {d.raisedByPassport} · {new Date(d.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--clay)', color: 'var(--warm-ink)' }}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                </div>

                {d.aiConfidence !== null && (
                  <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                    Jev confidence: {Math.round(d.aiConfidence)}%
                  </p>
                )}
                {d.resolutionNotes && (
                  <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{d.resolutionNotes}</p>
                )}

                <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                  {evidenceCount(d)} evidence item{evidenceCount(d) === 1 ? '' : 's'} on file
                </p>

                {isArbitrator && d.status !== 'resolved_buyer' && d.status !== 'resolved_seller' && (
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => void resolve(d.id, 'seller')}
                      className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                      style={{ background: 'var(--clay)', color: 'var(--warm-ink)' }}
                    >
                      Release to Seller
                    </button>
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => void resolve(d.id, 'buyer')}
                      className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                      style={{ background: 'rgba(196,98,80,0.14)', color: 'var(--warm-ink)' }}
                    >
                      Refund Buyer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
