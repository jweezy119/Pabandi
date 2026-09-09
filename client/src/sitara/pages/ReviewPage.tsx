// Sitara OS — Review Page
// Verified review with on-chain proof

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';

export default function ReviewPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { bookings, updateBooking, updateStarPower } = useSitaraStore();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const booking = bookings.find((b) => b.id === bookingId);

  const handleSubmit = async () => {
    // Simulate on-chain review minting
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    updateBooking(bookingId!, { reviewSubmitted: true });
    updateStarPower(25); // Earn 25 star power for review
    
    setSubmitted(true);
  };

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-600">Booking not found.</p>
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
          Your review is now on-chain and verified. You earned <strong>+25 Star Power</strong>.
        </p>
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
      <p className="text-slate-600 mb-8">Your verified review helps others and earns you star power.</p>

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
                  className={`text-3xl transition-colors ${
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
            onClick={handleSubmit}
            disabled={rating === 0 || !review.trim()}
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
}
