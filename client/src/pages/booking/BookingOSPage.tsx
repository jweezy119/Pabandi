import DashboardLayout from '../../components/DashboardLayout';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { getAuthToken } from '../../utils/authToken';
import { HalalBanner } from '../../components/halal';
import { ClayCard } from '../../components/clay/ClayCard';
import BookingSearchBar from '../../components/BookingSearchBar';
import { LiveNetworkWidget } from '../../components/live-network/LiveNetworkWidget';
import { apiClient } from '../../services/api';

const NAV_ITEMS = [
  { path: '/booking', label: 'Discovery', icon: 'explore', end: true },
  { path: '/booking/map', label: 'Map', icon: 'map' },
  { path: '/me/bookings', label: 'My Bookings', icon: 'event' },
  { path: '/simulator', label: 'Project Simulator', icon: 'model_training' },
  { path: '/contact', label: 'Business CRM', icon: 'storefront' },
  { path: '/sandbox', label: 'Trust Sandbox', icon: 'verified_user' },
];

interface BusinessListing {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  trustScore?: number;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  isVerified?: boolean;
  isClaimed?: boolean;
  requireDeposit?: boolean;
  depositAmount?: number;
  ownerName?: string;
  source?: 'github' | 'openstreetmap' | 'pabandi' | 'osm' | string;
}

interface CrmClientItem {
  id: string;
  name?: string;
  email?: string;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Services', icon: 'apps' },
  { id: 'FREELANCE', label: 'Freelancers & Tech', icon: 'terminal' },
  { id: 'RESTAURANT', label: 'Restaurants', icon: 'restaurant' },
  { id: 'SALON', label: 'Salons', icon: 'content_cut' },
  { id: 'CLINIC', label: 'Clinics & Health', icon: 'local_hospital' },
  { id: 'SPA', label: 'Spas & Wellness', icon: 'spa' },
  { id: 'FITNESS_CENTER', label: 'Fitness & Gyms', icon: 'fitness_center' },
  { id: 'EVENT_VENUE', label: 'Venues', icon: 'celebration' },
];

function ClayStat({
  icon,
  value,
  label,
  trend,
  color = 'terracotta',
}: {
  icon: string;
  value: string | number;
  label: string;
  trend?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    terracotta: 'bg-[var(--clay)]',
    sage: 'bg-[var(--sage)]',
    'dusty-rose': 'bg-[var(--dusty-rose)]',
    ochre: 'bg-[var(--muted-ochre)]',
    'sky-wash': 'bg-[var(--sky-wash)]',
  };
  return (
    <ClayCard className="p-4" hover={false}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--soft-stone)' }}>{label}</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>{value}</p>
          {trend && <p className="text-xs mt-1" style={{ color: 'var(--sage)' }}>{trend}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${colorMap[color] || 'bg-[var(--clay)]'} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-[var(--warm-ink)] text-[20px]">{icon}</span>
        </div>
      </div>
    </ClayCard>
  );
}

function BusinessCard({ business }: { business: BusinessListing }) {
  const targetUrl = `/book/slug/${business.slug || business.id}`;
  const displayImage =
    business.coverImageUrl ||
    business.logoUrl ||
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=600';

  return (
    <Link to={targetUrl} className="block group h-full">
      <ClayCard className="overflow-hidden h-full flex flex-col justify-between" hover={true}>
        <div>
          <div className="relative h-44 overflow-hidden rounded-xl mb-3 bg-[var(--warm-sand)]">
            <img
              src={displayImage}
              alt={business.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {/* Top Right: Rating and Trust Score */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-sm"
                style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--warm-ink)' }}
              >
                ⭐ {business.rating ? Number(business.rating).toFixed(1) : '5.0'}
              </span>
              {business.trustScore && (
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm"
                  style={{ background: 'var(--sage)', color: 'white' }}
                >
                  {Math.round(business.trustScore)} Trust
                </span>
              )}
            </div>

            {/* Top Left: Authentic Open-Source Origin Badge */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1">
              {business.source === 'github' ? (
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-sm flex items-center gap-1"
                  style={{ background: 'rgba(28,25,23,0.88)', color: 'white' }}
                >
                  <span className="text-[13px]">🐙</span> GitHub Dev
                </span>
              ) : business.source === 'openstreetmap' ? (
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-sm flex items-center gap-1"
                  style={{ background: 'rgba(15,118,110,0.92)', color: 'white' }}
                >
                  <span className="text-[13px]">🗺️</span> OpenStreetMap
                </span>
              ) : (
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-sm flex items-center gap-1"
                  style={{ background: 'rgba(197,110,74,0.92)', color: 'white' }}
                >
                  <span>✓</span> Verified Partner
                </span>
              )}
            </div>

            {business.category === 'FREELANCE' && (
              <div className="absolute bottom-3 left-3">
                <span
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm"
                  style={{ background: 'rgba(28,25,23,0.85)', color: 'var(--cream)' }}
                >
                  Freelance Specialist
                </span>
              </div>
            )}
          </div>

          <div className="px-1">
            <div className="flex items-start justify-between gap-1 mb-1.5">
              <h3
                className="font-bold text-base leading-snug group-hover:text-[var(--clay)] transition-colors line-clamp-1"
                style={{ color: 'var(--warm-ink)' }}
              >
                {business.name}
              </h3>
              {business.isVerified && (
                <span
                  className="material-symbols-outlined text-sm shrink-0"
                  style={{ color: 'var(--sage)' }}
                  title="Verified Profile & Trust Score"
                >
                  verified
                </span>
              )}
            </div>

            <p className="text-xs line-clamp-2 mb-2 leading-relaxed" style={{ color: 'var(--soft-stone)' }}>
              {business.description || `${business.category} services backed by Pabandi smart escrow.`}
            </p>

            {business.website && (
              <div className="mb-2">
                <a
                  href={business.website}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline"
                  style={{ color: 'var(--clay)' }}
                >
                  {business.source === 'github'
                    ? 'View GitHub Profile ↗'
                    : business.source === 'openstreetmap'
                    ? 'View OpenStreetMap POI ↗'
                    : 'Visit Official Site ↗'}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-[rgba(191,179,163,0.25)] flex items-center justify-between text-xs mt-2 px-1">
          <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--warm-ink)' }}>
            <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--clay)' }}>
              location_on
            </span>
            {business.city || 'Remote'}
          </span>
          <span
            className="font-semibold px-2.5 py-1 rounded-md text-xs"
            style={{ background: 'var(--warm-sand)', color: 'var(--clay)' }}
          >
            {business.requireDeposit ? `$${business.depositAmount || 50} Escrow` : 'Instant Booking'}
          </span>
        </div>
      </ClayCard>
    </Link>
  );
}

export default function BookingOSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [businesses, setBusinesses] = useState<BusinessListing[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [clients, setClients] = useState<CrmClientItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [totalBusinessCount, setTotalBusinessCount] = useState<number | null>(null);
  const navigate = useNavigate();

  // Load real business count from /api/v1/businesses/count
  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/businesses/count')
      .then((res) => {
        if (isMounted && res.data && typeof res.data.count === 'number') {
          setTotalBusinessCount(res.data.count);
        }
      })
      .catch((err: unknown) => {
        console.warn('Business count fetch fallback to raw fetch:', err);
        fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/businesses/count`)
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => {
            if (isMounted && json && typeof json.count === 'number') {
              setTotalBusinessCount(json.count);
            }
          })
          .catch(() => {});
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load businesses publicly (accessible without auth)
  useEffect(() => {
    let isMounted = true;
    const fetchBusinesses = async () => {
      setLoadingBusinesses(true);
      try {
        const token = getAuthToken();
        if (token) {
          setIsAuthenticated(true);
        }

        const res = await apiClient.get('/booking/businesses');
        if (isMounted && res.data?.data) {
          setBusinesses(res.data.data);
        }
      } catch (e: unknown) {
        console.warn('apiClient fetch failed, falling back to window.fetch:', e);
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/booking/businesses`
          );
          if (res.ok) {
            const json = await res.json();
            if (isMounted && json.data) {
              setBusinesses(json.data);
            }
          }
        } catch (fetchErr: unknown) {
          console.error('Failed to fetch businesses:', fetchErr);
        }
      } finally {
        if (isMounted) setLoadingBusinesses(false);
      }
    };

    fetchBusinesses();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch ContactOS clients only if authenticated as a business/provider
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    let isMounted = true;
    setLoadingClients(true);
    fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json?.data) {
          setClients(json.data);
        }
      })
      .catch((err) => console.warn('Clients optional:', err))
      .finally(() => {
        if (isMounted) setLoadingClients(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      // Category filter
      if (selectedCategory !== 'ALL' && b.category !== selectedCategory) {
        return false;
      }
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = b.name.toLowerCase().includes(q);
        const matchDesc = b.description?.toLowerCase().includes(q);
        const matchCity = b.city?.toLowerCase().includes(q);
        const matchCat = b.category.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCity && !matchCat) return false;
      }
      // Location filter
      if (locationInput.trim()) {
        const loc = locationInput.toLowerCase().trim();
        const matchCity = b.city?.toLowerCase().includes(loc);
        const matchAddress = b.address?.toLowerCase().includes(loc);
        if (!matchCity && !matchAddress) return false;
      }
      return true;
    });
  }, [businesses, selectedCategory, searchQuery, locationInput]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase().trim();
    return clients.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  const freelanceCount = useMemo(
    () => businesses.filter((b) => b.category === 'FREELANCE').length,
    [businesses]
  );

  return (
    <DashboardLayout osName="BookingOS" osIcon="◈" osColor="terracotta" navItems={NAV_ITEMS}>
      <div className="space-y-7 max-w-6xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--warm-ink)' }}>
              Discovery & Booking
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--soft-stone)' }}>
              Explore verified service businesses and elite freelancers. Every appointment and milestone is backed by non-custodial smart escrow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/me/bookings"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--warm-sand)',
                border: '1px solid rgba(191,179,163,0.35)',
                color: 'var(--warm-ink)',
              }}
            >
              My Bookings
            </Link>
            <Link
              to="/simulator"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
              style={{ background: 'var(--clay)', color: 'white' }}
            >
              Simulate Deal
            </Link>
          </div>
        </div>

        {/* Location & Quick Search Filter */}
        <div
          className="rounded-2xl p-4 md:p-5"
          style={{ background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.35)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--clay)' }}>
              <span className="material-symbols-outlined text-[20px]">location_on</span>
              <span className="text-xs uppercase tracking-wider text-[var(--soft-stone)]">Location:</span>
            </div>
            <input
              type="text"
              placeholder="Filter by city (e.g. Lahore, Karachi, Chicago, Remote)..."
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{
                background: 'white',
                border: '1px solid rgba(191,179,163,0.35)',
                color: 'var(--warm-ink)',
              }}
            />
            {locationInput && (
              <button
                onClick={() => setLocationInput('')}
                className="text-xs font-semibold px-3 py-2 rounded-lg text-[var(--soft-stone)] hover:text-[var(--warm-ink)]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Halal Compliance Banner */}
        <HalalBanner compact />

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ClayStat
            icon="storefront"
            value={totalBusinessCount ?? businesses.length}
            label="Active Businesses"
            trend={totalBusinessCount ? `${totalBusinessCount} Onboarded` : undefined}
            color="terracotta"
          />
          <ClayStat
            icon="terminal"
            value={freelanceCount}
            label="Tech & Freelancers"
            color="sage"
          />
          <ClayStat
            icon="verified_user"
            value="100%"
            label="Escrow Guarantee"
            trend="Solana / Card"
            color="ochre"
          />
          <ClayStat
            icon="shield"
            value="94+"
            label="Avg Trust Score"
            trend="Autonomous Scoring"
            color="sky-wash"
          />
        </div>

        {/* Search Bar Component */}
        <BookingSearchBar
          results={businesses.map((b) => ({
            id: b.slug || b.id,
            name: b.name,
            category: b.category,
            rating: b.rating || 5,
            address: b.address || '',
            city: b.city || '',
            image: b.logoUrl,
            trustScore: b.trustScore ? Math.round(b.trustScore) : undefined,
          }))}
          onResultClick={(id) => navigate(`/book/${id}`)}
        />

        {/* Category Pills Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>
              Browse by Category
            </h2>
            <span className="text-xs font-medium" style={{ color: 'var(--soft-stone)' }}>
              Showing {filteredBusinesses.length} results
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'shadow-sm'
                      : 'hover:bg-[rgba(191,179,163,0.25)]'
                  }`}
                  style={{
                    background: isSelected ? 'var(--clay)' : 'var(--warm-sand)',
                    color: isSelected ? 'white' : 'var(--warm-ink)',
                    border: isSelected ? 'none' : '1px solid rgba(191,179,163,0.3)',
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Businesses and Freelancers Grid */}
        <div>
          {loadingBusinesses ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <ClayCard key={idx} className="p-4 animate-pulse h-64" hover={false}>
                  <div className="h-40 bg-[var(--warm-sand)] rounded-xl mb-3" />
                  <div className="h-4 bg-[var(--warm-sand)] rounded w-3/4 mb-2" />
                  <div className="h-3 bg-[var(--warm-sand)] rounded w-1/2" />
                </ClayCard>
              ))}
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <ClayCard className="p-12 text-center" hover={false}>
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{ background: 'var(--warm-sand)' }}
              >
                <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--clay)' }}>
                  search_off
                </span>
              </div>
              <h3 className="font-bold text-base mb-1" style={{ color: 'var(--warm-ink)' }}>
                No providers match your criteria
              </h3>
              <p className="text-xs mb-4" style={{ color: 'var(--soft-stone)' }}>
                Try selecting "All Services" or clearing your search filters.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSearchQuery('');
                  setLocationInput('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'var(--clay)', color: 'white' }}
              >
                Reset Filters
              </button>
            </ClayCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBusinesses.map((b) => (
                <BusinessCard key={b.id} business={b} />
              ))}
            </div>
          )}
        </div>

        {/* Live Network Widget */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>
              Live Trust & Settlement Activity
            </h2>
          </div>
          <LiveNetworkWidget
            className="rounded-2xl p-4 md:p-6"
            style={{ background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.35)' }}
          />
        </div>

        {/* ContactOS Clients (Only for Business Mode / Authenticated Providers) */}
        {isAuthenticated && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>
                  Your Client Directory (ContactOS)
                </h2>
                <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
                  Directly schedule or send escrow proposals to existing clients.
                </p>
              </div>
              <Link to="/contact/clients" className="text-sm font-semibold" style={{ color: 'var(--clay)' }}>
                View all in ContactOS →
              </Link>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search your clients..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{
                  background: 'var(--warm-sand)',
                  border: '1px solid rgba(191,179,163,0.3)',
                  color: 'var(--warm-ink)',
                }}
              />
            </div>

            {loadingClients ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--soft-stone)' }}>
                Loading client directory...
              </div>
            ) : filteredClients.length === 0 ? (
              <ClayCard className="p-8 text-center" hover={false}>
                <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
                  {clientSearch ? 'No clients match your search.' : 'No clients found in your CRM yet.'}
                </p>
              </ClayCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.slice(0, 6).map((client) => (
                  <Link key={client.id} to={`/contact/clients/${client.id}`} className="block">
                    <ClayCard className="p-4" hover={true}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm"
                          style={{ background: 'var(--clay)', color: 'white' }}
                        >
                          {client.name?.charAt(0) || 'C'}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--warm-ink)' }}>
                            {client.name || 'Unnamed Client'}
                          </p>
                          <p className="text-xs truncate" style={{ color: 'var(--soft-stone)' }}>
                            {client.email || 'No email provided'}
                          </p>
                        </div>
                      </div>
                    </ClayCard>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
