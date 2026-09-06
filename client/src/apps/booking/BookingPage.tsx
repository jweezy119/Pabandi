import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Surface, Button, Badge, Chip, tokens } from '../../design-system';

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

const SORT_OPTIONS = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'distance', label: 'Nearest' },
  { value: 'popularity', label: 'Most Popular' },
];

const AMENITY_ICONS: Record<string, string> = {
  parking: '🅿️',
  wifi: '📶',
  'outdoor seating': '🪑',
  'delivery available': '🚚',
  'takes reservations': '📅',
  wheelchair: '♿',
  'accepts credit cards': '💳',
  'alcohol served': '🍷',
  brunch: '🥞',
  'happy hour': '🍺',
};

function renderAmenities(venue: any): string[] {
  const raw = venue.amenities || venue.features || [];
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,;]/) : [];
  return arr.map((a: string) => a.trim()).filter(Boolean).slice(0, 6);
}

function formatHours(venue: any): string {
  const h = venue.hours;
  if (!h) return '';
  if (typeof h === 'string') return h;
  if (Array.isArray(h)) {
    const today = new Date().getDay();
    const todayHours = h.find((x: any) => x.day === today || x.day === today.toString());
    if (todayHours) return `${todayHours.open || '?'} - ${todayHours.close || '?'}`;
  }
  return 'Open today';
}

export const BookingOS: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('restaurant');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedGuests, setSelectedGuests] = useState(2);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [sortBy, setSortBy] = useState('rating');
  const [selectedVenue, setSelectedVenue] = useState<any>(null);

  useEffect(() => {
    setLocation({ lat: 40.7589, lng: -73.9851, name: 'Times Square, New York' });
  }, []);

  useEffect(() => {
    if (location) {
      loadVenues();
    }
  }, [location, selectedCategory, sortBy]);

  const loadVenues = async () => {
    if (!location) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/v1/venues/search?lat=${location.lat}&lng=${location.lng}&categories=${selectedCategory}&radius=5000&limit=30`
      );
      const data = await res.json();
      const items = data.data || [];
      const sorted = [...items].sort((a, b) => {
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'distance') return (a.distance || 0) - (b.distance || 0);
        if (sortBy === 'popularity') return (b.popularity || 0) - (a.popularity || 0);
        return 0;
      });
      setVenues(sorted);
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

  const handleCardClick = (venue: any) => {
    setSelectedVenue(venue);
  };

  const closeModal = () => setSelectedVenue(null);

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">BookOS</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Find and book venues near you</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/reservations')}>My bookings</Button>
            {isAuthenticated && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/reservations/new')}>+ New reservation</Button>
            )}
          </div>
        </div>

        {/* Search Block */}
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
            <button onClick={handleSearch} className="px-8 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors">Find</button>
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

          {/* Sort */}
          <div className="flex gap-2 mt-3">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sortBy === opt.value
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
        )}

        {/* Venue Grid */}
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
              <div className="flex items-center justify-center gap-3">
                <Button variant="ghost" onClick={() => navigate('/search')}>Search all businesses</Button>
                <Button onClick={loadVenues}>Retry</Button>
              </div>
            </Surface>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {venues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  directionsUrl={getDirectionsUrl(venue)}
                  onReserve={handleReserve}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <VenueDetailModal venue={selectedVenue} onClose={closeModal} onReserve={handleReserve} />
      )}
    </div>
  );
};

// ─── Venue Card ─────────────────────────────────────────────────────────────
const VenueCard: React.FC<{
  venue: any;
  directionsUrl: string;
  onReserve: (venue: any) => void;
  onClick: (venue: any) => void;
}> = ({ venue, directionsUrl, onReserve, onClick }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const amenities = renderAmenities(venue);
  const hours = formatHours(venue);

  return (
    <div
      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/[0.08] transition-all group cursor-pointer"
      onClick={() => onClick(venue)}
    >
      {/* Image */}
      <div className="relative h-48 bg-white/5">
        {venue.imageUrl ? (
          <img src={venue.imageUrl} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          {isFavorite ? '❤️' : '🤍'}
        </button>
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

        {venue.address && (
          <p className="text-sm text-white/50 mb-1 truncate">{venue.address}</p>
        )}
        {venue.city && (
          <p className="text-sm text-white/40 mb-2">{venue.city}{venue.state ? `, ${venue.state}` : ''}</p>
        )}

        {/* Contact */}
        <div className="flex items-center gap-3 mb-2 text-xs text-white/40">
          {venue.phone && (
            <a href={`tel:${venue.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-indigo-300 flex items-center gap-1">
              📞
            </a>
          )}
          {venue.website && (
            <a href={venue.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-indigo-300 flex items-center gap-1 truncate max-w-[120px]">
              🌐
            </a>
          )}
          {hours && (
            <span className="flex items-center gap-1">🕐 {hours}</span>
          )}
        </div>

        {/* Amenities */}
        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {amenities.map((a) => (
              <span key={a} className="px-2 py-0.5 text-xs rounded bg-white/5 text-white/40 flex items-center gap-1">
                {AMENITY_ICONS[a.toLowerCase()] || '•'} {a}
              </span>
            ))}
          </div>
        )}

        {/* Sources */}
        {venue.sources && venue.sources.length > 0 && (
          <div className="flex gap-1 mb-3">
            {venue.sources.map((source: string) => (
              <span key={source} className="px-1.5 py-0.5 text-xs rounded bg-white/5 text-white/40">{source}</span>
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

// ─── Venue Detail Modal ─────────────────────────────────────────────────────
const VenueDetailModal: React.FC<{ venue: any; onClose: () => void; onReserve: (venue: any) => void }> = ({ venue, onClose, onReserve }) => {
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews'>('overview');
  const amenities = renderAmenities(venue);
  const hours = formatHours(venue);

  const estimatedDeposit = venue.trustScore >= 80 ? 0 : venue.trustScore >= 50 ? 5 : 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0f172a] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {venue.imageUrl || (venue.photos && venue.photos.length > 0) ? (
            <ImageGallery images={venue.photos && venue.photos.length > 0 ? venue.photos : [venue.imageUrl]} name={venue.name} />
          ) : (
            <div className="w-full h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center rounded-t-2xl">
              <span className="text-6xl">🍽️</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Title + Rating */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-white mb-1">{venue.name}</h2>
              {venue.address && (
                <p className="text-white/50">{venue.address}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {venue.rating && (
                  <Badge tone="warning" className="flex items-center gap-1">
                    ★ {venue.rating}
                  </Badge>
                )}
                {venue.reviewCount && (
                  <span className="text-sm text-white/40">({venue.reviewCount} reviews)</span>
                )}
                {venue.trustScore && (
                  <Chip tone={venue.trustScore >= 80 ? 'success' : venue.trustScore >= 50 ? 'warning' : 'danger'}>
                    Trust: {venue.trustScore}
                  </Chip>
                )}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 border-b border-white/10">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2 px-4 text-sm font-medium transition-all ${
                activeTab === 'overview' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-white/50 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`pb-2 px-4 text-sm font-medium transition-all ${
                activeTab === 'reviews' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-white/50 hover:text-white'
              }`}
            >
              Reviews
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' ? (
            <div className="space-y-4">
              {/* Hours */}
              {hours && (
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Hours</h4>
                  <p className="text-white/70">{hours}</p>
                </div>
              )}

              {/* Amenities */}
              {amenities.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-white mb-2">Amenities</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {amenities.map((a) => (
                      <span key={a} className="px-3 py-1.5 bg-white/5 rounded-lg text-sm text-white/70 flex items-center gap-2">
                        {AMENITY_ICONS[a.toLowerCase()] || '•'} {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact */}
              <div className="flex gap-4">
                {venue.phone && (
                  <a href={`tel:${venue.phone}`} className="text-indigo-400 text-sm flex items-center gap-1">📞 {venue.phone}</a>
                )}
                {venue.website && (
                  <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 text-sm flex items-center gap-1">🌐 Website</a>
                )}
              </div>

              {/* Deposit Info */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-start gap-3">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Pabandi Protected Booking</p>
                    <p className="text-xs text-white/50 mt-1">
                      {estimatedDeposit === 0
                        ? 'No deposit required — your trust score qualifies for instant booking.'
                        : `$${estimatedDeposit} deposit required. Staked $PAB reduces this amount.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {venue.reviewCount ? (
                <p className="text-sm text-white/50">Reviews for {venue.name}: {venue.reviewCount} total on {venue.sources?.join(', ')}</p>
              ) : (
                <p className="text-sm text-white/50">No reviews available for this venue yet.</p>
              )}
            </div>
          )}

          {/* Reserve Button */}
          <button
            onClick={() => {
              onReserve(venue);
              onClose();
            }}
            className="w-full mt-6 py-4 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 transition-colors"
          >
            {!isAuthenticated ? 'Sign in to reserve' : 'Reserve a table'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Photo Gallery ──────────────────────────────────────────────────────────
const ImageGallery: React.FC<{ images: string[]; name: string }> = ({ images, name }) => {
  const [current, setCurrent] = useState(0);
  const validImages = (images || []).filter((u) => u && typeof u === 'string');
  const showNav = validImages.length > 1;

  if (!validImages.length) {
    return (
      <div className="w-full h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center rounded-t-2xl">
        <span className="text-6xl">📷</span>
      </div>
    );
  }

  const prev = () => setCurrent((c) => (c - 1 + validImages.length) % validImages.length);
  const next = () => setCurrent((c) => (c + 1) % validImages.length);

  return (
    <div className="relative w-full h-64 rounded-t-2xl overflow-hidden group">
      <img
        src={validImages[current]}
        alt={`${name} photo ${current + 1}`}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {showNav && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            ›
          </button>
        </>
      )}
      {validImages.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {validImages.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-4' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingOS;
