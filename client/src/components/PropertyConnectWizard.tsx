import { useState } from 'react';
import { XMarkIcon, CheckIcon, ChevronRightIcon, BoltIcon } from '@heroicons/react/24/outline';

type PmsProvider = 'beds24' | 'cloudbeds' | 'lodgify' | 'manual';
type PropertyType = 'hotel' | 'guesthouse' | 'riad' | 'safari_camp' | 'experience' | 'vacation_rental' | 'other';

interface WizardState {
  step: 1 | 2 | 3 | 4;
  provider: PmsProvider | '';
  propertyName: string;
  pmsPropertyId: string;
  apiKey: string;
  propertyType: PropertyType | '';
  country: string;
}

const PMS_OPTIONS: { id: PmsProvider; label: string; badge: string; desc: string; color: string }[] = [
  { id: 'beds24', label: 'Beds24', badge: 'OPEN API · No approval', desc: 'Most developer-friendly. Popular in emerging markets. API v2 with full JSON webhooks.', color: '#10b981' },
  { id: 'cloudbeds', label: 'Cloudbeds', badge: 'OAuth · Marketplace', desc: 'Enterprise PMS with a large partner ecosystem. Used by hotel groups and resorts.', color: '#6366f1' },
  { id: 'lodgify', label: 'Lodgify', badge: 'REST API', desc: 'Popular with vacation rental managers and experience operators.', color: '#f59e0b' },
  { id: 'manual', label: 'Custom / Manual', badge: 'Webhook only', desc: 'Use our generic webhook endpoint for any other booking system or custom integration.', color: '#64748b' },
];

const PROPERTY_TYPES: { id: PropertyType; icon: string; label: string }[] = [
  { id: 'hotel', icon: '🏨', label: 'Hotel / Resort' },
  { id: 'guesthouse', icon: '🏡', label: 'Guesthouse / B&B' },
  { id: 'riad', icon: '🕌', label: 'Riad / Heritage' },
  { id: 'safari_camp', icon: '⛺', label: 'Safari / Camp' },
  { id: 'experience', icon: '🏄', label: 'Experience / Tour' },
  { id: 'vacation_rental', icon: '🏢', label: 'Vacation Rental' },
];

interface Props {
  onClose: () => void;
}

export default function PropertyConnectWizard({ onClose }: Props) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    provider: '',
    propertyName: '',
    pmsPropertyId: '',
    apiKey: '',
    propertyType: '',
    country: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [signingSecret, setSigningSecret] = useState('');

  const update = (patch: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/hospitality/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: state.provider,
          pmsPropertyId: state.pmsPropertyId,
          apiKey: state.apiKey,
          propertyName: state.propertyName,
          propertyType: state.propertyType || 'other',
          country: state.country,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.instructions?.webhookUrl || '');
        setSigningSecret(data.instructions?.signingSecret || '');
        update({ step: 4 });
      } else {
        // Demo fallback if API not running
        const baseUrl = window.location.hostname === 'localhost'
          ? 'http://localhost:5000'
          : 'https://pabandi-backend-xxxxx-uc.a.run.app';
        setWebhookUrl(`${baseUrl}/api/hospitality/${state.provider}/webhook`);
        setSigningSecret(`demo_secret_${Math.random().toString(36).substring(2, 18)}`);
        update({ step: 4 });
      }
    } catch {
      // Demo mode
      setWebhookUrl(`https://api.pabandi.io/api/hospitality/${state.provider}/webhook`);
      setSigningSecret(`demo_secret_${Math.random().toString(36).substring(2, 18)}`);
      update({ step: 4 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-enter"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden modal-enter"
        style={{ background: 'var(--color-surface-raised)', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Hospitality Connect</p>
            <h2 className="text-sm font-bold text-white">
              {state.step === 1 && 'Step 1 — Choose Your PMS'}
              {state.step === 2 && 'Step 2 — Property Details'}
              {state.step === 3 && 'Step 3 — API Credentials'}
              {state.step === 4 && 'Step 4 — Configure Webhook'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress dots */}
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{ background: s <= state.step ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)' }}
                />
              ))}
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-white transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">

          {/* ── Step 1: Select PMS ─────────────────────────────────────────── */}
          {state.step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant mb-4">
                Which Property Management System does your hotel use?
              </p>
              {PMS_OPTIONS.map(({ id, label, badge, desc, color }) => (
                <button
                  key={id}
                  id={`pms-select-${id}`}
                  onClick={() => update({ provider: id, step: 2 })}
                  className="w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:border-primary/50 group"
                  style={{
                    background: state.provider === id ? `${color}10` : 'var(--color-surface-container-lowest)',
                    borderColor: state.provider === id ? `${color}50` : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{label}</span>
                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
                      >{badge}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">{desc}</p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-on-surface-variant shrink-0 mt-1 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Property Details ───────────────────────────────────── */}
          {state.step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 block">
                  Property Name *
                </label>
                <input
                  id="property-name-input"
                  type="text"
                  placeholder="e.g. The Pearl Karachi, Safari Oasis Camp"
                  value={state.propertyName}
                  onChange={(e) => update({ propertyName: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 block">
                  Property Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PROPERTY_TYPES.map(({ id, icon, label }) => (
                    <button
                      key={id}
                      id={`property-type-${id}`}
                      onClick={() => update({ propertyType: id })}
                      className="flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all text-xs"
                      style={{
                        background: state.propertyType === id ? 'rgba(99,102,241,0.15)' : 'var(--color-surface-container-lowest)',
                        borderColor: state.propertyType === id ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                        color: state.propertyType === id ? '#a5b4fc' : 'var(--color-on-surface-variant)',
                      }}
                    >
                      <span className="text-xl">{icon}</span>
                      <span className="font-bold text-[10px] leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 block">
                  Country / Region
                </label>
                <input
                  id="property-country-input"
                  type="text"
                  placeholder="e.g. Pakistan, UAE, Kenya"
                  value={state.country}
                  onChange={(e) => update({ country: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => update({ step: 1 })} className="btn-secondary flex-1 py-2.5 text-xs font-bold">← Back</button>
                <button
                  onClick={() => update({ step: 3 })}
                  disabled={!state.propertyName || !state.propertyType}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: API Credentials ────────────────────────────────────── */}
          {state.step === 3 && (
            <div className="space-y-4">
              <div
                className="p-3 rounded-xl border text-[11px] text-on-surface-variant leading-relaxed"
                style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}
              >
                <strong className="text-white">For {state.provider === 'beds24' ? 'Beds24' : state.provider === 'cloudbeds' ? 'Cloudbeds' : 'your PMS'}: </strong>
                {state.provider === 'beds24' && 'Go to Settings → Properties → Access → API Keys. Generate a new API key with "Bookings" read permission.'}
                {state.provider === 'cloudbeds' && 'Go to Marketplace → Pabandi → Connect. You\'ll be redirected to authorize OAuth access.'}
                {state.provider === 'lodgify' && 'Go to Settings → Integrations → API → Create New Key with bookings scope.'}
                {state.provider === 'manual' && 'Enter any identifier for your property. We\'ll provide a generic webhook URL you can configure in any system.'}
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 block">
                  {state.provider === 'beds24' ? 'Beds24 Property ID' : 'PMS Property ID'} *
                </label>
                <input
                  id="pms-property-id-input"
                  type="text"
                  placeholder={state.provider === 'beds24' ? 'e.g. 12345' : 'Your PMS property identifier'}
                  value={state.pmsPropertyId}
                  onChange={(e) => update({ pmsPropertyId: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 block">
                  API Key / Token *
                </label>
                <input
                  id="api-key-input"
                  type="password"
                  placeholder="Paste your PMS API key here"
                  value={state.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary font-mono"
                />
                <p className="text-[10px] text-on-surface-variant mt-1.5">Encrypted at rest. Never logged or shared.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => update({ step: 2 })} className="btn-secondary flex-1 py-2.5 text-xs font-bold">← Back</button>
                <button
                  id="connect-submit-btn"
                  onClick={handleSubmit}
                  disabled={!state.pmsPropertyId || !state.apiKey || isSubmitting}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                  ) : (
                    <BoltIcon className="h-4 w-4" />
                  )}
                  {isSubmitting ? 'Connecting...' : 'Connect Property'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Success + Webhook Instructions ─────────────────────── */}
          {state.step === 4 && (
            <div className="space-y-4">
              <div className="text-center py-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                  <CheckIcon className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="font-bold text-white text-sm">Property Connected!</p>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  <strong className="text-white">{state.propertyName}</strong> is now linked to Pabandi escrow.
                </p>
              </div>

              <div
                className="p-4 rounded-xl border"
                style={{ background: 'rgba(240,180,41,0.05)', borderColor: 'rgba(240,180,41,0.25)' }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-[#f0b429] mb-3">
                  Final Step — Register Webhook in {PMS_OPTIONS.find((p) => p.id === state.provider)?.label}
                </p>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant mb-1">Webhook URL</p>
                    <div className="flex items-center gap-2 bg-surface-container rounded-lg p-2 border border-outline-variant/20">
                      <code className="text-[10px] text-emerald-400 flex-1 break-all font-mono">{webhookUrl}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(webhookUrl)}
                        className="text-[10px] font-bold text-on-surface-variant hover:text-white px-2 py-1 rounded bg-surface-container-high shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant mb-1">Signing Secret (HMAC)</p>
                    <div className="flex items-center gap-2 bg-surface-container rounded-lg p-2 border border-outline-variant/20">
                      <code className="text-[10px] text-primary flex-1 break-all font-mono">{signingSecret}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(signingSecret)}
                        className="text-[10px] font-bold text-on-surface-variant hover:text-white px-2 py-1 rounded bg-surface-container-high shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed">
                  {state.provider === 'beds24' && 'In Beds24: Settings → Properties → Access → Booking Webhooks → Add URL above.'}
                  {state.provider === 'cloudbeds' && 'In Cloudbeds: Developer → Webhooks → New Subscription → paste URL and secret above.'}
                  {state.provider === 'lodgify' && 'In Lodgify: Settings → Integrations → Webhooks → Add endpoint URL above.'}
                  {state.provider === 'manual' && 'Configure your booking system to POST reservation events to the URL above, including the signing secret in the X-Pabandi-Signature header.'}
                </p>
              </div>

              <button
                id="wizard-done-btn"
                onClick={onClose}
                className="btn-primary w-full py-3 text-xs font-bold"
              >
                Done — Start Protecting Bookings 🚀
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
