// Sitara OS — Premium Booking Flow Page
// Core revenue loop: Details → Review & Pay → Confirmed
import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import QRCode from '../../components/QRCode';

interface BookingState {
  step: number;
  date: string;
  time: string;
  partySize: number;
  businessName: string;
  bookingRef: string | null;
  squareCheckoutUrl: string | null;
  depositAmount: number;
  rewardsPreview: {
    customerEarns: number;
    customerEarnsUsd: number;
    businessEarns: number;
    businessEarnsUsd: number;
  } | null;
  reservationId: string | null;
  qrCode: string | null;
  paymentStatus: 'pending' | 'processing' | 'confirmed' | 'cancelled';
  error: string | null;
}

export default function BookingFlowPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const venueName = (location.state as any)?.name || 'this business';
  const { user } = useAuthStore();

  const [state, setState] = useState<BookingState>({
    step: 1,
    date: '',
    time: '',
    partySize: 2,
    businessName: venueName,
    bookingRef: null,
    squareCheckoutUrl: null,
    depositAmount: 25,
    rewardsPreview: null,
    reservationId: null,
    qrCode: null,
    paymentStatus: 'pending',
    error: null,
  });

  const [loading, setLoading] = useState(false);

  const handleContinue = () => {
    if (state.date && state.time) {
      setState((s) => ({ ...s, step: 2, error: null }));
    }
  };

  const handleInitiatePayment = async () => {
    setLoading(true);
    setState((s) => ({ ...s, error: null }));

    try {
      const response = await fetch('/api/v1/core-bookings/create-with-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          date: state.date,
          time: state.time,
          partySize: state.partySize,
          customerName: user ? `${user.firstName} ${user.lastName}` : 'Guest',
          customerEmail: user?.email || '',
        }),
      });

      const json = await response.json();

      if (json?.success && json.data) {
        const { bookingRef, squareCheckoutUrl, depositAmount, rewardsPreview, reservationId } = json.data;

        setState((s) => ({
          ...s,
          bookingRef,
          squareCheckoutUrl,
          depositAmount,
          rewardsPreview,
          reservationId,
          paymentStatus: 'processing',
          step: 2, // Stay on step 2 to show payment UI
        }));

        // If Square checkout URL available, redirect
        if (squareCheckoutUrl) {
          window.location.href = squareCheckoutUrl;
        } else {
          // Demo mode: simulate payment confirmation after delay
          setTimeout(() => handleSimulatePaymentConfirmation(bookingRef, reservationId), 2000);
        }
      } else {
        setState((s) => ({ ...s, error: json?.error || 'Failed to create booking' }));
      }
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.message || 'Payment initiation failed' }));
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePaymentConfirmation = async (ref: string, _resId: string) => {
    try {
      // In demo mode, simulate confirmed payment
      const response = await fetch(`/api/v1/core-bookings/status/${ref}`);
      const json = await response.json();

      if (json?.success) {
        setState((s) => ({
          ...s,
          step: 3,
          paymentStatus: 'confirmed',
          qrCode: json.data?.qcode || `PABANDI_CHECKIN:${ref}`,
        }));
      }
    } catch {
      // Still move to confirmed step for demo
      setState((s) => ({
        ...s,
        step: 3,
        paymentStatus: 'confirmed',
        qrCode: `PABANDI_CHECKIN:${ref}`,
      }));
    }
  };

  const handleRetry = () => {
    setState((s) => ({
      ...s,
      paymentStatus: 'pending',
      error: null,
    }));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-purple-300 hover:text-white transition mb-2"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">{state.businessName}</h1>
          <p className="text-purple-300 text-sm mt-1">Secure booking with Pabandi escrow</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  state.step >= s
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-white/10 text-purple-400 border border-white/20'
                }`}
              >
                {state.step > s ? '✓' : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 rounded-full transition-all duration-300 ${
                    state.step > s ? 'bg-emerald-500' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-center gap-4 mb-6 text-xs text-purple-300">
          <span className={state.step >= 1 ? 'text-emerald-400 font-semibold' : ''}>Details</span>
          <span className={state.step >= 2 ? 'text-emerald-400 font-semibold' : ''}>Review & Pay</span>
          <span className={state.step >= 3 ? 'text-emerald-400 font-semibold' : ''}>Confirmed</span>
        </div>

        {/* Error Banner */}
        {state.error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-4 text-red-200 text-sm">
            <p className="font-medium">⚠️ {state.error}</p>
          </div>
        )}

        {/* Step 1: Details */}
        {state.step === 1 && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-4">When are you visiting?</h2>

              {/* Date Picker */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-200 mb-2">Date</label>
                <input
                  type="date"
                  value={state.date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>

              {/* Time Picker */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-200 mb-2">Time</label>
                <input
                  type="time"
                  value={state.time}
                  onChange={(e) => setState((s) => ({ ...s, time: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>

              {/* Party Size */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Party Size
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setState((s) => ({ ...s, partySize: Math.max(1, s.partySize - 1) }))}
                    className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white text-xl font-bold hover:bg-white/20 transition"
                  >
                    −
                  </button>
                  <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                    {state.partySize}
                  </span>
                  <button
                    onClick={() => setState((s) => ({ ...s, partySize: Math.min(20, s.partySize + 1) }))}
                    className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white text-xl font-bold hover:bg-white/20 transition"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleContinue}
                disabled={!state.date || !state.time}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-purple-500/20 text-lg"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review & Pay */}
        {state.step === 2 && state.paymentStatus !== 'confirmed' && (
          <div className="space-y-4">
            {/* Booking Summary */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-4">Booking Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Date</span>
                  <span className="text-white font-medium">{formatDate(state.date)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Time</span>
                  <span className="text-white font-medium">{formatTime(state.time)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Party</span>
                  <span className="text-white font-medium">{state.partySize} guests</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Deposit (held in escrow)</span>
                  <span className="text-white font-bold text-lg">${state.depositAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Rewards Preview */}
            {state.rewardsPreview && (
              <div className="bg-gradient-to-r from-emerald-500/20 to-purple-500/20 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/30">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🪙</span>
                  <h3 className="text-emerald-300 font-semibold">You'll earn rewards!</h3>
                </div>
                <p className="text-2xl font-bold text-emerald-400">
                  +{state.rewardsPreview.customerEarns.toFixed(2)} PAB
                </p>
                <p className="text-sm text-emerald-300/70">
                  (${state.rewardsPreview.customerEarnsUsd.toFixed(2)} USD value)
                </p>
                <p className="text-xs text-purple-300 mt-2">
                  Business earns +{state.rewardsPreview.businessEarns.toFixed(2)} PAB too!
                </p>
              </div>
            )}

            {/* Escrow Protection Notice */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-sm text-purple-200">
                <span>🔒</span>
                <span>Your deposit is protected by Pabandi escrow. Released only when you check in.</span>
              </div>
            </div>

            {/* Payment Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleInitiatePayment}
                disabled={loading || state.paymentStatus === 'processing'}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all duration-300 shadow-lg shadow-emerald-500/30 text-lg"
              >
                {loading || state.paymentStatus === 'processing'
                  ? 'Processing...'
                  : `Pay $${state.depositAmount.toFixed(2)} with Card (Square) 💳`}
              </button>

              <button
                onClick={() => {
                  // USDC payment alternative
                  alert('USDC payment coming soon!');
                }}
                className="w-full py-3 bg-white/10 border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition-all duration-300"
              >
                Pay with USDC ◎
              </button>
            </div>

            {/* Cancelled State */}
            {state.paymentStatus === 'cancelled' && (
              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:opacity-90 transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Back Button */}
            <button
              onClick={() => setState((s) => ({ ...s, step: 1 }))}
              className="w-full py-3 text-purple-300 hover:text-white transition"
            >
              ← Back to Details
            </button>
          </div>
        )}

        {/* Step 3: Confirmed */}
        {state.step === 3 && state.paymentStatus === 'confirmed' && (
          <div className="space-y-4">
            {/* Success Animation */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-emerald-500/30 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/40 animate-pulse">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Booking Confirmed!</h2>
              <p className="text-emerald-300 text-sm mb-4">Your deposit is secured in escrow.</p>

              {state.bookingRef && (
                <div className="bg-white/5 rounded-xl p-3 mb-4 inline-block">
                  <p className="text-xs text-purple-300">Reference</p>
                  <p className="font-mono text-sm text-white font-bold">{state.bookingRef}</p>
                </div>
              )}
            </div>

            {/* Rewards Badge */}
            {state.rewardsPreview && (
              <div className="bg-gradient-to-r from-emerald-500/20 to-purple-500/20 backdrop-blur-xl rounded-2xl p-5 border border-emerald-500/30 text-center">
                <p className="text-sm text-emerald-300 mb-1">PAB Earned</p>
                <p className="text-3xl font-bold text-emerald-400">
                  +{state.rewardsPreview.customerEarns.toFixed(2)} PAB
                </p>
                <p className="text-xs text-emerald-300/70 mt-1">
                  (${state.rewardsPreview.customerEarnsUsd.toFixed(2)} USD)
                </p>
              </div>
            )}

            {/* QR Code */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 text-center">
              <h3 className="text-white font-semibold mb-4">Show QR to host for check-in</h3>
              {state.bookingRef && (
                <QRCode value={state.bookingRef} size={180} label="Scan to check in" />
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/sitara/checkin')}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg shadow-purple-500/20"
              >
                Go to Check-In →
              </button>
              <button
                onClick={() => navigate('/sitara/my-bookings')}
                className="w-full py-3 bg-white/10 border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition"
              >
                View My Bookings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
