import React, { useState, useEffect, useCallback } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService, aiRealEstateService } from '../services/api';
import { CRM_CONFIG, BUSINESS_TYPES, BusinessType } from '../config/crmConfig';
import { Link } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

type Profile = { id: string; companyName?: string | null; businessType: BusinessType; slug?: string | null; domain?: string | null; brandColor?: string | null; logoUrl?: string | null; tagline?: string | null; active: boolean };
type Property = { id: string; title: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; bedrooms: number; bathrooms: number; rentAmount?: number | null; rentPeriod: string; status: string; unit?: any };
type Tenant = { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; status: string; riskBand?: string | null; depositHeld: number; totalStays: number; notes?: string | null; property?: any; lease?: any; screenedAt?: string | null };
type Screening = { id: string; tenantEmail: string; tenantName?: string | null; band: string; depositAdjPct: number; screenedAt: string; source: string };
type Appointment = { id: string; tenantEmail: string; tenantName?: string | null; startsAt: string; status: string };
type Lease = { id: string; tenantEmail: string; tenantName?: string | null; startDate: string; endDate: string; rentAmount: number; rentPeriod: string; status: string };
type Maintenance = { id: string; tenantEmail?: string | null; title: string; description?: string | null; priority: string; status: string; cost?: number | null };
type Application = { id: string; email: string; firstName?: string | null; lastName?: string | null; status: string; createdAt: string };
type Dashboard = { profile: Profile; properties: Property[]; tenants: Tenant[]; screenings: Screening[]; appointments: Appointment[]; leases: Lease[]; maintenance: Maintenance[]; applications: Application[]; stats: any };
type Doc = { id: string; tenantEmail: string; type: string; url: string; fileName?: string | null; createdAt: string };
type Webhook = { id: string; url: string; events?: string[] | null; lastStatus?: string | null };
type Activity = { id: string; action: string; entityType: string; description: string; createdAt: string };

const riskTone: Record<string, 'success' | 'warning' | 'danger'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };


// ─── Main Page ───────────────────────────────────────────────────────────────

export const CRMPage: React.FC = () => {
  const [enrolling, setEnrolling] = useState(false);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<string>('overview');
  const [bizType, setBizType] = useState<BusinessType>('GENERAL');

  const config = dash?.profile ? CRM_CONFIG[dash.profile.businessType] || CRM_CONFIG.GENERAL : CRM_CONFIG.GENERAL;

  const load = useCallback(() => {
    setLoading(true);
    propertyManagerService.dashboard()
      .then((r) => { setDash(r.data?.data); setErr(''); })
      .catch((e) => { if (e?.response?.status === 404) setDash(null); else setErr(e?.response?.data?.error || 'Could not load dashboard'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const enroll = async () => {
    setEnrolling(true); setErr('');
    try { await propertyManagerService.enroll({ companyName: 'My Business', businessType: bizType }); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not enroll'); }
    finally { setEnrolling(false); }
  };

  const inputClass = 'w-full bg-white/5 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 px-4 py-3 outline-none text-sm transition-all';

  // ─── Enrollment Screen ─────────────────────────────────────────────────────

  if (dash === null && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 md:p-6" style={{ background: tokens.color.background }}>
        <Surface className="text-center max-w-md w-full p-8 md:p-10">
          <div className="text-5xl md:text-6xl mb-4">📋</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100 font-headline">Universal CRM</h1>
          <p className="mt-3 text-slate-400 leading-relaxed text-sm md:text-base">One CRM for any business — property management, sales, services, freelance, or general.</p>
          <div className="mt-6 text-left">
            <label className="text-sm font-semibold text-slate-300 mb-2 block">What kind of business?</label>
            <div className="grid gap-2">
              {BUSINESS_TYPES.map((bt) => (
                <button key={bt.value} onClick={() => setBizType(bt.value)}
                  className={`text-left p-3 rounded-xl border transition-all active:scale-[0.98] ${bizType === bt.value ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                  <div className="font-semibold text-slate-100 text-sm">{bt.label}</div>
                  <div className="text-xs text-slate-400">{bt.description}</div>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={enroll} disabled={enrolling} className="mt-6 w-full">{enrolling ? 'Setting up…' : 'Activate my free CRM'}</Button>
          {err && <p className="mt-3 text-sm" style={{ color: tokens.color.danger }}>{err}</p>}
        </Surface>
      </div>
    );
  }

  if (loading || !dash) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ color: tokens.color.muted }}>Loading your CRM...</p>
        </div>
      </div>
    );
  }

  const s = dash.stats;
  const portalUrl = `${window.location.origin}/p/${dash.profile.slug || ''}`;

  const navItems = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'properties', icon: config.entities.properties.icon, label: config.entities.properties.label },
    { id: 'tenants', icon: '👥', label: config.entities.tenants.label },
    { id: 'screen', icon: '🔍', label: 'Screening' },
    { id: 'appointments', icon: '📅', label: 'Schedule' },
    { id: 'leases', icon: '📄', label: 'Leases' },
    { id: 'maintenance', icon: '🔧', label: 'Maintenance' },
    { id: 'financials', icon: '💰', label: 'Financials' },
    { id: 'documents', icon: '📁', label: 'Documents' },
    { id: 'ai', icon: '🤖', label: 'AI Tools' },
    { id: 'portal', icon: '🎨', label: 'Portal' },
    { id: 'webhooks', icon: '🔗', label: 'Webhooks' },
    { id: 'activity', icon: '📜', label: 'Activity' },
  ];

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: tokens.color.background }}>
      {/* Header */}
      <div className="sticky top-14 z-30 backdrop-blur-xl bg-surface/80 border-b border-white/5 px-4 py-2 md:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-100">{dash.profile.companyName || 'My Business'}</h1>
            <p className="text-xs" style={{ color: tokens.color.muted }}>{config.label} · {dash.properties.length} {config.entities.properties.label.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success">{s.occupied || 0} Active</Badge>
          </div>
        </div>
      </div>

      {/* Desktop Tab Bar */}
      <div className="hidden md:flex gap-2 px-6 py-2 max-w-6xl mx-auto flex-wrap">
        {navItems.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === n.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
        {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger, border: `1px solid ${tokens.color.danger}30` }}>{err}</div>}

        {tab === 'overview' && <OverviewTab dash={dash} s={s} riskTone={riskTone} setTab={setTab} />}
        {tab === 'properties' && <PropertiesTab dash={dash} config={config} inputClass={inputClass} load={load} setErr={setErr} />}
        {tab === 'tenants' && <TenantsTab dash={dash} config={config} inputClass={inputClass} load={load} setErr={setErr} riskTone={riskTone} />}
        {tab === 'screen' && <ScreeningTab dash={dash} inputClass={inputClass} load={load} setErr={setErr} riskTone={riskTone} />}
        {tab === 'appointments' && <AppointmentsTab dash={dash} inputClass={inputClass} load={load} setErr={setErr} />}
        {tab === 'leases' && <LeasesTab dash={dash} inputClass={inputClass} load={load} setErr={setErr} />}
        {tab === 'maintenance' && <MaintenanceTab dash={dash} inputClass={inputClass} load={load} setErr={setErr} />}
        {tab === 'financials' && <FinancialsTab dash={dash} inputClass={inputClass} load={load} setErr={setErr} />}
        {tab === 'documents' && <DocumentsTab inputClass={inputClass} setErr={setErr} />}
        {tab === 'ai' && <AIToolsTab />}
        {tab === 'portal' && (
          <Surface>
            <h3 className="text-lg font-bold text-slate-100 mb-2">🎨 Your client portal</h3>
            <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Clients visit this link to see your offerings and apply.</p>
            <div className="flex gap-2">
              <input readOnly value={portalUrl} className={inputClass} />
              <Button onClick={() => navigator.clipboard?.writeText(portalUrl)} variant="ghost">Copy</Button>
            </div>
          </Surface>
        )}
        {tab === 'webhooks' && <WebhooksTab inputClass={inputClass} setErr={setErr} />}
        {tab === 'activity' && <ActivityTab />}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-surface/90 border-t border-white/5 safe-area-pb">
        <div className="flex justify-around items-center px-1 py-1.5 overflow-x-auto no-scrollbar">
          {navItems.slice(0, 6).map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all min-w-[44px] ${tab === n.id ? 'text-indigo-300' : 'text-slate-500'}`}>
              <span className="text-base">{n.icon}</span>
              <span className="text-[9px] font-medium">{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ dash, s, setTab }: any) {
  const occupied = dash.properties.filter((p: any) => p.status === 'OCCUPIED').length;
  const occupancyRate = dash.properties.length > 0 ? Math.round((occupied / dash.properties.length) * 100) : 0;
  const totalRent = (dash.leases || []).filter((l: any) => l.status === 'ACTIVE').reduce((sum: number, l: any) => sum + (l.rentAmount || 0), 0);

  const insights: any[] = [];
  if (occupancyRate < 90 && dash.properties.length > 0) insights.push({ id: 'occ', type: 'warning', title: 'Low Occupancy', description: `At ${occupancyRate}%. ${dash.properties.length - occupied} properties vacant.`, priority: 'high' });
  const pendingScreenings = dash.tenants.filter((t: any) => t.status === 'APPLIED' && !t.riskBand).length;
  if (pendingScreenings > 0) insights.push({ id: 'screen', type: 'warning', title: 'Pending Screenings', description: `${pendingScreenings} applicant(s) need screening.`, priority: 'high' });
  const openMaint = dash.maintenance.filter((m: any) => m.status === 'OPEN' || m.status === 'IN_PROGRESS').length;
  if (openMaint > 0) insights.push({ id: 'maint', type: 'info', title: 'Open Maintenance', description: `${openMaint} request(s) pending.`, priority: 'medium' });
  if ((dash.leases || []).filter((l: any) => l.status === 'ACTIVE').length > 0) insights.push({ id: 'leases', type: 'success', title: 'Active Leases', description: `${(dash.leases || []).filter((l: any) => l.status === 'ACTIVE').length} lease(s) in good standing.`, priority: 'low' });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('properties')}><div className="text-2xl font-bold text-slate-100">{s.totalProperties || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Properties</div></Surface>
        <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('tenants')}><div className="text-2xl font-bold text-emerald-300">{s.occupied || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Active</div></Surface>
        <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('tenants')}><div className="text-2xl font-bold text-indigo-300">{s.vacant || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Available</div></Surface>
        <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('tenants')}><div className="text-2xl font-bold" style={{ color: (s.highRiskTenants || 0) > 0 ? tokens.color.danger : tokens.color.text }}>{s.highRiskTenants || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>High-risk</div></Surface>
        <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('appointments')}><div className="text-2xl font-bold text-slate-100">{s.upcomingAppointments || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Appointments</div></Surface>
        <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('leases')}><div className="text-2xl font-bold text-slate-100">{s.activeLeases || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Active Leases</div></Surface>
        <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('maintenance')}><div className="text-2xl font-bold text-slate-100">{s.openMaintenance || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Open Maint.</div></Surface>
        <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('financials')}><div className="text-2xl font-bold text-emerald-300">${totalRent.toLocaleString()}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Monthly Rent</div></Surface>
      </div>

      <Surface>
        <h3 className="text-base font-bold text-slate-100 mb-3">🤖 AI Insights</h3>
        <div className="space-y-2">
          {insights.map((i) => (
            <div key={i.id} className={`p-3 rounded-xl border ${i.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : i.type === 'success' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-100 text-sm">{i.title}</div>
                <Badge tone={i.priority === 'high' ? 'danger' : i.priority === 'medium' ? 'warning' : 'info'}>{i.priority}</Badge>
              </div>
              <div className="text-xs text-slate-300 mt-0.5">{i.description}</div>
            </div>
          ))}
        </div>
      </Surface>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Button onClick={() => setTab('properties')} variant="outline" className="w-full text-sm">+ Add Property</Button>
        <Button onClick={() => setTab('tenants')} variant="outline" className="w-full text-sm">+ Add Tenant</Button>
        <Button onClick={() => setTab('screen')} variant="outline" className="w-full text-sm">🔍 Screen</Button>
        <Button onClick={() => setTab('ai')} variant="outline" className="w-full text-sm">🤖 AI Tools</Button>
      </div>
    </div>
  );
}

// ─── Properties Tab ──────────────────────────────────────────────────────────

function PropertiesTab({ dash, config, inputClass, load, setErr }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' });

  const add = async () => {
    if (!form.title) return;
    try { await propertyManagerService.addProperty({ ...form, rentAmount: form.rentAmount ? Number(form.rentAmount) : undefined }); setForm({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' }); setShowForm(false); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not add'); }
  };

  return (
    <div className="space-y-3">
      {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Add {config.entities.properties.singular}</Button>}
      {showForm && (
        <Surface>
          <h3 className="text-lg font-bold text-slate-100 mb-4">{config.entities.properties.icon} Add {config.entities.properties.singular}</h3>
          <div className="space-y-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={`${config.entities.properties.singular} name *`} className={inputClass} />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className={inputClass} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className={inputClass} />
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" className={inputClass} />
              <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="ZIP" className={inputClass} />
              <input value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} placeholder="Rent" type="number" className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2 mt-4"><Button onClick={add} className="flex-1">Save</Button><Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button></div>
        </Surface>
      )}
      {dash.properties.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.muted }}>No {config.entities.properties.label.toLowerCase()} yet.</p>}
      {dash.properties.map((p: Property) => (
        <Link key={p.id} to={`/property/${p.id}`}>
          <Surface className="flex items-center justify-between active:scale-[0.98] transition-transform">
            <div><div className="font-semibold text-slate-100">{p.title}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{p.address}{p.city ? `, ${p.city}` : ''} · {p.bedrooms}bd/{p.bathrooms}ba</div></div>
            <div className="text-right">{p.rentAmount && <div className="font-bold text-slate-100">${p.rentAmount}</div>}<Badge tone={p.status === 'VACANT' ? 'info' : p.status === 'OCCUPIED' ? 'success' : 'warning'}>{p.status}</Badge></div>
          </Surface>
        </Link>
      ))}
    </div>
  );
}

// ─── Tenants Tab ─────────────────────────────────────────────────────────────

function TenantsTab({ dash, config, inputClass, load, setErr, riskTone }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' });
  const [selected, setSelected] = useState<Tenant | null>(null);

  const add = async () => {
    if (!form.email) return;
    try { await propertyManagerService.addTenant(form); setForm({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' }); setShowForm(false); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not add'); }
  };

  return (
    <div className="space-y-3">
      {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Add {config.entities.tenants.singular}</Button>}
      {showForm && (
        <Surface>
          <h3 className="text-lg font-bold text-slate-100 mb-4">{config.entities.tenants.icon} Add {config.entities.tenants.singular}</h3>
          <div className="space-y-3">
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" type="email" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className={inputClass} />
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className={inputClass} />
            </div>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={inputClass} />
          </div>
          <div className="flex gap-2 mt-4"><Button onClick={add} className="flex-1">Save</Button><Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button></div>
        </Surface>
      )}
      {dash.tenants.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.muted }}>No {config.entities.tenants.label.toLowerCase()} yet.</p>}
      {dash.tenants.map((t: Tenant) => (
        <button key={t.id} onClick={() => setSelected(selected?.id === t.id ? null : t)} className="w-full text-left active:scale-[0.98] transition-transform">
          <Surface className="flex items-center justify-between">
            <div><div className="font-semibold text-slate-100">{t.firstName || ''} {t.lastName || ''}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{t.email}{t.property ? ` · ${t.property.title || ''}` : ''}</div></div>
            <div className="text-right">{t.riskBand && <Badge tone={riskTone[t.riskBand] || 'info'}>{t.riskBand}</Badge>}<div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{t.status}</div></div>
          </Surface>
          {selected?.id === t.id && (
            <Surface className="mt-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span style={{ color: tokens.color.muted }}>Phone:</span> <span className="text-slate-100">{t.phone || 'N/A'}</span></div>
                <div><span style={{ color: tokens.color.muted }}>Deposit:</span> <span className="text-slate-100">${t.depositHeld}</span></div>
                <div><span style={{ color: tokens.color.muted }}>Screened:</span> <span className="text-slate-100">{t.screenedAt ? new Date(t.screenedAt).toLocaleDateString() : 'No'}</span></div>
                <div><span style={{ color: tokens.color.muted }}>Stays:</span> <span className="text-slate-100">{t.totalStays}</span></div>
              </div>
              {t.notes && <div className="mt-2 text-xs text-slate-300">{t.notes}</div>}
            </Surface>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Screening Tab ───────────────────────────────────────────────────────────

function ScreeningTab({ dash, inputClass, load, setErr, riskTone }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'COURTLISTENER', state: '' });

  const screen = async () => {
    if (!form.tenantEmail) return;
    try { await propertyManagerService.screenTenant(form); setForm({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'COURTLISTENER', state: '' }); setShowForm(false); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not screen'); }
  };

  return (
    <div className="space-y-3">
      {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Run Screening</Button>}
      {showForm && (
        <Surface>
          <h3 className="text-lg font-bold text-slate-100 mb-4">🔍 Run Screening</h3>
          <div className="space-y-3">
            <input value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className={inputClass} />
            <input value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} placeholder="Tenant name" className={inputClass} />
            <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State (e.g. IL)" className={inputClass} />
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputClass}>
              <option value="COURTLISTENER">🏛️ US CourtListener (real)</option>
              <option value="BACKGROUND_CHECK">🇵🇰 PK BackgroundCheck</option>
              <option value="MANUAL">✏️ Manual</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4"><Button onClick={screen} className="flex-1">Run</Button><Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button></div>
        </Surface>
      )}
      {dash.screenings.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.muted }}>No screenings yet.</p>}
      {dash.screenings.map((sc: Screening) => (
        <Surface key={sc.id} className="flex items-center justify-between">
          <div><div className="font-semibold text-slate-100">{sc.tenantName || sc.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{sc.source} · {new Date(sc.screenedAt).toLocaleDateString()}</div></div>
          <div className="text-right"><Badge tone={riskTone[sc.band] || 'info'}>{sc.band}</Badge>{sc.depositAdjPct > 0 && <div className="text-xs mt-1 font-semibold" style={{ color: tokens.color.danger }}>+{sc.depositAdjPct}%</div>}</div>
        </Surface>
      ))}
    </div>
  );
}

// ─── Appointments Tab ────────────────────────────────────────────────────────

function AppointmentsTab({ dash, inputClass, load, setErr }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenantEmail: '', tenantName: '', startsAt: '', endsAt: '', notes: '' });

  const add = async () => {
    if (!form.tenantEmail || !form.startsAt) return;
    try { await propertyManagerService.addAppointment(form); setForm({ tenantEmail: '', tenantName: '', startsAt: '', endsAt: '', notes: '' }); setShowForm(false); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); }
  };

  return (
    <div className="space-y-3">
      {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Schedule</Button>}
      {showForm && (
        <Surface>
          <h3 className="text-lg font-bold text-slate-100 mb-4">📅 Schedule Appointment</h3>
          <div className="space-y-3">
            <input value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className={inputClass} />
            <input value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} placeholder="Tenant name" className={inputClass} />
            <input value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} type="datetime-local" className={inputClass} />
            <input value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} type="datetime-local" className={inputClass} />
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={inputClass} />
          </div>
          <div className="flex gap-2 mt-4"><Button onClick={add} className="flex-1">Save</Button><Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button></div>
        </Surface>
      )}
      {dash.appointments.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.muted }}>No appointments yet.</p>}
      {dash.appointments.map((a: Appointment) => (
        <Surface key={a.id} className="flex items-center justify-between">
          <div><div className="font-semibold text-slate-100">{a.tenantName || a.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(a.startsAt).toLocaleString()}</div></div>
          <Badge tone={a.status === 'CONFIRMED' ? 'success' : a.status === 'COMPLETED' ? 'success' : 'info'}>{a.status}</Badge>
        </Surface>
      ))}
    </div>
  );
}

// ─── Leases Tab ──────────────────────────────────────────────────────────────

function LeasesTab({ dash, inputClass, load, setErr }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenantEmail: '', tenantName: '', startDate: '', endDate: '', rentAmount: '', rentPeriod: 'MONTH', depositAmount: '' });

  const add = async () => {
    if (!form.tenantEmail || !form.startDate || !form.endDate || !form.rentAmount) return;
    try { await propertyManagerService.addLease({ ...form, rentAmount: Number(form.rentAmount), depositAmount: form.depositAmount ? Number(form.depositAmount) : 0 }); setForm({ tenantEmail: '', tenantName: '', startDate: '', endDate: '', rentAmount: '', rentPeriod: 'MONTH', depositAmount: '' }); setShowForm(false); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); }
  };

  return (
    <div className="space-y-3">
      {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Add Lease</Button>}
      {showForm && (
        <Surface>
          <h3 className="text-lg font-bold text-slate-100 mb-4">📄 Add Lease</h3>
          <div className="space-y-3">
            <input value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className={inputClass} />
            <input value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} placeholder="Tenant name" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} type="date" className={inputClass} />
              <input value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} type="date" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} placeholder="Rent *" type="number" className={inputClass} />
              <input value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} placeholder="Deposit" type="number" className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2 mt-4"><Button onClick={add} className="flex-1">Save</Button><Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button></div>
        </Surface>
      )}
      {dash.leases.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.muted }}>No leases yet.</p>}
      {dash.leases.map((l: Lease) => (
        <Surface key={l.id} className="flex items-center justify-between">
          <div><div className="font-semibold text-slate-100">{l.tenantName || l.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()} · ${l.rentAmount}</div></div>
          <Badge tone={l.status === 'ACTIVE' ? 'success' : 'info'}>{l.status}</Badge>
        </Surface>
      ))}
    </div>
  );
}

// ─── Maintenance Tab ─────────────────────────────────────────────────────────

function MaintenanceTab({ dash, inputClass, load, setErr }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', tenantEmail: '' });

  const add = async () => {
    if (!form.title) return;
    try { await propertyManagerService.addMaintenance(form); setForm({ title: '', description: '', priority: 'MEDIUM', tenantEmail: '' }); setShowForm(false); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); }
  };

  return (
    <div className="space-y-3">
      {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Report</Button>}
      {showForm && (
        <Surface>
          <h3 className="text-lg font-bold text-slate-100 mb-4">🔧 Report Maintenance</h3>
          <div className="space-y-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title *" className={inputClass} />
            <input value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} placeholder="Tenant email" className={inputClass} />
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
              <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option>
            </select>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputClass} />
          </div>
          <div className="flex gap-2 mt-4"><Button onClick={add} className="flex-1">Submit</Button><Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button></div>
        </Surface>
      )}
      {dash.maintenance.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.muted }}>No maintenance yet.</p>}
      {dash.maintenance.map((m: Maintenance) => (
        <Surface key={m.id} className="flex items-center justify-between">
          <div><div className="font-semibold text-slate-100">{m.title}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{m.description}{m.cost ? ` · $${m.cost}` : ''}</div></div>
          <Badge tone={m.priority === 'URGENT' || m.priority === 'HIGH' ? 'danger' : 'warning'}>{m.priority}</Badge>
        </Surface>
      ))}
    </div>
  );
}

// ─── Financials Tab ──────────────────────────────────────────────────────────

function FinancialsTab({ dash, inputClass, setErr }: any) {
  const [propertyId, setPropertyId] = useState<string>('');
  const [summary, setSummary] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ tenantEmail: '', amount: '', dueDate: '', status: 'PENDING' });

  const loadFinancials = async (pid: string) => {
    if (!pid) return;
    try {
      const [sRes, pRes] = await Promise.all([propertyManagerService.financialSummary(pid), propertyManagerService.rentPayments(pid)]);
      setSummary(sRes.data?.data || sRes.data);
      setPayments(pRes.data?.data || pRes.data || []);
    } catch (e: any) { setErr(e?.response?.data?.error || 'Could not load financials'); }
  };

  const addPayment = async () => {
    if (!propertyId || !payForm.amount) return;
    try { await propertyManagerService.addRentPayment({ ...payForm, propertyId, amount: Number(payForm.amount) }); setPayForm({ tenantEmail: '', amount: '', dueDate: '', status: 'PENDING' }); setShowPayForm(false); loadFinancials(propertyId); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not add payment'); }
  };

  const totalRent = (dash.leases || []).filter((l: any) => l.status === 'ACTIVE').reduce((sum: number, l: any) => sum + (l.rentAmount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Surface className="text-center"><div className="text-xl font-bold text-emerald-300">${totalRent.toLocaleString()}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Monthly Rent Roll</div></Surface>
        <Surface className="text-center"><div className="text-xl font-bold text-indigo-300">{dash.leases.filter((l: any) => l.status === 'ACTIVE').length}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Active Leases</div></Surface>
        <Surface className="text-center"><div className="text-xl font-bold text-amber-300">{dash.properties.filter((p: any) => p.status === 'VACANT').length}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Vacant Units</div></Surface>
        <Surface className="text-center"><div className="text-xl font-bold text-slate-100">${(totalRent * 12).toLocaleString()}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Annual Revenue</div></Surface>
      </div>

      <Surface>
        <h3 className="text-base font-bold text-slate-100 mb-3">💰 Property Financials</h3>
        <div className="flex gap-2 mb-4">
          <select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); loadFinancials(e.target.value); }} className={inputClass}>
            <option value="">Select property</option>
            {dash.properties.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-emerald-300">${(summary.totalIncome || 0).toLocaleString()}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Total Income</div></div>
            <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-rose-300">${(summary.totalExpenses || 0).toLocaleString()}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Expenses</div></div>
            <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-indigo-300">${((summary.totalIncome || 0) - (summary.totalExpenses || 0)).toLocaleString()}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Net</div></div>
          </div>
        )}
      </Surface>

      <Surface>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-100">💳 Rent Payments</h3>
          {propertyId && <Button onClick={() => setShowPayForm(!showPayForm)} size="sm">{showPayForm ? 'Cancel' : '+ Add Payment'}</Button>}
        </div>
        {showPayForm && (
          <div className="space-y-2 mb-4 p-3 rounded-xl bg-white/5">
            <input value={payForm.tenantEmail} onChange={(e) => setPayForm({ ...payForm, tenantEmail: e.target.value })} placeholder="Tenant email" className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <input value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Amount" type="number" className={inputClass} />
              <input value={payForm.dueDate} onChange={(e) => setPayForm({ ...payForm, dueDate: e.target.value })} type="date" className={inputClass} />
            </div>
            <Button onClick={addPayment} className="w-full">Save Payment</Button>
          </div>
        )}
        {payments.length === 0 && <p className="text-sm" style={{ color: tokens.color.muted }}>{propertyId ? 'No payments yet.' : 'Select a property to view payments.'}</p>}
        {payments.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 mb-2">
            <div><div className="font-semibold text-slate-100 text-sm">${p.amount}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{p.tenantEmail || 'No tenant'} · Due {new Date(p.dueDate).toLocaleDateString()}</div></div>
            <Badge tone={p.status === 'PAID' ? 'success' : p.status === 'OVERDUE' ? 'danger' : 'warning'}>{p.status}</Badge>
          </div>
        ))}
      </Surface>

      <Link to="/rent-roll"><Button className="w-full" variant="outline">View Detailed Rent Roll →</Button></Link>
    </div>
  );
}

// ─── Documents Tab ───────────────────────────────────────────────────────────

function DocumentsTab({ inputClass, setErr }: any) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenantEmail: '', type: 'OTHER', url: '', fileName: '' });
  const [filter, setFilter] = useState('ALL');

  const loadDocs = async () => { try { const r = await propertyManagerService.documents(); setDocs(r.data?.data || r.data || []); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not load documents'); } };
  useEffect(() => { loadDocs(); }, []);

  const upload = async () => {
    if (!form.url || !form.tenantEmail) return;
    try { await propertyManagerService.uploadDocument(form); setForm({ tenantEmail: '', type: 'OTHER', url: '', fileName: '' }); setShowForm(false); loadDocs(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not upload'); }
  };

  const remove = async (id: string) => { try { await propertyManagerService.deleteDocument(id); loadDocs(); } catch (_e) { setErr('Could not delete'); } };
  const filtered = filter === 'ALL' ? docs : docs.filter(d => d.type === filter);

  return (
    <div className="space-y-3">
      {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Upload Document</Button>}
      {showForm && (
        <Surface>
          <h3 className="text-lg font-bold text-slate-100 mb-4">📁 Upload Document</h3>
          <div className="space-y-3">
            <input value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className={inputClass} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>
              <option value="ID">ID</option><option value="INCOME_PROOF">Income Proof</option><option value="LEASE_AGREEMENT">Lease Agreement</option><option value="BACKGROUND_CHECK">Background Check</option><option value="OTHER">Other</option>
            </select>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Document URL (Google Drive, Dropbox, etc.) *" className={inputClass} />
            <input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="File name (optional)" className={inputClass} />
            <p className="text-xs" style={{ color: tokens.color.muted }}>Upload to a file sharing service and paste the share link.</p>
          </div>
          <div className="flex gap-2 mt-4"><Button onClick={upload} className="flex-1">Upload</Button><Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button></div>
        </Surface>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['ALL', 'ID', 'INCOME_PROOF', 'LEASE_AGREEMENT', 'BACKGROUND_CHECK', 'OTHER'].map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${filter === t ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-slate-400'}`}>{t.replace('_', ' ')}</button>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.muted }}>No documents yet.</p>}
      {filtered.map((d) => (
        <Surface key={d.id} className="flex items-center justify-between">
          <div><div className="font-semibold text-slate-100">{d.fileName || d.type}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{d.tenantEmail} · {d.type} · {new Date(d.createdAt).toLocaleDateString()}</div></div>
          <div className="flex gap-2">
            <a href={d.url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost">View</Button></a>
            <Button onClick={() => remove(d.id)} size="sm" variant="ghost">Delete</Button>
          </div>
        </Surface>
      ))}
    </div>
  );
}

// ─── AI Tools Tab ────────────────────────────────────────────────────────────

function AIToolsTab() {
  const [activeTool, setActiveTool] = useState<string>('insights');
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [issue, setIssue] = useState('');
  const [maintenanceAdvice, setMaintenanceAdvice] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [marketCity, setMarketCity] = useState('');
  const [marketState, setMarketState] = useState('');
  const [marketResult, setMarketResult] = useState<any>(null);
  const [leaseText, setLeaseText] = useState('');
  const [leaseAnalysis, setLeaseAnalysis] = useState<any>(null);
  const [valForm, setValForm] = useState({ address: '', city: '', state: '', bedrooms: '', bathrooms: '', sqft: '', propertyType: 'apartment' });
  const [valuation, setValuation] = useState<any>(null);

  const askAI = async () => {
    if (!question.trim()) return;
    setChatLoading(true);
    try { const res = await aiRealEstateService.aiChat(question, { context: 'property_manager' }); setChat(prev => [...prev, { q: question, a: res.data?.data?.reply || res.data?.reply || 'No response' }]); setQuestion(''); }
    catch (_e) { setChat(prev => [...prev, { q: question, a: 'AI temporarily unavailable.' }]); }
    finally { setChatLoading(false); }
  };

  const getMaintenanceAdvice = async () => {
    if (!issue.trim()) return;
    setAnalyzing(true);
    try { const res = await aiRealEstateService.maintenanceAdvice(issue, 'apartment', 'medium', 'MEDIUM'); setMaintenanceAdvice(res.data?.data?.advice || res.data?.advice || 'No advice available.'); }
    catch (_e) { setMaintenanceAdvice('Could not load advice.'); }
    finally { setAnalyzing(false); }
  };

  const getMarketInsights = async () => {
    if (!marketCity) return;
    try { const res = await aiRealEstateService.marketInsights(marketCity, marketState, 'apartment'); setMarketResult(res.data?.data || res.data); }
    catch (_e) { setMarketResult({ error: 'Could not load insights' }); }
  };

  const analyzeLease = async () => {
    if (!leaseText.trim()) return;
    try { const res = await aiRealEstateService.analyzeLease(leaseText); setLeaseAnalysis(res.data?.data || res.data); }
    catch (_e) { setLeaseAnalysis({ error: 'Could not analyze lease' }); }
  };

  const getPropertyValuation = async () => {
    try { const res = await aiRealEstateService.propertyValuation({ ...valForm, bedrooms: Number(valForm.bedrooms), bathrooms: Number(valForm.bathrooms), sqft: Number(valForm.sqft) }); setValuation(res.data?.data || res.data); }
    catch (_e) { setValuation({ error: 'Could not get valuation' }); }
  };

  const tools = [
    { id: 'insights', icon: '📊', label: 'Insights' },
    { id: 'chat', icon: '💬', label: 'Ask AI' },
    { id: 'maintenance', icon: '🛠️', label: 'Maintenance' },
    { id: 'market', icon: '🏙️', label: 'Market' },
    { id: 'lease', icon: '📄', label: 'Lease Analyzer' },
    { id: 'valuation', icon: '🏠', label: 'Valuation' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {tools.map((t) => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeTool === t.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTool === 'insights' && (
        <Surface>
          <h3 className="text-base font-bold text-slate-100 mb-3">📊 Portfolio Insights</h3>
          <p className="text-sm text-slate-400 mb-4">AI-powered insights based on your portfolio data.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-emerald-300">AI</div><div className="text-xs" style={{ color: tokens.color.muted }}>Payment Risk</div></div>
            <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-indigo-300">AI</div><div className="text-xs" style={{ color: tokens.color.muted }}>Renewal Risk</div></div>
            <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-xl font-bold text-amber-300">AI</div><div className="text-xs" style={{ color: tokens.color.muted }}>Market Score</div></div>
          </div>
        </Surface>
      )}

      {activeTool === 'chat' && (
        <Surface>
          <h3 className="text-base font-bold text-slate-100 mb-3">💬 Ask AI</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto mb-3">
            {chat.length === 0 && <p className="text-xs text-slate-400">Ask about leases, screening, rent, or maintenance.</p>}
            {chat.map((m, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xs font-semibold text-indigo-300">You: {m.q}</div>
                <div className="text-xs text-slate-300 bg-white/5 rounded-lg px-3 py-2">{m.a}</div>
              </div>
            ))}
            {chatLoading && <div className="text-xs text-slate-400">Thinking…</div>}
          </div>
          <div className="flex gap-2">
            <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="Ask about a property, tenant, or lease…" className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
            <Button onClick={askAI} disabled={chatLoading}>Send</Button>
          </div>
        </Surface>
      )}

      {activeTool === 'maintenance' && (
        <Surface>
          <h3 className="text-base font-bold text-slate-100 mb-3">🛠️ Maintenance Advisor</h3>
          <input value={issue} onChange={e => setIssue(e.target.value)} placeholder="Describe the issue, e.g. water leak in bathroom" className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400 mb-3" />
          <Button onClick={getMaintenanceAdvice} disabled={analyzing} className="w-full">{analyzing ? 'Analyzing…' : 'Get Maintenance Advice'}</Button>
          {maintenanceAdvice && <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 whitespace-pre-wrap">{maintenanceAdvice}</div>}
        </Surface>
      )}

      {activeTool === 'market' && (
        <Surface>
          <h3 className="text-base font-bold text-slate-100 mb-3">🏙️ Market Intelligence</h3>
          <div className="flex gap-2 mb-3">
            <input value={marketCity} onChange={e => setMarketCity(e.target.value)} placeholder="City *" className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
            <input value={marketState} onChange={e => setMarketState(e.target.value)} placeholder="State" className="w-24 rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
            <Button onClick={getMarketInsights}>Go</Button>
          </div>
          {marketResult && !marketResult.error && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-emerald-300">${marketResult.avgRent || 'N/A'}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Avg Rent</div></div>
              <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-indigo-300">{marketResult.occupancyRate || 'N/A'}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Occupancy</div></div>
              <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-amber-300">{marketResult.rentalYield || 'N/A'}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Yield</div></div>
              <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-slate-100">{marketResult.trend || 'N/A'}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Trend</div></div>
            </div>
          )}
          {marketResult?.error && <p className="text-sm text-red-300">{marketResult.error}</p>}
        </Surface>
      )}

      {activeTool === 'lease' && (
        <Surface>
          <h3 className="text-base font-bold text-slate-100 mb-3">📄 Lease Analyzer</h3>
          <textarea value={leaseText} onChange={e => setLeaseText(e.target.value)} placeholder="Paste your lease agreement text here..." className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400 h-32 mb-3" />
          <Button onClick={analyzeLease} className="w-full">Analyze Lease</Button>
          {leaseAnalysis && !leaseAnalysis.error && (
            <div className="mt-3 space-y-2">
              <div className="p-3 rounded-xl bg-white/5"><div className="text-sm font-semibold text-slate-100">Risk Score: <span className={leaseAnalysis.riskScore > 60 ? 'text-red-300' : leaseAnalysis.riskScore > 30 ? 'text-amber-300' : 'text-emerald-300'}>{leaseAnalysis.riskScore || 'N/A'}/100</span></div></div>
              {leaseAnalysis.redFlags?.length > 0 && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">{leaseAnalysis.redFlags.join(', ')}</div>}
            </div>
          )}
          {leaseAnalysis?.error && <p className="text-sm text-red-300">{leaseAnalysis.error}</p>}
        </Surface>
      )}

      {activeTool === 'valuation' && (
        <Surface>
          <h3 className="text-base font-bold text-slate-100 mb-3">🏠 Property Valuation</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input value={valForm.address} onChange={e => setValForm({ ...valForm, address: e.target.value })} placeholder="Address" className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
              <input value={valForm.city} onChange={e => setValForm({ ...valForm, city: e.target.value })} placeholder="City" className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
              <input value={valForm.state} onChange={e => setValForm({ ...valForm, state: e.target.value })} placeholder="State" className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
              <select value={valForm.propertyType} onChange={e => setValForm({ ...valForm, propertyType: e.target.value })} className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400">
                <option value="apartment">Apartment</option><option value="house">House</option><option value="condo">Condo</option><option value="townhouse">Townhouse</option>
              </select>
              <input value={valForm.bedrooms} onChange={e => setValForm({ ...valForm, bedrooms: e.target.value })} placeholder="Bedrooms" type="number" className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
              <input value={valForm.bathrooms} onChange={e => setValForm({ ...valForm, bathrooms: e.target.value })} placeholder="Bathrooms" type="number" className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
            </div>
            <input value={valForm.sqft} onChange={e => setValForm({ ...valForm, sqft: e.target.value })} placeholder="Square feet" type="number" className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400" />
            <Button onClick={getPropertyValuation} className="w-full">Get Valuation</Button>
          </div>
          {valuation && !valuation.error && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-emerald-300">${(valuation.estimatedRent || 0).toLocaleString()}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Est. Rent</div></div>
              <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-indigo-300">${(valuation.propertyValue || 0).toLocaleString()}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Est. Value</div></div>
              <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-amber-300">{valuation.grossYield || 0}%</div><div className="text-xs" style={{ color: tokens.color.muted }}>Gross Yield</div></div>
              <div className="p-3 rounded-xl bg-white/5 text-center"><div className="text-lg font-bold text-slate-100">{valuation.confidence || 'N/A'}</div><div className="text-xs" style={{ color: tokens.color.muted }}>Confidence</div></div>
            </div>
          )}
          {valuation?.error && <p className="text-sm text-red-300">{valuation.error}</p>}
        </Surface>
      )}
    </div>
  );
}

// ─── Webhooks Tab ────────────────────────────────────────────────────────────

function WebhooksTab({ inputClass, setErr }: any) {
  const [wh, setWh] = useState<Webhook[]>([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('property.created,tenant.created,lease.created');

  const loadWh = async () => { try { const r = await propertyManagerService.webhooks(); setWh(r.data?.data || r.data || []); } catch (_e) { /* empty */ } };
  useEffect(() => { loadWh(); }, []);

  const add = async () => {
    if (!url) return;
    try { await propertyManagerService.addWebhook({ url, events: events.split(',').map(e => e.trim()) }); setUrl(''); loadWh(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not add'); }
  };

  const remove = async (id: string) => { try { await propertyManagerService.deleteWebhook(id); setWh(wh.filter((w) => w.id !== id)); } catch (_e) { /* empty */ } };

  return (
    <div className="space-y-3">
      <Surface>
        <h3 className="text-lg font-bold text-slate-100 mb-4">🔗 Webhooks</h3>
        <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Connect your own CRM/external system. Events are signed with HMAC-SHA256.</p>
        <div className="space-y-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-crm.com/webhook" className={inputClass} />
          <input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="Events (comma-separated)" className={inputClass} />
          <Button onClick={add} className="w-full">Add Webhook</Button>
        </div>
      </Surface>
      {wh.length === 0 && <p style={{ color: tokens.color.muted }}>No webhooks yet.</p>}
      {wh.map((w) => (
        <Surface key={w.id} className="flex items-center justify-between">
          <div><div className="font-semibold text-slate-100 text-sm">{w.url}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{w.events?.join(', ')} · {w.lastStatus || 'never sent'}</div></div>
          <Button onClick={() => remove(w.id)} variant="ghost" size="sm">Delete</Button>
        </Surface>
      ))}
    </div>
  );
}

// ─── Activity Tab ────────────────────────────────────────────────────────────

function ActivityTab() {
  const [acts, setActs] = useState<Activity[]>([]);
  useEffect(() => { propertyManagerService.activity().then((r) => setActs(r.data?.data || r.data || [])).catch(() => {}); }, []);
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-slate-100 mb-4">📜 Activity Log</h3>
      {acts.length === 0 && <p style={{ color: tokens.color.muted }}>No activity yet.</p>}
      {acts.map((a) => (
        <Surface key={a.id}>
          <div className="flex items-center justify-between">
            <div><div className="font-semibold text-slate-100 text-sm">{a.description}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{a.action} · {a.entityType}</div></div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(a.createdAt).toLocaleString()}</div>
          </div>
        </Surface>
      ))}
    </div>
  );
}

export default CRMPage;
