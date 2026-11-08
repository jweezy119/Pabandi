/**
 * MerchantCompliancePage.tsx — Dual-Currency Pricing (USD & PKR) + Safepay / Payment Underwriting Compliance Hub.
 *
 * Serves both `/pricing` and `/compliance` so customers and payment processor
 * underwriting teams (Safepay, Raast PSO/PSP, Square) can verify:
 *   1. Transparent dual-currency pricing in PKR (Rs.) and USD ($).
 *   2. Clear Refund, Cancellation, and Sulha Dispute Resolution SLAs.
 *   3. Service Delivery & Fulfillment terms.
 *   4. KYC/AML & Prohibited Business disclosures.
 *   5. Ready-to-send Safepay Merchant Approval Verification Packet.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const PRICING_TIERS = [
  {
    name: 'Starter',
    usd: '$0',
    pkr: 'PKR 0',
    cadence: 'forever free',
    escrowFee: '2.5% per escrowed booking or milestone',
    description: 'For independent freelancers, contractors, and solo service providers starting with protected deposits.',
    features: [
      'Up to 10 protected bookings or invoices / month',
      'Interactive AI Swarm Project Simulator (/simulator)',
      'Shareable Client Proposal Links (/p/estimate/:id)',
      'Portable Pabandi Trust Passport & verification badge',
      'Square (USD), Safepay / Raast (PKR), & Solana Pay (USDC)',
    ],
    ctaLabel: 'Start Free Account',
    ctaHref: '/register',
    highlighted: false,
  },
  {
    name: 'Growth Pro',
    usd: '$29',
    pkr: 'PKR 8,000',
    cadence: 'per month',
    escrowFee: '1.5% per escrowed booking or milestone',
    description: 'For salons, clinics, agencies, and home-service businesses eliminating no-shows and scope creep.',
    features: [
      'Unlimited bookings, CRM clients, deals & invoices',
      'Automated No-Show Deposit Capture & Sulha Escrow',
      'Automated Email & WhatsApp client proposal links',
      'Interactive Scope Sliders with 1-Click Milestone Lock',
      'Priority 24-hour payout release upon delivery verification',
    ],
    ctaLabel: 'Get Growth Pro',
    ctaHref: '/register',
    highlighted: true,
  },
  {
    name: 'Business Scale',
    usd: '$99',
    pkr: 'PKR 27,500',
    cadence: 'per month',
    escrowFee: '1.0% per escrowed booking or milestone',
    description: 'For multi-staff service operations, property portfolios, and AI-agent-enabled storefronts.',
    features: [
      'Multi-member team permissions & role-based CRM',
      'Full MCP Server & AI Concierge Booking Integration',
      'Custom milestone templates & automated ledger reconciliation',
      'Dedicated compliance & dispute resolution support',
      'Custom domain & white-label checkout receipts',
    ],
    ctaLabel: 'Contact Sales / Register',
    ctaHref: '/register',
    highlighted: false,
  },
];

const SAFEPAY_APPROVAL_TEMPLATE = `Subject: Merchant Onboarding & Compliance Verification — Pabandi (pabandi.com)

Dear Safepay Onboarding & Compliance Team,

Please find below the complete merchant verification details and live compliance links for Pabandi (https://pabandi.com) to complete our live production account activation:

1. BUSINESS OVERVIEW & NATURE OF SERVICES
- Legal / Brand Name: Pabandi (pabandi.com)
- Category: B2B & B2C SaaS (Service Booking CRM, Invoicing, & Milestone Project Protection)
- How Safepay is Used:
  (a) Monthly SaaS software subscriptions for Pakistani service businesses (PKR 8,000/mo Growth Pro & PKR 27,500/mo Business Scale).
  (b) Service appointment booking deposits and milestone project payments for verified merchants (settled in PKR via Safepay Checkout & Raast).

2. LIVE TRANSPARENT PRICING (IN PKR & USD)
- Pricing & Fee Schedule URL: https://pabandi.com/pricing
- All plans and service fees are displayed transparently in both Pakistani Rupees (PKR / Rs.) and USD ($).

3. REFUND, CANCELLATION & DISPUTE RESOLUTION POLICY
- Compliance & Refund Policy URL: https://pabandi.com/compliance
- Terms of Service URL: https://pabandi.com/terms
- Privacy Policy URL: https://pabandi.com/privacy
- Risk & Escrow Disclosure URL: https://pabandi.com/risk
- Refund SLA: Customers may cancel any appointment at least 24 hours prior to the scheduled time (or prior to Milestone 1 kickoff) for a 100% refund. Approved refunds are processed back to the original payment method within 3–5 business days.
- Dispute Resolution (Sulha): If a service provider fails to deliver agreed milestones, funds are held and reviewed within 72 hours using verified check-in and delivery logs.

4. LIVE INTERACTIVE CHECKOUT DEMO (FOR UNDERWRITING REVIEW)
- Interactive Proposal & Safepay/Raast Checkout Demo: https://pabandi.com/p/estimate/demo
- Public Trust Verification Portal: https://pabandi.com/verify-trust
- Production API Health & Webhook Endpoint: https://api.pabandi.com/health

Please let us know if any additional documents are required to activate our live Safepay production credentials.

Best regards,
Jawad
Founder, Pabandi (https://pabandi.com)`;

export default function MerchantCompliancePage() {
  const location = useLocation();
  const isComplianceFocus = location.pathname.startsWith('/compliance');
  const [currencyView, setCurrencyView] = useState<'BOTH' | 'PKR' | 'USD'>('BOTH');
  const [copiedPacket, setCopiedPacket] = useState(false);

  const handleCopyPacket = () => {
    navigator.clipboard?.writeText(SAFEPAY_APPROVAL_TEMPLATE);
    setCopiedPacket(true);
    window.setTimeout(() => setCopiedPacket(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-[#e2e8f0]">
      {/* Header */}
      <header className="border-b border-white/[0.08] bg-[#0f172a]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-xs font-bold">
                P
              </span>
              PABANDI
            </Link>
            <span className="text-xs text-[#64748b]">•</span>
            <span className="text-xs font-medium text-[#94a3b8]">
              {isComplianceFocus ? 'Merchant Compliance & Underwriting Hub' : 'Transparent Pricing & Compliance'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/p/estimate/demo"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/25 transition-colors"
            >
              ⚡ Live Interactive Proposal Demo
            </Link>
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
            >
              Sign In / Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold">
            🛡️ Verified SaaS, Booking Deposit & Milestone Escrow Platform
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            {isComplianceFocus
              ? 'Merchant Compliance, Refund Policy & Pricing Schedule'
              : 'Simple, Transparent Pricing in USD ($) & PKR (Rs.)'}
          </h1>
          <p className="text-sm sm:text-base text-[#94a3b8]">
            Pabandi powers no-show-proof service bookings, interactive AI project estimates, and milestone-based payment protection across Square (USD), Safepay / Raast (PKR), and Solana Pay (USDC).
          </p>

          {/* Currency selector */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#0f172a] border border-white/10">
            {(['BOTH', 'PKR', 'USD'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCurrencyView(mode)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  currencyView === mode
                    ? 'bg-indigo-600 text-white'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                {mode === 'BOTH' ? '🌍 Show USD + PKR' : mode === 'PKR' ? '🇵🇰 PKR (Rs.)' : '🇺🇸 USD ($)'}
              </button>
            ))}
          </div>
        </section>

        {/* Pricing Grid */}
        <section id="pricing" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-6 flex flex-col justify-between border ${
                tier.highlighted
                  ? 'border-indigo-500 bg-gradient-to-b from-[#1e1b4b]/60 to-[#0f172a] shadow-xl shadow-indigo-600/10'
                  : 'border-white/10 bg-[#0f172a]'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-white">{tier.name}</h2>
                  {tier.highlighted && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white uppercase">
                      Most Popular
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {(currencyView === 'BOTH' || currencyView === 'USD') && (
                      <span className="text-3xl font-black text-white">{tier.usd}</span>
                    )}
                    {currencyView === 'BOTH' && <span className="text-lg text-[#64748b]">/</span>}
                    {(currencyView === 'BOTH' || currencyView === 'PKR') && (
                      <span className="text-2xl font-extrabold text-emerald-300">{tier.pkr}</span>
                    )}
                    <span className="text-xs text-[#94a3b8]">{tier.cadence}</span>
                  </div>
                  <div className="mt-1.5 inline-block px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-indigo-200 font-medium">
                    Transaction Fee: {tier.escrowFee}
                  </div>
                </div>

                <p className="text-xs text-[#94a3b8] leading-relaxed">{tier.description}</p>

                <ul className="space-y-2.5 pt-2 border-t border-white/[0.08]">
                  {tier.features.map((feat, i) => (
                    <li key={i} className="text-xs text-[#cbd5e1] flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.06]">
                <Link
                  to={tier.ctaHref}
                  className={`block w-full py-3 px-4 rounded-xl text-center text-xs font-extrabold transition-colors ${
                    tier.highlighted
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-white/[0.07] hover:bg-white/[0.12] text-white'
                  }`}
                >
                  {tier.ctaLabel}
                </Link>
              </div>
            </div>
          ))}
        </section>

        {/* Merchant Compliance & Underwriting Standards Section */}
        <section id="compliance" className="rounded-2xl border border-white/10 bg-[#0f172a] p-6 sm:p-8 space-y-8">
          <div className="border-b border-white/10 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Payment Processor & PSP Compliance Disclosure
              </span>
              <h2 className="text-2xl font-extrabold text-white mt-1">
                Merchant Terms, Refund Policy & Escrow Fulfillment Rules
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2 rounded-xl">
              <span>✓ Safepay / Raast PKR & Square USD Compliant</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Goods & Services Sold */}
            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#020617]/70 space-y-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>1. Nature of Goods & Services Sold</span>
              </h3>
              <p className="text-xs text-[#94a3b8] leading-relaxed">
                Pabandi operates a B2B/B2C Software-as-a-Service (SaaS) platform providing CRM, appointment scheduling, interactive project estimation, and milestone-gated invoice collection for verified service businesses. All transactions correspond to either (a) software subscription plans or (b) documented service booking deposits and project milestone contracts.
              </p>
            </div>

            {/* 2. Refund & Cancellation Policy */}
            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#020617]/70 space-y-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>2. Refund & Cancellation Policy (SLA)</span>
              </h3>
              <ul className="text-xs text-[#94a3b8] space-y-1.5 leading-relaxed">
                <li>
                  • <strong className="text-white">24-Hour Free Cancellation:</strong> Bookings cancelled at least 24 hours before the scheduled appointment (or before Milestone 1 kickoff) receive a <strong className="text-emerald-300">100% full refund</strong>.
                </li>
                <li>
                  • <strong className="text-white">Refund Processing Time:</strong> Approved refunds are credited back to the original payment method (Safepay Card/Raast bank account or Square card) within <strong className="text-white">3–5 business days</strong>.
                </li>
                <li>
                  • <strong className="text-white">SaaS Subscriptions:</strong> Businesses may cancel monthly subscriptions at any time; unused pro-rata disputes requested within 7 days of billing are refunded in full.
                </li>
              </ul>
            </div>

            {/* 3. Sulha Dispute & Milestone Release */}
            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#020617]/70 space-y-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>3. Delivery, Fulfillment & Dispute Resolution (Sulha)</span>
              </h3>
              <p className="text-xs text-[#94a3b8] leading-relaxed">
                Digital SaaS access and escrow receipts are issued instantaneously upon payment. For service bookings and project milestones, funds are held until customer check-in or milestone sign-off. If a provider fails to deliver, the buyer may open a Sulha dispute directly from their receipt; neutral arbitration reviews check-in logs and resolves claims within <strong className="text-white">72 hours</strong>.
              </p>
            </div>

            {/* 4. KYC, AML & Prohibited Categories */}
            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#020617]/70 space-y-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>4. KYC / AML & Regulatory Compliance</span>
              </h3>
              <p className="text-xs text-[#94a3b8] leading-relaxed">
                Pabandi enforces strict Know-Your-Business (KYB) verification and prohibits unlicensed money transmission, speculative FX/crypto trading, gambling, adult services, weapons, or counterfeit goods. Pakistani PKR transactions are processed exclusively through State Bank of Pakistan (SBP) authorized PSO/PSP rails (Safepay & Raast).
              </p>
            </div>
          </div>

          {/* Merchant Contact & Legal Links Table */}
          <div className="p-5 rounded-xl border border-white/[0.08] bg-[#020617] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-white">Merchant Legal & Support Contact</div>
              <div className="text-[#94a3b8]">
                Email: <span className="text-indigo-300 font-mono">support@pabandi.com</span> • Compliance:{' '}
                <span className="text-indigo-300 font-mono">compliance@pabandi.com</span> • Website:{' '}
                <span className="text-white font-mono">https://pabandi.com</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/terms" className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold">
                Terms of Service
              </Link>
              <Link to="/privacy" className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold">
                Privacy Policy
              </Link>
              <Link to="/risk" className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold">
                Risk & Escrow Disclosure
              </Link>
              <Link to="/verify-trust" className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold">
                Trust Registry
              </Link>
            </div>
          </div>
        </section>

        {/* Safepay Underwriting Fast-Track Approval Packet */}
        <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b]/40 p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider">
                🇵🇰 Safepay Merchant Onboarding Fast-Track Kit
              </div>
              <h2 className="text-lg font-extrabold text-white mt-1">
                Ready-to-Send Underwriting Verification Packet
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Copy this pre-verified compliance response and send it to Safepay’s onboarding team to complete your live PKR merchant activation.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyPacket}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors whitespace-nowrap"
            >
              {copiedPacket ? '✓ Copied Verification Email!' : '📋 Copy Safepay Approval Reply'}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#020617] border border-white/10 text-[11px] text-[#cbd5e1] font-mono whitespace-pre-wrap overflow-x-auto max-h-72">
            {SAFEPAY_APPROVAL_TEMPLATE}
          </pre>
        </section>
      </main>
    </div>
  );
}
