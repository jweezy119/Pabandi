import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokens, Surface, Button, Badge, GlassCard } from '../design-system';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

interface Booking {
  id: string;
  confirmationCode: string;
  venueName: string;
  venueCity: string;
  date: string;
  time: string;
  tableType: string;
  bottlePackage: string | null;
  total: number;
  status: BookingStatus;
  partySize: number;
}

const MOCK_BOOKINGS: Booking[] = [
  { id: '1', confirmationCode: 'PB-XK92MV', venueName: 'Eclipse Nightclub', venueCity: 'Miami', date: '2026-09-14', time: '10:00 PM', tableType: 'Premium Table', bottlePackage: 'Classic', total: 1900, status: 'CONFIRMED', partySize: 4 },
  { id: '2', confirmationCode: 'PB-AB34KL', venueName: 'Skyline Rooftop', venueCity: 'New York', date: '2026-09-21', time: '9:00 PM', tableType: 'VIP Stage', bottlePackage: null, total: 2700, status: 'PENDING', partySize: 8 },
  { id: '3', confirmationCode: 'PB-CD56MN', venueName: 'Velvet Lounge', venueCity: 'Los Angeles', date: '2026-08-30', time: '11:00 PM', tableType: 'Standard Booth', bottlePackage: 'Starter', total: 860, status: 'COMPLETED', partySize: 3 },
  { id: '4', confirmationCode: 'PB-EF78OP', venueName: 'Bass Drop', venueCity: 'Berlin', date: '2026-08-15', time: '12:00 AM', tableType: 'Dance Floor', bottlePackage: 'Royal', total: 7100, status: 'CANCELLED', partySize: 12 },
  { id: '5', confirmationCode: 'PB-GH90QR', venueName: 'The Golden Bar', venueCity: 'Miami', date: '2026-07-28', time: '8:00 PM', tableType: 'Standard Booth', bottlePackage: null, total: 560, status: 'NO_SHOW', partySize: 4 },
];

const STATUS_TONES: Record<BookingStatus, 'warning' | 'success' | 'info' | 'danger'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'info',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

export const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showQR, setShowQR] = useState<string | null>(null);

  const filteredBookings = MOCK_BOOKINGS.filter(b => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (dateFrom && b.date < dateFrom) return false;
    if (dateTo && b.date > dateTo) return false;
    return true;
  });

  const handleCancel = (id: string) => {
    // In real app, call API
    console.log('Cancel booking:', id);
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">My Bookings</h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Manage your reservations and check-ins</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/booking/venues/search')}>
            <span className="material-symbols-outlined text-sm">add</span>
            New Booking
          </Button>
        </div>

        {/* Filters */}
        <Surface className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
              <div className="flex flex-wrap gap-2">
                {(['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === status ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
                  >
                    {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).replace('_', ' ').toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>
          </div>
        </Surface>

        {/* Bookings List */}
        {filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map(booking => (
              <GlassCard key={booking.id} className="p-5" hover lift>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Venue Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-slate-100 font-bold">{booking.venueName}</h3>
                      <Badge tone={STATUS_TONES[booking.status]}>{booking.status}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: tokens.color.muted }}>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">location_on</span>
                        {booking.venueCity}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">calendar_today</span>
                        {booking.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        {booking.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">group</span>
                        {booking.partySize} guests
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 text-xs">{booking.tableType}</span>
                      {booking.bottlePackage && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-xs">{booking.bottlePackage}</span>
                      )}
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-300">${booking.total}</p>
                      <p className="text-xs font-mono" style={{ color: tokens.color.muted }}>{booking.confirmationCode}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {booking.status === 'CONFIRMED' && (
                        <Button size="sm" variant="ghost" onClick={() => setShowQR(booking.id)}>
                          <span className="material-symbols-outlined text-sm">qr_code</span>
                          QR
                        </Button>
                      )}
                      {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                        <Button size="sm" variant="ghost" onClick={() => handleCancel(booking.id)}>
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* QR Code Modal */}
                {showQR === booking.id && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4">
                    <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-slate-800">qr_code_2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-100">Check-in QR Code</p>
                      <p className="text-xs" style={{ color: tokens.color.muted }}>Show this at the venue entrance</p>
                      <p className="text-xs font-mono text-indigo-300 mt-1">{booking.confirmationCode}</p>
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        ) : (
          /* Empty State */
          <Surface className="p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-600 mb-4 block">event_busy</span>
            <h3 className="text-xl font-bold text-slate-100 mb-2">No bookings found</h3>
            <p className="mb-6" style={{ color: tokens.color.muted }}>
              {statusFilter !== 'ALL' ? 'Try adjusting your filters' : 'Start exploring venues and make your first booking'}
            </p>
            <Button onClick={() => navigate('/booking/venues/search')}>
              <span className="material-symbols-outlined text-sm">search</span>
              Browse Venues
            </Button>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default MyBookingsPage;
