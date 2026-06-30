import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService } from '../services/api';
import { MapPinIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(q);
  const [userLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() });
    }
  };

  const { data, isLoading } = useQuery(
    ['search-businesses', q, userLoc],
    async () => {
      const params: any = { search: q };
      if (userLoc) {
        params.latitude = userLoc.lat;
        params.longitude = userLoc.lng;
      }
      const res = await businessService.getPublicBusinesses(params);
      return res.data?.data?.businesses || [];
    },
    { enabled: !!q, keepPreviousData: true }
  );

  const businesses = data || [];

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
                placeholder="Search businesses, cities, or categories..."
                className="block w-full pl-10 pr-3 py-3 border border-outline-variant/50 rounded-xl bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-on-surface-variant">
            {isLoading ? 'Searching...' : `Found ${businesses.length} result${businesses.length === 1 ? '' : 's'} for "${q}"`}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <MagnifyingGlassIcon className="h-12 w-12 text-outline mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-on-surface mb-2">No exact matches found</h3>
            <p className="text-on-surface-variant max-w-md mx-auto">
              We couldn't find any businesses matching "{q}". Try adjusting your search terms or browsing by category on the home page.
            </p>
            <Link to="/" className="inline-block mt-6 px-6 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors">
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map((biz: any) => (
              <Link
                key={biz.id}
                to={`/business/${biz.id}`}
                className="group flex flex-col bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 glowing-border tile-hover"
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
        )}
      </div>
    </div>
  );
}
