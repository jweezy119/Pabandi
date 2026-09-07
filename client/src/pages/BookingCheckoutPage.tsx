import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tokens, Surface, Button, Badge, GlassCard } from '../design-system';

interface TableType {
  id: string;
  name: string;
  price: number;
  capacity: number;
  deposit: number;
}

interface BottlePackage {
  id: string;
  name: string;
  price: number;
  bottles: number;
}

const MOCK_TABLES: TableType[] = [
  { id: 't1', name: 'Standard Booth', price: 500, capacity: 4, deposit: 100 },
  { id: 't2', name: 'Premium Table', price: 1200, capacity: 6, deposit: 240 },
  { id: 't3', name: 'VIP Stage', price: 2500, capacity: 10, deposit: 500 },
  { id: 't4', name: 'Dance Floor', price: 4000, capacity: 15, deposit: 800 },
];

const MOCK_PACKAGES: BottlePackage[] = [
  { id: 'b0', name: 'None', price: 0, bottles: 0 },
  { id: 'b1', name: 'Starter', price: 300, bottles: 1 },
  { id: 'b2', name: 'Classic', price: 600, bottles: 2 },
  { id: 'b3', name: 'Premium', price: 1200, bottles: 4 },
  { id: 'b4', name: 'Royal', price: 2500, bottles: 8 },
];

export const BookingCheckoutPage: React.FC = () => {
  useParams<{ venueId: string }>(); // venueId available for API calls
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedTable, setSelectedTable] = useState<TableType | null>(null);
  const [selectedBottle, setSelectedBottle] = useState<BottlePackage>(MOCK_PACKAGES[0]);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [specialRequests, setSpecialRequests] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');

  const venue = {
    name: 'Eclipse Nightclub',
    city: 'Miami',
    coverCharge: 50,
  };

  const promoDiscount = promoApplied ? 0.1 : 0;
  const coverChargeTotal = parseInt(partySize) * venue.coverCharge;
  const subtotal = (selectedTable?.price || 0) + selectedBottle.price + coverChargeTotal;
  const discount = subtotal * promoDiscount;
  const total = subtotal - discount;
  const depositAmount = total * (depositPercent / 100);

  const handleConfirmBooking = () => {
    // Simulate booking creation
    const code = `PB-${Date.now().toString(36).toUpperCase()}`;
    setConfirmCode(code);
    setBookingSuccess(true);
  };

  if (bookingSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: tokens.color.background }}>
        <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 60%)' }} />
        <GlassCard className="p-8 max-w-md w-full text-center relative z-10">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-emerald-400 text-3xl">check_circle</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Booking Confirmed!</h2>
          <p className="mb-4" style={{ color: tokens.color.muted }}>Your reservation has been secured</p>
          
          <Surface className="p-4 mb-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: tokens.color.muted }}>Confirmation Code</span>
              <span className="text-sm font-mono font-bold text-indigo-300">{confirmCode}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: tokens.color.muted }}>Venue</span>
              <span className="text-sm text-slate-100">{venue.name}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: tokens.color.muted }}>Table</span>
              <span className="text-sm text-slate-100">{selectedTable?.name}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: tokens.color.muted }}>Party Size</span>
              <span className="text-sm text-slate-100">{partySize} guests</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: tokens.color.muted }}>Deposit Paid</span>
              <span className="text-sm font-bold text-emerald-300">${depositAmount.toFixed(2)} $PAB</span>
            </div>
          </Surface>

          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/booking/my-bookings')}>
              <span className="material-symbols-outlined text-sm">confirmation_number</span>
              View My Bookings
            </Button>
            <Button variant="ghost" onClick={() => navigate('/booking/venues/search')}>Browse More Venues</Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-400 hover:text-white mb-4 transition-colors">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Complete Your Booking</h1>
        </div>

        {/* Venue Summary */}
        <Surface className="p-4 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-300">location_on</span>
          </div>
          <div className="flex-1">
            <h3 className="text-slate-100 font-bold">{venue.name}</h3>
            <p className="text-xs" style={{ color: tokens.color.muted }}>{venue.city}</p>
          </div>
          <Badge tone="info">{venue.coverCharge}$ cover/person</Badge>
        </Surface>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto">
          {['Table', 'Bottle', 'Details', 'Payment'].map((label, i) => (
            <React.Fragment key={label}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${step === i + 1 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : step > i + 1 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                  {step > i + 1 ? <span className="material-symbols-outlined text-xs">check</span> : i + 1}
                </span>
                {label}
              </div>
              {i < 3 && <div className={`flex-1 h-0.5 ${step > i + 1 ? 'bg-emerald-500' : 'bg-white/10'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="mb-6">
          {/* Step 1: Table Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Select Your Table</h2>
              {MOCK_TABLES.map(table => (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`cursor-pointer transition-all ${selectedTable?.id === table.id ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <GlassCard className="p-4" hover lift={selectedTable?.id !== table.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-slate-100 font-bold">{table.name}</h3>
                        <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>
                          <span className="material-symbols-outlined text-xs align-middle">group</span> Up to {table.capacity} guests
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-300">${table.price}</p>
                        <p className="text-xs" style={{ color: tokens.color.muted }}>${table.deposit} deposit</p>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Bottle Package */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100 mb-2">Add Bottle Package</h2>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Optional - skip if not needed</p>
              {MOCK_PACKAGES.map(pkg => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedBottle(pkg)}
                  className={`cursor-pointer transition-all ${selectedBottle.id === pkg.id ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <GlassCard className="p-4" hover lift={selectedBottle.id !== pkg.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                          <span className="material-symbols-outlined text-amber-300 text-lg">{pkg.bottles === 0 ? 'block' : 'liquor'}</span>
                        </div>
                        <div>
                          <h3 className="text-slate-100 font-bold">{pkg.name}</h3>
                          {pkg.bottles > 0 && <p className="text-xs" style={{ color: tokens.color.muted }}>{pkg.bottles} bottle{pkg.bottles > 1 ? 's' : ''}</p>}
                        </div>
                      </div>
                      <p className="text-lg font-bold text-emerald-300">{pkg.price > 0 ? `$${pkg.price}` : 'Free'}</p>
                    </div>
                  </GlassCard>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Guest Info */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Guest Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Party Size *</label>
                  <select
                    value={partySize}
                    onChange={(e) => setPartySize(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500/50 text-sm"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n} className="bg-slate-800">{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Special Requests</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Birthday celebration, dietary restrictions, etc."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Review & Pay</h2>

              {/* Promo Code */}
              <Surface className="p-4">
                <label className="block text-xs font-medium text-slate-300 mb-2">Promo Code</label>
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
                  />
                  <Button variant="ghost" onClick={() => setPromoApplied(true)} disabled={!promoCode}>Apply</Button>
                </div>
                {promoApplied && <p className="text-xs text-emerald-300 mt-2 flex items-center gap-1"><span className="material-symbols-outlined text-xs">check_circle</span> 10% discount applied</p>}
              </Surface>

              {/* Price Breakdown */}
              <Surface className="p-4">
                <h3 className="text-sm font-semibold text-slate-100 mb-3">Price Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: tokens.color.muted }}>Table ({selectedTable?.name})</span>
                    <span className="text-slate-100">${selectedTable?.price || 0}</span>
                  </div>
                  {selectedBottle.price > 0 && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: tokens.color.muted }}>Bottle ({selectedBottle.name})</span>
                      <span className="text-slate-100">${selectedBottle.price}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span style={{ color: tokens.color.muted }}>Cover charge ({partySize}x ${venue.coverCharge})</span>
                    <span className="text-slate-100">${coverChargeTotal}</span>
                  </div>
                  {promoApplied && (
                    <div className="flex justify-between text-sm text-emerald-300">
                      <span>Promo discount (10%)</span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-3 border-t border-white/10">
                    <span className="text-slate-100">Total</span>
                    <span className="text-emerald-300">${total.toFixed(2)}</span>
                  </div>
                </div>
              </Surface>

              {/* Deposit Slider */}
              <Surface className="p-4">
                <h3 className="text-sm font-semibold text-slate-100 mb-3">Deposit Amount</h3>
                <div className="flex items-center gap-4 mb-3">
                  {[20, 50, 100].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setDepositPercent(pct)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${depositPercent === pct ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-400/20">
                  <span className="text-sm text-slate-300">Pay now:</span>
                  <span className="text-lg font-bold text-indigo-300">${depositAmount.toFixed(2)} $PAB</span>
                </div>
              </Surface>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500"
                />
                <span className="text-xs" style={{ color: tokens.color.muted }}>
                  I agree to the Terms of Service and Cancellation Policy. I understand that no-shows may result in deposit forfeiture.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !selectedTable}>
              Continue
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Button>
          ) : (
            <Button onClick={handleConfirmBooking} disabled={!acceptedTerms}>
              <span className="material-symbols-outlined text-sm">lock</span>
              Confirm & Pay Deposit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingCheckoutPage;
