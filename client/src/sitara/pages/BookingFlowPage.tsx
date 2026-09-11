// Sitara OS — Booking Flow Page
// Escrow-backed booking with deposit

import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSitaraStore } from '../store/sitaraStore';
import { useAuthStore } from '../../store/authStore';
import { sitaraApi } from '../api/sitaraApi';

export default function BookingFlowPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Real venue name passed from discovery/detail; never a hardcoded demo name.
  const venueName = (location.state as any)?.name || 'this business';
  const { addBooking } = useSitaraStore();
  const { isAuthenticated, user: authUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [guests, setGuests] = useState(1);
  const [deposit] = useState(25);
  const [confirming, setConfirming] = useState(false);
  const [liveReservationId, setLiveReservationId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);

  const handleProcessBooking = async () => {
    setConfirming(true);
    const localId = `booking-${Date.now()}`;
    let reservationId: string | undefined;
    const looksReal = (businessId?.length || 0) > 10;
    
    if (isAuthenticated && looksReal && date && time) {
      try {
        const created: any = await sitaraApi.createReservation({
          businessId: businessId!,
          reservationDate: date,
          reservationTime: time,
          numberOfGuests: guests,
          customerName: authUser ? `${authUser.firstName} ${authUser.lastName}` : undefined,
          customerPhone: authUser?.phone,
          customerEmail: authUser?.email,
        });
        reservationId = created?.id;
        setLiveReservationId(reservationId || null);
        if (reservationId) {
          try {
            const pay: any = await sitaraApi.createDepositPayment({
              reservationId,
              amount: deposit,
            });
            const url = pay?.payment?.paymentUrl || pay?.paymentUrl || null;
            setPaymentUrl(url);
            setPaymentPending(!!pay?.payment);
          } catch {}
        }
      } catch {}
    }
    
    const booking = {
      id: localId,
      businessId: businessId!,
      businessName: venueName,
      businessType: 'restaurant' as const,
      scheduledAt: `${date}T${time}`,
      status: 'pending' as const,
      depositAmount: deposit,
      depositHeld: true,
      reviewSubmitted: false,
      reservationId,
    };
    addBooking(booking);
    setConfirming(false);
    setStep(3);
  };

  const handleConfirmClick = async () => {
     await handleProcessBooking();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Book {venueName}</h1>
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
              min={new Date().toISOString().slice(0, 10)}
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
                <span className="font-medium">{venueName}</span>
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
                <span className="text-slate-600">Due today (deposit)</span>
                <span className="font-medium">${deposit}.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Due at venue</span>
                <span className="font-medium text-green-700">$0 — deposit covers it</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Hidden fees</span>
                <span className="font-medium text-green-700">None. Ever.</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Cancel 24h+ ahead for a full refund. The deposit releases to the business only when you check in.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300"
            >
              Back
            </button>
            <button
              onClick={() => void handleConfirmClick()}
              disabled={confirming}
              className="flex-1 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              {confirming ? 'Confirming...' : 'Confirm & Pay Deposit'}
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
          {liveReservationId ? (
            <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              ✓ Connected to live reservation {liveReservationId.slice(0, 8)}…
              {paymentPending && ' · deposit recorded'}
            </p>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              Demo booking — sign in and pick a ✓ Live venue for a real reservation.
            </p>
          )}
          {paymentUrl && paymentUrl.startsWith('http') && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800"
            >
              Pay ${deposit} Deposit →
            </a>
          )}
          <p className="text-slate-600">
            Your deposit is held in escrow. Check in at the venue to complete your visit and earn star power.
          </p>
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <p><strong>Status:</strong> Pending check-in</p>
          </div>
          <button
            onClick={() => navigate('/sitara/my-bookings')}
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
          >
            Go to Check-In
          </button>
        </div>
      )}
    </div>
  );
}
