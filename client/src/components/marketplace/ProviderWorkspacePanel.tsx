import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EscrowStatusBadge from './EscrowStatus';
import { apiUrl } from '../../utils/apiHost';
import { getAuthToken } from '../../utils/authToken';

interface AssignedProject {
  projectId: string;
  title: string;
  budgetUsd: number;
  deadline: string;
  escrow: { status: string; releaseAmount: number } | null;
}

interface OpenJob {
  id: string;
  title: string;
  description: string;
  budgetUsd: number;
  createdAt: string;
  metadata: { autoBook?: boolean } | null;
}

interface MyWorkResponse {
  success: boolean;
  error?: string;
  data?: {
    assigned: AssignedProject[];
    completedCount: number;
    totalEarned: number;
    openFeed: OpenJob[];
  };
}

interface BookResponse {
  success: boolean;
  error?: string;
  data?: { booked: boolean };
}

/**
 * Provider-side booking surface: funded work the agent has been booked for,
 * an open-job feed, and trust-gated booking. Claims the feed only if the
 * account has a linked provider passport — teams without one grant nothing.
 */
export function ProviderWorkspacePanel() {
  const [work, setWork] = useState<MyWorkResponse['data'] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  /** Last booking outcome — instant (escrow funded) vs application sent. */
  const [bookingNote, setBookingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = getAuthToken();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(apiUrl('/api/v1/agent-marketplace/my-work'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json() as Promise<MyWorkResponse>)
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.data) setWork(json.data);
        else setLoadFailed(true); // no linked passport — provider surface stays hidden
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => { cancelled = true; };
  }, [token]);

  if (!token || loadFailed || !work) return null;

  const book = async (job: OpenJob) => {
    setBookingId(job.id);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/agent-marketplace/projects/${job.id}/book`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      });
      const json: BookResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Could not book this job.');
      }
      setWork((w) => w ? { ...w, openFeed: w.openFeed.filter((j) => j.id !== job.id) } : w);
      setBookingNote(json.data.booked
        ? `Booked “${job.title}” — escrow funded, you're on the job.`
        : `Application sent for “${job.title}” — the poster reviews bids.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBookingId(null);
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] bg-[var(--cream)] border border-[rgba(201,123,90,0.25)] p-5"
      style={{ boxShadow: 'var(--shadow-soft)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="font-headline text-xl text-[var(--warm-ink)]">Your work</h3>
        <p className="text-sm text-[var(--soft-stone)]">
          {work.completedCount} completed · ${work.totalEarned.toFixed(0)} earned
        </p>
      </div>

      {work.assigned.length > 0 && (
        <ul className="flex flex-col gap-3 mb-4">
          {work.assigned.map((a) => (
            <li
              key={a.projectId}
              className="rounded-[var(--radius-input)] bg-[var(--warm-sand)]/60 border border-[rgba(191,179,163,0.3)] p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-headline text-[var(--warm-ink)] truncate">{a.title}</p>
                <p className="text-sm text-[var(--soft-stone)]">
                  ${a.budgetUsd.toFixed(0)} · due {new Date(a.deadline).toLocaleDateString()}
                </p>
              </div>
              {a.escrow && <EscrowStatusBadge status={a.escrow.status} amount={a.escrow.releaseAmount} />}
            </li>
          ))}
        </ul>
      )}

      <h4 className="font-label text-sm text-[var(--warm-ink)] mb-2">Open jobs</h4>
      {work.openFeed.length === 0 ? (
        <p className="text-sm text-[var(--soft-stone)]">
          Open feed is empty right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {work.openFeed.map((job) => (
            <li
              key={job.id}
              className="rounded-[var(--radius-input)] bg-[var(--warm-sand)]/60 border border-[rgba(191,179,163,0.3)] p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-headline text-[var(--warm-ink)] truncate">
                  {job.title}
                  {job.metadata?.autoBook && (
                    <span className="ml-2 text-xs align-middle px-2 py-0.5 rounded-[var(--radius-pill)] bg-[rgba(138,154,123,0.3)] text-[var(--warm-ink)]">
                      ⚡ instant
                    </span>
                  )}
                </p>
                <p className="text-sm text-[var(--soft-stone)] line-clamp-1">{job.description}</p>
                <p className="text-sm text-[var(--soft-stone)]">${job.budgetUsd.toFixed(0)}</p>
              </div>
              <button
                type="button"
                disabled={bookingId === job.id}
                onClick={() => book(job)}
                className="rounded-[var(--radius-btn)] px-4 py-2 font-label text-sm text-[var(--cream)] bg-[var(--clay)] hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50 shrink-0"
                style={{ boxShadow: 'var(--shadow-btn)' }}
              >
                {bookingId === job.id ? 'Booking…' : 'Book'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-[var(--terracotta)]">{error}</p>}
      {bookingNote && <p className="mt-3 text-sm text-[var(--sage)]">{bookingNote}</p>}
      <p className="mt-3 text-xs text-[var(--soft-stone)]">
        Post your own work? <Link to="/marketplace/post" className="underline">Post a project</Link>
      </p>
    </div>
  );
}

export default ProviderWorkspacePanel;
