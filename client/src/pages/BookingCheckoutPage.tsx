import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { tokens, Surface, Button } from '../design-system';
import { bookingPaymentService, nightlifeVenuesService } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface TableType { id: string; name: string; basePrice: number; capacity: number; deposit: number; }
interface BottlePackage { id: string; name: string; basePrice: number; bottles: number; }

export const BookingCheckoutPage: React.FC = () => {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [step, setStep] = useState<'select' | 'pay'>('select');
  const [selectedTable, setSelectedTable] = useState<TableType | null>(null);
  const [selectedBottle, setSelectedBottle] = useState<BottlePackage | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [specialRequests] = useState('');
  const [promoApplied] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'paylio' | 'raast'>('paylio');

  useEffect(() => {
    if (isAuthenticated && user) {
      setGuestName(prev => prev || `${user.firstName} ${user.lastName}`.trim());
      setGuestEmail(prev => prev || user.email || '');
      setGuestPhone(prev => prev || (user.phone || ''));
    }
  }, [isAuthenticated, user]);

  const { data: venueData } = useQuery(['nightlife-venue', venueId], () => nightlifeVenuesService.getDetails(venueId!), { enabled: !!venueId });
  const { data: tablesData } = useQuery(['nightlife-tables', venueId], () => nightlifeVenuesService.getTables(venueId!), { enabled: !!venueId });
  const { data: bottlesData } = useQuery(['nightlife-bottles', venueId], () => nightlifeVenuesService.getBottles(venueId!), { enabled: !!venueId });

  const venue = venueData?.data;
  const tables: TableType[] = tablesData?.data || [];
  const bottles: BottlePackage[] = bottlesData?.data || [];
  const coverCharge = venue?.coverCharges?.[0]?.amount || 50;
  const promoDiscount = promoApplied ? 0.1 : 0;
  const coverChargeTotal = parseInt(partySize) * coverCharge;
  const subtotal = (selectedTable?.basePrice || 0) + (selectedBottle?.basePrice || 0) + coverChargeTotal;
  const discount = subtotal * promoDiscount;
  const total = subtotal - discount;
  const depositAmount = total * (depositPercent / 100);

  const handleConfirmBooking = async () => {
    if (!venueId || !isAuthenticated) { navigate('/login'); return; }
    setError('');
    setIsProcessing(true);
    try {
      const result = await bookingPaymentService.createBooking({
        businessId: venueId,
        reservationDate: new Date().toISOString().split('T')[0],
        reservationTime: '22:00',
        numberOfGuests: parseInt(partySize, 10),
        customerName: guestName,
        customerEmail: guestEmail,
        customerPhone: guestPhone,
        depositAmount: depositAmount || 25,
        specialRequests: [
          selectedTable ? `Table: ${selectedTable.name}` : '',
          selectedBottle && selectedBottle.basePrice > 0 ? `Bottle: ${selectedBottle.name}` : '',
          specialRequests,
        ].filter(Boolean).join('\n'),
        paymentMethod,
      });
      const data = result.data?.data;
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data?.bookingReference) {
        setBookingResult(data);
      } else {
        setError('Booking failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Booking failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (bookingResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--cream)" }}>
        <Surface className="p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[rgba(var(--sage),0.15)] flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[var(--sage)] text-3xl">check_circle</span>
          </div>
          <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-2">
            {bookingResult.paymentMethod === 'raast' ? 'Raast Payment Pending' : 'Booked!'}
          </h2>
          <p className="mb-4 text-sm text-[var(--soft-stone)]">
            {bookingResult.paymentMethod === 'raast'
              ? 'Complete your Raast transfer to confirm'
              : 'Deposit held in escrow until check-in'}
          </p>
          <Surface className="p-4 mb-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--soft-stone)]">Reference</span>
              <span className="text-sm font-mono font-bold text-[var(--clay)]">{bookingResult.bookingReference}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--soft-stone)]">Deposit</span>
              <span className="text-sm font-bold text-[var(--sage)]">${depositAmount.toFixed(2)}</span>
            </div>
            {bookingResult.paymentMethod === 'raast' && bookingResult.raastId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--soft-stone)]">Raast ID</span>
                <span className="text-sm font-mono font-bold text-[var(--clay)]">{bookingResult.raastId}</span>
              </div>
            )}
          </Surface>
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/reservations')}>View Bookings</Button>
            <Button variant="ghost" onClick={() => navigate(-1)}>Done</Button>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, "rgba(99,102,241,0.06)" 0%, transparent 60%)" }} />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 md:py-8 pb-32 md:pb-8">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => step === 'pay' ? setStep('select') : navigate(-1)} className="flex items-center gap-1 text-[var(--soft-stone)] hover:text-[var(--warm-ink)] mb-3 text-sm">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Back
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--warm-ink)]">{step === 'select' ? 'Book a Table' : 'Pay Deposit'}</h1>
          {venue && <p className="text-sm text-[var(--soft-stone)] mt-1">{venue.name} · {venue.city || venue.address}</p>}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${step === 'select' ? 'bg-[rgba(var(--clay),0.15)] text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[rgba(var(--sage),0.1)] text-[var(--sage)]'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step === 'select' ? 'bg-[var(--clay)] text-[var(--warm-ink)]' : 'bg-[var(--sage)] text-[var(--warm-ink)]'}`}>
              {step === 'pay' ? '✓' : '1'}
            </span> Select
          </div>
          <div className={`flex-1 h-0.5 ${step === 'pay' ? 'bg-[var(--sage)]' : 'bg-[var(--warm-sand)]'}`} />
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${step === 'pay' ? 'bg-[rgba(var(--clay),0.15)] text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step === 'pay' ? 'bg-[var(--clay)] text-[var(--warm-ink)]' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}>2</span> Pay
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl bg-[rgba(var(--terracotta),0.1)] border border-[rgba(var(--terracotta),0.2)] text-sm text-[var(--warm-ink)]">{error}</div>}

        {step === 'select' ? (
          <div className="space-y-4">
            {/* Tables */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--warm-ink)] mb-3">Choose Table</h3>
              <div className="grid grid-cols-2 gap-2">
                {tables.map(table => (
                  <button key={table.id} onClick={() => setSelectedTable(table)}
                    className={`text-left p-3 rounded-xl border transition-all ${selectedTable?.id === table.id ? 'border-[var(--clay)] bg-[rgba(var(--clay),0.1)]' : 'border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] hover:bg-[var(--warm-sand)]'}`}>
                    <p className="text-sm font-bold text-[var(--warm-ink)]">{table.name}</p>
                    <p className="text-[10px] text-[var(--soft-stone)]">{table.capacity} guests · ${table.basePrice}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottles */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--warm-ink)] mb-3">Bottle Package <span className="text-[var(--soft-stone)] font-normal">(optional)</span></h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSelectedBottle(null)}
                  className={`text-left p-3 rounded-xl border transition-all ${!selectedBottle ? 'border-[var(--clay)] bg-[rgba(var(--clay),0.1)]' : 'border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] hover:bg-[var(--warm-sand)]'}`}>
                  <p className="text-sm font-bold text-[var(--warm-ink)]">None</p>
                  <p className="text-[10px] text-[var(--soft-stone)]">Skip</p>
                </button>
                {bottles.map(pkg => (
                  <button key={pkg.id} onClick={() => setSelectedBottle(pkg)}
                    className={`text-left p-3 rounded-xl border transition-all ${selectedBottle?.id === pkg.id ? 'border-[var(--clay)] bg-[rgba(var(--clay),0.1)]' : 'border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] hover:bg-[var(--warm-sand)]'}`}>
                    <p className="text-sm font-bold text-[var(--warm-ink)]">{pkg.name}</p>
                    <p className="text-[10px] text-[var(--soft-stone)]">{pkg.bottles} bottle{pkg.bottles > 1 ? 's' : ''} · ${pkg.basePrice}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Guest Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Name</label>
                <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your name"
                  className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm placeholder-[var(--soft-stone)] focus:outline-none focus:border-[var(--clay)]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Phone</label>
                <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm placeholder-[var(--soft-stone)] focus:outline-none focus:border-[var(--clay)]/50" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Party Size</label>
              <select value={partySize} onChange={e => setPartySize(e.target.value)}
                className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]/50">
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n} className="bg-[var(--warm-sand)]">{n} guests</option>)}
              </select>
            </div>

            <Button onClick={() => setStep('pay')} disabled={!selectedTable} className="w-full py-3.5 text-base font-semibold">
              Continue to Payment →
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Order summary */}
            <Surface className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--warm-ink)]">Order Summary</span>
                <span className="text-lg font-bold text-[var(--sage)]">${total.toFixed(2)}</span>
              </div>
              <div className="space-y-1 text-xs text-[var(--soft-stone)]">
                {selectedTable && <p>Table: {selectedTable.name} — ${selectedTable.basePrice}</p>}
                {selectedBottle && selectedBottle.basePrice > 0 && <p>Bottle: {selectedBottle.name} — ${selectedBottle.basePrice}</p>}
                <p>Cover: {partySize}x ${coverCharge} = ${coverChargeTotal}</p>
                {promoApplied && <p className="text-[var(--sage)]">Promo: -${discount.toFixed(2)}</p>}
              </div>
            </Surface>

            {/* Deposit slider */}
            <Surface className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--soft-stone)]">Deposit now</span>
                <span className="text-xl font-bold text-[var(--clay)]">${depositAmount.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                {[20, 50, 100].map(pct => (
                  <button key={pct} onClick={() => setDepositPercent(pct)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${depositPercent === pct ? 'bg-[rgba(var(--clay),0.15)] text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)]'}`}>
                    {pct}%
                  </button>
                ))}
              </div>
            </Surface>

            {/* Wallet buttons */}
            <button onClick={handleConfirmBooking} disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--warm-sand)] text-[var(--warm-ink)] font-semibold text-sm hover:bg-[var(--warm-sand)] active:scale-[0.98]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Pay ${depositAmount.toFixed(2)} with Apple Pay
            </button>
            <button onClick={handleConfirmBooking} disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-[var(--warm-sand)] active:scale-[0.98]">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor"/></svg>
              Pay ${depositAmount.toFixed(2)} with Google Pay
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-[var(--warm-sand)]" />
              <span className="text-[10px] text-[var(--soft-stone)] uppercase">or pay with</span>
              <div className="flex-1 h-px bg-[var(--warm-sand)]" />
            </div>

            {/* Payment method selector */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPaymentMethod('paylio')}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all ${paymentMethod === 'paylio' ? 'bg-[rgba(var(--clay),0.15)] text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'}`}>
                <span className="text-lg">💳</span>
                <span className="font-semibold">Card</span>
                <span className="text-[10px] text-[var(--soft-stone)]">Visa, Mastercard</span>
              </button>
              <button onClick={() => setPaymentMethod('raast')}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all ${paymentMethod === 'raast' ? 'bg-[rgba(var(--clay),0.15)] text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'}`}>
                <span className="text-lg">🏦</span>
                <span className="font-semibold">Raast</span>
                <span className="text-[10px] text-[var(--soft-stone)]">Instant transfer</span>
              </button>
            </div>

            {/* Raast instructions */}
            {paymentMethod === 'raast' && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[rgba(var(--sky-wash),0.1)] border border-[var(--sky-wash)]/20">
                  <h4 className="text-sm font-semibold text-[var(--warm-ink)] mb-2">How to pay with Raast</h4>
                  <ol className="text-xs text-[var(--soft-stone)] space-y-1.5 list-decimal list-inside">
                    <li>Open your bank app (HBL, Meezan, ABL, etc.)</li>
                    <li>Go to Raast transfers</li>
                    <li>Send <span className="font-bold text-[var(--clay)]">${depositAmount.toFixed(2)}</span> to the venue's Raast ID</li>
                    <li>Use your booking reference as the memo</li>
                    <li>Upload screenshot below for instant verification</li>
                  </ol>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--soft-stone)] mb-1">Payment Screenshot</label>
                  <input type="file" accept="image/*"
                    className="w-full px-3 py-2.5 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-xl text-[var(--warm-ink)] text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-[rgba(var(--clay),0.15)] file:text-[var(--clay)] file:text-xs file:font-medium" />
                  <p className="text-[10px] text-[var(--soft-stone)] mt-1">Upload proof for faster confirmation</p>
                </div>
              </div>
            )}

            {/* Card button */}
            {paymentMethod === 'paylio' && (
              <Button onClick={handleConfirmBooking} disabled={isProcessing} className="w-full py-3.5 text-base font-semibold">
                {isProcessing ? 'Processing...' : `Pay $${depositAmount.toFixed(2)} with Card →`}
              </Button>
            )}

            {/* Raast confirm button */}
            {paymentMethod === 'raast' && (
              <Button onClick={handleConfirmBooking} disabled={isProcessing} className="w-full py-3.5 text-base font-semibold">
                {isProcessing ? 'Creating...' : 'Create Booking & Show Raast Details →'}
              </Button>
            )}

            {/* Trust badge */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--sage)]/5 border border-[var(--sage)]/10">
              <span className="text-[var(--sage)] mt-0.5">🛡️</span>
              <div>
                <p className="text-xs font-medium text-[var(--warm-ink)]">Escrow Protected</p>
                <p className="text-[10px] text-[var(--soft-stone)]">Deposit held until check-in · Earn $PAB rewards</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky CTA */}
      {step === 'select' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden p-4 bg-gradient-to-t from-[#0a0f1a] to-transparent">
          <button onClick={() => setStep('pay')} disabled={!selectedTable}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-[var(--warm-ink)] font-semibold text-sm shadow-lg active:scale-[0.98] disabled:opacity-50">
            Continue to Payment →
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingCheckoutPage;
