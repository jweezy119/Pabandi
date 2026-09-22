import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { propertyManagerService } from '../services/api';

const STEPS = ['Welcome', 'Company', 'Property', 'Tenant Policy', 'Review'];

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    companyName: '',
    phone: '',
    role: '',
    propertyCount: '',
    propertyName: '',
    propertyAddress: '',
    rentAmount: '',
    petFee: '',
    lateFee: '',
    graceDays: '5',
    utilities: [] as string[],
    autoScreen: true,
    requiresBackgroundCheck: true,
    paymentReminders: true,
  });

  useEffect(() => { if (saved) setSaved(false); }, [step]);

  const update = (patch: any) => setForm(f => ({ ...f, ...patch }));

  const toggleUtility = (u: string) => {
    setForm(f => ({ ...f, utilities: f.utilities.includes(u) ? f.utilities.filter(x => x !== u) : [...f.utilities, u] }));
  };

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const complete = async () => {
    setLoading(true);
    try {
      await propertyManagerService.enroll({
        companyName: form.companyName,
        phone: form.phone,
        role: form.role,
        propertyCount: Number(form.propertyCount),
        propertyName: form.propertyName,
        address: form.propertyAddress,
        rentAmount: Number(form.rentAmount),
        petFee: Number(form.petFee),
        lateFee: Number(form.lateFee),
        lateGraceDays: Number(form.graceDays),
        utilities: form.utilities,
        screeningEnabled: form.autoScreen,
        backgroundCheckRequired: form.requiresBackgroundCheck,
        paymentRemindersEnabled: form.paymentReminders,
      });
      setSaved(true);
      setTimeout(() => navigate('/property-manager'), 900);
    } catch (e) {
      console.error('onboarding failed', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 md:py-12" style={{ background: 'radial-gradient(circle at top right, #0b1020, #030712)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold font-headline text-[var(--warm-ink)]">Welcome to Property Manager</h1>
          <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
          <div className="mt-3 h-2 rounded-full bg-[var(--warm-sand)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--clay)] transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] p-6 md:p-8 shadow-[var(--shadow-soft)]">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--warm-ink)]">👋 Let’s get your CRM set up</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>This takes about 2 minutes. You’ll finish with a clean, working tenant pipeline and CourtListener-ready screening.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                  <div className="text-lg font-bold text-[var(--warm-ink)]">1</div>
                  <div className="text-sm" style={{ color: '#cbd5e1' }}>Company info</div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                  <div className="text-lg font-bold text-[var(--warm-ink)]">2</div>
                  <div className="text-sm" style={{ color: '#cbd5e1' }}>Property & lease terms</div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                  <div className="text-lg font-bold text-[var(--warm-ink)]">3</div>
                  <div className="text-sm" style={{ color: '#cbd5e1' }}>Tenant policies + review</div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--warm-ink)]">🏢 Company info</h2>
              <input value={form.companyName} onChange={e => update({ companyName: e.target.value })} placeholder="Company / team name" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
              <input value={form.phone} onChange={e => update({ phone: e.target.value })} placeholder="Phone" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
              <select value={form.role} onChange={e => update({ role: e.target.value })} className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400">
                <option value="">Primary role</option>
                <option value="PROPERTY_MANAGER">Property Manager</option>
                <option value="LANDLORD">Landlord</option>
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--warm-ink)]">🏠 Property basics</h2>
              <input value={form.propertyName} onChange={e => update({ propertyName: e.target.value })} placeholder="Property name" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
              <input value={form.propertyAddress} onChange={e => update({ propertyAddress: e.target.value })} placeholder="Address" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={form.rentAmount} onChange={e => update({ rentAmount: e.target.value })} placeholder="Rent amount" type="number" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
                <input value={form.propertyCount} onChange={e => update({ propertyCount: e.target.value })} placeholder="Total units" type="number" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={form.petFee} onChange={e => update({ petFee: e.target.value })} placeholder="Pet fee" type="number" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
                <input value={form.lateFee} onChange={e => update({ lateFee: e.target.value })} placeholder="Late fee" type="number" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
                <input value={form.graceDays} onChange={e => update({ graceDays: e.target.value })} placeholder="Late grace days" type="number" className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--warm-ink)] mb-2">Included utilities</p>
                <div className="flex flex-wrap gap-2">
                  {['WATER', 'ELECTRIC', 'GAS', 'INTERNET', 'TRASH'].map(u => (
                    <button key={u} onClick={() => toggleUtility(u)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${form.utilities.includes(u) ? 'bg-[var(--clay)]/15 text-[var(--clay)] border border-indigo-400/40' : 'bg-[var(--warm-sand)] text-[var(--warm-ink)] border border-[rgba(191,179,163,0.3)]'}`}>{u}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--warm-ink)]">🧾 Tenant policies</h2>
              <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                <div>
                  <div className="text-sm text-[var(--warm-ink)]">Auto-screen applicants</div>
                  <div className="text-xs" style={{ color: '#94a3b8' }}>Run CourtListener checks automatically on new applicants</div>
                </div>
                <input type="checkbox" checked={form.autoScreen} onChange={e => update({ autoScreen: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                <div>
                  <div className="text-sm text-[var(--warm-ink)]">Require background check</div>
                  <div className="text-xs" style={{ color: '#94a3b8' }}>Block approval until civil/criminal screening is complete</div>
                </div>
                <input type="checkbox" checked={form.requiresBackgroundCheck} onChange={e => update({ requiresBackgroundCheck: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                <div>
                  <div className="text-sm text-[var(--warm-ink)]">Payment reminders</div>
                  <div className="text-xs" style={{ color: '#94a3b8' }}>Auto reminders for rent, late fees, and renewals</div>
                </div>
                <input type="checkbox" checked={form.paymentReminders} onChange={e => update({ paymentReminders: e.target.checked })} />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-[var(--warm-ink)]">✅ Review</h2>
              <div className="p-4 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] text-sm text-[var(--warm-ink)]">
                <div>Company: {form.companyName || '—'}</div>
                <div>Property: {form.propertyName || '—'} · {form.propertyAddress || '—'}</div>
                <div>Rent: ${form.rentAmount || '—'} · Late: ${form.lateFee || '—'} · Pet: ${form.petFee || '—'}</div>
                <div>Grace days: {form.graceDays}</div>
                <div>Utilities: {form.utilities.length ? form.utilities.join(', ') : 'None'}</div>
                <div>Screening: {form.autoScreen ? 'Auto' : 'Manual'}</div>
              </div>
            </div>
          )}

          {saved && <div className="mt-4 text-sm text-[var(--sage)]">Saved. Redirecting to dashboard…</div>}

          <div className="mt-8 flex justify-between">
            <button onClick={prev} disabled={step === 0} className="rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] px-4 py-3 text-sm text-[var(--warm-ink)] disabled:opacity-50">Back</button>
            {step < STEPS.length - 1 ? (
              <button onClick={next} className="rounded-xl bg-[var(--clay)] px-4 py-3 text-sm font-semibold text-[var(--warm-ink)] hover:bg-indigo-400">Next</button>
            ) : (
              <button onClick={complete} disabled={loading} className="rounded-xl bg-[var(--sage)] px-4 py-3 text-sm font-semibold text-[var(--warm-ink)] hover:bg-[var(--sage)] disabled:opacity-50">{loading ? 'Saving…' : 'Complete Setup'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
