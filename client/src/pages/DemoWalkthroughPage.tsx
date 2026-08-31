import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

type Step = {
  title: string;
  body: string;
  icon: string;
  action?: string;
};

const pmSteps: Step[] = [
  { title: 'Enroll as a Property Manager', body: 'Sign up for free and get instant access to your CRM dashboard. No credit card required.', icon: '🏘️', action: 'Activate free CRM' },
  { title: 'Add your properties', body: 'List your portfolio — apartments, houses, rooms. Track rent, status, and occupancy at a glance.', icon: '🏠', action: 'Add property' },
  { title: 'Screen tenants', body: 'Run US court (CourtListener) or PK background checks. Risk band auto-calculates the recommended deposit surcharge (0/10/25%).', icon: '🔍', action: 'Run screening' },
  { title: 'Manage tenant history', body: 'Track every tenant by email — past stays, disputes, risk bands, deposits held. Build a history that follows them.', icon: '👥', action: 'Add tenant' },
  { title: 'White-label portal', body: 'Give tenants a branded portal at your own slug. They see your listings, your brand, your trust.', icon: '🎨', action: 'View portal' },
];

const saleSteps: Step[] = [
  { title: 'Seller opens a secured sale', body: 'Drop the Pabandi widget on any listing. The seller opens a secured sale and gets a shareable buyer link.', icon: '🛡️', action: 'Secure this sale' },
  { title: 'Schedule a SafeMeet', body: 'Pick a safe public meetup spot — police station, bank, coffee shop, mall, library. Funds stay locked until the exchange.', icon: '📍', action: 'Schedule SafeMeet' },
  { title: 'Buyer funds escrow', body: 'The buyer opens the secure link and funds the escrow. Money is locked — neither party can walk with it.', icon: '💰', action: 'Fund escrow' },
  { title: 'Meet & exchange', body: 'Meet at the safe spot, inspect the item, hand it over. No cash, no risk of robbery.', icon: '🤝', action: 'Meet in person' },
  { title: 'Release funds', body: 'Buyer confirms the exchange — funds release to the seller. If something goes wrong, file a dispute to lock the escrow for arbitration.', icon: '✅', action: 'Release funds' },
];

export const DemoWalkthroughPage: React.FC = () => {
  const [activeFlow, setActiveFlow] = useState<'pm' | 'sale'>('pm');
  const [activeStep, setActiveStep] = useState(0);

  const steps = activeFlow === 'pm' ? pmSteps : saleSteps;
  const step = steps[activeStep];

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-100 font-headline">See Pabandi in action</h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">A guided walkthrough of the full trust experience — from property management to safe local sales.</p>
        </div>

        {/* Flow toggle */}
        <div className="flex justify-center gap-3 mb-8">
          <button onClick={() => { setActiveFlow('pm'); setActiveStep(0); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeFlow === 'pm' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
            🏘️ Property Manager
          </button>
          <button onClick={() => { setActiveFlow('sale'); setActiveStep(0); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeFlow === 'sale' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
            🛡️ Secured Sale
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <button key={i} onClick={() => setActiveStep(i)}
              className={`w-3 h-3 rounded-full transition-all ${i === activeStep ? 'bg-indigo-400 scale-125' : 'bg-white/20 hover:bg-white/40'}`} />
          ))}
        </div>

        {/* Active step */}
        <Surface className="max-w-2xl mx-auto text-center p-8 md:p-12">
          <div className="text-6xl mb-4">{step.icon}</div>
          <div className="mb-2">
            <Badge tone="info">Step {activeStep + 1} of {steps.length}</Badge>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 font-headline mt-3">{step.title}</h2>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-lg mx-auto">{step.body}</p>

          <div className="flex justify-center gap-3 mt-8">
            <Button onClick={() => setActiveStep(Math.max(0, activeStep - 1))} variant="ghost" disabled={activeStep === 0}>← Previous</Button>
            <Button onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))} disabled={activeStep === steps.length - 1}>
              {step.action || 'Next'} →
            </Button>
          </div>
        </Surface>

        {/* Step list */}
        <div className="mt-8 space-y-2">
          {steps.map((s, i) => (
            <div key={i} onClick={() => setActiveStep(i)}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer transition-all ${i === activeStep ? 'bg-indigo-500/10 border border-indigo-400/20' : 'bg-white/[0.02] border border-white/5 hover:bg-white/5'}`}>
              <div className="text-2xl">{s.icon}</div>
              <div className="flex-1">
                <div className="font-semibold text-slate-100 text-sm">{s.title}</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>{s.body}</div>
              </div>
              <div className="text-xs font-bold" style={{ color: i === activeStep ? tokens.color.primary : tokens.color.muted }}>{i + 1}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <h3 className="text-xl font-bold text-slate-100 mb-3">Ready to try it for real?</h3>
          <div className="flex justify-center gap-3 flex-wrap">
            <Button onClick={() => window.location.href = '/property-manager'}>Open Property CRM</Button>
            <Button onClick={() => window.location.href = '/partners/marketplace'} variant="ghost">Explore Marketplace</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoWalkthroughPage;
