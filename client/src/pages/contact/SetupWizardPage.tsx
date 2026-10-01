import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useBusinessSettings, VERTICAL_PRESETS } from '../../hooks/useBusinessSettings';

// ─── Vertical definitions with richer metadata ──────────────────────────────
const VERTICALS = [
  {
    id: 'salon',
    label: 'Salon / Beauty',
    emoji: '💅',
    description: 'Hair, nails, spa, and beauty services',
    example: 'Glow Beauty Studio',
    color: '#D4A5A5',
    bgLight: '#FDF0EF',
    highlights: ['Client profiles', 'Booking integration', 'Invoice history', 'Reliability scores'],
  },
  {
    id: 'consulting',
    label: 'Consulting / Coaching',
    emoji: '🎯',
    description: 'Strategy, coaching, and advisory services',
    example: 'Peak Performance Co.',
    color: '#8A9A7B',
    bgLight: '#F3F6F0',
    highlights: ['Deal pipeline', 'Task management', 'Meeting tracking', 'Proposal follow-ups'],
  },
  {
    id: 'trades',
    label: 'Trades / Contractors',
    emoji: '🔧',
    description: 'Plumbers, electricians, builders & more',
    example: 'Bright Spark Electric',
    color: '#C97B5A',
    bgLight: '#FDF5F1',
    highlights: ['Job scheduling', 'Quote tracking', 'Invoicing', 'Client reliability'],
  },
  {
    id: 'real_estate',
    label: 'Real Estate',
    emoji: '🏠',
    description: 'Property sales, rentals, and management',
    example: 'Prestige Property Group',
    color: '#D9A854',
    bgLight: '#FDF8EE',
    // 'Company accounts' removed: it was marketing a feature with no model, no
    // page, and no route behind it.
    highlights: ['Pipeline stages', 'Task lists', 'Activity feed', 'Invoicing'],
  },
  {
    id: 'logistics',
    label: 'Logistics / Freight',
    emoji: '🚚',
    description: 'Freight, transport, and delivery services',
    example: 'Swift Cargo Solutions',
    color: '#7B9EAD',
    bgLight: '#EFF5F8',
    highlights: ['Client management', 'Job invoicing', 'Activity logs'],
  },
  {
    id: 'general',
    label: 'General Business',
    emoji: '🏢',
    description: 'Any other service or product business',
    example: 'My Business',
    color: '#9B8EA0',
    bgLight: '#F5F2F7',
    highlights: ['Full CRM features', 'Pipeline tracking', 'Invoices & tasks'],
  },
];

// ─── Feature label map ────────────────────────────────────────────────────────
const FEATURE_LABELS: Record<string, { icon: string; label: string }> = {
  clients: { icon: 'groups', label: 'Clients' },
  deals: { icon: 'handshake', label: 'Deals pipeline' },
  invoices: { icon: 'receipt_long', label: 'Invoices' },
  activities: { icon: 'timeline', label: 'Activity feed' },
  tasks: { icon: 'task_alt', label: 'Task manager' },
  jobs: { icon: 'work', label: 'Jobs & scheduling' },
  reliability: { icon: 'verified', label: 'Reliability scores' },
  escrow: { icon: 'security', label: 'Escrow payments' },
};

// ─── Step 1: Vertical picker ─────────────────────────────────────────────────
function VerticalStep({
  selected,
  onSelect,
  onNext,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="mb-8">
        <h2 style={{ color: 'var(--warm-ink)', fontFamily: 'Fraunces, serif' }}
            className="text-2xl font-bold mb-2">
          What kind of business do you run?
        </h2>
        <p style={{ color: 'var(--soft-stone)' }} className="text-sm">
          We'll set up your CRM with the right tools for your industry. You can always change this later.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {VERTICALS.map((v) => {
          const isSelected = selected === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              className="text-left rounded-2xl p-4 border-2 transition-all duration-200"
              style={{
                borderColor: isSelected ? v.color : 'rgba(191,179,163,0.25)',
                backgroundColor: isSelected ? v.bgLight : 'white',
                boxShadow: isSelected ? `0 0 0 1px ${v.color}30, var(--shadow-soft)` : 'var(--shadow-soft)',
                transform: isSelected ? 'translateY(-2px)' : 'none',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{v.emoji}</span>
                <div>
                  <div className="font-bold text-sm" style={{ color: 'var(--warm-ink)' }}>
                    {v.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--soft-stone)' }}>
                    {v.description}
                  </div>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined ml-auto text-lg flex-shrink-0"
                        style={{ color: v.color }}>
                    check_circle
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onNext}
        disabled={!selected}
        className="w-full py-4 rounded-2xl font-bold text-white transition-all duration-200"
        style={{
          backgroundColor: selected ? 'var(--clay)' : 'var(--soft-stone)',
          opacity: selected ? 1 : 0.5,
          cursor: selected ? 'pointer' : 'not-allowed',
          fontSize: '1rem',
        }}
      >
        Set up my workspace →
      </button>
    </div>
  );
}

// ─── Step 2: Feature review ───────────────────────────────────────────────────
function FeatureReviewStep({
  verticalId,
  onBack,
  onConfirm,
}: {
  verticalId: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const vertical = VERTICALS.find((v) => v.id === verticalId)!;
  const preset = VERTICAL_PRESETS[verticalId];
  const contactFeatures = preset.features.contact || [];

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{vertical.emoji}</span>
          <div>
            <h2 style={{ color: 'var(--warm-ink)', fontFamily: 'Fraunces, serif' }}
                className="text-2xl font-bold">
              {vertical.label}
            </h2>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>
              Here's what we'll enable for you
            </p>
          </div>
        </div>
      </div>

      {/* Features being enabled */}
      <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] overflow-hidden mb-4">
        <div className="px-5 py-3 text-xs font-bold uppercase tracking-wider"
             style={{ backgroundColor: 'var(--warm-sand)', color: 'var(--soft-stone)' }}>
          ContactOS features included
        </div>
        <div className="divide-y divide-[rgba(191,179,163,0.2)]">
          {contactFeatures.map((fId) => {
            const meta = FEATURE_LABELS[fId];
            if (!meta) return null;
            return (
              <div key={fId} className="flex items-center gap-3 px-5 py-3 bg-white">
                <span className="material-symbols-outlined text-sm" style={{ color: 'var(--clay)' }}>
                  {meta.icon}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>
                  {meta.label}
                </span>
                <span className="ml-auto material-symbols-outlined text-sm" style={{ color: 'var(--sage)' }}>
                  check
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] overflow-hidden mb-8">
        <div className="px-5 py-3 text-xs font-bold uppercase tracking-wider"
             style={{ backgroundColor: 'var(--warm-sand)', color: 'var(--soft-stone)' }}>
          Your deal pipeline stages
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-4 bg-white">
          {preset.pipelineStages.map((stage, i) => (
            <span key={i} className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: `${vertical.color}20`, color: vertical.color, border: `1px solid ${vertical.color}40` }}>
              {stage}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-2xl font-bold transition-all duration-200 border-2"
          style={{ borderColor: 'rgba(191,179,163,0.4)', color: 'var(--soft-stone)', backgroundColor: 'white' }}
        >
          ← Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-[2] py-4 rounded-2xl font-bold text-white transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: 'var(--clay)', fontSize: '1rem' }}
        >
          Looks good — let's go 🎉
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Done celebration ─────────────────────────────────────────────────
function DoneStep({ verticalId, onEnter }: { verticalId: string; onEnter: () => void }) {
  const vertical = VERTICALS.find((v) => v.id === verticalId)!;
  return (
    <div className="text-center py-6">
      <div className="text-6xl mb-4 animate-bounce">{vertical.emoji}</div>
      <h2 style={{ color: 'var(--warm-ink)', fontFamily: 'Fraunces, serif' }}
          className="text-3xl font-bold mb-3">
        You're all set!
      </h2>
      <p style={{ color: 'var(--soft-stone)' }} className="text-base mb-2 max-w-sm mx-auto">
        Your <strong style={{ color: 'var(--clay)' }}>{vertical.label}</strong> workspace is ready.
        Add your first client and start building relationships that last.
      </p>

      <div className="flex justify-center gap-2 my-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full"
               style={{ backgroundColor: 'var(--clay)', opacity: 1 - i * 0.3 }} />
        ))}
      </div>

      <button
        onClick={onEnter}
        className="w-full py-5 rounded-2xl font-bold text-white text-lg transition-all duration-200 hover:opacity-90 shadow-lg"
        style={{ backgroundColor: 'var(--clay)' }}
      >
        Enter my workspace →
      </button>
    </div>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────
function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            flex: i === step - 1 ? 2 : 1,
            backgroundColor: i < step ? 'var(--clay)' : 'rgba(191,179,163,0.3)',
          }}
        />
      ))}
      <span className="text-xs ml-2 font-medium tabular-nums" style={{ color: 'var(--soft-stone)' }}>
        {step}/{total}
      </span>
    </div>
  );
}

// ─── Main wizard page ─────────────────────────────────────────────────────────
export default function SetupWizardPage() {
  const navigate = useNavigate();
  const { applyPreset, markSetupComplete } = useBusinessSettings();

  const [step, setStep] = useState(1);
  const [selectedVertical, setSelectedVertical] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!selectedVertical) return;
    applyPreset(selectedVertical);
    setStep(3);
  };

  const handleEnter = () => {
    markSetupComplete();
    navigate('/contact/clients?onboarded=true');
  };

  return (
    <>
      <Helmet>
        <title>Set up ContactOS — Pabandi</title>
        <meta name="description" content="Configure your ContactOS CRM for your business type." />
      </Helmet>

      {/* Full-page gradient background */}
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{
          background: 'linear-gradient(135deg, #F5EFE6 0%, #EDE0D0 50%, #F0E8DA 100%)',
        }}
      >
        {/* Card */}
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-bold"
              style={{ backgroundColor: 'rgba(201, 123, 90, 0.12)', color: 'var(--clay)' }}
            >
              <span className="material-symbols-outlined text-sm">contacts</span>
              Contact OS
            </div>
            <h1
              className="text-4xl font-bold mb-2"
              style={{ color: 'var(--warm-ink)', fontFamily: 'Fraunces, serif' }}
            >
              Welcome to your CRM
            </h1>
            <p style={{ color: 'var(--soft-stone)' }} className="text-base">
              Takes 30 seconds. No technical knowledge needed.
            </p>
          </div>

          {/* Wizard card */}
          <div
            className="rounded-3xl bg-white p-8"
            style={{ boxShadow: '0 20px 60px rgba(180,130,90,0.15), 0 4px 16px rgba(0,0,0,0.05)' }}
          >
            {step < 3 && <Progress step={step} total={2} />}

            {step === 1 && (
              <VerticalStep
                selected={selectedVertical}
                onSelect={setSelectedVertical}
                onNext={() => setStep(2)}
              />
            )}

            {step === 2 && selectedVertical && (
              <FeatureReviewStep
                verticalId={selectedVertical}
                onBack={() => setStep(1)}
                onConfirm={handleConfirm}
              />
            )}

            {step === 3 && selectedVertical && (
              <DoneStep verticalId={selectedVertical} onEnter={handleEnter} />
            )}
          </div>

          {/* Skip link */}
          {step < 3 && (
            <div className="text-center mt-6">
              <button
                onClick={handleEnter}
                className="text-sm hover:underline transition"
                style={{ color: 'var(--soft-stone)' }}
              >
                Skip setup — take me straight in
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
