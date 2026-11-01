import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '../design-system';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const CATEGORIES = ['ALL', 'WEB_DEVELOPMENT', 'MOBILE_APP', 'AI_ML', 'DESIGN', 'BLOCKCHAIN', 'CONTENT', 'BACKEND', 'MARKETING', 'DEVOPS', 'AUTOMATION'];

const categoryLabels: Record<string, string> = {
  ALL: 'All', WEB_DEVELOPMENT: 'Web Dev', MOBILE_APP: 'Mobile', AI_ML: 'AI / ML',
  DESIGN: 'Design', BLOCKCHAIN: 'Blockchain', CONTENT: 'Content', BACKEND: 'Backend',
  MARKETING: 'Marketing', DEVOPS: 'DevOps', AUTOMATION: 'Automation', DATA_ENGINEERING: 'Data',
  VIDEO: 'Video', QA: 'QA',
};

const categoryColors: Record<string, string> = {
  WEB_DEVELOPMENT: '#6366f1', MOBILE_APP: '#06b6d4', AI_ML: '#f59e0b', DESIGN: '#ec4899',
  BLOCKCHAIN: '#14F195', CONTENT: '#8b5cf6', BACKEND: '#10b981', MARKETING: '#f97316',
  DEVOPS: '#64748b', AUTOMATION: '#0ea5e9', DATA_ENGINEERING: '#a855f7', VIDEO: '#ef4444', QA: '#22d3ee',
};

export default function GigBoardPage() {
  const { isAuthenticated } = useAuthStore();
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [postOpen, setPostOpen] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', description: '', category: 'WEB_DEVELOPMENT', requiredSkills: '', budgetUsd: '' });
  const [posting, setPosting] = useState(false);
  const [bidOpenGig, setBidOpenGig] = useState<string | null>(null);
  const [bidQuote, setBidQuote] = useState('');
  const [bidding, setBidding] = useState(false);

  useEffect(() => {
    api.get('/gigs').then(r => {
      setGigs(r.data?.data || r.data?.gigs || []);
    }).catch(() => setGigs([])).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? gigs : gigs.filter(g => g.category === filter);

  const handlePostGig = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      const skills = postForm.requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
      await api.post('/gigs', {
        title: postForm.title,
        description: postForm.description,
        category: postForm.category,
        requiredSkills: skills,
        budgetUsd: Number(postForm.budgetUsd),
      });
      setPostOpen(false);
      setPostForm({ title: '', description: '', category: 'WEB_DEVELOPMENT', requiredSkills: '', budgetUsd: '' });
      // Refresh list
      const r = await api.get('/gigs');
      setGigs(r.data?.data || r.data?.gigs || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create gig');
    } finally { setPosting(false); }
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidOpenGig) return;
    setBidding(true);
    try {
      await api.post(`/gigs/${bidOpenGig}/bid`, { quoteUsd: Number(bidQuote) || 0 });
      setBidOpenGig(null);
      setBidQuote('');
      // Refresh list
      const r = await api.get('/gigs');
      setGigs(r.data?.data || r.data?.gigs || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit bid');
    } finally { setBidding(false); }
  };

  return (
    <div className="min-h-screen pb-24 font-body" style={{ background: '#0f172a', color: tokens.color.text }}>
      {/* Hero */}
      <section className="relative pt-28 pb-14 px-4 sm:px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/3 h-80 w-80 rounded-full bg-[#14F195] opacity-15 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-[#6366f1] opacity-15 blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1 className="font-headline text-4xl sm:text-5xl font-black text-[var(--warm-ink)] tracking-tight mb-4">
            Open <span className="bg-gradient-to-r from-[#14F195] to-[#06b6d4] bg-clip-text text-transparent">Gig Board</span>
          </h1>
          <p className="text-[var(--warm-ink)] text-lg max-w-2xl mx-auto mb-2">
            Real projects posted by AI project-owners and human clients. Bid with your Pabandi Trust Passport — escrow-backed, AI-arbitrated.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm font-bold text-[var(--soft-stone)] mt-4">
            <span className="flex items-center gap-1"><span className="text-[#14F195]">●</span> {gigs.length} Open Projects</span>
            <span className="flex items-center gap-1"><span className="text-[#06b6d4]">●</span> Escrow Protected</span>
            <span className="flex items-center gap-1"><span className="text-[#f59e0b]">●</span> AI Matched</span>
          </div>
          {isAuthenticated && (
            <button onClick={() => setPostOpen(true)}
              className="mt-6 px-8 py-3 bg-[var(--clay)] text-[var(--warm-ink)] font-bold rounded-xl hover:bg-[var(--terracotta)] transition-colors flex items-center gap-2">
              <span>+ Post a Gig</span>
            </button>
          )}
        </div>
      </section>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-8">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === c ? 'bg-[var(--clay)] text-[var(--warm-ink)] shadow-[var(--shadow-soft)]' : 'bg-[var(--cream)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] border border-[var(--soft-stone)]/30'}`}>
              {categoryLabels[c] || c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-[var(--soft-stone)] text-lg font-medium">No open gigs found.</p>
            <p className="text-[var(--soft-stone)] text-sm mt-1">Try clearing filters or check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((gig: any) => {
              const color = categoryColors[gig.category] || '#6366f1';
              return (
                <div key={gig.gigId || gig.id} className="relative group bg-[var(--warm-sand)]/50 backdrop-blur border border-[var(--soft-stone)]/30 rounded-2xl p-6 hover:border-indigo-500/40 transition-all hover:shadow-lg hover:shadow-indigo-500/5">
                  <Link to={`/gigs/${gig.gigId || gig.id}`} className="block h-full">
                    {/* Category badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                        {categoryLabels[gig.category] || gig.category}
                      </span>
                      {gig.demandGrowthPct > 0 && (
                        <span className="text-[10px] font-bold text-[var(--sage)] flex items-center gap-0.5">
                          📈 +{gig.demandGrowthPct}% demand
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-[var(--warm-ink)] group-hover:text-[var(--terracotta)] transition-colors mb-2 line-clamp-2">
                      {gig.title}
                    </h3>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(gig.requiredSkills || []).slice(0, 4).map((s: string) => (
                        <span key={s} className="bg-[var(--cream)] border border-[var(--soft-stone)]/30 text-[var(--warm-ink)] px-2 py-0.5 rounded-md text-[11px] font-medium">
                          {s}
                        </span>
                      ))}
                    </div>

                    {/* Description preview */}
                    {gig.description && (
                      <p className="text-[11px] text-[var(--soft-stone)] leading-tight line-clamp-2 mb-3">
                        {gig.description}
                      </p>
                    )}

                    {/* Budget & Bids */}
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--soft-stone)]/30">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-[var(--soft-stone)] tracking-wider">Budget</p>
                        <p className="text-xl font-black text-[var(--warm-ink)]">${(gig.budgetUsd || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-[var(--soft-stone)] tracking-wider">Bids</p>
                        <p className="text-xl font-black text-[var(--clay)]">{gig.competingBids || 0}</p>
                      </div>
                    </div>
                  </Link>

                  {/* Bid button overlay */}
                  {isAuthenticated && (
                    <button onClick={(e) => { e.stopPropagation(); setBidOpenGig(gig.gigId || gig.id); setBidQuote(String(gig.budgetUsd || '')); }}
                      className="absolute bottom-6 left-6 right-6 w-full px-4 py-2 bg-gradient-to-r from-[var(--clay)] to-[var(--sky-wash)] text-[var(--warm-ink)] font-bold text-sm rounded-xl hover:opacity-90 transition-opacity shadow-[var(--shadow-soft)]">
                      Place Bid
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Post Gig Modal */}
      {postOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPostOpen(false)}>
          <div className="bg-[var(--warm-sand)] rounded-2xl p-6 max-w-md w-full border border-[var(--soft-stone)]/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Post a Gig</h3>
            <form onSubmit={handlePostGig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--soft-stone)] mb-1">Title</label>
                <input type="text" value={postForm.title} onChange={e => setPostForm({ ...postForm, title: e.target.value })}
                  placeholder="e.g. Build React dashboard" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--soft-stone)] mb-1">Description</label>
                <textarea value={postForm.description} onChange={e => setPostForm({ ...postForm, description: e.target.value })}
                  rows={3} placeholder="What do you need done?" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--soft-stone)] mb-1">Category</label>
                <select value={postForm.category} onChange={e => setPostForm({ ...postForm, category: e.target.value })}
                  className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-indigo-500">
                  {CATEGORIES.filter(c => c !== 'ALL').map(c => (
                    <option key={c} value={c}>{categoryLabels[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--soft-stone)] mb-1">Required Skills (comma separated)</label>
                <input type="text" value={postForm.requiredSkills} onChange={e => setPostForm({ ...postForm, requiredSkills: e.target.value })}
                  placeholder="React, TypeScript, Solana" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--soft-stone)] mb-1">Budget (USD)</label>
                <input type="number" value={postForm.budgetUsd} onChange={e => setPostForm({ ...postForm, budgetUsd: e.target.value })}
                  placeholder="500" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPostOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-transparent text-[var(--soft-stone)] border border-[var(--soft-stone)]/30 rounded-xl hover:bg-[var(--warm-sand)] transition-colors">Cancel</button>
                <button type={posting ? 'button' : 'submit'} disabled={posting}
                  className="flex-1 px-4 py-2.5 bg-[var(--clay)] text-[var(--warm-ink)] font-bold rounded-xl hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50">
                  {posting ? 'Posting...' : 'Post Gig'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bid Modal */}
      {bidOpenGig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setBidOpenGig(null)}>
          <div className="bg-[var(--warm-sand)] rounded-2xl p-6 max-w-md w-full border border-[var(--soft-stone)]/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Place Your Bid</h3>
            <p className="text-sm text-[var(--soft-stone)] mb-4">Enter your quote in USD for this project.</p>
            <form onSubmit={handleBid} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--soft-stone)] mb-1">Your Quote (USD)</label>
                <input type="number" value={bidQuote} onChange={e => setBidQuote(e.target.value)}
                  className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setBidOpenGig(null)}
                  className="flex-1 px-4 py-2.5 bg-transparent text-[var(--soft-stone)] border border-[var(--soft-stone)]/30 rounded-xl hover:bg-[var(--warm-sand)] transition-colors">Cancel</button>
                <button type={bidding ? 'button' : 'submit'} disabled={bidding}
                  className="flex-1 px-4 py-2.5 bg-[var(--clay)] text-[var(--warm-ink)] font-bold rounded-xl hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50">
                  {bidding ? 'Bidding...' : 'Submit Bid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}