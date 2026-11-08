// Sitara OS — Premium Booking Flow Page
// Core revenue loop: Details → Review & Pay → Confirmed
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import QRCode from '../../components/QRCode';
import { API_HOST } from '../../utils/apiHost';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ClaySkeletonCard } from '../../components/primitives/ClaySkeleton';

interface BookingState {
  step: number;
  date: string;
  time: string;
  partySize: number;
  location: string;
  businessName: string;
  bookingRef: string | null;
  squareCheckoutUrl: string | null;
  depositAmount: number;
  rewardsReward: number;
  rewardsBusinessEarns: number;
  reservationId: string | null;
  qrCode: string | null;
  paymentStatus: 'pending' | 'processing' | 'confirmed' | 'cancelled';
  error: string | null;
}

export default function BookingFlowPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const [loadingBiz, setLoadingBiz] = useState(true);

  const [state, setState] = useState<BookingState>({
    step: 1,
    date: '',
    time: '',
    partySize: 2,
    location: (location.state as any)?.location || '',
    businessName: '',
    bookingRef: null,
    squareCheckoutUrl: null,
    depositAmount: 25,
    rewardsReward: 0,
    rewardsBusinessEarns: 0,
    reservationId: null,
    qrCode: null,
    paymentStatus: 'pending',
    error: null,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    setLoadingBiz(true);
    fetch(`${API_HOST}/api/v1/businesses/${businessId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setState((s) => ({ ...s, businessName: data.data.name || 'this business' }));
        }
      })
      .catch(() => {
        setState((s) => ({ ...s, businessName: 'this business' }));
      })
      .finally(() => setLoadingBiz(false));
  }, [businessId]);

  const handleContinue = () => {
    if (state.date && state.time) {
      setState((s) => ({ ...s, step: 2, error: null }));
    }
  };

  const handleInitiatePayment = async () => {
    setLoading(true);
    setState((s) => ({ ...s, error: null }));

    try {
      const response = await fetch(`${API_HOST}/api/v1/bookings/create-with-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          date: state.date,
          time: state.time,
          partySize: state.partySize,
          location: state.location,
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
          rewardsReward: rewardsPreview?.clientEarns ?? 0,
          rewardsBusinessEarns: rewardsPreview?.businessEarns ?? 0,
          reservationId,
          paymentStatus: 'processing',
          step: 2,
        }));

        if (squareCheckoutUrl) {
          window.location.href = squareCheckoutUrl;
        } else {
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
      const response = await fetch(`${API_HOST}/api/v1/bookings/status/${ref}`);
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

  const payButtonLabel = loading || state.paymentStatus === 'processing'
    ? 'Processing…'
    : `Lock Funds in Escrow - $${state.depositAmount.toFixed(2)}`;

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
    return hour12 + ':' + m + ' ' + ampm;
  };

  const stepIndicatorClass = (s: number) => {
    const base = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300';
    if (state.step >= s) {
      return base + ' bg-[var(--clay)] text-[var(--warm-ink)] shadow-lg shadow-[var(--clay)]/30';
    }
    return base + ' bg-[var(--warm-sand)]/40 text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)]';
  };

  const connectorClass = (s: number) => {
    const base = 'w-12 h-1 rounded-full transition-all duration-300';
    if (state.step > s) {
      return base + ' bg-[var(--clay)]';
    }
    return base + ' bg-[rgba(191,179,163,0.3)]';
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--cream)] text-[var(--warm-ink)]">
        <div className="max-w-lg mx-auto px-4 py-6">
          {loadingBiz && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <ClaySkeletonCard />
                <ClaySkeletonCard />
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[var(--warm-sand)] animate-pulse" />
                  <span className="text-[var(--soft-stone)] text-sm">Loading your business…</span>
                </div>
                </div>
                </div>
              )}
          {!loadingBiz && (
            <div>
              <div className="mb-6">
                <button
                  onClick={() => navigate(-1)}
                  className="text-[var(--clay)] hover:text-[var(--terracotta)] transition mb-2"
                >
                  ← Back
                </button>
                <h1 className="text-2xl font-bold text-[var(--warm-ink)]">{state.businessName}</h1>
                <p className="text-[var(--soft-stone)] text-sm mt-1">Secure booking with Pabandi escrow</p>
              </div>

              <div className="flex items-center justify-center gap-3 mb-8">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={stepIndicatorClass(s)}>
                      {state.step > s ? '✓' : s}
                    </div>
                    {s < 3 && (
                      <div className={connectorClass(s)} />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-center gap-4 mb-6 text-xs text-[var(--soft-stone)]">
                <span className={state.step >= 1 ? 'text-[var(--clay)] font-semibold' : ''}>Details</span>
                <span className={state.step >= 2 ? 'text-[var(--clay)] font-semibold' : ''}>Review & Pay</span>
                <span className={state.step >= 3 ? 'text-[var(--clay)] font-semibold' : ''}>Confirmed</span>
              </div>

              {state.error && (
                <div className="rounded-xl p-4 mb-4 text-sm font-medium text-[var(--dusty-rose)]" style={{ background: 'rgba(205, 92, 92, 0.1)', border: '1px solid rgba(205, 92, 92, 0.3)' }}>
                  <p className="font-medium">⚠️ {state.error}</p>
                </div>
              )}

              {state.step === 1 && (
                <div className="space-y-4">
                  <div className="rounded-xl p-6 border border-[rgba(191,179,163,0.3)] bg-white shadow-[var(--shadow-soft)]">
                    <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">When are you visiting?</h2>

                    <div className="mb-4">
                      <label className="block text-sm font-bold text-[var(--warm-ink)] mb-2">Date</label>
                      <input
                        type="date"
                        value={state.date}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] transition"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-bold text-[var(--warm-ink)] mb-2">Time</label>
                      <input
                        type="time"
                        value={state.time}
                        onChange={(e) => setState((s) => ({ ...s, time: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] transition"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-bold text-[var(--warm-ink)] mb-2">Service Address / Location</label>
                      <input
                        type="text"
                        value={state.location}
                        placeholder="Enter service address or location…"
                        onChange={(e) => setState((s) => ({ ...s, location: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)] transition"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-bold text-[var(--warm-ink)] mb-2">Party Size</label>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setState((s) => ({ ...s, partySize: Math.max(1, s.partySize - 1) }))}
                          className="w-12 h-12 rounded-xl border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] text-xl font-bold hover:bg-[var(--warm-sand)]/40 transition"
                        >
                          −
                        </button>
                        <span className="text-2xl font-bold text-[var(--warm-ink)] min-w-[3rem] text-center">{state.partySize}</span>
                        <button
                          onClick={() => setState((s) => ({ ...s, partySize: Math.min(20, s.partySize + 1) }))}
                          className="w-12 h-12 rounded-xl border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] text-xl font-bold hover:bg-[var(--warm-sand)]/40 transition"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleContinue}
                      disabled={!state.date || !state.time}
                      className="w-full py-4 bg-[var(--clay)] text-[var(--warm-ink)] font-bold rounded-xl hover:bg-[var(--muted-ochre)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[var(--clay)]/20 text-lg"
                    >
                      Continue →
                    </button>
                </div>
                </div>
              )}

              {state.step === 2 && state.paymentStatus !== 'confirmed' && (
                <div className="space-y-4">
                  <div className="rounded-xl p-6 border border-[rgba(191,179,163,0.3)] bg-white shadow-[var(--shadow-soft)]">
                    <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Booking Summary</h2>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--soft-stone)] text-sm">Date</span>
                        <span className="text-[var(--warm-ink)] font-medium">{formatDate(state.date)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--soft-stone)] text-sm">Time</span>
                        <span className="text-[var(--warm-ink)] font-medium">{formatTime(state.time)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--soft-stone)] text-sm">Location</span>
                        <span className="text-[var(--warm-ink)] font-medium">{state.location || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--soft-stone)] text-sm">Party</span>
                        <span className="text-[var(--warm-ink)] font-medium">{state.partySize} guests</span>
                      </div>
                      <div className="border-t border-[rgba(191,179,163,0.3)] pt-3 flex justify-between items-center">
                        <span className="text-[var(--soft-stone)] text-sm">Deposit (held in escrow)</span>
                        <span className="text-[var(--warm-ink)] font-bold text-lg">${state.depositAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {state.rewardsPreview && (
                    <div className="rounded-xl p-6 border border-[rgba(138,154,123,0.3)] bg-[rgba(138,154,123,0.1)]">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">🪙</span>
                        <h3 className="text-[var(--sage)] font-semibold">You'll earn rewards!</h3>
                      </div>
                      <p className="text-2xl font-bold text-[var(--sage)]">+{state.rewardsPreview.clientEarns.toFixed(2)} PAB</p>
                      <p className="text-xs text-[var(--soft-stone)] mt-1">{'$' + state.rewardsPreview.clientEarnsUsd.toFixed(2) + ' USD value'}</p>
                      <p className="text-xs text-[var(--soft-stone)] mt-2">Business earns +{state.rewardsPreview.businessEarns.toFixed(2)} PAB too!</p>
                    </div>
                  )}

                  <div className="rounded-xl p-4 border border-[rgba(191,179,163,0.3)] bg-white">
                    <div className="flex items-center gap-2 text-sm text-[var(--soft-stone)]">
                      <span>🔒</span>
                      <span>Your deposit is protected by Pabandi escrow. Released only when you check in.</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleInitiatePayment}
                      disabled={loading || state.paymentStatus === 'processing'}
                      className="w-full py-4 bg-[var(--warm-ink)] text-[var(--cream)] font-bold rounded-xl hover:bg-[var(--clay)] disabled:opacity-40 transition-all duration-300 shadow-lg shadow-[var(--clay)]/20 text-lg"
                    >
                      {payButtonLabel}
                    </button>

                    <button
                      onClick={() => {
                        alert('USDC payment coming soon!');
                      }}
                      className="w-full py-3 border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] font-medium rounded-xl hover:bg-[var(--warm-sand)]/40 transition-all duration-300"
                    >
                      Pay with USDC ◎
                    </button>
                  </div>

                  {state.paymentStatus === 'cancelled' && (
                    <div className="space-y-3">
                      <button
                        onClick={handleRetry}
                        className="w-full py-4 bg-[var(--muted-ochre)] text-[var(--warm-ink)] font-bold rounded-xl hover:bg-[var(--terracotta)] transition-all duration-300"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setState((s) => ({ ...s, step: 1 }))}
                    className="w-full py-3 text-[var(--clay)] hover:text-[var(--terracotta)] transition"
                  >
                    ← Back to Details
                  </button>
                </div>
              )}

              {((state.step === 3 && state.paymentStatus === 'confirmed')) ? (
                <div className="space-y-4">
                  <div className="rounded-xl p-8 border border-[rgba(138,154,123,0.3)] bg-[rgba(138,154,123,0.1)] text-center">
                    <div className="w-20 h-20 bg-[var(--sage)] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--sage)] animate-pulse">
                      <svg className="w-10 h-10 text-[var(--cream)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-1">Booking Confirmed!</h2>
                    <p className="text-[var(--soft-stone)] text-sm mb-4">Your deposit is secured in escrow.</p>

                    {state.bookingRef && (
                      <div className="rounded-xl p-3 mb-4 inline-block border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)]">
                        <p className="text-xs text-[var(--soft-stone)] font-bold uppercase tracking-wider">Reference</p>
                        <p className="font-mono text-sm text-[var(--warm-ink)] font-bold">{state.bookingRef}</p>
                      </div>
                    )}

                    {state.rewardsPreview && (
                      <div className="rounded-xl p-5 border border-[rgba(138,154,123,0.3)] bg-[rgba(138,154,123,0.1)] text-center">
                        <p className="text-xs text-[var(--sage)] font-bold uppercase tracking-wider mb-1">PAB Earned</p>
                        <p className="text-3xl font-bold text-[var(--warm-ink)]">+{state.rewardsPreview.clientEarns.toFixed(2)} PAB</p>
                        <p className="text-xs text-[var(--soft-stone)] mt-1">{'$' + state.rewardsPreview.clientEarnsUsd.toFixed(2) + ' USD'}</p>
                      </div>
                    )}

                    <div className="rounded-xl p-6 border border-[rgba(191,179,163,0.3)] bg-white text-center">
                      <h3 className="text-[var(--warm-ink)] font-semibold mb-4">Show QR to host for check-in</h3>
                      {state.bookingRef && (
                        <QRCode value={state.bookingRef} size={180} label="Scan to check in" />
                      )}
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={() => navigate('/sitara/checkin')}
                        className="w-full py-4 bg-[var(--clay)] text-[var(--warm-ink)] font-bold rounded-xl hover:bg-[var(--muted-ochre)] transition-all duration-300 shadow-lg shadow-[var(--clay)]/20"
                      >
                        Go to Check-In →
                      </button>
                      <button
                        onClick={() => navigate('/sitara/my-bookings')}
                        className="w-full py-3 border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] font-medium rounded-xl hover:bg-[var(--warm-sand)]/40 transition"
                      >
                        View My Bookings
                      </button>
                    </div>
                  </div>
                </div>
                ) : null}
              </div>
            )}
            </div>
            </div>
          </ErrorBoundary>
    );
  }
