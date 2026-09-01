import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

export const BrowseHotelsPage: React.FC = () => {
  const [city, setCity] = useState('');
  const [checkin, setCheckin] = useState('2026-09-24');
  const [checkout, setCheckout] = useState('2026-09-26');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);

  const buildBookingUrl = () => {
    const params = new URLSearchParams();
    if (city) params.set('ss', city);
    if (checkin) params.set('checkin', checkin);
    if (checkout) params.set('checkout', checkout);
    if (adults) params.set('group_adults', String(adults));
    if (children) params.set('group_children', String(children));
    if (rooms) params.set('no_rooms', String(rooms));
    params.set('selected_currency', 'USD');
    return `https://www.booking.com/searchresults.html?${params.toString()}`;
  };

  const handleSearch = () => {
    window.open(buildBookingUrl(), '_blank');
  };

  const popularCities = [
    { name: 'New York', emoji: '🗽', desc: 'The city that never sleeps' },
    { name: 'Los Angeles', emoji: '🌴', desc: 'Sunset Boulevard & beaches' },
    { name: 'Chicago', emoji: '🌆', desc: 'Architecture & deep dish' },
    { name: 'Miami', emoji: '🏖️', desc: 'South Beach & nightlife' },
    { name: 'San Francisco', emoji: '🌉', desc: 'Golden Gate & tech' },
    { name: 'Las Vegas', emoji: '🎰', desc: 'Shows & entertainment' },
    { name: 'Boston', emoji: '🏛️', desc: 'History & seafood' },
    { name: 'Washington DC', emoji: '🏛️', desc: 'Monuments & museums' },
    { name: 'Orlando', emoji: '🎢', desc: 'Theme parks & family fun' },
    { name: 'San Diego', emoji: '🌊', desc: 'Perfect weather & zoo' },
    { name: 'Nashville', emoji: '🎸', desc: 'Music City USA' },
    { name: 'Austin', emoji: '🎵', desc: 'Live music capital' },
  ];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-purple-900/20" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 text-center">
          <Badge tone="info" className="mb-4">🏨 Hotel Search</Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-100 font-headline">
            Find your stay
          </h1>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Search hotels on Booking.com with real prices, reviews, and instant booking.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-16">
        {/* Search Form */}
        <Surface className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-2 block">Destination</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City, region, or hotel name"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-2 block">Check-in</label>
              <input
                value={checkin}
                onChange={(e) => setCheckin(e.target.value)}
                type="date"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-2 block">Check-out</label>
              <input
                value={checkout}
                onChange={(e) => setCheckout(e.target.value)}
                type="date"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Adults</label>
                <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Children</label>
                <select value={children} onChange={(e) => setChildren(Number(e.target.value))} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Rooms</label>
                <select value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
          <Button onClick={handleSearch} disabled={!city} size="lg" className="w-full">
            🔍 Search on Booking.com
          </Button>
        </Surface>

        {/* Popular Cities */}
        <div>
          <h3 className="text-lg font-bold text-slate-100 mb-4">Popular destinations</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {popularCities.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  setCity(c.name);
                  window.open(`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(c.name)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&group_children=${children}&no_rooms=${rooms}&selected_currency=USD`, '_blank');
                }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-400/30 transition-all text-left"
              >
                <div className="text-2xl mb-1">{c.emoji}</div>
                <div className="font-semibold text-slate-100">{c.name}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-12">
          <h3 className="text-lg font-bold text-slate-100 mb-4">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Surface className="text-center">
              <div className="text-3xl mb-2">🔍</div>
              <h4 className="font-bold text-slate-100">Search</h4>
              <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Enter your destination and dates</p>
            </Surface>
            <Surface className="text-center">
              <div className="text-3xl mb-2">🏨</div>
              <h4 className="font-bold text-slate-100">Compare</h4>
              <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Browse hotels with real prices & reviews</p>
            </Surface>
            <Surface className="text-center">
              <div className="text-3xl mb-2">✅</div>
              <h4 className="font-bold text-slate-100">Book</h4>
              <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Secure your stay on Booking.com</p>
            </Surface>
          </div>
        </div>

        {/* Trust note */}
        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <p className="text-sm" style={{ color: tokens.color.muted }}>
            🔒 You'll be redirected to Booking.com to complete your booking securely.
            Pabandi verifies every booking made through our platform.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BrowseHotelsPage;
