import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, FilterList, Zap } from 'lucide-react';
import { ClayBadge } from './primitives';
import { ClayButton } from '../../components/clay/ClayButton';

const SERVICE_CATEGORIES = ['ALL', 'FREELANCE', 'RESTAURANT', 'SALON', 'CLINIC', 'SPA', 'FITNESS_CENTER', 'EVENT_VENUE'];

const categoryLabels: Record<string, string> = {
  ALL: 'All Services',
  FREELANCE: 'Freelancers & Tech',
  RESTAURANT: 'Restaurants',
  SALON: 'Salons',
  CLINIC: 'Clinics & Health',
  SPA: 'Spas & Wellness',
  FITNESS_CENTER: 'Fitness & Gyms',
  EVENT_VENUE: 'Venues',
};

interface SearchResult {
  id: string;
  name: string;
  category: string;
  rating: number;
  address: string;
  city: string;
  image?: string;
  trustScore?: number;
}

interface BookingSearchBarProps {
  results?: SearchResult[];
  onResultClick?: (id: string) => void;
}

export default function BookingSearchBar({ results = [], onResultClick }: BookingSearchBarProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const filteredResults = results.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.city.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(r =>
    selectedCategory === 'ALL' || r.category === selectedCategory
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/booking?search=${encodeURIComponent(searchQuery.trim())}&category=${selectedCategory}`);
    }
  };

  const handleResultClick = (id: string) => {
    if (onResultClick) {
      onResultClick(id);
    } else {
      navigate(`/book/${id}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search businesses, services, cities..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/60 text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30 transition-colors"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--soft-stone)]" />
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-[var(--clay)] text-[var(--warm-ink)] font-bold hover:bg-[var(--terracotta)] transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
        {SERVICE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap shrink-0 min-w-max px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              selectedCategory === cat
                ? 'bg-[var(--clay)] text-[var(--warm-ink)] shadow-sm shadow-[var(--clay)]/20'
                : 'bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/80'
            }`}
          >
            {categoryLabels[cat] || cat}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[var(--warm-ink)] text-sm">
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
          </h3>
          <Zap className="w-4 h-4 text-[var(--clay)]" />
        </div>

        {filteredResults.length === 0 && (
          <div className="p-8 text-center bg-white rounded-xl border border-[rgba(191,179,163,0.3)]">
            <p className="text-[var(--soft-stone)] text-sm">No businesses match your search</p>
            <p className="text-[var(--soft-stone)] text-xs mt-1">Try adjusting your search or category</p>
          </div>
        )}

        {filteredResults.map(business => (
          <div
            key={business.id}
            onClick={() => handleResultClick(business.id)}
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[rgba(191,179,163,0.3)] hover:border-[var(--clay)] transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-lg bg-[var(--warm-sand)] flex items-center justify-center">
              {business.image ? (
                <img src={business.image} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : (
                <span className="text-xl">
                  {business.category === 'FREELANCE' ? '💻' :
                   business.category === 'CLINIC' ? '🏥' :
                   business.category === 'RESTAURANT' ? '🍽️' :
                   business.category === 'SALON' ? '💇' :
                   business.category === 'SPA' ? '🧖' :
                   business.category === 'FITNESS_CENTER' ? '🏋️' :
                   business.category === 'EVENT_VENUE' ? '🎉' : '🏪'}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-[var(--warm-ink)] text-sm">{business.name}</h4>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="font-bold text-[var(--clay)]">{categoryLabels[business.category] || business.category}</span>
                <span className="text-[var(--soft-stone)]">·</span>
                <span className="text-[var(--soft-stone)]">{business.city}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="font-bold text-[var(--clay)]">★ {business.rating || 5}</span>
                {business.trustScore && (
                  <ClayBadge label={`Trust ${business.trustScore}`} variant="success" size="sm" />
                )}
              </div>
            </div>
            <button className="px-3 py-2 rounded-lg bg-[var(--clay)] text-[var(--warm-ink)] text-sm font-bold hover:bg-[var(--terracotta)] transition-colors">
              Book
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
