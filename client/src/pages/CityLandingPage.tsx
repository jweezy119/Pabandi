import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '../design-system';
import { CheckCircleIcon, ShieldCheckIcon, BuildingStorefrontIcon, ArrowRightIcon, StarIcon } from '@heroicons/react/24/outline';

const CITY_DATA: Record<string, {
  name: string; nameUrud: string; tagline: string; businesses: string[];
  stat1: string; stat2: string; stat3: string; heroColor: string; accentColor: string;
  landmark: string;
}> = {
  'chicago': {
    name: 'Chicago',
    nameUrud: 'شیکاگو',
    tagline: 'Global Midwestern Hub',
    businesses: ['Hotels', 'Restaurants', 'Salons', 'Clinics', 'Short-Term Rentals'],
    stat1: '2.7M+', stat2: '6%', stat3: '$0',
    heroColor: 'var(--sky-wash)',
    accentColor: 'var(--sky-wash)',
    landmark: 'The Windy City',
  },
  'new-york': {
    name: 'New York',
    nameUrud: 'نیویارک',
    tagline: 'World-Class Hospitality',
    businesses: ['Hotels', 'Restaurants', 'Fitness Studios', 'Event Venues', 'Boutique Stays'],
    stat1: '8.4M+', stat2: '7%', stat3: '$0',
    heroColor: 'var(--muted-ochre)',
    accentColor: '#d97706',
    landmark: 'The Big Apple',
  },
};

const WHY_PABANDI = [
  { icon: <ShieldCheckIcon className="w-6 h-6" />, title: 'Zero No-Shows — Guaranteed', body: 'Booking deposits are locked in a Halal Web3 Escrow. If a customer cancels last-minute, the deposit is yours instantly — no chargebacks, no arguments.' },
  { icon: <BuildingStorefrontIcon className="w-6 h-6" />, title: 'Completely Free to Join', body: 'No monthly subscription. No setup fee. Pabandi is free for businesses. We only earn a micro-fee on the crypto transaction layer — which you never pay.' },
  { icon: <CheckCircleIcon className="w-6 h-6" />, title: 'AI Trust Matrix', body: 'Every customer who books through Pabandi has a verified, on-chain reliability score. You know exactly who you are dealing with before they walk through the door.' },
  { icon: <StarIcon className="w-6 h-6" />, title: '$PAB Token Rewards', body: 'Every booking earns you $PAB tokens. Stake them in the Halal Profit-Share Pool and earn up to 15.5% APY — powered by platform revenues, not interest.' },
];

export const CityLandingPage: React.FC = () => {
  const pathCity = window.location.pathname.split('/')[2] || '';
  const city = pathCity.toLowerCase() === 'chicago' ? 'chicago' : pathCity.toLowerCase() === 'new-york' ? 'new-york' : '';
  const data = CITY_DATA[city];

  const [formData, setFormData] = useState({ name: '', businessName: '', phone: '', type: '', city: data?.name || '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)", color: 'var(--warm-ink)" }}>
        <div className="text-center">
          <h1 className="text-4xl font-black mb-4">City Not Found</h1>
          <Link to="/" className="text-[var(--sage)] hover:underline">← Back to Home</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role: 'Business', location: data.name, why: `Business Interest from ${data.name} landing page` }),
      });
      setSubmitted(true);
    } catch { setSubmitted(true); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--cream)", color: 'var(--warm-ink)" }}>
      {/* Orbs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-[180px] opacity-[0.08] pointer-events-none" style={{ background: data.heroColor }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[var(--sage)] rounded-full blur-[140px] opacity-[0.06] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-5 max-w-5xl mx-auto border-b border-[rgba(191,179,163,0.2)]">
        <Link to="/" className="flex items-center gap-2 text-[var(--warm-ink)] font-black text-xl tracking-tight">
          <img src="/logo-company.jpg" alt="Pabandi" className="w-8 h-8 rounded-full object-cover" />
          Pabandi
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/search" className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Search</Link>
          <Link to="/booking" className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--warm-sand)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Book</Link>
          <Link to="/chicago" className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${city === 'chicago' ? 'bg-[rgba(var(--sky-wash),0.15)] text-[var(--sky-wash)]' : 'text-[var(--warm-ink)]/40 hover:text-[var(--warm-ink)]'}`}>Chicago</Link>
          <Link to="/new-york" className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${city === 'new-york' ? 'bg-[rgba(var(--muted-ochre),0.15)] text-[var(--muted-ochre)]' : 'text-[var(--warm-ink)]/40 hover:text-[var(--warm-ink)]'}`}>New York</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-20 sm:pb-24">

        {/* Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 sm:p-12 items-center mb-20">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
              style={{ background: `${data.heroColor}10`, color: data.heroColor, borderColor: `${data.heroColor}30` }}>
              Now Onboarding · {data.name}
            </div>
            <h1 className="text-4xl sm:text-5xl sm:text-5xl sm:text-6xl font-black tracking-tight mb-3 leading-[1.08]">
              Stop Losing Money<br />to COD Rejections &<br />No-Shows in<br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(135deg, ${data.heroColor}, 'var(--sage)")` }}>
                {data.name}
              </span>
            </h1>
            <p className="text-base text-[var(--warm-ink)]/50 leading-relaxed mb-2">{data.nameUrud} · {data.landmark}</p>
            <p className="text-base sm:text-lg text-[var(--warm-ink)]/60 leading-relaxed mb-8">
              Pabandi is launching exclusively in <strong className="text-[var(--warm-ink)]">{data.name}</strong> first. Join the Genesis wave of {data.businesses.slice(0, 3).join(', ')}, and other local businesses who are eliminating no-shows using Halal Web3 technology.
            </p>

            {/* Stats */}
            <div className="flex gap-4 sm:gap-6 mb-8">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--warm-ink)]">{data.stat1}</div>
                <div className="text-xs text-[var(--warm-ink)]/40">{data.name} residents</div>
              </div>
              <div className="w-px bg-[var(--warm-sand)]" />
              <div>
                <div className="text-2xl sm:text-3xl font-black" style={{ color: data.heroColor }}>{data.stat2}</div>
                <div className="text-xs text-[var(--warm-ink)]/40">no-show rate in F&B</div>
              </div>
              <div className="w-px bg-[var(--warm-sand)]" />
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--sage)]">{data.stat3}</div>
                <div className="text-xs text-[var(--warm-ink)]/40">monthly fee forever</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {data.businesses.map(b => (
                <span key={b} className="text-xs px-3 py-1 rounded-full border border-[rgba(191,179,163,0.3)] text-[var(--warm-ink)]/50">{b}</span>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-white/[0.04] border border-[rgba(191,179,163,0.3)] rounded-3xl p-7 backdrop-blur-sm">
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="w-16 h-16 text-[var(--sage)] mx-auto mb-4" />
                <h2 className="text-2xl font-black text-[var(--warm-ink)] mb-2">You're on the List! 🎉</h2>
                <p className="text-[var(--warm-ink)]/50 text-sm mb-6">We'll reach out within 48 hours to complete your onboarding as a <strong style={{ color: data.heroColor }}>Genesis Partner in {data.name}</strong>.</p>
                <Link to="/join" className="inline-flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl text-sm font-bold text-black transition-colors"
                  style={{ background: data.heroColor }}>
                  Complete Full Registration <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-black text-[var(--warm-ink)] mb-1">Register Your Business</h2>
                <p className="text-[var(--warm-ink)]/40 text-sm mb-6">
                  Get the <strong style={{ color: data.heroColor }}>Genesis Partner</strong> badge and priority placement in {data.name}.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input required value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your Full Name" className="w-full bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] placeholder-white/25 focus:outline-none focus:border-[rgba(191,179,163,0.5)] text-sm" />
                  <input required value={formData.businessName} onChange={e => setFormData(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="Business Name (Marketplace, E-Commerce...)" className="w-full bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] placeholder-white/25 focus:outline-none focus:border-[rgba(191,179,163,0.5)] text-sm" />
                  <input required value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                    placeholder="WhatsApp Number (+92...)" className="w-full bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] placeholder-white/25 focus:outline-none focus:border-[rgba(191,179,163,0.5)] text-sm" />
                  <select required value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.3)] rounded-xl px-4 py-3 text-[var(--warm-ink)] focus:outline-none focus:border-[rgba(191,179,163,0.5)] text-sm">
                    <option value="" disabled>Business Type</option>
                    {data.businesses.map(b => <option key={b} value={b}>{b}</option>)}
                    <option value="Other">Other</option>
                  </select>
                  <button type="submit" disabled={submitting}
                    className="w-full py-4 rounded-xl font-black text-sm text-black transition-all hover:opacity-90 shadow-lg disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, ${data.heroColor}, 'var(--sage)")`, boxShadow: `0 0 30px ${data.heroColor}30` }}>
                    {submitting ? 'Registering...' : `Join as Genesis Partner in ${data.name} →`}
                  </button>
                </form>
                <p className="text-center text-[var(--warm-ink)]/25 text-xs mt-4">Free forever. No credit card required. Setup in 5 minutes.</p>
              </>
            )}
          </div>
        </div>

        {/* Why Pabandi */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--warm-ink)] text-center mb-10">Why {data.name}'s Best Businesses Choose Pabandi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {WHY_PABANDI.map(w => (
              <div key={w.title} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-2xl p-6 hover:bg-white/[0.05] transition-colors">
                <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center text-[var(--sage)]" style={{ background: "rgba(16,185,129,0.1)", border: '1px solid "rgba(16,185,129,0.2)"' }}>
                  {w.icon}
                </div>
                <h3 className="font-bold text-[var(--warm-ink)] mb-2">{w.title}</h3>
                <p className="text-[var(--warm-ink)]/45 text-sm leading-relaxed">{w.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alibaba / Credibility Banner */}
        <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-[rgba(var(--muted-ochre),0.2)] rounded-3xl p-5 sm:p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-ochre)] mb-2">Backed by Global Innovation Programs</p>
          <h3 className="text-2xl font-black text-[var(--warm-ink)] mb-3">Pabandi × Alibaba Co-Create 2026 Finalist</h3>
          <p className="text-[var(--warm-ink)]/50 text-sm max-w-lg mx-auto">
            Pabandi is a selected participant in the Alibaba Co-Create 2026 program — connecting top startups with Alibaba Cloud's global infrastructure and ecosystem partners.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CityLandingPage;
