import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import apiClient from '../services/api';
import {
  CalendarIcon, ClockIcon, UserGroupIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon, ArrowLeftIcon, ShieldCheckIcon,
  CreditCardIcon, CurrencyDollarIcon, StarIcon,
  MapPinIcon
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
  phone?: string;
  isClaimed?: boolean;
  reviews?: any[];
  website?: string;
}

const PlaceAutocomplete = ({ onPlaceSelect }: { onPlaceSelect: (place: google.maps.places.PlaceResult) => void }) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ['place_id', 'geometry', 'name', 'formatted_address', 'rating', 'user_ratings_total', 'photos', 'reviews', 'formatted_phone_number', 'website'],
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

  const location = useLocation();
  const initialPlace = location.state?.googlePlaceId ? {
    googlePlaceId: location.state.googlePlaceId,
    name: location.state.placeName,
    address: 'Loading address...',
  } : null;

  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceDetails | null>(initialPlace);
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

    // If we have an initial place from state, we should fetch its full details
    if (initialPlace && initialPlace.googlePlaceId) {
      // We can't easily fetch full place details without the PlacesService here,
      // but the user will see the name and can proceed, or they can re-select.
      // Ideally we would fetch it from our backend /businesses if it exists.
      apiClient.get(`/businesses?googlePlaceId=${initialPlace.googlePlaceId}&search=${encodeURIComponent(initialPlace.name)}`)
        .then(res => {
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
              photoUrl: matchingBiz.coverImageUrl || matchingBiz.logoUrl
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
        phone: place.formatted_phone_number || undefined,
        reviews: place.reviews || [],
        website: place.website || undefined,
      };

      setSelectedPlace(details);
      setError('');

      try {
        const res = await apiClient.get(`/businesses?googlePlaceId=${place.place_id}&search=${encodeURIComponent(place.name)}`);
        const matchingBiz = res.data?.data?.businesses?.[0];
        if (matchingBiz) {
          setSelectedPlace(prev => prev ? ({ 
            ...prev, 
            id: matchingBiz.id, 
            walletAddress: matchingBiz.walletAddress,
            phone: matchingBiz.phone || prev.phone,
            isClaimed: matchingBiz.isClaimed
          }) : null);
        }
      } catch (err) {
        // Ignore error
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
    if (!form.date) { setError('Please select a date.'); return; }
    if (!form.time) { setError('Please select a time slot.'); return; }

    setLoading(true);
    let transactionHash: string | undefined = undefined;

    try {
      // Handle crypto deposits (BSC / Solana)
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

      // Create reservation on backend
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

      // Handle SafePay redirect
      const checkoutUrl = response?.data?.data?.checkoutUrl;
      if (form.paymentMethod === 'safepay' && checkoutUrl) {
        // Only redirect if it's a real checkout URL (not a mock/fallback)
        if (checkoutUrl.includes('getsafepay.com')) {
          window.location.href = checkoutUrl;
          return;
        }
      }

      // Reservation created successfully
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
            {' at '}{form.time} · {form.guests} {Number(form.guests) === 1 ? 'guest' : 'guests'}
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

          {/* Unified Autocomplete Search Bar */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/20 mb-8">
            <FieldLabel>Search Business to Book</FieldLabel>
            <PlaceAutocomplete onPlaceSelect={handlePlaceSelect} />
            
            {/* Fallback Demo Venues */}
            <div className="mt-4 pt-4 border-t border-outline-variant/20">
              <p className="text-xs text-on-surface-variant font-medium mb-3 uppercase tracking-wider">Or select a demo venue</p>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {[
                  { id: 'demo_1', name: 'Karachi Gymkhana', address: 'Club Road, Karachi', phone: '+92 300 111 2222', rating: 4.8 },
                  { id: 'demo_2', name: 'Cafe Flo', address: 'Clifton Block 4, Karachi', phone: '+92 300 333 4444', rating: 4.9 },
                  { id: 'demo_3', name: 'Toni&Guy', address: 'DHA Phase 6, Karachi', phone: '+92 300 555 6666', rating: 4.7 }
                ].map(venue => (
                  <button 
                    key={venue.id}
                    onClick={() => setSelectedPlace({ 
                      googlePlaceId: venue.id, 
                      name: venue.name, 
                      address: venue.address, 
                      phone: venue.phone, 
                      rating: venue.rating,
                      userRatingsTotal: 124,
                      isClaimed: true,
                      photoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400'
                    })}
                    className="flex-shrink-0 bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 rounded-lg px-4 py-2 text-left transition-colors"
                  >
                    <div className="text-sm font-bold text-primary">{venue.name}</div>
                    <div className="text-xs text-on-surface-variant">{venue.address}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedPlace ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
              
              {/* Left Column - Form & Verification Call */}
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
                            className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 pl-10 outline-none font-body text-sm appearance-none font-medium">
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
                          { id: 'solana', label: 'Solana', icon: <span className="text-sm font-bold">◎</span> }
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

                    {/* Loyalty Bonus Banner */}
                    <div className="bg-gradient-to-r from-secondary-container to-secondary-container/50 border border-secondary/20 p-4 rounded-xl flex items-start gap-3 mt-6 animate-fade-up">
                      <div className="text-2xl mt-0.5">⚡</div>
                      <div>
                        <h4 className="font-headline font-black text-sm text-on-surface">Loyalty Bonus</h4>
                        <p className="font-body text-xs text-on-surface-variant leading-relaxed mt-0.5">
                          Earn <strong className="text-secondary">50 PAB tokens</strong> when you successfully honor this booking. Withdraw to your Solana wallet at any time!
                        </p>
                      </div>
                    </div>

                    <button type="submit" disabled={loading}
                      className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-body text-sm font-medium py-3 rounded-md shadow-sm flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity mt-4">
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : 'Confirm Reservation'}
                    </button>
                  </form>
                </div>

                {/* Call & Verify Box */}
                {selectedPlace.phone && (
                  <div className="rounded-xl p-6 bg-surface-container-lowest shadow-sm border border-outline-variant/20 space-y-3">
                    <h3 className="font-headline text-sm font-bold text-on-surface uppercase tracking-wider">Verify Reservation Directly</h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Call or chat with the business directly to verify availability and confirm booking details.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <a 
                        href={`tel:${selectedPlace.phone}`}
                        className="bg-primary text-on-primary text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 hover:opacity-90 transition-all text-center shadow-sm font-headline"
                      >
                        📞 Call: {selectedPlace.phone}
                      </a>
                      <a 
                        href={`https://wa.me/${selectedPlace.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi! I'd like to check my Pabandi booking details for ${form.date || '(Select date)'} at ${form.time || '(Select time)'}.`)}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-[#25D366] text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#20ba5a] transition-all text-center shadow-sm font-headline"
                      >
                        💬 WhatsApp Chat
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Map & Details */}
              <div className="space-y-6">
                <div className="rounded-xl overflow-hidden shadow-sm border border-outline-variant/20 flex flex-col bg-surface-container-lowest">
                  
                  <div className="h-64 bg-surface-container-low relative">
                    {selectedPlace.googlePlaceId.startsWith('demo_') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-container-low text-on-surface-variant p-4 text-center border-b border-outline-variant/20">
                        <MapPinIcon className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm font-medium uppercase tracking-wider">Demo Venue Selected</p>
                        <p className="text-xs opacity-70 mt-1">Map visualization disabled in demo mode.</p>
                      </div>
                    ) : (
                      <iframe
                        title="Location Map"
                        width="100%" height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&q=place_id:${selectedPlace.googlePlaceId}`}>
                      </iframe>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col space-y-6">
                    <div>
                      {selectedPlace.photoUrl && (
                        <img src={selectedPlace.photoUrl} alt="Business" className="w-full h-36 object-cover rounded-lg mb-4" />
                      )}
                      <h3 className="text-xl font-headline font-bold text-primary mb-1">{selectedPlace.name}</h3>
                      <div className="flex items-center gap-1.5 mb-3">
                        <StarIcon className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-bold text-on-surface">{selectedPlace.rating || 'N/A'}</span>
                        <span className="text-xs text-on-surface-variant">({selectedPlace.userRatingsTotal || 0} reviews)</span>
                      </div>
                      <div className="flex items-start gap-2 mb-3">
                        <MapPinIcon className="h-4 w-4 text-on-surface-variant shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed text-on-surface-variant">{selectedPlace.address}</p>
                      </div>

                      {selectedPlace.website && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">language</span>
                          <a href={selectedPlace.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">
                            {selectedPlace.website}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Google Reviews */}
                    <div className="space-y-4 pt-4 border-t border-outline-variant/20">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Google Reviews</h4>
                      
                      {!selectedPlace.reviews || selectedPlace.reviews.length === 0 ? (
                        <p className="text-xs text-on-surface-variant italic">No reviews loaded for this venue.</p>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                          {selectedPlace.reviews.slice(0, 3).map((r: any, idx: number) => (
                            <div key={idx} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10 text-left space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-on-surface">{r.author_name}</span>
                                <span className="text-[10px] text-on-surface-variant">{r.relative_time_description}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="flex text-yellow-500">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span key={i} className={`material-symbols-outlined text-[14px] ${i < r.rating ? 'fill-current' : ''}`}>star</span>
                                  ))}
                                </span>
                              </div>
                              <p className="text-xs text-on-surface-variant font-body leading-relaxed italic">
                                "{r.text}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty Placeholder State */
            <div className="bg-surface-container-lowest rounded-xl p-12 text-center border border-outline-variant/20 shadow-sm max-w-xl mx-auto mt-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                <BuildingStorefrontIcon className="h-8 w-8" />
              </div>
              <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Search for a Venue to Start</h3>
              <p className="text-sm text-on-surface-variant font-body leading-relaxed">
                Use the search bar above to look up any restaurant, gym, salon, or cafe. Once selected, you'll be able to view its reviews, call to verify availability, and instantly secure a no-show proof reservation.
              </p>
            </div>
          )}

          <p className="text-center text-xs mt-10 text-on-surface-variant">
            By booking via Pabandi, you earn crypto rewards and build your global reputation score.
          </p>
        </div>
      </div>
    </APIProvider>
  );
}
