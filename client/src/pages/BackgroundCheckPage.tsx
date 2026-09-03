import { useState } from 'react';
import { courtCheckService, backgroundCheckService } from '../services/api';
import { tokens } from '../design-system';

type Tab = 'court' | 'comprehensive' | 'history' | 'batch';

type CheckResult = any;

const BAND_COLOR: Record<string, string> = {
  A: '#16a34a',
  B: '#22c55e',
  C: '#ca8a04',
  D: '#f97316',
  E: '#dc2626',
  LOW: '#16a34a',
  MEDIUM: '#ca8a04',
  HIGH: '#dc2626',
};

export default function BackgroundCheckPage() {
  const [tab, setTab] = useState<Tab>('court');
  const [batchResult, setBatchResult] = useState<any>(null);
  const [batchError, setBatchError] = useState('');

  // CourtListener state
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advanced, setAdvanced] = useState({ court: '', docketNumber: '', partyName: '', attorneyName: '', dateFiledAfter: '', dateFiledBefore: '' });
  const [courtLoading, setCourtLoading] = useState(false);
  const [courtResult, setCourtResult] = useState<CheckResult | null>(null);
  const [courtError, setCourtError] = useState('');

  // Comprehensive check state
  const [cForm, setCForm] = useState({ subjectName: '', subjectType: 'GUEST', subjectEmail: '', subjectPhone: '', subjectWallet: '', subjectGithub: '', subjectWebsite: '', subjectCompany: '', consent: true });
  const [compLoading, setCompLoading] = useState(false);
  const [compResult, setCompResult] = useState<CheckResult | null>(null);
  const [compError, setCompError] = useState('');

  // History state
  const [history, setHistory] = useState<CheckResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Batch state
  const [batchText, setBatchText] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  const runCourtCheck = async () => {
    if (!name.trim()) return;
    setCourtError('');
    setCourtResult(null);
    setCourtLoading(true);
    try {
      const res = await courtCheckService.courtCheckByName(name, state, {
        court: advanced.court || undefined,
        dateFiledAfter: advanced.dateFiledAfter || undefined,
        dateFiledBefore: advanced.dateFiledBefore || undefined,
        docketNumber: advanced.docketNumber || undefined,
        partyName: advanced.partyName || undefined,
        attorneyName: advanced.attorneyName || undefined,
      });
      const payload = (res.data?.data || res.data) as CheckResult;
      setCourtResult({ ...payload, simulated: payload.simulated });
    } catch (e: any) {
      setCourtError(e.response?.data?.error || e.message || 'Check failed');
    } finally {
      setCourtLoading(false);
    }
  };

  const runComprehensive = async () => {
    if (!cForm.subjectName.trim()) return;
    setCompError('');
    setCompResult(null);
    setCompLoading(true);
    try {
      const res = await backgroundCheckService.create({
        ...cForm,
        subjectType: cForm.subjectType as any,
        pabFee: 0,
      });
      const id = res.data?.data?.checkId;
      if (!id) throw new Error('No check ID returned');
      // Poll for completion
      let check: CheckResult | null = null;
      for (let i = 0; i < 20; i++) {
        const r = await backgroundCheckService.get(id);
        check = r.data?.data || r.data;
        if (check?.status === 'COMPLETE' || check?.status === 'FAILED') break;
        await new Promise((r2) => setTimeout(r2, 1200));
      }
      setCompResult(check || { id, simulated: false });
    } catch (e: any) {
      setCompError(e.response?.data?.error || e.message || 'Check failed');
    } finally {
      setCompLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await backgroundCheckService.list();
      const items = (res.data?.data || []) as CheckResult[];
      setHistory(items);
    } catch {
      // history optional
    } finally {
      setHistoryLoading(false);
    }
  };

  const runBatch = async () => {
    const lines = batchText.split('\n').filter((l) => l.trim());
    if (!lines.length) return;
    setBatchError('');
    setBatchResult(null);
    setBatchLoading(true);
    try {
      const requests = lines.map((line) => {
        const parts = line.split(',');
        const name = parts[0]?.trim() || 'Unknown';
        const type = (parts[1]?.trim() as any) || 'GUEST';
        return {
          subjectType: type,
          subjectName: name,
          subjectEmail: parts[2]?.trim() || undefined,
          pabFee: 0,
        };
      });
      const res = await backgroundCheckService.batch(requests);
      setBatchResult(res.data?.data || res.data);
    } catch (e: any) {
      setBatchError(e.response?.data?.error || e.message || 'Batch failed');
    } finally {
      setBatchLoading(false);
    }
  };

  const moduleColor = (score?: number) => {
    if (typeof score !== 'number') return '#94a3b8';
    if (score >= 70) return '#dc2626';
    if (score >= 40) return '#f97316';
    return '#16a34a';
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-60 mb-2">Trust & Safety</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 font-headline">Background Check</h1>
          <p style={{ color: tokens.color.muted }} className="mt-2 max-w-2xl text-sm">
            CourtListener court-record screening, comprehensive Pabandi trust scoring, batch tenant screening, and check history. Some checks may include a $PAB fee.
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {([
            { id: 'court', label: 'CourtListener', icon: '⚖️' },
            { id: 'comprehensive', label: 'Comprehensive', icon: '🛡️' },
            { id: 'history', label: 'History', icon: '📋' },
            { id: 'batch', label: 'Batch Screen', icon: '🧾' },
          ] as const).map((s) => (
            <button
              key={s.id}
              onClick={() => { setTab(s.id); if (s.id === 'history') loadHistory(); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border transition-all ${tab === s.id ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30' : 'bg-white/5 text-slate-400 border-white/10'}`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {tab === 'court' && (
          <div className="space-y-4">
            <div className="rounded-3xl p-5 md:p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="font-bold text-lg text-slate-100 mb-3">Court Record Screening</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide opacity-60">Full Name *</label>
                  <input className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} placeholder="Full legal name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide opacity-60">State</label>
                  <select className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="">All States</option>
                    <option value="IL">Illinois</option>
                    <option value="NY">New York</option>
                    <option value="CA">California</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                  </select>
                </div>
              </div>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="mt-4 text-sm font-semibold text-indigo-300 hover:text-indigo-200">
                {showAdvanced ? '▼ Hide Advanced Search' : '▶ Show Advanced Search'}
              </button>
              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <label className="text-xs uppercase tracking-wide opacity-60">Court ID</label>
                    <input className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} placeholder="Court ID" value={advanced.court} onChange={(e) => setAdvanced({ ...advanced, court: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide opacity-60">Docket Number</label>
                    <input className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} placeholder="Docket #" value={advanced.docketNumber} onChange={(e) => setAdvanced({ ...advanced, docketNumber: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide opacity-60">Date Filed After</label>
                    <input type="date" className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={advanced.dateFiledAfter} onChange={(e) => setAdvanced({ ...advanced, dateFiledAfter: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide opacity-60">Date Filed Before</label>
                    <input type="date" className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={advanced.dateFiledBefore} onChange={(e) => setAdvanced({ ...advanced, dateFiledBefore: e.target.value })} />
                  </div>
                </div>
              )}
              {courtError && <div className="text-red-400 text-sm mt-3">{courtError}</div>}
              <button disabled={courtLoading || !name.trim()} onClick={runCourtCheck} className="mt-5 w-full py-3 rounded-xl font-bold border-none disabled:opacity-50 hover:opacity-90" style={{ background: tokens.color.primary, color: '#0a0a0a' }}>
                {courtLoading ? '🔍 Searching Court Records...' : 'Run Background Check'}
              </button>
            </div>

            {courtResult && (
              <div className="space-y-4">
                <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BAND_COLOR[courtResult.riskBand || ''] || '#888'}40` }}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-60">Verdict</p>
                      <p className="text-2xl font-bold" style={{ color: BAND_COLOR[courtResult.riskBand || ''] || '#94a3b8' }}>{courtResult.riskBand || 'UNKNOWN'} RISK</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide opacity-60">Total Cases</p>
                      <p className="text-4xl font-bold" style={{ color: BAND_COLOR[courtResult.riskBand || ''] || '#94a3b8' }}>{courtResult.totalCases ?? 0}</p>
                      <p className="text-sm opacity-60">{courtResult.criminalCount ?? 0} criminal · {courtResult.evictionCount ?? 0} eviction</p>
                    </div>
                  </div>
                </div>

                {courtResult.riskFactors && courtResult.riskFactors.length > 0 && (
                  <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 className="font-bold text-lg text-slate-100 mb-3">Risk Factors</h3>
                    <div className="space-y-2">
                      {courtResult.riskFactors.map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm" style={{ color: tokens.color.muted }}>
                          <span className="text-red-400">•</span> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {courtResult.cases && courtResult.cases.length > 0 && (
                  <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 className="font-bold text-lg text-slate-100 mb-4">Case Details</h3>
                    <div className="space-y-3">
                      {courtResult.cases.map((c: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl bg-white/5">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-slate-100">{c.caseName}</div>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.courtType === 'CRIMINAL' ? 'bg-red-500/20 text-red-300' : c.courtType === 'CIVIL' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-300'}`}>{c.courtType || 'OTHER'}</span>
                          </div>
                          <div className="text-xs" style={{ color: tokens.color.muted }}>
                            {c.docketNumber} · {c.court} · Filed {c.dateFiled}
                            {c.dateTerminated && <span> · Terminated {c.dateTerminated}</span>}
                            {c.chapter && <span> · Chapter {c.chapter}</span>}
                          </div>
                          {c.party?.length > 0 && <div className="text-xs mt-1 text-slate-400">Parties: {c.party.slice(0, 4).join(', ')}{c.party.length > 4 ? '...' : ''}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {courtResult.simulated && (
                  <div className="rounded-3xl p-4 text-sm" style={{ background: 'rgba(255,193,7,0.05)', border: '1px solid rgba(255,193,7,0.2)' }}>
                    <p className="text-amber-300">⚠️ Demo mode — COURTLISTENER_API_KEY is not set. Results are simulated.</p>
                  </div>
                )}
                {!courtResult.simulated && courtResult.totalCases === 0 && (
                  <div className="rounded-3xl p-4 text-sm text-center" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-emerald-300">✅ Live mode — no records found for this name.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'comprehensive' && (
          <div className="space-y-4">
            <div className="rounded-3xl p-5 md:p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="font-bold text-lg text-slate-100 mb-3">Pabandi Trust Screening</h3>
              <p className="text-xs mb-4" style={{ color: tokens.color.muted }}>Composite score from Pabandi history, sanctions, GitHub, domain age, breach data, registry, and wallet analytics.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide opacity-60">Full Name *</label>
                  <input className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={cForm.subjectName} onChange={(e) => setCForm({ ...cForm, subjectName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide opacity-60">Subject Type</label>
                  <select className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={cForm.subjectType} onChange={(e) => setCForm({ ...cForm, subjectType: e.target.value })}>
                    <option value="GUEST">Guest</option>
                    <option value="FREELANCER">Freelancer</option>
                    <option value="PROPERTY_MANAGER">Property Manager</option>
                    <option value="BUSINESS">Business</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide opacity-60">Email</label>
                  <input className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={cForm.subjectEmail} onChange={(e) => setCForm({ ...cForm, subjectEmail: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide opacity-60">Website</label>
                  <input className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={cForm.subjectWebsite} onChange={(e) => setCForm({ ...cForm, subjectWebsite: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide opacity-60">GitHub</label>
                  <input className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={cForm.subjectGithub} onChange={(e) => setCForm({ ...cForm, subjectGithub: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide opacity-60">Company</label>
                  <input className="mt-1 w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} value={cForm.subjectCompany} onChange={(e) => setCForm({ ...cForm, subjectCompany: e.target.value })} />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={cForm.consent} onChange={(e) => setCForm({ ...cForm, consent: e.target.checked })} />
                Consent to screening for trust scoring
              </label>
              {compError && <div className="text-red-400 text-sm mt-3">{compError}</div>}
              <button disabled={compLoading || !cForm.subjectName.trim() || !cForm.consent} onClick={runComprehensive} className="mt-5 w-full py-3 rounded-xl font-bold border-none disabled:opacity-50 hover:opacity-90" style={{ background: tokens.color.primary, color: '#0a0a0a' }}>
                {compLoading ? '🛡️ Running Trust Check...' : 'Run Trust Check'}
              </button>
            </div>

            {compResult && (
              <div className="space-y-4">
                <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BAND_COLOR[compResult.riskBand || ''] || '#888'}40` }}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-60">Trust Score</p>
                      <p className="text-4xl font-bold" style={{ color: BAND_COLOR[compResult.riskBand || ''] || '#94a3b8' }}>{compResult.riskScore ?? '—'}</p>
                      <p className="text-sm" style={{ color: tokens.color.muted }}>{compResult.recommendation} · {compResult.riskBand}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide opacity-60">Status</p>
                      <p className="text-xl font-bold text-slate-100">{compResult.status}</p>
                    </div>
                  </div>
                  {compResult.summary && <p className="mt-3 text-sm text-slate-300">{compResult.summary}</p>}
                </div>

                <ModuleGrid result={compResult} moduleColor={moduleColor} />
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="rounded-3xl p-5 md:p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-100">Check History</h3>
              <button onClick={loadHistory} disabled={historyLoading} className="px-3 py-2 rounded-lg text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50">Refresh</button>
            </div>
            {history.length === 0 && !historyLoading && <p style={{ color: tokens.color.muted }} className="text-sm">No checks yet.</p>}
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <div className="font-semibold text-slate-100">{h.subjectName || h.id}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(h.createdAt || Date.now()).toLocaleString()} · {h.status}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: BAND_COLOR[h.riskBand || ''] || '#94a3b8' }}>{h.riskBand || '—'}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{h.riskScore ?? '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'batch' && (
          <div className="rounded-3xl p-5 md:p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="font-bold text-lg text-slate-100">Batch Tenant Screening</h3>
            <p className="text-xs" style={{ color: tokens.color.muted }}>One subject per line: Name, Type, Email</p>
            <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} rows={8} placeholder={'John Doe,GUEST,john@example.com\nJane Smith,FREELANCER,jane@example.com'} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
            {batchError && <div className="text-red-400 text-sm">{batchError}</div>}
            <button disabled={batchLoading} onClick={runBatch} className="w-full py-3 rounded-xl font-bold border-none disabled:opacity-50 hover:opacity-90" style={{ background: tokens.color.primary, color: '#0a0a0a' }}>
              {batchLoading ? 'Running Batch...' : 'Run Batch Screening'}
            </button>
            {batchResult && (
              <div className="p-4 rounded-xl bg-white/5 text-sm text-slate-300">
                <div className="font-semibold text-slate-100 mb-2">Batch Result</div>
                <div>Queued: {batchResult.queued || batchResult.checkIds?.length || 0}</div>
                {batchResult.feeCharged !== undefined && <div>Fee charged: {batchResult.feeCharged} $PAB</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleGrid({ result, moduleColor }: { result: CheckResult; moduleColor: (score?: number) => string }) {
  const mods = [
    { label: 'Pabandi History', source: 'pabandiHistoryResult' },
    { label: 'GitHub', source: 'githubResult' },
    { label: 'Domain', source: 'domainResult' },
    { label: 'Breach', source: 'breachResult' },
    { label: 'Sanctions', source: 'sanctionsResult' },
    { label: 'Registry', source: 'registryResult' },
    { label: 'OSINT', source: 'osintResult' },
    { label: 'Wallet', source: 'walletResult' },
  ];

  return (
    <div className="rounded-3xl p-5 md:p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 className="font-bold text-lg text-slate-100 mb-4">Module Breakdown</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mods.map((m) => {
          const raw = (result as any)?.[m.source];
          const score = typeof raw?.riskScore === 'number' ? raw.riskScore : undefined;
          const signals = Array.isArray(raw?.signals) ? raw.signals.slice(0, 2) : [];
          return (
            <div key={m.source} className="p-3 rounded-xl bg-white/5">
              <div className="text-xs uppercase tracking-wide opacity-60">{m.label}</div>
              <div className="text-xl font-bold" style={{ color: moduleColor(score) }}>{score ?? '—'}</div>
              <div className="text-xs" style={{ color: tokens.color.muted }}>{signals[0] || '—'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
