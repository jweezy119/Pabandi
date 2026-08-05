import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService, textSearchService } from '../services/api';
import { API_HOST } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Surface, Button, tokens } from '../design-system';

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
  ALL: 'For you',
  RESTAURANT: 'Restaurants',
  SALON: 'Salons',
  CLINIC: 'Clinics',
  SPA: 'Spas',
  FITNESS_CENTER: 'Fitness',
  PROPERTY_RENTAL: 'Stays',
  LIVE_SELLER: 'Live selling',
  FREELANCE: 'Freelance',
  OTHER: 'Other',
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="h-36 rounded-t-2xl bg-white/10 sm:h-40" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="h-3 w-1/2 rounded bg-white/10" />
        <div className="h-3 w-1/3 rounded bg-white/10" />
      </div>
      <div className="mt-4 h-10 rounded-xl bg-white/10" />
    </div>
  );
}

function mapProfileCategoryToBiz(category?: string): string {
  switch (category) {
    case 'freelance-dev':
      return 'FREELANCE';
    case 'small-biz-owner':
    case 'project-owner':
    case 'solopreneur':
      return 'OTHER';
    default:
      return 'OTHER';
  }
}

const QUICK_PROMPTS = [
  {
    key: 'live',
    label: 'Live Selling',
    href: '/live-sell',
    sub: 'TikTok · YouTube · Shopify',
    icon: '🎥',
    accent: 'from-emerald-500/20 to-green-500/20',
  },
  {
    key: 'stays',
    label: 'Stays & Hospitality',
    href: '/hospitality',
    sub: 'Short-term rentals with escrow',
    icon: '📅',
    accent: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    key: 'freelance',
    label: 'Freelance',
    href: '/search?category=FREELANCE',
    sub: 'Designers · Coders · Creators',
    icon: '⭐',
    accent: 'from-orange-500/20 to-amber-500/20',
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
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    const p = searchParams.get('category');
    if (p) setCategory(p);
  }, [searchParams]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLoc({ lat: 24.8607, lng: 67.0011 }),
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

      // Merge seeded profiles as discoverable providers when search is active
      const profilesQuery = String(q || '').trim();
      if (profilesQuery.length >= 2) {
        try {
          const profilesJson = await fetch(`${API_HOST}/api/v1/linkedin/seed/profiles?category=${encodeURIComponent(category === 'ALL' ? '' : category.toLowerCase())}`);
          const profilesJsonParsed = await profilesJson.json();
          const profiles = (profilesJsonParsed?.data?.profiles || []) as any[];
          const matched = profiles.filter((p) => {
            const hay = `${p.firstName} ${p.lastName} ${p.headline} ${p.company} ${p.location}`.toLowerCase();
            return hay.includes(profilesQuery.toLowerCase());
          });
          for (const p of matched) {
            const bizLike: Business = {
              id: `profile-${p.linkedinId}`,
              name: `${p.firstName} ${p.lastName}`,
              category: mapProfileCategoryToBiz(p.category),
              city: p.location || '',
              address: p.company || '',
              description: p.headline || '',
              coverImageUrl: p.githubUrl ? `https://github.com/${p.githubUrl.split('/').pop()}.png` : null,
              latitude: null,
              longitude: null,
              rating: null,
              reviewCount: p.connectionCount || null,
            };
            const key = bizLike.id;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(bizLike);
            }
          }
        } catch (e) {
          // ignore profile merge errors
        }
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
    const fromSource = qwenSource.data || [];
    if (fromSource.length) return fromSource;
    return recommendations.map((r) => r.label);
  }, [qwenSource.data, recommendations]);

  const results = useMemo(() => {
    const base = data || [];
    if (!q.trim() || !userLoc) return base;
    return base
      .map((b) => ({ b, meters: haversineKm(userLoc, { lat: b.latitude ?? null, lng: b.longitude ?? null }) * 1000 }))
      .sort((a, b) => a.meters - b.meters)
      .map((x) => x.b);
  }, [data, userLoc, q]);

  const distanceLabel = (b: Business) => {
    if (!userLoc || !q.trim()) return '';
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
    return 'Discover';
  }, [q, category]);

  useEffect(() => {
    document.title = `${pageTitle} · Pabandi`;
  }, [pageTitle]);

  const applyQuery = (next: string) => {
    setQ(next);
    setQueryDraft(next);
    setShowDropdown(false);
    setSearchParams({ q: next, category }, { replace: true });
  };

  const applyCategory = (next: string) => {
    setCategory(next);
    setSearchParams({ q: q || '', category: next }, { replace: true });
  };

  const handleBookNow = (biz: Business) => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/business/${biz.id}/book`)}`);
      return;
    }
    navigate(`/business/${biz.id}/book`);
  };

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline text-2xl font-black sm:text-3xl">What do you want to book?</h1>
          <p className="text-sm text-slate-300">
            Quick actions, smart suggestions, and trusted venues nearby.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {QUICK_PROMPTS.map((prompt) => (
            <Link
              key={prompt.key}
              to={prompt.href}
              className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br ${prompt.accent} p-3 active:scale-[0.99] transition-all sm:p-4`}
            >
              <span className="shrink-0 text-lg sm:text-xl">{prompt.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold sm:text-base">{prompt.label}</span>
                <span className="block truncate text-[10px] text-slate-300 sm:text-xs">{prompt.sub}</span>
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
            className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-indigo-400 sm:p-4"
          />
          {showDropdown && currentSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-xl">
              {currentSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion}-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const match = recommendations.find((r) => r.label === suggestion);
                    applyQuery(match?.value === 'ALL' ? '' : match?.label || suggestion);
                  }}
                  className="w-full text-left px-4 py-3 text-left text-sm font-bold text-white hover:bg-white/10"
                >
                  <span className="mr-2 text-indigo-300">🔎</span>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => applyCategory(c)}
                className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors touch-target ${
                  category === c ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-white hover:bg-white/10'
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
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold hover:bg-white/10 touch-target"
          >
            Near Me
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 sm:text-sm">
            {isLoading ? 'Searching…' : results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Showing fallback results.'}
          </span>
          {q.trim() && (
            <button
              type="button"
              onClick={() => applyQuery('')}
              className="text-xs font-bold text-indigo-300"
            >
              Clear search
            </button>
          )}
        </div>

        {results.length === 0 && !isLoading && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="mx-auto mb-2 text-3xl">🔍</div>
            <p className="text-sm font-medium text-slate-300">
              No exact hits yet in this area.
            </p>
            <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
              <button onClick={() => applyCategory('ALL')} className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white">Browse all listings</button>
              <Link to="/business/join" className="rounded-xl border border-white/15 px-5 py-2.5 text-center text-sm font-bold text-white">Recommend a business</Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={`skeleton-${idx}`} />)}
          {results.map((biz: any) => (
            <Surface key={biz.id || `${biz.name}-${biz.address}`} className="flex flex-col transition-transform duration-200 hover:-translate-y-[3px] hover:shadow-2xl hover:shadow-indigo-500/10">
              <Link to={`/business/${biz.id}`} className="block">
                <div
                  className="h-36 rounded-t-2xl sm:h-40"
                  style={{
                    backgroundImage: biz.coverImageUrl ? `url(${biz.coverImageUrl})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold leading-snug text-white">{biz.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-300">{biz.city || ''}{biz.address ? ` · ${biz.address}` : ''}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="rounded bg-indigo-500/10 px-1.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-200">{CATEGORY_LABELS[biz.category] || biz.category}</p>
                      {typeof biz.rating === 'number' && (
                        <p className="mt-1 text-[10px] font-bold text-slate-300">{biz.rating.toFixed(1)} ★ {biz.reviewCount || 0}</p>
                      )}
                      {distanceLabel(biz) && <p className="mt-1 text-[10px] font-bold text-slate-300">{distanceLabel(biz)}</p>}
                    </div>
                  </div>
                  {biz.description && <p className="mt-2 line-clamp-2 text-xs text-slate-300">{biz.description}</p>}
                </div>
              </Link>
              <div className="px-4 pb-4">
                <Button onClick={() => handleBookNow(biz)} className="w-full py-3 text-sm font-bold">
                  {isAuthenticated ? 'Book now' : 'Log in to book'}
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      </div>
    </div>
  );
}
