import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useBusinessSettings, VERTICAL_PRESETS } from '../../hooks/useBusinessSettings';
import { useAuthStore } from '../../store/authStore';
import { VERTICAL_LIST, getVerticalPersona } from '../../config/verticalPersonas';
import { DigitalDollarsSetupCard } from '../../components/DigitalDollarsSetupCard';
import { getAuthToken } from '../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';

// ─── Step 1: Vertical picker (7 focused local SMB verticals) ──────────────────
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
      <div className="mb-6">
        <h2
          style={{ color: 'var(--warm-ink)', fontFamily: 'Fraunces, serif' }}
          className="text-2xl font-bold mb-2"
        >
          What kind of business do you run?
        </h2>
        <p style={{ color: 'var(--soft-stone)' }} className="text-sm">
          We’ll tailor your menus, starter services, and client messages to match how you actually work.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
        {VERTICAL_LIST.map((v) => {
          const isSelected = selected === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className="text-left rounded-2xl p-4 border-2 transition-all duration-200"
              style={{
                borderColor: isSelected ? v.accentColor : 'rgba(191,179,163,0.25)',
                backgroundColor: isSelected ? v.bgLight : 'white',
                boxShadow: isSelected
                  ? `0 0 0 1px ${v.accentColor}30, var(--shadow-soft)`
                  : 'var(--shadow-soft)',
                transform: isSelected ? 'translateY(-2px)' : 'none',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{v.emoji}</span>
                <div className="min-w-0">
                  <div className="font-bold text-sm" style={{ color: 'var(--warm-ink)' }}>
                    {v.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--soft-stone)' }}>
                    {v.description}
                  </div>
                </div>
                {isSelected && (
                  <span
                    className="material-symbols-outlined ml-auto text-lg flex-shrink-0"
                    style={{ color: v.accentColor }}
                  >
                    check_circle
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
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
        Personalize my workspace →
      </button>
    </div>
  );
}

// ─── Step 2: Business Name + Tailored CRM Preview ─────────────────────────────
function FeatureReviewStep({
  verticalId,
  businessName,
  onBusinessNameChange,
  onBack,
  onConfirm,
  canConfirm,
  enrolling,
}: {
  verticalId: string;
  businessName: string;
  onBusinessNameChange: (v: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
  enrolling: boolean;
}) {
  const persona = getVerticalPersona(verticalId);
  const preset = VERTICAL_PRESETS[verticalId] || VERTICAL_PRESETS.general;

  return (
    <div>
      <div className="mb-6">
        <label
          htmlFor="setup-business-name"
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--warm-ink)' }}
        >
          What’s your business called?
        </label>
        <input
          id="setup-business-name"
          type="text"
          value={businessName}
          onChange={(e) => onBusinessNameChange(e.target.value)}
          placeholder={persona.exampleBusiness}
          autoComplete="organization"
          required
          className="w-full rounded-xl px-4 py-3 text-base outline-none focus:ring-2"
          style={{
            background: 'var(--surface-bright, #fff)',
            border: '1px solid var(--soft-stone, #E7DED0)',
            color: 'var(--warm-ink)',
          }}
        />
        <p className="text-xs mt-1.5" style={{ color: 'var(--soft-stone)' }}>
          Used on your booking page and in friendly reminders your {persona.navLabels.clients.toLowerCase()} receive.
        </p>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <span className="text-3xl">{persona.emoji}</span>
        <div>
          <h2
            style={{ color: 'var(--warm-ink)', fontFamily: 'Fraunces, serif' }}
            className="text-xl font-bold"
          >
            Built for {persona.label}
          </h2>
          <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>
            Your workspace speaks your language from day one
          </p>
        </div>
      </div>

      {/* Tailored Vocabulary Preview */}
      <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] overflow-hidden mb-4">
        <div
          className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
          style={{ backgroundColor: 'var(--warm-sand)', color: 'var(--soft-stone)' }}
        >
          Your personalized CRM tabs
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-4 bg-white">
          {[
            persona.navLabels.clients,
            persona.navLabels.jobs,
            persona.navLabels.deals,
            persona.navLabels.invoices,
            persona.navLabels.team,
          ].map((lbl) => (
            <span
              key={lbl}
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: persona.bgLight,
                color: 'var(--warm-ink)',
                border: `1px solid ${persona.accentColor}40`,
              }}
            >
              {lbl}
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] overflow-hidden mb-6">
        <div
          className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
          style={{ backgroundColor: 'var(--warm-sand)', color: 'var(--soft-stone)' }}
        >
          Ready-to-use starter services ({persona.starterServices.length})
        </div>
        <div className="px-5 py-3.5 bg-white space-y-1.5">
          {persona.starterServices.slice(0, 3).map((s) => (
            <div key={s.name} className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--warm-ink)]">{s.name}</span>
              <span className="text-[var(--soft-stone)]">
                ${s.price} · {s.duration}m
              </span>
            </div>
          ))}
          <div className="pt-2 flex flex-wrap gap-1.5">
            {preset.pipelineStages.map((stage, i) => (
              <span
                key={i}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  backgroundColor: `${persona.accentColor}20`,
                  color: 'var(--warm-ink)',
                }}
              >
                {stage}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-4 rounded-2xl font-bold transition-all duration-200 border-2"
          style={{
            borderColor: 'rgba(191,179,163,0.4)',
            color: 'var(--soft-stone)',
            backgroundColor: 'white',
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || enrolling}
          className="flex-[2] py-4 rounded-2xl font-bold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: 'var(--clay)', fontSize: '1rem' }}
        >
          {enrolling ? 'Setting up…' : 'Create my workspace →'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Optional Zero-Friction Payouts + Enter Workspace ─────────────────
// -- Your booking link -------------------------------------------------------
// The single most useful thing a new owner can leave setup holding, and the one
// thing nothing produced: every other /book/<id> URL in the app is generated by a
// booking or discovery page, so an owner finished setup, landed in the CRM, and
// had no idea customers could already book them.
function BookingLinkCard({ businessId }: { businessId: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/book/${businessId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // The Clipboard API needs a secure context. Without a fallback the button
      // silently does nothing on a plain-http address.
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-2xl p-4 text-left"
      style={{ background: "rgba(191,179,163,0.10)", border: "1px solid rgba(191,179,163,0.35)" }}
    >
      <label
        htmlFor="pbn-booking-link"
        className="block text-sm font-bold mb-1"
        style={{ color: "var(--warm-ink)" }}
      >
        Your booking link
      </label>
      <p className="text-xs mb-3" style={{ color: "var(--soft-stone)" }}>
        Anyone can book you here &mdash; no account needed. Put it on your Instagram,
        Google Business profile, or shop window.
      </p>
      <div className="flex items-center gap-2">
        <input
          id="pbn-booking-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Your booking link"
          className="flex-1 min-w-0 rounded-xl border px-3 py-2.5 text-sm"
          style={{
            borderColor: "rgba(191,179,163,0.4)",
            background: "#fff",
            color: "var(--warm-ink)",
          }}
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 min-h-[44px] px-4 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--clay)" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
function PaymentAndDoneStep({
  verticalId,
  businessName,
  businessId,
  onSaveSolanaAddress,
  onEnter,
}: {
  verticalId: string;
  businessName: string;
  businessId: string;
  onSaveSolanaAddress: (addr: string) => Promise<void>;
  onEnter: () => void;
}) {
  const persona = getVerticalPersona(verticalId);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-2">{persona.emoji}</div>
        <h2
          style={{ color: 'var(--warm-ink)', fontFamily: 'Fraunces, serif' }}
          className="text-2xl font-bold"
        >
          {businessName || persona.label} is ready!
        </h2>
        <p style={{ color: 'var(--soft-stone)' }} className="text-sm mt-1">
          Optional: turn on low-fee Instant Digital Dollars now, or skip and set up payments anytime later.
        </p>
      </div>

      {businessId && <BookingLinkCard businessId={businessId} />}

      <DigitalDollarsSetupCard onSaveAddress={onSaveSolanaAddress} compact />

      <button
        type="button"
        onClick={onEnter}
        className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all duration-200 hover:opacity-90 shadow-md"
        style={{ backgroundColor: 'var(--clay)' }}
      >
        Enter my {persona.shortLabel} CRM →
      </button>
      <p className="text-center text-xs text-[var(--soft-stone)]">
        You can always add Bank Transfer, Square, PayPal, or Digital Dollars later in Settings.
      </p>
    </div>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────
function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
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
  const [businessName, setBusinessName] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  // enrollBusiness writes businessId onto the user; reading it from the store
  // (rather than a local set) keeps it correct if setup is re-run.
  const businessId = useAuthStore((s) => (s.user as any)?.businessId || "");

  const enroll = async () => {
    if (!selectedVertical) return;
    setEnrolling(true);
    setEnrollError(null);
    try {
      const user = useAuthStore.getState().user;
      await useAuthStore.getState().enrollBusiness({
        businessName: businessName.trim(),
        ownerName: (user as any)?.name || (user as any)?.firstName || businessName.trim(),
        serviceType: selectedVertical,
      });
      applyPreset(selectedVertical);
      markSetupComplete();
      setStep(3);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Could not finish setting up your business. Check your connection and try again.';
      setEnrollError(message);
    } finally {
      setEnrolling(false);
    }
  };

  const handleSaveSolanaAddress = async (solanaAddress: string) => {
    const user = useAuthStore.getState().user as any;
    const businessId =
      user?.business?.id || user?.businessId || localStorage.getItem('businessId') || '';
    if (!businessId) {
      throw new Error('Workspace ID not found yet — you can save this anytime in Payment Settings.');
    }
    const res = await fetch(`${API_BASE}/api/v1/payment-methods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken() || ''}`,
      },
      body: JSON.stringify({ businessId, railId: 'solana', target: solanaAddress }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Could not save digital dollar payout method');
    }
  };

  const handleConfirm = () => {
    if (!selectedVertical || !businessName.trim()) return;
    void enroll();
  };

  const handleEnter = () => {
    navigate('/contact?onboarded=true');
  };

  return (
    <>
      <Helmet>
        <title>Set up ContactOS — Pabandi</title>
        <meta name="description" content="Personalize your Pabandi small-business CRM in under a minute." />
      </Helmet>

      <div
        className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{
          background: 'linear-gradient(135deg, #F5EFE6 0%, #EDE0D0 50%, #F0E8DA 100%)',
        }}
      >
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5 text-sm font-bold"
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
              Takes under a minute. Built for real local businesses — zero jargon.
            </p>
          </div>

          {/* Wizard card */}
          <div
            className="rounded-3xl bg-white p-7 sm:p-8"
            style={{ boxShadow: '0 20px 60px rgba(180,130,90,0.15), 0 4px 16px rgba(0,0,0,0.05)' }}
          >
            <Progress step={step} total={3} />

            {step === 1 && (
              <VerticalStep
                selected={selectedVertical}
                onSelect={setSelectedVertical}
                onNext={() => setStep(2)}
              />
            )}

            {step === 2 && enrollError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
                style={{
                  background: 'var(--danger-container, #FCE8E6)',
                  color: 'var(--on-danger-container, #8C1D18)',
                }}
              >
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-px">error</span>
                <span>{enrollError}</span>
              </div>
            )}

            {step === 2 && selectedVertical && (
              <FeatureReviewStep
                verticalId={selectedVertical}
                businessName={businessName}
                onBusinessNameChange={setBusinessName}
                canConfirm={Boolean(businessName.trim())}
                enrolling={enrolling}
                onBack={() => setStep(1)}
                onConfirm={handleConfirm}
              />
            )}

            {step === 3 && selectedVertical && (
              <PaymentAndDoneStep
                verticalId={selectedVertical}
                businessName={businessName}
                businessId={businessId}
                onSaveSolanaAddress={handleSaveSolanaAddress}
                onEnter={handleEnter}
              />
            )}
          </div>

          {/* Skip link */}
          {step < 3 && (
            <div className="text-center mt-6">
              <button
                type="button"
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
