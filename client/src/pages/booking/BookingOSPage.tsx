import DashboardLayout from '../../components/DashboardLayout';
import { Link } from 'react-router-dom';
import { useState } from 'react';

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

const BUSINESSES = [
  { id: '1', name: 'The Golden Fork', category: 'Restaurant', rating: 4.8, reviews: 124, price: '$$', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400', isOpen: true },
  { id: '2', name: 'Bella Salon', category: 'Salon', rating: 4.9, reviews: 89, price: '$$', image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400', isOpen: true },
  { id: '3', name: 'Serenity Spa', category: 'Spa', rating: 4.7, reviews: 56, price: '$$$', image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400', isOpen: false },
  { id: '4', name: 'Skyline Lounge', category: 'Nightlife', rating: 4.6, reviews: 203, price: '$$$', image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400', isOpen: true },
  { id: '5', name: 'CozyNest Rentals', category: 'Apartment', rating: 4.5, reviews: 42, price: '$$', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', isOpen: true },
  { id: '6', name: 'Grand Hotel', category: 'Hotel', rating: 4.8, reviews: 312, price: '$$$$', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400', isOpen: true },
];

function ClayCard({ children, className = '', hover = true, ...props }: any) {
  return (
    <div
      className={`rounded-[28px] bg-white transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{ boxShadow: '0 4px 20px rgba(180,130,90,0.12)' }}
      {...props}
    >
      {children}
    </div>
  );
}

function ClayButton({ children, variant = 'primary', className = '', ...props }: any) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer border-2';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--clay)] text-white border-[var(--clay)] hover:bg-[var(--terracotta)] hover:border-[var(--terracotta)] hover:-translate-y-0.5 active:scale-95',
    secondary: 'bg-transparent text-[var(--warm-ink)] border-[var(--soft-stone)] hover:border-[var(--clay)] hover:text-[var(--clay)]',
    ghost: 'bg-transparent text-[var(--soft-stone)] border-transparent hover:bg-[var(--warm-sand)]',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function ClayStat({ icon, value, label, trend, color = 'terracotta' }: { icon: string; value: string; label: string; trend?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    terracotta: 'bg-[var(--clay)]',
    sage: 'bg-[var(--sage)]',
    'dusty-rose': 'bg-[var(--dusty-rose)]',
    ochre: 'bg-[var(--muted-ochre)]',
    'sky-wash': 'bg-[var(--sky-wash)]',
  };
  return (
    <ClayCard className="p-5" hover={false}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm mb-1" style={{ color: 'var(--soft-stone)' }}>{label}</p>
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

function BusinessCard({ business }: { business: typeof BUSINESSES[0] }) {
  return (
    <ClayCard className="overflow-hidden">
      <div className="relative h-40 overflow-hidden">
        <img src={business.image} alt={business.name} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: business.isOpen ? 'var(--sage)' : 'var(--soft-stone)', color: 'white' }}>
          {business.isOpen ? 'Open' : 'Closed'}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold" style={{ color: 'var(--warm-ink)' }}>{business.name}</h3>
          <span className="text-sm font-medium" style={{ color: 'var(--clay)' }}>{business.price}</span>
        </div>
        <p className="text-sm mb-2" style={{ color: 'var(--soft-stone)' }}>{business.category}</p>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--muted-ochre)' }}>★ {business.rating}</span>
          <span className="text-sm" style={{ color: 'var(--soft-stone)' }}>({business.reviews} reviews)</span>
        </div>
      </div>
    </ClayCard>
  );
}

export default function BookingOSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <DashboardLayout osName="BookingOS" osIcon="◈" osColor="terracotta" navItems={NAV_ITEMS}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--warm-ink)' }}>Discover</h1>
          <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Find restaurants, salons, spas, and more near you.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ClayStat icon="storefront" value="24" label="Businesses" trend="+3 this week" color="terracotta" />
          <ClayStat icon="calendar_month" value="12" label="Bookings" trend="+8 this month" color="sage" />
          <ClayStat icon="star" value="4.7" label="Avg Rating" color="ochre" />
          <ClayStat icon="account_balance_wallet" value="$0.00" label="Spending" color="sky-wash" />
        </div>

        {/* Search and filters */}
        <ClayCard className="p-4" hover={false}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--soft-stone)' }}>search</span>
              <input
                type="text"
                placeholder="Search businesses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full text-sm focus:outline-none"
                style={{ background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.3)', color: 'var(--warm-ink)' }}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <ClayButton variant={selectedCategory === null ? 'primary' : 'secondary'} onClick={() => setSelectedCategory(null)}>
                All
              </ClayButton>
              {CATEGORIES.slice(0, 4).map((cat) => (
                <ClayButton
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'primary' : 'secondary'}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </ClayButton>
              ))}
            </div>
          </div>
        </ClayCard>

        {/* Business grid */}
        <div>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Near You</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUSINESSES.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
