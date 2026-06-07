import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { businessService } from '../services/api';

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const { data, isLoading } = useQuery(
    ['businesses', category, search],
    async () => {
      const res = await businessService.getPublicBusinesses({
        category: category !== 'ALL' ? category : undefined,
        search: search || undefined
      });
      return res.data?.data?.businesses || [];
    },
    { keepPreviousData: true }
  );

  const businesses = data || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The query automatically triggers due to react-query dependencies
  };

  const categories = ['ALL', 'RESTAURANT', 'SPA', 'CLINIC', 'FITNESS_CENTER', 'SALON'];
  const getCategoryLabel = (c: string) => {
    if (c === 'ALL') return 'All Categories';
    if (c === 'RESTAURANT') return 'Fine Dining';
    if (c === 'FITNESS_CENTER') return 'Fitness';
    return c.charAt(0) + c.slice(1).toLowerCase();
  };

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-8 space-y-12 mt-4 pb-28 md:pb-10">
      
      {/* Hero & Search Section */}
      <section className="space-y-6">
        <div className="max-w-xl">
          <h2 className="font-headline text-[2.75rem] md:text-[3.5rem] leading-[1.05] font-bold text-on-surface tracking-[-0.02em] mb-3">
            Web3-Powered Precision Booking.
          </h2>
          <p className="font-body text-on-surface-variant text-lg">
            Explore Karachi's finest corporate spaces, high-end salons, and wellness retreats with AI-backed reservations.
          </p>
        </div>
        
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="bg-surface-container-low rounded-lg flex items-center px-4 py-3 group focus-within:bg-surface-container-lowest focus-within:outline focus-within:outline-1 focus-within:outline-outline-variant/20 transition-all duration-300">
          <span className="material-symbols-outlined text-outline mr-3">search</span>
          <input 
            className="bg-transparent border-none focus:ring-0 w-full font-body text-sm text-on-surface placeholder-outline font-medium focus:outline-none" 
            placeholder="Find places, categories, or services..." 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-1.5 rounded text-sm font-body font-medium ml-2 shadow-[0_4px_12px_rgba(1,29,53,0.15)]">
            Search
          </button>
        </form>
        
        {/* Category Filters */}
        <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`${
                category === c 
                  ? 'bg-primary text-on-primary shadow-[0_8px_16px_rgba(1,29,53,0.08)]' 
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container-highest'
              } px-5 py-2.5 rounded-lg font-label text-sm font-medium whitespace-nowrap transition-colors`}
            >
              {getCategoryLabel(c)}
            </button>
          ))}
        </div>
      </section>

      {/* Featured Businesses */}
      <section className="space-y-6">
        <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Curated for You</h3>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-12 bg-surface-container-low rounded-xl">
            <p className="font-body text-on-surface-variant">No businesses found matching your criteria.</p>
            <button onClick={() => { setSearch(''); setCategory('ALL'); }} className="mt-4 text-primary font-bold hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Main Feature - First Business */}
            {businesses[0] && (
              <Link to={`/business/${businesses[0].id}`} className="md:col-span-8 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(1,29,53,0.06)] group relative h-80 block">
                <img 
                  alt={businesses[0].name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  src={businesses[0].coverImageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200"} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {getCategoryLabel(businesses[0].category)}
                    </span>
                    <span className="flex items-center text-on-primary text-sm font-body">
                      <span className="material-symbols-outlined text-[16px] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      {businesses[0].rating?.toFixed(1) || '4.9'}
                    </span>
                  </div>
                  <h4 className="font-headline text-2xl font-bold text-on-primary mb-1">{businesses[0].name}</h4>
                  <p className="font-body text-primary-fixed-dim text-sm max-w-md line-clamp-2">
                    {businesses[0].description || `${businesses[0].city} • Discover our premium services.`}
                  </p>
                </div>
              </Link>
            )}
            
            {/* Secondary Stack - Next Two Businesses */}
            <div className="md:col-span-4 flex flex-col gap-6">
              {businesses[1] && (
                <Link to={`/business/${businesses[1].id}`} className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(1,29,53,0.06)] flex-1 relative group block min-h-[150px]">
                  <img 
                    alt={businesses[1].name} 
                    className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105" 
                    src={businesses[1].coverImageUrl || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600"} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-5">
                    <span className="bg-secondary-container text-on-secondary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                      {getCategoryLabel(businesses[1].category)}
                    </span>
                    <h4 className="font-headline text-lg font-bold text-on-primary">{businesses[1].name}</h4>
                  </div>
                </Link>
              )}
              
              {businesses.length > 2 ? (
                businesses[2] && (
                  <Link to={`/business/${businesses[2].id}`} className="bg-surface-container-low rounded-xl overflow-hidden flex-1 p-5 flex flex-col justify-center min-h-[150px] cursor-pointer group hover:bg-surface-container transition-colors shadow-sm">
                    <h4 className="font-headline text-lg font-bold text-on-surface mb-2">{businesses[2].name}</h4>
                    <p className="font-body text-on-surface-variant text-sm mb-4 line-clamp-2">
                      {businesses[2].description || `Located in ${businesses[2].city}. Explore our offerings.`}
                    </p>
                    <button className="flex items-center text-primary font-body text-sm font-semibold group-hover:gap-2 transition-all">
                      Explore <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
                    </button>
                  </Link>
                )
              ) : (
                <div className="bg-surface-container-low rounded-xl overflow-hidden flex-1 p-5 flex flex-col justify-center min-h-[150px] cursor-pointer group hover:bg-surface-container transition-colors">
                  <h4 className="font-headline text-lg font-bold text-on-surface mb-2">More coming soon</h4>
                  <p className="font-body text-on-surface-variant text-sm mb-4">New businesses are registering in your area every day.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </section>

      {/* Technology Promo Banner */}
      <section className="bg-primary/5 rounded-3xl p-8 md:p-12 border border-primary/10 flex flex-col md:flex-row items-center gap-8 justify-between shadow-sm">
        <div className="max-w-xl space-y-4">
          <div className="flex items-center gap-2 text-primary font-label text-sm font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px]">memory</span>
            Breakthrough Technology
          </div>
          <h3 className="font-headline text-3xl font-bold text-on-surface">Experience No-Show Proof Bookings</h3>
          <p className="font-body text-on-surface-variant text-lg">
            Our proprietary AI risk engine evaluates reliability in real-time, building your personalized Pabandi Score. Book at top-tier venues with zero deposit when you maintain a high score, all powered by the Solana blockchain.
          </p>
          <div className="pt-2">
            <Link to="/technology" className="text-primary font-semibold hover:underline flex items-center gap-1">
              Learn how it works <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </div>
        <div className="w-full md:w-auto flex-shrink-0 relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
          <div className="relative bg-surface-container-highest p-6 rounded-2xl shadow-lg border border-outline-variant/20 flex flex-col items-center">
            <div className="text-sm font-label uppercase tracking-widest text-on-surface-variant mb-2">Your Pabandi Score</div>
            <div className="text-5xl font-headline font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#38bdf8]">
              850
            </div>
            <div className="mt-2 text-xs font-bold bg-[#14F195]/20 text-[#10b981] px-2 py-1 rounded-md uppercase">Elite Status</div>
          </div>
        </div>
      </section>

      {/* Top Rated Institutions */}
      {businesses.length > 3 && (
        <section className="space-y-6">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">More Top Rated Places</h3>
          <div className="space-y-4">
            {businesses.slice(3).map((biz: any) => (
              <Link key={biz.id} to={`/business/${biz.id}`} className="bg-surface-container-lowest rounded-xl p-4 flex items-center gap-6 shadow-[0_10px_20px_rgba(1,29,53,0.03)] group block hover:bg-surface-container-lowest/80 transition-colors border border-outline-variant/10">
                <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container-highest relative">
                  {biz.logoUrl || biz.coverImageUrl ? (
                    <img alt={biz.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={biz.logoUrl || biz.coverImageUrl} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant font-headline font-bold text-2xl">
                      {biz.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-headline text-lg font-bold text-on-surface">{biz.name}</h4>
                    <span className="flex items-center text-on-surface font-body font-semibold text-sm bg-surface-container px-2 py-1 rounded">
                      <span className="material-symbols-outlined text-[16px] text-[#f59e0b] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      {biz.rating?.toFixed(1) || '4.8'}
                    </span>
                  </div>
                  <p className="font-body text-on-surface-variant text-sm mb-3">
                    {biz.address}, {biz.city}
                  </p>
                  <div className="flex gap-2">
                    <span className="font-label text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded uppercase">
                      {getCategoryLabel(biz.category)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
