import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';
import { courtCheckService } from '../services/api';

type DemoTab = 'pm' | 'sale' | 'screening' | 'appointments' | 'history' | 'crypto' | 'convert';

type DemoProperty = { title: string; address: string; rent: number; status: 'VACANT' | 'OCCUPIED' };
type DemoTenant = { name: string; email: string; band: 'LOW' | 'MEDIUM' | 'HIGH'; stays: number; lastStay?: string; disputes?: number; deposited?: number };
type DemoAppointment = { id: string; tenantName: string; tenantEmail: string; property: string; date: string; status: 'CONFIRMED' | 'PENDING' | 'COMPLETED' };
type DemoData = {
  properties: DemoProperty[];
  tenants: DemoTenant[];
  appointments: DemoAppointment[];
  screeningRun: boolean;
  walletConnected: boolean;
  pabEarned: number;
};

const initialDemoData: DemoData = {
  properties: [],
  tenants: [],
  appointments: [],
  screeningRun: false,
  walletConnected: false,
  pabEarned: 0,
};

export const DemoWalkthroughPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState<DemoTab>('pm');
  const [demoData, setDemoData] = useState<DemoData>(initialDemoData);
  const [convertChoice, setConvertChoice] = useState<'keep' | 'import' | 'webhook' | 'fresh' | null>(null);
  const [importMethod, setImportMethod] = useState<'csv' | 'api'>('csv');

  const [propForm, setPropForm] = useState({ title: '', address: '', rent: '' });
  const [showPropForm, setShowPropForm] = useState(false);

  const [tenantForm, setTenantForm] = useState({ name: '', email: '' });
  const [showTenantForm, setShowTenantForm] = useState(false);

  const [screenName, setScreenName] = useState('');
  const [screenState, setScreenState] = useState('IL');
  const [screenResult, setScreenResult] = useState<any>(null);
  const [screening, setScreening] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const [apptForm, setApptForm] = useState({ tenantName: '', tenantEmail: '', property: '', date: '' });
  const [showApptForm, setShowApptForm] = useState(false);

  const [walletAddr, setWalletAddr] = useState('');

  const addProperty = () => {
    if (!propForm.title) return;
    setDemoData((d) => ({
      ...d,
      properties: [...d.properties, { title: propForm.title, address: propForm.address, rent: Number(propForm.rent) || 0, status: 'VACANT' as const }],
      pabEarned: d.pabEarned + 5,
    }));
    setPropForm({ title: '', address: '', rent: '' });
    setShowPropForm(false);
  };

  const addTenant = () => {
    if (!tenantForm.email) return;
    setDemoData((d) => ({
      ...d,
      tenants: [...d.tenants, { name: tenantForm.name, email: tenantForm.email, band: 'LOW', stays: 0, disputes: 0, deposited: 0, lastStay: new Date().toISOString() }],
      pabEarned: d.pabEarned + 3,
    }));
    setTenantForm({ name: '', email: '' });
    setShowTenantForm(false);
  };

  const runScreening = async () => {
    if (!screenName) return;
    setScreening(true);
    try {
      const res = await courtCheckService.courtCheckByName(screenName, screenState);
      const data = res.data?.data || res.data;
      if (data) {
        setScreenResult({
          name: data.name,
          state: data.state,
          band: data.riskBand,
          depositAdj: data.recentEviction ? 25 : data.found ? 10 : 0,
          count: data.count,
          results: data.cases || [],
          screenedAt: new Date().toISOString(),
          source: data.simulated ? 'Simulated (no API key)' : 'CourtListener API',
          simulated: data.simulated,
          apiEndpoint: 'https://www.courtlistener.com/api/rest/v3/search/',
          query: `"${screenName}"`,
          type: 'dockets',
          jurisdiction: screenState,
        });
        setDemoData((d) => ({ ...d, screeningRun: true, pabEarned: d.pabEarned + 10 }));
      }
    } catch (e) {
      console.error('Screening failed:', e);
    } finally {
      setScreening(false);
    }
  };

  const addAppointment = () => {
    if (!apptForm.tenantName || !apptForm.date) return;
    setDemoData((d) => ({
      ...d,
      appointments: [...d.appointments, { id: `appt-${Date.now()}`, ...apptForm, status: 'CONFIRMED' as const }],
      pabEarned: d.pabEarned + 5,
    }));
    setApptForm({ tenantName: '', tenantEmail: '', property: '', date: '' });
    setShowApptForm(false);
  };

  const connectWallet = () => {
    if (!walletAddr) return;
    setDemoData((d) => ({ ...d, walletConnected: true, pabEarned: d.pabEarned + 15 }));
  };

  const handleConvert = () => {
    if (convertChoice === 'keep') {
      localStorage.setItem('pabandi_demo_data', JSON.stringify(demoData));
      navigate('/signup?demo=migrate');
    } else if (convertChoice === 'import') {
      navigate('/signup?demo=import');
    } else if (convertChoice === 'webhook') {
      navigate('/signup?demo=webhook');
    } else {
      navigate('/signup');
    }
  };

  const inputClass = "w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base transition-all";

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <span className="text-lg font-bold text-slate-100">Pabandi</span>
            <Badge tone="info">Demo</Badge>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/property-manager" className="text-sm text-slate-300 hover:text-white">Dashboard →</Link>
            ) : (
              <Link to="/login" className="text-sm text-slate-300 hover:text-white">Log in</Link>
            )}
            <Button onClick={() => setTab('convert')} size="sm">Get started</Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-100 font-headline">
            Commitment, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Secured.</span>
          </h1>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Explore the full Pabandi experience — property management, secured sales, tenant screening, and the $PAB token.
          </p>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {([
            { id: 'pm', label: '🏘️ Property Manager' },
            { id: 'sale', label: '🛡️ Secured Sale' },
            { id: 'screening', label: '🔍 Screening' },
            { id: 'appointments', label: '📅 Appointments' },
            { id: 'history', label: '👥 Tenant History' },
            { id: 'crypto', label: '💰 $PAB Crypto' },
            { id: 'convert', label: '🚀 Sign Up' },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as DemoTab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'pm' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{demoData.properties.length}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Properties</div></Surface>
              <Surface className="text-center"><div className="text-2xl font-bold text-emerald-300">{demoData.properties.filter((p) => p.status === 'OCCUPIED').length}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Occupied</div></Surface>
              <Surface className="text-center"><div className="text-2xl font-bold text-indigo-300">{demoData.tenants.length}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Tenants</div></Surface>
              <Surface className="text-center"><div className="text-2xl font-bold text-amber-300">{demoData.pabEarned}</div><div className="text-xs" style={{ color: tokens.color.muted }}>$PAB earned</div></Surface>
            </div>
            <Surface>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-100">Properties</h3>
                <Button onClick={() => setShowPropForm(!showPropForm)} size="sm">+ Add property</Button>
              </div>
              {showPropForm && (
                <div className="mb-4 p-4 rounded-xl bg-white/5 space-y-3">
                  <input value={propForm.title} onChange={(e) => setPropForm({ ...propForm, title: e.target.value })} placeholder="Property name *" className={inputClass} />
                  <input value={propForm.address} onChange={(e) => setPropForm({ ...propForm, address: e.target.value })} placeholder="Address" className={inputClass} />
                  <input value={propForm.rent} onChange={(e) => setPropForm({ ...propForm, rent: e.target.value })} placeholder="Monthly rent" type="number" className={inputClass} />
                  <div className="flex gap-2"><Button onClick={addProperty} size="sm">Save</Button><Button onClick={() => setShowPropForm(false)} variant="ghost" size="sm">Cancel</Button></div>
                </div>
              )}
              {demoData.properties.length === 0 ? (
                <p className="text-sm" style={{ color: tokens.color.muted }}>No properties yet. Add one above!</p>
              ) : (
                <div className="space-y-2">
                  {demoData.properties.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div><div className="font-semibold text-slate-100">{p.title}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{p.address}{p.rent ? ` · $${p.rent}/mo` : ''}</div></div>
                      <Badge tone={p.status === 'VACANT' ? 'info' : 'success'}>{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
            <Surface>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-100">Tenants</h3>
                <Button onClick={() => setShowTenantForm(!showTenantForm)} size="sm">+ Add tenant</Button>
              </div>
              {showTenantForm && (
                <div className="mb-4 p-4 rounded-xl bg-white/5 space-y-3">
                  <input value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} placeholder="Tenant name" className={inputClass} />
                  <input value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="Email *" type="email" className={inputClass} />
                  <div className="flex gap-2"><Button onClick={addTenant} size="sm">Save</Button><Button onClick={() => setShowTenantForm(false)} variant="ghost" size="sm">Cancel</Button></div>
                </div>
              )}
              {demoData.tenants.length === 0 ? (
                <p className="text-sm" style={{ color: tokens.color.muted }}>No tenants yet. Add one above!</p>
              ) : (
                <div className="space-y-2">
                  {demoData.tenants.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div><div className="font-semibold text-slate-100">{t.name || t.email}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{t.email}</div></div>
                      <Badge tone={t.band === 'HIGH' ? 'danger' : t.band === 'MEDIUM' ? 'warning' : 'success'}>{t.band}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}

        {tab === 'sale' && (
          <div className="space-y-6">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">How it works</h3>
              <div className="space-y-4">
                {[
                  { icon: '🛡️', title: 'Seller opens a secured sale', desc: 'Drop the Pabandi widget on any listing. The seller opens a secured sale and gets a shareable buyer link.' },
                  { icon: '📍', title: 'Schedule a SafeMeet', desc: 'Pick a safe public meetup spot — police station, bank, coffee shop, mall, library. Funds stay locked until the exchange.' },
                  { icon: '💰', title: 'Buyer funds escrow', desc: 'The buyer opens the secure link and funds the escrow. Money is locked — neither party can walk with it.' },
                  { icon: '🤝', title: 'Meet & exchange', desc: 'Meet at the safe spot, inspect the item, hand it over. No cash, no risk of robbery.' },
                  { icon: '✅', title: 'Release funds', desc: 'Buyer confirms the exchange — funds release to the seller. If something goes wrong, file a dispute to lock the escrow for arbitration.' },
                ].map((step, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/5">
                    <div className="text-3xl">{step.icon}</div>
                    <div><div className="font-bold text-slate-100">{step.title}</div><div className="text-sm" style={{ color: tokens.color.muted }}>{step.desc}</div></div>
                  </div>
                ))}
              </div>
            </Surface>
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Escrow simulation</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"><div className="text-2xl font-bold text-emerald-300">$250</div><div className="text-xs" style={{ color: tokens.color.muted }}>In escrow</div></div>
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20"><div className="text-2xl font-bold text-indigo-300">📍 Library</div><div className="text-xs" style={{ color: tokens.color.muted }}>SafeMeet spot</div></div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"><div className="text-2xl font-bold text-amber-300">25 $PAB</div><div className="text-xs" style={{ color: tokens.color.muted }}>Seller reward</div></div>
              </div>
            </Surface>
          </div>
        )}

        {tab === 'screening' && (
          <div className="space-y-6">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Run a background check</h3>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Searches US CourtListener for eviction and housing litigation records. Results include case details, docket numbers, courts, and filing dates.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input value={screenName} onChange={(e) => setScreenName(e.target.value)} placeholder="Full name *" className={inputClass} />
                  <select value={screenState} onChange={(e) => setScreenState(e.target.value)} className={inputClass}>
                    <option value="IL">Illinois</option><option value="CA">California</option><option value="NY">New York</option><option value="TX">Texas</option><option value="FL">Florida</option>
                  </select>
                </div>
                <Button onClick={runScreening} disabled={screening || !screenName}>
                  {screening ? '🔍 Searching CourtListener...' : 'Run background check'}
                </Button>
              </div>

              {screenResult && (
                <div className="mt-6 space-y-4">
                  {screenResult.simulated && (
                    <div className="p-4 rounded-xl border border-amber-400/30 bg-amber-500/10 text-sm">
                      <p className="font-bold text-amber-200 mb-1">⚠️ Demo mode</p>
                      <p className="text-amber-300/80">COURTLISTENER_API_KEY is not set. Results are simulated. Add the key to enable live screening.</p>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-bold text-slate-100">{screenResult.name}</div>
                        <div className="text-xs" style={{ color: tokens.color.muted }}>{screenResult.state} · {screenResult.source}</div>
                      </div>
                      <Badge tone={screenResult.band === 'HIGH' ? 'danger' : screenResult.band === 'MEDIUM' ? 'warning' : 'success'}>{screenResult.band} risk</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div><div className="font-bold text-slate-100">{screenResult.count}</div><div style={{ color: tokens.color.muted }}>Cases found</div></div>
                      <div><div className="font-bold" style={{ color: screenResult.band === 'HIGH' ? tokens.color.danger : screenResult.band === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>{screenResult.depositAdj > 0 ? `+${screenResult.depositAdj}%` : '0%'}</div><div style={{ color: tokens.color.muted }}>Deposit adj.</div></div>
                      <div><div className="font-bold" style={{ color: screenResult.results?.some((r: any) => r.status === 'Active') ? tokens.color.danger : '#10b981' }}>{screenResult.results?.some((r: any) => r.status === 'Active') ? 'Active cases' : 'All closed'}</div><div style={{ color: tokens.color.muted }}>Status</div></div>
                    </div>
                  </div>

                  {screenResult.results && screenResult.results.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 mb-2">Cases found</h4>
                      <div className="space-y-2">
                        {screenResult.results.map((c: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-white/5 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-slate-100">{c.caseName}</div>
                              <Badge tone={c.status === 'Active' ? 'danger' : 'info'}>{c.status}</Badge>
                            </div>
                            <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>
                              {c.docketNumber} · {c.court} · Filed {c.dateFiled}
                            </div>
                            <div className="text-xs mt-1 text-slate-300">{c.natureOfSuit}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <button onClick={() => setShowRawJson(!showRawJson)} className="text-xs font-semibold text-indigo-300 hover:text-indigo-200">
                      {showRawJson ? '▼ Hide raw API response' : '▶ Show raw API response'}
                    </button>
                    {showRawJson && (
                      <pre className="mt-2 p-4 rounded-lg bg-black/40 text-xs text-green-300 overflow-x-auto max-h-80 overflow-y-auto">
                        {JSON.stringify(screenResult, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </Surface>

            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Screening sources</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5"><span className="text-2xl">🏛️</span><div><div className="font-semibold text-slate-100">US CourtListener</div><div className="text-xs" style={{ color: tokens.color.muted }}>Real eviction records from US federal and state courts</div></div></div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5"><span className="text-2xl">🇵🇰</span><div><div className="font-semibold text-slate-100">PK BackgroundCheck</div><div className="text-xs" style={{ color: tokens.color.muted }}>Pakistan civil and criminal records</div></div></div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5"><span className="text-2xl">✏️</span><div><div className="font-semibold text-slate-100">Manual</div><div className="text-xs" style={{ color: tokens.color.muted }}>Manager-entered risk assessment</div></div></div>
              </div>
            </Surface>
          </div>
        )}

        {tab === 'appointments' && (
          <div className="space-y-6">
            <Surface>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-100">Schedule viewings</h3>
                <Button onClick={() => setShowApptForm(!showApptForm)} size="sm">+ New appointment</Button>
              </div>
              {showApptForm && (
                <div className="mb-4 p-4 rounded-xl bg-white/5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={apptForm.tenantName} onChange={(e) => setApptForm({ ...apptForm, tenantName: e.target.value })} placeholder="Tenant name *" className={inputClass} />
                    <input value={apptForm.tenantEmail} onChange={(e) => setApptForm({ ...apptForm, tenantEmail: e.target.value })} placeholder="Email" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={apptForm.property} onChange={(e) => setApptForm({ ...apptForm, property: e.target.value })} placeholder="Property" className={inputClass} />
                    <input value={apptForm.date} onChange={(e) => setApptForm({ ...apptForm, date: e.target.value })} type="datetime-local" className={inputClass} />
                  </div>
                  <div className="flex gap-2"><Button onClick={addAppointment} size="sm">Schedule</Button><Button onClick={() => setShowApptForm(false)} variant="ghost" size="sm">Cancel</Button></div>
                </div>
              )}
              {demoData.appointments.length === 0 ? (
                <p className="text-sm" style={{ color: tokens.color.muted }}>No appointments yet. Schedule a viewing above!</p>
              ) : (
                <div className="space-y-2">
                  {demoData.appointments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div>
                        <div className="font-semibold text-slate-100">{a.tenantName}</div>
                        <div className="text-xs" style={{ color: tokens.color.muted }}>{a.property || 'No property'} · {new Date(a.date).toLocaleString()}</div>
                      </div>
                      <Badge tone={a.status === 'CONFIRMED' ? 'success' : a.status === 'COMPLETED' ? 'info' : 'warning'}>{a.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-6">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Tenant history timeline</h3>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Track every tenant's stays, disputes, payments, and risk bands over time.</p>
              {demoData.tenants.length === 0 ? (
                <p className="text-sm" style={{ color: tokens.color.muted }}>No tenants yet. Add tenants in the Property Manager tab first.</p>
              ) : (
                <div className="space-y-4">
                  {demoData.tenants.map((t, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-slate-100">{t.name || t.email}</div>
                          <div className="text-xs" style={{ color: tokens.color.muted }}>{t.email}</div>
                        </div>
                        <Badge tone={t.band === 'HIGH' ? 'danger' : t.band === 'MEDIUM' ? 'warning' : 'success'}>{t.band} risk</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center text-sm mb-3">
                        <div><div className="font-bold text-slate-100">{t.stays || 0}</div><div style={{ color: tokens.color.muted }}>Stays</div></div>
                        <div><div className="font-bold text-rose-300">{t.disputes || 0}</div><div style={{ color: tokens.color.muted }}>Disputes</div></div>
                        <div><div className="font-bold text-emerald-300">${t.deposited || 0}</div><div style={{ color: tokens.color.muted }}>Deposits held</div></div>
                      </div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>
                        Last stay: {t.lastStay ? new Date(t.lastStay).toLocaleDateString() : 'Never'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}

        {tab === 'crypto' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Surface>
                <h3 className="text-lg font-bold text-slate-100 mb-4">Earn $PAB</h3>
                <div className="space-y-2">
                  {[
                    { action: 'Complete a verified sale', reward: '+15 $PAB' },
                    { action: 'Run a tenant screening', reward: '+10 $PAB' },
                    { action: 'Add a property', reward: '+5 $PAB' },
                    { action: 'Add a tenant', reward: '+3 $PAB' },
                    { action: 'Refer a new user', reward: '+25 $PAB' },
                    { action: 'Connect wallet', reward: '+15 $PAB' },
                  ].map((e, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <span className="text-sm text-slate-300">{e.action}</span>
                      <span className="text-sm font-bold text-emerald-300">{e.reward}</span>
                    </div>
                  ))}
                </div>
              </Surface>
              <Surface>
                <h3 className="text-lg font-bold text-slate-100 mb-4">Stake $PAB</h3>
                <div className="space-y-2">
                  {[
                    { tier: 'Bronze', stake: '100 $PAB', benefit: 'Basic trust badge' },
                    { tier: 'Silver', stake: '500 $PAB', benefit: 'Priority in search' },
                    { tier: 'Gold', stake: '2,000 $PAB', benefit: 'Reduced fees' },
                    { tier: 'Platinum', stake: '10,000 $PAB', benefit: 'Arbitration voting' },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <div><span className="text-sm font-semibold text-slate-100">{t.tier}</span><span className="text-xs ml-2" style={{ color: tokens.color.muted }}>{t.benefit}</span></div>
                      <span className="text-sm font-bold text-amber-300">{t.stake}</span>
                    </div>
                  ))}
                </div>
              </Surface>
            </div>
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Connect wallet (demo)</h3>
              {demoData.walletConnected ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="font-semibold text-emerald-300">✅ Wallet connected</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{walletAddr.slice(0, 8)}…{walletAddr.slice(-4)}</div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={walletAddr} onChange={(e) => setWalletAddr(e.target.value)} placeholder="Solana wallet address" className={inputClass} />
                  <Button onClick={connectWallet} disabled={!walletAddr}>Connect</Button>
                </div>
              )}
            </Surface>
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Tokenomics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div><div className="text-xl font-bold text-slate-100">2%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Platform fee</div></div>
                <div><div className="text-xl font-bold text-slate-100">12%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Burn</div></div>
                <div><div className="text-xl font-bold text-slate-100">35%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Liquidity</div></div>
                <div><div className="text-xl font-bold text-slate-100">25%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Yield</div></div>
              </div>
            </Surface>
          </div>
        )}

        {tab === 'convert' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-100">Ready to get started?</h2>
              <p className="mt-2 text-slate-400">Choose how you want to set up your account.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Surface className={`cursor-pointer transition-all ${convertChoice === 'keep' ? 'ring-2 ring-indigo-400' : ''}`} onClick={() => setConvertChoice('keep')}>
                <div className="text-3xl mb-2">📋</div>
                <h3 className="font-bold text-slate-100">Keep my demo data</h3>
                <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Migrate the properties, tenants, and settings you just tried out.</p>
                {demoData.properties.length > 0 && <Badge tone="success" className="mt-2">{demoData.properties.length} properties ready</Badge>}
              </Surface>
              <Surface className={`cursor-pointer transition-all ${convertChoice === 'import' ? 'ring-2 ring-indigo-400' : ''}`} onClick={() => setConvertChoice('import')}>
                <div className="text-3xl mb-2">📥</div>
                <h3 className="font-bold text-slate-100">Import from my CRM</h3>
                <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Upload a CSV or connect your existing property management software.</p>
              </Surface>
              <Surface className={`cursor-pointer transition-all ${convertChoice === 'webhook' ? 'ring-2 ring-indigo-400' : ''}`} onClick={() => setConvertChoice('webhook')}>
                <div className="text-3xl mb-2">🔗</div>
                <h3 className="font-bold text-slate-100">Connect via webhook</h3>
                <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Integrate Pabandi as a trust layer on top of your existing CRM.</p>
              </Surface>
              <Surface className={`cursor-pointer transition-all ${convertChoice === 'fresh' ? 'ring-2 ring-indigo-400' : ''}`} onClick={() => setConvertChoice('fresh')}>
                <div className="text-3xl mb-2">✨</div>
                <h3 className="font-bold text-slate-100">Start fresh</h3>
                <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>Create a clean account and set everything up from scratch.</p>
              </Surface>
            </div>
            {convertChoice === 'import' && (
              <Surface>
                <h3 className="text-lg font-bold text-slate-100 mb-4">Import options</h3>
                <div className="flex gap-3 mb-4">
                  <button onClick={() => setImportMethod('csv')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${importMethod === 'csv' ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>📄 CSV upload</button>
                  <button onClick={() => setImportMethod('api')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${importMethod === 'api' ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>🔌 API connect</button>
                </div>
                {importMethod === 'csv' ? (
                  <div className="space-y-3">
                    <p className="text-sm" style={{ color: tokens.color.muted }}>Upload a CSV with columns: property_name, address, rent, tenant_email, tenant_name, lease_start, lease_end</p>
                    <div className="p-8 rounded-xl border-2 border-dashed border-white/10 text-center"><div className="text-3xl mb-2">📄</div><p className="text-sm" style={{ color: tokens.color.muted }}>Drop CSV here or click to browse</p></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm" style={{ color: tokens.color.muted }}>Connect to your existing CRM via API.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['Buildium', 'AppFolio', 'Rent Manager', 'Yardi', 'MRI', 'Custom'].map((crm) => (
                        <div key={crm} className="p-3 rounded-lg bg-white/5 text-center text-sm text-slate-300">{crm}</div>
                      ))}
                    </div>
                  </div>
                )}
              </Surface>
            )}
            {convertChoice === 'webhook' && (
              <Surface>
                <h3 className="text-lg font-bold text-slate-100 mb-4">Webhook integration</h3>
                <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Pabandi becomes your trust layer. When events happen in your CRM, we screen, escrow, and verify.</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5"><span className="text-lg">→</span><div className="text-sm"><strong className="text-slate-100">tenant.created</strong> <span style={{ color: tokens.color.muted }}>→ auto-screen</span></div></div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5"><span className="text-lg">→</span><div className="text-sm"><strong className="text-slate-100">lease.signed</strong> <span style={{ color: tokens.color.muted }}>→ escrow deposit</span></div></div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5"><span className="text-lg">→</span><div className="text-sm"><strong className="text-slate-100">sale.completed</strong> <span style={{ color: tokens.color.muted }}>→ release funds</span></div></div>
                </div>
              </Surface>
            )}
            {convertChoice && (
              <div className="text-center">
                <Button onClick={handleConvert} size="lg">
                  {convertChoice === 'keep' && 'Create account with demo data →'}
                  {convertChoice === 'import' && 'Continue to import →'}
                  {convertChoice === 'webhook' && 'Set up webhook →'}
                  {convertChoice === 'fresh' && 'Create account →'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoWalkthroughPage;
