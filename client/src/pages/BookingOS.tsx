import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: '🍽️', color: 'orange' },
  { id: 'bar', label: 'Bars', icon: '🍸', color: 'purple' },
  { id: 'cafe', label: 'Cafes', icon: '☕', color: 'amber' },
  { id: 'club', label: 'Clubs', icon: '🎵', color: 'pink' },
  { id: 'event', label: 'Events', icon: '🎉', color: 'cyan' },
  { id: 'hotel', label: 'Hotels', icon: '🏨', color: 'blue' },
  { id: 'theater', label: 'Theaters', icon: '🎭', color: 'red' },
  { id: 'museum', label: 'Museums', icon: '🏛️', color: 'green' },
];

export const BookingOS: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'discover' | 'reservations' | 'tickets'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('restaurant');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedGuests, setSelectedGuests] = useState(2);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<string>('');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            name: 'Current Location'
          });
        },
        () => {
          setLocation({ lat: 40.7589, lng: -73.9851, name: 'Times Square, New York' });
        }
      );
    } else {
      setLocation({ lat: 40.7589, lng: -73.9851, name: 'Times Square, New York' });
    }
  }, []);

  useEffect(() => {
    if (location) loadVenues();
  }, [location, selectedCategory]);

  const loadVenues = async () => {
    if (!location) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        categories: selectedCategory,
        radius: '10000',
        limit: '50',
      });
      const res = await fetch(`/api/v1/venues/search?${params}`);
      const data = await res.json();
      setVenues(data.data || []);
    } catch (e) {
      console.error('Failed to load venues:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/maps/geocode?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.data) {
        setLocation({ lat: data.data.lat, lng: data.data.lng, name: data.data.displayName });
      }
    } catch (e) {
      console.error('Failed to geocode:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (venueId: string) => {
    setFavorites(prev => prev.includes(venueId) ? prev.filter(id => id !== venueId) : [...prev, venueId]);
  };

  const getDirectionsUrl = (venue: any) =>
    `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;

  const filteredVenues = venues.filter(v => {
    if (priceFilter && v.price !== priceFilter) return false;
    if (ratingFilter && v.rating && v.rating < parseFloat(ratingFilter)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative bg-[#0f0f1a]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center font-bold text-sm shadow-lg shadow-rose-500/20">B</div>
              <div>
                <span className="text-lg font-bold tracking-tight">BookOS</span>
                <span className="text-[10px] text-gray-500 block">by Pabandi</span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1 bg-white/5 rounded-xl p-1">
              {(['discover', 'reservations', 'tickets'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 text-sm font-bold">U</div>
            ) : (
              <button onClick={() => navigate('/login')} className="px-4 py-2 bg-rose-500 text-white text-sm font-medium rounded-xl hover:bg-rose-600 shadow-lg shadow-rose-500/20">Sign In</button>
            )}
          </div>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {/* Hero Search */}
        {activeTab === 'discover' && (
          <section className="mb-10">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white via-rose-100 to-orange-200 bg-clip-text text-transparent">
                Find Your Perfect Table
              </h1>
              <p className="text-gray-400 max-w-2xl mx-auto text-sm">
                Discover and book the best restaurants, bars, clubs, and events near you. Real data from Yelp, Foursquare, and OpenStreetMap.
              </p>
            </div>

            <div className="bg-[#0f0f1a] rounded-2xl p-6 border border-white/5 shadow-2xl shadow-black/50">
              <div className="grid md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">Location</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">📍</span>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search city, neighborhood..."
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-rose-500/50 focus:bg-white/10 focus:outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-rose-500/50 focus:bg-white/10 focus:outline-none transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">Time</label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-rose-500/50 focus:bg-white/10 focus:outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-gray-900">Any time</option>
                    {['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map(t => (
                      <option key={t} value={t} className="bg-gray-900">{t}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">Guests</label>
                  <select
                    value={selectedGuests}
                    onChange={(e) => setSelectedGuests(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-rose-500/50 focus:bg-white/10 focus:outline-none transition-all appearance-none cursor-pointer"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <option key={n} value={n} className="bg-gray-900">{n} {n === 1 ? 'guest' : 'guests'}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-semibold rounded-xl hover:from-rose-500 hover:to-orange-500 disabled:opacity-50 shadow-lg shadow-rose-500/20 transition-all"
                  >
                    {loading ? 'Searching...' : 'Find'}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/5">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Category:</span>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        selectedCategory === cat.id
                          ? `bg-${cat.color}-500/20 text-${cat.color}-300 border border-${cat.color}-500/30`
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span>{cat.icon}</span> {cat.label}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value)}
                    className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-400"
                  >
                    <option value="">Any Price</option>
                    <option value="$">$</option>
                    <option value="$$">$$</option>
                    <option value="$$$">$$$</option>
                    <option value="$$$$">$$$$</option>
                  </select>
                  <select
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-400"
                  >
                    <option value="">Any Rating</option>
                    <option value="4">4+ ★</option>
                    <option value="4.5">4.5+ ★</option>
                    <option value="4.8">4.8+ ★</option>
                  </select>
                  <div className="flex bg-white/5 rounded-lg p-0.5">
                    <button onClick={() => setViewMode('grid')} className={`px-2 py-1 rounded text-xs ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>▦</button>
                    <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded text-xs ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>☰</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Discover Content */}
        {activeTab === 'discover' && (
          <div className="space-y-6">
            {/* Stats Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{CATEGORIES.find(c => c.id === selectedCategory)?.label}</h2>
                <p className="text-sm text-gray-500">{filteredVenues.length} venues near {location?.name}</p>
              </div>
              <span className="text-xs text-gray-500">Sorted by relevance</span>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-[#0f0f1a] rounded-2xl overflow-hidden border border-white/5 animate-pulse">
                    <div className="h-48 bg-white/5"></div>
                    <div className="p-5 space-y-3">
                      <div className="h-5 bg-white/10 rounded w-3/4"></div>
                      <div className="h-4 bg-white/5 rounded w-1/2"></div>
                      <div className="flex gap-2">
                        <div className="h-6 bg-white/5 rounded w-16"></div>
                        <div className="h-6 bg-white/5 rounded w-16"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVenues.length === 0 ? (
              <div className="bg-[#0f0f1a] rounded-2xl p-16 border border-white/5 text-center">
                <div className="text-5xl mb-4">🍽️</div>
                <h3 className="text-xl font-bold mb-2">No Venues Found</h3>
                <p className="text-gray-500 text-sm">Try a different location, category, or adjust your filters.</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                {filteredVenues.map((venue) => (
                  viewMode === 'grid' ? (
                    <VenueCardGrid
                      key={venue.id}
                      venue={venue}
                      isFavorite={favorites.includes(venue.id)}
                      onToggleFavorite={() => toggleFavorite(venue.id)}
                      directionsUrl={getDirectionsUrl(venue)}
                      onSelect={() => setSelectedVenue(venue)}
                    />
                  ) : (
                    <VenueCardList
                      key={venue.id}
                      venue={venue}
                      isFavorite={favorites.includes(venue.id)}
                      onToggleFavorite={() => toggleFavorite(venue.id)}
                      directionsUrl={getDirectionsUrl(venue)}
                      onSelect={() => setSelectedVenue(venue)}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reservations */}
        {activeTab === 'reservations' && (
          <div className="bg-[#0f0f1a] rounded-2xl p-16 border border-white/5 text-center">
            <div className="text-5xl mb-4">📅</div>
            <h3 className="text-xl font-bold mb-2">No Reservations Yet</h3>
            <p className="text-gray-500 text-sm">Your upcoming reservations will appear here. Find a venue and book your first table!</p>
            <button onClick={() => setActiveTab('discover')} className="mt-6 px-6 py-3 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 shadow-lg shadow-rose-500/20">Discover Venues</button>
          </div>
        )}

        {/* Tickets */}
        {activeTab === 'tickets' && (
          <div className="bg-[#0f0f1a] rounded-2xl p-16 border border-white/5 text-center">
            <div className="text-5xl mb-4">🎫</div>
            <h3 className="text-xl font-bold mb-2">No Tickets Yet</h3>
            <p className="text-gray-500 text-sm">Your purchased tickets and event passes will appear here.</p>
            <button onClick={() => { setSelectedCategory('event'); setActiveTab('discover'); }} className="mt-6 px-6 py-3 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 shadow-lg shadow-rose-500/20">Find Events</button>
          </div>
        )}
      </div>

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <VenueDetailModal
          venue={selectedVenue}
          onClose={() => setSelectedVenue(null)}
          directionsUrl={getDirectionsUrl(selectedVenue)}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Venue Card (Grid)
// ═══════════════════════════════════════════════════════════════════════════════
const VenueCardGrid: React.FC<{ venue: any; isFavorite: boolean; onToggleFavorite: () => void; directionsUrl: string; onSelect: () => void }> = ({ venue, isFavorite, onToggleFavorite, directionsUrl, onSelect }) => (
  <div onClick={onSelect} className="bg-[#0f0f1a] rounded-2xl overflow-hidden border border-white/5 hover:border-rose-500/20 transition-all cursor-pointer group shadow-lg shadow-black/20 hover:shadow-rose-500/5">
    <div className="relative h-48 bg-white/5">
      {venue.imageUrl ? (
        <img src={venue.imageUrl} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
          <span className="text-4xl opacity-30">🍽️</span>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-all"
      >
        {isFavorite ? '❤️' : '🤍'}
      </button>
      {venue.rating && (
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-sm font-semibold flex items-center gap-1">
          <span className="text-yellow-400">★</span> {venue.rating.toFixed(1)}
          {venue.reviewCount && <span className="text-gray-400 text-xs ml-1">({venue.reviewCount})</span>}
        </div>
      )}
      {venue.price && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-sm font-medium text-green-300">
          {venue.price}
        </div>
      )}
    </div>
    <div className="p-5">
      <h3 className="font-bold text-lg mb-1 group-hover:text-rose-300 transition-colors truncate">{venue.name}</h3>
      {venue.cuisine && <p className="text-sm text-gray-400 mb-2">{venue.cuisine}</p>}
      {venue.address && <p className="text-xs text-gray-500 mb-3 truncate">📍 {venue.address}</p>}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        {venue.phone && <span>📞 {venue.phone}</span>}
        {venue.distance && <span className="ml-auto">{(venue.distance / 1000).toFixed(1)} km</span>}
      </div>
      <div className="flex gap-2">
        <button className="flex-1 py-2.5 bg-rose-500 text-white text-sm font-semibold rounded-xl hover:bg-rose-600 shadow-lg shadow-rose-500/20 transition-all">
          Reserve
        </button>
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">🗺️</a>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Venue Card (List)
// ═══════════════════════════════════════════════════════════════════════════════
const VenueCardList: React.FC<{ venue: any; isFavorite: boolean; onToggleFavorite: () => void; directionsUrl: string; onSelect: () => void }> = ({ venue, isFavorite, onToggleFavorite, directionsUrl, onSelect }) => (
  <div onClick={onSelect} className="bg-[#0f0f1a] rounded-2xl p-5 border border-white/5 hover:border-rose-500/20 transition-all cursor-pointer group flex gap-5">
    <div className="w-32 h-32 rounded-xl bg-white/5 overflow-hidden flex-shrink-0">
      {venue.imageUrl ? (
        <img src={venue.imageUrl} alt={venue.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🍽️</div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold group-hover:text-rose-300 transition-colors">{venue.name}</h3>
          {venue.cuisine && <p className="text-sm text-gray-400">{venue.cuisine}</p>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="text-xl">{isFavorite ? '❤️' : '🤍'}</button>
      </div>
      {venue.address && <p className="text-xs text-gray-500 mt-1">📍 {venue.address}</p>}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        {venue.rating && <span className="flex items-center gap-1"><span className="text-yellow-400">★</span> {venue.rating}</span>}
        {venue.price && <span className="text-green-300">{venue.price}</span>}
        {venue.phone && <span>📞 {venue.phone}</span>}
      </div>
    </div>
    <div className="flex flex-col gap-2 justify-center">
      <button className="px-6 py-2 bg-rose-500 text-white text-sm font-semibold rounded-xl hover:bg-rose-600">Reserve</button>
      <a href={directionsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="px-6 py-2 bg-white/5 border border-white/10 text-sm text-center rounded-xl hover:bg-white/10">🗺️</a>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Venue Detail Modal
// ═══════════════════════════════════════════════════════════════════════════════
const VenueDetailModal: React.FC<{ venue: any; onClose: () => void; directionsUrl: string }> = ({ venue, onClose, directionsUrl }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-[#0f0f1a] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="relative h-56 bg-white/5">
        {venue.imageUrl ? (
          <img src={venue.imageUrl} alt={venue.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">🍽️</div>
        )}
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70">✕</button>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{venue.name}</h2>
            {venue.cuisine && <p className="text-gray-400">{venue.cuisine}</p>}
          </div>
          {venue.rating && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <span className="text-yellow-400">★</span>
              <span className="font-bold">{venue.rating}</span>
              {venue.reviewCount && <span className="text-xs text-gray-400">({venue.reviewCount})</span>}
            </div>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          {venue.address && (
            <div className="p-3 bg-white/5 rounded-xl">
              <span className="text-xs text-gray-500 block mb-1">📍 Address</span>
              <span className="text-sm">{venue.address}</span>
            </div>
          )}
          {venue.phone && (
            <div className="p-3 bg-white/5 rounded-xl">
              <span className="text-xs text-gray-500 block mb-1">📞 Phone</span>
              <a href={`tel:${venue.phone}`} className="text-sm text-rose-300 hover:underline">{venue.phone}</a>
            </div>
          )}
          {venue.price && (
            <div className="p-3 bg-white/5 rounded-xl">
              <span className="text-xs text-gray-500 block mb-1">💰 Price</span>
              <span className="text-sm text-green-300">{venue.price}</span>
            </div>
          )}
          {venue.distance && (
            <div className="p-3 bg-white/5 rounded-xl">
              <span className="text-xs text-gray-500 block mb-1">📏 Distance</span>
              <span className="text-sm">{(venue.distance / 1000).toFixed(1)} km away</span>
            </div>
          )}
        </div>

        {/* Hours */}
        {venue.hours && (
          <div className="p-3 bg-white/5 rounded-xl">
            <span className="text-xs text-gray-500 block mb-1">🕐 Hours</span>
            <span className="text-sm">{typeof venue.hours === 'string' ? venue.hours : 'Open today'}</span>
          </div>
        )}

        {/* Sources */}
        {venue.sources && venue.sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {venue.sources.map((source: string) => (
              <span key={source} className="px-2 py-1 text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-lg">📊 {source}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button className="flex-1 py-3 bg-rose-500 text-white font-semibold rounded-xl hover:bg-rose-600 shadow-lg shadow-rose-500/20">Reserve Table</button>
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10">🗺️</a>
          {venue.website && (
            <a href={venue.website} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10">🌐</a>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default BookingOS;
