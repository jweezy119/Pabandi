import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { aiAdvancedService } from '../services/api';

export const PortfolioAnalyzerPage: React.FC = () => {
  const [properties, setProperties] = useState<any[]>([
    { id: '1', address: '123 Main St', city: 'Chicago', state: 'IL', purchasePrice: 250000, currentValue: 280000, monthlyRent: 1800, monthlyExpenses: 800, mortgage: 1200, type: 'single_family', acquisitionDate: '2023-01-15' },
    { id: '2', address: '456 Oak Ave', city: 'Chicago', state: 'IL', purchasePrice: 180000, currentValue: 200000, monthlyRent: 1200, monthlyExpenses: 600, mortgage: 900, type: 'condo', acquisitionDate: '2023-06-20' },
  ]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await aiAdvancedService.portfolioAnalyzer({ properties });
      setResult(res.data?.data);
    } catch (e) { alert('Analysis failed'); }
    setLoading(false);
  };

  const addProperty = () => {
    setProperties([...properties, { id: Date.now().toString(), address: '', city: '', state: '', purchasePrice: 0, currentValue: 0, monthlyRent: 0, monthlyExpenses: 0, mortgage: 0, type: 'single_family', acquisitionDate: '' }]);
  };

  const updateProperty = (id: string, field: string, value: any) => {
    setProperties(properties.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">📊 Portfolio Analyzer</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Portfolio Intelligence</h1>
          <p className="mt-3 text-slate-400">Diversification scoring, aggregate metrics, and benchmarking.</p>
        </div>

        <Surface className="p-4 md:p-6 mb-6">
          <h3 className="text-base font-bold text-slate-100 mb-4">Properties ({properties.length})</h3>
          <div className="space-y-3">
            {properties.map((p) => (
              <div key={p.id} className="p-3 rounded-xl bg-white/5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                <input value={p.address} onChange={e => updateProperty(p.id, 'address', e.target.value)} placeholder="Address" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 outline-none" />
                <input value={p.city} onChange={e => updateProperty(p.id, 'city', e.target.value)} placeholder="City" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 outline-none" />
                <input value={p.state} onChange={e => updateProperty(p.id, 'state', e.target.value)} placeholder="State" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 outline-none" />
                <input value={p.purchasePrice} onChange={e => updateProperty(p.id, 'purchasePrice', parseFloat(e.target.value) || 0)} placeholder="Purchase" type="number" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 outline-none" />
                <input value={p.currentValue} onChange={e => updateProperty(p.id, 'currentValue', parseFloat(e.target.value) || 0)} placeholder="Value" type="number" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 outline-none" />
                <input value={p.monthlyRent} onChange={e => updateProperty(p.id, 'monthlyRent', parseFloat(e.target.value) || 0)} placeholder="Rent" type="number" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 outline-none" />
                <input value={p.mortgage} onChange={e => updateProperty(p.id, 'mortgage', parseFloat(e.target.value) || 0)} placeholder="Mortgage" type="number" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 outline-none" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={addProperty} variant="ghost">+ Add Property</Button>
            <Button onClick={analyze} disabled={loading} className="flex-1">{loading ? 'Analyzing...' : 'Analyze Portfolio'}</Button>
          </div>
        </Surface>

        {result && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-emerald-300">${(result.summary?.totalValue / 1000).toFixed(0)}K</div><div className="text-xs" style={{ color: tokens.color.muted }}>Total Value</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-indigo-300">{result.summary?.cashOnCashReturn}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Cash-on-Cash</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-amber-300">{result.summary?.capRate}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Cap Rate</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-purple-300">{result.summary?.weightedDscr}</div><div className="text-xs" style={{ color: tokens.color.muted }}>DSCR</div></div>
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">Diversification Score: {result.diversification?.score}/100</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {result.diversification?.byType && Object.entries(result.diversification.byType).map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-slate-100">{v as number}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>{k}</div></div>
                ))}
              </div>
              {result.diversification?.recommendations?.length > 0 && (
                <div className="mt-4 space-y-1">
                  {result.diversification.recommendations.map((r: string, i: number) => (<div key={i} className="text-sm text-amber-300">• {r}</div>))}
                </div>
              )}
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">Risk Assessment</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-rose-300">{result.risk?.concentrationRisk}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Concentration</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-amber-300">{result.risk?.leverageRisk}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Leverage</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-slate-100">{result.risk?.vacancyRisk}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Vacancy</div></div>
                <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-rose-300">{result.risk?.overallRisk}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Overall</div></div>
              </div>
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioAnalyzerPage;
