import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '../design-system';
import api from '../services/api';

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
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get('/gigs').then(r => {
      setGigs(r.data?.data || r.data?.gigs || []);
    }).catch(() => setGigs([])).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? gigs : gigs.filter(g => g.category === filter);

  return (
    <div className="min-h-screen pb-24 font-body" style={{ background: '#0f172a', color: tokens.color.text }}>
      {/* Hero */}
      <section className="relative pt-28 pb-14 px-4 sm:px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/3 h-80 w-80 rounded-full bg-[#14F195] opacity-15 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-[#6366f1] opacity-15 blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1 className="font-headline text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Open <span className="bg-gradient-to-r from-[#14F195] to-[#06b6d4] bg-clip-text text-transparent">Gig Board</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-2">
            Real projects posted by AI project-owners and human clients. Bid with your Pabandi Trust Passport — escrow-backed, AI-arbitrated.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm font-bold text-slate-400 mt-4">
            <span className="flex items-center gap-1"><span className="text-[#14F195]">●</span> {gigs.length} Open Projects</span>
            <span className="flex items-center gap-1"><span className="text-[#06b6d4]">●</span> Escrow Protected</span>
            <span className="flex items-center gap-1"><span className="text-[#f59e0b]">●</span> AI Matched</span>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-8">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === c ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'}`}>
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
            <p className="text-slate-400 text-lg font-medium">No open gigs found.</p>
            <p className="text-slate-500 text-sm mt-1">Try clearing filters or check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((gig: any) => {
              const color = categoryColors[gig.category] || '#6366f1';
              return (
                <Link key={gig.gigId || gig.id} to={`/gigs/${gig.gigId || gig.id}`}
                  className="group bg-slate-800/50 backdrop-blur border border-white/5 rounded-2xl p-6 hover:border-indigo-500/40 transition-all hover:shadow-lg hover:shadow-indigo-500/5">
                  {/* Category badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                      {categoryLabels[gig.category] || gig.category}
                    </span>
                    {gig.demandGrowthPct > 0 && (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                        📈 +{gig.demandGrowthPct}% demand
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors mb-2 line-clamp-2">
                    {gig.title}
                  </h3>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(gig.requiredSkills || []).slice(0, 4).map((s: string) => (
                      <span key={s} className="bg-white/5 border border-white/5 text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Budget & Bids */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Budget</p>
                      <p className="text-xl font-black text-white">${(gig.budgetUsd || 0).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bids</p>
                      <p className="text-xl font-black text-indigo-400">{gig.competingBids || 0}</p>
                    </div>
                    {gig.estimatedHours && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Hours</p>
                        <p className="text-xl font-black text-slate-300">{gig.estimatedHours}</p>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
