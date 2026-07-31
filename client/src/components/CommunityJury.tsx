import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface Dispute {
  id: string;
  reportedById: string;
  userId: string;
  type: string;
  description: string;
  outcome: string;
  createdAt: string;
}

interface JuryVote {
  id: string;
  disputeId: string;
  jurorId: string;
  voteForId: string;
  reason: string;
}

export const CommunityJury = ({ disputeId }: { disputeId?: string }) => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [votes, setVotes] = useState<Record<string, JuryVote[]>>({});
  const [loading, setLoading] = useState(false);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/disputes');
      const items: Dispute[] = res.data?.data ?? [];
      setDisputes(items);

      const voteMap: Record<string, JuryVote[]> = {};
      for (const d of items) {
        const voteRes = await api.get(`/disputes/${d.id}/votes`);
        voteMap[d.id] = voteRes.data?.data ?? [];
      }
      setVotes(voteMap);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load jury cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  const vote = async (d: Dispute, side: 'reporter' | 'user') => {
    if (!disputeId && !d.id) return;
    const target = disputeId || d.id;
    const voteForId = side === 'reporter' ? d.reportedById : d.userId;
    try {
      const res = await api.post(`/disputes/${target}/vote`, { voteForId });
      if (res.data?.success) {
        toast.success('Vote recorded');
        loadDisputes();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Vote failed');
    }
  };

  const activeCases = disputes.filter(d => d.outcome === 'PENDING' || d.outcome === 'VOTING');
  const resolvedCases = disputes.filter(d => d.outcome !== 'PENDING' && d.outcome !== 'VOTING');

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#121212] p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">Community Jury</h3>
        <p className="text-xs text-zinc-500">Trust Score &gt;90 can vote. First to 3 wins.</p>
      </div>

      <div className="space-y-3">
        {activeCases.map(d => {
          const tally = votes[d.id] || [];
          const reporterVotes = tally.filter(v => v.voteForId === d.reportedById).length;
          const userVotes = tally.filter(v => v.voteForId === d.userId).length;
          return (
            <div key={d.id} className="rounded-xl border border-zinc-800 bg-black/40 p-3">
              <p className="text-xs font-bold text-white">Case {d.id}</p>
              <p className="text-[11px] text-zinc-400">{d.description}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-300">
                <span>Reporter {reporterVotes}/3</span>
                <span>User {userVotes}/3</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => vote(d, 'reporter')}
                  className="px-3 py-2 rounded-lg bg-[#95BF47] text-black font-bold text-xs"
                >
                  Vote Reporter
                </button>
                <button
                  type="button"
                  onClick={() => vote(d, 'user')}
                  className="px-3 py-2 rounded-lg bg-zinc-900 text-white font-bold text-xs border border-zinc-800"
                >
                  Vote User
                </button>
              </div>
            </div>
          );
        })}
        {activeCases.length === 0 && <p className="text-xs text-zinc-500">No active jury cases.</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-zinc-300">Resolved</p>
        {resolvedCases.map(d => (
          <div key={d.id} className="flex items-center justify-between text-xs text-zinc-400">
            <span>Case {d.id}: {d.outcome}</span>
            <span>{new Date(d.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {resolvedCases.length === 0 && <p className="text-[11px] text-zinc-600">No resolved cases yet.</p>}
      </div>

      <button
        type="button"
        onClick={loadDisputes}
        className="w-full py-2 rounded-xl bg-zinc-900 text-white font-bold text-xs border border-zinc-800"
      >
        {loading ? 'Refreshing...' : 'Refresh jury board'}
      </button>
    </div>
  );
};
