import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tokens } from '../design-system';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface GigDetail {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  budgetUsd?: number;
  requiredSkills?: string[];
  competingBids?: number;
  demandGrowthPct?: number;
  estimatedHours?: number;
  createdBy?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  milestones?: any[];
}

/** Haversine distance in miles between two lat/lng points. */
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function GigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const preferredMode = user?.preferredMode || 'personal';
  const isBusiness = preferredMode === 'business';

  const [gig, setGig] = useState<GigDetail | null>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidOpen, setBidOpen] = useState(false);
  const [bidQuote, setBidQuote] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptBidId, setAcceptBidId] = useState('');
  const [accepting, setAccepting] = useState(false);

  // Location state for distance calculation
  const [location, setLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
    loading: boolean;
    error: string | null;
  }>({ latitude: null, longitude: null, loading: false, error: null });

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

  // Detect user location for distance display
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ latitude: null, longitude: null, loading: false, error: 'Geolocation not supported' });
      return;
    }
    setLocation({ latitude: null, longitude: null, loading: true, error: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, loading: false, error: null }),
      (err) => setLocation({ latitude: null, longitude: null, loading: false, error: 'Unable to retrieve location' }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Calculate distance if both user and gig have coordinates
  const distanceMiles = gig && location.latitude && location.longitude && gig.latitude && gig.longitude
    ? haversineMiles(location.latitude, location.longitude, gig.latitude, gig.longitude)
    : null;

  const formatDistance = (d: number | null) => {
    if (d === null) return '—';
    if (d < 1) return '<1 mi';
    return `${d.toFixed(1)} mi`;
  };

  const isMine = gig?.createdBy === user?.id;
  const showBidButton = !isBusiness && !isMine && gig?.status === 'OPEN';
  const showAcceptButton = isBusiness && isMine && gig?.competingBids > 0 && gig?.status === 'OPEN';

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setBidSubmitting(true);
    try {
      await api.post(`/gigs/${id}/bid`, { quoteUsd: Number(bidQuote) || gig?.budgetUsd });
      setBidOpen(false);
      const r = await api.get(`/gigs/${id}/bid-ranking`).catch(() => null);
      if (r?.data?.ranked) setRanking(r.data.ranked);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit bid');
    } finally { setBidSubmitting(false); }
  };

  const handleAcceptBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !acceptBidId) return;
    setAccepting(true);
    try {
      await api.post(`/gigs/${id}/accept/${acceptBidId}`);
      setAcceptOpen(false);
      setAcceptBidId('');
      const r = await api.get(`/gigs/${id}`).catch(() => null);
      if (r?.data?.data) setGig(r.data.data);
      else if (r?.data) setGig(r.data);
      const rank = await api.get(`/gigs/${id}/bid-ranking`).catch(() => null);
      if (rank?.data?.ranked) setRanking(rank.data.ranked);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept bid');
    } finally { setAccepting(false); }
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
        <div className="bg-[var(--warm-sand)]/80 border border-[var(--soft-stone)]/30 rounded-3xl p-10 text-center max-w-md">
          <p className="text-3xl mb-3">📋</p>
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">Gig Not Found</h2>
          <p className="text-[var(--soft-stone)] mb-6">This project may have been completed or removed.</p>
          <Link to="/gigs" className="text-[var(--clay)] font-bold hover:text-[var(--terracotta)]">← Back to Gig Board</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a', color: tokens.color.text }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28">
        {/* Breadcrumb */}
        <Link to="/gigs" className="text-sm text-[var(--clay)] font-bold hover:text-[var(--terracotta)] mb-6 inline-block">← Gig Board</Link>

        {/* Header */}
        <div className="bg-[var(--warm-sand)]/60 backdrop-blur border border-[var(--soft-stone)]/30 rounded-3xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--clay)]/20 text-[var(--clay)] border border-indigo-500/30">
              {gig.category}
            </span>
            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${gig.status === 'OPEN' ? 'bg-[var(--sage)]/20 text-[var(--sage)] border border-[var(--sage)]/30' : gig.status === 'IN_PROGRESS' ? 'bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)] border border-amber-500/30' : 'bg-slate-500/20 text-[var(--soft-stone)] border border-slate-500/30'}`}>
              {gig.status}
            </span>
            {distanceMiles !== null && (
              <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--clay)]/20 text-[var(--clay)] border border-indigo-500/30">
                {formatDistance(distanceMiles)} away
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black text-[var(--warm-ink)] mb-3">{gig.title}</h1>
          <p className="text-[var(--warm-ink)] leading-relaxed mb-6">{gig.description}</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[var(--cream)] rounded-xl p-4 border border-[var(--soft-stone)]/30">
              <p className="text-[10px] uppercase font-bold text-[var(--soft-stone)] tracking-wider mb-1">Budget</p>
              <p className="text-2xl font-black text-[var(--warm-ink)]">${(gig.budgetUsd || 0).toLocaleString()}</p>
            </div>
            <div className="bg-[var(--cream)] rounded-xl p-4 border border-[var(--soft-stone)]/30">
              <p className="text-[10px] uppercase font-bold text-[var(--soft-stone)] tracking-wider mb-1">Est. Hours</p>
              <p className="text-2xl font-black text-[var(--warm-ink)]">{gig.estimatedHours || '—'}</p>
            </div>
            <div className="bg-[var(--cream)] rounded-xl p-4 border border-[var(--soft-stone)]/30">
              <p className="text-[10px] uppercase font-bold text-[var(--soft-stone)] tracking-wider mb-1">Demand Growth</p>
              <p className="text-2xl font-black text-[var(--sage)]">+{gig.demandGrowthPct || 0}%</p>
            </div>
            <div className="bg-[var(--cream)] rounded-xl p-4 border border-[var(--soft-stone)]/30">
              <p className="text-[10px] uppercase font-bold text-[var(--soft-stone)] tracking-wider mb-1">Escrow</p>
              <p className="text-2xl font-black text-[var(--clay)]">🛡️</p>
            </div>
          </div>

          {/* Location */}
          {gig.locationName && (
            <div className="mt-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-[var(--soft-stone)]">location_on</span>
              <span className="text-sm text-[var(--soft-stone)]">{gig.locationName}</span>
              {distanceMiles !== null && (
                <span className="text-xs text-[var(--soft-stone)] ml-1">({formatDistance(distanceMiles)})</span>
              )}
            </div>
          )}

          {/* Skills */}
          <div className="mt-6">
            <p className="text-xs font-bold text-[var(--soft-stone)] uppercase tracking-wider mb-2">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {(gig.requiredSkills || []).map((s: string) => (
                <span key={s} className="bg-[var(--clay)]/10 border border-indigo-500/20 text-[var(--terracotta)] px-3 py-1 rounded-lg text-sm font-medium">{s}</span>
              ))}
            </div>
          </div>

          {/* Bid CTA */}
          {gig.status === 'OPEN' && (
            <div className="mt-8 pt-6 border-t border-[var(--soft-stone)]/30">
              {isAuthenticated ? (
                bidOpen ? (
                  <form onSubmit={handleBid} className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-[var(--soft-stone)] mb-1">Your Quote (USD)</label>
                      <input type="number" value={bidQuote} onChange={e => setBidQuote(e.target.value)}
                        placeholder={String(gig.budgetUsd)} className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-indigo-500" />
                    </div>
                    <button type="submit" disabled={bidSubmitting} className="bg-[var(--clay)] text-[var(--warm-ink)] font-bold px-6 py-3 rounded-xl hover:bg-indigo-400 transition-colors disabled:opacity-50">
                      {bidSubmitting ? 'Submitting...' : 'Submit Bid'}
                    </button>
                    <button type="button" onClick={() => setBidOpen(false)} className="text-[var(--soft-stone)] font-bold px-4 py-3">Cancel</button>
                  </form>
                ) : (
                  <button onClick={() => setBidOpen(true)} className="w-full sm:w-auto bg-gradient-to-r from-[var(--clay)] to-[var(--sky-wash)] text-[var(--warm-ink)] font-bold px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-[var(--shadow-soft)]">
                    Place Your Bid →
                  </button>
                )
              ) : (
                <p className="text-[var(--soft-stone)] text-sm">
                  <a href="/api/v1/auth/google?role=freelancer" className="text-[var(--clay)] font-bold hover:text-[var(--terracotta)]">Sign in</a> to bid on this project
                </p>
              )}

              {/* Accept Bid (poster only - business mode) */}
              {isAuthenticated && isBusiness && isMine && gig.competingBids > 0 && (
                <div className="mt-6 pt-6 border-t border-[var(--soft-stone)]/30">
                  <h4 className="text-xs font-bold text-[var(--soft-stone)] uppercase tracking-wider mb-3">Accept a Bid</h4>
                  {acceptOpen ? (
                    <form onSubmit={handleAcceptBid} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-[var(--soft-stone)] mb-1">Bid ID to Accept</label>
                        <input type="text" value={acceptBidId} onChange={e => setAcceptBidId(e.target.value)}
                          placeholder="Paste bid ID" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-indigo-500" />
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setAcceptOpen(false)}
                          className="flex-1 px-4 py-2.5 bg-transparent text-[var(--soft-stone)] border border-[var(--soft-stone)]/30 rounded-xl hover:bg-[var(--warm-sand)] transition-colors">Cancel</button>
                        <button type={accepting ? 'button' : 'submit'} disabled={accepting}
                          className="flex-1 px-4 py-2.5 bg-[var(--clay)] text-[var(--warm-ink)] font-bold rounded-xl hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50">
                          {accepting ? 'Accepting...' : 'Accept Bid'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setAcceptOpen(true)}
                      className="w-full px-4 py-2.5 bg-[var(--clay)]/20 text-[var(--clay)] border border-[var(--clay)]/30 font-bold rounded-xl hover:bg-[var(--clay)]/30 transition-colors">
                      Accept a Bid →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Milestones */}
        {gig.milestones && gig.milestones.length > 0 && (
          <div className="bg-[var(--warm-sand)]/40 border border-[var(--soft-stone)]/30 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">📊 Milestones</h2>
            <div className="space-y-3">
              {gig.milestones.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[var(--clay)]/20 border border-indigo-500/30 flex items-center justify-center text-[var(--clay)] font-bold text-sm">{i + 1}</div>
                  <div className="flex-1">
                    <p className="text-[var(--warm-ink)] font-medium">{m.name}</p>
                    <div className="mt-1 h-1.5 bg-[var(--cream)] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[var(--clay)] to-[var(--sky-wash)] rounded-full" style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[var(--soft-stone)]">{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bid Ranking */}
        {ranking.length > 0 && (
          <div className="bg-[var(--warm-sand)]/40 border border-[var(--soft-stone)]/30 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">🏆 Bid Ranking (Capability-Weighted)</h2>
            <div className="space-y-2">
              {ranking.map((r: any, i: number) => (
                <div key={r.agentId} className={`flex items-center gap-4 p-3 rounded-xl ${i === 0 ? 'bg-[var(--sage)]/10 border border-[var(--sage)]/20' : 'bg-[var(--cream)] border border-[var(--soft-stone)]/30'}`}>
                  <span className="text-lg font-black text-[var(--soft-stone)] w-6">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-[var(--warm-ink)] font-medium text-sm">Agent {r.agentId.slice(0, 8)}...</p>
                    <p className="text-[10px] text-[var(--soft-stone)]">Trust: {r.trust} · Value: {r.value}</p>
                  </div>
                  <span className="text-[var(--warm-ink)] font-bold">${r.quote?.toLocaleString()}</span>
                  {i === 0 && <span className="text-[var(--sage)] text-xs font-bold">BEST FIT</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
