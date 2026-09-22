import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { aiAdvancedService } from '../services/api';

interface TenantRiskResult {
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  depositAdjPct: number;
  explanations: string[];
}

export const AITenantRiskPage: React.FC = () => {
  const [form, setForm] = useState({ tenantName: '', state: '', propertyType: 'single_family' });
  const [result, setResult] = useState<TenantRiskResult | null>(null);
  const [loading, setLoading] = useState(false);

  const predict = async () => {
    setLoading(true);
    try {
      const res = await aiAdvancedService.tenantIntelligence({
        ...form,
        annualIncome: 0,
        creditScore: 650,
        moveHistory: [],
      });
      const payload = res.data?.data as any;
      setResult({
        riskBand: payload?.riskBand || 'MEDIUM',
        depositAdjPct: payload?.recommendedDepositAdjPct ?? 0,
        explanations: Array.isArray(payload?.explanations) ? payload.explanations : [],
      });
    } catch (e) {
      alert('Prediction failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)" }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🤖 AI Tenant Risk Predictor</Badge>
          <h1 className="text-3xl font-black text-[var(--warm-ink)] font-headline">Tenant Risk Score</h1>
          <p className="mt-3 text-[var(--soft-stone)]">CourtListener + AI risk banding for safer leasing.</p>
        </div>

        <Surface className="p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.tenantName} onChange={e => setForm({ ...form, tenantName: e.target.value })} placeholder="Tenant name" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
            <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
            <select value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none">
              <option value="single_family">Single Family</option>
              <option value="condo">Condo</option>
              <option value="townhouse">Townhouse</option>
              <option value="multi_family">Multi-Family</option>
            </select>
          </div>
          <Button onClick={predict} disabled={!form.tenantName || !form.state} className="w-full mt-4">{loading ? 'Predicting...' : 'Predict Risk'}</Button>
        </Surface>

        {result && (
          <Surface className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-[var(--warm-ink)]">{form.tenantName}</h3>
                <p className="text-sm" style={{ color: 'var(--soft-stone)" }}>AI predicted risk based on screening signals</p>
              </div>
              <Badge tone={result.riskBand === 'LOW' ? 'success' : result.riskBand === 'MEDIUM' ? 'warning' : 'danger'}>{result.riskBand}</Badge>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-[var(--warm-sand)] text-sm text-[var(--soft-stone)]">
              Recommended deposit adjustment: <span className="font-bold text-[var(--warm-ink)]">{result.depositAdjPct > 0 ? `+${result.depositAdjPct}%` : `${result.depositAdjPct}%`}</span>
            </div>
            <div className="mt-3 space-y-1 text-sm text-[var(--soft-stone)]">
              {(result.explanations || []).map((ex, i) => (
                <div key={i} className="p-2 rounded-lg bg-[var(--warm-sand)]">• {ex}</div>
              ))}
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
};
