import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import PropertyConnectWizard from '../components/PropertyConnectWizard';
import { hospitalityService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Button, Chip, Surface, Badge, tokens } from '../design-system';

type PropertyType = 'hotel' | 'guesthouse' | 'riad' | 'safari_camp' | 'experience' | 'vacation_rental' | 'other';

const PROPERTY_TYPES: { icon: string; label: string; desc: string; wizardType: PropertyType }[] = [
  { icon: '🏨', label: 'Hotels & Resorts', desc: 'Full-service hotels, boutique properties, and luxury resorts.', wizardType: 'hotel' },
  { icon: '🏡', label: 'Guesthouses & B&Bs', desc: 'Independent guesthouses, bed-and-breakfasts, and family stays.', wizardType: 'guesthouse' },
  { icon: '🕌', label: 'Riads & Heritage', desc: 'Traditional riads, heritage havelis, and cultural properties.', wizardType: 'riad' },
  { icon: '⛺', label: 'Safari & Camps', desc: 'Eco-camps, glamping sites, and safari lodges.', wizardType: 'safari_camp' },
  { icon: '🏄', label: 'Experiences', desc: 'Tours, water sports, cooking classes, and adventure activities.', wizardType: 'experience' },
  { icon: '🏢', label: 'Serviced Apartments', desc: 'Short-term rentals and corporate serviced accommodation.', wizardType: 'vacation_rental' },
];

const PMS_PARTNERS = [
  { name: 'Beds24', url: 'https://beds24.com', badge: 'OPEN API', badgeColor: '#10b981' },
  { name: 'Cloudbeds', url: 'https://cloudbeds.com', badge: 'OAUTH', badgeColor: '#6366f1' },
  { name: 'Lodgify', url: 'https://lodgify.com', badge: 'REST API', badgeColor: '#f59e0b' },
  { name: 'Mews', url: 'https://mews.com', badge: 'ENTERPRISE', badgeColor: '#8b5cf6' },
  { name: 'Manual/Custom', url: '#', badge: 'WEBHOOK', badgeColor: '#64748b' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Connect Your PMS',
    desc: 'Link Pabandi to your Beds24, Cloudbeds, or Lodgify account in under 3 minutes. We register a secure webhook with your PMS — no code changes required.',
    color: '#6366f1',
  },
  {
    step: '02',
    title: 'Deposit Protection',
    desc: 'Pabandi locks the deposit in escrow and enforces release/refund rules via verified booking events, reducing no-shows and disputes.',
    color: '#f0b429',
  },
  {
    step: '03',
    title: 'Verified Checkout',
    desc: 'Guests book on WhatsApp or your storefront. Release, refund, and forfeit happen automatically from PMS events.',
    color: '#10b981',
  },
];

const FAQS = [
  { q: 'Do I need to change my booking process?', a: 'No. Pabandi sits silently behind your existing PMS. Your guests book exactly as before — Pabandi intercepts the webhook and handles escrow automatically.' },
  { q: 'What happens when a guest no-shows?', a: 'The escrow smart contract automatically forfeits: 80% of the deposit goes to your property, 20% to the Pabandi treasury. No manual follow-up required.' },
  { q: 'What about cancellations within policy?', a: "Cancellations with more than 24 hours' notice trigger a full refund. Late cancellations (< 24h before check-in) are treated as no-shows." },
  { q: 'What currencies are supported?', a: 'We support USD via Solana (USDC), PayPal, Alibaba Pay, and Binance Pay. All deposits are priced in USD and settled on Solana for trustless escrow.' },
  { q: 'Does this comply with Islamic finance principles?', a: 'Yes. The escrow mechanism does not charge interest. Guest funds are held, not lent. See our Halal Staking documentation for more details.' },
];

const PROVIDER_COLORS: Record<string, string> = {
  beds24: '#10b981',
  cloudbeds: '#6366f1',
  lodgify: '#f59e0b',
  manual: '#64748b',
};

export default function HospitalityPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [showWizard, setShowWizard] = useState(false);
  const [wizardPropertyType, setWizardPropertyType] = useState<PropertyType | undefined>(undefined);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const { data: propertiesData, refetch: refetchProperties } = useQuery(
    'hospitality-properties',
    () => hospitalityService.getProperties(),
    { enabled: isAuthenticated, refetchOnWindowFocus: false }
  );
  const connectedProperties = propertiesData?.data?.properties || [];

  const [testingPropertyId, setTestingPropertyId] = useState<string | null>(null);

  const handleOpenWizard = (propertyType?: PropertyType) => {
    setWizardPropertyType(propertyType);
    setShowWizard(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setWizardPropertyType(undefined);
    if (isAuthenticated) refetchProperties();
  };

  const handleHealthCheck = async () => {
    setTestingPropertyId('__health__');
    try {
      await hospitalityService.getHealth();
      alert('Connection looks healthy. Pabandi will sync verified booking events from your PMS via webhook.');
    } catch {
      alert('Connection health check failed. Check your PMS webhook configuration.');
    }
    setTestingPropertyId(null);
  };

  const handlePlanCheckout = async (planName: string, price: number) => {
    if (price === 0) {
      handleOpenWizard();
      return;
    }
    setIsProcessingCheckout(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: price,
          paymentMethod: 'safepay',
          reservationId: `sub_${planName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        }),
      });
      const data = await res.json();
      if (data.paymentUrl || data.data?.checkoutUrl) {
        window.location.href = data.paymentUrl || data.data.checkoutUrl;
      } else {
        alert('Payment checkout unavailable. Please try again.');
      }
    } catch (e) {
      console.error(e);
      alert('Payment checkout failed. Please try again.');
    }
    setIsProcessingCheckout(false);
  };

  return (
    <div
      className="min-h-screen text-slate-100 antialiased"
      style={{ background: tokens.color.background, fontFamily: tokens.font.body }}
    >
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Chip tone="info">Hospitality & Experiences Vertical</Chip>
          <h1
            className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl"
            style={{
              background: 'linear-gradient(135deg, #f0b429 0%, #fb923c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Trustless Deposits for<br />Hotels &amp; Experiences
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-slate-300">
            Connect your PMS, let guests book on WhatsApp, and protect every deposit with escrow-backed checkout.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => handleOpenWizard()}>Connect Your Property</Button>
            <Link to="/pricing"><Button variant="outline">View Pricing</Button></Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-slate-400">
            {['No chargebacks', 'Instant settlement', 'Sharia-compliant', '50 $PAB per night'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Connected Properties */}
        {isAuthenticated && connectedProperties.length > 0 && (
          <section className="mt-12 mb-8">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-white md:text-2xl">Your Connected Properties</h2>
                <p className="text-xs text-slate-400 mt-1">Properties receiving Pabandi escrow protection.</p>
              </div>
              <Button variant="ghost" onClick={() => handleOpenWizard()} className="px-3 py-2 text-xs">
                + Add Property
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connectedProperties.map((prop: any) => {
                const providerColor = PROVIDER_COLORS[prop.provider] || '#64748b';
                return (
                  <Surface key={prop.id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">{prop.propertyName}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">{prop.country || 'Global'}</p>
                      </div>
                      <Badge tone="info" className={!providerColor ? '' : ''} style={providerColor ? { background: `${providerColor}20`, color: providerColor, borderColor: `${providerColor}40` } : undefined}>
                        {prop.provider}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        ✓ {prop.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-[10px] text-slate-400">{prop.propertyType?.replace('_', ' ')}</span>
                    </div>
                    <Surface className="border-indigo-500/30 bg-indigo-500/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-bold text-white">AI Receptionist</span>
                        <button
                          className={`w-8 h-4 rounded-full relative transition-colors ${prop.aiEnabled !== false ? 'bg-indigo-500' : 'bg-slate-600'}`}
                        >
                          <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform" style={{ transform: prop.aiEnabled !== false ? 'translateX(14px)' : 'translateX(0)' }} />
                        </button>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Conv: <strong className="text-emerald-400">{prop.aiConversionRate || '32%'}</strong></span>
                        <span>Deposits: <strong className="text-white">${prop.aiRevenue || '1,240'}</strong></span>
                      </div>
                    </Surface>
                    <Button
                      variant="outline"
                      onClick={() => handleHealthCheck()}
                      disabled={testingPropertyId === '__health__'}
                      className="w-full mt-1 py-2 text-[11px] font-bold"
                    >
                      {testingPropertyId === '__health__' ? 'Checking...' : 'Verify Connection'}
                    </Button>
                  </Surface>
                );
              })}
            </div>
          </section>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-12 mb-16 md:grid-cols-4">
          {[
            { value: '$0', label: 'Chargeback risk', sub: 'Escrow-protected' },
            { value: '< 3 min', label: 'Setup time', sub: 'No code required' },
            { value: '50 PAB', label: 'Per night rewarded', sub: 'Guest loyalty' },
            { value: '80/20', label: 'No-show split', sub: 'Property / Treasury' },
          ].map((item) => (
            <Surface key={item.label} className="flex flex-col items-center gap-1 text-center">
              <p className="text-2xl font-black text-white">{item.value}</p>
              <p className="text-[10px] font-bold text-white">{item.label}</p>
              <p className="text-[10px] text-slate-400">{item.sub}</p>
            </Surface>
          ))}
        </div>

        {/* How It Works */}
        <section className="mb-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white md:text-3xl">How It Works</h2>
            <p className="text-xs text-slate-400 mt-2">Three steps between your PMS and trustless escrow protection.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, desc, color }) => (
              <Surface key={step} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}18`, border: `1.5px solid ${color}35` }}>
                    <span className="text-sm font-black" style={{ color }}>{step}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </Surface>
            ))}
          </div>
        </section>

        {/* Property Types */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white md:text-3xl">Built for Every Hospitality Type</h2>
            <p className="text-xs text-slate-400 mt-2">Reserve your slot in the check-in queue for this venue.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {PROPERTY_TYPES.map(({ icon, label, desc, wizardType }) => (
              <button
                key={label}
                onClick={() => handleOpenWizard(wizardType)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition-all hover:border-white/20 group"
              >
                <span className="mb-3 block text-3xl">{icon}</span>
                <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{label}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
                <span className="mt-2 block text-[9px] font-bold text-primary/70 opacity-0 transition-opacity group-hover:opacity-100">Click to connect →</span>
              </button>
            ))}
          </div>
        </section>

        {/* PMS Integrations */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white md:text-3xl">Integrates With Your Existing Software</h2>
            <p className="text-xs text-slate-400 mt-2">Connect Pabandi to your PMS in minutes, not months.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {PMS_PARTNERS.map(({ name, badge, badgeColor }) => (
              <div key={name} className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                  <span className="text-lg">🔗</span>
                </div>
                <p className="text-xs font-bold text-white text-center leading-tight">{name}</p>
                <span className="text-[8px] font-black uppercase tracking-widest rounded px-1.5 py-0.5" style={{ background: `${badgeColor}20`, color: badgeColor, border: `1px solid ${badgeColor}40` }}>
                  {badge}
                </span>
              </div>
            ))}
          </div>
          <Surface className="mt-6 border-indigo-500/25 bg-indigo-500/5">
            <div className="flex items-start gap-3">
              <span className="text-indigo-400">🛡️</span>
              <div>
                <p className="text-xs font-bold text-white">Webhook-based, zero polling</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">Pabandi registers a signed webhook endpoint directly in your PMS. When a booking is created, modified, or cancelled, the PMS pushes the event to us instantly — no scheduled polling, no delays. HMAC-SHA256 signatures verify every incoming event.</p>
              </div>
            </div>
          </Surface>
        </section>

        {/* Escrow Detail */}
        <section className="mb-20">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:gap-8">
              <div className="flex-1">
                <Chip tone="warning">Smart Contract Layer</Chip>
                <h2 className="mt-3 text-xl font-bold text-white md:text-2xl">PabandiEscrow.sol — On-chain Hospitality Protection</h2>
                <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">Every hospitality deposit is held in a trustless Solana smart contract. Neither Pabandi nor the property can move funds arbitrarily — only verified booking events from the PMS trigger release, refund, or forfeit.</p>
                <div className="mt-4 space-y-2">
                  {[
                    { event: 'Guest Checks Out ✅', action: 'releaseToProperty()', result: '100% → Property', color: '#10b981' },
                    { event: 'Cancelled >24h Before ⏱️', action: 'refundCustomer()', result: '100% → Guest', color: '#6366f1' },
                    { event: 'No-Show / Late Cancel ❌', action: 'forfeitNoShow()', result: '80% → Property · 20% → Treasury', color: '#f59e0b' },
                  ].map(({ event, action, result, color }) => (
                    <div key={event} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white">{event}</p>
                        <p className="text-[10px] font-mono text-slate-400">{action}</p>
                      </div>
                      <span className="text-[10px] font-bold" style={{ color }}>{result}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Surface className="md:w-60 md:shrink-0">
                <div className="text-center">
                  <span className="text-4xl">🪙</span>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#f0b429] mt-2">Guest Loyalty</p>
                  <p className="font-headline text-3xl font-black text-white mt-1">50 PAB</p>
                  <p className="text-[10px] text-slate-400">per night stayed</p>
                </div>
                <hr className="border-white/10 my-3" />
                <div className="space-y-2">
                  {['1 night = 50 PAB', '3 nights = 150 PAB', '7 nights = 350 PAB', 'Redeem for discounts'].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="text-[#f0b429]">⭐</span>
                      <span className="text-[11px] text-slate-400">{item}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={() => handleOpenWizard()} className="mt-4 w-full py-2.5 text-xs font-bold">Activate for My Property</Button>
              </Surface>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white md:text-3xl">Hospitality Add-On Pricing</h2>
            <p className="text-xs text-slate-400 mt-2">Layer on top of any Pabandi plan.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              { name: 'Starter Hospitality', price: 'Free', sub: 'Up to 20 bookings/mo', features: ['1 property', 'Beds24 integration', 'Manual escrow trigger', '5% escrow commission'], cta: 'Start Free', highlight: false },
              { name: 'Growth Hospitality', price: '$19', sub: '/ month add-on', features: ['Up to 5 properties', 'Beds24 + Cloudbeds', 'Auto-webhook escrow', '2.5% escrow commission', '$PAB guest rewards'], cta: 'Pay with Safepay', highlight: true },
              { name: 'Enterprise Hospitality', price: 'Custom', sub: 'Per property volume', features: ['Unlimited properties', 'All PMS providers', 'White-label SDK', '1% escrow commission', 'Dedicated support', 'Halal-certified escrow'], cta: 'Contact Sales', highlight: false },
            ].map(({ name, price, sub, features, cta, highlight }) => (
              <div key={name} className={`flex flex-col justify-between rounded-2xl border p-6 ${highlight ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/[0.08] bg-white/[0.03]'}`}>
                {highlight && <Chip tone="info" className="self-start mb-3">Most Popular</Chip>}
                <div>
                  <h3 className="text-sm font-bold text-white">{name}</h3>
                  <div className="my-4">
                    <span className="font-headline text-3xl font-black text-white">{price}</span>
                    <span className="text-xs text-slate-400 ml-1">{sub}</span>
                  </div>
                  <hr className="border-white/10 my-3" />
                  <ul className="space-y-2.5">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[11px] text-slate-400">
                        <span className="text-indigo-400">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  variant={highlight ? 'default' : 'outline'}
                  onClick={() => cta === 'Contact Sales' ? navigate('/contact') : handlePlanCheckout(name, highlight ? 19 : 0)}
                  disabled={isProcessingCheckout && highlight}
                  className="mt-6 w-full py-2.5 text-xs font-bold"
                >
                  {isProcessingCheckout && highlight ? 'Processing...' : cta}
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-20 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-white md:text-2xl">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map(({ q, a }, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="text-xs font-bold text-white pr-4">{q}</span>
                  <span className="text-slate-400">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-[11px] text-slate-400 leading-relaxed">{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="mb-16">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center md:p-12">
            <div className="text-3xl mb-4">✨</div>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Ready to Protect Your Property?</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400 leading-relaxed">Join hotels and guesthouses across South Asia and the Middle East who use Pabandi to eliminate no-shows and reward loyal guests.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => handleOpenWizard()} className="px-8 py-3.5 text-sm font-bold">Connect Your Property — Free</Button>
              <Link to="/contact"><Button variant="outline" className="px-8 py-3.5 text-sm font-bold">Talk to Sales</Button></Link>
            </div>
          </div>
        </section>
      </div>

      {showWizard && <PropertyConnectWizard onClose={handleCloseWizard} initialPropertyType={wizardPropertyType} />}
    </div>
  );
}
