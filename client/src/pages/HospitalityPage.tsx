import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BuildingOffice2Icon,
  ShieldCheckIcon,
  BoltIcon,
  StarIcon,
  CheckIcon,
  ArrowUpRightIcon,
  GlobeAltIcon,
  SparklesIcon,
  LockClosedIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import PropertyConnectWizard from '../components/PropertyConnectWizard';

// ─── Property Type Cards ──────────────────────────────────────────────────────
const PROPERTY_TYPES = [
  { icon: '🏨', label: 'Hotels & Resorts', desc: 'Full-service hotels, boutique properties, and luxury resorts.' },
  { icon: '🏡', label: 'Guesthouses & B&Bs', desc: 'Independent guesthouses, bed-and-breakfasts, and family stays.' },
  { icon: '🕌', label: 'Riads & Heritage', desc: 'Traditional riads, heritage havelis, and cultural properties.' },
  { icon: '⛺', label: 'Safari & Camps', desc: 'Eco-camps, glamping sites, and safari lodges.' },
  { icon: '🏄', label: 'Experiences', desc: 'Tours, water sports, cooking classes, and adventure activities.' },
  { icon: '🏢', label: 'Serviced Apartments', desc: 'Short-term rentals and corporate serviced accommodation.' },
];

// ─── Partner PMS Logos ────────────────────────────────────────────────────────
const PMS_PARTNERS = [
  { name: 'Beds24', url: 'https://beds24.com', badge: 'OPEN API', badgeColor: '#10b981' },
  { name: 'Cloudbeds', url: 'https://cloudbeds.com', badge: 'OAUTH', badgeColor: '#6366f1' },
  { name: 'Lodgify', url: 'https://lodgify.com', badge: 'REST API', badgeColor: '#f59e0b' },
  { name: 'Mews', url: 'https://mews.com', badge: 'ENTERPRISE', badgeColor: '#8b5cf6' },
  { name: 'Manual/Custom', url: '#', badge: 'WEBHOOK', badgeColor: '#64748b' },
];

// ─── How It Works Steps ───────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: '01',
    icon: GlobeAltIcon,
    title: 'Connect Your PMS',
    desc: 'Link Pabandi to your Beds24, Cloudbeds, or Lodgify account in under 3 minutes. We register a secure webhook with your PMS — no code changes required.',
    color: '#6366f1',
  },
  {
    step: '02',
    icon: LockClosedIcon,
    title: 'Deposits Auto-Escrow',
    desc: 'When a guest books, Pabandi automatically locks the deposit in a Solana smart contract. Funds are held trustlessly — no chargebacks, no disputes.',
    color: '#f0b429',
  },
  {
    step: '03',
    icon: BoltIcon,
    title: 'Instant Release + $PAB Rewards',
    desc: 'On checkout, the deposit releases instantly to your property. The guest earns 50 $PAB tokens per night — redeemable for discounts on future stays.',
    color: '#10b981',
  },
];

// ─── FAQ Items ────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Do I need to change my booking process?',
    a: 'No. Pabandi sits silently behind your existing PMS. Your guests book exactly as before — Pabandi intercepts the webhook and handles escrow automatically.',
  },
  {
    q: 'What happens when a guest no-shows?',
    a: 'The escrow smart contract automatically forfeits: 80% of the deposit goes to your property, 20% to the Pabandi treasury. No manual follow-up required.',
  },
  {
    q: 'What about cancellations within policy?',
    a: "Cancellations with more than 24 hours' notice trigger a full refund. Late cancellations (< 24h before check-in) are treated as no-shows.",
  },
  {
    q: 'What currencies are supported?',
    a: 'We support USD via Solana (USDC), PayPal, Alibaba Pay, and Binance Pay. All deposits are priced in USD and settled on Solana for trustless escrow.',
  },
  {
    q: 'Is this Sharia-compliant for Muslim-majority markets?',
    a: 'Yes. The escrow mechanism does not charge interest. Guest funds are held, not lent. See our Halal Staking documentation for more details.',
  },
];

export default function HospitalityPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ background: '#0a0f1a', color: '#e8edf2' }} className="min-h-screen pb-24 md:pb-16 font-body">

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-24 px-4 text-center"
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(99, 102, 241, 0.12) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(240, 180, 41, 0.08) 0%, transparent 50%)',
        }}
      >
        {/* Floating ambient blobs */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full opacity-8 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f0b429, transparent)' }} />

        <div className="max-w-4xl mx-auto relative z-10">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border mb-6"
            style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}
          >
            <BuildingOffice2Icon className="h-3.5 w-3.5" />
            Hospitality & Experiences Vertical
          </span>

          <h1 className="font-headline text-4xl md:text-6xl font-black leading-tight tracking-tight text-white mt-2">
            Trustless Deposits for<br />
            <span style={{ background: 'linear-gradient(135deg, #f0b429, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Hotels &amp; Experiences
            </span>
          </h1>

          <p className="text-sm md:text-base text-on-surface-variant mt-6 max-w-2xl mx-auto leading-relaxed">
            Connect your existing PMS (Beds24, Cloudbeds, Lodgify) to Pabandi's Solana escrow layer.
            Every booking deposit auto-locks on-chain. No-shows are enforced automatically.
            Guests earn $PAB rewards for every night they actually show up.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <button
              id="hospitality-connect-btn"
              onClick={() => setShowWizard(true)}
              className="btn-primary px-8 py-3.5 text-sm font-bold flex items-center gap-2 justify-center"
            >
              <BoltIcon className="h-4 w-4" />
              Connect Your Property
            </button>
            <Link to="/pricing" className="btn-secondary px-8 py-3.5 text-sm font-bold flex items-center gap-2 justify-center">
              View Pricing
              <ArrowUpRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap gap-6 justify-center mt-10 text-xs text-on-surface-variant">
            {['No chargebacks', 'Instant settlement', 'Sharia-compliant', '50 $PAB per night'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* ─── Stats Banner ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 mb-16">
          {[
            { value: '$0', label: 'Chargeback risk', sub: 'Escrow-protected' },
            { value: '< 3 min', label: 'Setup time', sub: 'No code required' },
            { value: '50 PAB', label: 'Per night rewarded', sub: 'Guest loyalty' },
            { value: '80/20', label: 'No-show split', sub: 'Property / Treasury' },
          ].map(({ value, label, sub }) => (
            <div key={label}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
            >
              <p className="font-headline text-2xl font-black text-white">{value}</p>
              <p className="text-xs font-bold text-white mt-1">{label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* ─── How It Works ────────────────────────────────────────────────── */}
        <section className="mb-20">
          <div className="text-center mb-10">
            <h2 className="font-headline text-2xl md:text-3xl font-black text-white">How It Works</h2>
            <p className="text-xs text-on-surface-variant mt-2">Three steps between your PMS and trustless escrow protection.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc, color }) => (
              <div key={step}
                className="relative rounded-2xl p-6 border flex flex-col gap-4"
                style={{
                  background: `linear-gradient(135deg, ${color}0a 0%, var(--color-surface-raised) 100%)`,
                  borderColor: `${color}30`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}18`, border: `1.5px solid ${color}35` }}
                  >
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <span className="text-[10px] font-black tracking-widest uppercase" style={{ color }}>{step}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{title}</h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Flow Diagram */}
          <div className="mt-8 p-5 rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
            <div className="flex items-center justify-between gap-2 min-w-[520px]">
              {[
                { label: 'Guest Books', icon: '📅', sub: 'Via your PMS' },
                { label: '→', icon: '', sub: '' },
                { label: 'Webhook Fires', icon: '⚡', sub: 'Beds24/Cloudbeds' },
                { label: '→', icon: '', sub: '' },
                { label: 'Escrow Opens', icon: '🔐', sub: 'Solana on-chain' },
                { label: '→', icon: '', sub: '' },
                { label: 'Checkout', icon: '✅', sub: 'Auto-release' },
                { label: '→', icon: '', sub: '' },
                { label: '$PAB Minted', icon: '🪙', sub: 'Guest reward' },
              ].map(({ label, icon, sub }, i) => (
                label === '→'
                  ? <span key={i} className="text-outline-variant text-xl shrink-0">→</span>
                  : (
                    <div key={i} className="flex flex-col items-center text-center shrink-0">
                      <span className="text-2xl mb-1">{icon}</span>
                      <p className="text-[11px] font-bold text-white">{label}</p>
                      <p className="text-[9px] text-slate-400">{sub}</p>
                    </div>
                  )
              ))}
            </div>
          </div>
        </section>

        {/* ─── Property Types ──────────────────────────────────────────────── */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl md:text-3xl font-black text-white">Built for Every Hospitality Type</h2>
            <p className="text-xs text-on-surface-variant mt-2 max-w-lg mx-auto">
              From a single-room guesthouse in Lahore to a safari camp in East Africa — if you take bookings, Pabandi protects you.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PROPERTY_TYPES.map(({ icon, label, desc }) => (
              <div key={label}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-primary/40 transition-colors group cursor-pointer"
              >
                <span className="text-3xl mb-3 block">{icon}</span>
                <h3 className="text-sm font-bold text-white mb-1 group-hover:text-primary transition-colors">{label}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── PMS Integrations ────────────────────────────────────────────── */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl md:text-3xl font-black text-white">Integrates With Your Existing Software</h2>
            <p className="text-xs text-on-surface-variant mt-2">Connect Pabandi to your PMS in minutes, not months.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {PMS_PARTNERS.map(({ name, badge, badgeColor }) => (
              <div key={name}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-white/20 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <GlobeAltIcon className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-white text-center leading-tight">{name}</p>
                <span
                  className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: `${badgeColor}20`, color: badgeColor, border: `1px solid ${badgeColor}40` }}
                >
                  {badge}
                </span>
              </div>
            ))}
          </div>

          {/* API Architecture note */}
          <div
            className="mt-6 p-4 rounded-xl border flex items-start gap-3"
            style={{ background: 'rgba(99, 102, 241, 0.04)', borderColor: 'rgba(99, 102, 241, 0.2)' }}
          >
            <ShieldCheckIcon className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">Webhook-based, zero polling</p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                Pabandi registers a signed webhook endpoint directly in your PMS. When a booking is created, modified, or cancelled, the PMS pushes the event to us instantly — no scheduled polling, no delays. HMAC-SHA256 signatures verify every incoming event.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Escrow Detail ───────────────────────────────────────────────── */}
        <section className="mb-20">
          <div
            className="rounded-2xl p-6 md:p-8 border"
            style={{
              background: 'linear-gradient(135deg, rgba(240, 180, 41, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)',
              borderColor: 'rgba(240, 180, 41, 0.25)',
            }}
          >
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#f0b429] border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded">
                  Smart Contract Layer
                </span>
                <h2 className="font-headline text-xl md:text-2xl font-black text-white mt-3 mb-4">
                  PabandiEscrow.sol — On-chain Hospitality Protection
                </h2>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                  Every hospitality deposit is held in a trustless Solana smart contract. Neither Pabandi nor the property can move funds arbitrarily — only verified booking events from the PMS trigger release, refund, or forfeit.
                </p>

                <div className="space-y-3">
                  {[
                    { event: 'Guest Checks Out ✅', action: 'releaseToProperty()', result: '100% → Property', color: '#10b981' },
                    { event: 'Cancelled >24h Before ⏱️', action: 'refundCustomer()', result: '100% → Guest', color: '#6366f1' },
                    { event: 'No-Show / Late Cancel ❌', action: 'forfeitNoShow()', result: '80% → Property · 20% → Treasury', color: '#f59e0b' },
                  ].map(({ event, action, result, color }) => (
                    <div key={event} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white">{event}</p>
                        <p className="text-[10px] font-mono text-slate-400">{action}</p>
                      </div>
                      <span className="text-[10px] font-bold" style={{ color }}>{result}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* $PAB Rewards Panel */}
              <div className="md:w-60 shrink-0">
                <div className="bg-white/5 rounded-2xl border border-white/10 p-5 h-full flex flex-col gap-4">
                  <div className="text-center">
                    <span className="text-4xl">🪙</span>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#f0b429] mt-2">Guest Loyalty</p>
                    <p className="font-headline text-3xl font-black text-white mt-1">50 PAB</p>
                    <p className="text-[10px] text-slate-400">per night stayed</p>
                  </div>
                  <hr className="border-outline-variant/20" />
                  <div className="space-y-2">
                    {[
                      '1 night = 50 PAB',
                      '3 nights = 150 PAB',
                      '7 nights = 350 PAB',
                      'Redeem for discounts',
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <StarIcon className="h-3 w-3 text-[#f0b429] shrink-0" />
                        <span className="text-[11px] text-slate-400">{item}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowWizard(true)}
                    className="btn-primary w-full py-2.5 text-xs font-bold mt-auto"
                  >
                    Activate for My Property
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Pricing Callout ─────────────────────────────────────────────── */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl md:text-3xl font-black text-white">Hospitality Add-On Pricing</h2>
            <p className="text-xs text-slate-400 mt-2">Layer on top of any Pabandi plan.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: 'Starter Hospitality',
                price: 'Free',
                sub: 'Up to 20 bookings/mo',
                features: ['1 property', 'Beds24 integration', 'Manual escrow trigger', '5% escrow commission'],
                cta: 'Start Free',
                highlight: false,
              },
              {
                name: 'Growth Hospitality',
                price: '$19',
                sub: '/ month add-on',
                features: ['Up to 5 properties', 'Beds24 + Cloudbeds', 'Auto-webhook escrow', '2.5% escrow commission', '$PAB guest rewards'],
                cta: '1 Month Free Trial',
                highlight: true,
              },
              {
                name: 'Enterprise Hospitality',
                price: 'Custom',
                sub: 'Per property volume',
                features: ['Unlimited properties', 'All PMS providers', 'White-label SDK', '1% escrow commission', 'Dedicated support', 'Halal-certified escrow'],
                cta: 'Contact Sales',
                highlight: false,
              },
            ].map(({ name, price, sub, features, cta, highlight }) => (
              <div
                key={name}
                className="rounded-2xl p-6 flex flex-col justify-between border"
                style={highlight ? {
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(255, 255, 255, 0.05) 100%)',
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                } : {
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                {highlight && (
                  <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500 text-white px-2 py-0.5 rounded-full self-start mb-3">
                    Most Popular
                  </span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">{name}</h3>
                  <div className="my-4">
                    <span className="font-headline text-3xl font-black text-white">{price}</span>
                    <span className="text-xs text-slate-400 ml-1">{sub}</span>
                  </div>
                  <hr className="border-outline-variant/20 my-3" />
                  <ul className="space-y-2.5">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[11px] text-slate-400">
                        <CheckIcon className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => cta !== 'Contact Sales' ? setShowWizard(true) : undefined}
                  className={`w-full py-2.5 text-xs font-bold mt-6 rounded-xl transition-colors ${
                    highlight ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ─── FAQ ─────────────────────────────────────────────────────────── */}
        <section className="mb-20 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-headline text-xl md:text-2xl font-black text-white">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map(({ q, a }, i) => (
              <div
                key={i}
                className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden"
              >
                <button
                  id={`faq-${i}`}
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-xs font-bold text-white pr-4">{q}</span>
                  {openFaq === i
                    ? <ChevronUpIcon className="h-4 w-4 text-on-surface-variant shrink-0" />
                    : <ChevronDownIcon className="h-4 w-4 text-on-surface-variant shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA Banner ──────────────────────────────────────────────────── */}
        <section className="mb-16">
          <div
            className="rounded-3xl p-8 md:p-12 text-center border"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(240, 180, 41, 0.06) 100%)',
              borderColor: 'rgba(99, 102, 241, 0.3)',
            }}
          >
            <SparklesIcon className="h-8 w-8 text-indigo-400 mx-auto mb-4" />
            <h2 className="font-headline text-2xl md:text-3xl font-black text-white">
              Ready to Protect Your Property?
            </h2>
            <p className="text-sm text-on-surface-variant mt-3 max-w-lg mx-auto leading-relaxed">
              Join hotels and guesthouses across South Asia and the Middle East who use Pabandi to eliminate no-shows and reward loyal guests.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <button
                id="hospitality-cta-btn"
                onClick={() => setShowWizard(true)}
                className="btn-primary px-8 py-3.5 text-sm font-bold"
              >
                Connect Your Property — Free
              </button>
              <Link to="/contact" className="btn-secondary px-8 py-3.5 text-sm font-bold">
                Talk to Sales
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ─── Property Connect Wizard Modal ───────────────────────────────── */}
      {showWizard && (
        <PropertyConnectWizard onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
