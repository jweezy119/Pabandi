import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

type Bid = {
  id: string;
  proposedAmount: number;
  proposedPab: number;
  timelineHours: number;
  approach: string;
  status: string;
  isWinning: boolean;
  submittedAt: string;
  bidder: { id: string; name: string; slug: string; reputation: number };
};

type Escrow = {
  id: string;
  totalAmount: number;
  releaseAmount: number;
  platformFee: number;
  status: string;
  fundedAt: string;
};

type Project = {
  id: string;
  title: string;
  description: string;
  requirements: string;
  budgetUsd: number;
  budgetPab: number;
  deadline: string;
  status: string;
  category: string;
  complexity: string;
  selectedBidId: string | null;
  poster: { id: string; name: string; slug: string };
  bids: Bid[];
  escrow: Escrow | null;
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/v1/agent-marketplace/projects/${projectId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setProject(d.project);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex items-center justify-center">
        <div className="text-slate-400">Project not found</div>
      </div>
    );
  }

  const statusSteps = ['OPEN', 'BIDDING', 'FUNDED', 'IN_PROGRESS', 'COMPLETED'];
  const currentStep = statusSteps.indexOf(project.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs">{project.category}</span>
                <span className="px-3 py-1 rounded-full bg-orange-500/15 text-orange-300 text-xs">{project.complexity}</span>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  project.status === 'OPEN' ? 'bg-emerald-500/15 text-emerald-300' :
                  project.status === 'FUNDED' ? 'bg-blue-500/15 text-blue-300' :
                  'bg-slate-500/15 text-slate-300'
                }`}>
                  {project.status}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">${project.budgetUsd}</div>
              <div className="text-xs text-slate-400">{project.budgetPab.toFixed(0)} PAB</div>
            </div>
          </div>

          {/* Status Timeline */}
          <div className="flex items-center gap-2 mt-4">
            {statusSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className={`w-3 h-3 rounded-full ${i <= currentStep ? 'bg-emerald-400' : 'bg-white/20'}`} />
                {i < statusSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${i < currentStep ? 'bg-emerald-400' : 'bg-white/20'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            {statusSteps.map(s => <span key={s}>{s}</span>)}
          </div>
        </div>

        {/* Description */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold mb-3">Description</h2>
              <p className="text-slate-300 text-sm leading-relaxed">{project.description}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold mb-3">Requirements</h2>
              <p className="text-slate-300 text-sm leading-relaxed">{project.requirements}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Project Info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Project Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Deadline</span>
                  <span>{new Date(project.deadline).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Posted by</span>
                  <Link to={`/agent-marketplace/agents/${project.poster.slug}`} className="text-emerald-400 hover:underline">
                    {project.poster.name}
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bids</span>
                  <span>{project.bids.length}</span>
                </div>
              </div>
            </div>

            {/* Escrow */}
            {project.escrow && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
                <h3 className="text-sm font-semibold mb-3">Escrow</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total</span>
                    <span className="text-emerald-400">${project.escrow.totalAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Platform Fee</span>
                    <span className="text-orange-400">${project.escrow.platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Worker Gets</span>
                    <span className="font-semibold">${project.escrow.releaseAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bids */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Bids ({project.bids.length})</h2>
          {project.bids.length === 0 ? (
            <div className="text-center text-slate-400 py-8">No bids yet. Be the first to bid!</div>
          ) : (
            <div className="space-y-4">
              {project.bids.map(bid => (
                <div key={bid.id} className={`rounded-xl border p-4 ${bid.isWinning ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Link to={`/agent-marketplace/agents/${bid.bidder.slug}`} className="font-semibold hover:text-emerald-400">
                        {bid.bidder.name}
                      </Link>
                      <div className="text-xs text-slate-400">Reputation: {bid.bidder.reputation}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-400">${bid.proposedAmount}</div>
                      <div className="text-xs text-slate-400">{bid.timelineHours}h</div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mt-2">{bid.approach}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      bid.status === 'ACCEPTED' ? 'bg-emerald-500/15 text-emerald-300' :
                      bid.status === 'REJECTED' ? 'bg-red-500/15 text-red-300' :
                      'bg-amber-500/15 text-amber-300'
                    }`}>
                      {bid.status}
                    </span>
                    {bid.isWinning && <span className="text-xs text-emerald-400">Winning Bid</span>}
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
