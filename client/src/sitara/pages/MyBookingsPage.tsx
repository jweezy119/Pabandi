// Sitara OS — My Bookings Page
// Real platform reservations for signed-in users + local Sitara bookings.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';
import { useAuthStore } from '../../store/authStore';
import { sitaraApi } from '../api/sitaraApi';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-green-100 text-green-800',
  completed: 'bg-slate-100 text-slate-800',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-500',
};

function colorFor(status: string): string {
  return statusColors[status?.toLowerCase()] || 'bg-slate-100 text-slate-600';
}

function fmtDate(v: any): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default function MyBookingsPage() {
  const { bookings } = useSitaraStore();
  const { isAuthenticated } = useAuthStore();
  const [realBookings, setRealBookings] = useState<any[]>([]);
  const [loadingReal, setLoadingReal] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const payResult = searchParams.get('pay');

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingReal(true);
    sitaraApi
      .myReservations()
      .then((r) => setRealBookings(Array.isArray(r) ? r : []))
      .catch(() => setRealBookings([]))
      .finally(() => setLoadingReal(false));
  }, [isAuthenticated]);

  // Stripe return: the webhook usually lands within seconds — poll the
  // payment a few times so "paid" shows without a manual refresh.
  useEffect(() => {
    if (payResult !== 'success') return;
    const ref = searchParams.get('ref');
    if (!ref) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const p: any = await sitaraApi.getPayment(ref).catch(() => null);
        const paid = p && ['COMPLETED', 'PAID'].includes(String(p.status || '').toUpperCase());
        if (paid || tries >= 5) {
          clearInterval(timer);
          const r = await sitaraApi.myReservations().catch(() => []);
          if (Array.isArray(r)) setRealBookings(r);
        }
      } catch {
        if (tries >= 5) clearInterval(timer);
      }
    }, 2500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payResult]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this reservation? Cancellation policy applies.')) return;
    setCancelling(id);
    setActionError(null);
    try {
      await sitaraApi.cancelReservation(id);
      setRealBookings((list) =>
        list.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r))
      );
    } catch (e: any) {
      setActionError(e?.response?.data?.message || 'Could not cancel — policy may block it.');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">My Bookings</h1>
      <p className="text-slate-600 mb-8">Your verified bookings and check-ins.</p>

      {payResult === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-green-800">
            ✓ Deposit paid — you're locked in. Check in at the venue to complete your visit.
          </p>
          <button
            onClick={() => { searchParams.delete('pay'); searchParams.delete('ref'); setSearchParams(searchParams, { replace: true }); }}
            className="shrink-0 text-green-700 text-lg leading-none px-2"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      {payResult === 'cancelled' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-amber-800">
            Payment was cancelled — no charge made. Your reservation is still held.
          </p>
          <button
            onClick={() => { searchParams.delete('pay'); searchParams.delete('ref'); setSearchParams(searchParams, { replace: true }); }}
            className="shrink-0 text-amber-700 text-lg leading-none px-2"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Real platform reservations */}
      {isAuthenticated && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Platform reservations</h2>
          {actionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-4">
              {actionError}
            </div>
          )}
          {loadingReal ? (
            <p className="text-slate-500 text-sm">Loading reservations…</p>
          ) : realBookings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
              No platform reservations yet — book a venue or restaurant from Pabandi to see it here.
            </div>
          ) : (
            <div className="space-y-4">
              {realBookings.map((r: any) => {
                const name =
                  r.business?.name || r.businessName || r.venue || r.eventName || 'Reservation';
                const when = r.scheduledAt || r.checkInDate || r.date || r.createdAt;
                const status = String(r.status || 'pending').toLowerCase();
                const cancellable = !['cancelled', 'completed', 'no_show'].includes(status);
                const checkable = ['pending', 'confirmed'].includes(status) && (r.businessId?.length || 0) > 10;
                return (
                  <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-slate-900">{name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorFor(status)}`}>
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{fmtDate(when)}</p>
                    {(r.depositAmount || r.depositHeld) && (
                      <p className="text-sm text-slate-600 mt-1">
                        Deposit: <strong>${r.depositAmount ?? '—'}</strong>
                      </p>
                    )}
                    {cancellable && (
                      <div className="mt-3">
                        <button
                          onClick={() => void handleCancel(r.id)}
                          disabled={cancelling === r.id}
                          className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded hover:bg-slate-200 disabled:opacity-50"
                        >
                          {cancelling === r.id ? 'Cancelling…' : 'Cancel reservation'}
                        </button>
                      </div>
                    )}
                    {checkable && (
                      <div className="mt-3">
                        <Link
                          to={`/sitara/checkin/live/${r.id}`}
                          className="inline-block px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
                        >
                          ✓ Check in now
                        </Link>
                      </div>
                    )}
                    {status === 'completed' && (r.businessId?.length || 0) > 10 && (
                      <div className="mt-3">
                        <Link
                          to={`/sitara/review/live/${r.id}`}
                          className="inline-block px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded hover:bg-amber-600"
                        >
                          ★ Review your visit — give them a star
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Local Sitara bookings (demo flow) */}
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Sitara bookings</h2>
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
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorFor(booking.status)}`}>
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
