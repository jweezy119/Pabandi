import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tokens } from '../design-system';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function GigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuthStore();
  const [gig, setGig] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidOpen, setBidOpen] = useState(false);
  const [bidQuote, setBidQuote] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/gigs/${id}`).catch(() => null),
      api.get(`/gigs/${id}/bid-ranking`).catch(() => null),
    ]).then(([gigRes, rankRes]) => {
      if (gigRes?.data?.data) setGig(gigRes.data.data);
      else if (gigRes?.data) setGig(gigRes.data);
      if (rankRes?.data?.ranked) setRanking(rankRes.data.ranked);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setBidSubmitting(true);
    try {
      await api.post(`/gigs/${id}/bid`, { quoteUsd: Number(bidQuote) || gig?.budgetUsd });
      setBidOpen(false);
      // Refresh
      const r = await api.get(`/gigs/${id}/bid-ranking`).catch(() => null);
      if (r?.data?.ranked) setRanking(r.data.ranked);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit bid');
    } finally { setBidSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f172a' }}>
        <div className="bg-slate-800/80 border border-white/10 rounded-3xl p-10 text-center max-w-md">
          <p className="text-3xl mb-3">📋</p>
          <h2 className="text-xl font-bold text-white mb-2">Gig Not Found</h2>
          <p className="text-slate-400 mb-6">This project may have been completed or removed.</p>
          <Link to="/gigs" className="text-indigo-400 font-bold hover:text-indigo-300">← Back to Gig Board</Link>
        </div>
      </div>
    );
  }

  const milestones = gig.milestones || [];

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a', color: tokens.color.text }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28">
        {/* Breadcrumb */}
        <Link to="/gigs" className="text-sm text-indigo-400 font-bold hover:text-indigo-300 mb-6 inline-block">← Gig Board</Link>

        {/* Header */}
        <div className="bg-slate-800/60 backdrop-blur border border-white/10 rounded-3xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {gig.category}
            </span>
            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${gig.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : gig.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
              {gig.status}
            </span>
          </div>
          <h1 className="text-3xl font-black text-white mb-3">{gig.title}</h1>
          <p className="text-slate-300 leading-relaxed mb-6">{gig.description}</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Budget</p>
              <p className="text-2xl font-black text-white">${(gig.budgetUsd || 0).toLocaleString()}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Est. Hours</p>
              <p className="text-2xl font-black text-white">{gig.estimatedHours || '—'}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Demand Growth</p>
              <p className="text-2xl font-black text-emerald-400">+{gig.demandGrowthPct || 0}%</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Escrow</p>
              <p className="text-2xl font-black text-indigo-400">🛡️</p>
            </div>
          </div>

          {/* Skills */}
          <div className="mt-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {(gig.requiredSkills || []).map((s: string) => (
                <span key={s} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1 rounded-lg text-sm font-medium">{s}</span>
              ))}
            </div>
          </div>

          {/* Bid CTA */}
          {gig.status === 'OPEN' && (
            <div className="mt-8 pt-6 border-t border-white/5">
              {isAuthenticated ? (
                bidOpen ? (
                  <form onSubmit={handleBid} className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-400 mb-1">Your Quote (USD)</label>
                      <input type="number" value={bidQuote} onChange={e => setBidQuote(e.target.value)}
                        placeholder={String(gig.budgetUsd)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <button type="submit" disabled={bidSubmitting} className="bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-indigo-400 transition-colors disabled:opacity-50">
                      {bidSubmitting ? 'Submitting...' : 'Submit Bid'}
                    </button>
                    <button type="button" onClick={() => setBidOpen(false)} className="text-slate-400 font-bold px-4 py-3">Cancel</button>
                  </form>
                ) : (
                  <button onClick={() => setBidOpen(true)} className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20">
                    Place Your Bid →
                  </button>
                )
              ) : (
                <p className="text-slate-400 text-sm">
                  <a href="/api/v1/auth/google?role=freelancer" className="text-indigo-400 font-bold hover:text-indigo-300">Sign in</a> to bid on this project
                </p>
              )}
            </div>
          )}
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4">📊 Milestones</h2>
            <div className="space-y-3">
              {milestones.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">{i + 1}</div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{m.name}</p>
                    <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full" style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-400">{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bid Ranking */}
        {ranking.length > 0 && (
          <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">🏆 Bid Ranking (Capability-Weighted)</h2>
            <div className="space-y-2">
              {ranking.map((r: any, i: number) => (
                <div key={r.agentId} className={`flex items-center gap-4 p-3 rounded-xl ${i === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                  <span className="text-lg font-black text-slate-400 w-6">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Agent {r.agentId.slice(0, 8)}...</p>
                    <p className="text-[10px] text-slate-400">Trust: {r.trust} · Value: {r.value}</p>
                  </div>
                  <span className="text-white font-bold">${r.quote?.toLocaleString()}</span>
                  {i === 0 && <span className="text-emerald-400 text-xs font-bold">BEST FIT</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
