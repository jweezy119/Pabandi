// Sitara OS — My Bookings Page

import { useSitaraStore } from '../store/sitaraStore';
import { Link } from 'react-router-dom';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-green-100 text-green-800',
  completed: 'bg-slate-100 text-slate-800',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-500',
};

export default function MyBookingsPage() {
  const { bookings } = useSitaraStore();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">My Bookings</h1>
      <p className="text-slate-600 mb-8">Your verified bookings and check-ins.</p>

      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📅</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No bookings yet</h3>
          <p className="text-slate-600 mb-6">Discover local businesses and make your first booking.</p>
          <Link
            to="/sitara"
            className="inline-block px-6 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
          >
            Discover
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{booking.businessName}</h3>
                  <p className="text-sm text-slate-600">
                    {new Date(booking.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>
                  {booking.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-slate-600">
                    Deposit: <strong>${booking.depositAmount}</strong>
                  </span>
                  {booking.reviewSubmitted && (
                    <span className="text-green-600">✓ Reviewed</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {booking.status === 'confirmed' && (
                    <Link
                      to={`/sitara/checkin/${booking.id}`}
                      className="px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded hover:bg-amber-600"
                    >
                      Check In
                    </Link>
                  )}
                  {booking.status === 'checked_in' && !booking.reviewSubmitted && (
                    <Link
                      to={`/sitara/review/${booking.id}`}
                      className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600"
                    >
                      Review
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
