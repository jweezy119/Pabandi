import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';

export const AdvancedPropertyIntelligencePage: React.FC = () => {
  const [form, setForm] = useState({ city: '', state: '', bedrooms: '', bathrooms: '', sqft: '', yearBuilt: '', propertyType: 'single_family', condition: 'good', hasGarage: false, hasPool: false });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/advanced/property-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, bedrooms: parseInt(form.bedrooms), bathrooms: parseFloat(form.bathrooms), sqft: parseInt(form.sqft), yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : undefined }),
      });
      const data = await res.json();
      setResult(data.data);
    } catch (e) { setResult({ error: 'Analysis failed' }); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🧠 Advanced Intelligence</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Property Intelligence</h1>
          <p className="mt-3 text-slate-400">Neighborhood scoring, price velocity, and predictive analytics.</p>
        </div>

        <Surface className="p-4 md:p-6 mb-6">
          <h3 className="text-base font-bold text-slate-100 mb-4">Property Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.sqft} onChange={e => setForm({ ...form, sqft: e.target.value })} placeholder="Square Feet *" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} placeholder="Bedrooms *" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} placeholder="Bathrooms *" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.yearBuilt} onChange={e => setForm({ ...form, yearBuilt: e.target.value })} placeholder="Year Built" type="number" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <select value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
              <option value="single_family">Single Family</option><option value="condo">Condo</option><option value="townhouse">Townhouse</option><option value="multi_family">Multi-Family</option>
            </select>
            <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
              <option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option>
            </select>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.hasGarage} onChange={e => setForm({ ...form, hasGarage: e.target.checked })} /> Garage</label>
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.hasPool} onChange={e => setForm({ ...form, hasPool: e.target.checked })} /> Pool</label>
            </div>
          </div>
          <Button onClick={analyze} disabled={!form.city || !form.state || !form.bedrooms || !form.sqft} className="w-full mt-4">{loading ? 'Analyzing...' : 'Analyze Property'}</Button>
        </Surface>

        {result && !result.error && (
          <div className="space-y-4">
            {/* Valuation */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">💰 Valuation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-emerald-300">${result.valuation?.estimatedValue?.toLocaleString()}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Est. Value</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-indigo-300">${result.valuation?.rentalEstimate}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Monthly Rent</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-amber-300">{result.valuation?.rentalYield}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Rental Yield</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-purple-300">{result.investmentScore}/100</div><div className="text-xs" style={{ color: tokens.color.muted }}>Investment Score</div></div>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-white/5">
                <div className="text-xs text-slate-400">Confidence Range</div>
                <div className="text-sm text-slate-100">${result.valuation?.range?.low?.toLocaleString()} — ${result.valuation?.range?.high?.toLocaleString()}</div>
                <div className="w-full h-2 rounded-full bg-white/10 mt-2 relative">
                  <div className="absolute h-full rounded-full bg-emerald-500/50" style={{ left: '10%', width: '80%' }} />
                  <div className="absolute h-full w-1 bg-emerald-400 rounded" style={{ left: '50%' }} />
                </div>
              </div>
            </Surface>

            {/* Neighborhood */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🏘️ Neighborhood Score: {result.neighborhood?.overall}/100</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {result.neighborhood && Object.entries(result.neighborhood).filter(([k]) => ['schools', 'safety', 'walkability', 'transit', 'amenities'].includes(k)).map(([key, val]) => (
                  <div key={key} className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-lg font-bold text-slate-100">{val as number}</div>
                    <div className="text-xs capitalize" style={{ color: tokens.color.muted }}>{key}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1">
                {result.neighborhood?.factors?.map((f: string, i: number) => (<div key={i} className="text-sm text-slate-300">• {f}</div>))}
              </div>
            </Surface>

            {/* Price Velocity */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">📈 Price Velocity</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-emerald-300">{result.priceVelocity?.yearlyChange}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Yearly Change</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-slate-100">{result.priceVelocity?.daysOnMarket}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Days on Market</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-slate-100">{result.priceVelocity?.inventoryMonths}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Months Inventory</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-indigo-300">{result.priceVelocity?.momentum}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Momentum</div></div>
              </div>
            </Surface>

            {/* Predictions */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🔮 Predictions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 mb-2">Property Value</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 rounded-lg bg-white/5"><span className="text-xs text-slate-400">1 Year</span><span className="text-sm font-bold text-emerald-300">${result.predictions?.value1Year?.toLocaleString()}</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/5"><span className="text-xs text-slate-400">3 Years</span><span className="text-sm font-bold text-emerald-300">${result.predictions?.value3Year?.toLocaleString()}</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/5"><span className="text-xs text-slate-400">5 Years</span><span className="text-sm font-bold text-emerald-300">${result.predictions?.value5Year?.toLocaleString()}</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100 mb-2">Rental Income</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 rounded-lg bg-white/5"><span className="text-xs text-slate-400">1 Year</span><span className="text-sm font-bold text-indigo-300">${result.predictions?.rent1Year}</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/5"><span className="text-xs text-slate-400">3 Years</span><span className="text-sm font-bold text-indigo-300">${result.predictions?.rent3Year}</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/5"><span className="text-xs text-slate-400">5 Years</span><span className="text-sm font-bold text-indigo-300">${result.predictions?.rent5Year}</span></div>
                  </div>
                </div>
              </div>
            </Surface>

            {/* Risks & Opportunities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.risks?.length > 0 && (
                <Surface className="p-4">
                  <h4 className="text-sm font-bold text-amber-300 mb-2">⚠️ Risks</h4>
                  {result.risks.map((r: string, i: number) => (<div key={i} className="text-xs text-slate-300 mb-1">• {r}</div>))}
                </Surface>
              )}
              {result.opportunities?.length > 0 && (
                <Surface className="p-4">
                  <h4 className="text-sm font-bold text-emerald-300 mb-2">✨ Opportunities</h4>
                  {result.opportunities.map((o: string, i: number) => (<div key={i} className="text-xs text-slate-300 mb-1">• {o}</div>))}
                </Surface>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedPropertyIntelligencePage;
