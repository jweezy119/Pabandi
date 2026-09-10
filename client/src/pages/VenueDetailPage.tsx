import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tokens, Surface, Button, Badge, GlassCard } from '../design-system';

interface TableType {
  id: string;
  name: string;
  price: number;
  capacity: number;
  deposit: number;
  amenities: string[];
}

interface BottlePackage {
  id: string;
  name: string;
  price: number;
  bottles: number;
  includes: string[];
}

interface Event {
  id: string;
  name: string;
  date: string;
  lineup: string[];
  ticketPrice: number;
}

interface Review {
  id: string;
  user: string;
  rating: number;
  text: string;
  date: string;
}

const MOCK_TABLES: TableType[] = [
  { id: 't1', name: 'Standard Booth', price: 500, capacity: 4, deposit: 100, amenities: ['2 bottles included', 'VIP entrance'] },
  { id: 't2', name: 'Premium Table', price: 1200, capacity: 6, deposit: 240, amenities: ['3 bottles included', 'VIP entrance', 'Dedicated server', 'Mixers'] },
  { id: 't3', name: 'VIP Stage', price: 2500, capacity: 10, deposit: 500, amenities: ['5 bottles included', 'VIP entrance', 'Dedicated server', 'Mixers', 'Security'] },
  { id: 't4', name: 'Dance Floor', price: 4000, capacity: 15, deposit: 800, amenities: ['8 bottles included', 'VIP entrance', '2 Dedicated servers', 'Mixers', 'Security', 'Private restroom'] },
];

const MOCK_PACKAGES: BottlePackage[] = [
  { id: 'b1', name: 'Starter', price: 300, bottles: 1, includes: ['1 Premium Bottle', 'Mixers'] },
  { id: 'b2', name: 'Classic', price: 600, bottles: 2, includes: ['2 Premium Bottles', 'Mixers', 'VIP Server'] },
  { id: 'b3', name: 'Premium', price: 1200, bottles: 4, includes: ['4 Premium Bottles', 'Mixers', 'VIP Server', 'Champagne Toast'] },
  { id: 'b4', name: 'Royal', price: 2500, bottles: 8, includes: ['8 Premium Bottles', 'Mixers', 'VIP Server', 'Champagne Toast', 'VIP Security'] },
];

const MOCK_EVENTS: Event[] = [
  { id: 'e1', name: 'Bass Nation', date: '2026-09-14', lineup: ['DJ Shadow', 'Nina Kraviz', 'Carl Cox'], ticketPrice: 45 },
  { id: 'e2', name: 'Latin Heat', date: '2026-09-21', lineup: ['J Balvin', 'Bad Bunny'], ticketPrice: 55 },
  { id: 'e3', name: 'Techno Temple', date: '2026-09-28', lineup: ['Amelie Lens', 'Pan-Pot', 'Jeff Mills'], ticketPrice: 60 },
];

const MOCK_REVIEWS: Review[] = [
  { id: 'r1', user: 'Mike R.', rating: 5, text: 'Amazing vibes and incredible service. The VIP treatment was top-notch!', date: '2026-08-15' },
  { id: 'r2', user: 'Sarah K.', rating: 4, text: 'Great music and atmosphere. Only downside was the long line for drinks.', date: '2026-08-10' },
  { id: 'r3', user: 'James T.', rating: 5, text: 'Best nightlife experience in the city. Will definitely be back!', date: '2026-08-05' },
  { id: 'r4', user: 'Lisa M.', rating: 3, text: 'Nice venue but overcrowded. Bottle service made it worthwhile.', date: '2026-07-28' },
];

export const VenueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tables' | 'bottles' | 'events' | 'reviews' | 'guestlist'>('tables');
  const [guestName, setGuestName] = useState('');
  const [guestPartySize, setGuestPartySize] = useState('2');
  const [guestDate, setGuestDate] = useState('');

  const venue = {
    id,
    name: 'Eclipse Nightclub',
    type: 'CLUB',
    rating: 4.8,
    description: 'Miami\'s premier nightlife destination featuring world-class DJs, state-of-the-art sound systems, and an electrifying atmosphere. Experience the ultimate party with bottle service, VIP tables, and unforgettable nights.',
    amenities: ['VIP Area', 'Bottle Service', 'Dance Floor', 'Live DJ', 'Valet Parking', 'Coat Check', 'Outdoor Terrace'],
    hours: 'Thu-Sat 10PM - 5AM, Sun 8PM - 2AM',
    dressCode: 'Smart casual. No sneakers, shorts, or athletic wear.',
    musicGenres: ['House', 'Techno', 'Hip-Hop'],
    images: [
      'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=1200',
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200',
      'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=1200',
    ],
    city: 'Miami',
    coverCharge: 50,
    priceRange: '$$$',
  };

  const [currentImage, setCurrentImage] = useState(0);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`material-symbols-outlined text-sm ${i < Math.floor(rating) ? 'text-amber-400' : 'text-slate-600'}`}>star</span>
    ));
  };

  const tabs = [
    { key: 'tables', label: 'Tables', icon: 'table_restaurant' },
    { key: 'bottles', label: 'Bottle Service', icon: 'liquor' },
    { key: 'events', label: 'Events', icon: 'event' },
    { key: 'reviews', label: 'Reviews', icon: 'reviews' },
    { key: 'guestlist', label: 'Guest List', icon: 'list_alt' },
  ] as const;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

      <div className="relative z-10">
        {/* Image Gallery */}
        <div className="relative h-64 md:h-96 overflow-hidden">
          <img src={venue.images[currentImage]} alt={venue.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-black/30" />
          
          {/* Image Navigation */}
          {venue.images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {venue.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImage(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentImage ? 'bg-white w-8' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}

          {/* Back Button */}
          <button onClick={() => navigate('/booking/venues/search')} className="absolute top-4 left-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>

        {/* Venue Header */}
        <div className="px-4 -mt-12 relative z-10">
          <div className="max-w-5xl mx-auto">
            <GlassCard className="p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">{venue.name}</h1>
                    <Badge tone="info">{venue.type}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1">{renderStars(venue.rating)}</div>
                    <span className="text-sm" style={{ color: tokens.color.textDim }}>({venue.rating} · 124 reviews)</span>
                  </div>
                  <p className="flex items-center gap-1 text-sm" style={{ color: tokens.color.textDim }}>
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {venue.city} · {venue.priceRange} · ${venue.coverCharge} cover
                  </p>
                </div>
                <Button onClick={() => navigate(`/booking/checkout/${id}`)} size="lg">
                  <span className="material-symbols-outlined">confirmation_number</span>
                  Book Now
                </Button>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5">
                <div>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: tokens.color.textDim }}>Hours</p>
                  <p className="text-sm text-slate-100">{venue.hours}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: tokens.color.textDim }}>Dress Code</p>
                  <p className="text-sm text-slate-100">{venue.dressCode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: tokens.color.textDim }}>Music</p>
                  <div className="flex gap-1 flex-wrap">
                    {venue.musicGenres.map(g => (
                      <span key={g} className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-xs">{g}</span>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Description */}
            <Surface className="p-5 mb-6">
              <p className="text-sm leading-relaxed" style={{ color: tokens.color.text }}>{venue.description}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {venue.amenities.map(a => (
                  <span key={a} className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 text-xs border border-white/5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-emerald-400">check_circle</span>
                    {a}
                  </span>
                ))}
              </div>
            </Surface>

            {/* Tab Navigation */}
            <div className="flex gap-1 overflow-x-auto pb-4 mb-6 scrollbar-hide">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.key ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'}`}
                >
                  <span className="material-symbols-outlined text-base">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="pb-12">
              {/* Tables Tab */}
              {activeTab === 'tables' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MOCK_TABLES.map(table => (
                    <GlassCard key={table.id} className="p-5" hover lift>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-slate-100 font-bold">{table.name}</h3>
                          <p className="text-xs mt-1" style={{ color: tokens.color.textDim }}>
                            <span className="material-symbols-outlined text-xs align-middle">group</span> Up to {table.capacity} guests
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-300">${table.price}</p>
                          <p className="text-xs" style={{ color: tokens.color.textDim }}>${table.deposit} deposit</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {table.amenities.map(a => (
                          <div key={a} className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="material-symbols-outlined text-xs text-indigo-400">check</span>
                            {a}
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => navigate(`/booking/checkout/${id}?table=${table.id}`)}>
                        Select Table
                      </Button>
                    </GlassCard>
                  ))}
                </div>
              )}

              {/* Bottles Tab */}
              {activeTab === 'bottles' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MOCK_PACKAGES.map(pkg => (
                    <GlassCard key={pkg.id} className="p-5" hover lift>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-slate-100 font-bold">{pkg.name}</h3>
                          <p className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{pkg.bottles} bottle{pkg.bottles > 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-lg font-bold text-emerald-300">${pkg.price}</p>
                      </div>
                      <div className="space-y-1.5">
                        {pkg.includes.map(i => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="material-symbols-outlined text-xs text-amber-400">local_bar</span>
                            {i}
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => navigate(`/booking/checkout/${id}?bottle=${pkg.id}`)}>
                        Add to Booking
                      </Button>
                    </GlassCard>
                  ))}
                </div>
              )}

              {/* Events Tab */}
              {activeTab === 'events' && (
                <div className="space-y-4">
                  {MOCK_EVENTS.map(event => (
                    <Surface key={event.id} className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <h3 className="text-slate-100 font-bold text-lg">{event.name}</h3>
                          <p className="text-sm mt-1" style={{ color: tokens.color.textDim }}>
                            <span className="material-symbols-outlined text-sm align-middle">calendar_today</span> {event.date}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {event.lineup.map(artist => (
                              <span key={artist} className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-xs">{artist}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-emerald-300">${event.ticketPrice}</p>
                          <Button size="sm" variant="ghost" className="mt-2">
                            <span className="material-symbols-outlined text-sm">confirmation_number</span>
                            Get Tickets
                          </Button>
                        </div>
                      </div>
                    </Surface>
                  ))}
                </div>
              )}

              {/* Reviews Tab */}
              {activeTab === 'reviews' && (
                <div className="space-y-4">
                  {MOCK_REVIEWS.map(review => (
                    <Surface key={review.id} className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-bold">
                            {review.user[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-100">{review.user}</p>
                            <p className="text-xs" style={{ color: tokens.color.textDim }}>{review.date}</p>
                          </div>
                        </div>
                        <div className="flex gap-0.5">{renderStars(review.rating)}</div>
                      </div>
                      <p className="text-sm" style={{ color: tokens.color.text }}>{review.text}</p>
                    </Surface>
                  ))}
                </div>
              )}

              {/* Guest List Tab */}
              {activeTab === 'guestlist' && (
                <Surface className="p-6">
                  <h3 className="text-lg font-bold text-slate-100 mb-4">Join the Guest List</h3>
                  <p className="text-sm mb-6" style={{ color: tokens.color.textDim }}>Skip the line and get free entry before midnight</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Name</label>
                      <input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Party Size</label>
                      <select
                        value={guestPartySize}
                        onChange={(e) => setGuestPartySize(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500/50 text-sm"
                      >
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n} className="bg-slate-800">{n} {n === 1 ? 'Person' : 'People'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
                      <input
                        type="date"
                        value={guestDate}
                        onChange={(e) => setGuestDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500/50 text-sm"
                      />
                    </div>
                  </div>
                  <Button className="mt-4 w-full md:w-auto">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Join Guest List
                  </Button>
                </Surface>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueDetailPage;
