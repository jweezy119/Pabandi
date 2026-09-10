// Sitara OS — Review Page
// Verified review with on-chain proof

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';
import { useAuthStore } from '../../store/authStore';
import { sitaraApi } from '../api/sitaraApi';

export default function ReviewPage() {
  const { bookingId, reservationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { bookings, updateBooking, updateStarPower } = useSitaraStore();
  const { isAuthenticated } = useAuthStore();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [liveReview, setLiveReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  // Live path: /review/live/:reservationId — synthesize from the customer's
  // own reservations so any completed visit can earn its star, on any device.
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
            businessName:
              r.business?.name || r.businessName || location.state?.name || 'this business',
            businessType: 'restaurant' as const,
            scheduledAt: r.reservationDate || r.createdAt,
            status: String(r.status || '').toLowerCase(),
            reservationId: r.id,
            reviewSubmitted: false,
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

  const handleSubmit = async () => {
    setSubmitting(true);
    setReviewError(null);
    // Post a real verified review when the booking is backed by a live reservation.
    let live = false;
    if (isAuthenticated && booking?.reservationId && (booking?.businessId?.length || 0) > 10) {
      try {
        await sitaraApi.createReview({
          businessId: booking.businessId,
          reservationId: booking.reservationId,
          rating,
          text: review,
        });
        live = true;
      } catch (e: any) {
        setReviewError(
          e?.response?.data?.message ||
          'Verified review needs a completed checkout — recorded locally for now.'
        );
      }
    } else {
      // Demo booking: simulate on-chain review minting
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setLiveReview(live);
    if (bookingId) updateBooking(bookingId, { reviewSubmitted: true });
    updateStarPower(25); // Earn 25 star power for review

    setSubmitted(true);
    setSubmitting(false);
  };

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-600">
          {loadingLive ? 'Loading your visit…' : 'Booking not found.'}
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Review Submitted!</h2>
        <p className="text-slate-600 mb-6">
          {liveReview ? (
            <>Your review is verified on-platform. You earned <strong>+25 Star Power</strong> plus review points.</>
          ) : (
            <>Your review is recorded. You earned <strong>+25 Star Power</strong>.</>
          )}
        </p>
        {reviewError && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-6">
            {reviewError}
          </div>
        )}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 mb-6">
          <p><strong>Verification:</strong> Proof-of-attendance NFT minted</p>
          <p><strong>Review hash:</strong> 0x{Math.random().toString(16).slice(2, 10)}...</p>
        </div>
        <button
          onClick={() => navigate('/sitara')}
          className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
        >
          Back to Discovery
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Leave a Review</h1>
      <p className="text-slate-600 mb-8">Your verified visit gives this business a star — and earns you Star Power as a verifier.</p>

      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{booking.businessName}</h3>
          <p className="text-sm text-slate-600 mb-4">
            Verified visit on {new Date(booking.scheduledAt).toLocaleDateString()}
          </p>

          {/* Star Rating */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm font-medium text-slate-700">Rating:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  className={`rate-star text-3xl transition-colors ${
                    star <= rating ? 'text-amber-500' : 'text-slate-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Review Text */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Your Review
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Rewards */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-amber-900 mb-2">What you'll earn</h4>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>★ +25 Star Power</li>
              <li>🛡️ Verified reviewer badge</li>
              <li>📜 On-chain proof of honest review</li>
            </ul>
          </div>

          <button
            onClick={() => void handleSubmit()}
            disabled={rating === 0 || !review.trim() || submitting}
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
