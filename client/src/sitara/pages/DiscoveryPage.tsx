// Sitara OS — Discovery Page
// Updated with Book Now button linking to booking flow
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';
import DiscoveryMap from '../components/DiscoveryMap';
import { getFavorites, Favorite } from '../utils/favorites';

const categories = [
  { id: 'RESTAURANT', label: 'Restaurants', icon: 'restaurant' },
  { id: 'SALON', label: 'Salons', icon: 'content_cut' },
  { id: 'SPA', label: 'Spas', icon: 'spa' },
  { id: 'HOTEL', label: 'Hotels', icon: 'hotel' },
  { id: 'FITNESS_CENTER', label: 'Fitness', icon: 'fitness_center' },
  { id: 'EVENT_VENUE', label: 'Venues', icon: 'celebration' },
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
  distanceKm?: number;
}

type SortMode = 'recommended' | 'rating' | 'reviewed';

const FALLBACK_CARDS: BizCard[] = mockBusinesses.map((b) => ({ ...b, source: 'osm', real: false }));

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="material-symbols-outlined text-[14px]"
          style={{ color: i <= Math.round(value) ? 'var(--muted-ochre)' : 'var(--soft-stone)' }}
        >
          star
        </span>
      ))}
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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [geoDenied, setGeoDenied] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setFavorites(getFavorites());
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          loadRealBusinesses({ ...loc });
        },
        () => {
          setGeoDenied(true);
          setLoading(false);
        }
      );
    } else {
      setGeoDenied(true);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestNearMe = () => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    setNearMeLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setGeoDenied(false);
        loadRealBusinesses({ ...loc }).finally(() => setNearMeLoading(false));
      },
      () => {
        setNearMeLoading(false);
        setGeoDenied(true);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const useCity = async () => {
    const q = cityQuery.trim();
    if (!q) return;
    setGeocoding(true);
    try {
      const results = await sitaraApi.geocodeAddress(q);
      if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        const loc = { lat: first.lat, lng: first.lng };
        setUserLocation(loc);
        setGeoDenied(false);
        setLoading(true);
        await loadRealBusinesses({ ...loc });
      }
    } catch {
      /* leave the prompt up */
    } finally {
      setGeocoding(false);
    }
  };

  async function loadRealBusinesses(opts: { lat: number; lng: number; category?: string | null; q?: string }) {
    try {
      const businesses = await sitaraApi.discoverNearbyBusinesses(
        opts.lat,
        opts.lng,
        5000,
        opts.category || undefined
      );

      if (Array.isArray(businesses) && businesses.length > 0) {
        setCards(
          businesses.map((b: any) => {
            let distanceKm: number | undefined;
            if (opts.lat && opts.lng && b.lat && b.lng) {
              const R = 6371;
              const φ1 = (opts.lat * Math.PI) / 180;
              const φ2 = (b.lat * Math.PI) / 180;
              const Δφ = ((b.lat - opts.lat) * Math.PI) / 180;
              const Δλ = ((b.lng - opts.lng) * Math.PI) / 180;
              const x =
                Math.sin(Δφ / 2) ** 2 +
                Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
              distanceKm = +((R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))) / 1000).toFixed(1);
            }

            return {
              id: String(b.lat && b.lng ? `${b.lat},${b.lng}` : b.name),
              source: 'osm',
              name: b.name || 'Unnamed venue',
              category: String(b.category || 'OTHER').toUpperCase(),
              rating: Number(b.tags?.rating ?? 4.0),
              stars: 0,
              image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
              price: '$$',
              address: b.address,
              lat: b.lat != null ? Number(b.lat) : undefined,
              lng: b.lng != null ? Number(b.lng) : undefined,
              real: true,
              distanceKm,
            };
          })
        );
      } else {
        setCards(FALLBACK_CARDS);
      }
    } catch (err) {
      console.warn('Real discovery failed, using fallback:', err);
      setCards(FALLBACK_CARDS);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

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

  const handleBookNow = (business: BizCard) => {
    navigate(`/book/${business.id}`, { state: { name: business.name } });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Hero + search */}
      <div className="text-center mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: 'var(--warm-ink)' }}>
          Find your next favorite spot
        </h1>
        <p className="max-w-2xl mx-auto mb-5 text-sm sm:text-lg" style={{ color: 'var(--soft-stone)' }}>
          Real local businesses with verified stars — every rating traces to a real visit.
        </p>
        <div className="max-w-xl mx-auto relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--soft-stone)' }}>search</span>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search tacos, haircut, spa day…"
            className="w-full pl-11 pr-10 py-3 sm:py-3.5 rounded-full text-base outline-none transition"
            style={{
              border: '1px solid rgba(191,179,163,0.4)',
              background: 'white',
              color: 'var(--warm-ink)',
              boxShadow: 'var(--shadow-soft)',
            }}
          />
          {query ? (
            <button
              onClick={() => onQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
              style={{ color: 'var(--soft-stone)' }}
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : searching ? (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 inline-block animate-spin rounded-full h-5 w-5 border-2 border-[var(--clay)] border-t-transparent" />
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          {userLocation && (
            <p className="text-xs sm:text-sm flex items-center gap-1" style={{ color: 'var(--sage)' }}>
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              Showing venues near you
            </p>
          )}
          {!userLocation && (
            <button
              onClick={requestNearMe}
              disabled={nearMeLoading}
              className="px-4 py-1.5 text-xs font-medium rounded-full transition hover:-translate-y-0.5"
              style={{ background: 'var(--sage)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
            >
              <span className="material-symbols-outlined text-[14px] mr-1 align-[-2px]">my_location</span>
              {nearMeLoading ? 'Locating…' : 'Near me'}
            </button>
          )}
        </div>
        {geoDenied && !userLocation && (
          <div className="max-w-xl mx-auto mt-3 flex gap-2">
            <input
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void useCity()}
              placeholder="Enter your city instead — e.g. Austin, TX"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-full text-sm outline-none"
              style={{
                border: '1px solid rgba(191,179,163,0.4)',
                background: 'white',
                color: 'var(--warm-ink)',
              }}
            />
            <button
              onClick={() => void useCity()}
              disabled={geocoding}
              className="shrink-0 px-5 py-2.5 text-sm font-medium rounded-full transition hover:-translate-y-0.5"
              style={{ background: 'var(--warm-ink)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
            >
              {geocoding ? '…' : 'Use city'}
            </button>
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="flex overflow-x-auto no-scrollbar mobile-scroll gap-2 sm:gap-3 mb-5 sm:justify-center sm:flex-wrap pb-1">
        <button
          onClick={() => pickCategory(null)}
          className="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition hover:-translate-y-0.5"
          style={{
            background: !selectedCategory ? 'var(--clay)' : 'white',
            color: !selectedCategory ? 'white' : 'var(--warm-ink)',
            boxShadow: !selectedCategory ? 'var(--shadow-soft)' : 'none',
          }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => pickCategory(cat.id)}
            className="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition hover:-translate-y-0.5"
            style={{
              background: selectedCategory === cat.id ? 'var(--clay)' : 'white',
              color: selectedCategory === cat.id ? 'white' : 'var(--warm-ink)',
              boxShadow: selectedCategory === cat.id ? 'var(--shadow-soft)' : 'none',
            }}
          >
            <span className="material-symbols-outlined text-[16px] mr-1 align-[-3px]">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sort + filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar mobile-scroll pb-1">
        <div className="flex shrink-0 rounded-full p-0.5" style={{ background: 'var(--warm-sand)' }}>
          {(['list', 'map'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition"
              style={{
                background: view === v ? 'var(--warm-ink)' : 'transparent',
                color: view === v ? 'white' : 'var(--warm-ink)',
              }}
            >
              {v === 'list' ? 'List' : 'Map'}
            </button>
          ))}
        </div>
        <span className="text-xs font-medium shrink-0" style={{ color: 'var(--soft-stone)' }}>SORT:</span>
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
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition hover:-translate-y-0.5"
            style={{
              background: sort === s.id ? 'var(--warm-ink)' : 'white',
              color: sort === s.id ? 'white' : 'var(--warm-ink)',
              border: sort === s.id ? '1px solid var(--warm-ink)' : '1px solid rgba(191,179,163,0.3)',
            }}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setOpenNow(!openNow)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition hover:-translate-y-0.5"
          style={{
            background: openNow ? 'var(--sage)' : 'white',
            color: openNow ? 'white' : 'var(--warm-ink)',
            border: openNow ? '1px solid var(--sage)' : '1px solid rgba(191,179,163,0.3)',
          }}
        >
          {openNow ? '✓ Open now' : 'Open now'}
        </button>
      </div>

      {/* Saved places (on-device favorites) */}
      {favorites.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--warm-ink)' }}>
              <span className="material-symbols-outlined text-[20px]">favorite</span>
              Your saved places
            </h2>
            <span className="text-xs" style={{ color: 'var(--soft-stone)' }}>{favorites.length} saved</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar mobile-scroll pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {favorites.map((b) => (
              <Link
                key={`${b.source}:${b.id}`}
                to={`/sitara/place/${b.source}/${encodeURIComponent(b.id)}`}
                className="tile shrink-0 w-48 rounded-[var(--radius-card)] overflow-hidden transition hover:-translate-y-0.5"
                style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
              >
                <div className="h-24 overflow-hidden tile-img">
                  <img src={b.image} alt={b.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--warm-ink)' }}>{b.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--soft-stone)' }}>
                    <span className="material-symbols-outlined text-[12px] text-[var(--muted-ochre)]">star</span> {Number(b.rating || 0).toFixed(1)}
                    {b.price ? ` · ${b.price}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top-rated shelf */}
      {!query && !selectedCategory && topRated.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--warm-ink)' }}>
              <span className="material-symbols-outlined text-[20px]">star</span>
              Top rated near you
            </h2>
            <span className="text-xs" style={{ color: 'var(--soft-stone)' }}>Stars earn this shelf</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar mobile-scroll pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {topRated.map((b, i) => (
              <div
                key={b.id}
                className="tile shrink-0 w-56 rounded-[var(--radius-card)] overflow-hidden relative group transition hover:-translate-y-0.5"
                style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
              >
                <Link to={`/sitara/place/${b.source}/${encodeURIComponent(b.id)}`} className="block">
                  <div className="h-28 relative overflow-hidden tile-img">
                    <img src={b.image} alt={b.name} loading="lazy" className="w-full h-full object-cover" />
                    <span
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: 'var(--warm-ink)', color: 'white' }}
                    >
                      #{i + 1}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--warm-ink)' }}>{b.name}</p>
                    <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
                      <Stars value={b.rating} />
                      <span className="font-medium">{b.rating.toFixed(1)}</span>
                      <span>({b.stars})</span>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); handleBookNow(b); }}
                  className="absolute bottom-2 right-2 px-3 py-1 text-xs font-bold rounded-full transition opacity-0 group-hover:opacity-100"
                  style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
                >
                  Book Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <h2 className="font-bold mb-3" style={{ color: 'var(--warm-ink)' }}>
        {query ? `Results for "${query}"` : selectedCategory ? 'Browse' : 'Recommended for you'}
        <span className="ml-2 text-sm font-normal" style={{ color: 'var(--soft-stone)' }}>{visible.length} places</span>
      </h2>
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--clay)] border-t-transparent" />
          <p className="mt-2" style={{ color: 'var(--soft-stone)' }}>Discovering venues near you...</p>
        </div>
      ) : visible.length === 0 ? (
        <div
          className="rounded-[var(--radius-card)] p-12 text-center"
          style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
        >
          <span className="material-symbols-outlined text-[48px]" style={{ color: 'var(--soft-stone)' }}>search_off</span>
          <p className="font-semibold mt-3 mb-1" style={{ color: 'var(--warm-ink)' }}>Nothing found</p>
          <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Try a different craving, or browse a category above.</p>
        </div>
      ) : view === 'map' ? (
        userLocation ? (
          <DiscoveryMap pins={visible} center={userLocation} />
        ) : (
          <div
            className="rounded-[var(--radius-card)] p-12 text-center"
            style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[48px]" style={{ color: 'var(--soft-stone)' }}>map</span>
            <p className="font-semibold mt-3 mb-1" style={{ color: 'var(--warm-ink)' }}>Map needs your location</p>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Allow location access to see places around you.</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {visible.map((business) => (
            <div
              key={business.id}
              className="tile tile-img rise rounded-[var(--radius-card)] overflow-hidden group transition hover:-translate-y-0.5"
              style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}
            >
              <Link
                to={`/sitara/place/${business.source}/${encodeURIComponent(business.id)}`}
                className="block"
              >
                <div className="h-44 sm:h-48 overflow-hidden relative">
                  <img
                    src={business.image}
                    alt={business.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {business.isOpenNow && (
                    <span
                      className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'var(--sage)', color: 'white' }}
                    >
                      Open now
                    </span>
                  )}
                  {business.real && (
                    <span
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'var(--sage)', color: 'white' }}
                    >
                      <span className="material-symbols-outlined text-[10px] mr-0.5 align-[-1px]">check</span>
                      Live
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-semibold truncate mr-2" style={{ color: 'var(--warm-ink)' }}>{business.name}</h3>
                    <span className="text-sm shrink-0" style={{ color: 'var(--soft-stone)' }}>{business.price}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--soft-stone)' }}>
                    <Stars value={business.rating} />
                    <span className="font-medium">{business.rating.toFixed(1)}</span>
                    <span>·</span>
                    <span>{business.stars} reviews</span>
                    {business.distanceKm != null && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[14px]">straighten</span>
                          {business.distanceKm} km
                        </span>
                      </>
                    )}
                  </div>
                  {business.address && (
                    <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--soft-stone)' }}>{business.address}</p>
                  )}
                </div>
              </Link>
              {/* Book Now Button */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => handleBookNow(business)}
                  className="w-full py-2.5 font-bold rounded-full transition hover:-translate-y-0.5"
                  style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
                >
                  <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">calendar_month</span>
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
