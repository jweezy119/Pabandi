import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import DashboardLayout from '../../components/DashboardLayout';
import { HalalBanner } from '../../components/halal';
import { apiClient } from '../../services/api';
import { ZkTrustBadge } from '../../components/ZkTrustBadge';
import '../../styles/pbn-tokens.css';

const NAV_ITEMS = [
  { path: '/booking', label: 'Discovery', icon: 'explore', end: true },
  { path: '/booking/map', label: 'Map', icon: 'map' },
  { path: '/me/bookings', label: 'My Bookings', icon: 'event' },
  { path: '/simulator', label: 'Project Simulator', icon: 'model_training' },
  { path: '/contact', label: 'Business CRM', icon: 'storefront' },
  { path: '/sandbox', label: 'Trust Sandbox', icon: 'verified_user' },
];

export interface BusinessItem {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
  reviewCount: number;
  avatarUrl: string | null;
  startingPrice: number;
  escrowEnabled: boolean;
  trustBand: string;
  slug?: string;
  description?: string;
  address?: string;
  website?: string;
  phone?: string;
  isVerified?: boolean;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Services', icon: 'apps' },
  { id: 'ROOFING', label: 'Roofing & Solar', icon: 'roofing' },
  { id: 'HVAC', label: 'HVAC & Climate', icon: 'mode_fan' },
  { id: 'SECURITY', label: 'Security & Alarms', icon: 'shield' },
  { id: 'FREELANCE', label: 'Freelancers & Tech', icon: 'terminal' },
  { id: 'RESTAURANT', label: 'Restaurants', icon: 'restaurant' },
  { id: 'SALON', label: 'Salons', icon: 'content_cut' },
  { id: 'CLINIC', label: 'Clinics & Health', icon: 'local_hospital' },
  { id: 'SPA', label: 'Spas & Wellness', icon: 'spa' },
  { id: 'FITNESS_CENTER', label: 'Fitness & Gyms', icon: 'fitness_center' },
  { id: 'EVENT_VENUE', label: 'Venues', icon: 'celebration' },
];

function MonogramAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        className="w-11 h-11 rounded-lg object-cover border border-[var(--pbn-border)] shrink-0"
      />
    );
  }

  const cleanName = (name || 'Verified Provider').replace(/^[^a-zA-Z0-9]+/, '');
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (cleanName.slice(0, 2) || 'PB').toUpperCase();

  return (
    <div
      className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border border-[var(--pbn-border)] select-none"
      style={{
        background: 'var(--pbn-accent, #4fd1c5)',
        color: 'var(--pbn-on-accent, #0a1118)',
        fontFamily: 'var(--pbn-font-mono, monospace)',
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function CompactBusinessRow({ business }: { business: BusinessItem }) {
  const targetUrl = `/book/${business.id}`;

  return (
    <div
      data-testid="business-row"
      className="pbn-discovery-row flex items-center justify-between gap-3 p-3.5 mx-2 my-1 rounded-xl transition-colors hover:bg-white/[0.04]"
      style={{
        border: '1px solid var(--pbn-border)',
        background: 'var(--pbn-bg-raised, #101a24)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <MonogramAvatar name={business.name} avatarUrl={business.avatarUrl} />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={targetUrl}
              className="font-bold text-sm truncate hover:text-[var(--pbn-accent)] transition-colors"
              style={{
                color: 'var(--pbn-text, #e8eef4)',
                fontFamily: 'var(--pbn-font-ui, sans-serif)',
              }}
            >
              {business.name}
            </Link>
            {business.website && (
              <a
                href={business.website}
                target="_blank"
                rel="noreferrer"
                title="External Link"
                aria-label={`Visit ${business.name} website`}
                className="text-[var(--pbn-text-muted)] hover:text-[var(--pbn-accent)] shrink-0 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            )}
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider shrink-0"
              style={{
                background: 'rgba(79, 209, 197, 0.1)',
                color: 'var(--pbn-accent, #4fd1c5)',
                border: '1px solid rgba(79, 209, 197, 0.25)',
              }}
            >
              {business.trustBand}
            </span>
            <ZkTrustBadge
              score={business.trustBand === 'TOP' ? 950 : business.trustBand === 'VERIFIED' ? 900 : 820}
              disputeRate={0.4}
              subjectName={business.name}
              subjectId={business.id}
              variant="compact"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--pbn-text-muted)] mt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-[var(--pbn-border)] text-[11px]">
              {business.category}
            </span>
            <span className="flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[13px] text-[var(--pbn-accent)]">location_on</span>
              {business.city}
            </span>
            {business.escrowEnabled && (
              <span className="text-[11px] text-[var(--pbn-accent)] font-mono">
                · ${business.startingPrice} Escrow
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div
          className="text-right hidden sm:block font-mono text-xs"
          style={{
            fontFamily: 'var(--pbn-font-mono, monospace)',
            color: 'var(--pbn-text, #e8eef4)',
          }}
        >
          <div className="text-amber-400 font-bold">★ {business.rating.toFixed(1)}</div>
          <div className="text-[10px] text-[var(--pbn-text-muted)]">({business.reviewCount})</div>
        </div>

        <Link
          to={targetUrl}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all hover:opacity-90"
          style={{
            background: 'var(--pbn-accent, #4fd1c5)',
            color: 'var(--pbn-on-accent, #0a1118)',
            fontFamily: 'var(--pbn-font-ui, sans-serif)',
          }}
        >
          Book
        </Link>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      data-testid="skeleton-card"
      className="p-3.5 mx-2 my-1.5 rounded-xl animate-pulse flex items-center justify-between gap-3"
      style={{
        border: '1px solid var(--pbn-border)',
        background: 'var(--pbn-bg-raised, #101a24)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-white/[0.08]" />
        <div className="space-y-2">
          <div className="h-4 w-40 bg-white/[0.08] rounded" />
          <div className="h-3 w-28 bg-white/[0.05] rounded" />
        </div>
      </div>
      <div className="h-8 w-16 bg-white/[0.08] rounded-lg" />
    </div>
  );
}

export default function BookingOSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');

  const [items, setItems] = useState<BusinessItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [totalBusinessCount, setTotalBusinessCount] = useState<number | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search input by 300ms (Requirement C2)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Debounce city input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCity(cityInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [cityInput]);

  // Load overall business count from /api/v1/businesses/count
  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/businesses/count')
      .then((res) => {
        if (isMounted && res.data && typeof res.data.count === 'number') {
          setTotalBusinessCount(res.data.count);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch page data with cursor pagination (Requirement B1 & B2)
  const fetchPage = useCallback(
    async (cursorParam?: string | null, isNext = false) => {
      if (isNext) {
        setIsFetchingNextPage(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams();
        params.set('limit', '20');
        if (cursorParam) params.set('cursor', cursorParam);
        if (debouncedCity.trim()) params.set('city', debouncedCity.trim());
        if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
        if (debouncedSearch.trim()) params.set('query', debouncedSearch.trim());

        const res = await apiClient.get(`/booking/businesses?${params.toString()}`);
        const data = res.data;
        const fetchedItems: BusinessItem[] = data.items || data.data || [];
        const newCursor: string | null = data.nextCursor ?? null;

        setItems((prev) => (isNext ? [...prev, ...fetchedItems] : fetchedItems));
        setNextCursor(newCursor);
      } catch (err) {
        console.error('Failed to fetch businesses:', err);
      } finally {
        setIsLoading(false);
        setIsFetchingNextPage(false);
      }
    },
    [debouncedCity, selectedCategory, debouncedSearch]
  );

  // Fetch initial page on mount or whenever filters change
  useEffect(() => {
    fetchPage(null, false);
  }, [fetchPage]);

  // IntersectionObserver sentinel at the bottom with 200px rootMargin (Requirement B2)
  useEffect(() => {
    if (!nextCursor || isFetchingNextPage || isLoading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !isFetchingNextPage) {
          fetchPage(nextCursor, true);
        }
      },
      {
        root: parentRef.current,
        rootMargin: '200px',
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, isFetchingNextPage, isLoading, fetchPage]);

  // Virtualizer for row rendering (Requirement B2)
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 5,
  });

  const handleClearFilters = () => {
    setSelectedCategory('ALL');
    setSearchInput('');
    setDebouncedSearch('');
    setCityInput('');
    setDebouncedCity('');
  };

  const hasActiveFilters =
    selectedCategory !== 'ALL' || Boolean(cityInput.trim()) || Boolean(searchInput.trim());

  return (
    <DashboardLayout osName="BookingOS" osIcon="◈" osColor="terracotta" navItems={NAV_ITEMS}>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-extrabold tracking-tight"
              style={{
                color: 'var(--pbn-text, #e8eef4)',
                fontFamily: 'var(--pbn-font-ui, sans-serif)',
              }}
            >
              Discovery &amp; Booking
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--pbn-text-muted, #8a9aa8)' }}>
              Explore verified service businesses and elite providers. Every appointment and milestone is backed by smart escrow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/me/bookings"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-white/[0.08]"
              style={{
                border: '1px solid var(--pbn-border)',
                background: 'var(--pbn-bg-raised, #101a24)',
                color: 'var(--pbn-text, #e8eef4)',
              }}
            >
              My Bookings
            </Link>
            <Link
              to="/simulator"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--pbn-accent, #4fd1c5)',
                color: 'var(--pbn-on-accent, #0a1118)',
              }}
            >
              Simulate Deal
            </Link>
          </div>
        </div>

        {/* Halal Compliance Banner */}
        <HalalBanner compact />

        {/* Location & Quick Search Controls */}
        <div
          className="rounded-2xl p-4 md:p-5"
          style={{
            background: 'var(--pbn-bg-raised, #101a24)',
            border: '1px solid var(--pbn-border)',
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search businesses, skills, keywords..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[var(--pbn-accent)]"
                style={{
                  background: 'var(--pbn-bg, #0a1118)',
                  border: '1px solid var(--pbn-border)',
                  color: 'var(--pbn-text, #e8eef4)',
                }}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-2.5 text-xs text-[var(--pbn-text-muted)] hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* City Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by city (e.g. Lahore, Karachi, Chicago, Remote)..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[var(--pbn-accent)]"
                style={{
                  background: 'var(--pbn-bg, #0a1118)',
                  border: '1px solid var(--pbn-border)',
                  color: 'var(--pbn-text, #e8eef4)',
                }}
              />
              {cityInput && (
                <button
                  type="button"
                  onClick={() => setCityInput('')}
                  aria-label="Clear city"
                  className="absolute right-3 top-2.5 text-xs text-[var(--pbn-text-muted)] hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick Hub Buttons */}
          <div className="flex items-center gap-2 pt-3 flex-wrap text-xs">
            <span className="text-[var(--pbn-text-muted)]">Popular hubs:</span>
            {['Chicago', 'Austin', 'Lahore', 'Karachi', 'Remote'].map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setCityInput(cityInput.toLowerCase() === city.toLowerCase() ? '' : city)}
                className="px-2.5 py-1 rounded-lg font-medium transition-all"
                style={{
                  background:
                    cityInput.toLowerCase() === city.toLowerCase()
                      ? 'var(--pbn-accent, #4fd1c5)'
                      : 'rgba(255, 255, 255, 0.04)',
                  color:
                    cityInput.toLowerCase() === city.toLowerCase()
                      ? 'var(--pbn-on-accent, #0a1118)'
                      : 'var(--pbn-text, #e8eef4)',
                  border: '1px solid var(--pbn-border)',
                }}
              >
                📍 {city}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              className="text-base font-bold"
              style={{
                color: 'var(--pbn-text, #e8eef4)',
                fontFamily: 'var(--pbn-font-ui, sans-serif)',
              }}
            >
              Browse by Category
            </h2>
            <span className="text-xs font-mono" style={{ color: 'var(--pbn-text-muted)' }}>
              {totalBusinessCount ? `${totalBusinessCount} active listings` : `${items.length} loaded`}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected ? 'shadow-none' : 'hover:bg-white/[0.04]'
                  }`}
                  style={{
                    background: isSelected ? 'var(--pbn-accent, #4fd1c5)' : 'var(--pbn-bg-raised, #101a24)',
                    color: isSelected ? 'var(--pbn-on-accent, #0a1118)' : 'var(--pbn-text, #e8eef4)',
                    border: '1px solid var(--pbn-border)',
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filter Chips (Requirement B4) */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            <span className="text-xs text-[var(--pbn-text-muted)] font-mono">Active filters:</span>
            {selectedCategory !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/[0.06] border border-[var(--pbn-border)] text-[var(--pbn-text)]">
                Category: {selectedCategory}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  aria-label="Remove category filter"
                  className="hover:text-red-400 font-bold ml-0.5"
                >
                  ×
                </button>
              </span>
            )}
            {cityInput.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/[0.06] border border-[var(--pbn-border)] text-[var(--pbn-text)]">
                City: {cityInput.trim()}
                <button
                  type="button"
                  onClick={() => {
                    setCityInput('');
                    setDebouncedCity('');
                  }}
                  aria-label="Remove city filter"
                  className="hover:text-red-400 font-bold ml-0.5"
                >
                  ×
                </button>
              </span>
            )}
            {searchInput.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/[0.06] border border-[var(--pbn-border)] text-[var(--pbn-text)]">
                Query: {searchInput.trim()}
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setDebouncedSearch('');
                  }}
                  aria-label="Remove search filter"
                  className="hover:text-red-400 font-bold ml-0.5"
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-[var(--pbn-accent)] hover:underline ml-1 font-mono"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Virtualized Discovery List (Requirements B2 & B3) */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : items.length === 0 ? (
            <div
              className="p-12 text-center rounded-xl"
              style={{
                border: '1px solid var(--pbn-border)',
                background: 'var(--pbn-bg-raised, #101a24)',
              }}
            >
              <div
                className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(255, 255, 255, 0.04)' }}
              >
                <span className="material-symbols-outlined text-2xl text-[var(--pbn-accent)]">
                  search_off
                </span>
              </div>
              <h3 className="font-bold text-base mb-1" style={{ color: 'var(--pbn-text)' }}>
                No businesses match this filter.
              </h3>
              <p className="text-xs mb-4" style={{ color: 'var(--pbn-text-muted)' }}>
                Try selecting "All Services" or clearing your active search and city filters.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: 'var(--pbn-accent, #4fd1c5)',
                  color: 'var(--pbn-on-accent, #0a1118)',
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div
              ref={parentRef}
              data-testid="virtual-list-container"
              className="w-full overflow-y-auto rounded-xl scrollbar-thin"
              style={{
                maxHeight: '680px',
                minHeight: '320px',
                border: '1px solid var(--pbn-border)',
                background: 'var(--pbn-bg, #0a1118)',
              }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const b = items[virtualRow.index];
                  if (!b) return null;
                  return (
                    <div
                      key={b.id}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <CompactBusinessRow business={b} />
                    </div>
                  );
                })}
              </div>

              {/* Sentinel element for IntersectionObserver */}
              <div
                ref={sentinelRef}
                data-testid="scroll-sentinel"
                style={{ height: '24px', width: '100%' }}
              />

              {/* Subsequent page loading state */}
              {isFetchingNextPage && (
                <div className="py-3 text-center font-mono text-xs text-[var(--pbn-text-muted)] animate-pulse">
                  Loading more...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
