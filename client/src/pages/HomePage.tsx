import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useQuery } from 'react-query';
import { businessService, liveSellerService } from '../services/api';
import HomeMap from '../components/HomeMap';
import { tokens } from '../design-system';

const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Default map center = Karachi, Pakistan (the product's home market). The map only
// uses this when there are zero businesses with valid coordinates; otherwise it
// centers on the centroid of the real businesses (see deriveMapCenter below).
const INITIAL_CENTER = { lat: 24.8607, lng: 67.0011 };

const isValidCoord = (lat?: number, lng?: number) =>
  typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

// Center the map on the real businesses instead of dumping everything on a hard-coded city.
function deriveMapCenter(items: { latitude?: number; longitude?: number }[]): { lat: number; lng: number } {
  const pts = items.filter((b) => isValidCoord(b.latitude, b.longitude));
  if (pts.length === 0) return INITIAL_CENTER;
  const lat = pts.reduce((s, b) => s + (b.latitude as number), 0) / pts.length;
  const lng = pts.reduce((s, b) => s + (b.longitude as number), 0) / pts.length;
  return { lat, lng };
}

export default function HomePage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('ALL');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(INITIAL_CENTER);
  const [selectedMapPlace, setSelectedMapPlace] = useState<{
    name: string;
    address?: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const revealRef1 = useScrollReveal<HTMLDivElement>();
  const revealRef2 = useScrollReveal<HTMLDivElement>();
  const revealRef3 = useScrollReveal<HTMLDivElement>();
  const revealRef4 = useScrollReveal<HTMLDivElement>();
  const revealRef5 = useScrollReveal<HTMLDivElement>();
  const revealRef6 = useScrollReveal<HTMLDivElement>();
  const revealRef7 = useScrollReveal<HTMLDivElement>();
  const revealRef8 = useScrollReveal<HTMLDivElement>();
  const revealRef9 = useScrollReveal<HTMLDivElement>();

  const [showOnboarding, setShowOnboarding] = useState(false);
  // NOTE: we no longer auto-prompt for location on load — the browser geolocation
  // prompt is intrusive. Users opt in explicitly via the "Near Me" button.
  useEffect(() => {
    // Intentionally empty: no automatic geolocation onboarding popup.
  }, []);

  const handleOnboardingLocation = () => {
    setShowOnboarding(false);
    sessionStorage.setItem('pabandi_location_onboarding_dismissed', '1');
    handleGetLocation();
  };

  const handleOnboardingDismiss = () => {
    setShowOnboarding(false);
    sessionStorage.setItem('pabandi_location_onboarding_dismissed', '1');
  };

  const { data: liveData } = useQuery(
    'live-sellers-home',
    () =>
      Promise.all([
        liveSellerService.getShowState('tiktok-live'),
        liveSellerService.getShowState('youtube-shopping'),
        liveSellerService.getShowState('shopify-live'),
      ]),
    { enabled: true, refetchInterval: 15000, retry: false },
  );
  const liveStates: Record<string, any> = {
    'tiktok-live': liveData?.[0]?.data?.data || {},
    'youtube-shopping': liveData?.[1]?.data?.data || {},
    'shopify-live': liveData?.[2]?.data?.data || {},
  };
  const activeLiveCount = Object.values(liveStates).filter((s) => s?.isLive).length;

  const getBusinessLiveState = (biz: any) => {
    if (!biz?.id) return null;
    const state = liveStates[biz.id];
    return state?.isLive ? state : null;
  };

  const { data, isLoading } = useQuery(
    ['businesses', category, userLoc, search],
    async () => {
      const params: any = {
        category: category !== 'ALL' ? category : undefined,
      };
      if (userLoc) {
        params.latitude = userLoc.lat;
        params.longitude = userLoc.lng;
      }
      if (search.trim().length) {
        params.search = search.trim();
      }
      const res = await businessService.getPublicBusinesses(params);
      return res.data?.data?.businesses || [];
    },
    { keepPreviousData: true },
  );

  const fallbackContext = useQuery(['businesses_fallback', 'ALL', null, ''], async () => {
    const res = await businessService.getPublicBusinesses({ category: 'ALL' });
    return res.data?.data?.businesses || [];
  }, { enabled: !!(!data || data.length === 0) });

  // Real AI freelancers / agents for the homepage discovery row.
  const { data: freelanceBiz = [] } = useQuery(['home-freelance'], async () => {
    const res = await businessService.getPublicBusinesses({ category: 'FREELANCE', limit: 12 });
    return res.data?.data?.businesses || [];
  });

  const source = fallbackContext.data && fallbackContext.data.length > 0 ? fallbackContext.data : (data || []);
  let businesses = source || [];
  businesses = rankBusinesses([...businesses], userLoc);

  // Recenter the map on the real businesses' centroid (only on first load, so user
  // panning isn't yanked back). Invalid/zero coords are skipped, not dumped on default.
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current) return;
    const center = deriveMapCenter(businesses);
    if (center.lat !== INITIAL_CENTER.lat || center.lng !== INITIAL_CENTER.lng) {
      setMapCenter(center);
      centeredRef.current = true;
    }
  }, [businesses]);

  const handleGetLocation = () => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      (err) => {
        console.error('Location access denied or failed', err);
        setLocLoading(false);
      },
    );
  };

  const handleSearch = useCallback(async () => {
    const q = search.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }, [search, navigate]);

  const handlePlaceSelect = useCallback(
    (place: { name: string; address?: string; lat: number; lng: number }) => {
      setMapCenter({ lat: place.lat, lng: place.lng });
      setSelectedMapPlace(place);
    },
    [],
  );

  const handleBookPlace = useCallback(
    (place: { name: string; address?: string; lat: number; lng: number }) => {
      navigate('/reservations/new', {
        state: {
          placeName: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
        },
      });
    },
    [navigate],
  );

  const cities = [
    { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
    { name: 'New York', lat: 40.7128, lng: -74.006 },
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
    { name: 'London', lat: 51.5074, lng: -0.1278 },
    { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  ];

  function rankBusinesses(items: any[], userLoc: { lat: number; lng: number } | null) {
    if (!items.length) return items;
    if (!userLoc) {
      return items.filter((it) => Number.isFinite(it.latitude) && Number.isFinite(it.longitude));
    }
    const scored = items
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
      .map((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        const distKm = getDistance(userLoc.lat, userLoc.lng, lat, lng);
        const distScore = Math.max(0, 100 - distKm * 2);
        const rating = Number(item.rating || 0);
        const ratingScore = Math.min(100, rating * 20);
        const reliability = Number(item.reliabilityScore || 0);
        const reliabilityScore = Math.min(100, reliability / 10);
        const score = distScore * 0.5 + ratingScore * 0.25 + reliabilityScore * 0.25;
        return { ...item, __score: score, __distanceKm: Number(distKm.toFixed(2)) };
      });
    return scored.sort((a, b) => b.__score - a.__score);
  }

  function getBusinessMatchLabel(biz: any) {
    const dist = biz.__distanceKm;
    if (dist < 1) return 'Few blocks away';
    if (dist < 5) return `${dist.toFixed(1)} km away`;
    if (dist < 20) return `${dist.toFixed(1)} km away`;
    return biz.city || 'Nearby';
  }

  const getCategoryLabel = (c: string) => {
    if (c === 'ALL') return 'All Categories';
    if (c === 'ECOMMERCE') return 'E-Commerce';
    if (c === 'MARKETPLACE') return 'Marketplace';
    if (c === 'LIVE_SELLER') return 'Live Seller';
    if (c === 'RESTAURANT') return 'Fine Dining';
    if (c === 'FITNESS_CENTER') return 'Fitness';
    return c.charAt(0) + c.slice(1).toLowerCase();
  };

  return (
    <div className="w-full pb-24 font-body md:pb-10" style={{ background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>

      {showOnboarding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/90 p-8 text-center shadow-2xl">
            <h2 className="mb-3 font-headline text-3xl font-black text-white">See what’s already nearby</h2>
            <p className="mb-6 text-sm leading-relaxed text-slate-300">
              Turn on location and we’ll show real nearby businesses inside your map — no searching required.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleOnboardingLocation} className="w-full rounded-xl bg-indigo-500 py-3.5 font-bold text-white shadow-lg">Use my location</button>
              <button onClick={handleOnboardingDismiss} className="w-full rounded-xl py-3 font-semibold text-slate-300 hover:text-white">Not now</button>
            </div>
          </div>
        </div>
      )}

      {/* IMMERSIVE HERO WITH MAP */}
      <section className="relative w-full border-b border-white/10 bg-[#0f172a] py-12 text-white md:py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-[#14F195] opacity-25 blur-[120px] mix-blend-multiply animate-blob animate-float-slow" />
          <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-[#06b6d4] opacity-20 blur-[120px] mix-blend-multiply animate-blob animate-float-delayed animation-delay-2000" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 xl:flex-row xl:gap-12 sm:px-6">
          {/* Left Col - Copy */}
          <div className="mx-auto max-w-2xl pt-6 xl:mx-0 xl:w-auto xl:min-w-[320px] xl:space-y-6">
            <h1 className="font-headline text-4xl font-black tracking-tight leading-[1.1] sm:text-5xl md:text-7xl stagger-item">
              The <span className="bg-gradient-to-r from-[#14F195] to-[#06b6d4] bg-clip-text text-transparent">universal trust engine</span><br />
              for commerce
            </h1>
            <p className="font-body max-w-xl text-base leading-relaxed text-slate-300 sm:text-xl stagger-item">
              AI-driven reliability scoring, automated escrow, and zero-training checkout. Built to secure transactions for hospitality, live sellers, and informal merchants worldwide.
            </p>

            {/* Search */}
            <div className="stagger-item px-1 pt-4">
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Find & Book Anywhere</p>
              <div className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-sm sm:gap-2 sm:px-4 sm:py-3">
                <span className="shrink-0 text-slate-300">🏢</span>
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  type="text"
                  placeholder="Where to?"
                  className="w-full border-none bg-transparent font-body text-base text-white outline-none focus:ring-0 sm:text-sm"
                />
                <button onClick={handleSearch} className="shrink-0 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white sm:px-3 sm:py-1.5 sm:text-xs">
                  Search
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleGetLocation}
                  disabled={locLoading}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold hover:bg-white/10 sm:px-3 sm:py-1.5 sm:text-sm"
                >
                  📍 {locLoading ? 'Locating...' : 'Near Me'}
                </button>
                {cities.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => navigate(`/search?q=${encodeURIComponent(city.name)}`)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold hover:bg-white/10 sm:px-3 sm:py-1.5 sm:text-sm"
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-6 text-xs font-bold uppercase tracking-widest text-slate-400 sm:gap-4 sm:text-sm stagger-item">
              <span className="flex items-center gap-1"><span className="text-[#14F195]">✓</span> Global</span>
              <span className="flex items-center gap-1"><span className="text-[#14F195]">✓</span> AI Protected</span>
              <span className="flex items-center gap-1"><span className="text-[#14F195]">✓</span> Earn $PAB</span>
              <Link to="/pricing" className="ml-2 rounded-lg bg-white/10 px-4 py-2 text-xs text-white transition-colors hover:bg-white/20">
                View Plans →
              </Link>
              <Link to="/usdy" className="rounded-lg bg-emerald-500/15 px-4 py-2 text-xs text-emerald-300 ring-1 ring-emerald-500/30 transition-colors hover:bg-emerald-500/25">
                USDY Yield →
              </Link>
            </div>

            {/* About Me */}
            <div className="mt-8 max-w-lg border-t border-white/5 pt-8 text-white delay-3 stagger-item">
              <h2 className="mb-2 font-headline text-lg font-bold text-indigo-300">Why I Built Pabandi</h2>
              <p className="max-w-prose text-sm leading-relaxed text-slate-300 mb-2">
                I spent 8 years as the "IT Guy" fixing systems for honest, hardworking people. But I realized the biggest problem they faced wasn't a broken computer—it was getting scammed, ghosted, and overcharged by the internet.
              </p>
              <Link to="/about" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                Read the full story →
              </Link>
            </div>
          </div>

         {/* Right Col - The Interactive Map */}
          <div
            className="relative h-[400px] w-full flex-1 sm:h-[500px] xl:h-[600px] rounded-3xl overflow-hidden stagger-item"
            style={{ animationDelay: '240ms' }}
          >
            <HomeMap
              center={mapCenter}
              selectedPlace={selectedMapPlace}
              userLocation={userLoc}
              places={businesses
                .slice(0, 8)
                .filter((b: any) => isValidCoord(b.latitude, b.longitude))
                .map((b: any) => {
                  const cityText = b.__distanceKm != null ? `${getBusinessMatchLabel(b)}` : (b.city || '');
                  return {
                    lat: b.latitude,
                    lng: b.longitude,
                    name: b.name,
                    subtitle: [cityText, b.description, b.category].filter(Boolean).join(' · '),
                  };
                })}
              onPlaceSelect={(place) =>
                handlePlaceSelect({
                  name: place.name || place.subtitle || 'Location',
                  address: place.subtitle,
                  lat: place.lat,
                  lng: place.lng,
                })
              }
            />

            {selectedMapPlace && (
              <div className="absolute bottom-8 left-1/2 z-10 mx-auto w-[90%] max-w-sm -translate-x-1/2 drop-shadow-2xl">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 pr-4">
                    <h3 className="font-headline text-xl font-bold leading-tight text-white">{selectedMapPlace.name}</h3>
                    <p className="mt-1 truncate text-sm font-medium text-slate-300">{selectedMapPlace.address}</p>
                  </div>
                  <button
                    onClick={() => setSelectedMapPlace(null)}
                    className="flex-shrink-0 rounded-full p-1.5 text-slate-300 transition-colors hover:bg-white/10"
                  >
                    ✕
                  </button>
                </div>
                <button
                  onClick={() => handleBookPlace(selectedMapPlace)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 py-3.5 font-bold text-white shadow-[0_8px_16px_rgba(20,241,149,0.2)] transition-all"
                >
                  Make Reservation →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories & Curated List */}
      <div className="mx-auto max-w-7xl mt-8 space-y-10 px-4 sm:px-6 sm:mt-12 sm:space-y-12 md:px-8">
        {/* Global Category Filters */}
        <section ref={revealRef1} className="reveal">
          <div className="scroll-smooth flex gap-3 overflow-x-auto pb-2 pt-4 no-scrollbar">
            {['ALL','RESTAURANT','SALON','CLINIC','SPA','FITNESS_CENTER','PROPERTY_RENTAL','LIVE_SELLER','FREELANCE'].map((c) => (
              <button
                key={c}
                onClick={() => {
                  if (c === 'LIVE_SELLER') {
                    navigate('/live-selling');
                    return;
                  }
                  if (c === 'FREELANCE') {
                    navigate(`/search?category=FREELANCE`);
                    return;
                  }
                  setCategory(c);
                }}
                className={`whitespace-nowrap px-2 py-2 font-label text-sm font-bold transition-colors touch-target shrink-0 sm:font-medium ${
                  category === c ? 'text-indigo-300 border-b-2 border-indigo-300' : 'text-slate-400 hover:text-white'
                } ${c === 'LIVE_SELLER' ? 'text-slate-100' : ''}`}
              >
                {c === 'LIVE_SELLER' ? '🎥 Live Seller' : c === 'FREELANCE' ? '💻 Freelance' : getCategoryLabel(c)}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:hidden">
            <span>↔</span> Swipe to explore
          </div>
        </section>

        {/* Search result chips */}
        {search.trim().length > 0 && (
          <div ref={revealRef5} className="flex flex-wrap gap-2 reveal">
            {businesses.slice(0, 6).map((biz: any) => (
              <button
                key={biz.id}
                onClick={() =>
                  handlePlaceSelect({
                    name: biz.name,
                    address: biz.address || biz.city,
                    lat: isValidCoord(biz.latitude, biz.longitude) ? biz.latitude : mapCenter.lat,
                    lng: isValidCoord(biz.latitude, biz.longitude) ? biz.longitude : mapCenter.lng,
                  })
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:px-3 sm:py-2 sm:text-xs touch-target"
              >
                {biz.name.replace(new RegExp(`(${search.trim()})`, 'gi'), '$1')}
                {biz.__distanceKm != null && (
                  <span className="ml-1 text-[10px] font-medium text-slate-400"> · {biz.__distanceKm.toFixed(1)} km</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Live Seller / Freelance connection prompts */}
        {(category === 'LIVE_SELLER' || category === 'FREELANCE') && (
          <section ref={category === 'LIVE_SELLER' ? revealRef6 : revealRef7} className="reveal py-6">
            {category === 'LIVE_SELLER' ? (
              <div>
                <h3 className="font-headline mb-2 text-xl font-bold text-white">Live selling on Pabandi</h3>
                <p className="mb-4 text-sm text-slate-300">Seller broadcasts live on TikTok, YouTube, or Shopify. Buyers book or buy instantly with deposit protection and $PAB rewards.</p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/live-selling" className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 font-headline text-sm font-bold text-white shadow-sm">Open Live Selling</Link>
                  <Link to="/live-sell" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10">Browse public hub</Link>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-headline mb-2 text-xl font-bold text-white">Freelance on Pabandi</h3>
                <p className="mb-4 text-sm text-slate-300">Import reputation from platforms you already use.</p>
                <div className="flex flex-wrap gap-3 sm:flex-row">
                  {['TikTok Live','YouTube Shopping','Shopify Live'].map((platform) => (
                    <Link key={platform} to="/live-selling" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-white/10 sm:py-2 touch-target">
                      {platform} ↗
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* USDY Yield — featured vertical strip */}
        <section ref={revealRef9} className="reveal py-6">
          <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-indigo-500/[0.04] p-6 sm:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300 border border-emerald-500/30">Pabandi × Ondo</span>
                  <span className="text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-400/15 px-2.5 py-1 text-amber-300 border border-amber-400/40">Coming Soon</span>
                </div>
                <h3 className="mt-3 font-headline text-xl font-bold text-white sm:text-2xl">Earn USDY Treasury Yield on Rent</h3>
                <p className="mt-1 max-w-xl text-sm text-slate-300">
                  Tokenized US Treasuries (Ondo USDY) as the yield rail for real-estate rent — non-custodial, Solana-anchored, 50/50 tenant/landlord split. Pre-register your portfolio.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Link to="/usdy" className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-emerald-950 transition-colors hover:bg-emerald-400">Explore USDY Yield →</Link>
                <Link to="/hospitality" className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10">Hospitality</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Businesses */}
        <section ref={revealRef2} className="space-y-6 reveal">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-2xl font-bold tracking-tight text-white">{userLoc ? 'Near You' : 'Curated for You'}</h3>
            <button
              onClick={handleGetLocation}
              disabled={locLoading}
              className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20"
            >
              📍 {locLoading ? 'Locating...' : 'Near Me'}
            </button>
          </div>

          {activeLiveCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#ff0050] opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff0050]" />
              </span>
              <span className="font-label text-[11px] font-bold text-white">Live now: {activeLiveCount} show{activeLiveCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : businesses.length === 0 ? (
            <div className="rounded-xl bg-white/5 py-12 text-center">
              <p className="font-body text-slate-300">No businesses found matching your criteria.</p>
              <button onClick={() => setCategory('ALL')} className="mt-4 font-bold text-indigo-300 hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              {businesses[0] && (
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  to={`/business/${businesses[0].id}`}
                  className="relative block md:col-span-8 group"
                >
                  <div className="h-80 overflow-hidden rounded-3xl shadow-lg">
                    <img
                      alt={businesses[0].name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      src={businesses[0].coverImageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200'}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-700/90 via-indigo-500/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 z-10 w-full p-6">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        {getCategoryLabel(businesses[0].category)}
                      </span>
                      <span className="flex items-center text-sm font-body text-white">
                        ⭐ {businesses[0].rating?.toFixed(1) || '4.9'}
                      </span>
                      {(() => {
                        const t = Math.max(0, Math.min(100, Math.round((businesses[0].trustScore ?? businesses[0].reliabilityScore ?? 0) / 10)));
                        const col = (businesses[0].isVerified || t >= 80) ? '#14F195' : t >= 50 ? '#fbbf24' : '#f87171';
                        return (
                          <span className="flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur" style={{ color: col, borderColor: `${col}55`, background: `${col}20` }}>
                            🛡 Trust {t}
                          </span>
                        );
                      })()}
                      {(businesses[0].isClaimed || getBusinessLiveState(businesses[0])) && (
                        <span className="flex items-center gap-1 rounded border border-[#14F195]/40 bg-[#14F195]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#14F195]">
                          {getBusinessLiveState(businesses[0]) && <><span className="h-1.5 w-1.5 rounded-full bg-[#14F195] animate-pulse" /> Live · </>}
                          Solana Protected
                        </span>
                      )}
                      {!businesses[0].isClaimed && !getBusinessLiveState(businesses[0]) && (
                        <span className="rounded border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          Unclaimed Listing
                        </span>
                      )}
                    </div>
                    <h4 className="mb-1 font-headline text-2xl font-bold text-white">{businesses[0].name}</h4>
                    <p className="max-w-md line-clamp-2 text-sm text-slate-300">
                      {businesses[0].description || `${businesses[0].city} • Discover our premium services.`}
                    </p>
                  </div>
                </Link>
              )}

              <div className="flex flex-col gap-6 md:col-span-4">
                {businesses[1] && (
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    to={`/business/${businesses[1].id}`}
                    className="group relative block min-h-[150px]"
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-3xl shadow-lg">
                      <img
                        alt={businesses[1].name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        src={businesses[1].coverImageUrl || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600'}
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute top-4 right-4 z-10">
                      {(businesses[1].isClaimed || getBusinessLiveState(businesses[1])) && (
                        <span className="flex items-center gap-1 rounded border border-[#14F195]/40 bg-[#14F195]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#14F195] backdrop-blur-md">
                          {getBusinessLiveState(businesses[1]) && <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#14F195]" /> Live</>}
                          {getBusinessLiveState(businesses[1]) && ' · '}
                          Solana
                        </span>
                      )}
                      {!businesses[1].isClaimed && !getBusinessLiveState(businesses[1]) && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 backdrop-blur-md">
                          Unclaimed
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 z-10 p-5">
                      <span className="mb-2 inline-block rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        {getCategoryLabel(businesses[1].category)}
                      </span>
                      <h4 className="font-headline text-lg font-bold text-white">{businesses[1].name}</h4>
                    </div>
                  </Link>
                )}

                {businesses.length > 2 && businesses[2] && (
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    to={`/business/${businesses[2].id}`}
                    className="flex flex-1 flex-col justify-center min-h-[150px] rounded-3xl border border-white/10 bg-white/5 p-5 transition-colors group"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h4 className="font-headline text-lg font-bold text-white">{businesses[2].name}</h4>
                      <div className="flex flex-col gap-2">
                        {(businesses[2].isClaimed || getBusinessLiveState(businesses[2])) && (
                          <span className="flex items-center gap-1 rounded border border-[#14F195]/30 bg-[#14F195]/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#10b981]">
                            {getBusinessLiveState(businesses[2]) && <><span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#14F195] animate-pulse align-middle" /> Live · </>}
                            Solana
                          </span>
                        )}
                        {!businesses[2].isClaimed && !getBusinessLiveState(businesses[2]) && (
                          <span className="rounded border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                            Unclaimed
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mb-4 line-clamp-2 text-sm text-slate-300">
                      {businesses[2].description || `${businesses[2].city} • Premium service with Pabandi.`}
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">
                        {getCategoryLabel(businesses[2].category)} • {businesses[2].city}
                      </span>
                      <span className="text-sm font-bold text-indigo-300 transition-transform group-hover:translate-x-1">
                        Book →
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Browse all CTA */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Real businesses, trust-scored and escrow-protected.</p>
          <Link to="/search?category=ALL" className="rounded-full bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition-colors">
            Browse all businesses →
          </Link>
        </div>

        {/* Featured AI Freelancers & Agents */}
        {freelanceBiz.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-2xl font-bold tracking-tight text-white">Featured AI Freelancers & Agents</h3>
              <Link to="/freelance" className="rounded-full bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition-colors">
                All freelancers →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {freelanceBiz.slice(0, 8).map((f: any) => {
                const t = Math.max(0, Math.min(100, Math.round((f.trustScore ?? f.reliabilityScore ?? 0) / 10)));
                const trustCol = (f.isVerified || t >= 80) ? '#14F195' : t >= 50 ? '#fbbf24' : '#f87171';
                const initials = ((f.name || 'AI')[0] || 'A');
                return (
                  <Link key={f.id} to={`/business/${f.id}`} className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-indigo-500/40 hover:bg-white/10">
                    <div className="flex items-center gap-3">
                      {f.logoUrl || f.coverImageUrl ? (
                        <img src={f.logoUrl || f.coverImageUrl} alt={f.name} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-sm font-black text-white">{initials}</div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-headline text-sm font-bold text-white">{f.name}</p>
                        <p className="truncate text-xs text-slate-400">{f.city || 'Remote'}</p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-300">{(f.description || 'Verified freelancer on Pabandi').slice(0, 80)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: trustCol, borderColor: `${trustCol}55`, background: `${trustCol}20` }}>🛡 Trust {t}</span>
                      <span className="text-[10px] text-slate-400">⭐ {f.rating?.toFixed(1) || '4.9'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* App Features / proof grid */}
        <section ref={revealRef3} className="space-y-6 reveal">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-white">Why book with Pabandi</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { title: 'Reliability-First Booking', body: 'No-shows hurt trust. Pabandi protects reliability with AI-based no-show prediction.', gradient: 'bg-gradient-to-br from-[#14F195] to-[#06b6d4]' },
              { title: 'Earn $PAB on Honored Appointments', body: 'Customers can earn rewards when they show up and honor their reservation.', gradient: 'bg-gradient-to-br from-[#f472b6] to-[#a855f7]' },
              { title: 'Global + Local Map Search', body: 'Discover venues with map-powered search, then book instantly.', gradient: 'bg-gradient-to-br from-[#fbbf24] to-[#f97316]' },
            ].map((item) => (
              <div key={item.title} className="py-4">
                <div className={`mb-6 h-12 w-12 rounded-full shadow-lg ${item.gradient}`} />
                <h4 className="mb-3 text-lg font-bold text-white">{item.title}</h4>
                <p className="max-w-sm text-sm leading-relaxed text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Escrow and trust preview */}
        <section ref={revealRef8} className="reveal">
          <div className="text-center mb-8">
            <h3 className="font-headline text-2xl font-bold tracking-tight text-white">Transaction protection built in</h3>
            <p className="mt-2 mb-4 text-sm text-slate-300">
              Bookings are protected with deposit escrow, verification, and real rewards for honored appointments.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/checkout" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 font-headline text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90">
                Open checkout
              </Link>
              <Link to="/how-it-works" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-headline text-sm font-bold text-white shadow-sm transition-colors hover:bg-white/10">
                How it works
              </Link>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section ref={revealRef4} className="reveal border-t border-white/5 pt-12 pb-24">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h3 className="mb-2 font-headline text-2xl font-black text-indigo-300">Join the Pabandi network</h3>
              <p className="max-w-xl text-sm text-slate-300">
                Salons, clinics, fitness studios, and restaurants are moving to Pabandi to protect their time, reduce no-shows, and reward loyal customers.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/freelance" className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-headline font-bold text-white shadow-sm transition-colors hover:bg-white/10">
                View Freelancers
              </Link>
              <Link to="/search" className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 font-headline font-bold text-white shadow-sm transition-opacity hover:opacity-90">
                Explore Businesses
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
