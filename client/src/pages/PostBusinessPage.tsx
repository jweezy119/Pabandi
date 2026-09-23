import { useState } from 'react';
import { FiBriefcase, FiCheck, FiChevronRight } from 'react-icons/fi';

const BUSINESS_TYPES = [
  { id: 'cleaning', name: 'Cleaning Service', icon: '🧹', description: 'Residential, commercial, or specialized cleaning' },
  { id: 'plumbing', name: 'Plumbing', icon: '🔧', description: 'Repairs, installations, emergency plumbing' },
  { id: 'electrical', name: 'Electrical', icon: '⚡', description: 'Wiring, installations, repairs' },
  { id: 'hvac', name: 'HVAC', icon: '❄️', description: 'Heating, cooling, ventilation' },
  { id: 'landscaping', name: 'Landscaping', icon: '🌿', description: 'Lawn care, gardening, tree services' },
  { id: 'painting', name: 'Painting', icon: '🎨', description: 'Interior, exterior, commercial painting' },
  { id: 'moving', name: 'Moving', icon: '📦', description: 'Local, long-distance, commercial moving' },
  { id: 'property', name: 'Property Management', icon: '🏠', description: 'Rental management, tenant screening' },
  { id: 'freelance', name: 'Freelance', icon: '💼', description: 'Design, writing, programming, consulting' },
  { id: 'other', name: 'Other', icon: '🔹', description: 'Something else — we\'ll set it up' },
];

export default function PostBusinessPage() {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Save business and redirect to CRM onboarding
    setSubmitted(true);
    setTimeout(() => {
      window.location.href = `/crm?onboarding=true&type=${businessType}&name=${encodeURIComponent(businessName)}`;
    }, 1500);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-[var(--sage)] flex items-center justify-center mx-auto mb-4">
            <FiCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--warm-ink)] mb-2">Business Posted!</h1>
          <p className="text-[var(--soft-stone)] mb-4">Setting up your CRM now...</p>
          <div className="w-8 h-8 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <header className="border-b border-[var(--soft-stone)]/30 bg-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-[var(--clay)]">◈</span>
            <span className="font-bold text-[var(--warm-ink)]">PabandiOS</span>
          </a>
          <a href="/" className="text-sm text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">← Back to home</a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--warm-ink)] mb-2">Post Your Business</h1>
          <p className="text-[var(--soft-stone)]">Tell us what you do. We'll set up your CRM instantly.</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? 'bg-[var(--clay)] text-white' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}>
                {s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-[var(--clay)]' : 'bg-[var(--soft-stone)]/30'}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="rounded-2xl bg-white p-6 border border-[var(--soft-stone)]/30 shadow-sm">
              <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">What type of business?</h2>
              <div className="grid grid-cols-2 gap-3">
                {BUSINESS_TYPES.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => { setBusinessType(type.id); setStep(2); }}
                    className={`p-4 rounded-xl border text-left transition ${businessType === type.id ? 'border-[var(--clay)] bg-[var(--clay)]/5' : 'border-[var(--soft-stone)]/30 hover:border-[var(--clay)]/30'}`}
                  >
                    <div className="text-2xl mb-1">{type.icon}</div>
                    <div className="font-medium text-[var(--warm-ink)] text-sm">{type.name}</div>
                    <div className="text-xs text-[var(--soft-stone)]">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="rounded-2xl bg-white p-6 border border-[var(--soft-stone)]/30 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">About your business</h2>
              <div>
                <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Business Name *</label>
                <input
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                  placeholder="e.g. Sparkle Clean Co."
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                  placeholder="What services do you offer?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                    placeholder="you@business.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Phone</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                    placeholder="+1 555-0000"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-2 rounded-xl border border-[var(--soft-stone)]/30 text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Back</button>
                <button type="button" onClick={() => setStep(3)} className="flex-1 py-2 rounded-xl bg-[var(--clay)] text-white text-sm font-medium hover:bg-[var(--terracotta)]">Continue</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-2xl bg-white p-6 border border-[var(--soft-stone)]/30 shadow-sm">
              <h2 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Review & Post</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between p-3 rounded-lg bg-[var(--warm-sand)]">
                  <span className="text-sm text-[var(--soft-stone)]">Business Type</span>
                  <span className="text-sm font-medium text-[var(--warm-ink)]">{BUSINESS_TYPES.find(t => t.id === businessType)?.name || '—'}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-[var(--warm-sand)]">
                  <span className="text-sm text-[var(--soft-stone)]">Business Name</span>
                  <span className="text-sm font-medium text-[var(--warm-ink)]">{businessName || '—'}</span>
                </div>
                {description && (
                  <div className="p-3 rounded-lg bg-[var(--warm-sand)]">
                    <span className="text-sm text-[var(--soft-stone)] block mb-1">Description</span>
                    <span className="text-sm text-[var(--warm-ink)]">{description}</span>
                  </div>
                )}
                <div className="flex justify-between p-3 rounded-lg bg-[var(--warm-sand)]">
                  <span className="text-sm text-[var(--soft-stone)]">Contact</span>
                  <span className="text-sm font-medium text-[var(--warm-ink)]">{email || phone || '—'}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 py-2 rounded-xl border border-[var(--soft-stone)]/30 text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Back</button>
                <button type="submit" className="flex-1 py-2 rounded-xl bg-[var(--clay)] text-white text-sm font-medium hover:bg-[var(--terracotta)]">Post Business</button>
              </div>
            </div>
          )}
        </form>

        {/* What you get */}
        <div className="mt-8 rounded-2xl bg-white p-6 border border-[var(--soft-stone)]/30 shadow-sm">
          <h3 className="font-bold text-[var(--warm-ink)] mb-4">What you'll get:</h3>
          <div className="space-y-3">
            {[
              'Instant CRM with client pipeline',
              'Trust scoring for all contacts',
              'Escrow-backed transactions',
              'Scheduling & job tracking',
              '$PAB rewards on every deal',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <FiCheck className="w-4 h-4 text-[var(--sage)]" />
                <span className="text-sm text-[var(--warm-ink)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
