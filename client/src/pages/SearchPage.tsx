import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService, userService } from '../services/api';
import { MapPinIcon, MagnifyingGlassIcon, BuildingOfficeIcon, UserIcon } from '@heroicons/react/24/outline';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const typeParam = searchParams.get('type') || 'businesses';
  const [searchInput, setSearchInput] = useState(q);
  const [searchType, setSearchType] = useState(typeParam);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLoc({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim(), type: searchType });
    }
  };

  useEffect(() => {
    if (q) {
      setSearchParams({ q, type: searchType });
    }
  }, [searchType]);

  const { data: businessData, isFetching: isLoadingBusinesses } = useQuery(
    ['search-businesses', q || 'all', userLoc],
    async () => {
      const params: any = {};
      if (q.trim()) {
        params.search = q.trim();
      }
      if (userLoc) {
        params.latitude = userLoc.lat;
        params.longitude = userLoc.lng;
      }
      const res = await businessService.getPublicBusinesses(params);
      let items = res.data?.data?.businesses || [];
      const term = (q || '').trim().toLowerCase();
      if (term && items.length) {
        items = items
          .map((item: any) => {
            const name = (item.name || '').toLowerCase();
            const city = (item.city || '').toLowerCase();
            const desc = (item.description || '').toLowerCase();
            const cat = (item.category || '').toLowerCase();
            const bp = name.startsWith(term) ? 100 : name.includes(term) ? 80 : cat.includes(term) ? 50 : desc.includes(term) ? 30 : city.includes(term) ? 20 : 0;
            const lat = item.latitude;
            const lng = item.longitude;
            const dist = userLoc && lat != null && lng != null
              ? Number(((Math.abs(lat - userLoc.lat) * Math.cos((userLoc.lat * Math.PI) / 180) * 111.32) + Math.abs(lng - userLoc.lng) * 111.32).toFixed(1))
              : null;
            return { ...item, __score: bp + (dist != null ? Math.max(0, 50 - dist) : 0), __distanceKm: dist };
          })
          .sort((a: any, b: any) => b.__score - a.__score);
      }
      return items;
    },
    { enabled: searchType === 'businesses' }
  );

  const { data: userData, isFetching: isLoadingUsers } = useQuery(
    ['search-users', q],
    async () => {
      const res = await userService.searchUsers({ search: q });
      return res.data?.data?.users || [];
    },
    { enabled: !!q && searchType === 'users' }
  );

  const { data: relatedData } = useQuery(
    ['related-businesses', userLoc],
    async () => {
      const params: any = {};
      if (userLoc) {
        params.latitude = userLoc.lat;
        params.longitude = userLoc.lng;
      }
      const res = await businessService.getPublicBusinesses(params);
      let items = res.data?.data?.businesses || [];
      if (userLoc) {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371;
        items = items
          .filter((b: any) => Number.isFinite(b.latitude) && Number.isFinite(b.longitude))
          .sort((a: any, b: any) => {
            const d = (la: number, lo: number, lb: number, lo2: number) => {
              const dLat = toRad(lb - la);
              const dLon = toRad(lo2 - lo);
              const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(la)) * Math.cos(toRad(lb)) * Math.sin(dLon / 2) ** 2;
              return 2 * R * Math.asin(Math.sqrt(x));
            };
            return d(userLoc.lat, userLoc.lng, Number(b.latitude), Number(b.longitude)) - d(userLoc.lat, userLoc.lng, Number(a.latitude), Number(a.longitude));
          });
      }
      return items;
    },
    { enabled: searchType === 'businesses' }
  );

  const businesses = businessData || [];
  const users = userData || [];
  const relatedBusinesses = relatedData || [];
  const isLoading = searchType === 'businesses' ? isLoadingBusinesses : isLoadingUsers;
  const results = searchType === 'businesses' ? businesses : users;

  const suggestions = (() => {
    const term = searchInput.trim().toLowerCase();
    const pool = term ? businesses : relatedBusinesses;
    const items = pool.slice(0, 10);
    const out = new Map<string, any>();
    for (const b of items) {
      out.set(b.name, b);
    }
    if (!term) {
      const popular = ['restaurants', 'salons', 'spas', 'clinics'];
      for (const p of popular) {
        if (!out.has(p)) out.set(p, { name: p, isSuggestion: true });
      }
    }
    const cities = ['Chicago','New York','Los Angeles','London','Dubai','Singapore'];
    for (const city of cities) {
      if (!term || city.toLowerCase().includes(term)) out.set(city, { name: city, isCitySuggestion: true });
    }
    return Array.from(out.values()).slice(0, 8);
  })();

  return (
    <div className="w-full min-h-screen bg-surface font-body pb-20">
      <div className="bg-surface-bright border-b border-outline-variant/20 pt-8 pb-6 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-headline font-bold text-on-surface mb-6">
            Search Results
          </h1>
          <form onSubmit={handleSearch} className="max-w-2xl flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-outline" />
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder={searchType === 'businesses' ? "Search businesses, cities, or categories..." : "Search users by name..."}
                className="block w-full pl-10 pr-3 py-3 border border-outline-variant/50 rounded-xl bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              />
              {showSuggestions && searchType === 'businesses' && suggestions.length > 0 && (
                <div className="absolute z-20 mt-2 w-full bg-surface border border-outline-variant/20 rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map((s: any) => (
                    <button
                      key={s.name + (s.isCitySuggestion ? 'city' : 'biz')}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchInput(s.name);
                        setShowSuggestions(false);
                        setSearchParams({ q: s.name, type: searchType });
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-surface-container-high flex items-center justify-between"
                    >
                      <span className="font-medium text-on-surface">{s.name}</span>
                      <span className="text-xs text-on-surface-variant">
                        {s.isCitySuggestion ? 'City' : (s.__distanceKm != null ? `${s.__distanceKm.toFixed(1)} km` : 'Recommendation')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
            >
              Search
            </button>
          </form>

          {/* Toggle Search Type */}
          <div className="flex items-center gap-4 mt-6 max-w-2xl">
            <button
              onClick={() => setSearchType('businesses')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold transition-all ${
                searchType === 'businesses' 
                  ? 'bg-primary-container text-on-primary-container border-2 border-primary shadow-sm' 
                  : 'bg-surface-container-low text-on-surface-variant border-2 border-transparent hover:bg-surface-container-high'
              }`}
            >
              <BuildingOfficeIcon className="w-5 h-5" />
              Businesses
            </button>
            <button
              onClick={() => setSearchType('users')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold transition-all ${
                searchType === 'users' 
                  ? 'bg-primary-container text-on-primary-container border-2 border-primary shadow-sm' 
                  : 'bg-surface-container-low text-on-surface-variant border-2 border-transparent hover:bg-surface-container-high'
              }`}
            >
              <UserIcon className="w-5 h-5" />
              Users
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-on-surface-variant">
            {isLoading ? 'Searching...' : q ? `Found ${results.length} result${results.length === 1 ? '' : 's'} for "${q}"` : (userLoc ? 'Near you' : 'Start typing to search')}
          </h2>
          {!q && searchType === 'businesses' && relatedBusinesses.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-on-surface mb-3">Near Me</h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {relatedBusinesses.slice(0, 10).map((biz: any) => (
                  <button
                    key={biz.id}
                    onClick={() => setSearchParams({ q: biz.name, type: searchType })}
                    className="flex-shrink-0 w-44 bg-surface-container-low border border-outline-variant/10 rounded-2xl overflow-hidden hover:shadow-md transition-all"
                  >
                    <div className="h-24 w-full bg-slate-200">
                      <img src={biz.coverImageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400'} alt={biz.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-on-surface truncate">{biz.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{biz.city || biz.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div>
            <div className="text-center py-20 bg-surface-container-low rounded-2xl border border-outline-variant/10 mb-12">
              <MagnifyingGlassIcon className="h-12 w-12 text-outline mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-on-surface mb-2">No exact matches found</h3>
              <p className="text-on-surface-variant max-w-md mx-auto">
                We couldn't find any {searchType} matching "{q}". Try adjusting your search terms.
              </p>
              {searchType === 'users' && (
                <Link to="/" className="inline-block mt-6 px-6 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors">
                  Back to Home
                </Link>
              )}
            </div>

            {searchType === 'businesses' && relatedBusinesses.length > 0 && (
              <div className="animate-fade-in">
                <h3 className="text-2xl font-bold text-on-surface mb-6">Explore Related Businesses</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedBusinesses.slice(0, 6).map((biz: any) => (
                    <Link
                      key={biz.id}
                      to={`/business/${biz.id}`}
                      className="group flex flex-col border border-outline-variant/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 glowing-border tile-hover glass-panel"
                    >
                      <div className="relative h-48 w-full overflow-hidden">
                        <img
                          src={biz.coverImageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800"}
                          alt={biz.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        
                        <div className="absolute top-3 right-3 flex flex-col gap-2">
                          {biz.isClaimed ? (
                            <span className="bg-[#14F195]/90 backdrop-blur text-black px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                              Verified
                            </span>
                          ) : (
                            <span className="bg-amber-500/90 backdrop-blur text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                              Unclaimed
                            </span>
                          )}
                        </div>
                        
                        <div className="absolute bottom-3 left-3 right-3">
                          <h3 className="text-lg font-bold text-white truncate drop-shadow-md">
                            {biz.name}
                          </h3>
                          <div className="flex items-center text-white/90 text-xs mt-1 drop-shadow">
                            <MapPinIcon className="h-3 w-3 mr-1" />
                            <span className="truncate">{biz.address || biz.city}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 flex flex-col flex-grow">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded uppercase tracking-wide">
                            {biz.category}
                          </span>
                          <div className="flex items-center gap-1 text-sm font-bold text-on-surface">
                            <span className="text-yellow-400">★</span>
                            {biz.rating?.toFixed(1) || '4.5'}
                            <span className="text-on-surface-variant/60 text-xs font-medium">({biz.reviewCount || 0})</span>
                          </div>
                        </div>
                        <p className="text-sm text-on-surface-variant line-clamp-2 mt-auto">
                          {biz.description || 'Premium service on the Pabandi network.'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchType === 'businesses' ? results.map((biz: any) => (
              <Link
                key={biz.id}
                to={`/business/${biz.id}`}
                className="group flex flex-col border border-outline-variant/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 glowing-border tile-hover glass-panel"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={biz.coverImageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800"}
                    alt={biz.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    {biz.isClaimed ? (
                      <span className="bg-[#14F195]/90 backdrop-blur text-black px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        Verified
                      </span>
                    ) : (
                      <span className="bg-amber-500/90 backdrop-blur text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        Unclaimed
                      </span>
                    )}
                  </div>
                  
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-lg font-bold text-white truncate drop-shadow-md">
                      {biz.name}
                    </h3>
                    <div className="flex items-center text-white/90 text-xs mt-1 drop-shadow">
                      <MapPinIcon className="h-3 w-3 mr-1" />
                      <span className="truncate">{biz.address || biz.city}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 flex flex-col flex-grow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded uppercase tracking-wide">
                      {biz.category}
                    </span>
                    <div className="flex items-center gap-1 text-sm font-bold text-on-surface">
                      <span className="text-yellow-400">★</span>
                      {biz.rating?.toFixed(1) || '4.5'}
                      <span className="text-on-surface-variant/60 text-xs font-medium">({biz.reviewCount || 0})</span>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant line-clamp-2 mt-auto">
                    {biz.description || 'Premium service on the Pabandi network.'}
                  </p>
                </div>
              </Link>
            )) : results.map((user: any) => (
              <Link
                key={user.id}
                to={`/user/${user.id}`}
                className="group flex flex-col bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 glowing-border tile-hover p-6 items-center text-center"
              >
                <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-2xl font-headline mb-4 shadow-md border-2 border-surface">
                  {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-on-surface truncate">
                  {user.firstName} {user.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Trust Score</span>
                  <span className={`text-lg font-bold ${
                    user.reliabilityScore >= 800 ? 'text-primary' : 
                    user.reliabilityScore >= 600 ? 'text-[#D97706]' : 'text-error'
                  }`}>
                    {user.reliabilityScore}
                  </span>
                </div>
                <div className="mt-4 px-3 py-1 bg-surface-container-high rounded-full text-xs font-bold text-on-surface-variant">
                  {user.verificationTier}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
