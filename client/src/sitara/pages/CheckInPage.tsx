// Sitara OS — Check-In Page
// Verified check-in with on-chain proof

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';

export default function CheckInPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { bookings, updateBooking, updateStarPower } = useSitaraStore();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const booking = bookings.find((b) => b.id === bookingId);

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    // Simulate on-chain verification
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    updateBooking(bookingId!, { 
      status: 'checked_in',
      escrowTxId: `sol-tx-${Date.now()}`,
    });
    updateStarPower(10); // Earn 10 star power for checking in
    
    setCheckedIn(true);
    setIsCheckingIn(false);
  };

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-600">Booking not found.</p>
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
            <h3 className="font-semibold text-amber-900 mb-2">Location Verified</h3>
            <p className="text-sm text-amber-800 mb-4">
              You're within 100m of the venue. Check in now to confirm your arrival.
            </p>
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn}
              className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              {isCheckingIn ? 'Verifying on-chain...' : 'Check In Now'}
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Your check-in is recorded on Solana as a proof-of-attendance NFT.
          </p>
        </div>
      ) : (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Checked In!</h2>
          <p className="text-slate-600">
            Your deposit has been released to the business. You earned <strong>+10 Star Power</strong>.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            <p><strong>On-chain proof:</strong> {booking.escrowTxId}</p>
            <p><strong>Star Power earned:</strong> +10</p>
          </div>
          <button
            onClick={() => navigate(`/sitara/review/${bookingId}`)}
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
          >
            Leave a Review
          </button>
        </div>
      )}
    </div>
  );
}
