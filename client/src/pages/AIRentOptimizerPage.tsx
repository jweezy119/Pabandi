import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { aiRealEstateService } from '../services/api';

interface RentOptResult {
  recommendedRent: number;
  currentRent: number;
  changePct: number;
  confidence: number;
  comps: { city: string; state: string; rent: number; beds?: number; baths?: number }[];
  explanation: string;
}

export const AIRentOptimizerPage: React.FC = () => {
  const [form, setForm] = useState({ city: '', state: '', propertyType: 'single_family', currentRent: '' });
  const [result, setResult] = useState<RentOptResult | null>(null);
  const [loading, setLoading] = useState(false);

  const optimize = async () => {
    setLoading(true);
    try {
      const res = await aiRealEstateService.optimizeRent({
        ...form,
        currentRent: Number(form.currentRent),
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1100,
        yearBuilt: 2010,
      });
      const payload = res.data?.data as any;
      setResult({
        recommendedRent: typeof payload?.recommendedRent === 'number' ? payload.recommendedRent : Number(form.currentRent || 0),
        currentRent: Number(form.currentRent || 0),
        changePct: typeof payload?.changePct === 'number' ? payload.changePct : 0,
        confidence: typeof payload?.confidence === 'number' ? payload.confidence : 0,
        comps: Array.isArray(payload?.comps) ? payload.comps : [],
        explanation: typeof payload?.explanation === 'string' ? payload.explanation : '',
      });
    } catch (e) {
      alert('Optimization failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">📈 AI Rent Optimizer</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Rent Optimizer</h1>
          <p className="mt-3 text-slate-400">Market-based rent recommendations with confidence scoring.</p>
        </div>

        <Surface className="p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <select value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
              <option value="single_family">Single Family</option>
              <option value="condo">Condo</option>
              <option value="townhouse">Townhouse</option>
              <option value="multi_family">Multi-Family</option>
            </select>
            <input value={form.currentRent} onChange={e => setForm({ ...form, currentRent: e.target.value })} placeholder="Current rent" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          </div>
          <Button onClick={optimize} disabled={!form.city || !form.state} className="w-full mt-4">{loading ? 'Optimizing...' : 'Optimize Rent'}</Button>
        </Surface>

        {result && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-100">Recommended rent</h3>
                  <p className="text-sm" style={{ color: tokens.color.muted }}>Confidence: {Math.round((result.confidence || 0) * 100)}%</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-100">${result.recommendedRent.toLocaleString()}</div>
                  <div className="text-sm" style={{ color: result.changePct >= 0 ? '#16a34a' : '#dc2626' }}>{result.changePct >= 0 ? '+' : ''}{result.changePct}% vs current</div>
                </div>
              </div>
              <p className="text-sm mt-3 text-slate-300">{result.explanation}</p>
            </Surface>

            {result.comps.length > 0 && (
              <Surface className="p-4 md:p-6">
                <h3 className="text-lg font-bold text-slate-100 mb-3">Comparable listings</h3>
                <div className="space-y-2">
                  {result.comps.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 text-sm text-slate-300">
                      <div>{c.city}, {c.state}</div>
                      <div className="font-bold text-slate-100">${c.rent?.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </Surface>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
