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
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🧠 Advanced Intelligence</Badge>
          <h1 className="text-3xl font-black text-[var(--warm-ink)] font-headline">Property Intelligence</h1>
          <p className="mt-3 text-[var(--soft-stone)]">Neighborhood scoring, price velocity, and predictive analytics.</p>
        </div>

        <Surface className="p-4 md:p-6 mb-6">
          <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">Property Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City *" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
            <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State *" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
            <input value={form.sqft} onChange={e => setForm({ ...form, sqft: e.target.value })} placeholder="Square Feet *" type="number" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
            <input value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} placeholder="Bedrooms *" type="number" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
            <input value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} placeholder="Bathrooms *" type="number" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
            <input value={form.yearBuilt} onChange={e => setForm({ ...form, yearBuilt: e.target.value })} placeholder="Year Built" type="number" className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
            <select value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none">
              <option value="single_family">Single Family</option><option value="condo">Condo</option><option value="townhouse">Townhouse</option><option value="multi_family">Multi-Family</option>
            </select>
            <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none">
              <option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option>
            </select>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--soft-stone)]"><input type="checkbox" checked={form.hasGarage} onChange={e => setForm({ ...form, hasGarage: e.target.checked })} /> Garage</label>
              <label className="flex items-center gap-2 text-sm text-[var(--soft-stone)]"><input type="checkbox" checked={form.hasPool} onChange={e => setForm({ ...form, hasPool: e.target.checked })} /> Pool</label>
            </div>
          </div>
          <Button onClick={analyze} disabled={!form.city || !form.state || !form.bedrooms || !form.sqft} className="w-full mt-4">{loading ? 'Analyzing...' : 'Analyze Property'}</Button>
        </Surface>

        {result && !result.error && (
          <div className="space-y-4">
            {/* Valuation */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">💰 Valuation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center"><div className="text-xl font-bold text-[var(--sage)]">${result.valuation?.estimatedValue?.toLocaleString()}</div><div className="text-xs" style={{ color: 'var(--soft-stone)' }}>Est. Value</div></div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center"><div className="text-xl font-bold text-[var(--clay)]">${result.valuation?.rentalEstimate}</div><div className="text-xs" style={{ color: 'var(--soft-stone)' }}>Monthly Rent</div></div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center"><div className="text-xl font-bold text-[var(--muted-ochre)]">{result.valuation?.rentalYield}%</div><div className="text-xs" style={{ color: 'var(--soft-stone)' }}>Rental Yield</div></div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center"><div className="text-xl font-bold text-[var(--dusty-rose)]">{result.investmentScore}/100</div><div className="text-xs" style={{ color: 'var(--soft-stone)' }}>Investment Score</div></div>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-[var(--warm-sand)]">
                <div className="text-xs text-[var(--soft-stone)]">Confidence Range</div>
                <div className="text-sm text-[var(--warm-ink)]">${result.valuation?.range?.low?.toLocaleString()} — ${result.valuation?.range?.high?.toLocaleString()}</div>
                <div className="w-full h-2 rounded-full bg-[var(--warm-sand)] mt-2 relative">
                  <div className="absolute h-full rounded-full bg-[var(--sage)]/50" style={{ left: '10%', width: '80%' }} />
                  <div className="absolute h-full w-1 bg-[var(--sage)] rounded" style={{ left: '50%' }} />
                </div>
              </div>
            </Surface>

            {/* Neighborhood */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">🏘️ Neighborhood Score: {result.neighborhood?.overall}/100</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {result.neighborhood && Object.entries(result.neighborhood).filter(([k]) => ['schools', 'safety', 'walkability', 'transit', 'amenities'].includes(k)).map(([key, val]) => (
                  <div key={key} className="p-3 rounded-xl bg-[var(--warm-sand)] text-center">
                    <div className="text-lg font-bold text-[var(--warm-ink)]">{val as number}</div>
                    <div className="text-xs capitalize" style={{ color: 'var(--soft-stone)' }}>{key}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1">
                {result.neighborhood?.factors?.map((f: string, i: number) => (<div key={i} className="text-sm text-[var(--soft-stone)]">• {f}</div>))}
              </div>
            </Surface>

            {/* Price Velocity */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">📈 Price Velocity</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center"><div className="text-lg font-bold text-[var(--sage)]">{result.priceVelocity?.yearlyChange}%</div><div className="text-xs" style={{ color: 'var(--soft-stone)' }}>Yearly Change</div></div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center"><div className="text-lg font-bold text-[var(--warm-ink)]">{result.priceVelocity?.daysOnMarket}</div><div className="text-xs" style={{ color: 'var(--soft-stone)' }}>Days on Market</div></div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center"><div className="text-lg font-bold text-[var(--warm-ink)]">{result.priceVelocity?.inventoryMonths}</div><div className="text-xs" style={{ color: 'var(--soft-stone)' }}>Months Inventory</div></div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center"><div className="text-lg font-bold text-[var(--clay)]">{result.priceVelocity?.momentum}</div><div className="text-xs" style={{ color: 'var(--soft-stone)' }}>Momentum</div></div>
              </div>
            </Surface>

            {/* Predictions */}
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">🔮 Predictions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-2">Property Value</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)]"><span className="text-xs text-[var(--soft-stone)]">1 Year</span><span className="text-sm font-bold text-[var(--sage)]">${result.predictions?.value1Year?.toLocaleString()}</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)]"><span className="text-xs text-[var(--soft-stone)]">3 Years</span><span className="text-sm font-bold text-[var(--sage)]">${result.predictions?.value3Year?.toLocaleString()}</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)]"><span className="text-xs text-[var(--soft-stone)]">5 Years</span><span className="text-sm font-bold text-[var(--sage)]">${result.predictions?.value5Year?.toLocaleString()}</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-2">Rental Income</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)]"><span className="text-xs text-[var(--soft-stone)]">1 Year</span><span className="text-sm font-bold text-[var(--clay)]">${result.predictions?.rent1Year}</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)]"><span className="text-xs text-[var(--soft-stone)]">3 Years</span><span className="text-sm font-bold text-[var(--clay)]">${result.predictions?.rent3Year}</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)]"><span className="text-xs text-[var(--soft-stone)]">5 Years</span><span className="text-sm font-bold text-[var(--clay)]">${result.predictions?.rent5Year}</span></div>
                  </div>
                </div>
              </div>
            </Surface>

            {/* Risks & Opportunities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.risks?.length > 0 && (
                <Surface className="p-4">
                  <h4 className="text-sm font-bold text-[var(--muted-ochre)] mb-2">⚠️ Risks</h4>
                  {result.risks.map((r: string, i: number) => (<div key={i} className="text-xs text-[var(--soft-stone)] mb-1">• {r}</div>))}
                </Surface>
              )}
              {result.opportunities?.length > 0 && (
                <Surface className="p-4">
                  <h4 className="text-sm font-bold text-[var(--sage)] mb-2">✨ Opportunities</h4>
                  {result.opportunities.map((o: string, i: number) => (<div key={i} className="text-xs text-[var(--soft-stone)] mb-1">• {o}</div>))}
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
