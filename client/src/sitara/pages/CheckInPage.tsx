// Sitara OS — Check-In Page
// Verified arrival. Works for local bookings AND live platform reservations
// (/checkin/live/:reservationId), on any device.

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';
import { useAuthStore } from '../../store/authStore';
import { sitaraApi } from '../api/sitaraApi';

export default function CheckInPage() {
  const { bookingId, reservationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { bookings, updateBooking, updateStarPower } = useSitaraStore();
  const { isAuthenticated } = useAuthStore();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [liveVerified, setLiveVerified] = useState<boolean | null>(null);
  const [liveBooking, setLiveBooking] = useState<any>(null);
  const [loadingLive, setLoadingLive] = useState(!!reservationId);

  const booking = bookings.find((b) => b.id === bookingId) || liveBooking;

  useEffect(() => {
    if (!reservationId || !isAuthenticated) {
      setLoadingLive(false);
      return;
    }
    let cancelled = false;
    sitaraApi
      .myReservations()
      .then((list: any[]) => {
        if (cancelled) return;
        const r = (Array.isArray(list) ? list : []).find((x: any) => x.id === reservationId);
        if (r) {
          setLiveBooking({
            id: `live-${r.id}`,
            businessId: r.businessId,
            businessName: r.business?.name || r.businessName || location.state?.name || 'this business',
            businessType: 'restaurant' as const,
            scheduledAt: r.reservationDate || r.createdAt,
            status: 'pending' as const,
            depositAmount: r.depositAmount || 0,
            depositHeld: !!r.depositRequired,
            reviewSubmitted: false,
            reservationId: r.id,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingLive(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, isAuthenticated]);

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    // Real platform check-in when backed by a live reservation, else demo flow.
    let live = false;
    if (isAuthenticated && booking?.reservationId) {
      try {
        // Attach device location when available — honest proximity, not a claim.
        const pos: { lat?: number; lng?: number } = await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve({});
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve({}),
            { timeout: 5000 }
          );
        });
        await sitaraApi.verifyCheckIn({ reservationId: booking.reservationId, method: 'manual', ...pos });
        live = true;
      } catch {
        live = false;
      }
    } else {
      // Demo booking: local simulation
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    setLiveVerified(live);
    if (bookingId) {
      updateBooking(bookingId, {
        status: 'checked_in',
        escrowTxId: `sol-tx-${Date.now()}`,
      });
    }
    updateStarPower(10); // Earn 10 star power for checking in

    setCheckedIn(true);
    setIsCheckingIn(false);
  };

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-600">{loadingLive ? 'Loading your booking…' : 'Booking not found.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Check In</h1>
      <p className="text-slate-600 mb-8">Verify your arrival to release your deposit and earn star power.</p>

      {!checkedIn ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Booking Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Business</span>
                <span className="font-medium">{booking.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Scheduled</span>
                <span className="font-medium">{new Date(booking.scheduledAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Deposit</span>
                <span className="font-medium">${booking.depositAmount} (held in escrow)</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📍</span>
            </div>
            <h3 className="font-semibold text-amber-900 mb-2">At the venue?</h3>
            <p className="text-sm text-amber-800 mb-4">
              Tap below when you've arrived — we'll attach your location if you allow it, and your visit becomes verified.
            </p>
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn}
              className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              {isCheckingIn ? 'Checking in...' : 'Check In Now'}
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Verified visits unlock reviews, stars, and rewards.
          </p>
        </div>
      ) : (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Checked In!</h2>
          <p className="text-slate-600">
            {liveVerified
              ? 'Your arrival is verified on-platform. You earned '
              : 'Your arrival is recorded. You earned '}
            <strong>+10 Star Power</strong>.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            {liveVerified ? (
              <p>✓ Verified visit — your review will earn this business a real star.</p>
            ) : (
              <p>· Demo check-in — book a ✓ Live venue for verified visits.</p>
            )}
          </div>
          <button
            onClick={() =>
              navigate(
                reservationId
                  ? `/sitara/review/live/${reservationId}`
                  : `/sitara/review/${bookingId}`
              )
            }
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
          >
            Leave a Review
          </button>
        </div>
      )}
    </div>
  );
}
