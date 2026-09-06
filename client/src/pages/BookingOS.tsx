import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Surface, Button, tokens } from '../design-system';

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
  const { isAuthenticated } = useAuthStore();
  const [activeTab] = useState<'discover' | 'reservations' | 'tickets'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('restaurant');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedGuests, setSelectedGuests] = useState(2);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);

  useEffect(() => {
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
    setError('');
    try {
      const res = await fetch(
        `/api/v1/venues/search?lat=${location.lat}&lng=${location.lng}&categories=${selectedCategory}&radius=5000&limit=30`
      );
      const data = await res.json();
      setVenues(data.data || []);
    } catch (e: any) {
      setError('Failed to load venues. Please try again.');
      console.error('Failed to load venues:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/maps/geocode?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.data) {
        setLocation({ lat: data.data.lat, lng: data.data.lng, name: data.data.displayName });
      } else {
        setError('Location not found. Try "Chicago", "New York", etc.');
      }
    } catch (e: any) {
      setError('Geocoding failed. Please try again.');
      console.error('Failed to geocode:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = (venue: any) => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/business/${venue.id}/book`)}`);
      return;
    }
    navigate(`/business/${venue.id}/book`, { state: { venue, date: selectedDate, guests: selectedGuests } });
  };

  const getDirectionsUrl = (venue: any) => {
    return `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">BookOS</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Find and book venues near you</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/search')}>← Back to Search</Button>
        </div>

        {/* Hero Search */}
        {activeTab === 'discover' && (
          <div className="mb-8">
            <h2 className="text-3xl font-black text-white mb-2">Find your table</h2>
            <p className="text-white/60 mb-6">Book at the best restaurants, clubs, and events near {location?.name || 'you'}</p>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">📍</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search city, neighborhood, or venue..."
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">📅</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">👥</span>
                <select
                  value={selectedGuests}
                  onChange={(e) => setSelectedGuests(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-400 appearance-none"
                >
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <option key={n} value={n} className="bg-slate-800">{n} {n === 1 ? 'guest' : 'guests'}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleSearch} className="px-8 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors">
                Find
              </button>
            </div>

            {/* Categories */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        {activeTab === 'discover' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12 text-white/40">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                Loading venues...
              </div>
            ) : venues.length === 0 ? (
              <Surface className="p-12 text-center">
                <div className="text-5xl mb-4">🍽️</div>
                <h3 className="text-xl font-bold text-white mb-2">No venues found</h3>
                <p className="text-white/50 mb-4">Try searching a different area or category.</p>
                <Button onClick={() => navigate('/search')}>Search all businesses</Button>
              </Surface>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {venues.map((venue) => (
                  <VenueCard key={venue.id} venue={venue} directionsUrl={getDirectionsUrl(venue)} onReserve={handleReserve} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reservations' && (
          <Surface className="p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-white mb-2">Your reservations</h3>
            <p className="text-white/50">You have no upcoming reservations.</p>
          </Surface>
        )}

        {activeTab === 'tickets' && (
          <Surface className="p-12 text-center">
            <div className="text-5xl mb-4">🎫</div>
            <h3 className="text-xl font-bold text-white mb-2">Your tickets</h3>
            <p className="text-white/50">You have no tickets yet.</p>
          </Surface>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Venue Card
// ────────────────────────────────────────────────────────────────────────────
const VenueCard: React.FC<{ venue: any; directionsUrl: string; onReserve: (venue: any) => void }> = ({ venue, directionsUrl, onReserve }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/[0.08] transition-all group">
      {/* Image */}
      <div className="relative h-48 bg-white/5">
        {venue.imageUrl ? (
          <img src={venue.imageUrl} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          {isFavorite ? '❤️' : '🤍'}
        </button>
        {/* Rating badge */}
        {venue.rating && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-black/50 text-sm font-medium text-white flex items-center gap-1">
            <span className="text-yellow-400">★</span> {venue.rating}
            {venue.reviewCount && <span className="text-white/50 text-xs">({venue.reviewCount})</span>}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors truncate">{venue.name}</h3>
          {venue.price && (
            <span className="text-sm text-white/40 ml-2">{venue.price}</span>
          )}
        </div>
        
        {/* Address */}
        {venue.address && (
          <p className="text-sm text-white/50 mb-1 truncate">{venue.address}</p>
        )}
        {venue.city && (
          <p className="text-sm text-white/40 mb-2">{venue.city}{venue.state ? `, ${venue.state}` : ''}</p>
        )}

        {/* Contact info */}
        <div className="flex items-center gap-3 mb-3 text-xs text-white/40">
          {venue.phone && (
            <a href={`tel:${venue.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-indigo-300 flex items-center gap-1">
              📞 {venue.phone}
            </a>
          )}
          {venue.website && (
            <a href={venue.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-indigo-300 flex items-center gap-1 truncate max-w-[150px]">
              🌐 Website
            </a>
          )}
        </div>

        {/* Hours */}
        {venue.hours && (
          <p className="text-xs text-white/40 mb-3">🕐 {typeof venue.hours === 'string' ? venue.hours : 'Open today'}</p>
        )}

        {/* Source badges */}
        {venue.sources && venue.sources.length > 0 && (
          <div className="flex gap-1 mb-3">
            {venue.sources.map((source: string) => (
              <span key={source} className="px-1.5 py-0.5 text-xs rounded bg-white/5 text-white/40">
                {source}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onReserve(venue); }}
            className="flex-1 px-3 py-2 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600 transition-colors"
          >
            Reserve
          </button>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-2 border border-white/10 text-white/60 text-sm font-medium rounded-xl hover:border-indigo-400 hover:text-indigo-300 transition-colors"
          >
            🗺️
          </a>
        </div>
      </div>
    </div>
  );
};

export default BookingOS;
