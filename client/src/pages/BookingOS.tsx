import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: '🍽️' },
  { id: 'bar', label: 'Bars', icon: '🍸' },
  { id: 'cafe', label: 'Cafes', icon: '☕' },
  { id: 'club', label: 'Clubs', icon: '🎵' },
  { id: 'event', label: 'Events', icon: '🎉' },
  { id: 'hotel', label: 'Hotels', icon: '🏨' },
  { id: 'theater', label: 'Theaters', icon: '🎭' },
  { id: 'museum', label: 'Museums', icon: '🏛️' },
];

export const BookingOS: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'discover' | 'reservations' | 'tickets'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('restaurant');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedGuests, setSelectedGuests] = useState(2);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);


  useEffect(() => {
    // Default location
    setLocation({ lat: 40.7589, lng: -73.9851, name: 'Times Square, New York' });
  }, []);

  useEffect(() => {
    if (location) {
      loadVenues();
    }
  }, [location, selectedCategory]);

  const loadVenues = async () => {
    if (!location) return;
    setLoading(true);
    try {
      // Use the unified search API
      const res = await fetch(
        `/api/v1/venues/search?lat=${location.lat}&lng=${location.lng}&categories=${selectedCategory}&radius=5000&limit=30`
      );
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

  const getDirectionsUrl = (venue: any) => {
    return `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      {/* Header - OpenTable style */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-8 h-8 rounded bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">B</div>
              <span className="text-xl font-bold text-gray-900">BookOS</span>
              <span className="text-xs text-gray-400 ml-1">by Pabandi</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setActiveTab('discover')} className={`text-sm font-medium ${activeTab === 'discover' ? 'text-red-600' : 'text-gray-600 hover:text-gray-900'}`}>Discover</button>
              <button onClick={() => setActiveTab('reservations')} className={`text-sm font-medium ${activeTab === 'reservations' ? 'text-red-600' : 'text-gray-600 hover:text-gray-900'}`}>Reservations</button>
              <button onClick={() => setActiveTab('tickets')} className={`text-sm font-medium ${activeTab === 'tickets' ? 'text-red-600' : 'text-gray-600 hover:text-gray-900'}`}>Tickets</button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-700">← Pabandi</button>
            {isAuthenticated ? (
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold">
                {user?.firstName?.[0] || '?'}
              </div>
            ) : (
              <button onClick={() => navigate('/login')} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700">
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Search */}
      {activeTab === 'discover' && (
        <div className="bg-gradient-to-b from-white to-[#f7f7f7] py-12">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Find your table</h1>
            <p className="text-gray-600 mb-8">Book at the best restaurants, clubs, and events near {location?.name || 'you'}</p>
            
            <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📍</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search city, neighborhood, or venue..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded text-gray-900 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">👥</span>
                <select
                  value={selectedGuests}
                  onChange={(e) => setSelectedGuests(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded text-gray-900 focus:outline-none focus:border-red-500 appearance-none bg-white"
                >
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleSearch} className="px-8 py-3 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition-colors">
                Find
              </button>
            </div>

            {/* Categories */}
            <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    selectedCategory === cat.id
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-red-500'
                  }`}
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'discover' && (
          <div className="space-y-8">
            {/* Results */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {CATEGORIES.find(c => c.id === selectedCategory)?.label} near {location?.name || 'you'}
                </h2>
                <span className="text-sm text-gray-500">{venues.length} results</span>
              </div>
              
              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
              ) : venues.length === 0 ? (
                <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
                  <div className="text-5xl mb-4">🍽️</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No venues found</h3>
                  <p className="text-gray-600">Try searching a different area or category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {venues.map((venue) => (
                    <VenueCard key={venue.id} venue={venue} directionsUrl={getDirectionsUrl(venue)} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'reservations' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Reservations</h2>
            <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
              <div className="text-5xl mb-4">📅</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No reservations yet</h3>
              <p className="text-gray-600">Your upcoming reservations will appear here.</p>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Tickets</h2>
            <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
              <div className="text-5xl mb-4">🎫</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No tickets yet</h3>
              <p className="text-gray-600">Your purchased tickets will appear here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Venue Card (OpenTable style with real data)
// ────────────────────────────────────────────────────────────────────────────
const VenueCard: React.FC<{ venue: any; directionsUrl: string }> = ({ venue, directionsUrl }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer group">
      {/* Image */}
      <div className="relative h-48 bg-gray-200">
        {venue.imageUrl ? (
          <img src={venue.imageUrl} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
        >
          {isFavorite ? '❤️' : '🤍'}
        </button>
        {/* Rating badge */}
        {venue.rating && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-white/90 text-sm font-medium text-gray-900 flex items-center gap-1">
            <span className="text-yellow-500">★</span> {venue.rating}
            {venue.reviewCount && <span className="text-gray-500 text-xs">({venue.reviewCount})</span>}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-gray-900 group-hover:text-red-600 transition-colors truncate">{venue.name}</h3>
          {venue.price && (
            <span className="text-sm text-gray-500 ml-2">{venue.price}</span>
          )}
        </div>
        
        {/* Address */}
        {venue.address && (
          <p className="text-sm text-gray-600 mb-1 truncate">{venue.address}</p>
        )}
        {venue.city && (
          <p className="text-sm text-gray-500 mb-2">{venue.city}{venue.state ? `, ${venue.state}` : ''}</p>
        )}

        {/* Contact info */}
        <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
          {venue.phone && (
            <a href={`tel:${venue.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-red-600 flex items-center gap-1">
              📞 {venue.phone}
            </a>
          )}
          {venue.website && (
            <a href={venue.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-red-600 flex items-center gap-1 truncate max-w-[150px]">
              🌐 Website
            </a>
          )}
        </div>

        {/* Hours */}
        {venue.hours && (
          <p className="text-xs text-gray-500 mb-3">🕐 {typeof venue.hours === 'string' ? venue.hours : 'Open today'}</p>
        )}

        {/* Source badges */}
        {venue.sources && venue.sources.length > 0 && (
          <div className="flex gap-1 mb-3">
            {venue.sources.map((source: string) => (
              <span key={source} className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-500">
                {source}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors">
            Reserve
          </button>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded hover:border-red-500 hover:text-red-600 transition-colors"
          >
            🗺️
          </a>
        </div>
      </div>
    </div>
  );
};

export default BookingOS;
