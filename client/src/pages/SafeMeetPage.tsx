import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

const SAFE_MEET_SPOTS = [
  { name: 'Lahore SafeMeet Hub', address: '123 Main Blvd, Gulberg, Lahore', type: 'Police Station', distance: '2.3 km' },
  { name: 'Karachi Central SafeMeet', address: '456 Saddar, Karachi', type: 'Bank Lobby', distance: '5.1 km' },
  { name: 'Islamabad Safe Point', address: '789 F-10 Markaz, Islamabad', type: 'Mall Security', distance: '3.7 km' },
  { name: 'Rawalpindi Safe Zone', address: '321 Raja Bazaar, Rawalpindi', type: 'Police Station', distance: '1.2 km' },
];

export const SafeMeetPage: React.FC = () => {
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [scheduled, setScheduled] = useState(false);

  const handleSchedule = () => {
    if (selectedSpot === null || !date) return;
    setScheduled(true);
  };

  if (scheduled) {
    if (selectedSpot === null) return null;
    const spot = SAFE_MEET_SPOTS[selectedSpot];
    return (
      <div className="min-h-screen" style={{ background: tokens.color.background }}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Surface className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">SafeMeet Scheduled!</h2>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Your exchange is secured at a verified safe location.</p>
            <div className="mt-6 p-4 rounded-xl bg-white/5 text-left">
              <div className="font-bold text-slate-100 mb-2">{spot.name}</div>
              <div className="text-sm space-y-1" style={{ color: tokens.color.muted }}>
                <div>📍 {spot.address}</div>
                <div>🏷️ {spot.type}</div>
                <div>📅 {new Date(date).toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/20">
              <p className="text-xs text-emerald-300">🔒 Both parties will receive a reminder 1 hour before the meetup.</p>
            </div>
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-4">📍 SafeMeet</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100 font-headline">
            Schedule a SafeMeet
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Meet at verified safe locations — police stations, bank lobbies, and mall security desks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Select a Location</h3>
            {SAFE_MEET_SPOTS.map((spot, i) => (
              <button
                key={i}
                onClick={() => setSelectedSpot(i)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedSpot === i ? 'bg-indigo-500/10 border-indigo-400/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-100">{spot.name}</div>
                  <span className="text-xs" style={{ color: tokens.color.muted }}>{spot.distance}</span>
                </div>
                <div className="text-sm mt-1" style={{ color: tokens.color.muted }}>{spot.address}</div>
                <Badge tone="info" className="mt-2">{spot.type}</Badge>
              </button>
            ))}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-100 mb-4">Pick a Date & Time</h3>
            <Surface>
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                type="datetime-local"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base"
              />
              <Button onClick={handleSchedule} disabled={selectedSpot === null || !date} className="w-full mt-4">
                📅 Schedule SafeMeet
              </Button>
            </Surface>

            <Surface className="mt-4">
              <h4 className="font-bold text-slate-100 mb-2">Why SafeMeet?</h4>
              <div className="space-y-2 text-sm" style={{ color: tokens.color.muted }}>
                <div>✅ Verified safe locations with security</div>
                <div>✅ Both parties notified of the meetup</div>
                <div>✅ GPS verification at check-in</div>
                <div>✅ Dispute protection if something goes wrong</div>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafeMeetPage;
