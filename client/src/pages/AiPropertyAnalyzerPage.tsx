import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

export const AiPropertyAnalyzerPage: React.FC = () => {
  const [form, setForm] = useState({
    city: '', state: '', zip: '', bedrooms: '', bathrooms: '', sqft: '',
    yearBuilt: '', propertyType: 'single_family', condition: 'good',
    lotSize: '', hasGarage: false, hasPool: false,
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/analyze-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          bedrooms: parseInt(form.bedrooms),
          bathrooms: parseFloat(form.bathrooms),
          sqft: parseInt(form.sqft),
          yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
          lotSize: form.lotSize ? parseFloat(form.lotSize) : undefined,
        }),
      });
      const data = await res.json();
      setResult(data.data);
    } catch (e) {
      setResult({ error: 'Analysis failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🤖 AI Property Analyzer</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Property Valuation</h1>
          <p className="mt-3 text-slate-400">Get instant property valuation, rental estimate, and investment analysis.</p>
        </div>

        <Surface className="p-4 md:p-6 mb-6">
          <h3 className="text-base font-bold text-slate-100 mb-4">Property Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} placeholder="Bedrooms *" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} placeholder="Bathrooms *" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.sqft} onChange={e => setForm({ ...form, sqft: e.target.value })} placeholder="Square Feet *" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.yearBuilt} onChange={e => setForm({ ...form, yearBuilt: e.target.value })} placeholder="Year Built" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <select value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
              <option value="single_family">Single Family</option>
              <option value="condo">Condo</option>
              <option value="townhouse">Townhouse</option>
              <option value="multi_family">Multi-Family</option>
            </select>
            <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          <Button onClick={analyze} disabled={!form.city || !form.state || !form.bedrooms || !form.sqft} className="w-full mt-4">
            {loading ? 'Analyzing...' : 'Analyze Property'}
          </Button>
        </Surface>

        {result && !result.error && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">Valuation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 text-center">
                  <div className="text-xl font-bold text-emerald-300">${result.estimatedValue?.toLocaleString()}</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>Est. Value</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 text-center">
                  <div className="text-xl font-bold text-indigo-300">${result.rentalEstimate}</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>Monthly Rent</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 text-center">
                  <div className="text-xl font-bold text-amber-300">{result.capRate}%</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>Cap Rate</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 text-center">
                  <div className="text-xl font-bold text-purple-300">{result.roi5Year}%</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>5-Year ROI</div>
                </div>
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">Analysis</h3>
              <div className="space-y-2">
                {result.factors?.map((f: string, i: number) => (
                  <div key={i} className="text-sm text-slate-300">• {f}</div>
                ))}
              </div>
              {result.risks?.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-sm font-bold text-amber-300 mb-2">Risks</div>
                  {result.risks.map((r: string, i: number) => (
                    <div key={i} className="text-xs text-amber-200/80">• {r}</div>
                  ))}
                </div>
              )}
              {result.opportunities?.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-sm font-bold text-emerald-300 mb-2">Opportunities</div>
                  {result.opportunities.map((o: string, i: number) => (
                    <div key={i} className="text-xs text-emerald-200/80">• {o}</div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiPropertyAnalyzerPage;
