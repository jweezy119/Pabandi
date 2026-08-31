import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

type Profile = { id: string; companyName?: string | null; slug?: string | null; domain?: string | null; brandColor?: string | null; logoUrl?: string | null; tagline?: string | null; active: boolean; };
type Property = { id: string; title: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; bedrooms: number; bathrooms: number; rentAmount?: number | null; rentPeriod: string; status: string; };
type Tenant = { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; status: string; riskBand?: string | null; depositHeld: number; totalStays: number; totalDisputes: number; lastStayAt?: string | null; notes?: string | null; };
type Screening = { id: string; tenantEmail: string; tenantName?: string | null; band: string; depositAdjPct: number; screenedAt: string; source: string; };
type Dashboard = { profile: Profile; properties: Property[]; tenants: Tenant[]; screenings: Screening[]; stats: { totalProperties: number; occupied: number; vacant: number; totalTenants: number; activeTenants: number; totalDepositHeld: number; highRiskTenants: number; totalDisputes: number; }; };

const riskTone: Record<string, 'success' | 'warning' | 'danger'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };
const statusTone: Record<string, 'info' | 'success' | 'warning'> = { VACANT: 'info', OCCUPIED: 'success', MAINTENANCE: 'warning' };

export const PropertyManagerPage: React.FC = () => {
  const [enrolling, setEnrolling] = useState(false);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'overview' | 'properties' | 'tenants' | 'screen' | 'portal'>('overview');
  const [propForm, setPropForm] = useState({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' });
  const [tenantForm, setTenantForm] = useState({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' });
  const [screenForm, setScreenForm] = useState({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'MANUAL' });

  const load = () => {
    propertyManagerService.dashboard()
      .then((r) => setDash(r.data?.data))
      .catch((e) => {
        if (e?.response?.status === 404) setDash(null);
        else setErr(e?.response?.data?.error || 'Could not load dashboard');
      });
  };
  useEffect(load, []);

  const enroll = async () => {
    setEnrolling(true); setErr('');
    try { await propertyManagerService.enroll({ companyName: 'My Properties' }); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not enroll'); }
    finally { setEnrolling(false); }
  };

  const addProperty = async () => {
    if (!propForm.title) return;
    try {
      await propertyManagerService.addProperty({ ...propForm, rentAmount: propForm.rentAmount ? Number(propForm.rentAmount) : undefined });
      setPropForm({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' });
      load();
    } catch (e: any) { setErr(e?.response?.data?.error || 'Could not add property'); }
  };

  const addTenant = async () => {
    if (!tenantForm.email) return;
    try { await propertyManagerService.addTenant(tenantForm); setTenantForm({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' }); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not add tenant'); }
  };

  const screenTenant = async () => {
    if (!screenForm.tenantEmail) return;
    try { await propertyManagerService.screenTenant(screenForm); setScreenForm({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'MANUAL' }); load(); }
    catch (e: any) { setErr(e?.response?.data?.error || 'Could not screen tenant'); }
  };

  const inputClass = "w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-4 py-3 outline-none font-body text-sm";
  const selectClass = inputClass;

  if (dash === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: tokens.color.background }}>
        <Surface className="text-center max-w-lg p-10">
          <div className="text-6xl mb-4">🏘️</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 font-headline">Property Manager CRM</h1>
          <p className="mt-3 text-slate-400 leading-relaxed">Screen tenants with court & KYC checks, track deposits, manage your portfolio, and offer tenants a branded portal.</p>
          <Button onClick={enroll} disabled={enrolling} className="mt-6 w-full">{enrolling ? 'Setting up…' : 'Activate my free CRM'}</Button>
          {err && <p className="mt-3 text-sm" style={{ color: tokens.color.danger }}>{err}</p>}
        </Surface>
      </div>
    );
  }

  const s = dash!.stats;
  const portalUrl = `${window.location.origin}/p/${dash!.profile.slug || ''}`;

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-headline">{dash!.profile.companyName || 'My Properties'}</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Property Manager CRM · Pabandi</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['overview', 'properties', 'tenants', 'screen', 'portal'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger, border: `1px solid ${tokens.color.danger}30` }}>{err}</div>}

        {/* Overview */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{s.totalProperties}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Properties</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-emerald-300">{s.occupied}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Occupied</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-indigo-300">{s.vacant}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Vacant</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">${s.totalDepositHeld.toLocaleString()}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Deposits held</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{s.totalTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Tenants</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{s.activeTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Active</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold" style={{ color: s.highRiskTenants > 0 ? tokens.color.danger : tokens.color.text }}>{s.highRiskTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>High-risk</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold" style={{ color: s.totalDisputes > 0 ? tokens.color.danger : tokens.color.text }}>{s.totalDisputes}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Disputes</div></Surface>
          </div>
        )}

        {/* Properties */}
        {tab === 'properties' && (
          <div className="space-y-4">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Add a property</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={propForm.title} onChange={(e) => setPropForm({ ...propForm, title: e.target.value })} placeholder="Title *" className={inputClass} />
                <input value={propForm.address} onChange={(e) => setPropForm({ ...propForm, address: e.target.value })} placeholder="Address" className={inputClass} />
                <input value={propForm.city} onChange={(e) => setPropForm({ ...propForm, city: e.target.value })} placeholder="City" className={inputClass} />
                <input value={propForm.state} onChange={(e) => setPropForm({ ...propForm, state: e.target.value })} placeholder="State" className={inputClass} />
                <input value={propForm.zip} onChange={(e) => setPropForm({ ...propForm, zip: e.target.value })} placeholder="ZIP" className={inputClass} />
                <input value={propForm.rentAmount} onChange={(e) => setPropForm({ ...propForm, rentAmount: e.target.value })} placeholder="Rent (USD/mo)" type="number" className={inputClass} />
              </div>
              <Button onClick={addProperty} className="mt-4">Add property</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.properties.length === 0 && <p style={{ color: tokens.color.muted }}>No properties yet.</p>}
              {dash!.properties.map((p) => (
                <Surface key={p.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-100">{p.title}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{p.address}{p.city ? `, ${p.city}` : ''}{p.state ? ` ${p.state}` : ''} · {p.bedrooms}bd/{p.bathrooms}ba</div>
                  </div>
                  <div className="text-right">
                    {p.rentAmount && <div className="font-bold text-slate-100">${p.rentAmount}/{p.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</div>}
                    <Badge tone={statusTone[p.status] || 'info'}>{p.status}</Badge>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Tenants */}
        {tab === 'tenants' && (
          <div className="space-y-4">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Add / update a tenant</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="Email *" type="email" className={inputClass} />
                <input value={tenantForm.firstName} onChange={(e) => setTenantForm({ ...tenantForm, firstName: e.target.value })} placeholder="First name" className={inputClass} />
                <input value={tenantForm.lastName} onChange={(e) => setTenantForm({ ...tenantForm, lastName: e.target.value })} placeholder="Last name" className={inputClass} />
                <input value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} placeholder="Phone" className={inputClass} />
              </div>
              <Button onClick={addTenant} className="mt-4">Save tenant</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.tenants.length === 0 && <p style={{ color: tokens.color.muted }}>No tenants yet.</p>}
              {dash!.tenants.map((t) => (
                <Surface key={t.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-100">{t.firstName || ''} {t.lastName || ''} <span className="font-normal text-xs" style={{ color: tokens.color.muted }}>{t.email}</span></div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{t.totalStays} stays · {t.totalDisputes} disputes</div>
                  </div>
                  <div className="text-right">
                    {t.riskBand && <Badge tone={riskTone[t.riskBand] || 'info'}>{t.riskBand}</Badge>}
                    <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{t.status}</div>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Screening */}
        {tab === 'screen' && (
          <div className="space-y-4">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-2">Screen a tenant</h3>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Run a US court (CourtListener) or PK background check. Risk band sets the recommended deposit surcharge.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={screenForm.tenantEmail} onChange={(e) => setScreenForm({ ...screenForm, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className={inputClass} />
                <input value={screenForm.tenantName} onChange={(e) => setScreenForm({ ...screenForm, tenantName: e.target.value })} placeholder="Tenant name" className={inputClass} />
                <select value={screenForm.band} onChange={(e) => setScreenForm({ ...screenForm, band: e.target.value })} className={selectClass}>
                  <option value="LOW">LOW risk</option><option value="MEDIUM">MEDIUM risk</option><option value="HIGH">HIGH risk</option>
                </select>
                <select value={screenForm.source} onChange={(e) => setScreenForm({ ...screenForm, source: e.target.value })} className={selectClass}>
                  <option value="MANUAL">Manual</option><option value="COURTLISTENER">US CourtListener</option><option value="BACKGROUND_CHECK">PK BackgroundCheck</option>
                </select>
              </div>
              <Button onClick={screenTenant} className="mt-4">Run screening</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.screenings.length === 0 && <p style={{ color: tokens.color.muted }}>No screenings yet.</p>}
              {dash!.screenings.map((sc) => (
                <Surface key={sc.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-100">{sc.tenantName || sc.tenantEmail}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{sc.source} · {new Date(sc.screenedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <Badge tone={riskTone[sc.band] || 'info'}>{sc.band}</Badge>
                    {sc.depositAdjPct > 0 && <div className="text-xs mt-1 font-semibold" style={{ color: tokens.color.danger }}>+{sc.depositAdjPct}% deposit</div>}
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* White-label portal */}
        {tab === 'portal' && (
          <Surface>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Your white-label tenant portal</h3>
            <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Tenants visit this link to see your available listings and book through your brand.</p>
            <div className="flex gap-2">
              <input readOnly value={portalUrl} className={inputClass} />
              <Button onClick={() => navigator.clipboard?.writeText(portalUrl)} variant="ghost">Copy</Button>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: tokens.color.muted }}>Company name</div>
                <div className="text-slate-100">{dash!.profile.companyName || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: tokens.color.muted }}>Brand color</div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{ background: dash!.profile.brandColor || tokens.color.primary, border: '1px solid rgba(255,255,255,0.2)' }} />
                  <span className="text-slate-100">{dash!.profile.brandColor || tokens.color.primary}</span>
                </div>
              </div>
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default PropertyManagerPage;
