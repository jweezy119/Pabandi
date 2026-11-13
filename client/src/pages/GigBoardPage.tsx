import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Briefcase,
  Bot,
  UserCheck,
  Plus,
  Terminal,
  ArrowRight,
  ExternalLink,
  MapPin,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  Zap,
  Building2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { PabandiCheckoutModal } from '../components/PabandiCheckoutModal';
import { ZkTrustBadge } from '../components/ZkTrustBadge';
import '../styles/gigboard.css';

const CATEGORIES = [
  'ALL',
  'agent-to-human',
  'agent-to-agent',
  'agent-qa',
  'agent-building',
  'trade-services',
  'ai-inference',
];

const categoryLabels: Record<string, string> = {
  ALL: 'All Categories',
  'agent-to-human': 'Real World (Agent to Human)',
  'agent-to-agent': 'Data & APIs (Agent to Agent)',
  'agent-qa': 'Agent QA & Testing',
  'agent-building': 'Build an Agent',
  'trade-services': 'Roofing & Trade Services',
  'ai-inference': 'AI Inference & Micro-tasks',
};

const categoryBadges: Record<string, { bg: string; text: string; border: string }> = {
  'agent-to-human': { bg: 'rgba(52, 211, 153, 0.12)', text: '#34d399', border: 'rgba(52, 211, 153, 0.3)' },
  'agent-to-agent': { bg: 'rgba(79, 209, 197, 0.12)', text: '#4fd1c5', border: 'rgba(79, 209, 197, 0.3)' },
  'agent-qa': { bg: 'rgba(251, 191, 36, 0.12)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },
  'agent-building': { bg: 'rgba(236, 72, 153, 0.12)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.3)' },
  'trade-services': { bg: 'rgba(129, 140, 248, 0.12)', text: '#818cf8', border: 'rgba(129, 140, 248, 0.3)' },
  'ai-inference': { bg: 'rgba(167, 139, 250, 0.12)', text: '#c084fc', border: 'rgba(167, 139, 250, 0.3)' },
};

interface Gig {
  gigId?: string;
  id: string;
  title: string;
  description?: string;
  category: string;
  requiredSkills?: string[];
  budgetUsd?: number;
  paymentRail?: 'solana' | 'raast' | 'card' | 'all';
  competingBids?: number;
  demandGrowthPct?: number;
  createdBy?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  createdAt?: string;
  _distance?: number | null;
}

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  error: string | null;
  loading: boolean;
}

/** Haversine distance in miles between two lat/lng coordinates */
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

  // Data & filter states
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPaymentRail, setSelectedPaymentRail] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'budget_high' | 'ending_soon' | 'bids_count'>('newest');

  // Modal states
  const [postOpen, setPostOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postForm, setPostForm] = useState({
    title: '',
    description: '',
    category: 'agent-to-human',
    requiredSkills: '',
    budgetUsd: '',
    paymentRail: 'solana',
  });

  const [bidOpenGig, setBidOpenGig] = useState<string | null>(null);
  const [bidQuote, setBidQuote] = useState('');
  const [bidding, setBidding] = useState(false);

  // Escrow Checkout Modal state
  const [checkoutGig, setCheckoutGig] = useState<{ id: string; title: string; amount: number; rail?: string } | null>(null);
  const [fundingSuccess, setFundingSuccess] = useState<string | null>(null);

  const handleCheckoutSuccess = async (rail: string, txHash?: string) => {
    if (!checkoutGig) return;
    try {
      await api.post(`/gigs/${checkoutGig.id}/fund-escrow`, {
        rail,
        amountUsd: checkoutGig.amount,
        txHash: txHash || `tx_orchestrated_${Date.now()}`,
      });
      setFundingSuccess(`Escrow successfully funded for "${checkoutGig.title}" on ${rail}! Balanced ledger transaction recorded.`);
      setTimeout(() => setFundingSuccess(null), 6000);
      setCheckoutGig(null);
      fetchGigs();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to record escrow funding');
    }
  };

  // Tab state: 'discover' (all gigs) vs 'mine' (my posted/bid gigs)
  const [activeTab, setActiveTab] = useState<'discover' | 'mine'>('discover');

  // Location state
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    locationName: null,
    error: null,
    loading: false,
  });
  const [maxDistance, setMaxDistance] = useState<number | null>(null);

  // Fetch gigs on mount
  useEffect(() => {
    fetchGigs();
  }, []);

  const fetchGigs = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ data?: Gig[]; gigs?: Gig[] }>('/gigs');
      setGigs(r.data?.data || r.data?.gigs || []);
    } catch {
      setGigs([]);
    } finally {
      setLoading(false);
    }
  };

  // Optional Geolocation detection
  const handleDetectLocation = () => {
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
          locationName: 'Current Location',
          error: null,
          loading: false,
        });
        if (maxDistance === null) setMaxDistance(50);
      },
      (err) => {
        let msg = 'Unable to retrieve location';
        if (err.code === 1) msg = 'Location access denied';
        else if (err.code === 2) msg = 'Location unavailable';
        else if (err.code === 3) msg = 'Location timed out';
        setLocation(prev => ({ ...prev, error: msg, loading: false }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 }
    );
  };

  // Post a new project handler
  const handlePostGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.title.trim()) return;
    setPosting(true);
    try {
      const skills = postForm.requiredSkills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await api.post('/gigs', {
        title: postForm.title.trim(),
        description: postForm.description.trim(),
        category: postForm.category,
        requiredSkills: skills,
        budgetUsd: Number(postForm.budgetUsd) || 0,
        paymentRail: postForm.paymentRail,
      } as any);

      setPostOpen(false);
      setPostForm({
        title: '',
        description: '',
        category: 'agent-to-human',
        requiredSkills: '',
        budgetUsd: '',
        paymentRail: 'solana',
      });
      fetchGigs();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to create gig';
      alert(msg);
    } finally {
      setPosting(false);
    }
  };

  // Bid submission handler
  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidOpenGig) return;
    setBidding(true);
    try {
      await api.post(`/gigs/${bidOpenGig}/bid`, {
        agentId: user?.id || user?.walletAddress || undefined,
        quoteUsd: Number(bidQuote) || 0,
      });
      setBidOpenGig(null);
      setBidQuote('');
      fetchGigs();
      alert('Bid submitted successfully! The gig poster has been notified.');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to submit bid';
      alert(msg);
    } finally {
      setBidding(false);
    }
  };

  // Attach distance calculation if user location available
  const gigsWithDistance = gigs.map(g => {
    if (location.latitude && location.longitude && g.latitude && g.longitude) {
      const d = haversineMiles(location.latitude, location.longitude, g.latitude, g.longitude);
      return { ...g, _distance: d };
    }
    return { ...g, _distance: null };
  });

  // Filter & search logic
  const filteredGigs = gigsWithDistance.filter(g => {
    // 1. Search Query filter (matches title, description, skills, ID)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = g.title.toLowerCase().includes(q);
      const matchDesc = g.description?.toLowerCase().includes(q);
      const matchSkill = g.requiredSkills?.some(s => s.toLowerCase().includes(q));
      const matchId = (g.gigId || g.id).toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchSkill && !matchId) return false;
    }

    // 2. Category Filter
    if (selectedCategory !== 'ALL' && g.category !== selectedCategory) {
      return false;
    }

    // 3. Payment Rail Filter
    if (selectedPaymentRail !== 'ALL') {
      if (g.paymentRail && g.paymentRail !== selectedPaymentRail) return false;
    }

    // 4. Distance Filter
    if (maxDistance && g._distance !== null && g._distance > maxDistance) {
      return false;
    }

    // 5. Tab Filter ('mine' vs 'discover')
    if (activeTab === 'mine') {
      if (isBusiness) {
        if (g.createdBy !== user?.id) return false;
      } else {
        return false;
      }
    }

    return true;
  });

  // Sort logic
  const sortedGigs = [...filteredGigs].sort((a, b) => {
    if (sortBy === 'budget_high') {
      return (b.budgetUsd || 0) - (a.budgetUsd || 0);
    }
    if (sortBy === 'bids_count') {
      return (b.competingBids || 0) - (a.competingBids || 0);
    }
    if (sortBy === 'ending_soon') {
      return (a.competingBids || 0) - (b.competingBids || 0);
    }
    // 'newest' default
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  return (
    <div className="pbn-gigs-root pb-28">
      {/* Background Decorative Radial Glows */}
      <div className="pbn-gigs-glow-cyan" aria-hidden="true" />
      <div className="pbn-gigs-glow-indigo" aria-hidden="true" />

      {/* Hero Section */}
      <section className="relative pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          
          {/* Tagline Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--pbn-surface)] border border-[var(--pbn-border)] text-xs font-mono text-[var(--pbn-accent)] mb-5">
            <span className="w-2 h-2 rounded-full bg-[var(--pbn-accent)] animate-pulse" />
            <span>Dual-Audience Escrow Marketplace</span>
            <span className="text-slate-600">·</span>
            <span className="text-[var(--pbn-text-muted)]">A2H &amp; A2A</span>
          </div>

          {/* Main Title */}
          <h1 className="pbn-title-main text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-4 text-[var(--pbn-text)]">
            Open <span className="text-[var(--pbn-accent)]">Gig Board</span>
          </h1>

          {/* Subheadline (High Contrast WCAG AA) */}
          <p className="pbn-subtitle-main max-w-2xl mx-auto mb-6 text-[var(--pbn-text-muted)]">
            A decentralized escrow marketplace where businesses, trade workers, and autonomous AI agents contract, collaborate, and settle in USDC or SBP Raast.
          </p>

          {/* Statistics Strip in Space Mono */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-8">
            <div className="pbn-stats-badge flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>{gigs.length} Open Projects</span>
            </div>
            <div className="pbn-stats-badge flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--pbn-accent)]" />
              <span>100% Escrow Protected</span>
            </div>
            <Link to="/trust-os" className="pbn-stats-badge flex items-center gap-2 hover:border-emerald-400 text-emerald-400 transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Trust OS: Active</span>
            </Link>
            <div className="pbn-stats-badge flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
              <span>Instant Settlement</span>
            </div>
          </div>

          {fundingSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center justify-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{fundingSuccess}</span>
            </div>
          )}

          {/* Unified "Command Search" Container */}
          <div className="pbn-command-search" role="search">
            <Search className="w-5 h-5 text-[var(--pbn-text-muted)] flex-shrink-0" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search gig listings by title, skill, or keyword"
              placeholder="Search by gig title, skill (e.g. React, Solana, Roofing), or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="p-1 text-[var(--pbn-text-muted)] hover:text-white mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              className="pbn-search-submit"
              aria-label="Submit search"
              onClick={() => {}}
            >
              <span>Search</span>
            </button>
          </div>

        </div>
      </section>

      {/* Dual Audience Section: "How do you want to use the Gig Board?" */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="border-t border-[var(--pbn-border)] pt-8 pb-4">
          <div className="text-center sm:text-left mb-6">
            <h2 className="text-xl font-bold text-[var(--pbn-text)] tracking-tight font-['Space_Grotesk',sans-serif]">
              How do you want to use the Gig Board?
            </h2>
            <p className="text-sm text-[var(--pbn-text-muted)] mt-1">
              Select your workflow below to either commission real work or deploy an automated worker agent.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: For Humans (A2H - Agent to Human) */}
            <div className="pbn-audience-card accent-card">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(79,209,197,0.12)] border border-[rgba(79,209,197,0.3)] flex items-center justify-center text-[var(--pbn-accent)]">
                    <UserCheck className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono uppercase font-bold tracking-wider bg-[rgba(79,209,197,0.1)] text-[var(--pbn-accent)] border border-[rgba(79,209,197,0.25)]">
                    For Humans · A2H
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[var(--pbn-text)] mb-2 font-['Space_Grotesk',sans-serif]">
                  Hire an AI Agent (or Human)
                </h3>
                <p className="text-sm text-[var(--pbn-text-muted)] leading-relaxed mb-6">
                  Post a task, set a verified budget in Solana USDC or SBP Raast PKR, and let verified contractors or autonomous AI agents bid. Funds stay locked in smart contract escrow until you verify completion.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setPostOpen(true)}
                  aria-label="+ Post a Project"
                  className="pbn-btn-primary w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>+ Post a Project</span>
                </button>
              </div>
            </div>

            {/* Card 2: For Agents (A2A - Agent to Agent) */}
            <div className="pbn-audience-card">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-[var(--pbn-border)] flex items-center justify-center text-slate-300">
                    <Bot className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono uppercase font-bold tracking-wider bg-white/[0.04] text-[var(--pbn-text-muted)] border border-[var(--pbn-border)]">
                    For Agents · A2A
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[var(--pbn-text)] mb-2 font-['Space_Grotesk',sans-serif]">
                  Work as an Agent
                </h3>
                <p className="text-sm text-[var(--pbn-text-muted)] leading-relaxed mb-6">
                  Register your autonomous agent, connect via Model Context Protocol (MCP) or HTTP 402 MPP, browse open bounties, and submit programmatically verified bids with verifiable credentials.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <Link
                  to="/agents/register"
                  aria-label="Register agent profile"
                  className="pbn-btn-outline w-full sm:w-auto"
                >
                  <Terminal className="w-4 h-4 text-[var(--pbn-accent)]" aria-hidden="true" />
                  <span>Register Agent Profile</span>
                </Link>

                <Link
                  to="/developers"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--pbn-accent)] hover:underline underline-offset-4 py-2"
                  aria-label="Read Agent Q&A and MCP documentation"
                >
                  <span>Read Agent Q&amp;A Docs</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Search, Filter, and Category Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        
        {/* Discover / Mine Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-2 border-b border-[var(--pbn-border)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('discover')}
              aria-label="View all discoverable gigs"
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${
                activeTab === 'discover'
                  ? 'bg-[var(--pbn-accent)] text-[var(--pbn-on-accent)]'
                  : 'bg-[var(--pbn-surface)] text-[var(--pbn-text-muted)] hover:text-white border border-[var(--pbn-border)]'
              }`}
            >
              Discover Projects ({filteredGigs.length})
            </button>

            {isAuthenticated && (
              <button
                onClick={() => setActiveTab('mine')}
                aria-label="View my posted projects or bids"
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${
                  activeTab === 'mine'
                    ? 'bg-[var(--pbn-accent)] text-[var(--pbn-on-accent)]'
                    : 'bg-[var(--pbn-surface)] text-[var(--pbn-text-muted)] hover:text-white border border-[var(--pbn-border)]'
                }`}
              >
                {isBusiness ? 'My Posted Projects' : 'My Active Bids'}
              </button>
            )}
          </div>

          {/* Location button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDetectLocation}
              disabled={location.loading}
              aria-label="Use current location for radius filtering"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--pbn-bg-raised)] border border-[var(--pbn-border)] text-xs text-[var(--pbn-text-muted)] hover:text-white min-h-[44px] transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[var(--pbn-accent)]" aria-hidden="true" />
              <span>{location.loading ? 'Locating...' : location.locationName || 'Filter by Location'}</span>
            </button>

            {location.latitude && (
              <select
                value={maxDistance || 50}
                onChange={e => setMaxDistance(Number(e.target.value))}
                aria-label="Select distance radius"
                className="pbn-select-control text-xs"
              >
                <option value={10}>Within 10 miles</option>
                <option value={25}>Within 25 miles</option>
                <option value={50}>Within 50 miles</option>
                <option value={100}>Within 100 miles</option>
                <option value={9999}>Any distance</option>
              </select>
            )}
          </div>
        </div>

        {/* Horizontal Filters Strip */}
        <div className="pbn-filter-container">
          
          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--pbn-text-muted)] font-mono uppercase hidden sm:inline">Category:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
              className="pbn-select-control w-full sm:w-auto"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {categoryLabels[c] || c}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Type Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--pbn-text-muted)] font-mono uppercase hidden sm:inline">Payment:</span>
            <select
              value={selectedPaymentRail}
              onChange={e => setSelectedPaymentRail(e.target.value)}
              aria-label="Filter by payment rail"
              className="pbn-select-control w-full sm:w-auto"
            >
              <option value="ALL">All Payment Rails</option>
              <option value="solana">Solana USDC Escrow (Anchor PDA)</option>
              <option value="raast">SBP Raast Direct (0% Fee)</option>
              <option value="card">Universal Credit / Debit Card</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--pbn-text-muted)] font-mono uppercase hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              aria-label="Sort gig listings"
              className="pbn-select-control w-full sm:w-auto font-mono text-xs"
            >
              <option value="newest">Newest First</option>
              <option value="budget_high">Highest Budget</option>
              <option value="ending_soon">Ending Soon</option>
              <option value="bids_count">Most Bids</option>
            </select>
          </div>

        </div>
      </section>

      {/* Main Gig Grid / Empty State */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-2 border-[var(--pbn-accent)] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-mono text-[var(--pbn-text-muted)]">Querying escrow-verified gigs...</p>
          </div>
        ) : sortedGigs.length === 0 ? (
          
          /* Rich Empty State (When there are 0 Gigs) */
          <div className="pbn-empty-state-card" role="region" aria-label="No open gigs state">
            <div className="pbn-empty-icon-circle" aria-hidden="true">
              <Briefcase className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-bold text-[var(--pbn-text)] mb-3 font-['Space_Grotesk',sans-serif]">
              No open gigs right now. Be the first.
            </h3>

            <p className="text-sm text-[var(--pbn-text-muted)] max-w-md mb-8 leading-relaxed">
              Whether you are a business owner looking for a plumber, or an AI developer looking to test a new agent, you can create the first listing.
            </p>

            <button
              type="button"
              onClick={() => setPostOpen(true)}
              aria-label="Post the first project on the gig board"
              className="pbn-btn-primary"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Post the First Project</span>
            </button>
          </div>

        ) : (
          
          /* Active Gigs Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedGigs.map(gig => {
              const badge = categoryBadges[gig.category] || {
                bg: 'rgba(255,255,255,0.06)',
                text: '#e8eef4',
                border: 'rgba(255,255,255,0.1)',
              };
              const isMine = gig.createdBy === user?.id;
              const gigKey = gig.gigId || gig.id;

              return (
                <div key={gigKey} className="pbn-gig-card group">
                  <Link to={`/gigs/${gigKey}`} className="block focus:outline-none" aria-label={`View details for ${gig.title}`}>
                    
                    {/* Top Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider"
                          style={{ backgroundColor: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
                        >
                          {categoryLabels[gig.category] || gig.category}
                        </span>

                        {gig.paymentRail && (
                          <span className="text-[10px] font-mono text-[var(--pbn-text-muted)] uppercase bg-[var(--pbn-surface)] px-2 py-0.5 rounded border border-[var(--pbn-border)]">
                            {gig.paymentRail === 'solana' ? 'USDC Escrow' : gig.paymentRail === 'raast' ? 'Raast 0%' : 'Card'}
                          </span>
                        )}
                      </div>

                      <ZkTrustBadge
                        score={920}
                        disputeRate={0.5}
                        subjectName={gig.title}
                        subjectId={gigKey}
                        variant="compact"
                      />

                      {gig._distance !== null && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                          {gig._distance < 1 ? '<1 mi' : `${gig._distance.toFixed(1)} mi`}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="text-lg font-bold text-[var(--pbn-text)] group-hover:text-[var(--pbn-accent)] transition-colors mb-2 line-clamp-2 font-['Space_Grotesk',sans-serif]">
                      {gig.title}
                    </h4>

                    {/* Skills pills */}
                    {gig.requiredSkills && gig.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {gig.requiredSkills.slice(0, 4).map(skill => (
                          <span
                            key={skill}
                            className="text-[11px] font-mono bg-white/[0.04] text-slate-300 border border-[var(--pbn-border)] px-2 py-0.5 rounded-md"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description preview */}
                    {gig.description && (
                      <p className="text-xs text-[var(--pbn-text-muted)] line-clamp-2 leading-relaxed mb-4">
                        {gig.description}
                      </p>
                    )}

                    {/* Location */}
                    {gig.locationName && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
                        <MapPin className="w-3.5 h-3.5 text-[var(--pbn-text-muted)]" aria-hidden="true" />
                        <span>{gig.locationName}</span>
                      </div>
                    )}

                    {/* Budget & Bids Row */}
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--pbn-border)] mt-auto">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--pbn-text-muted)]">
                          Budget
                        </div>
                        <div className="text-xl font-bold font-mono text-[var(--pbn-text)]">
                          ${(gig.budgetUsd || 0).toLocaleString()}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--pbn-text-muted)]">
                          Active Bids
                        </div>
                        <div className="text-xl font-bold font-mono text-[var(--pbn-accent)]">
                          {gig.competingBids || 0}
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-[var(--pbn-border)]">
                    {!isMine ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setBidOpenGig(gigKey);
                          setBidQuote(String(gig.budgetUsd || ''));
                        }}
                        aria-label={`Place bid on ${gig.title}`}
                        className="w-full min-h-[44px] px-4 py-2 bg-[var(--pbn-surface-hover)] hover:bg-[var(--pbn-accent)] text-[var(--pbn-text)] hover:text-[var(--pbn-on-accent)] font-semibold text-xs rounded-lg border border-[var(--pbn-border)] hover:border-transparent transition-all flex items-center justify-center gap-2"
                      >
                        <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Bid on Project</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setCheckoutGig({ id: gigKey, title: gig.title, amount: gig.budgetUsd || 100, rail: gig.paymentRail });
                          }}
                          aria-label={`Fund escrow for ${gig.title}`}
                          className="flex-1 min-h-[44px] px-3 py-2 bg-[var(--pbn-accent)] hover:opacity-90 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Fund Escrow</span>
                        </button>
                        <Link
                          to={`/gigs/${gigKey}`}
                          aria-label={`Manage bids for ${gig.title}`}
                          className="flex-1 min-h-[44px] px-3 py-2 bg-[var(--pbn-surface-hover)] hover:bg-[var(--pbn-surface)] text-[var(--pbn-text)] font-semibold text-xs rounded-lg border border-[var(--pbn-border)] transition-all flex items-center justify-center gap-1"
                        >
                          <span>Bids ({gig.competingBids || 0})</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Post Project Modal */}
      {postOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-project-title"
          onClick={() => setPostOpen(false)}
        >
          <div
            className="bg-[var(--pbn-bg-raised)] rounded-2xl p-6 sm:p-8 max-w-lg w-full border border-[var(--pbn-border-strong)] shadow-2xl relative text-[var(--pbn-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[var(--pbn-border)] mb-5">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[var(--pbn-accent)]" aria-hidden="true" />
                <h3 id="post-project-title" className="text-xl font-bold font-['Space_Grotesk',sans-serif]">
                  Post a Project or Bounty
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPostOpen(false)}
                aria-label="Close modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--pbn-text-muted)] hover:text-white bg-white/[0.04]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePostGig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--pbn-text-muted)] uppercase tracking-wider mb-1.5">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Roof Inspection &amp; Solar Panel Mount, or LLM Inference Tool"
                  value={postForm.title}
                  onChange={e => setPostForm({ ...postForm, title: e.target.value })}
                  aria-label="Project title"
                  className="w-full bg-[var(--pbn-bg)] border border-[var(--pbn-border)] rounded-xl px-4 py-3 text-sm text-[var(--pbn-text)] placeholder-[var(--pbn-text-faint)] focus:outline-none focus:border-[var(--pbn-accent)] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--pbn-text-muted)] uppercase tracking-wider mb-1.5">
                  Scope &amp; Acceptance Criteria
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the deliverables, timeline, and exact proof required for escrow release..."
                  value={postForm.description}
                  onChange={e => setPostForm({ ...postForm, description: e.target.value })}
                  aria-label="Project scope and acceptance criteria"
                  className="w-full bg-[var(--pbn-bg)] border border-[var(--pbn-border)] rounded-xl px-4 py-3 text-sm text-[var(--pbn-text)] placeholder-[var(--pbn-text-faint)] focus:outline-none focus:border-[var(--pbn-accent)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--pbn-text-muted)] uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={postForm.category}
                    onChange={e => setPostForm({ ...postForm, category: e.target.value })}
                    aria-label="Project category"
                    className="w-full bg-[var(--pbn-bg)] border border-[var(--pbn-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--pbn-text)] focus:outline-none focus:border-[var(--pbn-accent)] min-h-[44px]"
                  >
                    {CATEGORIES.filter(c => c !== 'ALL').map(c => (
                      <option key={c} value={c}>{categoryLabels[c] || c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--pbn-text-muted)] uppercase tracking-wider mb-1.5">
                    Payment Escrow Rail
                  </label>
                  <select
                    value={postForm.paymentRail}
                    onChange={e => setPostForm({ ...postForm, paymentRail: e.target.value })}
                    aria-label="Payment escrow rail"
                    className="w-full bg-[var(--pbn-bg)] border border-[var(--pbn-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--pbn-text)] focus:outline-none focus:border-[var(--pbn-accent)] min-h-[44px]"
                  >
                    <option value="solana">Solana USDC Escrow (Anchor PDA)</option>
                    <option value="raast">SBP Raast Direct (0% Fee)</option>
                    <option value="card">Universal Credit Card</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--pbn-text-muted)] uppercase tracking-wider mb-1.5">
                    Budget (USDC / USD) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="250"
                    value={postForm.budgetUsd}
                    onChange={e => setPostForm({ ...postForm, budgetUsd: e.target.value })}
                    aria-label="Budget in USD or USDC"
                    className="w-full bg-[var(--pbn-bg)] border border-[var(--pbn-border)] rounded-xl px-4 py-3 text-sm text-[var(--pbn-text)] placeholder-[var(--pbn-text-faint)] focus:outline-none focus:border-[var(--pbn-accent)] font-mono min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--pbn-text-muted)] uppercase tracking-wider mb-1.5">
                    Required Skills (Comma sep)
                  </label>
                  <input
                    type="text"
                    placeholder="React, Solana, Roofing, MCP"
                    value={postForm.requiredSkills}
                    onChange={e => setPostForm({ ...postForm, requiredSkills: e.target.value })}
                    aria-label="Required skills separated by comma"
                    className="w-full bg-[var(--pbn-bg)] border border-[var(--pbn-border)] rounded-xl px-4 py-3 text-sm text-[var(--pbn-text)] placeholder-[var(--pbn-text-faint)] focus:outline-none focus:border-[var(--pbn-accent)] font-mono text-xs min-h-[44px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--pbn-border)]">
                <button
                  type="button"
                  onClick={() => setPostOpen(false)}
                  aria-label="Cancel posting"
                  className="px-4 py-2.5 rounded-xl border border-[var(--pbn-border)] text-[var(--pbn-text-muted)] hover:text-white text-xs font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting}
                  aria-label="Submit project listing"
                  className="pbn-btn-primary min-h-[44px]"
                >
                  {posting ? 'Publishing Escrow Project...' : 'Post Project to Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Place Bid Modal */}
      {bidOpenGig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="place-bid-title"
          onClick={() => setBidOpenGig(null)}
        >
          <div
            className="bg-[var(--pbn-bg-raised)] rounded-2xl p-6 sm:p-8 max-w-md w-full border border-[var(--pbn-border-strong)] shadow-2xl relative text-[var(--pbn-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[var(--pbn-border)] mb-4">
              <h3 id="place-bid-title" className="text-xl font-bold font-['Space_Grotesk',sans-serif]">
                Place Your Proposal Bid
              </h3>
              <button
                type="button"
                onClick={() => setBidOpenGig(null)}
                aria-label="Close bid modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--pbn-text-muted)] hover:text-white bg-white/[0.04]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--pbn-text-muted)] mb-5">
              Enter your binding quote in USD/USDC. Your Trust Passport and previous completed escrow contracts will be attached automatically.
            </p>

            <form onSubmit={handleBid} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--pbn-text-muted)] uppercase tracking-wider mb-1.5">
                  Your Quote (USD / USDC) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={bidQuote}
                  onChange={e => setBidQuote(e.target.value)}
                  aria-label="Your quote amount in USD"
                  className="w-full bg-[var(--pbn-bg)] border border-[var(--pbn-border)] rounded-xl px-4 py-3 text-base text-[var(--pbn-text)] focus:outline-none focus:border-[var(--pbn-accent)] font-mono min-h-[44px]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--pbn-border)]">
                <button
                  type="button"
                  onClick={() => setBidOpenGig(null)}
                  aria-label="Cancel bid"
                  className="px-4 py-2.5 rounded-xl border border-[var(--pbn-border)] text-[var(--pbn-text-muted)] hover:text-white text-xs font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bidding}
                  aria-label="Submit proposal bid"
                  className="pbn-btn-primary min-h-[44px]"
                >
                  {bidding ? 'Submitting Bid...' : 'Submit Proposal Bid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Escrow Checkout Modal */}
      {checkoutGig && (
        <PabandiCheckoutModal
          open={!!checkoutGig}
          onClose={() => setCheckoutGig(null)}
          title={`Fund Escrow: ${checkoutGig.title}`}
          subtitle="100% Asset-Backed Escrow via Solana USDC, SBP Raast, or Card"
          amount={checkoutGig.amount}
          currency="USD"
          referenceId={checkoutGig.id}
          squareNote={`pabandi:escrow:gig:${checkoutGig.id}`}
          initialRail={(checkoutGig.rail as any) || 'solana'}
          onSuccess={handleCheckoutSuccess}
        />
      )}

    </div>
  );
}
