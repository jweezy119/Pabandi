import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import apiClient from '../services/api';
import {
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  StarIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { executeBscDeposit, executeSolanaDeposit } from '../utils/web3';

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-on-surface-variant">
      {children}
    </label>
  );
}

function InputIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant/60">
      {icon}
    </div>
  );
}

type PaymentMethod = 'safepay' | 'bsc' | 'solana';

interface PlaceDetails {
  id?: string;
  googlePlaceId: string;
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  location?: { lat: number; lng: number };
  walletAddress?: string;
  phone?: string;
  isClaimed?: boolean;
  reviews?: any[];
  website?: string;
}

export default function NewReservationPage() {
  const { user } = useAuthStore();
  const location = useLocation();
  const initialPlace = location.state?.googlePlaceId
    ? {
        googlePlaceId: location.state.googlePlaceId,
        name: location.state.placeName,
        address: location.state.address || 'Selected venue',
      }
    : null;

  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(initialPlace);
  const [, setMapCenter] = useState({ lat: 24.8607, lng: 67.0011 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz.includes('Karachi') || tz.includes('Asia/Karachi') || tz.includes('Asia/Kabul')) {
            setMapCenter({ lat: 24.8607, lng: 67.0011 });
          }
        }
      );
    }

    if (initialPlace && initialPlace.googlePlaceId) {
      apiClient
        .get(`/businesses?googlePlaceId=${initialPlace.googlePlaceId}&search=${encodeURIComponent(initialPlace.name)}`)
        .then((res) => {
          const matchingBiz = res.data?.data?.businesses?.[0];
          if (matchingBiz) {
            setSelectedPlace({
              googlePlaceId: initialPlace.googlePlaceId,
              name: initialPlace.name,
              address: matchingBiz.address || '',
              id: matchingBiz.id,
              walletAddress: matchingBiz.walletAddress,
              phone: matchingBiz.phone,
              isClaimed: matchingBiz.isClaimed,
              rating: matchingBiz.rating,
              photoUrl: matchingBiz.coverImageUrl || matchingBiz.logoUrl,
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const [form, setForm] = useState({
    date: '',
    time: '',
    guests: '2',
    notes: '',
    paymentMethod: 'safepay' as PaymentMethod,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const getWhatsAppInviteUrl = () => {
    if (!selectedPlace) return '';
    const phone = selectedPlace.phone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = `Hi ${selectedPlace.name}! I just made a reservation at your venue using Pabandi. Please claim your profile to confirm and manage it: https://pabandi-42c5b.web.app/business/${selectedPlace.id}`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handlePlaceSelect = useCallback(async (place: PlaceDetails) => {
    setSelectedPlace(place);
    setError('');
    try {
      const res = await apiClient.get(`/businesses?googlePlaceId=${place.googlePlaceId}&search=${encodeURIComponent(place.name)}`);
      const matchingBiz = res.data?.data?.businesses?.[0];
      if (matchingBiz) {
        setSelectedPlace((prev) =>
          prev
            ? {
                ...prev,
                id: matchingBiz.id,
                walletAddress: matchingBiz.walletAddress,
                phone: matchingBiz.phone || prev.phone,
                isClaimed: matchingBiz.isClaimed,
              }
            : null
        );
      }
    } catch (err) {
      // ignore lookup errors
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setForm({ ...form, paymentMethod: method });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPlace) {
      setError('Please select a business to book.');
      return;
    }
    if (!form.date) {
      setError('Please select a date.');
      return;
    }
    if (!form.time) {
      setError('Please select a time slot.');
      return;
    }

    setLoading(true);
    let transactionHash: string | undefined;

    try {
      if (form.paymentMethod === 'bsc') {
        const result = await executeBscDeposit('0.05', selectedPlace.walletAddress || '0x1234567890123456789012345678901234567890');
        if (!result.success) {
          setError(`BSC Deposit Failed: ${result.error}`);
          setLoading(false);
          return;
        }
        transactionHash = result.transactionHash;
      } else if (form.paymentMethod === 'solana') {
        const result = await executeSolanaDeposit(0.1, selectedPlace.walletAddress || 'PABANDi111111111111111111111111111111111111');
        if (!result.success) {
          setError(`Solana Deposit Failed: ${result.error}`);
          setLoading(false);
          return;
        }
        transactionHash = result.transactionHash;
      }

      const response = await apiClient.post('/reservations', {
        businessId: selectedPlace.id || selectedPlace.googlePlaceId,
        customerName: `${user?.firstName} ${user?.lastName}`,
        customerPhone: user?.phone || '',
        reservationDate: form.date,
        reservationTime: form.time,
        numberOfGuests: parseInt(form.guests) || 1,
        specialRequests: form.notes || undefined,
        paymentMethod: form.paymentMethod,
        transactionHash,
      });

      const checkoutUrl = response?.data?.data?.checkoutUrl;
      if (form.paymentMethod === 'safepay' && checkoutUrl) {
        if (checkoutUrl.includes('getsafepay.com')) {
          window.location.href = checkoutUrl;
          return;
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-surface min-h-screen text-on-surface flex items-center justify-center p-6">
        <div className="text-center max-w-sm bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/20">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim">
            <CheckCircleIcon className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-headline font-bold mb-3 text-primary">Reservation Submitted!</h2>
          <p className="text-sm mb-2 text-on-surface-variant">
            <span className="font-semibold text-on-surface">{selectedPlace?.name}</span>
          </p>
          <p className="text-sm mb-6 text-on-surface-variant">
            {new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' at '}
            {form.time} · {form.guests} {Number(form.guests) === 1 ? 'guest' : 'guests'}
          </p>

          {selectedPlace?.phone && (
            <div className="mb-4">
              <a
                href={`tel:${selectedPlace.phone}`}
                className="w-full bg-primary text-on-primary font-headline text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all text-center shadow-sm"
              >
                📞 Call to Verify: {selectedPlace.phone}
              </a>
            </div>
          )}

          {!selectedPlace?.isClaimed && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-left space-y-3 font-body">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                This business is currently unclaimed on Pabandi. To ensure your booking is processed immediately, please invite the owner to join:
              </p>
              <a
                href={getWhatsAppInviteUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] text-white font-headline text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-[#20ba5a] transition-all text-center shadow-sm"
              >
                💬 Send WhatsApp Invitation
              </a>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setSuccess(false);
                setForm({ date: '', time: '', guests: '2', notes: '', paymentMethod: 'safepay' });
                setSelectedPlace(null);
              }}
              className="px-5 py-2.5 rounded-md text-sm font-medium transition-all bg-surface-container hover:bg-surface-container-high text-on-surface"
            >
              Add Another
            </button>
            <Link
              to="/reservations"
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-medium px-5 py-2.5 rounded-md shadow-sm hover:opacity-90"
            >
              View Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen text-on-surface pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-colors text-on-surface-variant hover:text-primary"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">New Booking</h1>
          <p className="mt-1.5 text-sm text-on-surface-variant font-body">
            Search for a venue and book instantly.
          </p>
        </div>

        {/* Venue Selection */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/20 mb-8">
          <FieldLabel>Select Venue</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'demo_1', name: 'Karachi Gymkhana', address: 'Club Road, Karachi', phone: '+92 300 111 2222', rating: 4.8 },
              { id: 'demo_2', name: 'Cafe Flo', address: 'Clifton Block 4, Karachi', phone: '+92 300 333 4444', rating: 4.9 },
              { id: 'demo_3', name: 'Toni & Guy', address: 'DHA Phase 6, Karachi', phone: '+92 300 555 6666', rating: 4.7 },
            ].map((venue) => (
              <button
                key={venue.id}
                onClick={() =>
                  handlePlaceSelect({
                    googlePlaceId: venue.id,
                    name: venue.name,
                    address: venue.address,
                    phone: venue.phone,
                    rating: venue.rating,
                    userRatingsTotal: 124,
                    isClaimed: true,
                    photoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400',
                  })
                }
                className={`flex flex-col items-start gap-2 rounded-lg border px-4 py-3 text-left transition-colors ${
                  selectedPlace?.googlePlaceId === venue.id
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                  <StarIcon className="h-3.5 w-3.5" /> {venue.rating}
                </div>
                <div>
                  <div className="text-sm font-bold text-primary">{venue.name}</div>
                  <div className="text-xs text-on-surface-variant">{venue.address}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedPlace ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
            {/* Left Column - Form */}
            <div className="space-y-6">
              <div className="rounded-xl p-6 sm:p-8 bg-surface-container-lowest shadow-sm border border-outline-variant/20">
                <h3 className="font-headline text-lg font-bold text-primary mb-4">Reservation Details</h3>

                {error && (
                  <div className="mb-5 px-4 py-3 rounded-lg text-sm font-medium flex items-start gap-3 bg-error-container text-on-error-container">
                    <ShieldCheckIcon className="h-5 w-5 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Date + Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Date</FieldLabel>
                      <div className="relative">
                        <InputIcon icon={<CalendarIcon className="h-4 w-4" />} />
                        <input
                          name="date"
                          type="date"
                          required
                          min={today}
                          value={form.date}
                          onChange={handleChange}
                          className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 pl-10 outline-none font-body text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Time</FieldLabel>
                      <div className="relative">
                        <InputIcon icon={<ClockIcon className="h-4 w-4" />} />
                        <select
                          name="time"
                          required
                          value={form.time}
                          onChange={handleChange}
                          className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 pl-10 outline-none font-body text-sm appearance-none font-medium"
                        >
                          <option value="" disabled>Time</option>
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Guests */}
                  <div>
                    <FieldLabel>Number of Guests</FieldLabel>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, guests: String(Math.max(1, parseInt(f.guests) - 1)) }))}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold border border-outline-variant/30 hover:bg-surface-container text-primary"
                      >
                        −
                      </button>
                      <div className="relative flex-1">
                        <InputIcon icon={<UserGroupIcon className="h-4 w-4" />} />
                        <input
                          name="guests"
                          type="number"
                          min="1"
                          max="50"
                          value={form.guests}
                          onChange={handleChange}
                          className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 pl-10 outline-none font-body text-sm text-center"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, guests: String(Math.min(50, parseInt(f.guests) + 1)) }))}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold border border-outline-variant/30 hover:bg-surface-container text-primary"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <FieldLabel>Payment Method</FieldLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'safepay', label: 'Safepay', icon: <CreditCardIcon className="h-5 w-5" /> },
                        { id: 'bsc', label: 'BSC', icon: <CurrencyDollarIcon className="h-5 w-5" /> },
                        { id: 'solana', label: 'Solana', icon: <span className="text-sm font-bold">◎</span> },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handlePaymentMethodChange(m.id as PaymentMethod)}
                          className={`flex flex-col items-center justify-center py-3 rounded-lg border transition-all ${
                            form.paymentMethod === m.id
                              ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                              : 'border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low'
                          }`}
                        >
                          {m.icon}
                          <span className="mt-1 text-[11px] font-bold text-on-surface">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <FieldLabel>Special Requests</FieldLabel>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      rows={3}
                      className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm"
                      placeholder="Allergies, seating preferences, etc."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-bold rounded-xl shadow-[0_8px_16px_rgba(20,241,149,0.2)] transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? 'Processing...' : 'Confirm Reservation'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              <div className="rounded-xl p-6 bg-surface-container-low border border-outline-variant/20">
                <h3 className="font-headline text-lg font-bold text-primary mb-4">Booking Summary</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-on-surface-variant uppercase tracking-wider">Venue</div>
                    <div className="font-bold text-on-surface">{selectedPlace.name}</div>
                    <div className="text-xs text-on-surface-variant">{selectedPlace.address}</div>
                  </div>
                  <div>
                    <div className="text-xs text-on-surface-variant uppercase tracking-wider">Date & Time</div>
                    <div className="font-bold text-on-surface">
                      {form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'} {form.time ? `· ${form.time}` : ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-on-surface-variant uppercase tracking-wider">Guests</div>
                    <div className="font-bold text-on-surface">{form.guests}</div>
                  </div>
                  <div>
                    <div className="text-xs text-on-surface-variant uppercase tracking-wider">Payment</div>
                    <div className="font-bold text-on-surface capitalize">{form.paymentMethod}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4 bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                <p>This booking is protected by Pabandi’s Reliability Layer. No-shows may affect your future access to priority bookings.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-8 bg-surface-container-low border border-outline-variant/20 text-center">
            <MapPinIcon className="h-8 w-8 mx-auto mb-3 text-primary" />
            <p className="text-sm text-on-surface-variant">Select a venue above to start your reservation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
