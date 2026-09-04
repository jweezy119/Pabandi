import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { businessService, reservationService, walletService, propertyManagerService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Surface, Button, Badge, tokens } from '../design-system';
import { format, addDays, isSameDay } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────
interface Business {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  rating?: number;
  coverImageUrl?: string;
  logoUrl?: string;
  phone?: string;
  isClaimed?: boolean;
  trustScore?: number;
  cuisine?: string;
  priceLevel?: number;
  latitude?: number;
  longitude?: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

// ── Main Booking Page ──────────────────────────────────────────────────────
export default function BookingExperience() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated } = useAuthStore();
  const [step, setStep] = useState<'search' | 'detail' | 'confirm'>(id ? 'detail' : 'search');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);

  // Booking form state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [guests, setGuests] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'safepay' | 'solana' | 'bsc'>('safepay');
  const [bookingComplete, setBookingComplete] = useState(false);

  // Fetch business details
  const { data: businessData } = useQuery(
    ['business', id],
    () => businessService.getBusiness(id!),
    { enabled: !!id, onSuccess: (data) => setSelectedBusiness(data.data?.business) }
  );

  // Fetch wallet balance
  useQuery('wallet-balances', () => walletService.getBalances(), { enabled: isAuthenticated });

  // Search businesses
  const searchBusinesses = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await propertyManagerService.searchHotels({ query: searchQuery });
      setSearchResults(res.data?.data?.hotels || res.data?.data?.businesses || []);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Generate time slots
  const timeSlots: TimeSlot[] = [
    { time: '11:00', available: true },
    { time: '11:30', available: true },
    { time: '12:00', available: true },
    { time: '12:30', available: false },
    { time: '13:00', available: true },
    { time: '13:30', available: true },
    { time: '18:00', available: true },
    { time: '18:30', available: true },
    { time: '19:00', available: true },
    { time: '19:30', available: false },
    { time: '20:00', available: true },
    { time: '20:30', available: true },
    { time: '21:00', available: true },
  ];

  // Booking mutation
  const bookingMutation = useMutation(
    (data: any) => reservationService.createReservation(data),
    {
      onSuccess: () => {
        setBookingComplete(true);
      },
      onError: (err: any) => {
        alert(err?.response?.data?.message || 'Booking failed');
      },
    }
  );

  const handleBookTable = () => {
    if (!selectedBusiness || !selectedTime) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    bookingMutation.mutate({
      businessId: selectedBusiness.id,
      reservationDate: format(selectedDate, 'yyyy-MM-dd'),
      reservationTime: selectedTime,
      numberOfGuests: guests,
      specialRequests,
      paymentMethod,
    });
  };

  const business = selectedBusiness || businessData?.data?.business;

  // ── Search View ──────────────────────────────────────────────────────────
  if (step === 'search') {
    return (
      <div className="min-h-screen" style={{ background: tokens.color.background }}>
        {/* Hero Search */}
        <div className="relative px-4 py-16 text-center" style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #020617 100%)' }}>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Find your table</h1>
          <p className="text-slate-400 mb-8">Discover and book the best restaurants, bars, and venues</p>
          
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchBusinesses()}
                placeholder="Search restaurants, cuisine, or location..."
                className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 outline-none focus:border-indigo-400"
              />
              <Button onClick={searchBusinesses} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((biz) => (
                <Surface
                  key={biz.id}
                  className="overflow-hidden cursor-pointer hover:border-indigo-400/50 transition-all"
                  onClick={() => {
                    setSelectedBusiness(biz);
                    setStep('detail');
                  }}
                >
                  <div className="h-48 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                    {biz.coverImageUrl ? (
                      <img src={biz.coverImageUrl} alt={biz.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🍽️</span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-white">{biz.name}</h3>
                      {biz.rating && (
                        <Badge tone="success">⭐ {biz.rating}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{biz.address}</p>
                    {biz.cuisine && (
                      <p className="text-xs text-slate-500 mt-1">{biz.cuisine}</p>
                    )}
                  </div>
                </Surface>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🍽️</div>
              <h2 className="text-xl font-bold text-white mb-2">Start your search</h2>
              <p className="text-slate-400">Find the perfect spot for your next meal</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Booking Complete View ────────────────────────────────────────────────
  if (bookingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: tokens.color.background }}>
        <Surface className="max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Reservation Confirmed!</h2>
          <p className="text-slate-400 mb-6">
            {business?.name} · {format(selectedDate, 'MMM d')} at {selectedTime} · {guests} guests
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/reservations')}>View Bookings</Button>
            <Button variant="ghost" onClick={() => {
              setBookingComplete(false);
              setStep('search');
            }}>Book Another</Button>
          </div>
        </Surface>
      </div>
    );
  }

  // ── Detail + Booking View ────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-surface/80 border-b border-white/5 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => setStep('search')} className="text-slate-400 hover:text-white">
            ← Back
          </button>
          <h1 className="font-bold text-white">Pabandi</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Business Hero */}
        {business && (
          <div className="relative h-64 md:h-80 rounded-xl overflow-hidden mb-6">
            {business.coverImageUrl ? (
              <img src={business.coverImageUrl} alt={business.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
                <span className="text-6xl">🍽️</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <div className="flex items-center gap-2 mb-2">
                {business.rating && <Badge tone="success">⭐ {business.rating}</Badge>}
                {business.trustScore && <Badge tone="info">Trust: {business.trustScore}</Badge>}
              </div>
              <h1 className="text-3xl font-bold text-white">{business.name}</h1>
              <p className="text-slate-300">{business.address}</p>
            </div>
          </div>
        )}

        {/* Booking Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Date/Time/Guests */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Selection */}
            <Surface className="p-6">
              <h3 className="font-bold text-white mb-4">Select Date</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)).map((date) => (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 px-4 py-3 rounded-lg text-center transition-all ${
                      isSameDay(date, selectedDate)
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs">{format(date, 'EEE')}</div>
                    <div className="font-bold">{format(date, 'd')}</div>
                  </button>
                ))}
              </div>
            </Surface>

            {/* Time Selection */}
            <Surface className="p-6">
              <h3 className="font-bold text-white mb-4">Select Time</h3>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => slot.available && setSelectedTime(slot.time)}
                    disabled={!slot.available}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      selectedTime === slot.time
                        ? 'bg-indigo-500 text-white'
                        : slot.available
                        ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                        : 'bg-white/5 text-slate-600 cursor-not-allowed line-through'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </Surface>

            {/* Guests */}
            <Surface className="p-6">
              <h3 className="font-bold text-white mb-4">Number of Guests</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  -
                </button>
                <span className="text-2xl font-bold text-white">{guests}</span>
                <button
                  onClick={() => setGuests(Math.min(10, guests + 1))}
                  className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  +
                </button>
              </div>
            </Surface>

            {/* Special Requests */}
            <Surface className="p-6">
              <h3 className="font-bold text-white mb-4">Special Requests</h3>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Allergies, celebrations, seating preferences..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-400"
              />
            </Surface>
          </div>

          {/* Right: Summary & Payment */}
          <div className="space-y-6">
            {/* Summary */}
            <Surface className="p-6">
              <h3 className="font-bold text-white mb-4">Reservation Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Restaurant</span>
                  <span className="text-white">{business?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date</span>
                  <span className="text-white">{format(selectedDate, 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time</span>
                  <span className="text-white">{selectedTime || 'Select time'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Guests</span>
                  <span className="text-white">{guests}</span>
                </div>
              </div>
            </Surface>

            {/* Payment Method */}
            <Surface className="p-6">
              <h3 className="font-bold text-white mb-4">Payment Method</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setPaymentMethod('safepay')}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    paymentMethod === 'safepay' ? 'bg-indigo-500/20 border border-indigo-400' : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="font-medium text-white">💳 SafePay</div>
                  <div className="text-xs text-slate-400">Pay with card or bank</div>
                </button>
                <button
                  onClick={() => setPaymentMethod('solana')}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    paymentMethod === 'solana' ? 'bg-indigo-500/20 border border-indigo-400' : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="font-medium text-white">◎ Solana</div>
                  <div className="text-xs text-slate-400">Pay with SOL or $PAB</div>
                </button>
              </div>
            </Surface>

            {/* Book Button */}
            <Button
              onClick={handleBookTable}
              disabled={!selectedTime || bookingMutation.isLoading}
              className="w-full py-4 text-lg"
            >
              {bookingMutation.isLoading ? 'Booking...' : 'Confirm Reservation'}
            </Button>

            <p className="text-xs text-slate-500 text-center">
              Free cancellation up to 2 hours before
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
