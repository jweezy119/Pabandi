import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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

const CATEGORY_ACCENTS: Record<string, string> = {
  ROOFING: 'rgba(201, 123, 90, 0.14)',
  HVAC: 'rgba(138, 154, 123, 0.16)',
  SECURITY: 'rgba(184, 201, 212, 0.25)',
  FREELANCE: 'rgba(217, 168, 84, 0.16)',
  RESTAURANT: 'rgba(212, 165, 165, 0.2)',
  SALON: 'rgba(212, 165, 165, 0.2)',
  CLINIC: 'rgba(138, 154, 123, 0.16)',
  SPA: 'rgba(212, 165, 165, 0.18)',
};

function MonogramAvatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'md' | 'lg' }) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'lg' ? 'w-14 h-14 rounded-2xl text-base' : 'w-11 h-11 rounded-xl text-sm';

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={`${dim} object-cover border border-[rgba(191,179,163,0.35)] shrink-0 shadow-sm`}
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
      className={`${dim} flex items-center justify-center font-bold shrink-0 select-none shadow-sm`}
      style={{
        background: 'linear-gradient(135deg, var(--clay), var(--terracotta))',
        color: '#fff',
        fontFamily: 'var(--font-label)',
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function BusinessServiceCard({ business, index }: { business: BusinessItem; index: number }) {
  const targetUrl = `/book/${business.id}`;
  const trustScore = business.trustBand === 'TOP' ? 950 : business.trustBand === 'VERIFIED' ? 900 : 820;
  const catTint = CATEGORY_ACCENTS[business.category] || 'rgba(232, 217, 197, 0.45)';

  return (
    <motion.div
      data-testid="business-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.24), ease: [0.22, 1, 0.36, 1] }}
      className="clay-card clay-card--interactive flex flex-col justify-between p-5 bg-white"
    >
      <div>
        {/* Top Row: Avatar + Name + Rating */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MonogramAvatar name={business.name} avatarUrl={business.avatarUrl} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  to={targetUrl}
                  className="font-headline font-bold text-base text-[var(--warm-ink)] hover:text-[var(--terracotta)] transition-colors line-clamp-1"
                >
                  {business.name}
                </Link>
                {business.website && (
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noreferrer"
                    title="Visit website"
                    aria-label={`Visit ${business.name} website`}
                    className="text-[var(--soft-stone)] hover:text-[var(--terracotta)] shrink-0 compact-touch"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--soft-stone)] mt-0.5">
                <span className="material-symbols-outlined text-[14px] text-[var(--clay)]">location_on</span>
                <span className="truncate">{business.city || 'Remote'}</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] text-xs font-bold text-[var(--warm-ink)]">
            <span className="text-amber-500">★</span>
            <span>{business.rating.toFixed(1)}</span>
            <span className="text-[10px] font-normal text-[var(--soft-stone)]">({business.reviewCount})</span>
          </div>
        </div>

        {/* Category + Trust + Escrow Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4">
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-[var(--warm-ink)]"
            style={{ background: catTint }}
          >
            {business.category.replace(/_/g, ' ')}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--sage)]/15 text-[#4f6142] border border-[var(--sage)]/25">
            {business.trustBand}
          </span>
          <ZkTrustBadge
            score={trustScore}
            disputeRate={0.4}
            subjectName={business.name}
            subjectId={business.id}
            variant="compact"
          />
        </div>

        {business.description && (
          <p className="text-xs text-[var(--soft-stone)] mt-3 line-clamp-2 leading-relaxed">
            {business.description}
          </p>
        )}
      </div>

      {/* Footer: Starting Price / Escrow + Primary CTA */}
      <div className="mt-5 pt-4 border-t border-[rgba(191,179,163,0.22)] flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-label uppercase tracking-wider text-[var(--soft-stone)]">
            {business.escrowEnabled ? 'Escrow Protected' : 'Starting From'}
          </div>
          <div className="money-number text-lg text-[var(--warm-ink)]">
            ${business.startingPrice > 0 ? business.startingPrice.toLocaleString() : '50'}
            <span className="text-xs font-body font-normal text-[var(--soft-stone)] ml-1">deposit</span>
          </div>
        </div>

        <Link
          to={targetUrl}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-white shadow-[var(--shadow-btn)] hover:shadow-[var(--shadow-btn-hover)] active:scale-95 transition-all touch-target"
          style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
        >
          <span>Book Now</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </motion.div>
  );
}

function CompactBusinessRow({ business }: { business: BusinessItem }) {
  const targetUrl = `/book/${business.id}`;

  return (
    <div
      data-testid="business-row"
      className="flex items-center justify-between gap-3 p-3.5 mx-2 my-1 rounded-2xl transition-colors bg-white hover:bg-[var(--cream)]/60 border border-[rgba(191,179,163,0.28)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <MonogramAvatar name={business.name} avatarUrl={business.avatarUrl} />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={targetUrl}
              className="font-bold text-sm truncate text-[var(--warm-ink)] hover:text-[var(--terracotta)] transition-colors"
            >
              {business.name}
            </Link>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 bg-[var(--sage)]/15 text-[#4f6142]">
              {business.trustBand}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--soft-stone)] mt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-[var(--cream)] text-[11px] font-medium">
              {business.category}
            </span>
            <span className="flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[13px] text-[var(--clay)]">location_on</span>
              {business.city}
            </span>
            {business.escrowEnabled && (
              <span className="text-[11px] text-[var(--terracotta)] font-semibold">
                · ${business.startingPrice} Escrow
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block text-xs text-[var(--warm-ink)]">
          <div className="text-amber-500 font-bold">★ {business.rating.toFixed(1)}</div>
          <div className="text-[10px] text-[var(--soft-stone)]">({business.reviewCount})</div>
        </div>

        <Link
          to={targetUrl}
          className="px-4 py-2 rounded-full text-xs font-bold text-white shadow-[var(--shadow-btn)] transition-all hover:opacity-95 touch-target flex items-center"
          style={{ background: 'var(--clay)' }}
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
      className="clay-card p-5 animate-pulse space-y-4 bg-white"
    >
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-[var(--warm-sand)]/60" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-3/4 bg-[var(--warm-sand)]/60 rounded-full" />
          <div className="h-3 w-1/2 bg-[var(--warm-sand)]/40 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-20 bg-[var(--warm-sand)]/50 rounded-full" />
        <div className="h-6 w-16 bg-[var(--warm-sand)]/40 rounded-full" />
      </div>
      <div className="pt-3 border-t border-[rgba(191,179,163,0.2)] flex justify-between items-center">
        <div className="h-6 w-20 bg-[var(--warm-sand)]/50 rounded-full" />
        <div className="h-10 w-28 bg-[var(--warm-sand)]/70 rounded-full" />
      </div>
    </div>
  );
}

export default function BookingOSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const [items, setItems] = useState<BusinessItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [totalBusinessCount, setTotalBusinessCount] = useState<number | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cardSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCity(cityInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [cityInput]);

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

  const fetchPage = useCallback(
    async (cursorParam?: string | null, isNext = false) => {
      if (isNext) {
        setIsFetchingNextPage(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams();
        params.set('limit', '18');
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

  useEffect(() => {
    fetchPage(null, false);
  }, [fetchPage]);

  // Infinite scroll for list mode
  useEffect(() => {
    if (viewMode !== 'list' || !nextCursor || isFetchingNextPage || isLoading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !isFetchingNextPage) {
          fetchPage(nextCursor, true);
        }
      },
      { root: parentRef.current, rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [viewMode, nextCursor, isFetchingNextPage, isLoading, fetchPage]);

  // Infinite scroll for card grid mode
  useEffect(() => {
    if (viewMode !== 'cards' || !nextCursor || isFetchingNextPage || isLoading) return;
    const sentinel = cardSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !isFetchingNextPage) {
          fetchPage(nextCursor, true);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [viewMode, nextCursor, isFetchingNextPage, isLoading, fetchPage]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 82,
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
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="clay-label">Verified Service Marketplace</span>
            <h1 className="clay-heading text-2xl sm:text-3xl mt-1">
              Book a Verified Provider
            </h1>
            <p className="text-sm text-[var(--soft-stone)] mt-1 max-w-xl leading-relaxed">
              Pick a category, compare trust scores &amp; escrow deposits, and book an instant slot with zero guesswork.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/booking/map"
              className="px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-white border border-[rgba(191,179,163,0.35)] text-[var(--warm-ink)] hover:bg-[var(--cream)] transition-all inline-flex items-center gap-1.5 touch-target"
            >
              <span className="material-symbols-outlined text-[17px] text-[var(--clay)]">map</span>
              Map View
            </Link>
            <Link
              to="/me/bookings"
              className="px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-white border border-[rgba(191,179,163,0.35)] text-[var(--warm-ink)] hover:bg-[var(--cream)] transition-all inline-flex items-center gap-1.5 touch-target"
            >
              <span className="material-symbols-outlined text-[17px] text-[var(--sage)]">event</span>
              My Bookings
            </Link>
            <Link
              to="/simulator"
              className="px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white shadow-[var(--shadow-btn)] transition-all inline-flex items-center gap-1.5 touch-target"
              style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
            >
              <span className="material-symbols-outlined text-[17px]">architecture</span>
              Simulate Deal
            </Link>
          </div>
        </div>

        {/* Halal Compliance Banner */}
        <HalalBanner compact />

        {/* Search & Location Card */}
        <div className="clay-card p-4 sm:p-5 bg-white space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-[var(--soft-stone)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder="What service do you need? (e.g. plumber, HVAC, design...)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="clay-field-input w-full pl-10 pr-9"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--soft-stone)] hover:text-[var(--warm-ink)] compact-touch"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-[var(--clay)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                location_on
              </span>
              <input
                type="text"
                placeholder="City or Remote (e.g. Chicago, Lahore, Karachi)..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                className="clay-field-input w-full pl-10 pr-9"
              />
              {cityInput && (
                <button
                  type="button"
                  onClick={() => setCityInput('')}
                  aria-label="Clear city"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--soft-stone)] hover:text-[var(--warm-ink)] compact-touch"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
              <span className="text-[var(--soft-stone)] font-medium shrink-0 mr-1">Hubs:</span>
              {['Chicago', 'Austin', 'Lahore', 'Karachi', 'Remote'].map((city) => {
                const active = cityInput.toLowerCase() === city.toLowerCase();
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setCityInput(active ? '' : city)}
                    className={`px-3 py-1.5 rounded-full font-semibold shrink-0 transition-all compact-touch ${
                      active
                        ? 'bg-[var(--warm-ink)] text-white shadow-sm'
                        : 'bg-[var(--cream)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/70'
                    }`}
                  >
                    {city}
                  </button>
                );
              })}
            </div>

            {/* Cards / Compact List View Toggle */}
            <div className="inline-flex items-center p-1 rounded-full bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all compact-touch ${
                  viewMode === 'cards' ? 'bg-white text-[var(--warm-ink)] shadow-sm' : 'text-[var(--soft-stone)]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">grid_view</span>
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all compact-touch ${
                  viewMode === 'list' ? 'bg-white text-[var(--warm-ink)] shadow-sm' : 'text-[var(--soft-stone)]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">view_list</span>
                List
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-base text-[var(--warm-ink)]">
              Browse by Category
            </h2>
            <span className="text-xs font-semibold text-[var(--soft-stone)]">
              {totalBusinessCount ? `${totalBusinessCount} verified providers` : `${items.length} providers`}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors touch-target ${
                    isSelected
                      ? 'text-white'
                      : 'bg-white text-[var(--warm-ink)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]/40'
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="booking-cat-pill"
                      className="absolute inset-0 rounded-full shadow-[var(--shadow-btn)] pointer-events-none"
                      style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className="material-symbols-outlined text-[16px] relative z-10">{cat.icon}</span>
                  <span className="relative z-10">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            <span className="text-xs text-[var(--soft-stone)] font-medium">Active filters:</span>
            {selectedCategory !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-white border border-[rgba(191,179,163,0.35)] text-[var(--warm-ink)] font-semibold">
                {selectedCategory.replace(/_/g, ' ')}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  aria-label="Remove category filter"
                  className="hover:text-[var(--terracotta)] font-bold ml-0.5 compact-touch"
                >
                  ×
                </button>
              </span>
            )}
            {cityInput.trim() && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-white border border-[rgba(191,179,163,0.35)] text-[var(--warm-ink)] font-semibold">
                📍 {cityInput.trim()}
                <button
                  type="button"
                  onClick={() => {
                    setCityInput('');
                    setDebouncedCity('');
                  }}
                  aria-label="Remove city filter"
                  className="hover:text-[var(--terracotta)] font-bold ml-0.5 compact-touch"
                >
                  ×
                </button>
              </span>
            )}
            {searchInput.trim() && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-white border border-[rgba(191,179,163,0.35)] text-[var(--warm-ink)] font-semibold">
                "{searchInput.trim()}"
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setDebouncedSearch('');
                  }}
                  aria-label="Remove search filter"
                  className="hover:text-[var(--terracotta)] font-bold ml-0.5 compact-touch"
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-[var(--terracotta)] hover:underline ml-1 compact-touch"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Providers Grid / List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : items.length === 0 ? (
          <div className="clay-card p-10 text-center bg-white">
            <div className="clay-empty-icon">
              <span className="material-symbols-outlined text-3xl text-[var(--clay)]">search_off</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-[var(--warm-ink)] mb-1">
              No providers match these filters
            </h3>
            <p className="text-sm text-[var(--soft-stone)] mb-5 max-w-md mx-auto">
              Try switching back to "All Services" or clearing your search and city filters.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-[var(--shadow-btn)]"
              style={{ background: 'var(--clay)' }}
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((business, idx) => (
                <BusinessServiceCard key={business.id} business={business} index={idx} />
              ))}
            </div>

            <div ref={cardSentinelRef} className="h-4" />

            {isFetchingNextPage && (
              <div className="py-4 text-center text-xs font-semibold text-[var(--soft-stone)] animate-pulse">
                Loading more verified providers...
              </div>
            )}

            {nextCursor && !isFetchingNextPage && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => fetchPage(nextCursor, true)}
                  className="px-6 py-2.5 rounded-full text-xs font-bold bg-white border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/40 transition-all shadow-sm"
                >
                  Load More Providers
                </button>
              </div>
            )}
          </>
        ) : (
          <div
            ref={parentRef}
            data-testid="virtual-list-container"
            className="w-full overflow-y-auto rounded-2xl p-2 bg-[var(--cream)] border border-[rgba(191,179,163,0.3)]"
            style={{ maxHeight: '680px', minHeight: '320px' }}
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

            <div ref={sentinelRef} data-testid="scroll-sentinel" style={{ height: '24px', width: '100%' }} />

            {isFetchingNextPage && (
              <div className="py-3 text-center text-xs text-[var(--soft-stone)] animate-pulse">
                Loading more...
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
