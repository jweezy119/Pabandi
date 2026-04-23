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
  Map,
  AdvancedMarker,
  Pin,
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
    <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
      style={{ color: '#5a7490' }}>
      {children}
    </label>
  );
}

function InputIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
      style={{ color: '#3d5068' }}>
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

// Custom Autocomplete Component using vis.gl patterns
const PlaceAutocomplete = ({ onPlaceSelect }: { onPlaceSelect: (place: google.maps.places.PlaceResult) => void }) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ['place_id', 'geometry', 'name', 'formatted_address', 'rating', 'user_ratings_total', 'photos'],
      // Bias results heavily toward Pakistan
      componentRestrictions: { country: 'pk' },
      bounds: new google.maps.LatLngBounds(
        new google.maps.LatLng(23.5, 60.8),  // SW corner of Pakistan
        new google.maps.LatLng(37.1, 77.8)   // NE corner of Pakistan
      ),
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
        className="input-field pl-10 w-full"
      />
    </div>
  );
};

export default function NewReservationPage() {
  const { user } = useAuthStore();

  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceDetails | null>(null);
  const [onPabandi, setOnPabandi] = useState(false);

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
        const res = await apiClient.get(`/businesses?googlePlaceId=${place.place_id}`);
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
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}
        className="flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(52,211,153,0.3)' }}>
            <CheckCircleIcon className="h-10 w-10" style={{ color: '#34d399' }} />
          </div>
          <h2 className="text-2xl font-black mb-3" style={{ color: '#e8edf3' }}>Reservation Submitted!</h2>
          <p className="text-sm mb-2" style={{ color: '#7a90a8' }}>
            <span style={{ color: '#e8edf3', fontWeight: 600 }}>{selectedPlace?.name}</span>
          </p>
          <p className="text-sm mb-2" style={{ color: '#7a90a8' }}>
            {new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' at '}{form.time} · {form.guests} {Number(form.guests) === 1 ? 'guest' : 'guests'}
          </p>
          <div className="flex gap-3 justify-center mt-8">
            <button onClick={() => { setSuccess(false); setForm({ date: '', time: '', guests: '2', notes: '', paymentMethod: 'safepay' }); setSelectedPlace(null); }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#a0b4c8', border: '1px solid rgba(255,255,255,0.08)' }}>
              Add Another
            </button>
            <Link to="/reservations" className="btn-primary text-sm px-5 py-2.5">
              View Reservations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''} region="PK" language="en">
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

          <Link to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-colors"
            style={{ color: '#5a7490' }}>
            <ArrowLeftIcon className="h-4 w-4" /> Back to Dashboard
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-black" style={{ color: '#e8edf3' }}>New Reservation</h1>
            <p className="mt-1.5 text-sm" style={{ color: '#7a90a8' }}>
              Discover places via Google Maps and book instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column - Form */}
            <div className="space-y-6">
              <div className="rounded-2xl p-6 sm:p-8"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>

                {error && (
                  <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                    <ShieldCheckIcon className="h-5 w-5 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  <div>
                    <FieldLabel>Search Business (via Google Maps)</FieldLabel>
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
                          className="input-field pl-10 w-full text-sm"
                          style={{ colorScheme: 'dark' }}
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
                          className="input-field pl-10 w-full appearance-none text-sm">
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
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold border border-white/10 hover:bg-white/5"
                        style={{ color: '#e8edf3' }}>
                        −
                      </button>
                      <div className="relative flex-1">
                        <InputIcon icon={<UserGroupIcon className="h-4 w-4" />} />
                        <input
                          name="guests" type="number" min="1" max="50"
                          value={form.guests} onChange={handleChange}
                          className="input-field pl-10 text-center w-full"
                        />
                      </div>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, guests: String(Math.min(50, parseInt(f.guests) + 1)) }))}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold border border-white/10 hover:bg-white/5"
                        style={{ color: '#e8edf3' }}>
                        +
                      </button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <FieldLabel>Payment Method</FieldLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'safepay', label: 'Safepay', icon: <CreditCardIcon className="h-4 w-4" /> },
                        { id: 'bsc', label: 'BSC', icon: <CurrencyDollarIcon className="h-4 w-4" /> },
                        { id: 'solana', label: 'Solana', icon: <span className="text-xs">👻</span> }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handlePaymentMethodChange(m.id as PaymentMethod)}
                          className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
                            form.paymentMethod === m.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}>
                          <div className={`mb-1 ${form.paymentMethod === m.id ? 'text-blue-400' : 'text-gray-400'}`}>{m.icon}</div>
                          <span className="text-[10px] font-bold" style={{ color: form.paymentMethod === m.id ? '#e8edf3' : '#a0b4c8' }}>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={loading || !onPabandi}
                    className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
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
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/5 flex flex-col h-full"
                style={{ background: 'var(--color-surface-raised)' }}>
                
                <div className="h-64 bg-gray-900 relative">
                  <Map
                    mapId={'bf51a910020fa25a'}
                    defaultCenter={{ lat: 24.8607, lng: 67.0011 }}
                    defaultZoom={selectedPlace?.location ? 15 : 12}
                    center={selectedPlace?.location ?? { lat: 24.8607, lng: 67.0011 }}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                  >
                    {selectedPlace?.location && (
                      <AdvancedMarker position={selectedPlace.location}>
                        <Pin background={'#2563eb'} borderColor={'#1e40af'} glyphColor={'#fff'} />
                      </AdvancedMarker>
                    )}
                  </Map>
                </div>

                {selectedPlace ? (
                  <div className="p-6 flex-1 flex flex-col">
                    {selectedPlace.photoUrl && (
                      <img src={selectedPlace.photoUrl} alt="Business" className="w-full h-32 object-cover rounded-xl mb-4" />
                    )}
                    <h3 className="text-xl font-bold mb-1" style={{ color: '#e8edf3' }}>{selectedPlace.name}</h3>
                    <div className="flex items-center gap-1.5 mb-3">
                      <StarIcon className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-bold" style={{ color: '#e8edf3' }}>{selectedPlace.rating || 'N/A'}</span>
                      <span className="text-xs text-gray-500">({selectedPlace.userRatingsTotal || 0} reviews)</span>
                    </div>
                    <div className="flex items-start gap-2 mb-6">
                      <MapPinIcon className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed text-gray-400">{selectedPlace.address}</p>
                    </div>

                    <div className="mt-auto">
                      {onPabandi ? (
                        <div className="rounded-xl p-3 flex items-center gap-3"
                          style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                          <ShieldCheckIcon className="h-5 w-5 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-400">Pabandi Certified Partner</span>
                        </div>
                      ) : (
                        <div className="rounded-xl p-3 flex items-center gap-3"
                          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                          <div className="text-sm">⚠️</div>
                          <span className="text-xs font-medium text-amber-400">This business is not on our platform yet.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center flex-1 flex flex-col justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <MagnifyingGlassIcon className="h-8 w-8 text-gray-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">
                      Search and select a business to see details and check availability.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>

          <p className="text-center text-xs mt-10" style={{ color: '#3d5068' }}>
            By booking via Pabandi, you earn crypto rewards and build your global reputation score.
          </p>
        </div>
      </div>
    </APIProvider>
  );
}
