import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CalendarIcon, ClockIcon, ShieldCheckIcon, StarIcon, MapPinIcon, PhoneIcon, MailIcon, CheckCircleIcon, ExclamationCircleIcon, MapPinIcon as MapPinIcon2 } from '@heroicons/react/24/outline';
import apiClient from '@/services/api';
import { Button, Surface, tokens } from '@/design-system';
import { Input } from '@/components/primitives/Input';
import toast from 'react-hot-toast';

interface Business {
  id: string;
  name: string;
  logoUrl?: string;
  slug: string;
  trustScore: number;
  isVerified: boolean;
}

interface Availability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  bufferMinutes: number;
}

interface Slot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

interface BookingFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  customFields: Record<string, string>;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const PublicBookingPage: React.FC = () => {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<Business | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<'calendar' | 'form' | 'confirm' | 'payment'>('calendar');
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState<BookingFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: '',
    customFields: {},
  });

  useEffect(() => {
    if (businessSlug) loadBusiness();
  }, [businessSlug]);

  const loadBusiness = async () => {
    try {
      const res = await apiClient.get(`/api/v1/booking-availability/${businessSlug}`);
      if (res.data.success) {
        setBusiness(res.data.data.business);
        setAvailability(res.data.data.availability);
        setBlackoutDates(res.data.data.blackoutDates);
        loadSlots();
      }
    } catch (e) {
      toast.error('Business not found');
      navigate('/');
    }
  };

  const loadSlots = async () => {
    if (!business) return;
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const res = await apiClient.get(
        `/api/v1/booking-availability/${business.id}/slots?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
      );
      if (res.data.success) {
        setSlots(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load slots', e);
    }
  };

  const getAvailableSlotsForDate = (date: string) => {
    return slots.filter(s => s.date === date && s.available);
  };

  const getDatesWithAvailability = () => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      if (getAvailableSlotsForDate(dateStr).length > 0 && !blackoutDates.includes(dateStr)) {
        dates.push(dateStr);
      }
    }
    return dates;
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotClick = (slot: Slot) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
    setStep('form');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !business) return;

    setLoading(true);
    try {
      const res = await apiClient.post('/api/v1/bookings/public', {
        businessId: business.id,
        slotStart: `${selectedSlot.date}T${selectedSlot.startTime}:00`,
        slotEnd: `${selectedSlot.date}T${selectedSlot.endTime}:00`,
        serviceType: 'Service',
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        notes: formData.notes,
        customFields: formData.customFields,
        depositAmount: 0,
      });

      if (res.data.success) {
        setBookingId(res.data.data.booking.id);
        setPaymentUrl(res.data.data.paymentUrl);
        if (res.data.data.paymentUrl) {
          setStep('payment');
        } else {
          setStep('confirm');
        }
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = () => {
    if (paymentUrl) {
      window.location.href = paymentUrl;
    }
  };

  if (!business) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const datesWithAvailability = getDatesWithAvailability();

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Hero */}
      <div className="relative h-48 md:h-64 bg-gradient-to-br from-[var(--clay)] via-[var(--terracotta)] to-[var(--muted-ochre)]">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 flex items-end px-4 md:px-8 pb-6 text-white">
          <div className="max-w-4xl mx-auto w-full">
            {business.logoUrl && (
              <img src={business.logoUrl} alt="" className="h-16 w-auto mb-4" />
            )}
            <h1 className="text-3xl md:text-4xl font-bold font-headline mb-2">{business.name}</h1>
            <div className="flex items-center gap-4 text-sm opacity-90">
              {business.isVerified && (
                <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                  <ShieldCheckIcon className="w-4 h-4" /> Verified
                </span>
              )}
              <span className="flex items-center gap-1">
                <StarIcon className="w-4 h-4 fill-yellow-300" />
                {business.trustScore.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 -mt-6 relative z-10">
        {step === 'calendar' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-1">Select a Date</h2>
              <p className="text-[var(--soft-stone)]">Available slots for the next 14 days</p>
            </div>

            <Surface className="p-6 rounded-2xl">
              <div className="grid grid-cols-7 gap-1 mb-4">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-sm font-semibold text-[var(--soft-stone)] py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {datesWithAvailability.map((dateStr, idx) => {
                  const date = new Date(dateStr);
                  const isSelected = selectedDate === dateStr;
                  const isToday = dateStr === new Date().toISOString().split('T')[0];
                  const availableCount = getAvailableSlotsForDate(dateStr).length;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDateClick(dateStr)}
                      className={`col-span-1 aspect-square rounded-xl transition-all ${
                        isSelected
                          ? 'bg-[var(--clay)] text-white shadow-lg'
                          : isToday
                          ? 'bg-[var(--clay)]/10 text-[var(--clay)] border border-[var(--clay)]'
                          : 'bg-white hover:bg-[var(--warm-sand)] text-[var(--warm-ink)]'
                      }`}
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <div className="flex flex-col items-center justify-center h-full p-2">
                        <span className="font-bold text-lg">{date.getDate()}</span>
                        <span className="text-xs opacity-70">{availableCount} slots</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Surface>

            {selectedDate && (
              <Surface className="mt-6 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-4">
                  Available Times for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {getAvailableSlotsForDate(selectedDate).map(slot => (
                    <button
                      key={`${slot.date}-${slot.startTime}`}
                      onClick={() => handleSlotClick(slot)}
                      className="p-4 rounded-xl bg-white border border-[var(--warm-sand)] hover:border-[var(--clay)] hover:bg-[var(--clay)]/5 transition-all text-left"
                    >
                      <div className="flex items-center gap-2 text-[var(--warm-ink)]">
                        <ClockIcon className="w-5 h-5 text-[var(--clay)]" />
                        <span className="font-semibold">{slot.startTime} - {slot.endTime}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {getAvailableSlotsForDate(selectedDate).length === 0 && (
                  <p className="text-center text-[var(--soft-stone)] py-8">No available slots for this date</p>
                )}
              </Surface>
            )}
          </>
        )}

        {step === 'form' && selectedSlot && (
          <Surface className="max-w-xl mx-auto p-6 rounded-2xl animate-in fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[var(--warm-ink)]">Booking Details</h2>
                <p className="text-[var(--soft-stone)]">
                  {new Date(selectedSlot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at {selectedSlot.startTime}
                </p>
              </div>
              <Button variant="ghost" onClick={() => { setStep('calendar'); setSelectedSlot(null); }}>
                <ExclamationCircleIcon className="w-5 h-5" /> Change
              </Button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <Input
                label="Full Name *"
                value={formData.customerName}
                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="John Doe"
                required
              />
              <Input
                label="Email *"
                type="email"
                value={formData.customerEmail}
                onChange={e => setFormData({ ...formData, customerEmail: e.target.value })}
                placeholder="john@email.com"
                required
              />
              <Input
                label="Phone"
                type="tel"
                value={formData.customerPhone}
                onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
              <div>
                <label className="block text-sm font-medium text-[var(--warm-ink)] mb-1">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-[rgba(191,179,163,0.3)] rounded-xl bg-[var(--warm-sand)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
                  placeholder="Any special requests or information..."
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </form>
          </Surface>
        )}

        {step === 'confirm' && bookingId && (
          <Surface className="max-w-xl mx-auto p-8 rounded-2xl text-center animate-in fade-in">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--sage)]/20 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-8 h-8 text-[var(--sage)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-2">Booking Confirmed!</h2>
            <p className="text-[var(--soft-stone)] mb-6">Your booking has been confirmed. A confirmation email has been sent to {formData.customerEmail}.</p>
            <div className="bg-[var(--warm-sand)] rounded-xl p-4 mb-6 text-left">
              <p className="font-semibold text-[var(--warm-ink)]">Booking ID: {bookingId}</p>
              <p className="text-sm text-[var(--soft-stone)] mt-1">
                {new Date(selectedSlot!.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at {selectedSlot!.startTime}
              </p>
            </div>
            <Button variant="primary" onClick={() => navigate('/')}>Back to Home</Button>
          </Surface>
        )}

        {step === 'payment' && bookingId && paymentUrl && (
          <Surface className="max-w-xl mx-auto p-8 rounded-2xl text-center animate-in fade-in">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--clay)]/20 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-2">Complete Payment</h2>
            <p className="text-[var(--soft-stone)] mb-6">A deposit is required to secure your booking. You'll be redirected to complete payment.</p>

            {business && selectedSlot && bookingId && (
              <PaymentMapPreview
                businessName={business.name}
                businessLat={business.serviceLat || 0}
                businessLng={business.serviceLng || 0}
                clientLat={formData.clientLat ? parseFloat(formData.clientLat) : 0}
                clientLng={formData.clientLng ? parseFloat(formData.clientLng) : 0}
                clientAddress={formData.clientAddress}
                distanceMiles={formData.distanceMiles}
                driveMinutes={formData.driveMinutes}
              />
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={handlePaymentComplete}
              disabled={loading}
            >
              {loading ? 'Redirecting...' : 'Pay Deposit'}
            </Button>
            <p className="mt-4 text-sm text-[var(--soft-stone)]">
              Or <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--clay)] underline">open payment in new tab</a>
            </p>
          </Surface>
        )}
      </div>
    </div>
  );
};

function PaymentMapPreview({
  businessName,
  businessLat,
  businessLng,
  clientLat,
  clientLng,
  clientAddress,
  distanceMiles,
  driveMinutes,
}: {
  businessName: string;
  businessLat: number;
  businessLng: number;
  clientLat: number;
  clientLng: number;
  clientAddress: string;
  distanceMiles?: number;
  driveMinutes?: number;
}) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!businessLat || !businessLng || !clientLat || !clientLng) return;
    const fetchMap = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          apiKey: import.meta.env.VITE_GEOAPIFY_KEY || '',
          center: `lonlat:${businessLng},${businessLat}`,
          zoom: '12',
          width: '400',
          height: '250',
          format: 'png',
          marker: `lonlat:${businessLng},${businessLat};color:C97B5B;icon:building|lonlat:${clientLng},${clientLat};color:3B82F6;icon:home`,
        });
        setMapUrl(`https://api.geoapify.com/v1/staticmap?${params}`);
      } catch (e) {
        console.error('Failed to load map', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMap();
  }, [businessLat, businessLng, clientLat, clientLng]);

  return (
    <div className="mb-6 p-4 rounded-xl border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)]">
      <h3 className="font-semibold text-[var(--warm-ink)] mb-3 flex items-center gap-2">
        <MapPinIcon2 className="w-5 h-5 text-[var(--clay)]" />
        Route Overview
      </h3>
      <div className="relative rounded-lg overflow-hidden border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)]">
        {mapUrl ? (
          <img src={mapUrl} alt="Route map" className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 flex flex-col items-center justify-center text-[var(--soft-stone)]">
            <span className="material-symbols-outlined text-[24px] mb-2 opacity-50">map</span>
            {loading ? 'Loading map...' : 'Map preview unavailable'}
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--clay)] border-t-transparent rounded-full" />
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-white/50">
          <p className="text-xs text-[var(--soft-stone)]">Distance</p>
          <p className="font-semibold text-[var(--warm-ink)]">{distanceMiles?.toFixed(1) || '—'} mi</p>
        </div>
        <div className="p-2 rounded-lg bg-white/50">
          <p className="text-xs text-[var(--soft-stone)]">Drive Time</p>
          <p className="font-semibold text-[var(--warm-ink)]">{driveMinutes || '—'} min</p>
        </div>
        <div className="p-2 rounded-lg bg-white/50">
          <p className="text-xs text-[var(--soft-stone)]">Travel Fee</p>
          <p className="font-semibold text-[var(--terracotta)]">${(distanceMiles && distanceMiles > 10 ? (distanceMiles - 10) * 0.5 : 0).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

export default PublicBookingPage;