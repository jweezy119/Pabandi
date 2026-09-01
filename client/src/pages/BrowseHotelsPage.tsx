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
    { name: 'New York', emoji: '🗽' },
    { name: 'Los Angeles', emoji: '🌴' },
    { name: 'Chicago', emoji: '🌆' },
    { name: 'Miami', emoji: '🏖️' },
    { name: 'San Francisco', emoji: '🌉' },
    { name: 'Las Vegas', emoji: '🎰' },
    { name: 'Boston', emoji: '🏛️' },
    { name: 'Washington DC', emoji: '🏛️' },
    { name: 'Orlando', emoji: '🎢' },
    { name: 'San Diego', emoji: '🌊' },
    { name: 'Nashville', emoji: '🎸' },
    { name: 'Austin', emoji: '🎵' },
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
              </button>
            ))}
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
