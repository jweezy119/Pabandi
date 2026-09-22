import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService, textSearchService } from '../services/api';
import { API_HOST } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Button, tokens, GlassCard } from '../design-system';
import PageHeader from '../components/PageHeader';

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
  'CLEANING',
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
  CLEANING: 'Cleaning',
  OTHER: 'Other',
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] p-4">
      <div className="h-36 rounded-t-2xl bg-[var(--warm-sand)] sm:h-40" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-[var(--warm-sand)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--warm-sand)]" />
        <div className="h-3 w-1/3 rounded bg-[var(--warm-sand)]" />
      </div>
      <div className="mt-4 h-10 rounded-xl bg-[var(--warm-sand)]" />
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
    accent: 'from-[var(--sage)]/20 to-[var(--sage)]/20',
  },
  {
    key: 'stays',
    label: 'Stays & Hospitality',
    href: '/hospitality',
    sub: 'Short-term rentals with escrow',
    icon: '📅',
    accent: 'from-[var(--sky-wash)]/20 to-[var(--dusty-rose)]/20',
  },
  {
    key: 'freelance',
    label: 'Freelance',
    href: '/search?category=FREELANCE',
    sub: 'Designers · Coders · Creators',
    icon: '⭐',
    accent: 'from-[var(--muted-ochre)]/20 to-[var(--muted-ochre)]/20',
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
  const dLat = toRad(b.lat! - a.lat);
  const dLng = toRad(b.lng! - a.lng);
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

  // NOTE: We do NOT auto-prompt for geolocation on load — that forces a browser
  // permission dialog the user didn't ask for. Location is opt-in via the UI button.
  // userLoc stays null until the user explicitly shares it, and search still works.

  const { data, isLoading } = useQuery(
    ['search', q, category, userLoc],
    async () => {
      const params: Record<string, string> = {};
      if (q && q.trim().length > 0) params.search = q.trim();
      if (category && category !== 'ALL') params.category = category;
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
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3500);
          const profilesJson = await fetch(`${API_HOST}/api/v1/linkedin/seed/profiles?category=${encodeURIComponent(category === 'ALL' ? '' : category.toLowerCase())}`, { signal: controller.signal });
          clearTimeout(timeout);
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
        <PageHeader
          title="Search"
          description="Find verified businesses and services nearby. Every listing is tied to a Pabandi Passport trust score and secure booking flow."
          eyebrow="Discover"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {QUICK_PROMPTS.map((prompt) => (
            <Link
              key={prompt.key}
              to={prompt.href}
              className={`flex items-center gap-3 rounded-2xl border border-[rgba(191,179,163,0.2)] bg-gradient-to-br ${prompt.accent} p-3 active:scale-[0.99] transition-all sm:p-4`}
            >
              <span className="shrink-0 text-lg sm:text-xl">{prompt.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold sm:text-base">{prompt.label}</span>
                <span className="block truncate text-[10px] text-[var(--warm-ink)] sm:text-xs">{prompt.sub}</span>
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
            className="w-full rounded-2xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] p-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)] sm:p-4"
          />
          {showDropdown && currentSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[rgba(191,179,163,0.2)] bg-[var(--cream)]/90 shadow-xl">
              {currentSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion}-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const match = recommendations.find((r) => r.label === suggestion);
                    applyQuery(match?.value === 'ALL' ? '' : match?.label || suggestion);
                  }}
                  className="w-full text-left px-4 py-3 text-left text-sm font-bold text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]"
                >
                  <span className="mr-2 text-[var(--clay)]">🔎</span>
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
                  category === c ? 'bg-[var(--clay)] text-[var(--warm-ink)] shadow-lg shadow-[var(--clay)]/20' : 'bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]'
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
            className="rounded-2xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] px-4 py-2 text-xs font-bold hover:bg-[var(--warm-sand)] touch-target"
          >
            Near Me
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--warm-ink)] sm:text-sm">
            {isLoading ? 'Searching…' : results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Showing fallback results.'}
          </span>
          {q.trim() && (
            <button
              type="button"
              onClick={() => applyQuery('')}
              className="text-xs font-bold text-[var(--clay)]"
            >
              Clear search
            </button>
          )}
        </div>

        {results.length === 0 && !isLoading && (
          <div className="rounded-3xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] p-8 text-center">
            <div className="mx-auto mb-2 text-3xl">🔍</div>
            <p className="text-sm font-medium text-[var(--warm-ink)]">
              No exact hits for “{q.trim() || CATEGORY_LABELS[category]}” yet — but great businesses are joining daily.
            </p>
            <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
              <Link to="/search?category=ALL" className="rounded-xl bg-[var(--clay)] px-5 py-2.5 text-sm font-bold text-[var(--warm-ink)]">Browse all businesses</Link>
              <Link to="/business/join" className="rounded-xl border border-[rgba(191,179,163,0.25)] px-5 py-2.5 text-center text-sm font-bold text-[var(--warm-ink)]">List a business</Link>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {['RESTAURANT','SALON','CLINIC','FITNESS_CENTER','PROPERTY_RENTAL','FREELANCE'].map((c) => (
                <button key={c} onClick={() => applyCategory(c)} className="rounded-full bg-[var(--warm-sand)] px-3 py-1.5 text-[11px] font-bold text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">
                  {CATEGORY_LABELS[c] || c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={`skeleton-${idx}`} />)}
          {results.map((biz: any) => {
            const trustRaw = biz.trustScore ?? biz.reliabilityScore ?? 0;
            const trust = Math.max(0, Math.min(100, Math.round(trustRaw / 10)));
            const deposit = trust >= 80 ? 0 : trust >= 50 ? 5 : 15;
            const isVerified = biz.isVerified || trust >= 80;
            const trustColor = isVerified ? 'var(--sage)' : trust >= 50 ? 'var(--muted-ochre)' : '#f87171';
            return (
            <GlassCard key={biz.id || `${biz.name}-${biz.address}`} className="flex flex-col overflow-hidden">
              <Link to={`/business/${biz.id}`} className="block">
                <div
                  className="relative h-40 rounded-t-2xl sm:h-44"
                  style={{
                    backgroundImage: biz.coverImageUrl ? `url(${biz.coverImageUrl})` : undefined,
                    backgroundColor: biz.coverImageUrl ? undefined : undefined,
                  }}
                >
                  {!biz.coverImageUrl && (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--clay)]/20 via-slate-800 to-[var(--sage)]/10 text-4xl">
                      {CATEGORY_LABELS[biz.category]?.[0] || '🏢'}
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[var(--warm-ink)]/55 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--warm-ink)] backdrop-blur">
                      {CATEGORY_LABELS[biz.category] || biz.category}
                    </span>
                    {isVerified && (
                      <span className="rounded-full bg-[var(--sage)]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--sage)] backdrop-blur border border-[var(--sage)]/40">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <div className="absolute right-3 top-3">
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black backdrop-blur"
                      style={{ background: `${trustColor}20`, color: trustColor, border: `1px solid ${trustColor}40` }}
                      title="Pabandi Trust Score"
                    >
                      🛡 {trust}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold leading-snug text-[var(--warm-ink)]">{biz.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--warm-ink)]">{biz.city || ''}{biz.address ? ` · ${biz.address}` : ''}</p>
                    </div>
                    {typeof biz.rating === 'number' && (
                      <p className="shrink-0 text-[11px] font-bold text-[var(--muted-ochre)]">★ {biz.rating.toFixed(1)}{biz.reviewCount ? ` (${biz.reviewCount})` : ''}</p>
                    )}
                  </div>
                  {biz.description && <p className="mt-2 line-clamp-2 text-xs text-[var(--warm-ink)]">{biz.description}</p>}
                  <p className="mt-2 text-[11px] font-medium text-[var(--soft-stone)]">
                    {isVerified ? 'Trust-verified · ' : `$${deposit} deposit protects you · `}escrow-backed booking
                  </p>
                </div>
              </Link>
              <div className="mt-auto px-4 pb-4">
                <Button onClick={() => handleBookNow(biz)} className="w-full py-3 text-sm font-bold">
                  {isAuthenticated ? 'Book now' : 'Log in to book'}
                </Button>
              </div>
            </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
