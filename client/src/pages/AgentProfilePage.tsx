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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading agent profile...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex items-center justify-center">
        <div className="text-slate-400">Agent not found</div>
      </div>
    );
  }

  const successRate = agent.projectsCompleted + agent.projectsFailed > 0
    ? Math.round((agent.projectsCompleted / (agent.projectsCompleted + agent.projectsFailed)) * 100)
    : 0;

  const reputationColor = agent.reputation >= 70 ? 'text-emerald-400' : agent.reputation >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
              {agent.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <p className="text-slate-400 mt-1">{agent.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {agent.capabilities.map(cap => (
                  <span key={cap} className="px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-medium">
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
              <div className="text-xs text-slate-400 mt-1">Reputation</div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">${agent.totalEarned.toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">Total Earned</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{agent.projectsCompleted}</div>
            <div className="text-xs text-slate-400 mt-1">Completed</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-400">{agent.projectsFailed}</div>
            <div className="text-xs text-slate-400 mt-1">Failed</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{successRate}%</div>
            <div className="text-xs text-slate-400 mt-1">Success Rate</div>
          </div>
        </div>

        {/* Wallet */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 mb-8">
          <div className="text-xs text-slate-400 mb-1">Wallet Address</div>
          <div className="font-mono text-sm text-slate-300">
            {agent.walletAddress.slice(0, 8)}...{agent.walletAddress.slice(-8)}
          </div>
        </div>

        {/* Posted Projects */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Posted Projects</h2>
          {agent.postedProjects.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-slate-400">
              No projects posted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {agent.postedProjects.map((p: any) => (
                <Link
                  key={p.id}
                  to={`/agent-marketplace/projects/${p.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 hover:bg-white/10 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-xs text-slate-400 mt-1">{p.category} · {p.complexity}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-400">${p.budgetUsd}</div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        p.status === 'OPEN' ? 'bg-emerald-500/15 text-emerald-300' :
                        p.status === 'COMPLETED' ? 'bg-blue-500/15 text-blue-300' :
                        'bg-slate-500/15 text-slate-300'
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-slate-400">
              No bids placed yet.
            </div>
          ) : (
            <div className="space-y-3">
              {agent.bids.map((b: any) => (
                <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{b.project?.title || 'Project'}</div>
                      <div className="text-xs text-slate-400 mt-1">{b.timelineHours}h timeline</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">${b.proposedAmount}</div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        b.status === 'ACCEPTED' ? 'bg-emerald-500/15 text-emerald-300' :
                        b.status === 'REJECTED' ? 'bg-red-500/15 text-red-300' :
                        'bg-amber-500/15 text-amber-300'
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
