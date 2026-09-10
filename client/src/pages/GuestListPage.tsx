import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokens, Surface, Button, Badge, GlassCard } from '../design-system';

type GuestListStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED';

interface GuestListEntry {
  id: string;
  venueName: string;
  venueCity: string;
  date: string;
  partySize: number;
  status: GuestListStatus;
}

const MOCK_ENTRIES: GuestListEntry[] = [
  { id: '1', venueName: 'Eclipse Nightclub', venueCity: 'Miami', date: '2026-09-14', partySize: 3, status: 'CONFIRMED' },
  { id: '2', venueName: 'Skyline Rooftop', venueCity: 'New York', date: '2026-09-21', partySize: 2, status: 'PENDING' },
  { id: '3', venueName: 'Bass Drop', venueCity: 'Berlin', date: '2026-09-08', partySize: 4, status: 'CHECKED_IN' },
  { id: '4', venueName: 'Velvet Lounge', venueCity: 'Los Angeles', date: '2026-08-30', partySize: 2, status: 'CANCELLED' },
];

const getStatusTone = (status: GuestListStatus): 'warning' | 'success' | 'info' | 'danger' => {
  const map: Record<GuestListStatus, 'warning' | 'success' | 'info' | 'danger'> = {
    PENDING: 'warning',
    CONFIRMED: 'success',
    CHECKED_IN: 'info',
    CANCELLED: 'danger',
  };
  return map[status];
};

export const GuestListPage: React.FC = () => {
  const navigate = useNavigate();
  const [showQR, setShowQR] = useState<string | null>(null);

  const handleCancel = (id: string) => {
    // In real app, call API
    console.log('Cancel guest list entry:', id);
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">My Guest List</h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.textDim }}>Your guest list entries and check-in status</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/booking/venues/search')}>
            <span className="material-symbols-outlined text-sm">add</span>
            Join Guest List
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Entries', value: MOCK_ENTRIES.length, icon: 'list_alt' },
            { label: 'Confirmed', value: MOCK_ENTRIES.filter(e => e.status === 'CONFIRMED').length, icon: 'check_circle' },
            { label: 'Pending', value: MOCK_ENTRIES.filter(e => e.status === 'PENDING').length, icon: 'schedule' },
            { label: 'Checked In', value: MOCK_ENTRIES.filter(e => e.status === 'CHECKED_IN').length, icon: 'login' },
          ].map(stat => (
            <Surface key={stat.label} className="p-4 text-center">
              <span className={`material-symbols-outlined ${stat.label === 'Confirmed' ? 'text-emerald-300' : stat.label === 'Pending' ? 'text-amber-300' : 'text-indigo-300'}`}>{stat.icon}</span>
              <p className="text-xl font-bold text-slate-100 mt-1">{stat.value}</p>
              <p className="text-xs" style={{ color: tokens.color.textDim }}>{stat.label}</p>
            </Surface>
          ))}
        </div>

        {/* Entries List */}
        {MOCK_ENTRIES.length > 0 ? (
          <div className="space-y-4">
            {MOCK_ENTRIES.map(entry => (
              <GlassCard key={entry.id} className="p-5" hover lift>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-slate-100 font-bold">{entry.venueName}</h3>
                      <Badge tone={getStatusTone(entry.status)}>{entry.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: tokens.color.textDim }}>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">location_on</span>
                        {entry.venueCity}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">calendar_today</span>
                        {entry.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">group</span>
                        {entry.partySize} {entry.partySize === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {entry.status === 'CONFIRMED' && (
                      <Button size="sm" variant="ghost" onClick={() => setShowQR(entry.id)}>
                        <span className="material-symbols-outlined text-sm">qr_code</span>
                        Check-in QR
                      </Button>
                    )}
                    {(entry.status === 'PENDING' || entry.status === 'CONFIRMED') && (
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(entry.id)}>
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* QR Code Section */}
                {showQR === entry.id && entry.status === 'CONFIRMED' && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center p-2">
                        <span className="material-symbols-outlined text-6xl text-slate-800">qr_code_2</span>
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-sm font-medium text-slate-100 mb-1">Check-in QR Code</p>
                        <p className="text-xs mb-2" style={{ color: tokens.color.textDim }}>Show this at the venue entrance to check in</p>
                        <div className="px-3 py-1.5 bg-white/5 rounded-lg inline-block">
                          <span className="text-xs font-mono text-indigo-300">GL-{entry.id.padStart(6, '0')}</span>
                        </div>
                        <p className="text-xs mt-2" style={{ color: tokens.color.textDim }}>
                          Valid for {entry.date} · {entry.partySize} guests
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        ) : (
          <Surface className="p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-600 mb-4 block">list_alt</span>
            <h3 className="text-xl font-bold text-slate-100 mb-2">No guest list entries</h3>
            <p className="mb-6" style={{ color: tokens.color.textDim }}>Join a guest list to skip the line at your favorite venues</p>
            <Button onClick={() => navigate('/booking/venues/search')}>
              <span className="material-symbols-outlined text-sm">search</span>
              Find Venues
            </Button>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default GuestListPage;
