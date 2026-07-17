import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService, textSearchService } from '../services/api';

type Business = {
  id: string;
  name: string;
  category: string;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number;
  description?: string | null;
  coverImageUrl?: string | null;
};

const CATEGORIES = [
  'ALL',
  'RESTAURANT',
  'SALON',
  'CLINIC',
  'SPA',
  'FITNESS_CENTER',
  'PROPERTY_RENTAL',
  'LIVE_SELLER',
  'FREELANCE',
  'OTHER',
];

const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'All',
  RESTAURANT: 'Restaurants',
  SALON: 'Salons',
  CLINIC: 'Clinics',
  SPA: 'Spas',
  FITNESS_CENTER: 'Fitness',
  PROPERTY_RENTAL: 'Short-term rental',
  LIVE_SELLER: 'Live Seller',
  FREELANCE: 'Freelance',
  OTHER: 'Other',
};

const QUICK_PROMPTS = [
  {
    key: 'live',
    label: 'Live Selling',
    href: '/live-sell',
    sub: 'TikTok · YouTube · Shopify',
    icon: '🎥',
  },
  {
    key: 'freelance',
    label: 'Freelance',
    href: '/search?category=FREELANCE',
    sub: 'Designers · Coders · Creators',
    icon: '🧑‍💻',
  },
];

function buildSearchSuggestions(rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) return [];
  const map: Record<string, string> = {
    food: 'RESTAURANT',
    restaurant: 'RESTAURANT',
    eat: 'RESTAURANT',
    cafe: 'RESTAURANT',
    coffee: 'RESTAURANT',
    salon: 'SALON',
    hair: 'SALON',
    barber: 'SALON',
    clinic: 'CLINIC',
    doctor: 'CLINIC',
    spa: 'SPA',
    massage: 'SPA',
    gym: 'FITNESS_CENTER',
    fitness: 'FITNESS_CENTER',
    yoga: 'FITNESS_CENTER',
    live: 'LIVE_SELLER',
    stream: 'LIVE_SELLER',
    shopify: 'LIVE_SELLER',
    tiktok: 'LIVE_SELLER',
    freelance: 'FREELANCE',
    freelancer: 'FREELANCE',
    designer: 'FREELANCE',
    developer: 'FREELANCE',
    photographer: 'FREELANCE',
    tutor: 'FREELANCE',
    rental: 'PROPERTY_RENTAL',
    airbnb: 'PROPERTY_RENTAL',
    stay: 'PROPERTY_RENTAL',
  };
  const seen = new Set<string>();
  const out: { label: string; value: string }[] = [];
  const lower = query.toLowerCase();
  const add = (label: string, value: string) => {
    if (!seen.has(label + value)) {
      seen.add(label + value);
      out.push({ label, value });
    }
  };
  for (const k of Object.keys(map)) {
    if (lower.includes(k)) add(CATEGORY_LABELS[map[k]] || map[k], map[k]);
  }
  add('Search all', 'ALL');
  return out.slice(0, 5);
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat?: number | null; lng?: number | null }
) {
  if (typeof a.lat !== 'number' || typeof a.lng !== 'number' || typeof b.lat !== 'number' || typeof b.lng !== 'number') return Infinity;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialCategory = (searchParams.get('category') || 'ALL') as string;

  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [queryDraft, setQueryDraft] = useState(initialQ);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const p = searchParams.get('category');
    if (p) setCategory(p);
  }, [searchParams]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLoc({ lat: 41.8781, lng: -87.6298 }),
        { timeout: 5000 }
      );
    }
  }, []);

  const { data, isLoading } = useQuery(
    ['search', q, category, userLoc],
    async () => {
      const params: Record<string, string> = { search: q || 'local businesses near me', category };
      if (userLoc) {
        params.latitude = String(userLoc.lat);
        params.longitude = String(userLoc.lng);
      }
      const res = await businessService.getPublicBusinesses(params);
      const items = (res?.data?.data?.businesses || []) as Business[];
      const seen = new Set<string>();
      const deduped: Business[] = [];
      for (const b of items) {
        const key = b.id || `${b.name}-${b.address || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(b);
      }
      return deduped;
    },
    { keepPreviousData: true }
  );

  const qwenSource = useQuery(['text-search-suggestions', q], async () => {
    const query = String(q || '');
    if (!query || query.length < 2) return [];
    const res = await textSearchService.getSuggestions(query);
    return ((res?.data?.data?.suggestions as string[]) || []).slice(0, 6);
  }, { enabled: q.trim().length >= 2 });

  const recommendations = useMemo(() => buildSearchSuggestions(q), [q]);
  const currentSuggestions = useMemo(() => {
    const fromWen = qwenSource.data || [];
    if (fromWen.length) return fromWen;
    return recommendations.map((r) => r.label);
  }, [qwenSource.data, recommendations]);

  const results = useMemo(() => {
    const base = data || [];
    if (!userLoc) return base;
    return base
      .map((b) => ({ b, meters: haversineKm(userLoc, { lat: b.latitude ?? null, lng: b.longitude ?? null }) * 1000 }))
      .sort((a, b) => a.meters - b.meters)
      .map((x) => x.b);
  }, [data, userLoc]);

  const distanceLabel = (b: Business) => {
    if (!userLoc) return '';
    const m = haversineKm(userLoc, { lat: b.latitude ?? null, lng: b.longitude ?? null }) * 1000;
    if (!Number.isFinite(m)) return '';
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
  };

  const pageTitle = useMemo(() => {
    if (category === 'LIVE_SELLER') return 'Live Selling';
    if (category === 'FREELANCE') return 'Freelance';
    if (category === 'PROPERTY_RENTAL') return 'Short-term rentals';
    if (q.trim()) return `Results for "${q.trim()}"`;
    if (category !== 'ALL') return CATEGORY_LABELS[category] || category;
    return 'Search';
  }, [q, category]);

  useEffect(() => {
    document.title = `${pageTitle} · Pabandi`;
  }, [pageTitle]);

  const applyQuery = (next: string) => {
    setQ(next);
    setQueryDraft(next);
    setShowDropdown(false);
    setSearchParams({ q: next, category }, { replace: true });
    setShowDropdown(false);
  };

  const applyCategory = (next: string) => {
    setCategory(next);
    setSearchParams({ q: q || '', category: next }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline text-2xl sm:text-3xl font-black">Find trusted services near you</h1>
          <p className="text-sm text-on-surface-variant">
            Start broad, then filter by category. Tap a suggestion or press enter to search.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUICK_PROMPTS.map((prompt) => (
          <Link
            key={prompt.key}
            to={prompt.href}
            className="flex items-center gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-3 sm:p-4 active:scale-[0.99] transition-all"
          >
            <span className="text-xl sm:text-2xl leading-none">{prompt.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm sm:text-base font-headline font-bold">{prompt.label}</span>
              <span className="block text-[10px] sm:text-xs text-on-surface-variant truncate">{prompt.sub}</span>
            </span>
          </Link>
          ))}
        </div>

        <div className="relative">
          <input
            value={queryDraft}
            onChange={(e) => {
              setQueryDraft(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (q.trim().length || queryDraft.trim().length) setShowDropdown(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowDropdown(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyQuery(queryDraft);
              }
            }}
            placeholder="Search services, businesses..."
            className="w-full p-3 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {showDropdown && currentSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-outline-variant/20 bg-surface shadow-xl shadow-black/40 z-30 overflow-hidden">
              {currentSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion}-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const match = recommendations.find((r) => r.label === suggestion);
                    applyQuery(match?.value === 'ALL' ? '' : match?.label || suggestion);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-high"
                >
                  <span className="text-primary mr-2">🔎</span>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => applyCategory(c)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  category === c ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {CATEGORY_LABELS[c] || c}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => {}
                );
              }
            }}
            className="px-4 py-2 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs font-bold hover:bg-surface-container-high"
          >
            Near Me
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-on-surface-variant">
            {isLoading ? 'Searching…' : results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Showing fallback results.'}
          </span>
          {q.trim() && (
            <button
              type="button"
              onClick={() => applyQuery('')}
              className="text-xs font-bold text-primary"
            >
              Clear search
            </button>
          )}
        </div>

        {results.length === 0 && !isLoading && (
          <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-low p-8 text-center">
            <p className="text-sm text-on-surface-variant">No exact hits yet. We’re still loading nearby options.</p>
            <button onClick={() => applyCategory('ALL')} className="mt-3 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold">Browse all listings</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((biz: any) => (
            <Link
              key={biz.id || `${biz.name}-${biz.address}`}
              to={`/business/${biz.id}`}
              className="block rounded-3xl border border-outline-variant/10 bg-surface-container-low hover:bg-surface-container-high active:scale-[0.99] transition-all"
            >
              <div
                className="h-36 sm:h-40 rounded-t-3xl"
                style={{
                  backgroundImage: biz.coverImageUrl ? `url(${biz.coverImageUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-headline font-bold text-sm leading-snug">{biz.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">{biz.city || ''}{biz.address ? ` · ${biz.address}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-1 rounded">{biz.category}</p>
                    {typeof biz.rating === 'number' && (
                      <p className="text-[10px] font-bold text-on-surface-variant mt-1">{biz.rating.toFixed(1)} ★ {biz.reviewCount || 0}</p>
                    )}
                    {distanceLabel(biz) && <p className="text-[10px] font-bold text-on-surface-variant mt-1">{distanceLabel(biz)}</p>}
                  </div>
                </div>
                {biz.description && <p className="text-xs text-on-surface-variant line-clamp-2 mt-2">{biz.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
