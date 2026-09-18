import React, { useState, useCallback, useEffect } from 'react';
import { Surface, Button, Badge } from '../design-system';
import { tokens } from '../design-system';

// ── Types ───────────────────────────────────────────────────────────

type FormData = {
  // Step 1: Basic
  title: string;
  description: string;
  category: string;
  businessPlanUrl: string;
  // Step 2: Financial Terms
  profitShareRatio: string;
  targetAmount: string;
  minInvestment: string;
  maxInvestment: string;
  expectedApy: string;
  profitCalcMethod: string;
  marginPercent: string;
  reserveRatio: number;
  allowEarlyWithdraw: boolean;
  earlyWithdrawPenalty: string;
  // Step 3: Use of Funds
  revenueSource: string;
  useOfFunds: string;
  fundBreakdown: FundBreakdownItem[];
  // Step 4: Risk & Compliance
  riskBand: string;
  riskDisclosure: string;
  lockupPeriodDays: string;
  shariaCompliant: boolean;
  legalDisclaimer: string;
  accreditedOnly: boolean;
  // Step 5: Distribution
  distributionFreq: string;
  distributionDay: string;
  autoDistribute: boolean;
  minDistribution: string;
  // Step 6: Review
  termsAccepted: boolean;
  shariaDeclaration: boolean;
};

type FundBreakdownItem = { category: string; amount: string; description: string };

type ValidationErrors = Partial<Record<keyof FormData, string>>;

const DRAFT_KEY = 'mudarabah-pool-wizard-draft';

const STEPS = [
  { id: 1, label: 'Basics', short: 'Pool Info' },
  { id: 2, label: 'Financials', short: 'Terms' },
  { id: 3, label: 'Use of Funds', short: 'Allocation' },
  { id: 4, label: 'Risk & Compliance', short: 'Compliance' },
  { id: 5, label: 'Distribution', short: 'Payouts' },
  { id: 6, label: 'Review', short: 'Confirm' },
];

const CATEGORIES = ['RESTAURANT', 'RETAIL', 'SERVICES', 'TECH', 'REAL_ESTATE', 'OTHER'];
const PROFIT_CALC_METHODS = [
  { value: 'REVENUE_SHARE', label: 'Revenue Share', desc: 'Distribute % of gross revenue' },
  { value: 'PROFIT_SHARE', label: 'Profit Share', desc: 'Distribute % of net profit' },
  { value: 'FIXED_RETURN', label: 'Fixed Return', desc: 'Fixed periodic return to investors' },
];
const RISK_BANDS = [
  { value: 'LOW', label: 'Low Risk', color: tokens.color.success },
  { value: 'MEDIUM', label: 'Medium Risk', color: tokens.color.warning },
  { value: 'HIGH', label: 'High Risk', color: tokens.color.danger },
];
const DISTRIBUTION_FREQS = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];
const PROFIT_RATIO_PRESETS = ['70/30', '60/40', '50/50'];

const INITIAL_FORM: FormData = {
  title: '',
  description: '',
  category: 'RESTAURANT',
  businessPlanUrl: '',
  profitShareRatio: '70/30',
  targetAmount: '',
  minInvestment: '100',
  maxInvestment: '',
  expectedApy: '8',
  profitCalcMethod: 'REVENUE_SHARE',
  marginPercent: '50',
  reserveRatio: 10,
  allowEarlyWithdraw: false,
  earlyWithdrawPenalty: '5',
  revenueSource: '',
  useOfFunds: '',
  fundBreakdown: [{ category: '', amount: '', description: '' }],
  riskBand: 'MEDIUM',
  riskDisclosure: '',
  lockupPeriodDays: '90',
  shariaCompliant: true,
  legalDisclaimer: '',
  accreditedOnly: false,
  distributionFreq: 'MONTHLY',
  distributionDay: '1',
  autoDistribute: false,
  minDistribution: '100',
  termsAccepted: false,
  shariaDeclaration: false,
};

// ── Shared UI Helpers ───────────────────────────────────────────────

function InputLabel({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-medium text-slate-300">
      {children}
      {required && <span className="ml-1 text-rose-400">*</span>}
    </label>
  );
}

function InputError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-400">{message}</p>;
}

function FormInput({
  value, onChange, placeholder, type = 'text', className = '', disabled, min, max, step,
}: {
  value: string | number; onChange: (v: string) => void; placeholder?: string;
  type?: string; className?: string; disabled?: boolean; min?: string; max?: string; step?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition-all focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-50 ${className}`}
    />
  );
}

function FormTextarea({
  value, onChange, placeholder, required, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      rows={rows}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition-all focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30"
    />
  );
}

function FormSelect({
  value, onChange, options, className = '',
}: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition-all focus:border-indigo-400/60 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8">
      <div className="relative mb-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
          style={{ width: `${(current / STEPS.length) * 100}%` }}
        />
      </div>
      <div className="flex justify-between gap-1">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`flex flex-col items-center gap-1 transition-all ${s.id <= current ? 'opacity-100' : 'opacity-40'}`}
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              s.id === current
                ? 'bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]'
                : s.id < current
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white/10 text-slate-400'
            }`}>
              {s.id < current ? '✓' : s.id}
            </div>
            <span className="hidden text-xs text-slate-400 sm:block">{s.label}</span>
            <span className="text-[10px] text-slate-500 sm:hidden">{s.short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, step, onEdit, children }: { title: string; step: number; onEdit: () => void; children: React.ReactNode }) {
  return (
    <Surface className="relative">
      <div className="absolute top-3 right-3">
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <Badge tone="info">Step {step}</Badge>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="space-y-1 text-xs text-slate-400">{children}</div>
    </Surface>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}:</span>
      <span className="text-right font-medium text-slate-200">{String(value)}</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function MudarabahPoolWizard({ onSubmit, onCancel }: { onSubmit: (data: FormData) => Promise<void>; onCancel?: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load draft from localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        setForm({ ...INITIAL_FORM, ...parsed.data });
        setSavedAt(parsed.savedAt);
      }
    } catch { /* ignore */ }
  }, []);

  const update = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const saveDraft = useCallback(() => {
    try {
      const ts = new Date().toLocaleTimeString();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: form, savedAt: ts }));
      setSavedAt(ts);
    } catch { /* ignore */ }
  }, [form]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setSavedAt(null);
  }, []);

  // Validation per step
  const validateStep = useCallback((s: number): boolean => {
    const errs: ValidationErrors = {};

    if (s === 1) {
      if (!form.title.trim() || form.title.trim().length < 3) errs.title = 'Pool title is required (min 3 chars)';
      if (!form.description.trim() || form.description.trim().length < 10) errs.description = 'Description is required (min 10 chars)';
      if (!form.category) errs.category = 'Category is required';
      if (form.businessPlanUrl && !/^https?:\/\/.+/.test(form.businessPlanUrl)) errs.businessPlanUrl = 'Enter a valid URL';
    }

    if (s === 2) {
      const ratioPattern = /^\d+\/\d+$/;
      if (!ratioPattern.test(form.profitShareRatio)) errs.profitShareRatio = 'Format must be number/number (e.g. 70/30)';
      else {
        const parts = form.profitShareRatio.split('/').map(Number);
        if (parts[0] + parts[1] !== 100) errs.profitShareRatio = 'Parts must sum to 100';
      }
      if (!form.targetAmount || parseFloat(form.targetAmount) <= 0) errs.targetAmount = 'Target amount must be > 0';
      if (!form.minInvestment || parseFloat(form.minInvestment) < 100) errs.minInvestment = 'Min investment must be ≥ 100';
      if (form.maxInvestment && parseFloat(form.maxInvestment) < parseFloat(form.minInvestment || '0'))
        errs.maxInvestment = 'Max must be >= min investment';
      if (form.expectedApy && (parseFloat(form.expectedApy) < 0 || parseFloat(form.expectedApy) > 100))
        errs.expectedApy = 'APY must be between 0 and 100';
      if (form.profitCalcMethod === 'PROFIT_SHARE' && (!form.marginPercent || parseFloat(form.marginPercent) <= 0))
        errs.marginPercent = 'Margin % is required for profit share method';
    }

    if (s === 3) {
      if (!form.revenueSource.trim() || form.revenueSource.trim().length < 5) errs.revenueSource = 'Revenue source is required';
      if (!form.useOfFunds.trim() || form.useOfFunds.trim().length < 10) errs.useOfFunds = 'Use of funds explanation required';
      if (form.targetAmount) {
        const total = form.fundBreakdown.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
        const target = parseFloat(form.targetAmount);
        if (Math.abs(total - target) > 0.01) errs.useOfFunds = `Fund breakdown total (${total.toFixed(2)}) must equal target amount (${target.toFixed(2)})`;
      }
    }

    if (s === 4) {
      if (!form.riskDisclosure.trim() || form.riskDisclosure.trim().length < 10) errs.riskDisclosure = 'Risk disclosure is required';
      if (!form.legalDisclaimer.trim() || form.legalDisclaimer.trim().length < 10) errs.legalDisclaimer = 'Legal disclaimer is required';
      if (!form.lockupPeriodDays || parseInt(form.lockupPeriodDays) < 0) errs.lockupPeriodDays = 'Lockup period must be ≥ 0';
      if (!form.shariaCompliant) errs.shariaCompliant = 'Sharia compliance is required';
    }

    if (s === 5) {
      if (!form.distributionDay || parseInt(form.distributionDay) < 1 || parseInt(form.distributionDay) > 28)
        errs.distributionDay = 'Day must be between 1 and 28';
      if (form.autoDistribute && (!form.minDistribution || parseFloat(form.minDistribution) < 0))
        errs.minDistribution = 'Min distribution threshold required';
    }

    if (s === 6) {
      if (!form.termsAccepted) errs.termsAccepted = 'You must accept the terms';
      if (!form.shariaDeclaration) errs.shariaDeclaration = 'Sharia compliance declaration required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const goNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length));
      saveDraft();
    }
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const goToStep = (s: number) => {
    setStep(s);
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
      clearDraft();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const fundTotal = form.fundBreakdown.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

  // ── Step Renderers ──────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Pool Basics</h2>
        <p className="mt-1 text-sm text-slate-400">Define your Mudarabah pool's identity and purpose.</p>
      </div>

      <Surface className="space-y-4">
        <div>
          <InputLabel required>Pool Title</InputLabel>
          <FormInput value={form.title} onChange={(v) => update('title', v)} placeholder="e.g. Restaurant Expansion Fund" />
          <InputError message={errors.title} />
        </div>

        <div>
          <InputLabel required>Description</InputLabel>
          <FormTextarea
            value={form.description}
            onChange={(v) => update('description', v)}
            placeholder="Describe the purpose and goals of this pool..."
            rows={4}
          />
          <InputError message={errors.description} />
        </div>

        <div>
          <InputLabel required>Business Category</InputLabel>
          <FormSelect
            value={form.category}
            onChange={(v) => update('category', v)}
            options={CATEGORIES.map((c) => ({ value: c, label: c.charAt(0) + c.slice(1).toLowerCase() }))}
          />
          <InputError message={errors.category} />
        </div>

        <div>
          <InputLabel>Business Plan URL (Optional)</InputLabel>
          <FormInput value={form.businessPlanUrl} onChange={(v) => update('businessPlanUrl', v)} placeholder="https://..." />
          <InputError message={errors.businessPlanUrl} />
        </div>
      </Surface>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Financial Terms</h2>
        <p className="mt-1 text-sm text-slate-400">Set the investment structure and profit-sharing terms.</p>
      </div>

      <Surface className="space-y-4">
        <div>
          <InputLabel required>Profit Share Ratio (Investor / Business)</InputLabel>
          <div className="flex flex-wrap gap-2 mb-3">
            {PROFIT_RATIO_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update('profitShareRatio', p)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  form.profitShareRatio === p
                    ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <FormInput value={form.profitShareRatio} onChange={(v) => update('profitShareRatio', v)} placeholder="70/30" />
          <InputError message={errors.profitShareRatio} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <InputLabel required>Target Amount ($)</InputLabel>
            <FormInput value={form.targetAmount} onChange={(v) => update('targetAmount', v)} type="number" placeholder="50000" min="0" />
            <InputError message={errors.targetAmount} />
          </div>
          <div>
            <InputLabel>Expected APY (%)</InputLabel>
            <FormInput value={form.expectedApy} onChange={(v) => update('expectedApy', v)} type="number" placeholder="8" min="0" max="100" step="0.1" />
            <InputError message={errors.expectedApy} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <InputLabel required>Min Investment ($)</InputLabel>
            <FormInput value={form.minInvestment} onChange={(v) => update('minInvestment', v)} type="number" placeholder="100" min="100" />
            <InputError message={errors.minInvestment} />
          </div>
          <div>
            <InputLabel>Max Investment ($)</InputLabel>
            <FormInput value={form.maxInvestment} onChange={(v) => update('maxInvestment', v)} type="number" placeholder="Optional" min="0" />
            <InputError message={errors.maxInvestment} />
          </div>
        </div>

        <div>
          <InputLabel>Profit Calculation Method</InputLabel>
          <div className="space-y-2">
            {PROFIT_CALC_METHODS.map((m) => (
              <label
                key={m.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                  form.profitCalcMethod === m.value
                    ? 'border-indigo-400/60 bg-indigo-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="profitCalcMethod"
                  value={m.value}
                  checked={form.profitCalcMethod === m.value}
                  onChange={(e) => update('profitCalcMethod', e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-200">{m.label}</div>
                  <div className="text-xs text-slate-400">{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {form.profitCalcMethod === 'PROFIT_SHARE' && (
          <div>
            <InputLabel required>Expected Margin (%)</InputLabel>
            <FormInput value={form.marginPercent} onChange={(v) => update('marginPercent', v)} type="number" placeholder="50" min="0" max="100" />
            <InputError message={errors.marginPercent} />
          </div>
        )}

        <div>
          <InputLabel>Reserve Ratio: {form.reserveRatio}%</InputLabel>
          <input
            type="range"
            min="0"
            max="30"
            value={form.reserveRatio}
            onChange={(e) => update('reserveRatio', Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>0%</span>
            <span>30%</span>
          </div>
        </div>

        <div>
          <Toggle
            checked={form.allowEarlyWithdraw}
            onChange={(v) => update('allowEarlyWithdraw', v)}
            label="Allow Early Withdraw"
          />
          {form.allowEarlyWithdraw && (
            <div className="mt-3">
              <InputLabel>Early Withdraw Penalty (%)</InputLabel>
              <FormInput value={form.earlyWithdrawPenalty} onChange={(v) => update('earlyWithdrawPenalty', v)} type="number" placeholder="5" min="0" max="100" />
            </div>
          )}
        </div>
      </Surface>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Use of Funds</h2>
        <p className="mt-1 text-sm text-slate-400">Explain the revenue source and allocate the funds.</p>
      </div>

      <Surface className="space-y-4">
        <div>
          <InputLabel required>Revenue Source</InputLabel>
          <FormTextarea
            value={form.revenueSource}
            onChange={(v) => update('revenueSource', v)}
            placeholder="What business activity generates profit? e.g. Restaurant dine-in and delivery sales..."
            rows={3}
          />
          <InputError message={errors.revenueSource} />
        </div>

        <div>
          <InputLabel required>Use of Funds (Detailed)</InputLabel>
          <FormTextarea
            value={form.useOfFunds}
            onChange={(v) => update('useOfFunds', v)}
            placeholder="How will the invested capital be deployed? e.g. Kitchen equipment, renovation, working capital..."
            rows={4}
          />
          <InputError message={errors.useOfFunds} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <InputLabel>Fund Breakdown</InputLabel>
            <div className="text-xs text-slate-400">
              Total: <span className={form.targetAmount && Math.abs(fundTotal - parseFloat(form.targetAmount)) > 0.01 ? 'text-rose-400' : 'text-emerald-300'}>
                ${fundTotal.toFixed(2)}
              </span>
              {form.targetAmount && <span> / ${parseFloat(form.targetAmount).toFixed(2)}</span>}
            </div>
          </div>

          {form.fundBreakdown.map((item, idx) => (
            <div key={idx} className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <FormInput value={item.category} onChange={(v) => {
                  const items = [...form.fundBreakdown];
                  items[idx] = { ...items[idx], category: v };
                  update('fundBreakdown', items);
                }} placeholder="Category" />
              </div>
              <div className="sm:col-span-2">
                <FormInput value={item.amount} onChange={(v) => {
                  const items = [...form.fundBreakdown];
                  items[idx] = { ...items[idx], amount: v };
                  update('fundBreakdown', items);
                }} placeholder="Amount" type="number" min="0" />
              </div>
              <div className="sm:col-span-5">
                <FormInput value={item.description} onChange={(v) => {
                  const items = [...form.fundBreakdown];
                  items[idx] = { ...items[idx], description: v };
                  update('fundBreakdown', items);
                }} placeholder="Description" />
              </div>
              <div className="flex items-center sm:col-span-2">
                {form.fundBreakdown.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    update('fundBreakdown', form.fundBreakdown.filter((_, i) => i !== idx));
                  }} className="text-rose-400 hover:bg-rose-500/10">
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button variant="ghost" size="sm" onClick={() => {
            update('fundBreakdown', [...form.fundBreakdown, { category: '', amount: '', description: '' }]);
          }}>
            + Add Line Item
          </Button>
        </div>
      </Surface>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Risk & Compliance</h2>
        <p className="mt-1 text-sm text-slate-400">Define risk profile and compliance requirements.</p>
      </div>

      <Surface className="space-y-4">
        <div>
          <InputLabel required>Risk Band</InputLabel>
          <div className="flex flex-wrap gap-2">
            {RISK_BANDS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => update('riskBand', b.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  form.riskBand === b.value
                    ? 'border-current shadow-md'
                    : 'border-white/10 bg-white/5 text-slate-400'
                }`}
                style={form.riskBand === b.value ? { color: b.color, borderColor: b.color, backgroundColor: `${b.color}15` } : {}}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <InputLabel required>Risk Disclosure</InputLabel>
          <FormTextarea
            value={form.riskDisclosure}
            onChange={(v) => update('riskDisclosure', v)}
            placeholder="Explain all material risks: market risk, operational risk, liquidity risk, loss of capital..."
            rows={4}
          />
          <InputError message={errors.riskDisclosure} />
        </div>

        <div>
          <InputLabel>Lockup Period (days)</InputLabel>
          <FormInput value={form.lockupPeriodDays} onChange={(v) => update('lockupPeriodDays', v)} type="number" placeholder="90" min="0" />
          <InputError message={errors.lockupPeriodDays} />
        </div>

        <div className="space-y-3">
          <Toggle
            checked={form.shariaCompliant}
            onChange={(v) => update('shariaCompliant', v)}
            label="Sharia Compliant (required)"
          />
          {errors.shariaCompliant && <InputError message={String(errors.shariaCompliant)} />}

          <Toggle
            checked={form.accreditedOnly}
            onChange={(v) => update('accreditedOnly', v)}
            label="Accredited Investors Only"
          />
        </div>

        <div>
          <InputLabel required>Legal Disclaimer</InputLabel>
          <FormTextarea
            value={form.legalDisclaimer}
            onChange={(v) => update('legalDisclaimer', v)}
            placeholder="Include all required legal disclaimers, regulatory notes, and investor warnings..."
            rows={4}
          />
          <InputError message={errors.legalDisclaimer} />
        </div>
      </Surface>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Distribution Settings</h2>
        <p className="mt-1 text-sm text-slate-400">Configure how and when profits are distributed.</p>
      </div>

      <Surface className="space-y-4">
        <div>
          <InputLabel required>Distribution Frequency</InputLabel>
          <FormSelect
            value={form.distributionFreq}
            onChange={(v) => update('distributionFreq', v)}
            options={DISTRIBUTION_FREQS.map((f) => ({
              value: f,
              label: f === 'SEMI_ANNUAL' ? 'Semi-Annual' : f.charAt(0) + f.slice(1).toLowerCase(),
            }))}
          />
        </div>

        <div>
          <InputLabel>Distribution Day (1-28)</InputLabel>
          <FormInput value={form.distributionDay} onChange={(v) => update('distributionDay', v)} type="number" placeholder="1" min="1" max="28" />
          <InputError message={errors.distributionDay} />
        </div>

        <Toggle
          checked={form.autoDistribute}
          onChange={(v) => update('autoDistribute', v)}
          label="Auto-Distribute Profits"
        />

        {form.autoDistribute && (
          <div>
            <InputLabel>Minimum Distribution Threshold ($)</InputLabel>
            <FormInput value={form.minDistribution} onChange={(v) => update('minDistribution', v)} type="number" placeholder="100" min="0" />
            <InputError message={errors.minDistribution} />
          </div>
        )}

        <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/5 p-3">
          <p className="text-xs text-indigo-200">
            <strong>Auto-distribute:</strong> When enabled, profits will be automatically distributed to investors
            when the accumulated profit reaches ${form.minDistribution || '100'} on day {form.distributionDay} of each
            {form.distributionFreq === 'MONTHLY' ? ' month' : form.distributionFreq === 'QUARTERTERLY' ? ' quarter' : form.distributionFreq === 'SEMI_ANNUAL' ? ' 6 months' : ' year'}.
          </p>
        </div>
      </Surface>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Review & Confirm</h2>
        <p className="mt-1 text-sm text-slate-400">Review your pool details before submitting.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SummaryCard title="Pool Basics" step={1} onEdit={() => goToStep(1)}>
          <SummaryRow label="Title" value={form.title} />
          <SummaryRow label="Category" value={form.category} />
          <SummaryRow label="Description" value={form.description.slice(0, 80) + (form.description.length > 80 ? '...' : '')} />
          {form.businessPlanUrl && <SummaryRow label="Business Plan" value={form.businessPlanUrl} />}
        </SummaryCard>

        <SummaryCard title="Financial Terms" step={2} onEdit={() => goToStep(2)}>
          <SummaryRow label="Profit Ratio" value={form.profitShareRatio} />
          <SummaryRow label="Target" value={`$${form.targetAmount}`} />
          <SummaryRow label="Min / Max" value={`$${form.minInvestment} / ${form.maxInvestment || '∞'}`} />
          <SummaryRow label="APY" value={`${form.expectedApy}%`} />
          <SummaryRow label="Calc Method" value={form.profitCalcMethod} />
          <SummaryRow label="Reserve" value={`${form.reserveRatio}%`} />
          <SummaryRow label="Early Withdraw" value={form.allowEarlyWithdraw ? `Yes (${form.earlyWithdrawPenalty}%)` : 'No'} />
        </SummaryCard>

        <SummaryCard title="Use of Funds" step={3} onEdit={() => goToStep(3)}>
          <SummaryRow label="Revenue Source" value={form.revenueSource.slice(0, 50) + '...'} />
          <SummaryRow label="Breakdown Items" value={form.fundBreakdown.length} />
          <SummaryRow label="Total Allocated" value={`$${fundTotal.toFixed(2)}`} />
        </SummaryCard>

        <SummaryCard title="Risk & Compliance" step={4} onEdit={() => goToStep(4)}>
          <SummaryRow label="Risk Band" value={form.riskBand} />
          <SummaryRow label="Lockup" value={`${form.lockupPeriodDays} days`} />
          <SummaryRow label="Sharia Compliant" value={form.shariaCompliant ? 'Yes' : 'No'} />
          <SummaryRow label="Accredited Only" value={form.accreditedOnly ? 'Yes' : 'No'} />
        </SummaryCard>

        <SummaryCard title="Distribution" step={5} onEdit={() => goToStep(5)}>
          <SummaryRow label="Frequency" value={form.distributionFreq} />
          <SummaryRow label="Day" value={form.distributionDay} />
          <SummaryRow label="Auto-Distribute" value={form.autoDistribute ? 'Yes' : 'No'} />
          {form.autoDistribute && <SummaryRow label="Min Threshold" value={`$${form.minDistribution}`} />}
        </SummaryCard>
      </div>

      <Surface className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Declarations</h3>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.termsAccepted}
            onChange={(e) => update('termsAccepted', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 accent-indigo-500"
          />
          <span className="text-sm text-slate-300">
            I accept the <strong>Mudarabah Pool Terms & Conditions</strong> and confirm all information provided is accurate and complete. *
          </span>
        </label>
        {errors.termsAccepted && <InputError message={errors.termsAccepted} />}

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.shariaDeclaration}
            onChange={(e) => update('shariaDeclaration', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 accent-indigo-500"
          />
          <span className="text-sm text-slate-300">
            I declare that this Mudarabah pool structure is <strong>Sharia compliant</strong> — free from riba (interest), gharar (excessive uncertainty), and haram activities. *
          </span>
        </label>
        {errors.shariaDeclaration && <InputError message={errors.shariaDeclaration} />}
      </Surface>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return null;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Create Mudarabah Pool</h1>
          <p className="mt-1 text-sm text-slate-400">Set up a profit-sharing investment pool for your business.</p>
        </div>
        {savedAt && (
          <Badge tone="success">Draft saved at {savedAt}</Badge>
        )}
      </div>

      {/* Step Indicator */}
      <StepIndicator current={step} />

      {/* Step Content */}
      <div className="min-h-[400px] transition-all duration-300">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={goBack}>
              ← Back
            </Button>
          )}
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={saveDraft}>
            Save Draft
          </Button>
          {step < STEPS.length ? (
            <Button variant="primary" onClick={goNext}>
              Next →
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} loading={submitting}>
              Submit Pool
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MudarabahPoolWizard;
