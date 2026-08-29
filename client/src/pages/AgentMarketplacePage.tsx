import { useEffect, useState } from 'react';

type Agent = {
  id: string;
  name: string;
  category: string;
  balancePab: number;
  stakePab: number;
  completionRate: number;
  noShowRate: number;
  completedJobs: number;
  openBids: number;
  trustScore: number;
  rating?: number;
  activeVariant?: string | null;
};

type Feedback = { id: string; rating: number; comment?: string | null; tags: string[]; createdAt: string };
type Variant = { id: string; variant: string; metrics: Record<string, any>; deployed: boolean; createdAt: string };

export default function AgentMarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [learning, setLearning] = useState<any>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ outcome: 'COMPLETED' as 'COMPLETED' | 'NO_SHOW' | 'CANCELLED', rating: 5, tags: '' });

  useEffect(() => {
    fetch('/api/v1/agents')
      .then((r) => r.json())
      .then((d) => setAgents(Array.isArray(d) ? d : d.agents || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    Promise.all([
      fetch(`/api/v1/agents/${selected}`).then((r) => r.json()),
      fetch(`/api/v1/agents/${selected}/learning`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([detail, learn]) => {
      setAgents((prev) => prev.map((a) => (a.id === selected ? { ...a, ...detail } : a)));
      setLearning(learn);
      setFeedback(learn?.feedback || []);
    });
  }, [selected]);

  const submitFeedback = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/agents/${selected}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outcome: form.outcome,
          rating: form.rating,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          bookingId: `ui-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const refresh = await fetch(`/api/v1/agents/${selected}/learning`).then((r) => r.json());
        setLearning(refresh);
        setFeedback(refresh.feedback || []);
        setForm((f) => ({ ...f, tags: '' }));
      } else {
        alert(data.message || data.error || 'Failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold mb-1">Agent Marketplace</h1>
        <p className="text-slate-400 mb-6">Autonomous agents staked in PAB. Performance, trust, and learning in one rail.</p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
                <div className="h-4 w-24 bg-white/10 rounded mb-3" />
                <div className="h-3 w-32 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id === selected ? null : a.id)}
                className={`text-left rounded-2xl border transition hover:scale-[1.01] hover:-translate-y-0.5 ${
                  selected === a.id ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{a.name || `Agent ${a.id.slice(0, 6)}`}</div>
                      <div className="text-xs text-slate-400">{a.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Trust</div>
                      <div className="text-sm font-bold">{a.trustScore}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                    <span className="rounded-full bg-white/10 px-2 py-0.5">PAB {a.balancePab}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5">Stake {a.stakePab}</span>
                    {typeof a.rating === 'number' && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">★ {a.rating.toFixed(1)}</span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-emerald-400"
                      style={{ width: `${Math.min(100, Math.max(0, a.completionRate || 0))}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                    <span>Completed: {a.completedJobs}</span>
                    <span>Open: {a.openBids}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">
                  {agents.find((a) => a.id === selected)?.name || `Agent ${selected.slice(0, 6)}`}
                </div>
                <div className="text-xs text-slate-400">Learning state + recent feedback</div>
              </div>
              <button className="text-xs text-slate-300 hover:text-white" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs text-slate-400">Active variant</div>
                <div className="text-sm font-semibold">{learning?.activeVariant || '—'}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs text-slate-400">Feedback count</div>
                <div className="text-sm font-semibold">{feedback.length}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs text-slate-400">Latest rating</div>
                <div className="text-sm font-semibold">{feedback[0] ? `★ ${feedback[0].rating}` : '—'}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-slate-400 mb-2">Submit outcome feedback</div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  value={form.outcome}
                  onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value as any }))}
                >
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="NO_SHOW">NO_SHOW</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                <select
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  value={form.rating}
                  onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} ★</option>
                  ))}
                </select>
                <input
                  className="flex-1 min-w-[180px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  placeholder="Tags: fast, quality, communicated"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                />
                <button
                  onClick={submitFeedback}
                  disabled={submitting}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Save feedback'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400 mb-2">Recent feedback</div>
                <div className="space-y-2">
                  {feedback.length === 0 && <div className="text-xs text-slate-500">No feedback yet.</div>}
                  {feedback.map((f) => (
                    <div key={f.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200">
                      <div className="flex items-center justify-between">
                        <span>★ {f.rating}</span>
                        <span className="text-slate-500">{new Date(f.createdAt).toLocaleString()}</span>
                      </div>
                      {f.comment && <div className="mt-1 text-slate-300">{f.comment}</div>}
                      {!!f.tags?.length && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {f.tags.map((t) => (
                            <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-2">Variant history</div>
                <div className="space-y-2">
                  {(learning?.variants || []).map((v: Variant) => (
                    <div key={v.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{v.variant}</span>
                        <span className={`rounded-full px-2 py-0.5 ${v.deployed ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>
                          {v.deployed ? 'active' : 'inactive'}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-400">
                        bookings: {(v.metrics?.bookings || 0)} · revenue: {(v.metrics?.revenue || 0)} · rating: {(v.metrics?.rating || 0).toFixed?.(1) ?? v.metrics?.rating}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
