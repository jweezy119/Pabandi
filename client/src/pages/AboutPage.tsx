import React from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import {
  Shield, Bot, Layers, Lock, Users, Globe,
  Check, Star, Cpu, CreditCard, Calendar, Handshake
} from 'lucide-react';

export default function AboutPage() {
  const heroRef = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const suiteRef = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const trustRef = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const agentRef = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const tokenRef = useScrollReveal() as React.RefObject<HTMLDivElement>;
  const roadmapRef = useScrollReveal() as React.RefObject<HTMLDivElement>;

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <section ref={heroRef} className="relative w-full pt-24 pb-16 px-4 sm:px-6 md:px-10 flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-1/4 w-[40rem] h-[40rem] bg-[var(--clay)] rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob" />
          <div className="absolute bottom-[-10%] right-1/4 w-[40rem] h-[40rem] bg-[var(--sage)] rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-blob animation-delay-2000" />
        </div>
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--clay)]/20 bg-[var(--clay)]/10 px-4 py-1.5 text-sm font-medium text-[var(--clay)] mb-6">
            <Star size={14} />
            Whitepaper v4.0
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-[var(--warm-ink)] font-headline mb-6">
            Trust, Portable.<br />Deposits, Automated.<br />Agents, Enabled.
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-[var(--soft-stone)] max-w-3xl font-light leading-relaxed">
            Pabandi is the trust layer for the service economy — and the settlement layer for the agent economy.
          </p>
        </div>
      </section>

      <section className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: Users, title: 'For Businesses', desc: 'Complete CRM, public booking page, deposits, escrow, invoicing, payments, and a trust badge — all in one place. Your clients see a clean booking page. Your calendar fills itself. You never chase a no-show again.', color: 'var(--clay)' },
            { icon: Shield, title: 'For Customers', desc: 'Book any service. If you are reliable, you pay zero deposit and earn rewards. Your reputation follows you — from salon to salon, from platform to platform, from human to AI.', color: 'var(--sage)' },
            { icon: Cpu, title: 'For Developers', desc: 'One API call gives you a person\'s reliability score. One OAuth flow lets users sign into your app with Pabandi. One escrow endpoint protects any conditional payment. One MCP server lets AI agents book, verify, and pay.', color: 'var(--muted-ochre)' },
            { icon: Bot, title: 'For AI Agents', desc: 'The only platform where an agent can prove its identity, verify another agent\'s reputation, message, book services, execute CRM actions, and settle payments in escrow — all in one protocol.', color: 'var(--dusty-rose)' },
          ].map((item, i) => (
            <div key={i} className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-3xl p-6 md:p-8 shadow-[var(--shadow-soft)]">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `color-mix(in srgb, ${item.color} 15%, transparent)` }}>
                <item.icon size={22} style={{ color: item.color }} />
              </div>
              <h2 className="text-xl font-bold text-[var(--warm-ink)] font-headline mb-3">{item.title}</h2>
              <p className="text-[var(--soft-stone)] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto py-12">
        <div className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-3xl p-6 md:p-10 shadow-[var(--shadow-soft)]">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-6 text-center">The Problem We Solve</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">For Service Businesses</h3>
              <ul className="space-y-3 text-sm text-[var(--soft-stone)]">
                <li className="flex items-start gap-2"><span className="text-[var(--dusty-rose)] mt-0.5">✗</span><span><strong className="text-[var(--warm-ink)]">Ghosting</strong> — customer says "I'll take it," you set aside time, they disappear</span></li>
                <li className="flex items-start gap-2"><span className="text-[var(--dusty-rose)] mt-0.5">✗</span><span><strong className="text-[var(--warm-ink)]">Fake payments</strong> — fake screenshots, reversed charges, ghost accounts</span></li>
                <li className="flex items-start gap-2"><span className="text-[var(--dusty-rose)] mt-0.5">✗</span><span><strong className="text-[var(--warm-ink)]">Blanket deposits</strong> — loyal customers feel insulted and leave</span></li>
              </ul>
              <div className="mt-4 p-3 rounded-xl bg-[var(--dusty-rose)]/5 border border-[var(--dusty-rose)]/15">
                <p className="text-xs text-[var(--soft-stone)]"><strong className="text-[var(--warm-ink)]">The unfair part:</strong> Good customers pay for the mistakes of bad customers.</p>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">For the Agent Economy</h3>
              <ul className="space-y-3 text-sm text-[var(--soft-stone)]">
                <li className="flex items-start gap-2"><span className="text-[var(--dusty-rose)] mt-0.5">✗</span><span><strong className="text-[var(--warm-ink)]">No identity</strong> — how does an agent prove it represents who it claims?</span></li>
                <li className="flex items-start gap-2"><span className="text-[var(--dusty-rose)] mt-0.5">✗</span><span><strong className="text-[var(--warm-ink)]">No reputation</strong> — how does one agent know another is reliable?</span></li>
                <li className="flex items-start gap-2"><span className="text-[var(--dusty-rose)] mt-0.5">✗</span><span><strong className="text-[var(--warm-ink)]">No messaging</strong> — how do agents discover and negotiate?</span></li>
                <li className="flex items-start gap-2"><span className="text-[var(--dusty-rose)] mt-0.5">✗</span><span><strong className="text-[var(--warm-ink)]">No escrow</strong> — how do both parties trust the transaction?</span></li>
              </ul>
              <div className="mt-4 p-3 rounded-xl bg-[var(--muted-ochre)]/5 border border-[var(--muted-ochre)]/15">
                <p className="text-xs text-[var(--soft-stone)]"><strong className="text-[var(--warm-ink)]">The gap:</strong> Every agent is a stranger to every other agent. Every transaction is blind.</p>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '$50B+', label: 'Global no-show cost/year' },
              { value: '38%', label: 'Bookings never show up' },
              { value: '393%', label: 'Agent transaction growth YoY' },
              { value: '99.3%', label: 'Agent payments settle in USDC' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-2xl bg-[var(--cream)]">
                <p className="text-2xl font-black text-[var(--clay)]">{stat.value}</p>
                <p className="text-xs text-[var(--soft-stone)] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={suiteRef} className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-3">The PabandiOS Suite</h2>
          <p className="text-[var(--soft-stone)] max-w-2xl mx-auto">Five modules that share one trust engine, one payment layer, and one identity.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Users, name: 'ContactOS', desc: 'CRM, deals, jobs, invoices, team, calendar, activities, tasks', color: 'var(--clay)' },
            { icon: Calendar, name: 'BookingOS', desc: 'Public booking page, availability, verified reviews, embed widget', color: 'var(--sage)' },
            { icon: Layers, name: 'PropertyOS', desc: 'Property management, leases, tenants, maintenance, inspections', color: 'var(--muted-ochre)' },
            { icon: Globe, name: 'FreightOS', desc: 'Loads, carriers, shipments, quotes, tracking', color: 'var(--sky-wash)' },
            { icon: CreditCard, name: 'CapitalOS', desc: 'Invoicing, expenses, accounts, financial reporting', color: 'var(--dusty-rose)' },
            { icon: Shield, name: 'TrustOS', desc: 'Scoring engine, events, passports, badges — shared underneath', color: 'var(--clay)' },
          ].map((mod, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)] shadow-[var(--shadow-soft)]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `color-mix(in srgb, ${mod.color} 15%, transparent)` }}>
                <mod.icon size={18} style={{ color: mod.color }} />
              </div>
              <h3 className="font-bold text-[var(--warm-ink)]">{mod.name}</h3>
              <p className="text-sm text-[var(--soft-stone)] mt-1">{mod.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={trustRef} className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto py-12">
        <div className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-3xl p-6 md:p-10 shadow-[var(--shadow-soft)]">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-3">Trust OS — The Reliability Engine</h2>
            <p className="text-[var(--soft-stone)] max-w-2xl mx-auto">A transparent weighted ensemble — every input and every weight readable. Events stay in context. Only fraud transfers globally.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">Five Scoped Scores</h3>
              <div className="space-y-2">
                {[
                  { name: 'Payment Score', desc: 'Do you pay on time?' },
                  { name: 'Show-Up Score', desc: 'Do you arrive when you said?' },
                  { name: 'Delivery Score', desc: 'Do you deliver what you promised?' },
                  { name: 'Tenancy Score', desc: 'Do you respect property terms?' },
                  { name: 'Freight Score', desc: 'Do you ship as contracted?' },
                ].map((score, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--cream)]">
                    <Check size={16} className="text-[var(--sage)] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[var(--warm-ink)]">{score.name}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{score.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              {/*
                WAS: four named AI models — Pattern Detective, Memory Keeper,
                Subtle Cue Catcher, Fair Arbiter — presented as shipping.

                None of them exist. This is the only marketing surface that
                named them, so it is the only place the claim needed removing;
                the technical description is in docs/whitepaper.md §9.3 and the
                roadmap is §9.3.1.

                Replaced with what actually computes the score. This is a
                downgrade in adjectives and an upgrade in substance: a customer
                who can see the four signals and ask why their score moved is
                better served than one shown four model names.
              */}
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">What Your Score Is Built From</h3>
              <div className="space-y-2">
                {[
                  { name: 'Punctuality (40%)', desc: 'Did you arrive when you said you would' },
                  { name: 'Payment Behaviour (30%)', desc: 'Did you pay, and on time' },
                  { name: 'Dispute-free record (20%)', desc: 'How often disputes have been filed against you' },
                  { name: 'Cancellations (−10%)', desc: 'Capped at six, so the sixth costs no more than the first' },
                ].map((signal, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--cream)]">
                    <Cpu size={16} className="text-[var(--clay)] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[var(--warm-ink)]">{signal.name}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{signal.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-2xl bg-[var(--clay)]/5 border border-[var(--clay)]/15 mt-4">
                <p className="text-xs text-[var(--soft-stone)]">
                  <strong className="text-[var(--warm-ink)]">Roadmap, not shipping:</strong>{' '}
                  four learned models are planned. Each one must beat this weighted
                  ensemble on a held-out dataset before it is allowed to affect your
                  score. We do not deploy a model we cannot explain.
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--sage)]/5 border border-[var(--sage)]/15">
            <p className="text-sm text-[var(--soft-stone)]">
              <strong className="text-[var(--warm-ink)]">The Context-Scoped Principle:</strong> A missed salon appointment does not affect your payment score. A late invoice does not affect your show-up score. Events stay in context. Only fraud-class signals transfer globally.
            </p>
          </div>
        </div>
      </section>

      <section ref={agentRef} className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-3">The Agent Layer</h2>
          <p className="text-[var(--soft-stone)] max-w-2xl mx-auto">Trust and settlement for AI. The agent economy has no trust infrastructure. Pabandi is building it.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Shield, name: 'Proof of Trust (PoTP)', desc: 'Cryptographic identity tied to a human principal. Delegated authority with spend limits.' },
            { icon: Bot, name: 'A2A Messaging', desc: 'Agents discover, negotiate, and transact through structured offer/counter-offer.' },
            { icon: Cpu, name: 'MCP Server', desc: 'Any MCP-compatible agent can book, verify, and pay through one connection.' },
            { icon: CreditCard, name: 'x402 + AP2 Payments', desc: 'HTTP-based payment protocol. Agent pays in USDC, access granted in same cycle.' },
            { icon: Lock, name: 'Agent Escrow', desc: 'Settlement for any agent-to-agent transaction. Conditions verified, release automatic.' },
            { icon: Star, name: 'Risk Bands + ZK Proofs', desc: 'Prove a claim without revealing the underlying score. Privacy-preserving verification.' },
          ].map((item, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)] shadow-[var(--shadow-soft)]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `color-mix(in srgb, ${item.color || 'var(--clay)'} 15%, transparent)` }}>
                <item.icon size={18} className="text-[var(--clay)]" />
              </div>
              <h3 className="font-bold text-[var(--warm-ink)]">{item.name}</h3>
              <p className="text-sm text-[var(--soft-stone)] mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={tokenRef} className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto py-12">
        <div className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-3xl p-6 md:p-10 shadow-[var(--shadow-soft)]">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-3">PAB Token — Utility, Staking, Profit Sharing</h2>
            <p className="text-[var(--soft-stone)] max-w-2xl mx-auto">PAB is earned by showing up, not sold as an investment. Staking uses profit-sharing — no fixed returns, no interest.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">Utility</h3>
              <div className="space-y-2">
                {[
                  { use: 'Earn', how: 'Show up to bookings, complete jobs, keep promises' },
                  { use: 'Reward', how: 'PAB mints to your wallet on verified check-in' },
                  { use: 'Stake', how: 'Businesses stake PAB for up to 50% API discount' },
                  { use: 'Discount', how: 'Higher staking = deeper discount on API calls' },
                  { use: 'Agent access', how: 'Agents pay for premium features with PAB or USDC' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--cream)]">
                    <Check size={16} className="text-[var(--sage)] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[var(--warm-ink)]">{item.use}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{item.how}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">Profit Sharing Staking</h3>
              <div className="space-y-2">
                {[
                  { name: 'No fixed returns', desc: 'Stakers receive proportional share of actual platform revenue' },
                  { name: 'No uncertainty', desc: 'Reward pool funded on-chain from verified fees' },
                  { name: 'No speculation', desc: 'Rewards tied to real transaction fees only' },
                  { name: 'Principal preserved', desc: 'Withdraw full principal after lockup' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--cream)]">
                    <Handshake size={16} className="text-[var(--clay)] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[var(--warm-ink)]">{item.name}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(191,179,163,0.2)]">
                  <th className="text-left py-2 px-3 text-[var(--soft-stone)] font-medium">Staked PAB</th>
                  <th className="text-left py-2 px-3 text-[var(--soft-stone)] font-medium">API Discount</th>
                  <th className="text-left py-2 px-3 text-[var(--soft-stone)] font-medium">Benefits</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { pab: '100', discount: '10%', benefits: 'Standard support' },
                  { pab: '1,000', discount: '25%', benefits: 'Priority support' },
                  { pab: '10,000', discount: '50%', benefits: 'Beta access + white-label' },
                  { pab: '100,000', discount: 'Enterprise', benefits: 'Custom SLAs + on-prem' },
                ].map((tier, i) => (
                  <tr key={i} className="border-b border-[rgba(191,179,163,0.1)]">
                    <td className="py-2 px-3 font-medium text-[var(--warm-ink)]">{tier.pab}</td>
                    <td className="py-2 px-3 text-[var(--clay)]">{tier.discount}</td>
                    <td className="py-2 px-3 text-[var(--soft-stone)]">{tier.benefits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section ref={roadmapRef} className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-3">Roadmap</h2>
        </div>
        <div className="space-y-4">
          {[
            { date: 'Q4 2026', title: 'ContactOS public launch', desc: 'Trust API live. Onchain attestations active.' },
            { date: 'Q1 2027', title: 'BookingOS public launch', desc: 'Geoapify integration. Agent escrow v1.' },
            { date: 'Q2 2027', title: 'MCP server GA', desc: 'x402 + AP2 payment rails. Developer portal.' },
            { date: 'Q3 2027', title: 'A2A messaging protocol', desc: 'ZK proof credentials. Grants program.' },
            { date: 'Q4 2027', title: 'Agent marketplace', desc: 'Enterprise tier. UAE + Saudi expansion.' },
            { date: 'Q1 2028', title: 'DeFi integrations', desc: 'Reputation-based lending. Insurance launch.' },
            { date: 'Q2 2028', title: 'Governance council', desc: 'Community voting on treasury.' },
            { date: 'Q4 2028', title: 'Global rollout', desc: 'Multi-chain support.' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
              <div className="w-20 shrink-0 text-sm font-bold text-[var(--clay)]">{item.date}</div>
              <div>
                <p className="font-semibold text-[var(--warm-ink)]">{item.title}</p>
                <p className="text-sm text-[var(--soft-stone)]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full px-4 sm:px-6 md:px-10 max-w-5xl mx-auto py-12">
        <div className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-3xl p-6 md:p-10 shadow-[var(--shadow-soft)] text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline mb-4">Built for the World</h2>
          <p className="text-[var(--soft-stone)] max-w-2xl mx-auto mb-6">
            We are starting with Pakistan's 220 million people because they deserve it most. We are building for the world's 8 billion people and the billions of AI agents that will serve them.
          </p>
          <p className="text-lg font-medium text-[var(--clay)] italic">Pehle payment. Phir baat. And now — for agents, for humans, for everyone.</p>
        </div>
      </section>
    </div>
  );
}
