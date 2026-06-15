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
    icon: '🧠',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    title: 'AI No-Show Prediction',
    desc: 'Our proprietary machine learning engine analyzes behavioral signals to predict the probability of a no-show before it happens.',
  },
  {
    icon: '⛓️',
    color: '#14F195',
    glow: 'rgba(20,241,149,0.15)',
    title: 'Trustless Solana Escrow',
    desc: 'Deposits are held securely in Solana smart contracts and instantly released to you if a customer no-shows — zero chargebacks.',
  },
  {
    icon: '🪙',
    color: '#9945FF',
    glow: 'rgba(153,69,255,0.15)',
    title: 'Earn $PAB Crypto Rewards',
    desc: 'You earn $PAB tokens for every booking you honor. Accumulate tokens to unlock priority placement and governance rights.',
  },
  {
    icon: '🛡️',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    title: 'Pabandi Score Protection',
    desc: 'Customers are scored by our AI based on their reliability. Bad actors are automatically blocked from making high-risk bookings.',
  },
  {
    icon: '📊',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    title: 'Real-Time Analytics',
    desc: 'Track your protected revenue, no-show reduction rates, and crypto earnings through your dedicated business dashboard.',
  },
  {
    icon: '⭐',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.15)',
    title: 'Verified Google Reviews',
    desc: 'Only customers who actually checked in via Pabandi can leave a review, protecting your reputation from fake bots.',
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
    businessName: '', ownerName: '', phone: '', email: '', category: '', city: '',
    country: 'United States',
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
        setError(msg || 'Something went wrong. Please try again or call us at +1 (800) 000-0000.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div 
        style={{ 
          background: '#080e17', 
          color: '#edf1f5',
          ['--color-bg' as any]: '#080e17',
          ['--color-text' as any]: '#edf1f5',
          ['--color-text-muted' as any]: '#9e9e9e',
          ['--color-surface' as any]: '#0f172a',
          ['--color-surface-raised' as any]: '#1e293b',
          minHeight: '100vh' 
        }} 
        className="flex items-center justify-center p-6"
      >
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-black mb-3 text-[#e8e8e8]" >You're In!</h2>
          <p className="text-base mb-2 text-[#757575]" >
            Welcome to Pabandi, <span style={{ fontWeight: 700 }}>{form.businessName}</span>!
          </p>
          <p className="text-sm mb-8 text-[#9e9e9e]" >
            Our team will WhatsApp you at <strong className="text-[#616161]">{form.phone}</strong> within 24 hours to complete your setup — completely free.
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
    <div style={{ 
      background: '#080e17', 
      color: '#edf1f5',
      ['--color-bg' as any]: '#080e17',
      ['--color-text' as any]: '#edf1f5',
      ['--color-text-muted' as any]: '#9e9e9e',
      ['--color-surface' as any]: '#0f172a',
      ['--color-surface-raised' as any]: '#1e293b'
    }}>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(8,14,23,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white"
              style={{ background: 'linear-gradient(135deg,#0ea5e9, #14b8a6)' }}>P</div>
            <span className="font-bold text-sm text-[#e8e8e8]" >Pabandi</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-xs font-medium text-[#9e9e9e]" >Sign in</Link>
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
          Founding Partner Program — 🇺🇸 USA &amp; 🇵🇰 Pakistan
          </div>

          <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6 text-[#e8e8e8]" >
            Protect Your Revenue.<br />
            <span style={{ background: 'linear-gradient(135deg,#0ea5e9, #14F195)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Eliminate No-Shows with AI.
            </span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto mb-10" style={{ lineHeight: 1.7 }}>
            Pabandi is the Web3-powered reservation platform that uses predictive AI and Solana smart contracts to guarantee your bookings.
            <strong className="text-[#14F195]"> Zero Chargebacks. 100% Protection. </strong>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="#join-form" className="btn-primary text-base px-8 py-4">
              Claim Your Free Spot →
            </a>
            <div className="flex items-center gap-2 text-sm text-[#9e9e9e]" >
              <div className="flex -space-x-2">
                {['🍽️','💇','🏋️'].map((e) => (
                  <div key={e} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm"
                    style={{ borderColor: 'var(--color-bg)', background: 'var(--color-surface-raised)' }}>{e}</div>
                ))}
              </div>
              <span>Join <strong className="text-[#616161]">50+ businesses</strong> already on the waitlist</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { val: 'Forever', label: 'Base CRM Free' },
              { val: '98%', label: 'Show-up Rate' },
              { val: '2 min', label: 'Setup Time' },
              { val: '24/7', label: 'Support' },
            ].map(s => (
              <div key={s.val} className="rounded-2xl p-4"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-2xl font-black mb-1" style={{ color: '#e8e8e8' }}>{s.val}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Incentives ──────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00FFB0' }}>Founding Partner Perks</p>
            <h2 className="text-4xl font-black mb-4" style={{ color: '#e8e8e8', fontFamily: 'Space Grotesk, sans-serif' }}>Start For Free. Pay When You Win.</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
              Join the first 100 businesses to unlock our Base CRM forever free. Upgrade to our Outcome-Based AI protection when you're ready to eliminate no-shows for good.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {INCENTIVES.map(inc => (
              <div key={inc.title} className="rounded-2xl p-6 flex items-start gap-5"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl shrink-0">{inc.emoji}</div>
                <div>
                  <h3 className="font-bold text-base mb-1.5" style={{ color: '#e8e8e8' }}>{inc.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{inc.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Urgency bar */}
          <div className="mt-8 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div>
              <p className="font-bold text-sm" style={{ color: '#fbbf24' }}>⚡ Only 63 founding spots remaining</p>
              <p className="text-xs mt-0.5" style={{ color: '#d97706' }}>Spots are going fast. Sign up today to lock in your free Base CRM forever.</p>
            </div>
            <a href="#join-form" className="btn-primary text-sm px-6 py-2.5 shrink-0">
              Reserve My Spot
            </a>
          </div>
        </div>
      </section>

      {/* ── Deep Dive: Why Partner With Us ──────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto space-y-20">
          
          {/* Financial Impact */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#ec4899' }}>The Financial Impact</p>
              <h2 className="text-3xl font-black mb-4 text-[#e8e8e8] leading-tight">Stop Losing 20% of Your Revenue to No-Shows</h2>
              <p className="text-base text-[#757575] leading-relaxed mb-6">
                The average service business loses thousands of dollars a month to last-minute cancellations and ghosting. Our AI engine instantly evaluates the risk of every booking. If a customer is high-risk, we automatically lock a deposit in a Solana smart contract. If they don't show, you get paid instantly. Zero chargebacks, guaranteed.
              </p>
            </div>
            <div className="rounded-2xl p-8 border border-[rgba(236,72,153,0.2)] bg-[rgba(236,72,153,0.05)] relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/20 blur-3xl rounded-full"></div>
              <h3 className="font-bold text-lg text-white mb-4 relative z-10">Average Monthly Recovery</h3>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400 relative z-10 mb-2">
                +$4,200
              </div>
              <p className="text-sm text-pink-200/80 relative z-10">Based on 15 saved bookings per month.</p>
            </div>
          </div>

          {/* Marketing Impact */}
          <div className="grid md:grid-cols-2 gap-12 items-center flex-row-reverse">
            <div className="order-2 md:order-1 rounded-2xl p-8 border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.05)] relative overflow-hidden">
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full"></div>
              <h3 className="font-bold text-lg text-white mb-4 relative z-10">High-Intent Traffic</h3>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-emerald-100/70">Average Pabandi Score</span>
                  <span className="text-emerald-400 font-bold">810 (Elite)</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-emerald-100/70">Show-up Rate</span>
                  <span className="text-emerald-400 font-bold">99.2%</span>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#10b981' }}>The Marketing Funnel</p>
              <h2 className="text-3xl font-black mb-4 text-[#e8e8e8] leading-tight">Attract the Best Customers in Your City</h2>
              <p className="text-base text-[#757575] leading-relaxed mb-6">
                Pabandi isn't just a booking tool; it's a vetted network. By partnering with us, your business is placed in front of users who have proven their reliability through their high Pabandi Scores. Better customers mean higher spend per ticket and zero wasted time.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── Industry Matrix ─────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0ea5e9' }}>Tailored Protection</p>
            <h2 className="text-4xl font-black mb-4 text-[#e8e8e8]">How the Matrix Protects Your Industry</h2>
            <p className="text-base text-[#757575] max-w-2xl mx-auto leading-relaxed">
              Different businesses face different risks. The Trust Matrix dynamically weighs the four data layers to provide custom, outcome-based protection for your specific avenue of business.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Fine Dining */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🍽️</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">Fine Dining & Restaurants</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                Empty tables during peak hours devastate margins. For dining, the Matrix heavily weighs the <strong className="text-blue-400">Historical Show Rate</strong> to filter out chronic no-showers and ensure high-demand slots are filled by reliable patrons.
              </p>
            </div>

            {/* Salons & Spas */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-pink-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">💇</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">Salons & Spas</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                A late cancellation leaves high-value block times unfillable. For salons, the Matrix focuses on <strong className="text-pink-400">Cancellation Lead Time</strong>, automatically requiring escrow deposits from users who frequently cancel at the last minute.
              </p>
            </div>

            {/* Event Venues */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🎪</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">Event Venues & Planners</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                Huge deposits and massive revenue are at stake. For venues, the Matrix prioritizes <strong className="text-purple-400">Verified Identity (KYC)</strong> and <strong className="text-purple-400">Social Graph Analytics</strong> to guarantee that large bookings are backed by real, vetted individuals.
              </p>
            </div>

            {/* Clinics */}
            <div className="rounded-3xl p-8 relative overflow-hidden group" style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="text-4xl mb-4 relative z-10">🩺</div>
              <h3 className="text-xl font-bold text-[#e8e8e8] mb-2 relative z-10">Clinics & Healthcare</h3>
              <p className="text-sm text-[#9e9e9e] leading-relaxed mb-4 relative z-10">
                Patient flow integrity is critical for both revenue and care delivery. The Matrix looks at <strong className="text-emerald-400">Consistent Reliability</strong> across the ecosystem to ensure high-priority appointment slots are respected.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── API & Integrations ──────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8b5cf6' }}>Seamless Integration</p>
            <h2 className="text-4xl font-black mb-4 text-[#e8e8e8]">Connect Your Ecosystem</h2>
            <p className="text-base text-[#757575] max-w-2xl mx-auto leading-relaxed">
              Whether you are a solo operator using our Free CRM, or an enterprise needing direct API access, Pabandi connects seamlessly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-3xl p-8 border border-white/10" style={{ background: 'var(--color-surface-raised)' }}>
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined">developer_board</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Enterprise API & SDKs</h3>
              <p className="text-slate-400 mb-6 leading-relaxed">
                Add our Trust Matrix directly to your existing app. Pay only for what you use with our Pay-As-You-Go pricing model, and accept fiat or $PAB token natively. 
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-blue-400 material-symbols-outlined text-[18px]">check_circle</span>
                  Node.js / TypeScript SDK
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-blue-400 material-symbols-outlined text-[18px]">check_circle</span>
                  Real-time Webhook Events
                </li>
              </ul>
              <a href="#" className="text-blue-400 text-sm font-bold hover:underline flex items-center gap-1">View API Docs <span className="material-symbols-outlined text-[16px]">arrow_forward</span></a>
            </div>

            <div className="rounded-3xl p-8 border border-white/10" style={{ background: 'var(--color-surface-raised)' }}>
              <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined">widgets</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Open Source CRM Integration</h3>
              <p className="text-slate-400 mb-6 leading-relaxed">
                Connect your free Pabandi account to powerful open-source CRMs like Odoo or Cal.com. Manage your schedule and pipeline with zero monthly fees.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-purple-400 material-symbols-outlined text-[18px]">check_circle</span>
                  Native Odoo Community Sync
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-purple-400 material-symbols-outlined text-[18px]">check_circle</span>
                  Cal.com Scheduling Infrastructure
                </li>
              </ul>
              <a href="#" className="text-purple-400 text-sm font-bold hover:underline flex items-center gap-1">Explore CRM Partners <span className="material-symbols-outlined text-[16px]">arrow_forward</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-[#9e9e9e]" >Platform Features</p>
            <h2 className="text-4xl font-black text-[#e8e8e8]" >Next-Gen Web3 Infrastructure</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map(b => (
              <div key={b.title} className="rounded-2xl p-6 transition-transform hover:-translate-y-1"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                  style={{ background: b.glow }}>
                  {b.icon}
                </div>
                <h3 className="font-bold text-base mb-2 text-[#e8e8e8]" >{b.title}</h3>
                <p className="text-sm leading-relaxed text-[#757575]" >{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-[#9e9e9e]" >Getting Started</p>
            <h2 className="text-4xl font-black text-[#e8e8e8]" >Live in 24 Hours</h2>
          </div>

          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.num} className="rounded-2xl p-6 flex items-start gap-6"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl font-black shrink-0" style={{ color: 'rgba(59,130,246,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                  {step.num}
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1 text-[#e8e8e8]" >{step.title}</h3>
                  <p className="text-sm text-[#757575]" >{step.desc}</p>
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
            <h2 className="text-4xl font-black mb-3 text-[#e8e8e8]" >Claim Your Free Spot</h2>
            <p className="text-sm text-[#757575]" >
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
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >Business Name</label>
                <input name="businessName" value={form.businessName} onChange={handleChange}
                  placeholder="e.g. Kolachi Restaurant"
                  className="input-field w-full" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >Owner / Manager Name</label>
                <input name="ownerName" value={form.ownerName} onChange={handleChange}
                  placeholder="Your full name"
                  className="input-field w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >WhatsApp Number</label>
                  <input name="phone" value={form.phone} onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >Email</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="you@business.com"
                    className="input-field w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >Category</label>
                  <select name="category" value={form.category} onChange={handleChange}
                    className="input-field w-full appearance-none">
                    <option value="" disabled>Select...</option>
                    {CATEGORIES.map(c => <option key={c} value={c.toUpperCase().replace(' ', '_')}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >Country</label>
                  <select name="country" value={form.country} onChange={handleChange}
                    className="input-field w-full appearance-none">
                    <option value="United States">🇺🇸 United States</option>
                    <option value="Pakistan">🇵🇰 Pakistan</option>
                  </select>
                </div>
              </div>

              {/* Password row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >Password</label>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold transition-colors text-[#e8e8e8]" >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-[#9e9e9e]" >Confirm Password</label>
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

              <p className="text-center text-xs text-[#e8e8e8]" >
                No credit card · No contracts · Cancel anytime
              </p>
            </form>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            {['🔒 Secure & Private', '🇺🇸 Built for the USA', '⚡ Live in 24hrs'].map(t => (
              <span key={t} className="text-xs font-medium text-[#e8e8e8]" >{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-4 text-center"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-xs">© 2026 Pabandi · United States · <a href="mailto:hello@pabandi.com" className="hover:text-blue-400 transition-colors">hello@pabandi.com</a></p>
      </footer>

    </div>
  );
}
