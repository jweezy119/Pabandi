import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokens, Surface, Button, Badge, GlassCard } from '../design-system';

const VENUE_TYPES = ['All', 'CLUB', 'BAR', 'LOUNGE', 'ROOFTOP'];
const GENRES = ['House', 'Techno', 'Hip-Hop', 'R&B', 'Latin', 'Afrobeats', 'Pop', 'Jazz', 'Drum & Bass'];
const AMENITIES = ['VIP Area', 'Bottle Service', 'Dance Floor', 'Rooftop', 'Live DJ', 'Coat Check', 'Valet Parking', 'Outdoor Seating'];
const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'];

interface Venue {
  id: string;
  name: string;
  type: string;
  rating: number;
  coverCharge: number;
  musicGenres: string[];
  image: string;
  featured: boolean;
  city: string;
  priceRange: string;
  amenities: string[];
}

const MOCK_VENUES: Venue[] = [
  { id: '1', name: 'Eclipse Nightclub', type: 'CLUB', rating: 4.8, coverCharge: 50, musicGenres: ['House', 'Techno'], image: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=600', featured: true, city: 'Miami', priceRange: '$$$', amenities: ['VIP Area', 'Bottle Service', 'Dance Floor', 'Live DJ'] },
  { id: '2', name: 'Skyline Rooftop', type: 'ROOFTOP', rating: 4.6, coverCharge: 30, musicGenres: ['R&B', 'Hip-Hop'], image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600', featured: true, city: 'New York', priceRange: '$$', amenities: ['Rooftop', 'Bottle Service', 'Outdoor Seating'] },
  { id: '3', name: 'Velvet Lounge', type: 'LOUNGE', rating: 4.7, coverCharge: 25, musicGenres: ['Jazz', 'R&B'], image: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600', featured: false, city: 'Los Angeles', priceRange: '$$', amenities: ['VIP Area', 'Bottle Service', 'Live DJ'] },
  { id: '4', name: 'Bass Drop', type: 'CLUB', rating: 4.5, coverCharge: 40, musicGenres: ['Drum & Bass', 'Techno'], image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=600', featured: true, city: 'Berlin', priceRange: '$$$', amenities: ['Dance Floor', 'Live DJ', 'Coat Check'] },
  { id: '5', name: 'The Golden Bar', type: 'BAR', rating: 4.3, coverCharge: 15, musicGenres: ['Pop', 'Latin'], image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600', featured: false, city: 'Miami', priceRange: '$', amenities: ['Outdoor Seating', 'Valet Parking'] },
  { id: '6', name: 'Neon Garden', type: 'CLUB', rating: 4.9, coverCharge: 60, musicGenres: ['Afrobeats', 'House'], image: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=600', featured: true, city: 'London', priceRange: '$$$$', amenities: ['VIP Area', 'Bottle Service', 'Dance Floor', 'Live DJ', 'Valet Parking'] },
];

export const VenueSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchCity, setSearchCity] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [searchGenre, setSearchGenre] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<string[]>([]);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>(MOCK_VENUES);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let results = MOCK_VENUES;
    if (searchCity) results = results.filter(v => v.city.toLowerCase().includes(searchCity.toLowerCase()));
    if (selectedType !== 'All') results = results.filter(v => v.type === selectedType);
    if (selectedGenres.length) results = results.filter(v => v.musicGenres.some(g => selectedGenres.includes(g)));
    if (selectedAmenities.length) results = results.filter(v => selectedAmenities.some(a => v.amenities.includes(a)));
    if (selectedPrice.length) results = results.filter(v => selectedPrice.includes(v.priceRange));
    if (searchGenre) results = results.filter(v => v.musicGenres.some(g => g.toLowerCase().includes(searchGenre.toLowerCase())));
    setFilteredVenues(results);
  }, [searchCity, selectedType, selectedGenres, selectedAmenities, selectedPrice, searchGenre]);

  const featuredVenues = MOCK_VENUES.filter(v => v.featured);

  const toggleGenre = (g: string) => setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleAmenity = (a: string) => setSelectedAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const togglePrice = (p: string) => setSelectedPrice(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`material-symbols-outlined text-sm ${i < Math.floor(rating) ? 'text-amber-400' : 'text-slate-600'}`}>star</span>
    ));
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      {/* Radial glow background */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="px-4 pt-8 pb-6 md:pt-12 md:pb-8">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-100 mb-3 tracking-tight">Find Your Night</h1>
            <p className="text-base md:text-lg mb-8" style={{ color: tokens.color.muted }}>Discover clubs, bars, lounges & rooftop experiences</p>

            {/* Search Bar */}
            <GlassCard className="max-w-4xl mx-auto p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">location_on</span>
                  <input
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    placeholder="City"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">calendar_today</span>
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">group</span>
                  <select
                    value={partySize}
                    onChange={(e) => setPartySize(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500/50 text-sm appearance-none"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n} className="bg-slate-800">{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">music_note</span>
                  <input
                    value={searchGenre}
                    onChange={(e) => setSearchGenre(e.target.value)}
                    placeholder="Genre"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Featured Carousel */}
        <div className="px-4 pb-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">auto_awesome</span>
              Featured Venues
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {featuredVenues.map(venue => (
                <div
                  key={venue.id}
                  onClick={() => navigate(`/booking/venue/${venue.id}`)}
                  className="flex-shrink-0 w-72 md:w-80 cursor-pointer group"
                >
                  <GlassCard className="overflow-hidden p-0" hover lift>
                    <div className="relative h-40 overflow-hidden">
                      <img src={venue.image} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <Badge tone="warning" className="absolute top-3 left-3">Featured</Badge>
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-white font-bold text-lg">{venue.name}</h3>
                        <p className="text-slate-300 text-xs">{venue.city} · {venue.type}</p>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 pb-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-100">
                All Venues <span className="text-sm font-normal ml-2" style={{ color: tokens.color.muted }}>({filteredVenues.length})</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} className="lg:hidden">
                <span className="material-symbols-outlined text-sm">tune</span>
                Filters
              </Button>
            </div>

            <div className="flex gap-6">
              {/* Filter Sidebar */}
              <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-64 flex-shrink-0 space-y-6`}>
                {/* Type Filter */}
                <Surface className="p-4">
                  <h3 className="text-sm font-semibold text-slate-100 mb-3">Venue Type</h3>
                  <div className="flex flex-wrap gap-2">
                    {VENUE_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedType === type ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
                      >
                        {type === 'All' ? 'All' : type.charAt(0) + type.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </Surface>

                {/* Genre Filter */}
                <Surface className="p-4">
                  <h3 className="text-sm font-semibold text-slate-100 mb-3">Music Genre</h3>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(genre => (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedGenres.includes(genre) ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </Surface>

                {/* Amenities Filter */}
                <Surface className="p-4">
                  <h3 className="text-sm font-semibold text-slate-100 mb-3">Amenities</h3>
                  <div className="space-y-2">
                    {AMENITIES.map(amenity => (
                      <label key={amenity} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes(amenity)}
                          onChange={() => toggleAmenity(amenity)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
                        />
                        <span className="text-xs text-slate-300">{amenity}</span>
                      </label>
                    ))}
                  </div>
                </Surface>

                {/* Price Filter */}
                <Surface className="p-4">
                  <h3 className="text-sm font-semibold text-slate-100 mb-3">Price Range</h3>
                  <div className="flex gap-2">
                    {PRICE_RANGES.map(price => (
                      <button
                        key={price}
                        onClick={() => togglePrice(price)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedPrice.includes(price) ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
                      >
                        {price}
                      </button>
                    ))}
                  </div>
                </Surface>
              </aside>

              {/* Results Grid */}
              <div className="flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredVenues.map(venue => (
                    <div key={venue.id} onClick={() => navigate(`/booking/venue/${venue.id}`)} className="cursor-pointer group">
                      <GlassCard className="overflow-hidden p-0 h-full" hover lift>
                        <div className="relative h-44 overflow-hidden">
                          <img src={venue.image} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          {venue.featured && <Badge tone="warning" className="absolute top-3 left-3">Featured</Badge>}
                          <Badge tone="info" className="absolute top-3 right-3">{venue.type}</Badge>
                          <div className="absolute bottom-3 left-3">
                            <p className="text-white/80 text-xs flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">location_on</span>
                              {venue.city}
                            </p>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-slate-100 font-bold text-base mb-1">{venue.name}</h3>
                          <div className="flex items-center gap-1 mb-2">
                            {renderStars(venue.rating)}
                            <span className="text-xs ml-1" style={{ color: tokens.color.muted }}>{venue.rating}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {venue.musicGenres.map(g => (
                              <span key={g} className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] border border-white/5">{g}</span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-emerald-300">${venue.coverCharge} cover</span>
                            <span className="text-xs" style={{ color: tokens.color.muted }}>{venue.priceRange}</span>
                          </div>
                        </div>
                      </GlassCard>
                    </div>
                  ))}
                </div>

                {filteredVenues.length === 0 && (
                  <Surface className="p-12 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-600 mb-4 block">search_off</span>
                    <h3 className="text-slate-100 font-bold text-lg mb-2">No venues found</h3>
                    <p style={{ color: tokens.color.muted }} className="text-sm">Try adjusting your filters or search criteria</p>
                  </Surface>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueSearchPage;
