import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { promoService } from '../services/api';
import { useAuthStore } from '../store/authStore';

type Tab = 'feed' | 'ambassadors' | 'jobs' | 'my-work';

const WORK_TYPES = ['SOCIAL_MEDIA', 'EVENTS', 'CONTENT', 'DELIVERY', 'SURVEY', 'OTHER'];

export const PromoPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('feed');
  const [stats, setStats] = useState<any>(null);
  useAuthStore(); // for auth state in child components

  useEffect(() => {
    promoService.stats().then((r) => setStats(r.data?.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: tokens.color.background }}>
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-surface/80 border-b border-white/5 px-4 py-3 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-slate-100 font-headline">Promo Ambassadors</h1>
            <p className="text-xs md:text-sm" style={{ color: tokens.color.muted }}>ZK-verified brand promoters — real reviews, zero-knowledge identity</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/wallet"><Button size="sm" variant="ghost">🔗 Wallet</Button></Link>
            <div className="text-2xl">🎯</div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="max-w-5xl mx-auto px-4 py-3 grid grid-cols-2 md:grid-cols-5 gap-2">
          <Surface className="text-center p-3"><div className="text-lg font-bold text-slate-100">{stats.totalAmbassadors}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Ambassadors</div></Surface>
          <Surface className="text-center p-3"><div className="text-lg font-bold text-slate-100">{stats.totalJobs}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Jobs</div></Surface>
          <Surface className="text-center p-3"><div className="text-lg font-bold text-slate-100">{stats.totalSubmissions}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Submissions</div></Surface>
          <Surface className="text-center p-3"><div className="text-lg font-bold text-slate-100">{stats.totalReviews}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Reviews</div></Surface>
          <Surface className="text-center p-3"><div className="text-lg font-bold text-yellow-300">⭐ {stats.avgRating.toFixed(1)}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Avg Rating</div></Surface>
        </div>
      )}

      {/* Tab Bar */}
      <div className="max-w-5xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
        {([
          { id: 'feed', icon: '📡', label: 'Feed' },
          { id: 'ambassadors', icon: '👥', label: 'Ambassadors' },
          { id: 'jobs', icon: '💼', label: 'Jobs' },
          { id: 'my-work', icon: '🎯', label: 'My Work' },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {tab === 'feed' && <PromoFeed />}
        {tab === 'ambassadors' && <AmbassadorsList />}
        {tab === 'jobs' && <JobsList />}
        {tab === 'my-work' && <MyWork />}
      </div>
    </div>
  );
};

// ── Feed: Latest verified reviews ──────────────────────────────────────────
const PromoFeed: React.FC = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    promoService.listReviews({ verified: true }).then((r) => {
      setReviews(r.data?.data || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center py-8" style={{ color: tokens.color.muted }}>Loading verified reviews...</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-100">📡 Verified Reviews (ZK)</h2>
      <p className="text-sm" style={{ color: tokens.color.muted }}>Real reviews from verified ambassadors — identities hidden via zero-knowledge proofs.</p>
      {reviews.length === 0 && (
        <Surface className="p-6 text-center">
          <div className="text-4xl mb-2">🔏</div>
          <p style={{ color: tokens.color.muted }}>No verified reviews yet. Be the first to submit work and review!</p>
        </Surface>
      )}
      {reviews.map((r) => (
        <Surface key={r.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">
                {r.ambassador?.handle?.[0] || '?'}
              </div>
              <div>
                <div className="font-semibold text-slate-100">{r.ambassador?.handle || 'Anonymous'}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>{r.workType}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-yellow-300">{'⭐'.repeat(r.rating)}</div>
              {r.verified && <Badge tone="success" className="mt-1">ZK Verified 🔏</Badge>}
            </div>
          </div>
          {r.text && <p className="mt-3 text-sm text-slate-300">{r.text}</p>}
          {r.zkCommitment && (
            <div className="mt-2 px-2 py-1 rounded bg-white/5 text-xs font-mono truncate" style={{ color: tokens.color.muted }}>
              Commitment: {r.zkCommitment.slice(0, 24)}...
            </div>
          )}
        </Surface>
      ))}
    </div>
  );
};

// ── Ambassadors List ───────────────────────────────────────────────────────
const AmbassadorsList: React.FC = () => {
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    promoService.listAmbassadors({ workType: filter || undefined }).then((r) => {
      setAmbassadors(r.data?.data || []);
    }).finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <p className="text-center py-8" style={{ color: tokens.color.muted }}>Loading ambassadors...</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-100">👥 Promo Ambassadors</h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setFilter('')} className={`px-3 py-1 rounded-lg text-xs font-semibold ${!filter ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>All</button>
        {WORK_TYPES.map((wt) => (
          <button key={wt} onClick={() => setFilter(wt)} className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${filter === wt ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>{wt.replace('_', ' ')}</button>
        ))}
      </div>
      {ambassadors.length === 0 && (
        <Surface className="p-6 text-center">
          <div className="text-4xl mb-2">👤</div>
          <p style={{ color: tokens.color.muted }}>No ambassadors yet. Be the first to join!</p>
        </Surface>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ambassadors.map((a) => (
          <Surface key={a.id} className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                {a.handle[0]}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-100">{a.handle}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>{a.workType.replace('_', ' ')}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-300">{a.reputationScore.toFixed(0)}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>rep</div>
              </div>
            </div>
            {a.bio && <p className="mt-2 text-sm text-slate-300 line-clamp-2">{a.bio}</p>}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {a.verifiedBadges?.map((b: string) => (
                <Badge key={b} tone="success" className="text-xs">{b}</Badge>
              ))}
              <span className="text-xs" style={{ color: tokens.color.muted }}>{a.completedJobs}/{a.totalJobs} jobs</span>
              <span className="text-xs" style={{ color: tokens.color.muted }}>${a.totalEarnings.toFixed(0)} earned</span>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
};

// ── Jobs List ──────────────────────────────────────────────────────────────
const JobsList: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    promoService.listJobs({ workType: filter || undefined, status: 'OPEN' }).then((r) => {
      setJobs(r.data?.data || []);
    }).finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <p className="text-center py-8" style={{ color: tokens.color.muted }}>Loading jobs...</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-100">💼 Open Jobs</h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setFilter('')} className={`px-3 py-1 rounded-lg text-xs font-semibold ${!filter ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>All</button>
        {WORK_TYPES.map((wt) => (
          <button key={wt} onClick={() => setFilter(wt)} className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${filter === wt ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>{wt.replace('_', ' ')}</button>
        ))}
      </div>
      {jobs.length === 0 && (
        <Surface className="p-6 text-center">
          <div className="text-4xl mb-2">💼</div>
          <p style={{ color: tokens.color.muted }}>No open jobs yet. Check back soon or post a job!</p>
        </Surface>
      )}
      {jobs.map((j) => (
        <Surface key={j.id} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-slate-100 text-lg">{j.title}</div>
              <div className="text-xs" style={{ color: tokens.color.muted }}>{j.brandName || 'Anonymous Brand'} · {j.workType.replace('_', ' ')}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-emerald-300">${j.budgetUsd}</div>
              {j.zkRequired && <Badge tone="warning" className="mt-1">ZK Required 🔏</Badge>}
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-300 line-clamp-2">{j.description}</p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {j.requirements?.map((r: string) => (
              <Badge key={r} tone="info" className="text-xs">{r}</Badge>
            ))}
            <span className="text-xs ml-auto" style={{ color: tokens.color.muted }}>{j._count?.submissions || 0}/{j.maxAmbassadors} spots</span>
          </div>
          {j.deadline && (
            <div className="mt-2 text-xs" style={{ color: tokens.color.muted }}>
              Deadline: {new Date(j.deadline).toLocaleDateString()}
            </div>
          )}
        </Surface>
      ))}
    </div>
  );
};

// ── My Work (authenticated) ────────────────────────────────────────────────
const MyWork: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [ambassador, setAmbassador] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const createAmbassador = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const handle = user?.email?.split('@')[0] || `amb_${Date.now()}`;
      const res = await promoService.createAmbassador({ handle, workType: 'SOCIAL_MEDIA' });
      setAmbassador(res.data?.data);
    } catch (e: any) {
      console.error('Failed to create ambassador:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-100">🎯 My Work</h2>
        <Surface className="p-6 text-center">
          <div className="text-4xl mb-2">🔐</div>
          <p className="text-slate-100 font-semibold">Sign in to get started</p>
          <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Log in or create an account to become an ambassador.</p>
          <Link to="/login"><Button className="mt-4">Sign In</Button></Link>
        </Surface>
      </div>
    );
  }

  if (!ambassador) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-100">🎯 My Work</h2>
        <Surface className="p-6 text-center">
          <div className="text-4xl mb-2">🚀</div>
          <p className="text-slate-100 font-semibold">Become an ambassador</p>
          <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Create your ambassador profile to start earning and reviewing with ZK-verified identity.</p>
          <Button className="mt-4" onClick={createAmbassador} disabled={loading}>
            {loading ? 'Creating...' : '+ Become an Ambassador'}
          </Button>
        </Surface>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-100">🎯 My Work</h2>
      <Surface className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {ambassador.handle[0]}
          </div>
          <div>
            <div className="font-semibold text-slate-100">{ambassador.handle}</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>{ambassador.workType} · Rep: {ambassador.reputationScore}</div>
          </div>
        </div>
      </Surface>
    </div>
  );
};

// Missing import
import { Link } from 'react-router-dom';

export default PromoPage;
