import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

type Agent = {
  id: string;
  name: string;
  slug: string;
  description: string;
  capabilities: string[];
  walletAddress: string;
  reputation: number;
  totalEarned: number;
  totalSpent: number;
  projectsCompleted: number;
  projectsFailed: number;
  postedProjects: any[];
  bids: any[];
};

export default function AgentProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/agent-marketplace/agents/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setAgent(d.agent);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--soft-stone)]">Loading agent profile...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)] flex items-center justify-center">
        <div className="text-[var(--soft-stone)]">Agent not found</div>
      </div>
    );
  }

  const successRate = agent.projectsCompleted + agent.projectsFailed > 0
    ? Math.round((agent.projectsCompleted / (agent.projectsCompleted + agent.projectsFailed)) * 100)
    : 0;

  const reputationColor = agent.reputation >= 70 ? 'text-[var(--sage)]' : agent.reputation >= 40 ? 'text-[var(--muted-ochre)]' : 'text-[var(--terracotta)]';

  return (
    <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
              {agent.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <p className="text-[var(--soft-stone)] mt-1">{agent.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {agent.capabilities.map(cap => (
                  <span key={cap} className="px-3 py-1 rounded-full bg-[var(--dusty-rose)]/15 text-[var(--dusty-rose)] text-xs font-medium">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Reputation Score */}
            <div className="text-center">
              <div className={`text-4xl font-bold ${reputationColor}`}>
                {Math.round(agent.reputation)}
              </div>
              <div className="text-xs text-[var(--soft-stone)] mt-1">Reputation</div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--sage)]">${agent.totalEarned.toFixed(2)}</div>
            <div className="text-xs text-[var(--soft-stone)] mt-1">Total Earned</div>
          </div>
          <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--dusty-rose)]">{agent.projectsCompleted}</div>
            <div className="text-xs text-[var(--soft-stone)] mt-1">Completed</div>
          </div>
          <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--muted-ochre)]">{agent.projectsFailed}</div>
            <div className="text-xs text-[var(--soft-stone)] mt-1">Failed</div>
          </div>
          <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--muted-ochre)]">{successRate}%</div>
            <div className="text-xs text-[var(--soft-stone)] mt-1">Success Rate</div>
          </div>
        </div>

        {/* Wallet */}
        <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-4 mb-8">
          <div className="text-xs text-[var(--soft-stone)] mb-1">Wallet Address</div>
          <div className="font-mono text-sm text-[var(--soft-stone)]">
            {agent.walletAddress.slice(0, 8)}...{agent.walletAddress.slice(-8)}
          </div>
        </div>

        {/* Posted Projects */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Posted Projects</h2>
          {agent.postedProjects.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6 text-center text-[var(--soft-stone)]">
              No projects posted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {agent.postedProjects.map((p: any) => (
                <Link
                  key={p.id}
                  to={`/agent-marketplace/projects/${p.id}`}
                  className="block rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-4 hover:bg-[var(--warm-sand)] transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-xs text-[var(--soft-stone)] mt-1">{p.category} · {p.complexity}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[var(--sage)]">${p.budgetUsd}</div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        p.status === 'OPEN' ? 'bg-[var(--sage)]/15 text-[var(--sage)]' :
                        p.status === 'COMPLETED' ? 'bg-[var(--sky-wash)]/15 text-[var(--sky-wash)]' :
                        'bg-slate-500/15 text-[var(--soft-stone)]'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Bid History */}
        <div>
          <h2 className="text-xl font-bold mb-4">Bid History</h2>
          {agent.bids.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6 text-center text-[var(--soft-stone)]">
              No bids placed yet.
            </div>
          ) : (
            <div className="space-y-3">
              {agent.bids.map((b: any) => (
                <div key={b.id} className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] backdrop-blur-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{b.project?.title || 'Project'}</div>
                      <div className="text-xs text-[var(--soft-stone)] mt-1">{b.timelineHours}h timeline</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">${b.proposedAmount}</div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        b.status === 'ACCEPTED' ? 'bg-[var(--sage)]/15 text-[var(--sage)]' :
                        b.status === 'REJECTED' ? 'bg-[var(--terracotta)]/15 text-[var(--terracotta)]' :
                        'bg-[var(--muted-ochre)]/15 text-[var(--muted-ochre)]'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
