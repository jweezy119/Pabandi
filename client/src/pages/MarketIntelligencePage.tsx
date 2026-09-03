import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { aiAdvancedService } from '../services/api';

export const MarketIntelligencePage: React.FC = () => {
  const [form, setForm] = useState({ city: '', state: '', propertyType: '' });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await aiAdvancedService.marketIntelligence(form);
      setResult(res.data?.data);
    } catch (e) { alert('Analysis failed'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">📊 Market Intelligence</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Market Analysis</h1>
          <p className="mt-3 text-slate-400">Supply/demand scoring, trends, and forecasting.</p>
        </div>

        <Surface className="p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
            <select value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
              <option value="">All Types</option>
              <option value="single_family">Single Family</option>
              <option value="condo">Condo</option>
              <option value="townhouse">Townhouse</option>
              <option value="multi_family">Multi-Family</option>
            </select>
          </div>
          <Button onClick={analyze} disabled={!form.city || !form.state} className="w-full mt-4">{loading ? 'Analyzing...' : 'Analyze Market'}</Button>
        </Surface>

        {result && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">Supply & Demand</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-indigo-300">{result.supplyDemand?.score}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Score</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-emerald-300">{result.supplyDemand?.monthsOfInventory}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Months Inv.</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-amber-300">{result.supplyDemand?.daysOnMarket}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Days on Mkt</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-sm font-bold text-slate-100">{result.supplyDemand?.classification}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Class</div></div>
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">Forecasts</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-emerald-300">{result.forecast?.priceNextYear}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Price 1Y</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-indigo-300">{result.forecast?.rentNextYear}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Rent 1Y</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-amber-300">{result.forecast?.confidence}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Confidence</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-sm font-bold text-slate-100">{result.seasonality?.bestMonthToSell}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Best Sell</div></div>
              </div>
            </Surface>

            {result.signals?.length > 0 && (
              <Surface className="p-4 md:p-6">
                <h3 className="text-base font-bold text-slate-100 mb-4">Signals</h3>
                <div className="space-y-2">
                  {result.signals.map((s: string, i: number) => (<div key={i} className="text-sm text-slate-300">• {s}</div>))}
                </div>
              </Surface>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketIntelligencePage;
