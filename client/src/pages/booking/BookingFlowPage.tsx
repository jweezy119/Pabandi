import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayCard } from '../../components/clay/ClayCard';
import { apiClient, API_HOST } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { PabandiCheckoutModal } from '../../components/PabandiCheckoutModal';

const NAV_ITEMS = [
  { path: '/booking', label: 'Discovery', icon: 'explore' },
  { path: '/booking/flow', label: 'Bookings', icon: 'event', end: true },
  { path: '/booking#my-bookings', label: 'My Bookings', icon: 'bookmark' },
];

interface Business {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
}

interface Slot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export default function BookingFlowPage() {
  const { user } = useAuthStore();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [depositAmount, setDepositAmount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ bookingId: string; escrowId: string } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const fetchBusinesses = async () => {
    try {
      const res = await apiClient.get('/booking/businesses');
      setBusinesses(res.data.data || []);
    } catch (err: any) {
      console.error('[BookingFlow] fetch businesses error:', err.message);
    }
  };

  const fetchSlots = async () => {
    if (!selectedBusiness) return;
    try {
      const res = await apiClient.get(
        `/booking-availability/${selectedBusiness.id}/slots?startDate=${new Date().toISOString().split('T')[0]}&endDate=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
      );
      setSlots(res.data.data || []);
    } catch (err: any) {
      console.error('[BookingFlow] fetch slots error:', err.message);
    }
  };

  const handleConfirm = async () => {
    if (!selectedBusiness || !selectedSlot) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiClient.post('/booking', {
        businessId: selectedBusiness.id,
        slotStart: new Date(`${selectedSlot.date}T${selectedSlot.startTime}:00`).toISOString(),
        slotEnd: new Date(`${selectedSlot.date}T${selectedSlot.endTime}:00`).toISOString(),
        serviceType: selectedBusiness.category,
        numberOfGuests: partySize,
        depositAmount,
      });

      if (res.data.success) {
        setSuccess({
          bookingId: res.data.data.bookingId,
          escrowId: res.data.data.escrowId,
        });
        setCheckoutOpen(true);
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('This slot is already booked. Please choose another time.');
      } else {
        setError(err.response?.data?.error || 'Booking failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout osName="BookingOS" osIcon="★" osColor="emerald" navItems={NAV_ITEMS}>
      <div className="min-h-screen bg-[var(--cream)] text-[var(--warm-ink)]">
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Booking Flow</h1>
          <p className="text-[var(--soft-stone)] text-sm mt-1">Book a service with escrow-protected deposit</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl border border-[var(--terracotta)] bg-[var(--terracotta)]/10 text-[var(--terracotta)] text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 rounded-xl border border-[var(--sage)] bg-[var(--sage)]/10 text-[var(--sage)] space-y-3">
              <div>
                <h2 className="text-sm font-bold mb-1">Booking Created ✓</h2>
                <p className="text-[var(--soft-stone)] text-sm">
                  Booking #{success.bookingId} created. Fund your ${depositAmount.toFixed(2)} deposit via Square or Solana Pay to lock escrow #{success.escrowId}.
                </p>
              </div>
              <ClayButton
                onClick={() => setCheckoutOpen(true)}
                variant="primary"
                className="w-full py-2.5"
              >
                💳 Fund ${depositAmount.toFixed(2)} Deposit (Square / Solana Pay)
              </ClayButton>
              <PabandiCheckoutModal
                open={checkoutOpen}
                onClose={() => setCheckoutOpen(false)}
                title={`Booking Deposit — ${selectedBusiness?.name || 'Service'}`}
                subtitle={`Booking #${success.bookingId}`}
                amount={depositAmount}
                currency="USD"
                referenceId={`booking-${success.bookingId}`}
                squareNote={`pabandi:booking:${success.bookingId}`}
                customerEmail={user?.email}
              />
            </div>
          )}

          {!success && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ClayCard className="p-4">
                <h2 className="text-sm font-bold mb-3 text-[var(--warm-ink)]">1. Select Business</h2>
                <div className="space-y-2">
                  {businesses.length === 0 ? (
                    <button
                      onClick={fetchBusinesses}
                      className="w-full py-3 border border-[rgba(191,179,163,0.3)] rounded-xl bg-[var(--warm-sand)]/40 text-[var(--soft-stone)] text-sm hover:bg-[var(--warm-sand)]/60 transition"
                    >
                      Load Businesses
                    </button>
                  ) : (
                    businesses.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSelectedBusiness(b);
                          setSelectedSlot(null);
                          fetchSlots();
                        }}
                        className={`w-full py-3 rounded-xl border text-left text-sm transition ${
                          selectedBusiness?.id === b.id
                            ? 'bg-[var(--clay)] text-[var(--cream)] border-[var(--clay)]'
                            : 'bg-[var(--warm-sand)]/40 text-[var(--soft-stone)] border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]/60'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="font-bold">{b.name}</span>
                          <span className="text-[10px]">{b.category}</span>
                        </div>
                        <p className="text-[10px] mt-1 text-[var(--soft-stone)]">{b.city} • {b.rating}★</p>
                      </button>
                    ))
                  )}
                </div>
              </ClayCard>

              <ClayCard className="p-4">
                <h2 className="text-sm font-bold mb-3 text-[var(--warm-ink)]">2. Select Time Slot</h2>
                {selectedSlot ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--soft-stone)]">{selectedSlot.date}</span>
                      <span className="text-xs font-bold text-[var(--clay)]">{selectedSlot.startTime} - {selectedSlot.endTime}</span>
                    </div>
                    <label className="block text-xs font-bold mb-1 text-[var(--soft-stone)]">Party Size</label>
                    <select
                      value={partySize}
                      onChange={(e) => setPartySize(parseInt(e.target.value, 10))}
                      className="w-full py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)]/40 text-[var(--warm-ink)] text-sm focus:border-[var(--clay)] focus:outline-none"
                    >
                      <option value={1}>1 Guest</option>
                      <option value={2}>2 Guests</option>
                      <option value={4}>4 Guests</option>
                      <option value={6}>6 Guests</option>
                    </select>
                    <label className="block text-xs font-bold mb-1 text-[var(--soft-stone)] mt-2">Deposit</label>
                    <select
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
                      className="w-full py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)]/40 text-[var(--warm-ink)] text-sm focus:border-[var(--clay)] focus:outline-none"
                    >
                      <option value={25}>$25.00</option>
                      <option value={50}>$50.00</option>
                      <option value={100}>$100.00</option>
                    </select>
                    <ClayButton
                      onClick={handleConfirm}
                      disabled={loading || !selectedSlot}
                      variant="primary"
                      className="w-full py-3 mt-4"
                    >
                      {loading ? 'Booking…' : 'Confirm Booking'}
                    </ClayButton>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-[var(--soft-stone)] text-sm">
                    <p>Select a business to see available slots</p>
                  </div>
                )}
              </ClayCard>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}