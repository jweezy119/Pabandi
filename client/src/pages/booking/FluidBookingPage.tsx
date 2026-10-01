import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Calendar, Clock, Users, ChevronLeft, ChevronRight, Check,
  Shield, AlertTriangle, CreditCard, Zap, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

interface Slot {
  startTime: string;
  endTime: string;
  available: boolean;
  remainingCapacity: number;
}

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  imageUrl: string;
  discountPrice: number | null;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  coverImageUrl: string;
  trustScore: number;
  isVerified: boolean;
  serviceAddress: string;
}

export default function FluidBookingPage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [guests, setGuests] = useState(1);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
    email: user?.email || '',
    phone: user?.phone || '',
    requests: '',
  });

  useEffect(() => {
    if (businessSlug) loadBusiness();
  }, [businessSlug]);

  useEffect(() => {
    if (business && selectedDate) loadSlots();
  }, [business, selectedDate, selectedService]);

  const loadBusiness = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/booking-availability/${businessSlug}`);
      if (res.ok) {
        const data = await res.json();
        setBusiness(data.data.business);
        setServices(data.data.services || []);
        if (data.data.services?.length === 1) {
          setSelectedService(data.data.services[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load business:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    if (!business || !selectedDate) return;
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedService) params.set('serviceId', selectedService.id);
      const res = await fetch(`${API_BASE}/api/v1/fluid-booking/availability/${business.id}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.data.slots || []);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    }
  };

  const handleBook = async () => {
    if (!business || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/fluid-booking/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken() || ''}`,
        },
        body: JSON.stringify({
          businessId: business.id,
          serviceId: selectedService?.id,
          date: selectedDate,
          time: selectedTime,
          guests,
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone,
          specialRequests: customerInfo.requests,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBooking(data.data);
        setStep(4);
        toast.success('Booking confirmed!');
      } else {
        toast.error(data.error || 'Booking failed');
      }
    } catch (err) {
      toast.error('Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getDates = () => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        value: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return dates;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--clay)]/20 border-t-[var(--clay)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-bold text-[var(--warm-ink)]">Business not found</h1>
        <Link to="/" className="mt-4 text-[var(--clay)] hover:underline">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="sticky top-0 z-20 bg-[var(--cream)]/80 backdrop-blur-md border-b border-[rgba(191,179,163,0.1)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="flex items-center gap-2">
            {business.isVerified && (
              <span className="flex items-center gap-1 text-xs font-medium text-[var(--sage)]">
                <Shield size={12} /> Verified
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-[var(--clay)] text-white' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'
              }`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 4 && <div className={`w-8 h-0.5 ${step > s ? 'bg-[var(--clay)]' : 'bg-[var(--warm-sand)]'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">{business.name}</h1>
              <p className="text-sm text-[var(--soft-stone)] mt-1">{business.serviceAddress}</p>
            </div>

            {services.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-3">Select a Service</h2>
                <div className="space-y-3">
                  {services.map(service => (
                    <button
                      key={service.id}
                      onClick={() => { setSelectedService(service); setStep(2); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                        selectedService?.id === service.id ? 'border-[var(--clay)] bg-[var(--clay)]/5' : 'border-[rgba(191,179,163,0.2)] hover:border-[var(--clay)]/30'
                      }`}
                    >
                      {service.imageUrl && (
                        <img src={service.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-[var(--warm-ink)]">{service.name}</h3>
                        <p className="text-sm text-[var(--soft-stone)]">{service.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--soft-stone)]">
                          <span className="font-semibold text-[var(--clay)]">
                            ${service.discountPrice || service.price}
                            {service.discountPrice && <span className="line-through ml-1">${service.price}</span>}
                          </span>
                          <span>{service.duration} min</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-[var(--soft-stone)]" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-[var(--clay)] text-white font-semibold hover:bg-[var(--terracotta)] transition-colors"
            >
              {services.length > 0 ? 'Continue' : 'Book Now'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Select Date & Time</h2>

            <div>
              <label className="text-sm font-medium text-[var(--warm-ink)] flex items-center gap-2 mb-2">
                <Calendar size={14} /> Date
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {getDates().map(d => (
                  <button
                    key={d.value}
                    onClick={() => { setSelectedDate(d.value); setSelectedTime(''); }}
                    className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 min-w-[70px] transition-all ${
                      selectedDate === d.value ? 'border-[var(--clay)] bg-[var(--clay)]/5' : 'border-[rgba(191,179,163,0.2)]'
                    }`}
                  >
                    <span className="text-xs text-[var(--soft-stone)]">{d.day}</span>
                    <span className="text-lg font-bold text-[var(--warm-ink)]">{d.date}</span>
                    <span className="text-xs text-[var(--soft-stone)]">{d.month}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] flex items-center gap-2 mb-2">
                  <Clock size={14} /> Time
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map(slot => (
                    <button
                      key={slot.startTime}
                      disabled={!slot.available}
                      onClick={() => setSelectedTime(slot.startTime)}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                        !slot.available ? 'border-[rgba(191,179,163,0.1)] bg-[var(--warm-sand)]/20 text-[var(--soft-stone)] line-through' :
                        selectedTime === slot.startTime ? 'border-[var(--clay)] bg-[var(--clay)]/10 text-[var(--clay)]' :
                        'border-[rgba(191,179,163,0.2)] text-[var(--warm-ink)] hover:border-[var(--clay)]/30'
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-[var(--warm-ink)] flex items-center gap-2 mb-2">
                <Users size={14} /> Guests
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => setGuests(Math.max(1, guests - 1))} className="w-10 h-10 rounded-xl border border-[rgba(191,179,163,0.3)] flex items-center justify-center text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">−</button>
                <span className="text-lg font-bold text-[var(--warm-ink)] w-8 text-center">{guests}</span>
                <button onClick={() => setGuests(Math.min(20, guests + 1))} className="w-10 h-10 rounded-xl border border-[rgba(191,179,163,0.3)] flex items-center justify-center text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">+</button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] font-medium">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedDate || !selectedTime}
                className="flex-1 py-3 rounded-xl bg-[var(--clay)] text-white font-semibold disabled:opacity-40 hover:bg-[var(--terracotta)] transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline">Your Details</h2>

            <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)] space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--soft-stone)]">
                <Calendar size={14} />
                {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--soft-stone)]">
                <Clock size={14} />
                {selectedTime} - {slots.find(s => s.startTime === selectedTime)?.endTime}
              </div>
              {selectedService && (
                <div className="flex items-center gap-2 text-sm text-[var(--soft-stone)]">
                  <Zap size={14} />
                  {selectedService.name} • ${selectedService.discountPrice || selectedService.price}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] block mb-1">Full Name</label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] block mb-1">Email</label>
                <input
                  type="email"
                  value={customerInfo.email}
                  onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] block mb-1">Phone</label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] block mb-1">Special Requests</label>
                <textarea
                  value={customerInfo.requests}
                  onChange={e => setCustomerInfo({ ...customerInfo, requests: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)] font-medium">
                Back
              </button>
              <button
                onClick={handleBook}
                disabled={submitting || !customerInfo.name || !customerInfo.email}
                className="flex-1 py-3 rounded-xl bg-[var(--clay)] text-white font-semibold disabled:opacity-40 hover:bg-[var(--terracotta)] transition-colors"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && booking && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--sage)]/20 flex items-center justify-center mx-auto">
              <Check size={32} className="text-[var(--sage)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">Booking Confirmed!</h2>
            <p className="text-[var(--soft-stone)]">We've sent a confirmation to {customerInfo.email}</p>

            <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)] text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--soft-stone)]">Business</span>
                <span className="font-medium text-[var(--warm-ink)]">{business.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--soft-stone)]">Date</span>
                <span className="font-medium text-[var(--warm-ink)]">{new Date(selectedDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--soft-stone)]">Time</span>
                <span className="font-medium text-[var(--warm-ink)]">{selectedTime}</span>
              </div>
              {booking.service && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--soft-stone)]">Service</span>
                  <span className="font-medium text-[var(--warm-ink)]">{booking.service.name}</span>
                </div>
              )}
              {booking.payment && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--soft-stone)]">Deposit</span>
                  <span className="font-medium text-[var(--clay)]">${booking.payment.amount}</span>
                </div>
              )}
            </div>

            {booking.trust && (
              <div className="p-4 rounded-2xl bg-[var(--sage)]/5 border border-[var(--sage)]/15">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-[var(--sage)]" />
                  <span className="text-sm font-semibold text-[var(--warm-ink)]">Trust Score: {booking.trust.tier}</span>
                </div>
                <p className="text-xs text-[var(--soft-stone)]">
                  {booking.trust.score >= 80 ? 'Your trusted status waives the deposit!' : `No-show risk: ${Math.round(booking.trust.noShowProbability * 100)}%`}
                </p>
              </div>
            )}

            <Link to="/" className="inline-block px-6 py-3 rounded-xl bg-[var(--clay)] text-white font-semibold hover:bg-[var(--terracotta)] transition-colors">
              Back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
