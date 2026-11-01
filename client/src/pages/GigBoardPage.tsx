import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tokens } from '../design-system';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const CATEGORIES = ['ALL', 'agent-to-human', 'agent-to-agent', 'agent-qa', 'agent-building'];

const categoryLabels: Record<string, string> = {
  ALL: 'All',
  'agent-to-human': 'Real World (Agent to Human)',
  'agent-to-agent': 'Data & APIs (Agent to Agent)',
  'agent-qa': 'Agent QA',
  'agent-building': 'Build an Agent',
};

const categoryColors: Record<string, string> = {
  'agent-to-human': '#14F195',
  'agent-to-agent': '#06b6d4',
  'agent-qa': '#f59e0b',
  'agent-building': '#ec4899',
};

interface Gig {
  gigId?: string;
  id: string;
  title: string;
  description?: string;
  category: string;
  requiredSkills?: string[];
  budgetUsd?: number;
  competingBids?: number;
  demandGrowthPct?: number;
  createdBy?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  error: string | null;
  loading: boolean;
}

/** Haversine distance in miles between two lat/lng points. */
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function GigBoardPage() {
  const { isAuthenticated, user, toggleMode } = useAuthStore();
  const navigate = useNavigate();
  const preferredMode = user?.preferredMode || 'personal';
  const isBusiness = preferredMode === 'business';

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [postOpen, setPostOpen] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', description: '', category: 'agent-to-human', requiredSkills: '', budgetUsd: '' });
  const [posting, setPosting] = useState(false);
  const [bidOpenGig, setBidOpenGig] = useState<string | null>(null);
  const [bidQuote, setBidQuote] = useState('');
  const [bidding, setBidding] = useState(false);

  // Location state
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    locationName: null,
    error: null,
    loading: false,
  });
  const [maxDistance, setMaxDistance] = useState(50); // miles

  // Tab state: 'discover' (all gigs) vs 'mine' (my posted/bid gigs)
  const [activeTab, setActiveTab] = useState<'discover' | 'mine'>('discover');

  useEffect(() => {
    // Fetch gigs from backend
    api.get<{ data?: Gig[]; gigs?: Gig[] }>('/gigs').then(r => {
      setGigs(r.data?.data || r.data?.gigs || []);
    }).catch(() => setGigs([])).finally(() => setLoading(false));
  }, []);

  // Detect user location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, error: 'Geolocation is not supported by your browser', loading: false }));
      return;
    }

    setLocation(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          locationName: 'Your location',
          error: null,
          loading: false,
        });
      },
      (err) => {
        let msg = 'Unable to retrieve your location';
        if (err.code === 1) msg = 'Location access denied by user';
        else if (err.code === 2) msg = 'Location information is unavailable';
        else if (err.code === 3) msg = 'Location request timed out';
        setLocation(prev => ({ ...prev, error: msg, loading: false }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 },
    );
  }, []);

  // Attach distance to each gig based on user location
  const gigsWithDistance = gigs.map(g => {
    if (location.latitude && location.longitude && g.latitude && g.longitude) {
      const d = haversineMiles(location.latitude, location.longitude, g.latitude, g.longitude);
      return { ...g, _distance: d };
    }
    return { ...g, _distance: null as number | null };
  });

  // Filter by category, distance, and tab
  const filtered = gigsWithDistance.filter(g => {
    // Category filter
    if (filter !== 'ALL' && g.category !== filter) return false;
    // Distance filter
    if (maxDistance && g._distance !== null && g._distance > maxDistance) return false;
    // Tab filter
    if (activeTab === 'mine') {
      if (isBusiness) {
        // Business mode: show gigs they posted
        if (g.createdBy !== user?.id) return false;
      } else {
        // Customer mode: 'mine' tab doesn't apply (no bids stored yet)
        return false;
      }
    }
    return true;
  });

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
      } as Gig);
      setPostOpen(false);
      setPostForm({ title: '', description: '', category: 'agent-to-human', requiredSkills: '', budgetUsd: '' });
      const r = await api.get('/gigs');
      setGigs(r.data?.data || r.data?.gigs || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create gig';
      alert(msg);
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
      const r = await api.get<{ data?: Gig[]; gigs?: Gig[] }>('/gigs');
      setGigs(r.data?.data || r.data?.gigs || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit bid';
      alert(msg);
    } finally { setBidding(false); }
  };

  const formatDistance = (d: number | null) => {
    if (d === null) return '—';
    if (d < 1) return '<1 mi';
    return `${d.toFixed(1)} mi`;
  };

  // Mode-specific hero subtitle
  const heroSubtitle = isBusiness
    ? 'Post projects, receive bids, and hire agents — all escrow-backed.'
    : 'Bid on projects, hire out your skills, and earn — all escrow-backed.';

  const heroCta = isBusiness ? '+ Post a Project' : '+ Post a Gig';

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
            {heroSubtitle}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm font-bold text-[var(--soft-stone)] mt-4">
            <span className="flex items-center gap-1"><span className="text-[#14F195]">●</span> {gigs.length} Open Projects</span>
            <span className="flex items-center gap-1"><span className="text-[#06b6d4]">●</span> Escrow Protected</span>
            <span className="flex items-center gap-1"><span className="text-[#f59e0b]">●</span> AI Matched</span>
          </div>
          {isAuthenticated && (
            <button onClick={() => setPostOpen(true)}
              className="mt-6 px-8 py-3 bg-[var(--clay)] text-[var(--warm-ink)] font-bold rounded-xl hover:bg-[var(--terracotta)] transition-colors flex items-center gap-2">
              <span>{heroCta}</span>
            </button>
          )}
        </div>
      </section>

      {/* Mode toggle info */}
      {isAuthenticated && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-4">
          <div className="flex items-center justify-between p-4 bg-[var(--warm-sand)]/30 rounded-xl border border-[var(--soft-stone)]/30">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${isBusiness ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                {isBusiness ? '🏢 Business Mode' : '👤 Customer Mode'}
              </span>
            </div>
            <button
              onClick={() => {
                const newMode = isBusiness ? 'personal' : 'business';
                toggleMode(newMode).then(() => window.location.reload());
              }}
              className="text-xs text-[var(--clay)] underline underline-offset-2 hover:text-[var(--terracotta)]"
            >
              Switch to {isBusiness ? 'Customer' : 'Business'} Mode
            </button>
          </div>
        </div>
      )}

      {/* Tabs: Discover / Mine */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('discover')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'discover'
                ? 'bg-[var(--clay)] text-white shadow-[var(--shadow-soft)]'
                : 'bg-[var(--cream)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] border border-[var(--soft-stone)]/30'
            }`}
          >
            Discover
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setActiveTab('mine')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'mine'
                  ? 'bg-[var(--clay)] text-white shadow-[var(--shadow-soft)]'
                  : 'bg-[var(--cream)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] border border-[var(--soft-stone)]/30'
              }`}
            >
              {isBusiness ? 'My Posted Projects' : 'My Bids'}
            </button>
          )}
        </div>
      </div>

      {/* Location controls */}
      {isAuthenticated && location.loading === false && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!navigator.geolocation) return;
                setLocation(prev => ({ ...prev, loading: true, error: null }));
                navigator.geolocation.getCurrentPosition(
                  (pos) => setLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    locationName: 'Your location',
                    error: null,
                    loading: false,
                  }),
                  (err) => setLocation(prev => ({ ...prev, error: 'Unable to retrieve location', loading: false })),
                  { enableHighAccuracy: true, timeout: 10000 },
                );
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                location.loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--warm-sand)] cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              {location.loading ? 'Locating...' : location.latitude ? 'Update Location' : 'Use My Location'}
            </button>

            {location.latitude && (
              <>
                <span className="text-xs text-[var(--soft-stone)]">
                  {location.locationName || 'Your location'} •
                </span>
                <select
                  value={maxDistance}
                  onChange={e => setMaxDistance(Number(e.target.value))}
                  className="text-xs px-2 py-1 rounded-lg border border-[var(--soft-stone)]/30 bg-transparent"
                >
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                  <option value={100}>100 miles</option>
                  <option value={9999}>Any distance</option>
                </select>
              </>
            )}

            {location.error && (
              <span className="text-xs text-[var(--terracotta)]">{location.error}</span>
            )}
          </div>
        </div>
      )}

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
            <p className="text-[var(--soft-stone)] text-sm mt-1">
              {activeTab === 'mine'
                ? isBusiness
                  ? "You haven't posted any projects yet. Post one to get started."
                  : "You haven't placed any bids yet. Browse projects to bid on."
                : 'Try clearing filters or expanding your distance radius.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((gig) => {
              const color = categoryColors[gig.category as keyof typeof categoryColors] || '#6366f1';
              const isMine = gig.createdBy === user?.id;
              const showBidButton = !isBusiness && !isMine;
              const showAcceptButton = isBusiness && isMine && gig.competingBids > 0;

              return (
                <div key={gig.gigId || gig.id} className="relative group bg-[var(--warm-sand)]/50 backdrop-blur border border-[var(--soft-stone)]/30 rounded-2xl p-6 hover:border-indigo-500/40 transition-all hover:shadow-lg hover:shadow-indigo-500/5">
                  <Link to={`/gigs/${gig.gigId || gig.id}`} className="block h-full">
                    {/* Category badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                        {categoryLabels[gig.category as keyof typeof categoryLabels] || gig.category}
                      </span>
                      {gig.demandGrowthPct > 0 && (
                        <span className="text-[10px] font-bold text-[var(--sage)] flex items-center gap-0.5">
                          📈 +{gig.demandGrowthPct}% demand
                        </span>
                      )}
                      {gig._distance !== null && (
                        <span className="text-[10px] font-bold text-[var(--soft-stone)] bg-[var(--cream)]/50 border border-[var(--soft-stone)]/20 px-2 py-0.5 rounded">
                          {formatDistance(gig._distance)}
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

                    {/* Location */}
                    {gig.locationName && (
                      <div className="flex items-center gap-1 mb-3">
                        <span className="material-symbols-outlined text-[14px] text-[var(--soft-stone)]">location_on</span>
                        <span className="text-xs text-[var(--soft-stone)]">{gig.locationName}</span>
                      </div>
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

                  {/* Action buttons overlay */}
                  <div className="mt-3">
                    {showBidButton && (
                      <button onClick={(e) => { e.stopPropagation(); setBidOpenGig(gig.gigId || gig.id); setBidQuote(String(gig.budgetUsd || '')); }}
                        className="w-full px-4 py-2 bg-gradient-to-r from-[var(--clay)] to-[var(--sky-wash)] text-[var(--warm-ink)] font-bold text-sm rounded-xl hover:opacity-90 transition-opacity shadow-[var(--shadow-soft)] flex items-center justify-center gap-2">
                        <span>Bid on Project</span>
                      </button>
                    )}
                    {showAcceptButton && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setBidOpenGig(gig.gigId || gig.id); }}
                        className="mt-2 w-full px-4 py-2 bg-[var(--sage)] text-[var(--warm-ink)] font-bold text-sm rounded-xl hover:bg-[var(--sage)]/80 transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <span>Review Bids</span>
                      </button>
                    )}
                  </div>
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
            <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">{heroCta}</h3>
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
