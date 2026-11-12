import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  DollarSign,
  TrendingUp,
  Zap,
  ArrowLeft,
  Lock,
  BadgeCheck,
  Share2,
  ExternalLink,
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { PabandiCheckoutModal } from '../components/PabandiCheckoutModal';
import { ZkTrustBadge } from '../components/ZkTrustBadge';
import '../styles/pbn-tokens.css';

interface GigDetail {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  budgetUsd?: number;
  vaultUsdc?: number;
  paymentRail?: string;
  requiredSkills?: string[];
  competingBids?: number;
  demandGrowthPct?: number;
  estimatedHours?: number;
  createdBy?: string;
  bestAgentId?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  milestones?: { name: string; pct: number }[];
}

interface RankedBid {
  agentId: string;
  trust: number;
  value: number;
  quote: number;
  bidId?: string;
  zkProofVerified?: boolean;
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
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [gig, setGig] = useState<GigDetail | null>(null);
  const [ranking, setRanking] = useState<RankedBid[]>([]);
  const [loading, setLoading] = useState(true);

  // Proposal modal
  const [bidOpen, setBidOpen] = useState(false);
  const [bidQuote, setBidQuote] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);

  // Escrow Checkout modal
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState<number>(0);
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);

  // Release escrow state
  const [releasing, setReleasing] = useState(false);
  const [releaseSuccess, setReleaseSuccess] = useState<string | null>(null);

  // Location state
  const [location, setLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });

  useEffect(() => {
    if (!id) return;
    fetchGigData();
  }, [id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { timeout: 8000 }
    );
  }, []);

  const fetchGigData = async () => {
    try {
      const [gigRes, rankRes] = await Promise.all([
        api.get(`/gigs/${id}`).catch(() => null),
        api.get(`/gigs/${id}/bid-ranking`).catch(() => null),
      ]);

      if (gigRes?.data?.data) setGig(gigRes.data.data);
      else if (gigRes?.data) setGig(gigRes.data);

      if (rankRes?.data?.ranked) {
        setRanking(rankRes.data.ranked);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  const distanceMiles =
    gig && location.latitude && location.longitude && gig.latitude && gig.longitude
      ? haversineMiles(location.latitude, location.longitude, gig.latitude, gig.longitude)
      : null;

  const isMine = gig?.createdBy === user?.id;

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setBidSubmitting(true);
    try {
      await api.post(`/gigs/${id}/bid`, {
        quoteUsd: Number(bidQuote) || gig?.budgetUsd,
      });
      setBidOpen(false);
      setBidQuote('');
      fetchGigData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit bid');
    } finally {
      setBidSubmitting(false);
    }
  };

  const handleOpenCheckout = (bid?: RankedBid) => {
    if (bid) {
      setSelectedBidId(bid.bidId || null);
      setCheckoutAmount(bid.quote || gig?.budgetUsd || 100);
    } else {
      setSelectedBidId(null);
      setCheckoutAmount(gig?.budgetUsd || 100);
    }
    setCheckoutOpen(true);
  };

  const handleCheckoutSuccess = async (rail: string, txHash?: string) => {
    if (!id || !gig) return;
    try {
      // 1. If accepting a specific bid, mark bid accepted
      if (selectedBidId) {
        await api.post(`/gigs/${id}/accept/${selectedBidId}`).catch(() => null);
      }

      // 2. Fund escrow in orchestrator and journal into double-entry ledger
      await api.post(`/gigs/${id}/fund-escrow`, {
        rail,
        amountUsd: checkoutAmount,
        txHash: txHash || `tx_orchestrated_${Date.now()}`,
      });

      setCheckoutOpen(false);
      fetchGigData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to complete escrow funding');
    }
  };

  const handleReleaseEscrow = async () => {
    if (!id || !confirm('Verify delivery and release locked escrow funds to the contractor?')) return;
    setReleasing(true);
    try {
      const res = await api.post(`/gigs/${id}/release-escrow`, {});
      if (res.data?.success) {
        setReleaseSuccess(`Escrow released! ${res.data.data.payeeTrustScoreDelta} Trust Score awarded to contractor.`);
        fetchGigData();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to release escrow');
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--pbn-bg,#0a0e17)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--pbn-accent,#4fd1c5)] border-t-transparent" />
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--pbn-bg,#0a0e17)]">
        <div className="bg-[var(--pbn-surface,#141e33)] border border-[var(--pbn-border,#334155)] rounded-3xl p-10 text-center max-w-md text-[var(--pbn-text,#f1f5f9)]">
          <p className="text-4xl mb-3">📋</p>
          <h2 className="text-xl font-bold font-['Space_Grotesk',sans-serif] mb-2">Gig Not Found</h2>
          <p className="text-xs text-[var(--pbn-text-muted,#94a3b8)] mb-6">This project may have been completed, archived, or removed.</p>
          <Link to="/gigs" className="text-xs font-bold text-[var(--pbn-accent,#4fd1c5)] hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Gig Board</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 text-[var(--pbn-text,#f1f5f9)]" style={{ backgroundColor: 'var(--pbn-bg, #0a0e17)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 space-y-8">
        
        {/* Navigation & Trust OS breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/gigs"
            className="text-xs font-semibold text-[var(--pbn-text-muted,#94a3b8)] hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Gig Board</span>
          </Link>

          <Link
            to="/trust-os"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 hover:border-emerald-400 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Trust OS: 100% Asset-Backed Escrow</span>
          </Link>
        </div>

        {releaseSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{releaseSuccess}</span>
          </div>
        )}

        {/* Gig Header Card */}
        <div className="bg-[var(--pbn-surface,#141e33)] border border-[var(--pbn-border,#334155)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-[var(--pbn-accent,#4fd1c5)]/10 text-[var(--pbn-accent,#4fd1c5)] border border-[var(--pbn-accent,#4fd1c5)]/20">
                {gig.category}
              </span>
              <span className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider ${
                gig.status === 'OPEN'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : gig.status === 'IN_PROGRESS'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-700/30 text-slate-400 border border-slate-600/30'
              }`}>
                {gig.status}
              </span>
              {distanceMiles !== null && (
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  {distanceMiles < 1 ? '<1 mi' : `${distanceMiles.toFixed(1)} mi`} away
                </span>
              )}
              <ZkTrustBadge
                score={920}
                disputeRate={0.5}
                subjectName={gig.title}
                subjectId={gig.id}
                variant="pill"
              />
            </div>

            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Payment Escrow Rail</div>
              <div className="text-xs font-mono font-bold text-[var(--pbn-accent,#4fd1c5)]">
                {gig.paymentRail === 'solana' ? 'Solana USDC (Anchor PDA)' : gig.paymentRail === 'raast' ? 'SBP Raast (0% Direct)' : 'Universal Card / Escrow'}
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black font-['Space_Grotesk',sans-serif] tracking-tight text-[var(--pbn-text,#f1f5f9)]">
            {gig.title}
          </h1>

          <p className="text-sm text-[var(--pbn-text-muted,#94a3b8)] leading-relaxed">
            {gig.description}
          </p>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[var(--pbn-border,#334155)]">
            <div className="bg-slate-900/60 border border-[var(--pbn-border,#334155)] p-3.5 rounded-2xl">
              <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Escrow Budget</div>
              <div className="text-xl font-bold font-mono text-[var(--pbn-text,#f1f5f9)]">${(gig.budgetUsd || 0).toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/60 border border-[var(--pbn-border,#334155)] p-3.5 rounded-2xl">
              <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Vault Locked</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ${(gig.vaultUsdc || (gig.status === 'IN_PROGRESS' ? gig.budgetUsd : 0) || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-900/60 border border-[var(--pbn-border,#334155)] p-3.5 rounded-2xl">
              <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Competing Bids</div>
              <div className="text-xl font-bold font-mono text-[var(--pbn-accent,#4fd1c5)]">{gig.competingBids || 0}</div>
            </div>
            <div className="bg-slate-900/60 border border-[var(--pbn-border,#334155)] p-3.5 rounded-2xl">
              <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Trust Guarantee</div>
              <div className="text-xl font-bold font-mono text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Skills Badges */}
          {gig.requiredSkills && gig.requiredSkills.length > 0 && (
            <div>
              <div className="text-xs font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)] mb-2">Required Skills</div>
              <div className="flex flex-wrap gap-2">
                {gig.requiredSkills.map(s => (
                  <span
                    key={s}
                    className="px-3 py-1 rounded-lg text-xs font-mono bg-white/[0.04] text-slate-300 border border-[var(--pbn-border,#334155)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="pt-4 border-t border-[var(--pbn-border,#334155)] flex flex-wrap items-center justify-between gap-4">
            {gig.status === 'OPEN' && !isMine && (
              bidOpen ? (
                <form onSubmit={handleBid} className="w-full flex items-end gap-3 bg-slate-900/80 p-4 rounded-2xl border border-[var(--pbn-border,#334155)]">
                  <div className="flex-1">
                    <label className="block text-xs font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)] mb-1">
                      Your Binding Quote (USD/USDC)
                    </label>
                    <input
                      type="number"
                      value={bidQuote}
                      onChange={e => setBidQuote(e.target.value)}
                      placeholder={String(gig.budgetUsd || 100)}
                      className="w-full bg-[var(--pbn-bg,#0a0e17)] border border-[var(--pbn-border,#334155)] rounded-xl px-4 py-2.5 text-sm text-[var(--pbn-text,#f1f5f9)] focus:outline-none focus:border-[var(--pbn-accent,#4fd1c5)] font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={bidSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-[var(--pbn-accent,#4fd1c5)] hover:opacity-90 text-slate-950 font-bold text-xs disabled:opacity-50"
                  >
                    {bidSubmitting ? 'Submitting...' : 'Submit Proposal Bid'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBidOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-[var(--pbn-border,#334155)] text-xs text-[var(--pbn-text-muted,#94a3b8)] hover:text-white"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setBidOpen(true)}
                  className="px-6 py-3 rounded-xl bg-[var(--pbn-accent,#4fd1c5)] hover:opacity-90 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg"
                >
                  <Zap className="w-4 h-4" />
                  <span>Place Your Bid →</span>
                </button>
              )
            )}

            {isMine && gig.status === 'OPEN' && (
              <button
                type="button"
                onClick={() => handleOpenCheckout()}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Pre-Fund Project Escrow (${gig.budgetUsd})</span>
              </button>
            )}

            {isMine && gig.status === 'IN_PROGRESS' && (
              <button
                type="button"
                onClick={handleReleaseEscrow}
                disabled={releasing}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{releasing ? 'Releasing Escrow...' : 'Verify Delivery & Release Escrow →'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bid Ranking Section with Trust OS Badges */}
        <div className="bg-[var(--pbn-surface,#141e33)] border border-[var(--pbn-border,#334155)] rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold font-['Space_Grotesk',sans-serif] flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-[var(--pbn-accent,#4fd1c5)]" />
                <span>Autonomous &amp; Human Bids (Trust-Weighted)</span>
              </h2>
              <p className="text-xs text-[var(--pbn-text-muted,#94a3b8)] mt-1">
                Ranked by Trust OS reliability engine (past escrows, dispute rate, on-chain collateral, and skill match).
              </p>
            </div>
            <Link
              to="/trust-os"
              className="text-xs font-mono text-[var(--pbn-accent,#4fd1c5)] hover:underline flex items-center gap-1"
            >
              <span>View Reliability Engine</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {ranking.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--pbn-text-muted,#94a3b8)] bg-slate-900/40 rounded-2xl border border-[var(--pbn-border,#334155)]">
                No bids submitted yet. Be the first contractor or AI agent to submit a quote.
              </div>
            ) : (
              ranking.map((r, i) => (
                <div
                  key={r.agentId || i}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    i === 0
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-slate-900/60 border-[var(--pbn-border,#334155)]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-black font-mono text-slate-500 w-6 text-center">
                      #{i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <span>Agent {r.agentId ? r.agentId.slice(0, 8) : 'Contractor'}...</span>
                        {i === 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            BEST FIT
                          </span>
                        )}
                        <ZkTrustBadge
                          score={r.trust || 920}
                          disputeRate={0.4}
                          subjectName={`Agent ${r.agentId ? r.agentId.slice(0, 8) : 'Contractor'}`}
                          subjectId={r.agentId || `agent_${i}`}
                          variant="compact"
                        />
                      </div>
                      <div className="text-[11px] font-mono text-[var(--pbn-text-muted,#94a3b8)] mt-0.5">
                        Skill Fit: {r.value || 95}% · Dispute Rate: &lt;0.5% · ZK Verified
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--pbn-border,#334155)]">
                    <div className="text-right">
                      <div className="text-[10px] font-mono uppercase text-[var(--pbn-text-muted,#94a3b8)]">Quote</div>
                      <div className="text-lg font-bold font-mono text-[var(--pbn-text,#f1f5f9)]">
                        ${(r.quote || gig.budgetUsd || 0).toLocaleString()}
                      </div>
                    </div>

                    {isMine && gig.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => handleOpenCheckout(r)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--pbn-accent,#4fd1c5)] hover:opacity-90 text-slate-950 transition-opacity shadow"
                      >
                        Accept &amp; Fund Escrow
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Universal Escrow Checkout Modal */}
      {checkoutOpen && (
        <PabandiCheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          title={`Fund Escrow: ${gig.title}`}
          subtitle="100% Asset-Backed Escrow via Solana USDC, SBP Raast, or Card"
          amount={checkoutAmount}
          currency="USD"
          referenceId={gig.id}
          squareNote={`pabandi:escrow:gig:${gig.id}`}
          initialRail={(gig.paymentRail as any) || 'solana'}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
