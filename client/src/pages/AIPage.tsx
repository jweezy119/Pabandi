import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { aiRealEstateService } from '../services/api';

const TABS = [
  { id: 'lease', label: '📝 Lease Analyzer', desc: 'Upload & analyze lease' },
  { id: 'maintenance', label: '🔧 Maintenance', desc: 'Get repair advice' },
  { id: 'market', label: '📊 Market Intel', desc: 'Rental insights' },
  { id: 'documents', label: '📄 Documents', desc: 'Generate legal docs' },
  { id: 'valuation', label: '🏠 Valuation', desc: 'Estimate rent/value' },
  { id: 'chat', label: '💬 AI Chat', desc: 'Ask anything' },
];

export const AIPage: React.FC = () => {
  const [tab, setTab] = useState('lease');

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <Badge tone="info" className="mb-3">🤖 AI Real Estate Assistant</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">AI-Powered Real Estate</h1>
          <p className="mt-2 text-slate-400">Analyze leases, get maintenance advice, estimate rent, generate documents.</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[100px] px-3 py-3 rounded-xl text-center transition-all ${tab === t.id ? 'bg-indigo-500/20 border border-indigo-400/30' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
              <div className="text-lg">{t.label.split(' ')[0]}</div>
              <div className="text-xs font-semibold" style={{ color: tab === t.id ? '#a5b4fc' : tokens.color.muted }}>{t.label.split(' ')[1]}</div>
            </button>
          ))}
        </div>

        {tab === 'lease' && <LeaseAnalyzer />}
        {tab === 'maintenance' && <MaintenanceAssistant />}
        {tab === 'market' && <MarketIntelligence />}
        {tab === 'documents' && <DocumentWriter />}
        {tab === 'valuation' && <PropertyValuation />}
        {tab === 'chat' && <AIChat />}
      </div>
    </div>
  );
};

// ── Lease Analyzer ──────────────────────────────────────────────────────────

function LeaseAnalyzer() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await aiRealEstateService.analyzeLease(text);
      setResult(res.data?.data);
    } catch (e) {
      alert('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Surface className="p-4">
        <h3 className="text-base font-bold text-slate-100 mb-3">📝 Lease Analyzer</h3>
        <p className="text-sm mb-3" style={{ color: tokens.color.muted }}>Paste your lease text below. AI will extract terms, flag issues, and give recommendations.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste lease agreement text here..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none h-40 resize-none" />
        <Button onClick={analyze} disabled={loading || !text} className="w-full mt-3">{loading ? 'Analyzing...' : 'Analyze Lease'}</Button>
      </Surface>

      {result && (
        <div className="space-y-4">
          <Surface className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-100">Summary</h3>
              <Badge tone={result.riskLevel === 'high' ? 'danger' : result.riskLevel === 'medium' ? 'warning' : 'success'}>
                Risk: {result.riskLevel?.toUpperCase()} ({result.riskScore}/100)
              </Badge>
            </div>
            <p className="text-sm" style={{ color: tokens.color.muted }}>{result.summary}</p>
          </Surface>

          {result.redFlags?.length > 0 && (
            <Surface className="p-4">
              <h3 className="text-base font-bold text-rose-300 mb-3">🚩 Red Flags</h3>
              <div className="space-y-2">
                {result.redFlags.map((flag: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-rose-500/10">
                    <span className="text-rose-300">•</span>
                    <span className="text-sm text-rose-200">{flag}</span>
                  </div>
                ))}
              </div>
            </Surface>
          )}

          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">📋 Terms Found</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.terms?.map((term: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                  <span className="text-sm text-slate-300">{term.name}</span>
                  <Badge tone={term.status === 'found' ? 'success' : 'danger'}>{term.status}</Badge>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-4">
            <h3 className="text-base font-bold text-emerald-300 mb-3">✅ Recommendations</h3>
            <div className="space-y-2">
              {result.recommendations?.map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10">
                  <span className="text-emerald-300">✓</span>
                  <span className="text-sm text-emerald-200">{rec}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}

// ── Maintenance Assistant ────────────────────────────────────────────────────

function MaintenanceAssistant() {
  const [issue, setIssue] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const getAdvice = async () => {
    if (!issue.trim()) return;
    setLoading(true);
    try {
      const res = await aiRealEstateService.maintenanceAdvice(issue);
      setResult(res.data?.data);
    } catch (e) {
      alert('Failed to get advice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Surface className="p-4">
        <h3 className="text-base font-bold text-slate-100 mb-3">🔧 Maintenance Assistant</h3>
        <p className="text-sm mb-3" style={{ color: tokens.color.muted }}>Describe your maintenance issue. AI will diagnose, estimate costs, and suggest next steps.</p>
        <textarea value={issue} onChange={e => setIssue(e.target.value)} placeholder="e.g., Water leaking from ceiling in bathroom..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none h-24 resize-none" />
        <Button onClick={getAdvice} disabled={loading || !issue} className="w-full mt-3">{loading ? 'Analyzing...' : 'Get Advice'}</Button>
      </Surface>

      {result && (
        <div className="space-y-4">
          <Surface className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-100">{result.category}</h3>
              <Badge tone={result.urgency === 'emergency' ? 'danger' : result.urgency === 'high' ? 'warning' : 'info'}>
                {result.urgency?.toUpperCase()}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>DIY Possible</div>
                <div className="font-bold text-slate-100">{result.diyPossible ? 'Yes' : 'No'}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Est. Cost</div>
                <div className="font-bold text-emerald-300">${result.estimatedCost?.min}–${result.estimatedCost?.max}</div>
              </div>
            </div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>Timeframe: {result.timeframe}</div>
          </Surface>

          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">📋 Steps</h3>
            <div className="space-y-2">
              {result.steps?.map((step: string, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                  <span className="text-indigo-300 font-bold text-sm">{i + 1}.</span>
                  <span className="text-sm text-slate-300">{step}</span>
                </div>
              ))}
            </div>
          </Surface>

          {result.professionalRequired?.length > 0 && (
            <Surface className="p-4">
              <h3 className="text-base font-bold text-amber-300 mb-3">👷 Professional Required</h3>
              <div className="flex flex-wrap gap-2">
                {result.professionalRequired.map((p: string, i: number) => (
                  <Badge key={i} tone="warning">{p}</Badge>
                ))}
              </div>
            </Surface>
          )}

          <Surface className="p-4">
            <h3 className="text-base font-bold text-emerald-300 mb-3">🛡️ Prevention Tips</h3>
            <div className="space-y-2">
              {result.preventionTips?.map((tip: string, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10">
                  <span className="text-emerald-300">✓</span>
                  <span className="text-sm text-emerald-200">{tip}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}

// ── Market Intelligence ──────────────────────────────────────────────────────

function MarketIntelligence() {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const getInsights = async () => {
    if (!city.trim()) return;
    setLoading(true);
    try {
      const res = await aiRealEstateService.marketInsights(city, state);
      setResult(res.data?.data);
    } catch (e) {
      alert('Failed to get insights');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Surface className="p-4">
        <h3 className="text-base font-bold text-slate-100 mb-3">📊 Market Intelligence</h3>
        <p className="text-sm mb-3" style={{ color: tokens.color.muted }}>Get rental market data, trends, and recommendations for any city.</p>
        <div className="flex gap-2">
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="City *" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <input value={state} onChange={e => setState(e.target.value)} placeholder="State" className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <Button onClick={getInsights} disabled={loading || !city}>{loading ? '...' : 'Search'}</Button>
        </div>
      </Surface>

      {result && (
        <div className="space-y-4">
          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">{result.city} Market Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Avg Rent</div>
                <div className="font-bold text-emerald-300">{result.metrics?.avgMonthlyRent ? `$${result.metrics.avgMonthlyRent}` : 'N/A'}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Avg Nightly</div>
                <div className="font-bold text-indigo-300">{result.metrics?.avgNightlyRate ? `$${result.metrics.avgNightlyRate}` : 'N/A'}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Occupancy</div>
                <div className="font-bold text-amber-300">{result.metrics?.occupancyRate ? `${result.metrics.occupancyRate}%` : 'N/A'}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Yield</div>
                <div className="font-bold text-emerald-300">{result.metrics?.estimatedYield || 'N/A'}</div>
              </div>
            </div>
          </Surface>

          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">📈 Insights</h3>
            <div className="space-y-2">
              {result.insights?.map((insight: string, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                  <span className="text-indigo-300">•</span>
                  <span className="text-sm text-slate-300">{insight}</span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-4">
            <h3 className="text-base font-bold text-emerald-300 mb-3">✅ Recommendations</h3>
            <div className="space-y-2">
              {result.recommendations?.map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10">
                  <span className="text-emerald-300">✓</span>
                  <span className="text-sm text-emerald-200">{rec}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}

// ── Document Writer ─────────────────────────────────────────────────────────

function DocumentWriter() {
  const [type, setType] = useState('lease_agreement');
  const [params, setParams] = useState<any>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await aiRealEstateService.generateDocument(type, params);
      setResult(res.data?.data);
    } catch (e) {
      alert('Failed to generate document');
    } finally {
      setLoading(false);
    }
  };

  const docTypes = [
    { id: 'lease_agreement', label: 'Lease Agreement' },
    { id: 'notice_to_vacate', label: 'Notice to Vacate' },
    { id: 'rent_receipt', label: 'Rent Receipt' },
    { id: 'maintenance_request', label: 'Maintenance Request' },
    { id: 'move_in_checklist', label: 'Move-In Checklist' },
    { id: 'pet_addendum', label: 'Pet Addendum' },
  ];

  return (
    <div className="space-y-4">
      <Surface className="p-4">
        <h3 className="text-base font-bold text-slate-100 mb-3">📄 Document Generator</h3>
        <p className="text-sm mb-3" style={{ color: tokens.color.muted }}>Generate legal documents for real estate transactions.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          {docTypes.map(d => (
            <button key={d.id} onClick={() => setType(d.id)}
              className={`p-2 rounded-lg text-sm font-semibold ${type === d.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Landlord Name" onChange={e => setParams({ ...params, landlordName: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <input placeholder="Tenant Name" onChange={e => setParams({ ...params, tenantName: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <input placeholder="Property Address" onChange={e => setParams({ ...params, propertyAddress: e.target.value })} className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <input placeholder="Rent Amount" onChange={e => setParams({ ...params, rentAmount: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <input placeholder="Deposit Amount" onChange={e => setParams({ ...params, depositAmount: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
        </div>
        <Button onClick={generate} disabled={loading} className="w-full mt-3">{loading ? 'Generating...' : 'Generate Document'}</Button>
      </Surface>

      {result && (
        <Surface className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-100">{result.title}</h3>
            <Button onClick={() => navigator.clipboard.writeText(result.content)} size="sm" variant="ghost">Copy</Button>
          </div>
          <pre className="p-3 rounded-lg bg-black/40 text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-96">{result.content}</pre>
          {result.warnings?.length > 0 && (
            <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              {result.warnings.map((w: string, i: number) => (
                <div key={i} className="text-xs text-amber-200">⚠️ {w}</div>
              ))}
            </div>
          )}
        </Surface>
      )}
    </div>
  );
}

// ── Property Valuation ───────────────────────────────────────────────────────

function PropertyValuation() {
  const [form, setForm] = useState({ city: '', state: '', bedrooms: '2', bathrooms: '1', sqft: '1000', condition: 'good' });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const estimate = async () => {
    if (!form.city.trim()) return;
    setLoading(true);
    try {
      const res = await aiRealEstateService.propertyValuation(form);
      setResult(res.data?.data);
    } catch (e) {
      alert('Failed to estimate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Surface className="p-4">
        <h3 className="text-base font-bold text-slate-100 mb-3">🏠 Property Valuation</h3>
        <p className="text-sm mb-3" style={{ color: tokens.color.muted }}>Estimate monthly rent and property value based on market data.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City *" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <select value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} BR</option>)}
          </select>
          <select value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
            {[1,1.5,2,2.5,3].map(n => <option key={n} value={n}>{n} BA</option>)}
          </select>
          <input value={form.sqft} onChange={e => setForm({ ...form, sqft: e.target.value })} placeholder="Sqft" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none">
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </div>
        <Button onClick={estimate} disabled={loading || !form.city} className="w-full mt-3">{loading ? 'Estimating...' : 'Estimate Value'}</Button>
      </Surface>

      {result && (
        <div className="space-y-4">
          <Surface className="p-4">
            <h3 className="text-base font-bold text-slate-100 mb-3">{result.address || `${result.city} Property`}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Monthly Rent</div>
                <div className="font-bold text-emerald-300">${result.valuation?.estimatedMonthlyRent?.toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Annual Rent</div>
                <div className="font-bold text-indigo-300">${result.valuation?.estimatedAnnualRent?.toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Est. Value</div>
                <div className="font-bold text-amber-300">${result.valuation?.estimatedPropertyValue?.toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-xs" style={{ color: tokens.color.muted }}>Yield</div>
                <div className="font-bold text-emerald-300">{result.valuation?.grossRentalYield}</div>
              </div>
            </div>
          </Surface>

          <Surface className="p-4">
            <h3 className="text-base font-bold text-emerald-300 mb-3">✅ Recommendations</h3>
            <div className="space-y-2">
              {result.recommendations?.map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10">
                  <span className="text-emerald-300">✓</span>
                  <span className="text-sm text-emerald-200">{rec}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}

// ── AI Chat ─────────────────────────────────────────────────────────────────

function AIChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: 'Hi! I\'m Pabandi\'s AI real estate assistant. I can help with lease analysis, maintenance advice, market insights, property valuation, and document generation. What can I help you with?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await aiRealEstateService.chat(input);
      setMessages([...newMessages, { role: 'assistant', content: res.data?.data?.response }]);
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface className="p-4">
      <h3 className="text-base font-bold text-slate-100 mb-3">💬 AI Chat</h3>
      <div className="h-96 overflow-y-auto space-y-3 mb-3 p-3 rounded-lg bg-black/20">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${m.role === 'user' ? 'bg-indigo-500/20 text-indigo-100' : 'bg-white/5 text-slate-300'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-slate-500">Thinking...</div>}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about real estate..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
        <Button onClick={send} disabled={loading || !input}>Send</Button>
      </div>
    </Surface>
  );
}

export default AIPage;
