import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface Service {
  id: string;
  name: string;
  price: number;
  durationHours: number;
  description: string;
}

interface Availability {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  bufferMinutes: number;
}

interface Business {
  id: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CustomerBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [bookingReference, setBookingReference] = useState('');

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/business/${slug}/public`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setBusiness(data.data);
          setServices(data.data.services || []);
          setAvailability(data.data.availability || []);
        } else {
          setError('Business not found');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load business');
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!selectedDate || availability.length === 0) {
      setAvailableSlots([]);
      return;
    }
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);

    if (dayAvailability.length === 0) {
      setAvailableSlots([]);
      return;
    }

    const slots: string[] = [];
    dayAvailability.forEach(a => {
      const [startH, startM] = a.startTime.split(':').map(Number);
      const [endH, endM] = a.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let t = startMinutes; t < endMinutes; t += a.slotMinutes + a.bufferMinutes) {
        const h = Math.floor(t / 60);
        const m = t % 60;
        if (h * 60 + m + a.slotMinutes <= endMinutes) {
          slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
      }
    });

    setAvailableSlots(slots);
  }, [selectedDate, availability]);

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !customer.name || !customer.phone) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/bookings/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlug: slug,
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          depositAmount: selectedService.price * 0.2,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBookingReference(data.data.bookingReference);
        setStep(5);
      }
    } catch {
      setError('Failed to create booking');
    }
    setSubmitting(false);
  };

  const getNext7Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        date: d.toISOString().split('T')[0],
        day: DAYS[d.getDay()],
        num: d.getDate(),
      });
    }
    return days;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #818cf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Business not found</h2>
          <p style={{ color: '#94a3b8' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 24, textAlign: 'center' }}>
          {business.logoUrl && <img src={business.logoUrl} alt={business.name} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', marginBottom: 12 }} />}
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{business.name}</h1>
          {business.city && <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 14 }}>{business.city}</p>}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
        {/* Step 1: Service Selection */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Select a Service</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {services.map(service => (
                <button
                  key={service.id}
                  onClick={() => { setSelectedService(service); setStep(2); }}
                  style={{
                    padding: 20, borderRadius: 16, background: '#0f172a',
                    border: `1px solid ${selectedService?.id === service.id ? '#818cf8' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', textAlign: 'left', color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{service.name}</h3>
                      {service.description && <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>{service.description}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#818cf8' }}>${service.price}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{service.durationHours}h</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Date Selection */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Choose a Date</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 24 }}>
              {getNext7Days().map(d => {
                const dateObj = new Date(d.date);
                const dayOfWeek = dateObj.getDay();
                const isAvailable = availability.some(a => a.dayOfWeek === dayOfWeek);
                return (
                  <button
                    key={d.date}
                    onClick={() => { if (isAvailable) { setSelectedDate(d.date); setStep(3); } }}
                    disabled={!isAvailable}
                    style={{
                      padding: '12px 4px', borderRadius: 12, fontSize: 13,
                      background: selectedDate === d.date ? '#818cf8' : isAvailable ? '#1e293b' : 'transparent',
                      color: selectedDate === d.date ? '#fff' : isAvailable ? '#e2e8f0' : '#475569',
                      border: 'none', cursor: isAvailable ? 'pointer' : 'default', textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 11, marginBottom: 2 }}>{d.day}</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{d.num}</div>
                  </button>
                );
              })}
            </div>
            {availability.length > 0 && (
              <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center' }}>
                We're available on: {[...new Set(availability.map(a => DAYS[a.dayOfWeek]))].join(', ')}
              </p>
            )}
            <button onClick={() => setStep(1)} style={{ marginTop: 16, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>
              ← Back to services
            </button>
          </div>
        )}

        {/* Step 3: Time Slot */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Pick a Time</h2>
            {availableSlots.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No slots available for this date. Please go back and choose another.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
                {availableSlots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => { setSelectedTime(slot); setStep(4); }}
                    style={{
                      padding: '12px 8px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      background: selectedTime === slot ? '#818cf8' : '#1e293b',
                      color: selectedTime === slot ? '#fff' : '#e2e8f0',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>
              ← Back to dates
            </button>
          </div>
        )}

        {/* Step 4: Customer Details */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Your Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <Input label="Full Name *" value={customer.name} onChange={v => setCustomer({ ...customer, name: v })} placeholder="John Doe" />
              <Input label="Email" value={customer.email} onChange={v => setCustomer({ ...customer, email: v })} placeholder="you@email.com" type="email" />
              <Input label="Phone *" value={customer.phone} onChange={v => setCustomer({ ...customer, phone: v })} placeholder="+1 555 123 4567" type="tel" />
              <Input label="Address" value={customer.address} onChange={v => setCustomer({ ...customer, address: v })} placeholder="123 Main St" />
            </div>

            {/* Summary */}
            <div style={{ background: '#0f172a', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>Booking Summary</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{selectedService?.name}</span>
                <span style={{ color: '#818cf8', fontWeight: 700 }}>${selectedService?.price}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Date</span>
                <span style={{ fontSize: 13 }}>{selectedDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Time</span>
                <span style={{ fontSize: 13 }}>{selectedTime}</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#fbbf24' }}>Deposit (20%)</span>
                <span style={{ fontSize: 13, color: '#fbbf24' }}>${((selectedService?.price || 0) * 0.2).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(3)} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', cursor: 'pointer', fontSize: 15 }}>
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!customer.name || !customer.phone || submitting}
                style={{
                  flex: 2, padding: 14, borderRadius: 12, fontWeight: 700, fontSize: 15,
                  background: customer.name && customer.phone ? '#818cf8' : '#334155',
                  color: '#fff', border: 'none', cursor: customer.name && customer.phone ? 'pointer' : 'default',
                }}
              >
                {submitting ? 'Processing...' : 'Pay Deposit & Book'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Booking Confirmed!</h2>
            <p style={{ color: '#94a3b8', marginBottom: 24 }}>We've sent a confirmation to your phone</p>
            <div style={{ background: '#0f172a', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 24, display: 'inline-block' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Booking Reference</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#818cf8', letterSpacing: 2 }}>{bookingReference}</div>
            </div>
            <div>
              <p style={{ color: '#64748b', fontSize: 13 }}>
                {business.name} will see your booking. See you on {selectedDate} at {selectedTime}!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#94a3b8' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12,
          background: '#1e293b', color: '#e2e8f0',
          border: '1px solid rgba(255,255,255,0.1)', fontSize: 15, outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
