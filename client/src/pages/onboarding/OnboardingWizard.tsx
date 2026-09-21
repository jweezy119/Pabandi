import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../../design-system';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  duration: number;
  description: string;
}

interface EmployeeItem {
  id: string;
  name: string;
  phone: string;
  payRate: number;
  payType: 'HOURLY' | 'PER_JOB';
}

const DEFAULT_SERVICES: ServiceItem[] = [
  { id: '1', name: 'Standard Clean', price: 80, duration: 2, description: 'Regular cleaning for maintained homes' },
  { id: '2', name: 'Deep Clean', price: 150, duration: 3, description: 'Thorough cleaning including inside appliances' },
  { id: '3', name: 'Move-Out Clean', price: 200, duration: 4, description: 'Complete cleaning for moving out' },
];

const DAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

const STORAGE_KEY = 'pabandi_onboarding';

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({ businessName: '', ownerName: '', email: '', phone: '', city: '', logo: null as string | null });
  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [availability, setAvailability] = useState({ days: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00', slotMinutes: 60, bufferMinutes: 15 });
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [slug, setSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.profile) setProfile(data.profile);
        if (data.services) setServices(data.services);
        if (data.availability) setAvailability(data.availability);
        if (data.employees) setEmployees(data.employees);
        if (data.step) setStep(data.step);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, services, availability, employees, step }));
  }, [profile, services, availability, employees, step]);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, services, availability, employees, step }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfile({ ...profile, logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const updateService = (id: string, field: keyof ServiceItem, value: any) => {
    setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addService = () => {
    setServices([...services, { id: Date.now().toString(), name: '', price: 0, duration: 1, description: '' }]);
  };

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const addEmployee = () => {
    setEmployees([...employees, { id: Date.now().toString(), name: '', phone: '', payRate: 20, payType: 'HOURLY' }]);
  };

  const updateEmployee = (id: string, field: keyof EmployeeItem, value: any) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeEmployee = (id: string) => {
    setEmployees(employees.filter(e => e.id !== id));
  };

  const toggleDay = (day: number) => {
    setAvailability({
      ...availability,
      days: availability.days.includes(day)
        ? availability.days.filter(d => d !== day)
        : [...availability.days, day],
    });
  };

  const nextStep = () => { setStep(step + 1); save(); };
  const prevStep = () => { setStep(step - 1); save(); };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const payload = { profile, services, availability, employees };
      const res = await fetch('/api/v1/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSlug(data.data.slug);
        localStorage.removeItem(STORAGE_KEY);
        setStep(5);
      }
    } catch (err) {
      console.error('Onboarding failed:', err);
    }
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>
      {/* Progress Bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '16px 24px', background: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${tokens.color.border}` }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', margin: '0 auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: s <= step ? tokens.color.primary : tokens.color.surfaceContainer,
                  color: s <= step ? '#fff' : tokens.color.textMuted,
                  border: `2px solid ${s <= step ? tokens.color.primary : tokens.color.border}`,
                }}>
                  {s < step ? '✓' : s}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 4, background: tokens.color.surfaceContainer, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(step / 5) * 100}%`, background: tokens.color.primary, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Business Profile</h1>
            <p style={{ color: tokens.color.textMuted, marginBottom: 24 }}>Tell us about your cleaning business</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="Business Name *" value={profile.businessName} onChange={v => setProfile({ ...profile, businessName: v })} placeholder="Sparkle Clean Co." />
              <Input label="Owner Name *" value={profile.ownerName} onChange={v => setProfile({ ...profile, ownerName: v })} placeholder="John Smith" />
              <Input label="Email" value={profile.email} onChange={v => setProfile({ ...profile, email: v })} placeholder="you@email.com" type="email" />
              <Input label="Phone" value={profile.phone} onChange={v => setProfile({ ...profile, phone: v })} placeholder="+1 555 123 4567" type="tel" />
              <Input label="City / Area Served" value={profile.city} onChange={v => setProfile({ ...profile, city: v })} placeholder="Chicago, IL" />

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: tokens.color.textMuted }}>Logo (optional)</label>
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: 14 }} />
                {profile.logo && <img src={profile.logo} alt="Logo" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
              <Button onClick={nextStep} disabled={!profile.businessName || !profile.ownerName}>Next →</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Services</h1>
            <p style={{ color: tokens.color.textMuted, marginBottom: 24 }}>Add your cleaning services (you can edit defaults)</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {services.map(service => (
                <div key={service.id} style={{ background: tokens.color.surface, borderRadius: tokens.radius.lg, padding: 16, border: `1px solid ${tokens.color.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <strong>Service</strong>
                    <button onClick={() => removeService(service.id)} style={{ color: tokens.color.danger, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                    <Input label="Name" value={service.name} onChange={v => updateService(service.id, 'name', v)} placeholder="Standard Clean" />
                    <Input label="Price ($)" value={service.price.toString()} onChange={v => updateService(service.id, 'price', parseFloat(v) || 0)} placeholder="80" type="number" />
                    <Input label="Duration (hrs)" value={service.duration.toString()} onChange={v => updateService(service.id, 'duration', parseFloat(v) || 1)} placeholder="2" type="number" />
                  </div>
                  <Input label="Description" value={service.description} onChange={v => updateService(service.id, 'description', v)} placeholder="Brief description..." />
                </div>
              ))}
              <button onClick={addService} style={{ padding: 12, background: 'transparent', border: `2px dashed ${tokens.color.border}`, borderRadius: tokens.radius.md, color: tokens.color.textMuted, cursor: 'pointer', fontSize: 14 }}>
                + Add Service
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              <Button variant="ghost" onClick={prevStep}>← Back</Button>
              <Button onClick={nextStep}>Next →</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Availability</h1>
            <p style={{ color: tokens.color.textMuted, marginBottom: 24 }}>Set your working hours</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: tokens.color.textMuted }}>Working Days</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAYS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => toggleDay(d.value)}
                      style={{
                        padding: '8px 16px', borderRadius: tokens.radius.md, fontSize: 13, fontWeight: 600,
                        background: availability.days.includes(d.value) ? tokens.color.primary : tokens.color.surfaceContainer,
                        color: availability.days.includes(d.value) ? '#fff' : tokens.color.textMuted,
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Start Time" value={availability.startTime} onChange={v => setAvailability({ ...availability, startTime: v })} type="time" />
                <Input label="End Time" value={availability.endTime} onChange={v => setAvailability({ ...availability, endTime: v })} type="time" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: tokens.color.textMuted }}>Slot Duration</label>
                  <select
                    value={availability.slotMinutes}
                    onChange={e => setAvailability({ ...availability, slotMinutes: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: tokens.radius.md, background: tokens.color.surfaceContainer, color: tokens.color.text, border: `1px solid ${tokens.color.border}`, fontSize: 14 }}
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: tokens.color.textMuted }}>Buffer Between Jobs</label>
                  <select
                    value={availability.bufferMinutes}
                    onChange={e => setAvailability({ ...availability, bufferMinutes: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: tokens.radius.md, background: tokens.color.surfaceContainer, color: tokens.color.text, border: `1px solid ${tokens.color.border}`, fontSize: 14 }}
                  >
                    <option value={0}>None</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              <Button variant="ghost" onClick={prevStep}>← Back</Button>
              <Button onClick={nextStep}>Next →</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Employees <span style={{ color: tokens.color.textMuted, fontSize: 16 }}>(optional)</span></h1>
            <p style={{ color: tokens.color.textMuted, marginBottom: 24 }}>Add your team members</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {employees.map(emp => (
                <div key={emp.id} style={{ background: tokens.color.surface, borderRadius: tokens.radius.lg, padding: 16, border: `1px solid ${tokens.color.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <strong>Employee</strong>
                    <button onClick={() => removeEmployee(emp.id)} style={{ color: tokens.color.danger, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <Input label="Name" value={emp.name} onChange={v => updateEmployee(emp.id, 'name', v)} placeholder="Jane Doe" />
                    <Input label="Phone" value={emp.phone} onChange={v => updateEmployee(emp.id, 'phone', v)} placeholder="+1 555..." />
                    <Input label="Pay Rate ($)" value={emp.payRate.toString()} onChange={v => updateEmployee(emp.id, 'payRate', parseFloat(v) || 0)} placeholder="20" type="number" />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <select
                      value={emp.payType}
                      onChange={e => updateEmployee(emp.id, 'payType', e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: tokens.radius.md, background: tokens.color.surfaceContainer, color: tokens.color.text, border: `1px solid ${tokens.color.border}`, fontSize: 13 }}
                    >
                      <option value="HOURLY">Hourly</option>
                      <option value="PER_JOB">Per Job</option>
                    </select>
                  </div>
                </div>
              ))}
              <button onClick={addEmployee} style={{ padding: 12, background: 'transparent', border: `2px dashed ${tokens.color.border}`, borderRadius: tokens.radius.md, color: tokens.color.textMuted, cursor: 'pointer', fontSize: 14 }}>
                + Add Employee
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              <Button variant="ghost" onClick={prevStep}>← Back</Button>
              <Button onClick={handleComplete} disabled={submitting}>{submitting ? 'Setting up...' : 'Complete Setup →'}</Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>You're All Set!</h1>
            <p style={{ color: tokens.color.textMuted, marginBottom: 32 }}>Your booking page is live</p>

            <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.lg, padding: 24, border: `1px solid ${tokens.color.border}`, marginBottom: 32 }}>
              <p style={{ fontSize: 13, color: tokens.color.textMuted, marginBottom: 8 }}>Your Booking URL</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <code style={{ background: tokens.color.surfaceContainer, padding: '8px 16px', borderRadius: tokens.radius.md, fontSize: 16, color: tokens.color.primary }}>
                  pabandi.com/b/{slug}
                </code>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
              <Button variant="ghost" onClick={() => window.open(`/b/${slug}`, '_blank')}>Preview Booking Page</Button>
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
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: tokens.color.textMuted }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: tokens.radius.md,
          background: tokens.color.surfaceContainer, color: tokens.color.text,
          border: `1px solid ${tokens.color.border}`, fontSize: 14, outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function Button({ children, onClick, variant = 'primary', disabled = false }: { children: React.ReactNode; onClick: () => void; variant?: 'primary' | 'ghost'; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 24px', borderRadius: tokens.radius.md, fontWeight: 600, fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        background: variant === 'primary' ? tokens.color.primary : 'transparent',
        color: variant === 'primary' ? '#fff' : tokens.color.textMuted,
        border: variant === 'ghost' ? `1px solid ${tokens.color.border}` : 'none',
      }}
    >
      {children}
    </button>
  );
}
