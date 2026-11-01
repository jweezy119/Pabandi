import DashboardLayout from '../../components/DashboardLayout';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getAuthToken } from '../../utils/authToken';
import { HalalBanner } from '../../components/halal';
import { ClayCard } from '../../components/clay/ClayCard';
import BookingSearchBar from '../../components/BookingSearchBar';

const NAV_ITEMS = [
  { path: '/booking', label: 'Discovery', icon: 'explore', end: true },
  { path: '/booking/flow', label: 'Bookings', icon: 'event' },
  { path: '/booking#favorites', label: 'Favorites', icon: 'favorite' },
  { path: '/booking#map', label: 'Map', icon: 'map' },
];

const CATEGORIES = [
  { id: 'RESTAURANT', label: 'Restaurants', icon: 'restaurant' },
  { id: 'SALON', label: 'Salons', icon: 'content_cut' },
  { id: 'SPA', label: 'Spas', icon: 'spa' },
  { id: 'HOTEL', label: 'Hotels', icon: 'hotel' },
  { id: 'FITNESS_CENTER', label: 'Fitness', icon: 'fitness_center' },
  { id: 'EVENT_VENUE', label: 'Venues', icon: 'celebration' },
];

function ClayStat({ icon, value, label, trend, color = 'terracotta' }: { icon: string; value: string | number; label: string; trend?: string; color?: string }) {
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
        <div className={`w-11 h-11 rounded-xl ${colorMap[color]} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-white text-[20px]">{icon}</span>
        </div>
      </div>
    </ClayCard>
  );
}

function BusinessCard({ business }: { business: any }) {
  return (
    <Link
      to={`/book/slug/${business.id}`}
      className="block"
    >
      <ClayCard className="overflow-hover" hover={true}>
        <div className="relative h-40 overflow-hidden rounded-xl mb-3 bg-[var(--warm-sand)]">
          <div className="absolute top-3 right-3 flex gap-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--sage)', color: 'white' }}>
              ⭐ {business.rating || 5}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--clay)', color: 'white' }}>
              Open
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-bold" style={{ color: 'var(--warm-ink)' }}>{business.name}</h3>
            <span className="text-sm font-medium" style={{ color: 'var(--clay)' }}>{business.price || '$$'}</span>
          </div>
          <p className="text-sm mb-2" style={{ color: 'var(--soft-stone)' }}>{business.category}</p>
          <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--soft-stone)]">
            <span>{business.city}</span>
            <span>·</span>
            <span>{business.category}</span>
          </div>
        </div>
      </ClayCard>
    </Link>
  );
}

export default function BookingOSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          setLoadingClients(false);
          return;
        }
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setClients(data.data || []);
        }
      } catch (e) { console.error('Failed to fetch clients:', e); } finally { setLoadingClients(false); }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          setLoadingBusinesses(false);
          return;
        }
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/booking/businesses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setBusinesses(data.data || []);
        }
      } catch (e) { console.error('Failed to fetch businesses:', e); } finally { setLoadingBusinesses(false); }
    };
    fetchBusinesses();
  }, []);

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredBusinesses = businesses.filter(b =>
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category?.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(b =>
    selectedCategory === null || b.category === selectedCategory
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/booking?search=${encodeURIComponent(searchQuery.trim())}&category=${selectedCategory || 'ALL'}`);
    }
  };

  return (
    <DashboardLayout osName="BookingOS" osIcon="◈" osColor="terracotta" navItems={NAV_ITEMS}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--warm-ink)' }}>Discover</h1>
          <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Find restaurants, salons, spas, and more near you.</p>
        </div>

        {/* Halal compliance banner */}
        <HalalBanner compact />

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ClayStat icon="storefront" value={businesses.length} label="Businesses" color="terracotta" />
          <ClayStat icon="calendar_month" value="12" label="Bookings" trend="+8 this month" color="sage" />
          <ClayStat icon="star" value="4.7" label="Avg Rating" color="ochre" />
          <ClayStat icon="account_balance_wallet" value="$0.00" label="Spending" color="sky-wash" />
          <ClayStat icon="verified" value={String(businesses.filter(b => b.halalCertified).length)} label="Halal Businesses" color="sage" />
        </div>

        {/* Search section */}
        <BookingSearchBar
          results={businesses.map(b => ({
            id: b.id,
            name: b.name,
            category: b.category,
            rating: b.rating || 5,
            address: b.address || '',
            city: b.city || '',
            image: b.logoUrl,
            trustScore: b.trustScore,
          }))}
          onResultClick={(id) => navigate(`/book/slug/${id}`)}
        />

        {/* Shared ContactOS Clients */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Your Clients</h2>
            <Link to="/contact/clients" className="text-sm font-medium" style={{ color: 'var(--clay)' }}>View all →</Link>
          </div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search clients..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-full text-sm focus:outline-none"
              style={{ background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.3)', color: 'var(--warm-ink)' }}
            />
          </div>
          {loadingClients ? (
            <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading clients...</div>
          ) : filteredClients.length === 0 ? (
            <ClayCard className="p-8 text-center" hover={false}>
              <p style={{ color: 'var(--soft-stone)' }}>{clientSearch ? 'No matching clients.' : 'No clients yet. Add your first client in ContactOS.'}</p>
            </ClayCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.slice(0, 6).map((client: any) => (
                <Link key={client.id} to={`/contact/clients/${client.id}`} className="block">
                  <ClayCard className="p-4" hover={true}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--warm-sand)', color: 'var(--warm-ink)' }}>
                        {client.name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--warm-ink)' }}>{client.name}</p>
                        <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>{client.email || 'No email'}</p>
                      </div>
                    </div>
                  </ClayCard>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
