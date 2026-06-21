import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';

// ── Icons ──────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const CATEGORIES = [
  { id: 'HOTEL', label: 'Boutique Hotel & Hospitality' },
  { id: 'RESTAURANT', label: 'Local Restaurant & Cafe' },
  { id: 'EVENT_VENUE', label: 'Event Venue & Space' },
  { id: 'CLINIC', label: 'Private Clinic' },
  { id: 'HOSPITAL', label: 'Hospital & Healthcare' },
  { id: 'FITNESS_CENTER', label: 'Fitness Studio & Gym' },
  { id: 'SPA', label: 'Salon & Spa' },
  { id: 'FREELANCE', label: 'Freelance & Gig Worker' },
  { id: 'OTHER', label: 'Other Small Business' }
];

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
        setError(msg || 'Something went wrong. Please try again or contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div 
        className="flex items-center justify-center p-6 bg-[#080e17] text-[#edf1f5] min-h-screen"
      >
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-black mb-3 text-[#e8e8e8]">Application Received!</h2>
          <p className="text-base mb-2 text-[#757575]">
            Welcome to the Global Network, <span style={{ fontWeight: 700 }}>{form.businessName}</span>!
          </p>
          <p className="text-sm mb-8 text-[#9e9e9e]">
            Our onboarding team will contact you at <strong className="text-[#616161]">{form.phone}</strong> within 24 hours to help set up your business profile.
          </p>
          <div className="rounded-2xl p-5 mb-8 text-left space-y-3"
            style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
            {[
              '6 months Starter tier — activated', 
              'Founding Business badge — reserved', 
              'Global local listing — queued'
            ].map(item => (
              <div key={item} className="flex items-center gap-3 text-sm font-medium" style={{ color: '#34d399' }}>
                <CheckIcon /> {item}
              </div>
            ))}
          </div>
          <Link to="/" className="btn-secondary text-sm">← Back to Global Directory</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#080e17] text-[#edf1f5] font-body min-h-screen selection:bg-blue-500/30">
      
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#080e17]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-sm font-bold hover:opacity-80 transition-opacity">
            <span className="text-slate-400">← Back</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Login</Link>
            <a href="#join-form" className="bg-white text-black text-sm font-bold py-2 px-5 rounded-full hover:bg-slate-200 transition-colors">Register</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-bold tracking-widest uppercase bg-blue-500/10 border border-blue-500/20 text-blue-400">
              🏢 For Businesses
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.1] mb-8 text-white font-headline tracking-tight">
              Hire an <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">AI Agent</span><br />to secure your revenue.
            </h1>

            <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed max-w-xl">
              Pabandi's Agentic AI analyses customer history, weather, local events, and 40+ data points autonomously. High-risk? The agent negotiates and captures a deposit automatically — before they even leave your page.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
              <a href="#join-form" className="w-full sm:w-auto text-center bg-white text-black text-lg px-8 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                Register Your Business →
              </a>
              <a href="#how-it-works" className="w-full sm:w-auto text-center text-lg px-8 py-4 rounded-xl font-bold text-white border border-white/10 hover:bg-white/5 transition-all">
                See How It Works
              </a>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-semibold text-slate-300">
              <span className="flex items-center gap-2"><span className="text-emerald-400 text-lg">✓</span> Built for Global SMEs</span>
              <span className="flex items-center gap-2"><span className="text-emerald-400 text-lg">✓</span> Agentic Business</span>
              <span className="flex items-center gap-2"><span className="text-emerald-400 text-lg">✓</span> Solana Web3</span>
            </div>
          </div>

          {/* ── Mock Dashboard UI ──────────────────────────────── */}
          <div className="bg-[#0f172a] rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg text-white">Pabandi Business Dashboard</h3>
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                <span className="material-symbols-outlined text-sm">notifications</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="text-slate-400 text-xs mb-1">Today's Bookings</div>
                <div className="text-3xl font-black text-white">24</div>
              </div>
              <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20">
                <div className="text-emerald-400 text-xs mb-1">Revenue Protected</div>
                <div className="text-3xl font-black text-emerald-400">$48K</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-blue-400">AK</div>
                  <div>
                    <div className="font-bold text-white text-sm">Ayesha Khan</div>
                    <div className="text-xs text-slate-400">2:00 PM · Table for 4</div>
                  </div>
                </div>
                <div className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 font-bold">Low Risk</div>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-400">MR</div>
                  <div>
                    <div className="font-bold text-white text-sm">M. Rehman</div>
                    <div className="text-xs text-slate-400">3:30 PM · Table for 2</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400 font-bold inline-block mb-1">Med Risk</div>
                  <div className="text-[10px] text-slate-400">$5 dep.</div>
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center font-bold text-rose-400">SZ</div>
                  <div>
                    <div className="font-bold text-white text-sm">Sara Zaidi</div>
                    <div className="text-xs text-slate-400">5:00 PM · Table for 6</div>
                  </div>
                </div>
                <div className="text-right relative z-10">
                  <div className="text-xs px-2 py-1 rounded bg-rose-500/20 text-rose-400 font-bold inline-block mb-1">High Risk</div>
                  <div className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">$15 dep.</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Mini Stats Bar ──────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/5">
          <div className="text-center px-4">
            <div className="text-4xl font-black text-white mb-2">82%</div>
            <div className="text-sm text-slate-400">Reduction in no-shows</div>
          </div>
          <div className="text-center px-4">
            <div className="text-4xl font-black text-white mb-2">40+</div>
            <div className="text-sm text-slate-400">AI risk data points</div>
          </div>
          <div className="text-center px-4">
            <div className="text-4xl font-black text-white mb-2">$0</div>
            <div className="text-sm text-slate-400">Setup cost</div>
          </div>
          <div className="text-center px-4">
            <div className="text-4xl font-black text-white mb-2">5 min</div>
            <div className="text-sm text-slate-400">To go live</div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <div className="text-blue-400 font-bold tracking-widest uppercase text-sm mb-4">✦ Features</div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Everything your business<br />needs to win.</h2>
            <p className="text-xl text-slate-400 max-w-2xl">From automated deposits to webhook integrations with your existing CRM — Pabandi slots in, not over.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-[#0f172a] border border-white/5 p-8 rounded-3xl hover:border-white/10 transition-colors">
              <div className="text-4xl mb-6">🤖</div>
              <h3 className="text-xl font-bold text-white mb-3">Agentic Risk Scoring</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Your AI agent scores each booking autonomously using customer history, weather, and time-of-day patterns. Strategy updates as conditions change.</p>
            </div>
            <div className="bg-[#0f172a] border border-white/5 p-8 rounded-3xl hover:border-white/10 transition-colors">
              <div className="text-4xl mb-6">💳</div>
              <h3 className="text-xl font-bold text-white mb-3">Dynamic Deposit Capture</h3>
              <p className="text-slate-400 text-sm leading-relaxed">High-risk bookings trigger automatic deposit requests. Accepts PayPal, Alibaba Pay, Binance Pay, and Solana (USDC). Funds settle directly to your account in USD.</p>
            </div>
            <div className="bg-[#0f172a] border border-white/5 p-8 rounded-3xl hover:border-white/10 transition-colors">
              <div className="text-4xl mb-6">📊</div>
              <h3 className="text-xl font-bold text-white mb-3">Real-Time Analytics</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Track booking patterns, no-show rates, revenue protected, and table turnover in a clean dashboard. Export to CSV or connect via webhook.</p>
            </div>
            <div className="bg-[#0f172a] border border-white/5 p-8 rounded-3xl hover:border-white/10 transition-colors">
              <div className="text-4xl mb-6">🔔</div>
              <h3 className="text-xl font-bold text-white mb-3">Automated Reminders</h3>
              <p className="text-slate-400 text-sm leading-relaxed">SMS via Twilio and email via SendGrid reminders go out automatically at 24h, 2h, and 30 minutes before every reservation.</p>
            </div>
            <div className="bg-[#0f172a] border border-white/5 p-8 rounded-3xl hover:border-white/10 transition-colors">
              <div className="text-4xl mb-6">🔗</div>
              <h3 className="text-xl font-bold text-white mb-3">Webhooks & CRM Integration</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Push booking events to your POS, CRM, or any system via outbound webhooks. Full REST API available for custom integrations.</p>
            </div>
            <div className="bg-[#0f172a] border border-white/5 p-8 rounded-3xl hover:border-white/10 transition-colors">
              <div className="text-4xl mb-6">🌐</div>
              <h3 className="text-xl font-bold text-white mb-3">Global Compliance</h3>
              <p className="text-slate-400 text-sm leading-relaxed">PCI-DSS compliant data handling. Accepts PayPal, Alibaba Pay, Binance Pay & Solana globally. Multi-lingual support built for international scale.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section id="how-it-works" className="py-32 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <div className="text-blue-400 font-bold tracking-widest uppercase text-sm mb-4">✦ How It Works</div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Up and running in minutes.</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-12 relative">
            <div className="hidden md:block absolute top-8 left-12 right-12 h-[2px] bg-white/10"></div>
            
            <div className="relative">
              <div className="w-16 h-16 bg-[#0f172a] border-2 border-blue-500 rounded-full flex items-center justify-center text-xl font-bold text-white mb-6 relative z-10 mx-auto md:mx-0">01</div>
              <h3 className="text-xl font-bold text-white mb-3 text-center md:text-left">Register Your Business</h3>
              <p className="text-slate-400 text-sm text-center md:text-left leading-relaxed">Add your venue, set business hours, table capacity, and your deposit preference threshold.</p>
            </div>
            <div className="relative">
              <div className="w-16 h-16 bg-[#0f172a] border-2 border-white/20 rounded-full flex items-center justify-center text-xl font-bold text-white mb-6 relative z-10 mx-auto md:mx-0">02</div>
              <h3 className="text-xl font-bold text-white mb-3 text-center md:text-left">Share Your Booking Link</h3>
              <p className="text-slate-400 text-sm text-center md:text-left leading-relaxed">A branded link your customers use to book. Embed it on your site, WhatsApp, or Instagram bio.</p>
            </div>
            <div className="relative">
              <div className="w-16 h-16 bg-[#0f172a] border-2 border-emerald-500 rounded-full flex items-center justify-center text-xl font-bold text-white mb-6 relative z-10 mx-auto md:mx-0">03</div>
              <h3 className="text-xl font-bold text-white mb-3 text-center md:text-left">Your Agent Takes Over</h3>
              <p className="text-slate-400 text-sm text-center md:text-left leading-relaxed">Our Agentic AI runs instantly. Low risk? Auto-confirmed. High risk? The agent negotiates a deposit automatically.</p>
            </div>
            <div className="relative">
              <div className="w-16 h-16 bg-[#0f172a] border-2 border-purple-500 rounded-full flex items-center justify-center text-xl font-bold text-white mb-6 relative z-10 mx-auto md:mx-0">04</div>
              <h3 className="text-xl font-bold text-white mb-3 text-center md:text-left">Get Paid, Stay Protected</h3>
              <p className="text-slate-400 text-sm text-center md:text-left leading-relaxed">Deposits settle to your account. No-shows? Keep the deposit. Shows up? It's credited to their bill.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── $PAB for Business ───────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <div className="text-[#14F195] font-bold tracking-widest uppercase text-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">token</span> $PAB for Business
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">Get paid in tokens,<br />not just dollars.</h2>
            <p className="text-xl text-slate-400 mb-10 leading-relaxed">
              Pabandi rewards venues that honor bookings and fight no-shows — automatically credited to your business wallet, cashable on Solana.
            </p>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-xl">✓</div>
                <div>
                  <div className="font-bold text-white flex items-center gap-3">Honored booking <span className="text-[#14F195] text-sm">+25 $PAB</span></div>
                  <div className="text-sm text-slate-400 mt-1">Every reservation you mark completed earns your business instant $PAB.</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-xl">🛡️</div>
                <div>
                  <div className="font-bold text-white flex items-center gap-3">No-show protected <span className="text-[#14F195] text-sm">+40 $PAB</span></div>
                  <div className="text-sm text-slate-400 mt-1">When a deposit is kept after a no-show, you earn bonus $PAB on top of protected revenue.</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-xl">📉</div>
                <div>
                  <div className="font-bold text-white flex items-center gap-3">Low no-show month <span className="text-[#14F195] text-sm">+75 $PAB</span></div>
                  <div className="text-sm text-slate-400 mt-1">Hit reliability targets and unlock monthly $PAB bonuses for your venue.</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-xl">🤝</div>
                <div>
                  <div className="font-bold text-white flex items-center gap-3">Refer a business <span className="text-[#14F195] text-sm">+150 $PAB</span></div>
                  <div className="text-sm text-slate-400 mt-1">Bring another venue to Pabandi and earn a one-time $PAB referral reward.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#14F195]/5 border border-[#14F195]/20 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#14F195]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Payout to Phantom on Solana</h3>
            <p className="text-slate-400 text-sm mb-8 relative z-10">Register your business, connect Phantom in settings, and transfer earned $PAB to your Solana address anytime.</p>

            <div className="bg-[#0f172a] rounded-2xl p-6 border border-white/10 relative z-10 mb-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#14F195]/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#14F195] text-sm">account_balance_wallet</span>
                  </div>
                  <span className="font-bold text-white">Business $PAB Wallet</span>
                </div>
                <div className="text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">Not connected</div>
              </div>
              <div className="text-5xl font-black text-white mb-2 flex items-center gap-3">
                840 <span className="text-xl text-[#14F195]">$PAB</span>
              </div>
              <div className="text-xs text-slate-400 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse"></span> Live Business earnings (example)
              </div>
              <button className="w-full bg-[#9945FF] text-white py-3 rounded-xl font-bold hover:bg-[#9945FF]/90 transition-colors flex items-center justify-center gap-2">
                ◎ Connect Phantom
              </button>
            </div>

            <ul className="space-y-3 relative z-10">
              <li className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-[#14F195]">✓</span> Complete bookings → $PAB credited automatically
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-[#14F195]">✓</span> Connect Phantom wallet in your dashboard
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-[#14F195]">✓</span> Transfer $PAB on Solana when you're ready
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <section className="py-32 px-6 bg-[#0f172a] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="text-blue-400 font-bold tracking-widest uppercase text-sm mb-4">✦ Pricing</div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Simple, transparent pricing.</h2>
            <p className="text-xl text-slate-400">No setup fees. No contracts. Cancel any time.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="bg-[#080e17] rounded-3xl p-8 border border-white/10 flex flex-col">
              <h3 className="text-2xl font-bold text-white mb-2">Starter</h3>
              <div className="text-3xl font-black text-white mb-4">Free <span className="text-lg text-slate-500 font-normal">/ forever</span></div>
              <p className="text-sm text-slate-400 mb-8 h-10">Perfect for single-location businesses just getting started.</p>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Up to 50 bookings / month</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> AI risk scoring</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> SMS & email reminders</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Basic analytics dashboard</li>
              </ul>
              <a href="#join-form" className="w-full text-center py-4 rounded-xl font-bold border border-white/20 text-white hover:bg-white/5 transition-colors">Start Free →</a>
            </div>

            {/* Growth */}
            <div className="bg-gradient-to-b from-[#0f172a] to-[#080e17] rounded-3xl p-8 border border-blue-500 flex flex-col relative shadow-[0_0_50px_rgba(59,130,246,0.1)] scale-105 z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Most Popular</div>
              <h3 className="text-2xl font-bold text-white mb-2">Growth</h3>
              <div className="text-3xl font-black text-white mb-4">$29 <span className="text-lg text-slate-500 font-normal">/ month</span></div>
              <p className="text-sm text-slate-400 mb-8 h-10">For active venues that need full protection and automation.</p>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Unlimited bookings</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Dynamic deposit capture</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Webhook & CRM integration</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Advanced analytics + exports</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Priority support (WhatsApp)</li>
              </ul>
              <a href="#join-form" className="w-full text-center py-4 rounded-xl font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25">Get Growth →</a>
            </div>

            {/* Enterprise */}
            <div className="bg-[#080e17] rounded-3xl p-8 border border-white/10 flex flex-col">
              <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
              <div className="text-3xl font-black text-white mb-4">Custom</div>
              <p className="text-sm text-slate-400 mb-8 h-10">Multi-location chains, hotels, and high-volume venues.</p>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Multi-location management</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Custom AI model training</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Dedicated account manager</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> SLA + uptime guarantee</li>
                <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> White-label option</li>
              </ul>
              <a href="mailto:sales@pabandi.com" className="w-full text-center py-4 rounded-xl font-bold border border-white/20 text-white hover:bg-white/5 transition-colors">Contact Sales →</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Registration Form ───────────────────────────────────── */}
      <section id="join-form" className="py-32 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Ready to protect your revenue?</h2>
            <p className="text-xl text-slate-400">Join hundreds of businesses globally using Pabandi to eliminate no-shows and run tighter operations.</p>
          </div>

          <div className="bg-[#0f172a] rounded-3xl p-8 md:p-10 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            {error && (
              <div className="mb-6 px-4 py-3 rounded-xl text-sm font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 relative z-10">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">Business Name</label>
                <input name="businessName" value={form.businessName} onChange={handleChange}
                  placeholder="e.g. The Corner Cafe"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">Your Full Name</label>
                <input name="ownerName" value={form.ownerName} onChange={handleChange}
                  placeholder="Jane Doe"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">Phone Number</label>
                  <input name="phone" value={form.phone} onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">Email Address</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="you@business.com"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">Category</label>
                  <select name="category" value={form.category} onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none">
                    <option value="" disabled>Select...</option>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">Region</label>
                  <select name="country" value={form.country} onChange={handleChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none">
                    <option value="United States">🇺🇸 North America</option>
                    <option value="Europe">🇪🇺 Europe</option>
                    <option value="Asia">🌏 Asia Pacific</option>
                    <option value="Global">🌍 Global / Multiple</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">Password</label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">Confirm Password</label>
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat password"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-xl text-lg font-bold bg-white text-black hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] mt-4">
                {loading ? 'Processing...' : 'Register Your Business →'}
              </button>
              
              <div className="text-center mt-4">
                 <span className="text-slate-500 text-sm">Need a custom enterprise plan? <a href="mailto:sales@pabandi.com" className="text-white font-bold hover:underline">Request a Demo</a></span>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h4 className="font-bold text-white mb-4">Pabandi</h4>
            <p className="text-slate-400 text-sm leading-relaxed">AI-powered reservations with smart no-show prevention and Web3 loyalty rewards. Built for global scale.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Business</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/business/join" className="hover:text-white transition-colors">Overview</Link></li>
              <li><Link to="/business/join" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link to="/business/join" className="hover:text-white transition-colors">$PAB Rewards</Link></li>
              <li><Link to="/business/join" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><a href="mailto:sales@pabandi.com" className="hover:text-white transition-colors">Request Demo</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Customer</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/" className="hover:text-white transition-colors">Overview</Link></li>
              <li><Link to="/web3" className="hover:text-white transition-colors">PAB Tokens</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Sign Up</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© 2026 Pabandi Technologies. All rights reserved.</p>
          <p>Built for Global SMEs 🌍</p>
        </div>
      </footer>
    </div>
  );
}
