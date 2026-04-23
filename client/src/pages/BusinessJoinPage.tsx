import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';

// ── Icons ──────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

// ── Data ───────────────────────────────────────────────────────────────
const BENEFITS = [
  {
    icon: '🛡️',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    title: 'No-Show Protection',
    desc: 'AI predicts risky bookings before they happen. Get reimbursed if a customer ghosts — automatically.',
  },
  {
    icon: '📊',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    title: 'Real-Time Analytics',
    desc: 'See your peak hours, popular tables, and monthly revenue trends in a clean dashboard.',
  },
  {
    icon: '📲',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    title: 'Automated Reminders',
    desc: 'Pabandi sends SMS & WhatsApp reminders to customers 24 hours before — so they actually show up.',
  },
  {
    icon: '🗺️',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
    title: 'Google Maps Integration',
    desc: 'Customers find you on Google Maps and book directly through Pabandi — zero friction.',
  },
  {
    icon: '💳',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    title: 'Flexible Payments',
    desc: 'Accept deposits via Safepay, crypto (BNB/SOL), or cash. You choose, we handle the tech.',
  },
  {
    icon: '⭐',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.15)',
    title: 'Verified Reviews',
    desc: 'Only customers who actually visited can leave a review. Your rating stays honest and trustworthy.',
  },
];

const INCENTIVES = [
  { emoji: '🎁', title: '6 Months Free', desc: 'Zero subscription fees for founding partners. No credit card required to start.' },
  { emoji: '🏅', title: 'Founding Business Badge', desc: 'A permanent "Founding Partner" badge on your profile, visible to all customers.' },
  { emoji: '📌', title: 'Featured Listing', desc: 'Your business appears at the top of search results in your category for 6 months.' },
  { emoji: '📞', title: 'Dedicated Setup Support', desc: 'Our team personally sets up your business profile. You don\'t have to do anything technical.' },
];

const STEPS = [
  { num: '01', title: 'Fill in the form below', desc: 'Business name, category, and contact details. Takes 2 minutes.' },
  { num: '02', title: 'We set up your profile', desc: 'Our team builds your full profile, syncs with Google Maps, and handles all technical setup.' },
  { num: '03', title: 'Start receiving bookings', desc: 'Share your unique Pabandi link. Customers book, you get notified instantly.' },
];

const CATEGORIES = ['Restaurant', 'Cafe', 'Salon', 'Spa', 'Clinic', 'Fitness Center', 'Event Venue', 'Other'];

// ── Component ──────────────────────────────────────────────────────────
export default function BusinessJoinPage() {
  const [form, setForm] = useState({
    businessName: '', ownerName: '', phone: '', email: '', category: '', city: 'Karachi',
    password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.ownerName || !form.phone || !form.email || !form.category) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      // Store interest lead in database via the auth register flow
      // or a dedicated /leads endpoint — for now we use register + business creation
      await apiClient.post('/auth/register', {
        email: form.email,
        password: form.password,
        firstName: form.ownerName.split(' ')[0] || form.ownerName,
        lastName: form.ownerName.split(' ').slice(1).join(' ') || '.',
        phone: form.phone,
        role: 'BUSINESS_OWNER',
        businessName: form.businessName,
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('already exists')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(msg || 'Something went wrong. Please try again or WhatsApp us at +92 300 000 0000.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-black mb-3" style={{ color: '#e8edf3' }}>You're In!</h2>
          <p className="text-base mb-2" style={{ color: '#7a90a8' }}>
            Welcome to Pabandi, <span style={{ color: '#e8edf3', fontWeight: 700 }}>{form.businessName}</span>!
          </p>
          <p className="text-sm mb-8" style={{ color: '#5a7490' }}>
            Our team will WhatsApp you at <strong style={{ color: '#a0b4c8' }}>{form.phone}</strong> within 24 hours to complete your setup — completely free.
          </p>
          <div className="rounded-2xl p-5 mb-8 text-left space-y-3"
            style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
            {['6 months free — activated', 'Founding Business badge — reserved', 'Featured listing — queued'].map(item => (
              <div key={item} className="flex items-center gap-3 text-sm font-medium" style={{ color: '#34d399' }}>
                <CheckIcon /> {item}
              </div>
            ))}
          </div>
          <Link to="/" className="btn-secondary text-sm">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(8,14,23,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white"
              style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>P</div>
            <span className="font-bold text-sm" style={{ color: '#e8edf3' }}>Pabandi</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-xs font-medium" style={{ color: '#5a7490' }}>Sign in</Link>
            <a href="#join-form" className="btn-primary text-xs py-2 px-4">Get Started Free</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-4">
        <div className="glow-blob w-[600px] h-[600px] top-[-200px] left-1/2 -translate-x-1/2"
          style={{ background: 'rgba(37,99,235,0.1)', position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div className="glow-blob w-[400px] h-[400px] bottom-0 right-0"
          style={{ background: 'rgba(124,58,237,0.08)', position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Founding badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-bold tracking-widest uppercase"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Founding Partner Program — Limited Spots
          </div>

          <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6" style={{ color: '#e8edf3' }}>
            Grow Your Business.<br />
            <span style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Eliminate No-Shows.
            </span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto mb-10" style={{ color: '#7a90a8', lineHeight: 1.7 }}>
            Pabandi is Karachi's AI-powered reservation platform. Join as a Founding Partner and get
            <strong style={{ color: '#e8edf3' }}> 6 months completely free </strong>
            — no credit card, no contracts.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="#join-form" className="btn-primary text-base px-8 py-4">
              Claim Your Free Spot →
            </a>
            <div className="flex items-center gap-2 text-sm" style={{ color: '#5a7490' }}>
              <div className="flex -space-x-2">
                {['🍽️','💇','🏋️'].map((e) => (
                  <div key={e} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm"
                    style={{ borderColor: 'var(--color-bg)', background: 'var(--color-surface-raised)' }}>{e}</div>
                ))}
              </div>
              <span>Join <strong style={{ color: '#a0b4c8' }}>50+ businesses</strong> already on the waitlist</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { val: '6 Months', label: 'Completely Free' },
              { val: '98%', label: 'Show-up Rate' },
              { val: '2 min', label: 'Setup Time' },
              { val: '24/7', label: 'Support' },
            ].map(s => (
              <div key={s.val} className="rounded-2xl p-4"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-2xl font-black mb-1" style={{ color: '#e8edf3' }}>{s.val}</p>
                <p className="text-xs" style={{ color: '#5a7490' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Incentives ──────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#fbbf24' }}>Founding Partner Perks</p>
            <h2 className="text-4xl font-black mb-4" style={{ color: '#e8edf3' }}>Everything You Get — Free</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#7a90a8' }}>
              We're offering these perks to the first 100 businesses who join. After that, pricing starts at ₨4,999/month.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {INCENTIVES.map(inc => (
              <div key={inc.title} className="rounded-2xl p-6 flex items-start gap-5"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl shrink-0">{inc.emoji}</div>
                <div>
                  <h3 className="font-bold text-base mb-1.5" style={{ color: '#e8edf3' }}>{inc.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#7a90a8' }}>{inc.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Urgency bar */}
          <div className="mt-8 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div>
              <p className="font-bold text-sm" style={{ color: '#fbbf24' }}>⚡ Only 63 founding spots remaining</p>
              <p className="text-xs mt-0.5" style={{ color: '#92711a' }}>Spots are going fast. Sign up today to lock in your free 6-month access.</p>
            </div>
            <a href="#join-form" className="btn-primary text-sm px-6 py-2.5 shrink-0">
              Reserve My Spot
            </a>
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#5a7490' }}>Platform Features</p>
            <h2 className="text-4xl font-black" style={{ color: '#e8edf3' }}>Built for Karachi Businesses</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map(b => (
              <div key={b.title} className="rounded-2xl p-6 transition-transform hover:-translate-y-1"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                  style={{ background: b.glow }}>
                  {b.icon}
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: '#e8edf3' }}>{b.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#7a90a8' }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#5a7490' }}>Getting Started</p>
            <h2 className="text-4xl font-black" style={{ color: '#e8edf3' }}>Live in 24 Hours</h2>
          </div>

          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.num} className="rounded-2xl p-6 flex items-start gap-6"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl font-black shrink-0" style={{ color: 'rgba(59,130,246,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                  {step.num}
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1" style={{ color: '#e8edf3' }}>{step.title}</h3>
                  <p className="text-sm" style={{ color: '#7a90a8' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sign-Up Form ─────────────────────────────────────────── */}
      <section id="join-form" className="py-24 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold tracking-widest uppercase"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
              🎁 6 Months Free · No Credit Card
            </div>
            <h2 className="text-4xl font-black mb-3" style={{ color: '#e8edf3' }}>Claim Your Free Spot</h2>
            <p className="text-sm" style={{ color: '#7a90a8' }}>
              Fill in your details and our team will WhatsApp you within 24 hours to complete setup.
            </p>
          </div>

          <div className="rounded-2xl p-8"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.08)' }}>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>Business Name</label>
                <input name="businessName" value={form.businessName} onChange={handleChange}
                  placeholder="e.g. Kolachi Restaurant"
                  className="input-field w-full" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>Owner / Manager Name</label>
                <input name="ownerName" value={form.ownerName} onChange={handleChange}
                  placeholder="Your full name"
                  className="input-field w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>WhatsApp Number</label>
                  <input name="phone" value={form.phone} onChange={handleChange}
                    placeholder="+92 300 0000000"
                    className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>Email</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="you@business.com"
                    className="input-field w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>Category</label>
                  <select name="category" value={form.category} onChange={handleChange}
                    className="input-field w-full appearance-none">
                    <option value="" disabled>Select...</option>
                    {CATEGORIES.map(c => <option key={c} value={c.toUpperCase().replace(' ', '_')}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>City</label>
                  <input name="city" value={form.city} onChange={handleChange}
                    placeholder="Karachi"
                    className="input-field w-full" />
                </div>
              </div>

              {/* Password row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>Password</label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      className="input-field w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold transition-colors"
                      style={{ color: '#3d5068' }}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5a7490' }}>Confirm Password</label>
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat password"
                    className="input-field w-full"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="btn-primary w-full py-4 text-base font-bold mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : '🎉 Claim My Free 6 Months'}
              </button>

              <p className="text-center text-xs" style={{ color: '#3d5068' }}>
                No credit card · No contracts · Cancel anytime
              </p>
            </form>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            {['🔒 Secure & Private', '🇵🇰 Built for Pakistan', '⚡ Live in 24hrs'].map(t => (
              <span key={t} className="text-xs font-medium" style={{ color: '#3d5068' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-4 text-center"
        style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#3d5068' }}>
        <p className="text-xs">© 2025 Pabandi · Karachi, Pakistan · <a href="mailto:hello@pabandi.com" className="hover:text-blue-400 transition-colors">hello@pabandi.com</a></p>
      </footer>

    </div>
  );
}
