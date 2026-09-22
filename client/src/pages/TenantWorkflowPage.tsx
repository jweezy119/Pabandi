import { useState, useEffect } from 'react';
import { propertyManagerService, courtCheckService } from '../services/api';

type Tenant = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  status: string;
  riskBand?: string | null;
};

type Lease = {
  id: string;
  tenantEmail: string;
  tenantName?: string | null;
  startDate: string;
  endDate: string;
  rentAmount: number;
  rentPeriod: string;
  depositAmount: number;
  status: string;
  lateFee?: number;
  petFee?: number;
  petMonthly?: number;
  lateGraceDays?: number;
  utilities?: string[];
};

type Property = {
  id: string;
  title: string;
  address?: string | null;
  rentAmount?: number | null;
  status: string;
};

type CourtResult = {
  riskBand: string;
  totalCases: number;
  criminalCount: number;
  felonyCount: number;
  evictionCount: number;
  civilCases: number;
  recentEviction: boolean;
  criminalFound: boolean;
  evictionFound: boolean;
  cases: any[];
  riskFactors?: string[];
};

type Step = 'dashboard' | 'add' | 'screen' | 'lease' | 'movein';

const riskTone: Record<string, 'success' | 'warning' | 'danger'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };

export const TenantWorkflowPage: React.FC = () => {
  const [step, setStep] = useState<Step>('dashboard');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [tenantForm, setTenantForm] = useState({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' as const });
  const [screenForm, setScreenForm] = useState({ tenantEmail: '', tenantName: '', state: '' });
  const [screenResult, setScreenResult] = useState<CourtResult | null>(null);
  const [screening, setScreening] = useState(false);
  const [leaseForm, setLeaseForm] = useState({
    tenantEmail: '',
    tenantName: '',
    propertyId: '',
    startDate: '',
    endDate: '',
    rentAmount: '',
    rentPeriod: 'MONTH' as const,
    depositAmount: '0',
    petFee: '0',
    petMonthly: '0',
    lateFee: '0',
    lateGraceDays: '5',
    utilities: [] as string[],
    notes: '',
  });

  const load = async () => {
    try {
      const res = await propertyManagerService.dashboard();
      const dash = res.data?.data;
      setTenants(dash?.tenants || []);
      setLeases(dash?.leases || []);
      setProperties(dash?.properties || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addTenant = async () => {
    if (!tenantForm.email) return;
    setSaving(true);
    setError('');
    try {
      await propertyManagerService.addTenant(tenantForm);
      setSuccess('Tenant added successfully');
      setTenantForm({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' });
      setStep('dashboard');
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not add tenant');
    } finally {
      setSaving(false);
    }
  };

  const runScreening = async () => {
    if (!screenForm.tenantEmail) return;
    setScreening(true);
    setScreenResult(null);
    setError('');
    try {
      const res = await courtCheckService.courtCheckByName(screenForm.tenantName || screenForm.tenantEmail, screenForm.state);
      const data = res.data?.data || res.data;
      setScreenResult({
        riskBand: data.riskBand || data.band || 'LOW',
        totalCases: data.totalCases || 0,
        criminalCount: data.criminalCount || 0,
        felonyCount: data.felonyCount || 0,
        evictionCount: data.evictionCount || 0,
        civilCases: data.civilCases || 0,
        recentEviction: data.recentEviction || false,
        criminalFound: data.criminalFound || false,
        evictionFound: data.evictionFound || false,
        cases: data.cases || [],
        riskFactors: data.riskFactors || [],
      });
      await propertyManagerService.screenTenant({
        tenantEmail: screenForm.tenantEmail,
        tenantName: screenForm.tenantName,
        source: 'COURTLISTENER',
        state: screenForm.state,
      });
      setSuccess('Screening saved to tenant record');
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Screening failed');
    } finally {
      setScreening(false);
    }
  };

  const createLease = async () => {
    if (!leaseForm.tenantEmail || !leaseForm.startDate || !leaseForm.endDate || !leaseForm.rentAmount) return;
    setSaving(true);
    setError('');
    try {
      await propertyManagerService.addLease({
        ...leaseForm,
        rentAmount: Number(leaseForm.rentAmount),
        depositAmount: Number(leaseForm.depositAmount),
        petFee: Number(leaseForm.petFee),
        petMonthly: Number(leaseForm.petMonthly),
        lateFee: Number(leaseForm.lateFee),
        lateGraceDays: Number(leaseForm.lateGraceDays),
        utilities: leaseForm.utilities,
      });
      setSuccess('Lease created successfully');
      setLeaseForm({
        tenantEmail: '',
        tenantName: '',
        propertyId: '',
        startDate: '',
        endDate: '',
        rentAmount: '',
        rentPeriod: 'MONTH',
        depositAmount: '0',
        petFee: '0',
        petMonthly: '0',
        lateFee: '0',
        lateGraceDays: '5',
        utilities: [],
        notes: '',
      });
      setStep('dashboard');
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not create lease');
    } finally {
      setSaving(false);
    }
  };

  const toggleUtility = (u: string) => {
    setLeaseForm(f => ({
      ...f,
      utilities: f.utilities.includes(u) ? f.utilities.filter(x => x !== u) : [...f.utilities, u],
    }));
  };

  const selectTenant = (t: Tenant) => {
    const name = `${t.firstName || ''} ${t.lastName || ''}`.trim();
    setLeaseForm(f => ({ ...f, tenantEmail: t.email, tenantName: name }));
    setScreenForm(f => ({ ...f, tenantEmail: t.email, tenantName: name }));
  };

  const bandColor: Record<string, string> = { LOW: 'var(--sage)', MEDIUM: '#ca8a04', HIGH: 'var(--terracotta)' };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(circle at top left, var(--warm-ink), #020617)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--soft-stone)]">Loading tenant workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-0 mt-16" style={{ background: 'radial-gradient(circle at top left, var(--warm-ink), #020617)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold font-headline text-[var(--warm-ink)]">Tenant Workflow</h1>
          <p className="text-sm mt-1 text-[var(--soft-stone)]">Add tenants, run CourtListener screening, create leases, and track move-ins.</p>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-[var(--terracotta)]/10 text-[var(--terracotta)] border border-red-500/20">{error}</div>}
        {success && <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-[var(--sage)]/10 text-[var(--sage)] border border-[var(--sage)]/20">{success}</div>}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'add', label: 'Add Tenant', icon: '➕' },
            { id: 'screen', label: 'Screen', icon: '🔍' },
            { id: 'lease', label: 'Lease', icon: '📝' },
            { id: 'movein', label: 'Move-In', icon: '🏠' },
          ] as const).map(s => (
            <button key={s.id} onClick={() => { setError(''); setSuccess(''); setStep(s.id); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${step === s.id ? 'bg-[var(--clay)]/20 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.2)] hover:bg-[var(--warm-sand)]'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {step === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-4">
                <div className="text-2xl font-bold text-[var(--warm-ink)]">{tenants.length}</div>
                <div className="text-xs text-[var(--soft-stone)]">Total Tenants</div>
              </div>
              <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-4">
                <div className="text-2xl font-bold text-[var(--warm-ink)]">{leases.filter(l => l.status === 'ACTIVE').length}</div>
                <div className="text-xs text-[var(--soft-stone)]">Active Leases</div>
              </div>
              <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-4">
                <div className="text-2xl font-bold text-[var(--warm-ink)]">{properties.length}</div>
                <div className="text-xs text-[var(--soft-stone)]">Properties</div>
              </div>
              <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-4">
                <div className="text-2xl font-bold text-[var(--sage)]">{tenants.filter(t => t.riskBand === 'LOW').length}</div>
                <div className="text-xs text-[var(--soft-stone)]">Low Risk</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('add')} className="px-4 py-2 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold hover:bg-[var(--terracotta)]">+ Add Tenant</button>
              <button onClick={() => setStep('screen')} className="px-4 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold hover:bg-[var(--warm-sand)]">🔍 Quick Screen</button>
              <button onClick={() => setStep('lease')} className="px-4 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold hover:bg-[var(--warm-sand)]">📝 New Lease</button>
            </div>

            {tenants.length === 0 ? (
              <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-8 text-center">
                <p className="text-[var(--soft-stone)] mb-4">No tenants yet. Start by adding your first tenant.</p>
                <button onClick={() => setStep('add')} className="px-6 py-2 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold">Add Your First Tenant</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tenants.map(t => (
                  <div key={t.id} onClick={() => selectTenant(t)} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-4 cursor-pointer hover:bg-[var(--warm-sand)] transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-[var(--warm-ink)]">{t.firstName || ''} {t.lastName || t.email}</div>
                        <div className="text-xs text-[var(--soft-stone)] mt-1">{t.email} · {t.status} · stays: 0</div>
                      </div>
                      {t.riskBand && <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${riskTone[t.riskBand] === 'success' ? 'bg-[var(--sage)]/20 text-[var(--sage)]' : riskTone[t.riskBand] === 'warning' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-[var(--terracotta)]/20 text-[var(--terracotta)]'}`}>{t.riskBand}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'add' && (
          <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-[var(--warm-ink)]">➕ Add Tenant</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={tenantForm.firstName} onChange={e => setTenantForm({ ...tenantForm, firstName: e.target.value })} placeholder="First name" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={tenantForm.lastName} onChange={e => setTenantForm({ ...tenantForm, lastName: e.target.value })} placeholder="Last name" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
            </div>
            <input value={tenantForm.email} onChange={e => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="Email *" type="email" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
            <input value={tenantForm.phone} onChange={e => setTenantForm({ ...tenantForm, phone: e.target.value })} placeholder="Phone" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
            <select value={tenantForm.status} onChange={e => setTenantForm({ ...tenantForm, status: e.target.value as any })} className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]">
              <option value="PROSPECT">Prospect</option>
              <option value="APPLIED">Applied</option>
              <option value="APPROVED">Approved</option>
              <option value="ACTIVE">Active</option>
            </select>
            <div className="flex gap-2">
              <button onClick={addTenant} disabled={saving} className="flex-1 px-4 py-3 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold hover:bg-[var(--terracotta)] disabled:opacity-50">{saving ? 'Saving...' : 'Save Tenant'}</button>
              <button onClick={() => setStep('dashboard')} className="px-4 py-3 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold hover:bg-[var(--warm-sand)]">Cancel</button>
            </div>
          </div>
        )}

        {step === 'screen' && (
          <div className="space-y-4">
            <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-[var(--warm-ink)]">🔍 CourtListener Screening</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={screenForm.tenantName} onChange={e => setScreenForm({ ...screenForm, tenantName: e.target.value })} placeholder="Full name" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
                <input value={screenForm.tenantEmail} onChange={e => setScreenForm({ ...screenForm, tenantEmail: e.target.value })} placeholder="Email" type="email" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              </div>
              <input value={screenForm.state} onChange={e => setScreenForm({ ...screenForm, state: e.target.value })} placeholder="State (e.g. IL)" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <button onClick={runScreening} disabled={screening} className="w-full px-4 py-3 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold hover:bg-[var(--terracotta)] disabled:opacity-50">{screening ? 'Running CourtListener check…' : 'Run Full Screening'}</button>
              <p className="text-xs text-[var(--soft-stone)]">Searches criminal, civil/eviction, and bankruptcy records via CourtListener. Free API; rate-limited.</p>
            </div>

            {screenResult && (
              <div className="space-y-4">
                <div className="bg-[var(--warm-sand)] border rounded-xl p-6" style={{ borderColor: `${bandColor[screenResult.riskBand] || '#888'}40` }}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--soft-stone)]">Verdict</p>
                      <p className="text-2xl font-bold font-headline" style={{ color: bandColor[screenResult.riskBand] }}>{screenResult.riskBand} RISK</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-bold font-headline" style={{ color: bandColor[screenResult.riskBand] }}>{screenResult.totalCases}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{screenResult.criminalCount} criminal · {screenResult.evictionCount} eviction · {screenResult.civilCases} civil</p>
                    </div>
                  </div>
                </div>

                {(screenResult.riskFactors?.length || 0) > 0 && (
                  <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6">
                    <h3 className="font-bold text-[var(--warm-ink)] mb-3">⚠️ Risk Factors</h3>
                    <div className="space-y-2">
                      {(screenResult.riskFactors || []).map((f, i) => (<div key={i} className="text-sm text-[var(--warm-ink)]">• {f}</div>))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6">
                    <h3 className="font-bold text-[var(--warm-ink)] mb-3">🚨 Criminal ({screenResult.criminalCount})</h3>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 rounded-lg bg-[var(--warm-sand)]"><div className="text-xl font-bold text-[var(--terracotta)]">{screenResult.criminalCount}</div><div className="text-xs text-[var(--soft-stone)]">Total</div></div>
                      <div className="p-3 rounded-lg bg-[var(--warm-sand)]"><div className="text-xl font-bold text-[var(--terracotta)]">{screenResult.felonyCount}</div><div className="text-xs text-[var(--soft-stone)]">Felonies</div></div>
                      <div className="p-3 rounded-lg bg-[var(--warm-sand)]"><div className="text-xl font-bold">{screenResult.criminalFound ? '🔴 YES' : '🟢 NO'}</div><div className="text-xs text-[var(--soft-stone)]">Found</div></div>
                      <div className="p-3 rounded-lg bg-[var(--warm-sand)]"><div className="text-xl font-bold">{screenResult.recentEviction ? '🔴 YES' : '🟢 NO'}</div><div className="text-xs text-[var(--soft-stone)]">Recent Eviction</div></div>
                    </div>
                  </div>

                  <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6">
                    <h3 className="font-bold text-[var(--warm-ink)] mb-3">📑 Civil / Eviction ({screenResult.evictionCount + screenResult.civilCases})</h3>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 rounded-lg bg-[var(--warm-sand)]"><div className="text-xl font-bold text-[var(--muted-ochre)]">{screenResult.evictionCount}</div><div className="text-xs text-[var(--soft-stone)]">Evictions</div></div>
                      <div className="p-3 rounded-lg bg-[var(--warm-sand)]"><div className="text-xl font-bold text-[var(--clay)]">{screenResult.civilCases}</div><div className="text-xs text-[var(--soft-stone)]">Civil Cases</div></div>
                      <div className="p-3 rounded-lg bg-[var(--warm-sand)]"><div className="text-xl font-bold">{screenResult.evictionFound ? '🔴 YES' : '🟢 NO'}</div><div className="text-xs text-[var(--soft-stone)]">Eviction Found</div></div>
                      <div className="p-3 rounded-lg bg-[var(--warm-sand)]"><div className="text-xl font-bold">{screenResult.recentEviction ? '🔴 YES' : '🟢 NO'}</div><div className="text-xs text-[var(--soft-stone)]">Recent</div></div>
                    </div>
                  </div>
                </div>

                {screenResult.cases?.length > 0 && (
                  <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6">
                    <h3 className="font-bold text-[var(--warm-ink)] mb-3">Case Records</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {screenResult.cases.map((c: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg bg-[var(--warm-sand)] text-sm">
                          <div className="font-semibold text-[var(--warm-ink)]">{c.caseName || 'Unknown Case'}</div>
                          <div className="text-xs text-[var(--soft-stone)]">{c.court} · {c.courtType} · {c.dateFiled} {c.dateTerminated ? `→ ${c.dateTerminated}` : ''}</div>
                          <div className="text-xs text-[var(--soft-stone)]">{c.natureOfSuit} · {c.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'lease' && (
          <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-[var(--warm-ink)]">📝 Create Lease</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={leaseForm.tenantEmail} onChange={e => setLeaseForm({ ...leaseForm, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={leaseForm.tenantName} onChange={e => setLeaseForm({ ...leaseForm, tenantName: e.target.value })} placeholder="Tenant name" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <select value={leaseForm.propertyId} onChange={e => setLeaseForm({ ...leaseForm, propertyId: e.target.value })} className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]">
                <option value="">Select property</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.title} — {p.address}</option>)}
              </select>
              <select value={leaseForm.rentPeriod} onChange={e => setLeaseForm({ ...leaseForm, rentPeriod: e.target.value as any })} className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]">
                <option value="MONTH">Monthly</option>
                <option value="WEEK">Weekly</option>
              </select>
              <input value={leaseForm.startDate} onChange={e => setLeaseForm({ ...leaseForm, startDate: e.target.value })} type="date" placeholder="Start date" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={leaseForm.endDate} onChange={e => setLeaseForm({ ...leaseForm, endDate: e.target.value })} type="date" placeholder="End date" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={leaseForm.rentAmount} onChange={e => setLeaseForm({ ...leaseForm, rentAmount: e.target.value })} placeholder="Rent amount *" type="number" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={leaseForm.depositAmount} onChange={e => setLeaseForm({ ...leaseForm, depositAmount: e.target.value })} placeholder="Deposit" type="number" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={leaseForm.petFee} onChange={e => setLeaseForm({ ...leaseForm, petFee: e.target.value })} placeholder="Pet fee" type="number" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={leaseForm.petMonthly} onChange={e => setLeaseForm({ ...leaseForm, petMonthly: e.target.value })} placeholder="Monthly pet rent" type="number" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={leaseForm.lateFee} onChange={e => setLeaseForm({ ...leaseForm, lateFee: e.target.value })} placeholder="Late fee" type="number" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
              <input value={leaseForm.lateGraceDays} onChange={e => setLeaseForm({ ...leaseForm, lateGraceDays: e.target.value })} placeholder="Late grace days" type="number" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
            </div>

            <div>
              <p className="text-xs font-semibold text-[var(--warm-ink)] mb-2">Included Utilities</p>
              <div className="flex flex-wrap gap-2">
                {['WATER', 'ELECTRIC', 'GAS', 'INTERNET', 'TRASH'].map(u => (
                  <button key={u} onClick={() => toggleUtility(u)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${leaseForm.utilities.includes(u) ? 'bg-[var(--clay)]/20 text-[var(--clay)] border border-[var(--clay)]/40' : 'bg-[var(--warm-sand)] text-[var(--warm-ink)] border border-[rgba(191,179,163,0.2)]'}`}>{u}</button>
                ))}
              </div>
            </div>

            <textarea value={leaseForm.notes} onChange={e => setLeaseForm({ ...leaseForm, notes: e.target.value })} placeholder="Lease notes" className="w-full rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />

            <div className="flex gap-2">
              <button onClick={createLease} disabled={saving} className="flex-1 px-4 py-3 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold hover:bg-[var(--terracotta)] disabled:opacity-50">{saving ? 'Creating...' : 'Create Lease'}</button>
              <button onClick={() => setStep('dashboard')} className="px-4 py-3 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] text-[var(--warm-ink)] rounded-lg text-sm font-semibold hover:bg-[var(--warm-sand)]">Cancel</button>
            </div>
          </div>
        )}

        {step === 'movein' && (
          <div className="space-y-4">
            <div className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">🏠 Active Tenants & Leases</h3>
              <p className="text-xs text-[var(--soft-stone)] mb-4">Track move-ins, active leases, and payment terms.</p>
              {leases.length === 0 && <p className="text-[var(--soft-stone)]">No leases yet.</p>}
              <div className="space-y-2">
                {leases.map(l => (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--warm-sand)]">
                    <div>
                      <div className="font-semibold text-[var(--warm-ink)]">{l.tenantName || l.tenantEmail}</div>
                      <div className="text-xs text-[var(--soft-stone)]">{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()} · ${l.rentAmount}/{l.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</div>
                      <div className="text-xs text-[var(--soft-stone)]">Deposit ${l.depositAmount} · Late ${l.lateFee ?? 0} · Pet fee ${l.petFee ?? 0} · Pet rent ${l.petMonthly ?? 0}</div>
                      {(l.utilities || []).length > 0 && <div className="text-xs text-[var(--soft-stone)]">Utilities: {(l.utilities || []).join(', ')}</div>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${l.status === 'ACTIVE' ? 'bg-[var(--sage)]/20 text-[var(--sage)]' : l.status === 'DRAFT' ? 'bg-[var(--sky-wash)]/20 text-[var(--sky-wash)]' : 'bg-yellow-500/20 text-yellow-300'}`}>{l.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
