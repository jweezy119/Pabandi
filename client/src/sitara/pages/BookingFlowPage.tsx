// Sitara OS — Booking Flow Page
// Escrow-backed booking with deposit

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';

export default function BookingFlowPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { addBooking } = useSitaraStore();
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [guests, setGuests] = useState(1);
  const [deposit] = useState(25);

  const handleConfirm = () => {
    const booking = {
      id: `booking-${Date.now()}`,
      businessId: businessId!,
      businessName: 'The Golden Fork',
      businessType: 'restaurant' as const,
      scheduledAt: `${date}T${time}`,
      status: 'pending' as const,
      depositAmount: deposit,
      depositHeld: true,
      reviewSubmitted: false,
    };
    addBooking(booking);
    navigate(`/sitara/checkin/${booking.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Book Your Experience</h1>
      <p className="text-slate-600 mb-8">Secure your booking with Sitara escrow protection.</p>

      {/* Progress */}
      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= s ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-amber-500' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Number of Guests</label>
            <input
              type="number"
              min={1}
              max={20}
              value={guests}
              onChange={(e) => setGuests(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!date || !time}
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h3 className="font-semibold text-amber-900 mb-2">Escrow Protection</h3>
            <p className="text-sm text-amber-800 mb-4">
              Your deposit of <strong>${deposit}</strong> is held in Sitara escrow. It will be released to the business when you check in, or refunded if you cancel 24h before.
            </p>
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <span>🔒</span>
              <span>Secured by Solana smart contracts</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Booking Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Business</span>
                <span className="font-medium">The Golden Fork</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Date & Time</span>
                <span className="font-medium">{date} at {time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Guests</span>
                <span className="font-medium">{guests}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-600">Deposit (escrow)</span>
                <span className="font-medium">${deposit}.00</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
            >
              Confirm & Pay Deposit
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Booking Confirmed!</h2>
          <p className="text-slate-600">
            Your deposit is held in escrow. Check in at the venue to complete your visit and earn star power.
          </p>
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <p><strong>Booking ID:</strong> booking-123456</p>
            <p><strong>Status:</strong> Pending check-in</p>
          </div>
          <button
            onClick={handleConfirm}
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
          >
            Go to Check-In
          </button>
        </div>
      )}
    </div>
  );
}
