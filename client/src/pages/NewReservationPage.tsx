import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import apiClient from '../services/api';
import {
  CalendarIcon, ClockIcon, UserGroupIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon, ArrowLeftIcon, ShieldCheckIcon,
  CreditCardIcon, CurrencyDollarIcon, StarIcon,
  MapPinIcon, MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { executeBscDeposit, executeSolanaDeposit } from '../utils/web3';
import {
  APIProvider,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';

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

interface GooglePlaceDetails {
  id?: string;
  googlePlaceId: string;
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  location?: { lat: number; lng: number };
  walletAddress?: string;
}

const PlaceAutocomplete = ({ onPlaceSelect }: { onPlaceSelect: (place: google.maps.places.PlaceResult) => void }) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ['place_id', 'geometry', 'name', 'formatted_address', 'rating', 'user_ratings_total', 'photos'],
      strictBounds: false,
    };

    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!placeAutocomplete) return;

    placeAutocomplete.addListener('place_changed', () => {
      onPlaceSelect(placeAutocomplete.getPlace());
    });
  }, [onPlaceSelect, placeAutocomplete]);

  return (
    <div className="relative">
      <InputIcon icon={<BuildingStorefrontIcon className="h-4 w-4" />} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Type business name or location..."
        className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 pl-10 outline-none font-body text-sm"
      />
    </div>
  );
};

export default function NewReservationPage() {
  const { user } = useAuthStore();

  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceDetails | null>(null);
  const [onPabandi, setOnPabandi] = useState(false);
  const [, setMapCenter] = useState({ lat: 37.0902, lng: -95.7129 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude
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

  const handlePlaceSelect = useCallback(async (place: google.maps.places.PlaceResult) => {
    if (place.place_id && place.name) {
      const details: GooglePlaceDetails = {
        googlePlaceId: place.place_id,
        name: place.name,
        address: place.formatted_address || '',
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }),
        location: place.geometry?.location ? {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        } : undefined,
      };

      setSelectedPlace(details);
      setError('');

      try {
        const res = await apiClient.get(`/businesses?googlePlaceId=${place.place_id}&search=${encodeURIComponent(place.name)}`);
        const matchingBiz = res.data?.data?.businesses?.[0];
        if (matchingBiz) {
          setSelectedPlace(prev => prev ? ({ ...prev, id: matchingBiz.id, walletAddress: matchingBiz.walletAddress }) : null);
          setOnPabandi(true);
        } else {
          setOnPabandi(false);
        }
      } catch (err) {
        setOnPabandi(false);
      }
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

    if (!selectedPlace) { setError('Please select a business from the map suggestions.'); return; }
    if (!onPabandi) { setError('This business is not yet on Pabandi. We are working on adding it soon!'); return; }
    if (!form.date) { setError('Please select a date.'); return; }
    if (!form.time) { setError('Please select a time slot.'); return; }

    setLoading(true);
    let transactionHash: string | undefined = undefined;

    try {
      if (form.paymentMethod === 'bsc') {
        const result = await executeBscDeposit("0.05", selectedPlace.walletAddress || "0x1234567890123456789012345678901234567890");
        if (!result.success) {
          setError(`BSC Deposit Failed: ${result.error}`);
          setLoading(false);
          return;
        }
        transactionHash = result.transactionHash;
      } else if (form.paymentMethod === 'solana') {
        const result = await executeSolanaDeposit(0.1, selectedPlace.walletAddress || "PABANDi111111111111111111111111111111111111");
        if (!result.success) {
          setError(`Solana Deposit Failed: ${result.error}`);
          setLoading(false);
          return;
        }
        transactionHash = result.transactionHash;
      }

      const response = await apiClient.post('/reservations', {
        businessId: selectedPlace.id,
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
        window.location.href = checkoutUrl;
      } else {
        setSuccess(true);
      }
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
            {' at '}{form.time} · {form.guests} {Number(form.guests) === 1 ? 'guest' : 'guests'}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setSuccess(false); setForm({ date: '', time: '', guests: '2', notes: '', paymentMethod: 'safepay' }); setSelectedPlace(null); }}
              className="px-5 py-2.5 rounded-md text-sm font-medium transition-all bg-surface-container hover:bg-surface-container-high text-on-surface">
              Add Another
            </button>
            <Link to="/reservations" className="bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-medium px-5 py-2.5 rounded-md shadow-sm hover:opacity-90">
              View Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''} region="PK" language="en">
      <div className="bg-surface min-h-screen text-on-surface pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

          <Link to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-colors text-on-surface-variant hover:text-primary">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Dashboard
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">New Booking</h1>
            <p className="mt-1.5 text-sm text-on-surface-variant font-body">
              Discover places via Google Maps and book instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column - Form */}
            <div className="space-y-6">
              <div className="rounded-xl p-6 sm:p-8 bg-surface-container-lowest shadow-sm border border-outline-variant/20">

                {error && (
                  <div className="mb-5 px-4 py-3 rounded-lg text-sm font-medium flex items-start gap-3 bg-error-container text-on-error-container">
                    <ShieldCheckIcon className="h-5 w-5 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  <div>
                    <FieldLabel>Search Business</FieldLabel>
                    <PlaceAutocomplete onPlaceSelect={handlePlaceSelect} />
                  </div>

                  {/* Date + Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Date</FieldLabel>
                      <div className="relative">
                        <InputIcon icon={<CalendarIcon className="h-4 w-4" />} />
                        <input
                          name="date" type="date" required
                          min={today}
                          value={form.date} onChange={handleChange}
                          className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 pl-10 outline-none font-body text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Time</FieldLabel>
                      <div className="relative">
                        <InputIcon icon={<ClockIcon className="h-4 w-4" />} />
                        <select
                          name="time" required
                          value={form.time} onChange={handleChange}
                          className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 pl-10 outline-none font-body text-sm appearance-none">
                          <option value="" disabled>Time</option>
                          {TIME_SLOTS.map(t => (
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
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, guests: String(Math.max(1, parseInt(f.guests) - 1)) }))}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold border border-outline-variant/30 hover:bg-surface-container text-primary">
                        −
                      </button>
                      <div className="relative flex-1">
                        <InputIcon icon={<UserGroupIcon className="h-4 w-4" />} />
                        <input
                          name="guests" type="number" min="1" max="50"
                          value={form.guests} onChange={handleChange}
                          className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 pl-10 outline-none font-body text-sm text-center"
                        />
                      </div>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, guests: String(Math.min(50, parseInt(f.guests) + 1)) }))}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold border border-outline-variant/30 hover:bg-surface-container text-primary">
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
                        { id: 'solana', label: 'Solana', icon: <span className="text-sm">◎</span> }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handlePaymentMethodChange(m.id as PaymentMethod)}
                          className={`flex flex-col items-center justify-center py-3 rounded-lg border transition-all ${
                            form.paymentMethod === m.id
                              ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                              : 'border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low'
                          }`}>
                          <div className={`mb-1 ${form.paymentMethod === m.id ? 'text-primary' : 'text-on-surface-variant'}`}>{m.icon}</div>
                          <span className="text-[11px] font-semibold" style={{ color: form.paymentMethod === m.id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={loading || !onPabandi}
                    className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-body text-sm font-medium py-3 rounded-md shadow-sm flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity mt-4">
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (onPabandi ? 'Confirm Reservation' : (selectedPlace ? 'Business not on Pabandi' : 'Select a Business'))}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column - Map & Details */}
            <div className="space-y-6">
              <div className="rounded-xl overflow-hidden shadow-sm border border-outline-variant/20 flex flex-col h-full bg-surface-container-lowest">
                
                <div className="h-64 bg-surface-container-low relative">
                  <iframe
                    src="https://storage.googleapis.com/maps-solutions-0ken1ouk5c/neighborhood-discovery/sms4/neighborhood-discovery.html"
                    width="100%" height="100%"
                    style={{ border: 0 }}
                    loading="lazy">
                  </iframe>
                </div>

                {selectedPlace ? (
                  <div className="p-6 flex-1 flex flex-col">
                    {selectedPlace.photoUrl && (
                      <img src={selectedPlace.photoUrl} alt="Business" className="w-full h-32 object-cover rounded-lg mb-4" />
                    )}
                    <h3 className="text-xl font-headline font-bold mb-1 text-primary">{selectedPlace.name}</h3>
                    <div className="flex items-center gap-1.5 mb-3">
                      <StarIcon className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-bold text-on-surface">{selectedPlace.rating || 'N/A'}</span>
                      <span className="text-xs text-on-surface-variant">({selectedPlace.userRatingsTotal || 0} reviews)</span>
                    </div>
                    <div className="flex items-start gap-2 mb-6">
                      <MapPinIcon className="h-4 w-4 text-on-surface-variant shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed text-on-surface-variant">{selectedPlace.address}</p>
                    </div>

                    <div className="mt-auto">
                      {onPabandi ? (
                        <div className="rounded-lg p-3 flex items-center gap-3 bg-tertiary-fixed/20 border border-tertiary-fixed-dim/30">
                          <ShieldCheckIcon className="h-5 w-5 text-tertiary" />
                          <span className="text-xs font-bold text-tertiary">Pabandi Certified Partner</span>
                        </div>
                      ) : (
                        <div className="rounded-lg p-3 flex items-center gap-3 bg-error-container/50 border border-error/20">
                          <div className="text-sm">⚠️</div>
                          <span className="text-xs font-medium text-error">This business is not on our platform yet.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center flex-1 flex flex-col justify-center">
                    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4 text-primary/40">
                      <MagnifyingGlassIcon className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-medium text-on-surface-variant">
                      Search and select a business to see details and check availability.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>

          <p className="text-center text-xs mt-10 text-on-surface-variant">
            By booking via Pabandi, you earn crypto rewards and build your global reputation score.
          </p>
        </div>
      </div>
    </APIProvider>
  );
}
