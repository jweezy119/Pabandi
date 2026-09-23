import { tokens } from '../design-system';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckIcon, 
  SparklesIcon, 
  ShieldCheckIcon, 
  CurrencyDollarIcon, 
  GiftIcon, 
  ArrowUpRightIcon,
  StarIcon,
  ScaleIcon,
  LockClosedIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';

export default function BusinessModelPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [stakedPab, setStakedPab] = useState<number>(50000);

  // API Staking Discount Calculation
  // Formula: Discount = D_max * S / (S + K)
  // D_max = 80%, K = 50000
  const dMax = 0.8;
  const kFactor = 50000;
  const discountPercent = (dMax * stakedPab) / (stakedPab + kFactor);
  const baseCost = 0.05;
  const customCost = baseCost * (1 - discountPercent);

  // App Pricing Rates
  const starterPrice = 0;
  const growthBasePrice = 29;
  const premiumBasePrice = 89;

  const growthPrice = billingInterval === 'yearly' ? Math.round(growthBasePrice * 0.8) : growthBasePrice;
  const premiumPrice = billingInterval === 'yearly' ? Math.round(premiumBasePrice * 0.8) : premiumBasePrice;

  return (
    <div style={{ background: 'var(--cream)', color: 'var(--warm-ink)' }} className="min-h-screen pb-20 sm:pb-24 md:pb-16 font-body">
      {/* Hero Banner */}
      <section 
        className="relative overflow-hidden py-20 px-4 text-center border-b border-[rgba(191,179,163,0.3)]"
        style={{ background: 'radial-gradient(circle at top, rgba(153, 69, 255, 0.1) 0%, transparent 60%)' }}
      >
        <div className="max-w-4xl mx-auto">
          <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            Enterprise Grade · Web3 Ecosystem
          </span>
          <h1 className="font-headline text-4xl sm:text-3xl md:text-4xl sm:text-5xl font-black mt-4 tracking-tight leading-tight text-[var(--warm-ink)]">
            Pabandi Business Model & Pricing
          </h1>
          <p className="text-sm md:text-base text-[var(--soft-stone)] mt-4 max-w-2xl mx-auto leading-relaxed">
            Pabandi is the WhatsApp-native commerce escrow layer for informal and live commerce.
            Merchant-first pricing, escrow checkout APIs, and portable trust built for real-world transactions.
          </p>
        </div>
      </section>

      {/* Tab/Toggle Selection Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-4 sm:px-6 lg:px-8 mt-12">
        
        {/* SECTION 1: MERCHANT APP SUBSCRIPTIONS */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl md:text-2xl sm:text-3xl font-black text-[var(--warm-ink)]">1. Merchant Application Suite</h2>
            <p className="text-xs text-[var(--soft-stone)] mt-1.5 max-w-lg mx-auto">
              SaaS dashboard and scheduling engine for local service providers, clinics, and salons.
            </p>

            {/* Monthly / Yearly Toggle */}
            <div className="inline-flex items-center gap-1.5 p-1 bg-[var(--warm-sand)] rounded-lg mt-6 border border-[rgba(191,179,163,0.3)]">
              <button 
                onClick={() => setBillingInterval('monthly')}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
                  billingInterval === 'monthly' ? 'bg-primary text-on-primary' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)]'
                }`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBillingInterval('yearly')}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                  billingInterval === 'yearly' ? 'bg-primary text-on-primary' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)]'
                }`}
              >
                Yearly
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container uppercase tracking-wide">
                  -20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-2xl p-6 flex flex-col justify-between hover:border-[rgba(191,179,163,0.4)] transition-colors shadow-sm">
              <div>
                <h3 className="font-headline text-base sm:text-lg font-bold text-[var(--warm-ink)]">Starter</h3>
                <p className="text-xs text-[var(--soft-stone)] mt-1">For independent professionals testing the waters.</p>
                <div className="my-6">
                  <span className="font-headline text-2xl sm:text-3xl font-black text-[var(--warm-ink)]">$ {starterPrice}</span>
                  <span className="text-xs text-[var(--soft-stone)] ml-1">/ month</span>
                </div>
                <hr className="border-[rgba(191,179,163,0.3)] my-4" />
                <ul className="space-y-3">
                  <FeatureItem text="Up to 50 bookings/month" />
                  <FeatureItem text="Basic SMS reminders" />
                  <FeatureItem text="Manual deposit settings" />
                  <FeatureItem text="5% commission on deposits" />
                </ul>
              </div>
              <Link to="/register" className="btn-secondary w-full py-2.5 text-center mt-8 text-xs font-bold block">
                Start Free
              </Link>
            </div>

            {/* Growth Plan (Popular) */}
            <div 
              className="rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 relative shadow-md"
              style={{
                background: 'linear-gradient(135deg, rgba(153, 69, 255, 0.06) 0%, rgba(255, 255, 255, 0.05) 45%, rgba(240, 180, 41, 0.04) 100%)',
                border: '2px solid rgba(153, 69, 255, 0.35)',
              }}
            >
              <div className="absolute -top-3 right-6 bg-[#f0b429] text-[#1a1a1a] font-label text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Most Popular
              </div>
              <div>
                <h3 className="font-headline text-base sm:text-lg font-bold text-[var(--warm-ink)] flex items-center gap-1.5">
                  Growth 
                  <SparklesIcon className="h-4.5 w-4.5 text-[#f0b429]" />
                </h3>
                <p className="text-xs text-[var(--soft-stone)] mt-1">Optimize turnover & prevent no-shows.</p>
                <div className="my-6">
                  <span className="font-headline text-2xl sm:text-3xl font-black text-[var(--warm-ink)]">$ {growthPrice}</span>
                  <span className="text-xs text-[var(--soft-stone)] ml-1">/ month</span>
                </div>
                <hr className="border-[rgba(191,179,163,0.3)] my-4" />
                <ul className="space-y-3">
                  <FeatureItem text="Unlimited bookings & calendars" />
                  <FeatureItem text="Automated WhatsApp & SMS alerts" />
                  <FeatureItem text="Tabular AI Risk Radar scoring" />
                  <FeatureItem text="Dynamic customer deposit prompts" />
                  <FeatureItem text="3.5% commission on deposits" />
                </ul>
              </div>
              <Link to="/register" className="btn-primary w-full py-2.5 text-center mt-8 text-xs font-bold block">
                Get 1 Month Free Trial
              </Link>
            </div>

            {/* Premium Plan */}
            <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-2xl p-6 flex flex-col justify-between hover:border-[rgba(191,179,163,0.4)] transition-colors shadow-sm">
              <div>
                <h3 className="font-headline text-base sm:text-lg font-bold text-[var(--warm-ink)]">Premium</h3>
                <p className="text-xs text-[var(--soft-stone)] mt-1">Complete autonomous operations & analytics.</p>
                <div className="my-6">
                  <span className="font-headline text-2xl sm:text-3xl font-black text-[var(--warm-ink)]">$ {premiumPrice}</span>
                  <span className="text-xs text-[var(--soft-stone)] ml-1">/ month</span>
                </div>
                <hr className="border-[rgba(191,179,163,0.3)] my-4" />
                <ul className="space-y-3">
                  <FeatureItem text="Everything in Growth" />
                  <FeatureItem text="Alibaba Accio Wholesale Sourcing" />
                  <FeatureItem text="Alibaba Qwen Business Consultant" />
                  <FeatureItem text="PayPal, Alibaba Pay, Binance Pay & Solana" />
                  <FeatureItem text="1% commission on deposits" />
                </ul>
              </div>
              <Link to="/register" className="btn-secondary w-full py-2.5 text-center mt-8 text-xs font-bold block">
                Upgrade to Premium
              </Link>
            </div>
          </div>

          {/* Chicago Staging SME Promo */}
          <div className="mt-8 max-w-3xl mx-auto p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
            <GiftIcon className="h-6 w-6 text-primary shrink-0 animate-bounce" />
            <div>
              <p className="text-xs font-bold text-[var(--warm-ink)] uppercase tracking-wider">Chicago SME Launch Campaign</p>
              <p className="text-[11px] text-[var(--soft-stone)] leading-relaxed">
                Register this week to claim <strong className="text-[var(--warm-ink)]">1 Month Free Trial</strong> of the Growth plan, plus <strong className="text-[var(--warm-ink)]">0% transaction fees</strong> on all deposit settlements for the first 30 days.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: INTELLIGENCE API / SDK */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl md:text-2xl sm:text-3xl font-black text-[var(--warm-ink)]">2. B2B Reliability Intelligence API & SDK</h2>
            <p className="text-xs text-[var(--soft-stone)] mt-1.5 max-w-lg mx-auto">
              Expose tabular + graph machine learning scores to external systems like aggregators, CRM, and calendar apps.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:p-8 items-stretch max-w-5xl mx-auto">
            {/* API Pricing Description */}
            <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-headline text-base font-bold text-[var(--warm-ink)] flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5 text-primary" />
                  Intelligence as a Service (IaaS)
                </h3>
                <p className="text-xs text-[var(--soft-stone)] mt-2 leading-relaxed">
                  Query no-show likelihoods, retrieve attendee trust score graphs, and verify badges in third-party contexts.
                </p>

                <div className="my-6 space-y-4">
                  <div className="flex justify-between items-center bg-[var(--warm-sand)] p-3.5 rounded-xl border border-[rgba(191,179,163,0.3)]">
                    <div>
                      <p className="text-xs font-bold text-[var(--warm-ink)]">Pay-As-You-Go Rates</p>
                      <p className="text-[10px] text-[var(--soft-stone)]">Usage-based volume tier</p>
                    </div>
                    <p className="font-headline text-xl font-black text-primary">$ 0.05 <span className="text-xs font-medium">/ call</span></p>
                  </div>
                  
                  <div className="flex justify-between items-center bg-[var(--warm-sand)] p-3.5 rounded-xl border border-[rgba(191,179,163,0.3)]">
                    <div>
                      <p className="text-xs font-bold text-[var(--warm-ink)]">Developer Beta Promotion</p>
                      <p className="text-[10px] text-[var(--soft-stone)]">Includes 1,000 requests</p>
                    </div>
                    <p className="font-headline text-base font-black text-[var(--sage)]">FREE</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  <FeatureItem text="SDK support for Node.js, Python, & Go" />
                  <FeatureItem text="Sub-150ms latency powered by Alibaba Cloud" />
                  <FeatureItem text="Encrypted user hashes (retains HIPAA/GDPR)" />
                </ul>
              </div>

              <Link to="/developer" className="btn-primary w-full py-3 text-center mt-8 text-xs font-bold block">
                Go to Developer Portal
              </Link>
            </div>

            {/* Staking Discount Calculator */}
            <div 
              className="rounded-2xl p-6 flex flex-col justify-between"
              style={{
                background: 'linear-gradient(135deg, rgba(240, 180, 41, 0.06) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(153, 69, 255, 0.04) 100%)',
                border: '1px solid rgba(240, 180, 41, 0.25)',
              }}
            >
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest bg-[var(--muted-ochre)]/15 text-[#f0b429] px-2 py-0.5 rounded border border-[var(--muted-ochre)]/25">
                  Web3 utility
                </span>
                <h3 className="font-headline text-base font-bold text-[var(--warm-ink)] mt-3">
                  Staking-Based API Discount Curve
                </h3>
                <p className="text-xs text-[var(--soft-stone)] mt-2 leading-relaxed">
                  Reduce API consumption fees by locking up $PAB tokens in the treasury smart contract. Cost per call drops logarithmically based on staked volume.
                </p>

                {/* Staking Calculator UI */}
                <div className="bg-[var(--warm-sand)] p-4 rounded-xl border border-[rgba(191,179,163,0.3)] my-6">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-[var(--soft-stone)] uppercase">Staked $PAB Tokens</span>
                    <span className="text-xs font-bold text-[var(--warm-ink)]">{stakedPab.toLocaleString()} PAB</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="500000" 
                    step="10000"
                    value={stakedPab}
                    onChange={(e) => setStakedPab(Number(e.target.value))}
                    className="w-full h-1.5 bg-[var(--warm-sand)] rounded-lg appearance-none cursor-pointer accent-[#f0b429] mb-4"
                  />

                  <div className="grid grid-cols-2 gap-4 text-center mt-2 border-t border-[rgba(191,179,163,0.3)] pt-4">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-[var(--soft-stone)] tracking-wider">Applied Discount</p>
                      <p className="font-headline text-base sm:text-lg font-bold text-[var(--sage)]">{(discountPercent * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-[var(--soft-stone)] tracking-wider">Discounted Cost</p>
                      <p className="font-headline text-base sm:text-lg font-bold text-[var(--warm-ink)]">${customCost.toFixed(3)}</p>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-[var(--soft-stone)] leading-relaxed">
                  Formula: D(S) = D_max * S / (S + 50,000). Locking PAB reduces API bills up to 80% maximum, removing circulating supply and reinforcing token velocity.
                </p>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-[#f0b429] hover:underline cursor-pointer mt-6">
                <span>View Staking Documentation</span>
                <ArrowUpRightIcon className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: WEB3 TOKENOMICS & DEFI CASHFLOWS */}
        <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-2xl p-6 max-w-5xl mx-auto">
          <h2 className="font-headline text-base sm:text-lg font-bold text-[var(--warm-ink)] mb-2 flex items-center gap-2">
            <CurrencyDollarIcon className="h-5 w-5 text-tertiary" />
            3. On-chain Escrow & Deflationary Cashflows
          </h2>
          <p className="text-xs text-[var(--soft-stone)] mb-6 leading-relaxed">
            Pabandi's smart contract infrastructure on Solana supports sustainable utility loops:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="p-4 bg-[var(--warm-sand)] rounded-xl border border-[rgba(191,179,163,0.3)]">
              <h4 className="text-xs font-bold text-[var(--warm-ink)] uppercase tracking-wider mb-1">Escrow Commission</h4>
              <p className="text-[11px] text-[var(--soft-stone)] leading-relaxed">
                A **0.5% protocol fee** is gathered from all deposit actions resolved via smart contracts. This is deposited directly to the Pabandi treasury.
              </p>
            </div>
            
            <div className="p-4 bg-[var(--warm-sand)] rounded-xl border border-[rgba(191,179,163,0.3)]">
              <h4 className="text-xs font-bold text-[var(--warm-ink)] uppercase tracking-wider mb-1">No-Show Slashing</h4>
              <p className="text-[11px] text-[var(--soft-stone)] leading-relaxed">
                When a staked booking results in a no-show, **5% of the slashed stake** is burned, reducing $PAB total circulation and applying deflationary pressure.
              </p>
            </div>

            <div className="p-4 bg-[var(--warm-sand)] rounded-xl border border-[rgba(191,179,163,0.3)]">
              <h4 className="text-xs font-bold text-[var(--warm-ink)] uppercase tracking-wider mb-1">Halal Yield Redistribution</h4>
              <p className="text-[11px] text-[var(--soft-stone)] leading-relaxed">
                **20% of all API revenue** is pooled and distributed as Halal Staking rewards to stakers of the PAB utility token, aligning token holders with platform scaling.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 4: SHARIA-COMPLIANT HALAL STAKING */}
        <div className="mt-16 max-w-5xl mx-auto">
          {/* Header Badge */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4"
              style={{
                background: 'rgba(34, 197, 94, 0.08)',
                borderColor: 'rgba(34, 197, 94, 0.3)',
              }}
            >
              <StarIcon className="h-3.5 w-3.5 text-[var(--sage)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)]">Sharia-Certified · Halal Finance</span>
              <StarIcon className="h-3.5 w-3.5 text-[var(--sage)]" />
            </div>
            <h2 className="font-headline text-2xl md:text-2xl sm:text-3xl font-black text-[var(--warm-ink)]">
              4. Halal Staking — Mudarabah Profit-Sharing
            </h2>
            <p className="text-xs text-[var(--soft-stone)] mt-2 max-w-2xl mx-auto leading-relaxed">
              Pabandi's staking model is architecturally designed to comply with Islamic finance principles.
              All yield is sourced from genuine commercial activity — no interest, no speculation, no prohibited elements.
            </p>
          </div>

          {/* Three Pillars of Sharia Compliance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {/* Pillar 1: No Riba */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-3 border"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(255, 255, 255, 0.05) 100%)',
                borderColor: 'rgba(34, 197, 94, 0.2)',
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-[rgba(var(--sage),0.1)] border border-[rgba(var(--sage),0.2)] flex items-center justify-center shrink-0">
                <BanknotesIcon className="h-5 w-5 text-[var(--sage)]" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] mb-1">No Ribā (Interest)</p>
                <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-1.5">Zero Fixed Returns</h4>
                <p className="text-[11px] text-[var(--soft-stone)] leading-relaxed">
                  Stakers receive <strong className="text-[var(--warm-ink)]">no predetermined interest rate</strong>. All rewards are a proportional share of actual platform revenue (Mudarabah). If the platform earns more, stakers earn more — profit only, never guaranteed income.
                </p>
              </div>
            </div>

            {/* Pillar 2: No Gharar */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-3 border"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(255, 255, 255, 0.05) 100%)',
                borderColor: 'rgba(34, 197, 94, 0.2)',
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-[rgba(var(--sage),0.1)] border border-[rgba(var(--sage),0.2)] flex items-center justify-center shrink-0">
                <ScaleIcon className="h-5 w-5 text-[var(--sage)]" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] mb-1">No Gharar (Uncertainty)</p>
                <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-1.5">Transparent Profit Pool</h4>
                <p className="text-[11px] text-[var(--soft-stone)] leading-relaxed">
                  The reward pool is funded on-chain from verified escrow commission and API fees. The profit-sharing ratio is fixed per epoch and publicly visible on-chain — no hidden terms or ambiguity.
                </p>
              </div>
            </div>

            {/* Pillar 3: No Maysir */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-3 border"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(255, 255, 255, 0.05) 100%)',
                borderColor: 'rgba(34, 197, 94, 0.2)',
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-[rgba(var(--sage),0.1)] border border-[rgba(var(--sage),0.2)] flex items-center justify-center shrink-0">
                <LockClosedIcon className="h-5 w-5 text-[var(--sage)]" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] mb-1">No Maysir (Gambling)</p>
                <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-1.5">Real Commercial Revenue</h4>
                <p className="text-[11px] text-[var(--soft-stone)] leading-relaxed">
                  Rewards are tied exclusively to booking platform fees — no randomness, no speculative instruments, no zero-sum mechanisms. Every PAB you earn traces to a real completed transaction.
                </p>
              </div>
            </div>
          </div>

          {/* Mudarabah Flow Explainer */}
          <div
            className="rounded-2xl p-6 border mb-8"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.04) 0%, rgba(153, 69, 255, 0.04) 100%)',
              borderColor: 'rgba(34, 197, 94, 0.25)',
            }}
          >
            <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
              <div className="flex-1">
                <h3 className="font-headline text-base font-bold text-[var(--warm-ink)] mb-3 flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5 text-[var(--sage)]" />
                  How the Mudarabah Profit-Share Works
                </h3>
                <div className="space-y-3">
                  {[
                    { step: '01', title: 'Lock $PAB Tokens', desc: 'Stake your PAB tokens for a minimum 30-day epoch. Your principal is locked in the smart contract — capital is always preserved.' },
                    { step: '02', title: 'Platform Earns Revenue', desc: 'Pabandi collects 0.5% escrow commission + API fees from real bookings. This revenue is deposited on-chain into the epoch reward pool.' },
                    { step: '03', title: 'Proportional Profit Distributed', desc: 'At epoch end, each staker receives: Reward = Pool × (Your Stake / Total Staked). Pure proportional sharing — no favouritism, no fixed rate.' },
                    { step: '04', title: 'Unstake Anytime After Lockup', desc: 'Once the lock period expires, withdraw your full principal. No deductions on capital — consistent with Islamic capital preservation principles.' },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-3">
                      <span className="text-[10px] font-black text-[var(--sage)] mt-0.5 shrink-0 w-6">{step}</span>
                      <div>
                        <p className="text-xs font-bold text-[var(--warm-ink)]">{title}</p>
                        <p className="text-[11px] text-[var(--soft-stone)] leading-relaxed mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:w-52 shrink-0">
                <div className="bg-[var(--warm-sand)] rounded-xl border border-[rgba(191,179,163,0.3)] p-4 text-center">
                  <div
                    className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl"
                    style={{ background: 'rgba(34, 197, 94, 0.12)', border: '2px solid rgba(34, 197, 94, 0.3)' }}
                  >
                    ☽
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--sage)] mb-2">AAOIFI Compliant</p>
                  <p className="text-[10px] text-[var(--soft-stone)] leading-relaxed">
                    Structured on <strong className="text-[var(--warm-ink)]">AAOIFI Standard No. 13</strong> (Mudarabah) and Standard No. 17 (Investment Sukuk). Profit-sharing ratio is epoch-fixed and publicly verifiable.
                  </p>
                  <hr className="border-[rgba(191,179,163,0.3)] my-3" />
                  <p className="text-[9px] text-[var(--soft-stone)]">Smart contract:</p>
                  <p className="text-[9px] font-mono text-[var(--sage)] mt-0.5">PabandiHalalStaking.sol</p>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison: Halal vs. Conventional */}
          <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-2xl p-5 mb-8">
            <h4 className="text-xs font-bold text-[var(--warm-ink)] uppercase tracking-wider mb-4">Pabandi Halal Staking vs. Conventional DeFi</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(191,179,163,0.3)]">
                    <th className="pb-2 pr-4 font-bold text-[var(--soft-stone)]">Feature</th>
                    <th className="text-center text-[var(--sage)] pb-2 pr-4 font-bold">Pabandi Halal Staking</th>
                    <th className="text-center text-[var(--soft-stone)] pb-2 font-bold">Conventional DeFi Yield</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {[
                    ['Return Type', 'Profit-share from real fees', 'Fixed APY (interest)'],
                    ['Revenue Source', 'Booking escrow + API fees', 'Lending, liquidity pools'],
                    ['Guaranteed Return', 'No — depends on revenue', 'Often yes — fixed rate'],
                    ['Capital Protected', 'Yes — principal returned in full', 'Impermanent loss possible'],
                    ['Riba (Interest)', '✗ None', '✓ Core mechanism'],
                    ['Gharar', '✗ None — on-chain transparency', '✓ Often present'],
                    ['Sharia Status', '✓ Halal', '✗ Prohibited'],
                  ].map(([feature, halal, conv]) => (
                    <tr key={feature} className="border-b border-[rgba(191,179,163,0.2)]">
                      <td className="py-2 pr-4 text-[var(--soft-stone)] font-medium">{feature}</td>
                      <td className="py-2 pr-4 text-center text-[var(--warm-ink)]">{halal}</td>
                      <td className="py-2 text-center text-[var(--soft-stone)]">{conv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CTA */}
          <div
            className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 border"
            style={{
              background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.06) 0%, rgba(153, 69, 255, 0.06) 100%)',
              borderColor: 'rgba(34, 197, 94, 0.25)',
            }}
          >
            <div className="text-center w-full">
              <p className="text-sm font-bold text-[var(--warm-ink)]">Join the Halal Staking Pool</p>
              <p className="text-[11px] text-[var(--soft-stone)] mt-1 mb-4">
                Earn proportional profit-share from Pabandi's booking platform revenue. Sharia-compliant.
              </p>
              <Link to="/wallet" className="inline-block px-4 sm:px-6 py-2.5 rounded-xl text-xs font-bold bg-[var(--sage)] hover:bg-[var(--sage)] text-black transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                Start Halal Staking →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-xs text-[var(--soft-stone)]">
      <CheckIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}
