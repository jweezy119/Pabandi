import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// Default-imported under an alias: the type `EscrowStatus` (types.ts) and the
// badge component share a name, and tsc treats the merged binding as
// type-only when both end up in scope. ProviderCard hit the same quirk.
import EscrowStatusBadge from './EscrowStatus';
import type { PostedProjectSummary } from './types';
import { apiUrl } from '../../utils/apiHost';
import { getAuthToken } from '../../utils/authToken';

interface MineResponse {
  success: boolean;
  error?: string;
  data?: PostedProjectSummary[];
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open for bids',
  FUNDED: 'In progress',
  COMPLETED: 'Completed',
};

/**
 * "Your projects" — the poster's side of the loop: post, match, hire,
 * then release. The mark-complete button is the money moment: it releases
 * the escrow and pays the provider, so its result is shown with the
 * escrow badge rather than as a bare status flip.
 */
export function PostedProjectsPanel() {
  const [projects, setProjects] = useState<PostedProjectSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);

  const token = getAuthToken();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(apiUrl('/api/v1/agent-marketplace/projects/mine'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json() as Promise<MineResponse>)
      .then((json) => {
        if (cancelled) return;
        if (!json.success || !json.data) throw new Error(json.error || 'failed');
        setProjects(json.data);
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => { cancelled = true; };
  }, [token]);

  if (!token || loadFailed) return null;

  const markComplete = async (project: PostedProjectSummary) => {
    setCompletingId(project.id);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/v1/agent-marketplace/projects/${project.id}/complete`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token ?? ''}` },
        },
      );
      const json: { success: boolean; error?: string } = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not complete the project.');
      setProjects((ps) =>
        (ps ?? []).map((p) => (p.id === project.id
          ? { ...p, status: 'COMPLETED', escrow: { status: 'RELEASED', releaseAmount: p.escrow?.releaseAmount ?? 0 } }
          : p)),
      );
      // Money AND reputation moved in one action; say both out loud.
      setNote('Escrow released — the provider was paid and their Trust Score recorded the delivery.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCompletingId(null);
    }
  };

  /**
   * Mint a fresh Stripe session for an escrow still awaiting money (hire left
   * it AWAITING_PAYMENT, or the poster abandoned checkout). Nothing releases —
   * the webhook, not this click, confirms the card.
   */
  const payEscrow = async (project: PostedProjectSummary) => {
    setFundingId(project.id);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/v1/agent-marketplace/projects/${project.id}/fund-checkout`),
        { method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` } },
      );
      const json: { success: boolean; error?: string; data?: { funded: boolean; checkoutUrl: string | null } } =
        await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not start payment.');
      // A stripe_disabled fallback URL means checkout failed server-side —
      // redirecting would just land the poster on a broken reservations page.
      if (json.data?.checkoutUrl && !json.data.checkoutUrl.includes('stripe_disabled')) {
        window.location.href = json.data.checkoutUrl;
        return;
      }
      // Funded between render and click — refresh the row.
      setProjects((ps) =>
        (ps ?? []).map((p) => (p.id === project.id ? { ...p, escrow: { status: 'FUNDED', releaseAmount: p.escrow?.releaseAmount ?? 0 } } : p)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setFundingId(null);
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] bg-[var(--cream)] border border-[rgba(201,123,90,0.25)] p-5"
      style={{ boxShadow: 'var(--shadow-soft)' }}>
      <h3 className="font-headline text-xl text-[var(--warm-ink)] mb-1">Your projects</h3>
      <p className="text-sm text-[var(--soft-stone)] mb-4">
        Funds release from escrow when you mark the work complete.
      </p>

      {projects === null ? (
        <p className="text-sm text-[var(--soft-stone)]">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-[var(--soft-stone)]">
          Nothing posted yet —{' '}
          <Link to="/marketplace/post" className="underline">post your first project</Link>.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li
              key={project.id}
              className="rounded-[var(--radius-input)] bg-[var(--warm-sand)]/60 border border-[rgba(191,179,163,0.3)] p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-headline text-[var(--warm-ink)] truncate">{project.title}</p>
                <p className="text-sm text-[var(--soft-stone)]">
                  ${project.budgetUsd.toFixed(0)} · {project.bidCount} bid{project.bidCount === 1 ? '' : 's'} ·{' '}
                  {STATUS_LABELS[project.status] ?? project.status}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {project.escrow && <EscrowStatusBadge status={project.escrow.status} amount={project.escrow.releaseAmount} />}
                {project.escrow?.status === 'AWAITING_PAYMENT' && (
                  <button
                    type="button"
                    disabled={fundingId === project.id}
                    onClick={() => payEscrow(project)}
                    className="rounded-[var(--radius-btn)] px-4 py-2 font-label text-sm text-[var(--cream)] bg-[var(--sage)] hover:bg-[var(--clay)] transition-colors disabled:opacity-50 shrink-0"
                    style={{ boxShadow: 'var(--shadow-btn)' }}
                  >
                    {fundingId === project.id ? 'Opening…' : 'Pay escrow'}
                  </button>
                )}
                {project.status === 'FUNDED' && project.escrow?.status !== 'AWAITING_PAYMENT' && (
                  <button
                    type="button"
                    disabled={completingId === project.id}
                    onClick={() => markComplete(project)}
                    className="rounded-[var(--radius-btn)] px-4 py-2 font-label text-sm text-[var(--cream)] bg-[var(--clay)] hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50 shrink-0"
                    style={{ boxShadow: 'var(--shadow-btn)' }}
                  >
                    {completingId === project.id ? 'Releasing…' : 'Mark complete'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-[var(--terracotta)]">{error}</p>}
      {note && <p className="mt-3 text-sm text-[var(--sage)]">{note}</p>}
    </div>
  );
}

export default PostedProjectsPanel;
