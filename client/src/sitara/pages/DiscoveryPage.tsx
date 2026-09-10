// Sitara OS — Discovery Page
// Yelp-style discovery: search, filter, sort, shelves.
// Stars = exposure: higher verified ratings rank higher, free promo for
// businesses that earn them. (PAB linkage comes later — no mechanism now.)

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';
import DiscoveryMap from '../components/DiscoveryMap';

const categories = [
  { id: 'restaurant', label: 'Restaurants', icon: '🍽️' },
  { id: 'salon', label: 'Salons', icon: '💇' },
  { id: 'spa', label: 'Spas', icon: '🧖' },
  { id: 'nightlife', label: 'Nightlife', icon: '🍸' },
  { id: 'apartment', label: 'Apartments', icon: '🏢' },
  { id: 'hotel', label: 'Hotels', icon: '🏨' },
];

const mockBusinesses = [
  { id: '1', name: 'The Golden Fork', category: 'restaurant', rating: 4.8, stars: 124, image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400', price: '$$' },
  { id: '2', name: 'Bella Salon', category: 'salon', rating: 4.9, stars: 89, image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400', price: '$$' },
  { id: '3', name: 'Serenity Spa', category: 'spa', rating: 4.7, stars: 56, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400', price: '$$$' },
  { id: '4', name: 'Skyline Lounge', category: 'nightlife', rating: 4.6, stars: 203, image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400', price: '$$$' },
  { id: '5', name: 'CozyNest Rentals', category: 'apartment', rating: 4.5, stars: 42, image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', price: '$$' },
  { id: '6', name: 'Grand Hotel', category: 'hotel', rating: 4.8, stars: 312, image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400', price: '$$$$' },
];

interface BizCard {
  id: string;
  source: string;
  name: string;
  category: string;
  rating: number;
  stars: number;
  image: string;
  price: string;
  address?: string;
  isOpenNow?: boolean;
  lat?: number;
  lng?: number;
  real: boolean;
}

type SortMode = 'recommended' | 'rating' | 'reviewed';

const FALLBACK_CARDS: BizCard[] = mockBusinesses.map((b) => ({ ...b, source: 'osm', real: false }));

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500 tracking-tight" aria-label={`${value} stars`}>
      {'★'.repeat(Math.round(value))}
      <span className="text-slate-300">{'★'.repeat(Math.max(0, 5 - Math.round(value)))}</span>
    </span>
  );
}

export default function DiscoveryPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recommended');
  const [openNow, setOpenNow] = useState(false);
  const [cards, setCards] = useState<BizCard[]>(FALLBACK_CARDS);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          loadRealBusinesses({ ...loc });
        },
        () => setLoading(false)
      );
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRealBusinesses(opts: { lat: number; lng: number; category?: string | null; q?: string }) {
    try {
      const data = await sitaraApi.discover({
        lat: opts.lat,
        lng: opts.lng,
        radius: 5000,
        limit: 20,
        category: opts.category || selectedCategory || undefined,
        q: opts.q || undefined,
      });
      if (Array.isArray(data) && data.length > 0) {
        setCards(
          data.map((b: any) => ({
            id: String(b.id),
            source: b.sources?.[0] || b.source || 'foursquare',
            name: b.name || 'Unnamed venue',
            category: String(b.category || 'restaurant').toLowerCase(),
            rating: Number(b.rating ?? 4.0),
            stars: Number(b.reviewCount ?? 0),
            image: b.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
            price: b.price || '$$',
            address: b.address,
            isOpenNow: b.isOpenNow,
            lat: b.lat != null ? Number(b.lat) : undefined,
            lng: b.lng != null ? Number(b.lng) : undefined,
            real: true,
          }))
        );
      }
    } catch (err) {
      console.warn('Real discovery failed, using fallback:', err);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  // Debounced text search against the live API
  const onQueryChange = (q: string) => {
    setQuery(q);
    if (!userLocation) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setSearching(true);
      loadRealBusinesses({ ...userLocation, q: q.trim() || undefined });
    }, 450);
  };

  const pickCategory = (id: string | null) => {
    setSelectedCategory(id);
    if (userLocation) {
      setSearching(true);
      loadRealBusinesses({ ...userLocation, category: id, q: query.trim() || undefined });
    }
  };

  const visible = useMemo(() => {
    let list = selectedCategory ? cards.filter((b) => b.category === selectedCategory) : [...cards];
    if (!userLocation && query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q) || b.category.includes(q));
    }
    if (openNow) list = list.filter((b) => b.isOpenNow !== false);
    // Stars = exposure: recommended blends rating + review volume so
    // highly-starred businesses float to the top for free.
    const score = (b: BizCard) => b.rating * 2 + Math.min(5, Math.log10((b.stars || 0) + 1) * 2);
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating || b.stars - a.stars);
    else if (sort === 'reviewed') list.sort((a, b) => b.stars - a.stars);
    else list.sort((a, b) => score(b) - score(a));
    return list;
  }, [cards, selectedCategory, query, sort, openNow, userLocation]);

  const topRated = useMemo(
    () => [...cards].sort((a, b) => b.rating - a.rating || b.stars - a.stars).slice(0, 5),
    [cards]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Hero + search */}
      <div className="text-center mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
          Find your next favorite spot
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto mb-5 text-sm sm:text-lg">
          Real local businesses with verified stars — every rating traces to a real visit.
        </p>
        <div className="max-w-xl mx-auto relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search tacos, haircut, spa day…"
            className="w-full pl-11 pr-10 py-3 sm:py-3.5 border border-slate-300 rounded-full shadow-sm text-base focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          />
          {query ? (
            <button
              onClick={() => onQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : searching ? (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 inline-block animate-spin rounded-full h-5 w-5 border-2 border-amber-500 border-t-transparent" />
          ) : null}
        </div>
        {userLocation && (
          <p className="text-xs sm:text-sm text-emerald-600 mt-2">📍 Showing venues near you</p>
        )}
      </div>

      {/* Categories */}
      <div className="flex overflow-x-auto no-scrollbar mobile-scroll gap-2 sm:gap-3 mb-5 sm:justify-center sm:flex-wrap pb-1">
        <button
          onClick={() => pickCategory(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !selectedCategory ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => pickCategory(cat.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat.id ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Sort + filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar mobile-scroll pb-1">
        <div className="flex shrink-0 bg-white border border-slate-200 rounded-full p-0.5">
          {(['list', 'map'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                view === v ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              {v === 'list' ? '☰ List' : '🗺️ Map'}
            </button>
          ))}
        </div>
        <span className="text-xs font-medium text-slate-500 shrink-0">SORT:</span>
        {(
          [
            { id: 'recommended', label: 'Recommended' },
            { id: 'rating', label: 'Highest rated' },
            { id: 'reviewed', label: 'Most reviewed' },
          ] as { id: SortMode; label: string }[]
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              sort === s.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 active:bg-slate-100'
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setOpenNow(!openNow)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            openNow ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          {openNow ? '✓ Open now' : 'Open now'}
        </button>
      </div>

      {/* Top-rated shelf (exposure for earned stars) */}
      {!query && !selectedCategory && topRated.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">⭐ Top rated near you</h2>
            <span className="text-xs text-slate-500">Stars earn this shelf</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar mobile-scroll pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {topRated.map((b, i) => (
              <Link
                key={b.id}
                to={`/sitara/place/${b.source}/${encodeURIComponent(b.id)}`}
                className="tile shrink-0 w-56 bg-white rounded-xl shadow-sm overflow-hidden"
              >
                <div className="h-28 bg-slate-200 relative overflow-hidden tile-img">
                  <img src={b.image} alt={b.name} loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/80 text-white rounded-full text-xs font-bold">
                    #{i + 1}
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-semibold text-slate-900 text-sm truncate">{b.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                    <Stars value={b.rating} />
                    <span className="font-medium">{b.rating.toFixed(1)}</span>
                    <span>({b.stars})</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <h2 className="font-bold text-slate-900 mb-3">
        {query ? `Results for “${query}”` : selectedCategory ? 'Browse' : 'Recommended for you'}
        <span className="ml-2 text-sm font-normal text-slate-500">{visible.length} places</span>
      </h2>
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent" />
          <p className="mt-2 text-slate-500">Discovering venues near you...</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-semibold text-slate-900 mb-1">Nothing found</p>
          <p className="text-sm text-slate-500">Try a different craving, or browse a category above.</p>
        </div>
      ) : view === 'map' ? (
        userLocation ? (
          <DiscoveryMap pins={visible} center={userLocation} />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-semibold text-slate-900 mb-1">Map needs your location</p>
            <p className="text-sm text-slate-500">Allow location access to see places around you.</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {visible.map((business) => (
            <Link
              key={business.id}
              to={`/sitara/place/${business.source}/${encodeURIComponent(business.id)}`}
              className="tile tile-img rise bg-white rounded-xl shadow-sm overflow-hidden group"
            >
              <div className="h-44 sm:h-48 bg-slate-200 overflow-hidden relative">
                <img
                  src={business.image}
                  alt={business.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {business.isOpenNow && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-medium">
                    Open now
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-semibold text-slate-900 truncate mr-2">{business.name}</h3>
                  <span className="text-sm text-slate-500 shrink-0">{business.price}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Stars value={business.rating} />
                  <span className="font-medium">{business.rating.toFixed(1)}</span>
                  <span>·</span>
                  <span>{business.stars} reviews</span>
                  {business.real && (
                    <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium shrink-0">
                      ✓ Live
                    </span>
                  )}
                </div>
                {business.address && (
                  <p className="text-xs text-slate-500 mt-1.5 truncate">{business.address}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
