import React, { useState, useRef, useEffect } from 'react';
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

// Pre-populated demo data so the experience looks rich immediately
const initialDemoData: DemoData = {
  properties: [
    { title: '2BR Apartment - Downtown', address: '123 Main St, Chicago, IL', rent: 1800, status: 'OCCUPIED' },
    { title: '1BR Condo - Lakeview', address: '456 Oak Ave, Chicago, IL', rent: 1200, status: 'OCCUPIED' },
    { title: 'Studio - University', address: '789 Pine Rd, Chicago, IL', rent: 800, status: 'VACANT' },
  ],
  tenants: [
    { name: 'Sarah Mitchell', email: 'sarah.m@email.com', band: 'LOW', stays: 2, disputes: 0, deposited: 1800, lastStay: '2026-08-01' },
    { name: 'John Davis', email: 'john.d@email.com', band: 'LOW', stays: 1, disputes: 0, deposited: 1200, lastStay: '2026-07-15' },
  ],
  appointments: [
    { id: 'appt-demo-1', tenantName: 'Mike Johnson', tenantEmail: 'mike.j@email.com', property: 'Studio - University', date: '2026-09-05T14:00:00', status: 'CONFIRMED' },
  ],
  screeningRun: false,
  walletConnected: false,
  pabEarned: 43,
};

const TABS = [
  { id: 'pm', label: 'Manager', icon: '🏘️' },
  { id: 'sale', label: 'Sale', icon: '🛡️' },
  { id: 'screening', label: 'Screen', icon: '🔍' },
  { id: 'appointments', label: 'Visits', icon: '📅' },
  { id: 'history', label: 'History', icon: '👥' },
  { id: 'crypto', label: '$PAB', icon: '💰' },
  { id: 'convert', label: 'Sign Up', icon: '🚀' },
] as const;

export const DemoWalkthroughPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState<DemoTab>('pm');
  const [demoData, setDemoData] = useState<DemoData>(initialDemoData);
  const [convertChoice, setConvertChoice] = useState<'keep' | 'import' | 'webhook' | 'fresh' | null>(null);
  const [importMethod, setImportMethod] = useState<'csv' | 'api'>('csv');
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const [err, setErr] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [tab]);

  const addProperty = () => {
    if (!propForm.title) return setErr('Property name is required');
    setDemoData((d) => ({
      ...d,
      properties: [...d.properties, { title: propForm.title, address: propForm.address, rent: Number(propForm.rent) || 0, status: 'VACANT' as const }],
      pabEarned: d.pabEarned + 5,
    }));
    setPropForm({ title: '', address: '', rent: '' });
    setShowPropForm(false);
    setErr('');
  };

  const addTenant = () => {
    if (!tenantForm.email) return setErr('Email is required');
    setDemoData((d) => ({
      ...d,
      tenants: [...d.tenants, { name: tenantForm.name, email: tenantForm.email, band: 'LOW', stays: 0, disputes: 0, deposited: 0, lastStay: new Date().toISOString() }],
      pabEarned: d.pabEarned + 3,
    }));
    setTenantForm({ name: '', email: '' });
    setShowTenantForm(false);
    setErr('');
  };

  const runScreening = async () => {
    if (!screenName) return setErr('Name is required');
    setScreening(true);
    setErr('');
    try {
      const res = await courtCheckService.courtCheckByName(screenName, screenState);
      const data = res.data?.data || res.data;
      if (data) {
        setScreenResult({
          name: data.name, state: data.state, band: data.riskBand,
          depositAdj: data.recentEviction ? 25 : data.found ? 10 : 0,
          count: data.count, results: data.cases || [],
          screenedAt: new Date().toISOString(),
          source: data.simulated ? 'Simulated (no API key)' : 'CourtListener API',
          simulated: data.simulated,
        });
        setDemoData((d) => ({ ...d, screeningRun: true, pabEarned: d.pabEarned + 10 }));
      }
    } catch (e) {
      setErr('Screening failed. Try again.');
    } finally {
      setScreening(false);
    }
  };

  const addAppointment = () => {
    if (!apptForm.tenantName || !apptForm.date) return setErr('Name and date required');
    setDemoData((d) => ({
      ...d,
      appointments: [...d.appointments, { id: `appt-${Date.now()}`, ...apptForm, status: 'CONFIRMED' as const }],
      pabEarned: d.pabEarned + 5,
    }));
    setApptForm({ tenantName: '', tenantEmail: '', property: '', date: '' });
    setShowApptForm(false);
    setErr('');
  };

  const connectWallet = () => {
    if (!walletAddr) return setErr('Wallet address required');
    setDemoData((d) => ({ ...d, walletConnected: true, pabEarned: d.pabEarned + 15 }));
    setErr('');
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

  const inputClass = "w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3.5 outline-none font-body text-base transition-all";

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <span className="text-base font-bold text-slate-100">Pabandi</span>
            <Badge tone="info">Demo</Badge>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to="/property-manager" className="text-sm text-slate-300 hover:text-white">Dashboard →</Link>
            ) : (
              <Link to="/login" className="text-sm text-slate-300 hover:text-white">Log in</Link>
            )}
            <Button onClick={() => setTab('convert')} size="sm">Get started</Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-[57px] z-40 bg-surface/60 backdrop-blur-lg border-b border-white/5 overflow-x-auto no-scrollbar">
        <div className="max-w-6xl mx-auto px-4 py-2 flex gap-1" ref={scrollRef}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as DemoTab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
              <span className="text-base">{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger, border: `1px solid ${tokens.color.danger}30` }}>{err}</div>}

        {/* —— Property Manager Tab —— */}
        {tab === 'pm' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Surface className="text-center p-3 md:p-4">
                <div className="text-xl md:text-2xl font-bold text-slate-100">{demoData.properties.length}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Properties</div>
              </Surface>
              <Surface className="text-center p-3 md:p-4">
                <div className="text-xl md:text-2xl font-bold text-emerald-300">{demoData.properties.filter((p) => p.status === 'OCCUPIED').length}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Occupied</div>
              </Surface>
              <Surface className="text-center p-3 md:p-4">
                <div className="text-xl md:text-2xl font-bold text-indigo-300">{demoData.tenants.length}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Tenants</div>
              </Surface>
              <Surface className="text-center p-3 md:p-4">
                <div className="text-xl md:text-2xl font-bold text-amber-300">{demoData.pabEarned}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>$PAB earned</div>
              </Surface>
            </div>

            <Surface className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base md:text-lg font-bold text-slate-100">Properties</h3>
                <Button onClick={() => setShowPropForm(!showPropForm)} size="sm">+ Add</Button>
              </div>
              {showPropForm && (
                <div className="mb-4 p-3 md:p-4 rounded-xl bg-white/5 space-y-3">
                  <input value={propForm.title} onChange={(e) => setPropForm({ ...propForm, title: e.target.value })} placeholder="Property name *" className={inputClass} />
                  <input value={propForm.address} onChange={(e) => setPropForm({ ...propForm, address: e.target.value })} placeholder="Address" className={inputClass} />
                  <input value={propForm.rent} onChange={(e) => setPropForm({ ...propForm, rent: e.target.value })} placeholder="Monthly rent" type="number" className={inputClass} />
                  <div className="flex gap-2">
                    <Button onClick={addProperty} className="flex-1">Save</Button>
                    <Button onClick={() => setShowPropForm(false)} variant="ghost">Cancel</Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {demoData.properties.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div>
                      <div className="font-semibold text-slate-100">{p.title}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>{p.address}{p.rent ? ` · $${p.rent}/mo` : ''}</div>
                    </div>
                    <Badge tone={p.status === 'VACANT' ? 'info' : 'success'}>{p.status}</Badge>
                  </div>
                ))}
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base md:text-lg font-bold text-slate-100">Tenants</h3>
                <Button onClick={() => setShowTenantForm(!showTenantForm)} size="sm">+ Add</Button>
              </div>
              {showTenantForm && (
                <div className="mb-4 p-3 rounded-xl bg-white/5 space-y-3">
                  <input value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} placeholder="Tenant name" className={inputClass} />
                  <input value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="Email *" type="email" className={inputClass} />
                  <div className="flex gap-2">
                    <Button onClick={addTenant} className="flex-1">Save</Button>
                    <Button onClick={() => setShowTenantForm(false)} variant="ghost">Cancel</Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {demoData.tenants.map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div>
                      <div className="font-semibold text-slate-100">{t.name || t.email}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>{t.email}</div>
                    </div>
                    <Badge tone={t.band === 'HIGH' ? 'danger' : t.band === 'MEDIUM' ? 'warning' : 'success'}>{t.band}</Badge>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* —— Secured Sale Tab —— */}
        {tab === 'sale' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-slate-100 mb-4">How Secured Sales Work</h3>
              <div className="space-y-3">
                {[
                  { icon: '🛡️', title: 'Seller opens a secured sale', desc: 'Drop the Pabandi widget on any listing. The seller opens a secured sale and gets a shareable buyer link.' },
                  { icon: '📍', title: 'Schedule a SafeMeet', desc: 'Pick a safe public meetup spot — police station, bank, coffee shop, mall, library. Funds stay locked until the exchange.' },
                  { icon: '💰', title: 'Buyer funds escrow', desc: 'The buyer opens the secure link and funds the escrow. Money is locked — neither party can walk with it.' },
                  { icon: '🤝', title: 'Meet & exchange', desc: 'Meet at the safe spot, inspect the item, hand it over. No cash, no risk of robbery.' },
                  { icon: '✅', title: 'Release funds', desc: 'Buyer confirms the exchange — funds release to the seller. If something goes wrong, file a dispute to lock the escrow for arbitration.' },
                ].map((step, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/5">
                    <div className="text-2xl">{step.icon}</div>
                    <div><div className="font-bold text-slate-100 text-sm">{step.title}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{step.desc}</div></div>
                  </div>
                ))}
              </div>
            </Surface>
            <Surface className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-slate-100 mb-4">Escrow simulation</h3>
              <div className="grid grid-cols-3 gap-2 md:gap-3 text-center">
                <div className="p-3 md:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-lg md:text-2xl font-bold text-emerald-300">$250</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>In escrow</div>
                </div>
                <div className="p-3 md:p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <div className="text-lg md:text-2xl font-bold text-indigo-300">📍 Library</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>SafeMeet spot</div>
                </div>
                <div className="p-3 md:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-lg md:text-2xl font-bold text-amber-300">25 $PAB</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>Seller reward</div>
                </div>
              </div>
            </Surface>
          </div>
        )}

        {/* —— Screening Tab —— */}
        {tab === 'screening' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-slate-100 mb-2">Run a background check</h3>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Searches US CourtListener for eviction and housing litigation records.</p>
              <div className="space-y-3">
                <input value={screenName} onChange={(e) => setScreenName(e.target.value)} placeholder="Full name *" className={inputClass} />
                <select value={screenState} onChange={(e) => setScreenState(e.target.value)} className={inputClass}>
                  <option value="IL">Illinois</option><option value="CA">California</option><option value="NY">New York</option><option value="TX">Texas</option><option value="FL">Florida</option>
                </select>
                <Button onClick={runScreening} disabled={screening || !screenName} className="w-full">
                  {screening ? '🔍 Searching...' : 'Run background check'}
                </Button>
              </div>

              {screenResult && (
                <div className="mt-4 space-y-3">
                  {screenResult.simulated && (
                    <div className="p-3 rounded-xl border border-amber-400/30 bg-amber-500/10 text-sm">
                      <p className="font-bold text-amber-200">⚠️ Demo mode</p>
                      <p className="text-amber-300/80 text-xs">COURTLISTENER_API_KEY not set. Results are simulated.</p>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-bold text-slate-100">{screenResult.name}</div>
                        <div className="text-xs" style={{ color: tokens.color.muted }}>{screenResult.state} · {screenResult.source}</div>
                      </div>
                      <Badge tone={screenResult.band === 'HIGH' ? 'danger' : screenResult.band === 'MEDIUM' ? 'warning' : 'success'}>{screenResult.band}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div><div className="font-bold text-slate-100">{screenResult.count}</div><div style={{ color: tokens.color.muted }}>Cases</div></div>
                      <div><div className="font-bold" style={{ color: screenResult.band === 'HIGH' ? tokens.color.danger : '#10b981' }}>{screenResult.depositAdj > 0 ? `+${screenResult.depositAdj}%` : '0%'}</div><div style={{ color: tokens.color.muted }}>Deposit</div></div>
                      <div><div className="font-bold" style={{ color: screenResult.results?.some((r: any) => r.status === 'Active') ? tokens.color.danger : '#10b981' }}>{screenResult.results?.some((r: any) => r.status === 'Active') ? 'Active' : 'Clear'}</div><div style={{ color: tokens.color.muted }}>Status</div></div>
                    </div>
                  </div>
                  {screenResult.results?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 mb-2">Cases found</h4>
                      <div className="space-y-2">
                        {screenResult.results.slice(0, 3).map((c: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-white/5 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-slate-100 text-xs">{c.caseName}</div>
                              <Badge tone={c.status === 'Active' ? 'danger' : 'info'}>{c.status}</Badge>
                            </div>
                            <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{c.docketNumber} · {c.court}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => setShowRawJson(!showRawJson)} className="text-xs font-semibold text-indigo-300">
                    {showRawJson ? '▼ Hide JSON' : '▶ Show raw API response'}
                  </button>
                  {showRawJson && (
                    <pre className="p-3 rounded-lg bg-black/40 text-xs text-green-300 overflow-x-auto max-h-60">
                      {JSON.stringify(screenResult, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* —— Appointments Tab —— */}
        {tab === 'appointments' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base md:text-lg font-bold text-slate-100">Schedule viewings</h3>
                <Button onClick={() => setShowApptForm(!showApptForm)} size="sm">+ New</Button>
              </div>
              {showApptForm && (
                <div className="mb-4 p-3 rounded-xl bg-white/5 space-y-3">
                  <input value={apptForm.tenantName} onChange={(e) => setApptForm({ ...apptForm, tenantName: e.target.value })} placeholder="Tenant name *" className={inputClass} />
                  <input value={apptForm.tenantEmail} onChange={(e) => setApptForm({ ...apptForm, tenantEmail: e.target.value })} placeholder="Email" className={inputClass} />
                  <input value={apptForm.property} onChange={(e) => setApptForm({ ...apptForm, property: e.target.value })} placeholder="Property" className={inputClass} />
                  <input value={apptForm.date} onChange={(e) => setApptForm({ ...apptForm, date: e.target.value })} type="datetime-local" className={inputClass} />
                  <div className="flex gap-2">
                    <Button onClick={addAppointment} className="flex-1">Schedule</Button>
                    <Button onClick={() => setShowApptForm(false)} variant="ghost">Cancel</Button>
                  </div>
                </div>
              )}
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
            </Surface>
          </div>
        )}

        {/* —— History Tab —— */}
        {tab === 'history' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-slate-100 mb-2">Tenant history timeline</h3>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Track every tenant's stays, disputes, payments, and risk bands.</p>
              <div className="space-y-3">
                {demoData.tenants.map((t, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-bold text-slate-100">{t.name || t.email}</div>
                        <div className="text-xs" style={{ color: tokens.color.muted }}>{t.email}</div>
                      </div>
                      <Badge tone={t.band === 'HIGH' ? 'danger' : t.band === 'MEDIUM' ? 'warning' : 'success'}>{t.band}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div><div className="font-bold text-slate-100">{t.stays || 0}</div><div style={{ color: tokens.color.muted }}>Stays</div></div>
                      <div><div className="font-bold text-rose-300">{t.disputes || 0}</div><div style={{ color: tokens.color.muted }}>Disputes</div></div>
                      <div><div className="font-bold text-emerald-300">${t.deposited || 0}</div><div style={{ color: tokens.color.muted }}>Deposits</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* —— Crypto Tab —— */}
        {tab === 'crypto' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Surface className="p-4 md:p-6">
                <h3 className="text-base md:text-lg font-bold text-slate-100 mb-3">Earn $PAB</h3>
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
              <Surface className="p-4 md:p-6">
                <h3 className="text-base md:text-lg font-bold text-slate-100 mb-3">Stake $PAB</h3>
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
            <Surface className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-slate-100 mb-3">Connect wallet (demo)</h3>
              {demoData.walletConnected ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="font-semibold text-emerald-300">✅ Wallet connected</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{walletAddr.slice(0, 8)}…{walletAddr.slice(-4)}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input value={walletAddr} onChange={(e) => setWalletAddr(e.target.value)} placeholder="Solana wallet address" className={inputClass} />
                  <Button onClick={connectWallet} disabled={!walletAddr} className="w-full">Connect</Button>
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* —— Convert Tab —— */}
        {tab === 'convert' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Ready to get started?</h2>
              <p className="mt-2 text-sm" style={{ color: tokens.color.muted }}>Choose how you want to set up your account.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'keep', icon: '📋', title: 'Keep my demo data', desc: 'Migrate the properties, tenants, and settings you just tried out.' },
                { id: 'import', icon: '📥', title: 'Import from my CRM', desc: 'Upload a CSV or connect your existing property management software.' },
                { id: 'webhook', icon: '🔗', title: 'Connect via webhook', desc: 'Integrate Pabandi as a trust layer on top of your existing CRM.' },
                { id: 'fresh', icon: '✨', title: 'Start fresh', desc: 'Create a clean account and set everything up from scratch.' },
              ].map((opt) => (
                <Surface key={opt.id} className={`cursor-pointer p-4 transition-all ${convertChoice === opt.id ? 'ring-2 ring-indigo-400' : ''}`} onClick={() => setConvertChoice(opt.id as any)}>
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <h3 className="font-bold text-slate-100">{opt.title}</h3>
                  <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>{opt.desc}</p>
                </Surface>
              ))}
            </div>

            {convertChoice === 'import' && (
              <Surface className="p-4">
                <h3 className="text-base font-bold text-slate-100 mb-3">Import options</h3>
                <div className="flex gap-3 mb-3">
                  <button onClick={() => setImportMethod('csv')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${importMethod === 'csv' ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>📄 CSV</button>
                  <button onClick={() => setImportMethod('api')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${importMethod === 'api' ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>🔌 API</button>
                </div>
                {importMethod === 'csv' ? (
                  <div className="p-6 rounded-xl border-2 border-dashed border-white/10 text-center">
                    <div className="text-2xl mb-2">📄</div>
                    <p className="text-sm" style={{ color: tokens.color.muted }}>Drop CSV here or click to browse</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {['Buildium', 'AppFolio', 'Rent Manager', 'Yardi'].map((crm) => (
                      <div key={crm} className="p-2 rounded-lg bg-white/5 text-center text-xs text-slate-300">{crm}</div>
                    ))}
                  </div>
                )}
              </Surface>
            )}

            {convertChoice && (
              <Button onClick={handleConvert} size="lg" className="w-full">
                {convertChoice === 'keep' && 'Create account with demo data →'}
                {convertChoice === 'import' && 'Continue to import →'}
                {convertChoice === 'webhook' && 'Set up webhook →'}
                {convertChoice === 'fresh' && 'Create account →'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-surface/90 border-t border-white/5 safe-area-pb">
        <div className="flex justify-around items-center px-1 py-1">
          {TABS.slice(0, 5).map((n) => (
            <button key={n.id} onClick={() => setTab(n.id as DemoTab)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${tab === n.id ? 'text-indigo-300' : 'text-slate-500'}`}>
              <span className="text-lg">{n.icon}</span>
              <span className="text-[9px] font-medium">{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DemoWalkthroughPage;
