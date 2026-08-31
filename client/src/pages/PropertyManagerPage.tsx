import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

type Profile = { id: string; companyName?: string | null; slug?: string | null; domain?: string | null; brandColor?: string | null; logoUrl?: string | null; tagline?: string | null; active: boolean; };
type Property = { id: string; title: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; bedrooms: number; bathrooms: number; rentAmount?: number | null; rentPeriod: string; status: string; };
type Tenant = { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; status: string; riskBand?: string | null; depositHeld: number; totalStays: number; totalDisputes: number; lastStayAt?: string | null; notes?: string | null; };
type Screening = { id: string; tenantEmail: string; tenantName?: string | null; band: string; depositAdjPct: number; screenedAt: string; source: string; };
type Appointment = { id: string; propertyId?: string | null; tenantEmail: string; tenantName?: string | null; startsAt: string; endsAt?: string | null; status: string; notes?: string | null; };
type Lease = { id: string; propertyId?: string | null; tenantEmail: string; tenantName?: string | null; startDate: string; endDate: string; rentAmount: number; rentPeriod: string; depositAmount: number; status: string; notes?: string | null; };
type Maintenance = { id: string; propertyId?: string | null; tenantEmail?: string | null; title: string; description?: string | null; priority: string; status: string; resolvedAt?: string | null; notes?: string | null; };
type Dashboard = { profile: Profile; properties: Property[]; tenants: Tenant[]; screenings: Screening[]; appointments: Appointment[]; leases: Lease[]; maintenance: Maintenance[]; stats: any; };

const riskTone: Record<string, 'success' | 'warning' | 'danger'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };
const statusTone: Record<string, 'info' | 'success' | 'warning'> = { VACANT: 'info', OCCUPIED: 'success', MAINTENANCE: 'warning' };
const apptTone: Record<string, 'info' | 'success' | 'warning' | 'danger'> = { PENDING: 'info', CONFIRMED: 'success', COMPLETED: 'success', CANCELLED: 'warning', NO_SHOW: 'danger' };
const priorityTone: Record<string, 'info' | 'warning' | 'danger'> = { LOW: 'info', MEDIUM: 'warning', HIGH: 'danger', URGENT: 'danger' };
const screeningSourceIcon: Record<string, string> = { COURTLISTENER: '🏛️', BACKGROUND_CHECK: '🇵🇰', MANUAL: '✏️' };
const screeningSourceLabel: Record<string, string> = { COURTLISTENER: 'US CourtListener', BACKGROUND_CHECK: 'PK BackgroundCheck', MANUAL: 'Manual' };

export const PropertyManagerPage: React.FC = () => {
  const [enrolling, setEnrolling] = useState(false);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'overview' | 'properties' | 'tenants' | 'screen' | 'appointments' | 'leases' | 'maintenance' | 'portal'>('overview');
  const [propForm, setPropForm] = useState({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' });
  const [tenantForm, setTenantForm] = useState({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' });
  const [screenForm, setScreenForm] = useState({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'COURTLISTENER', state: '' });
  const [apptForm, setApptForm] = useState({ tenantEmail: '', tenantName: '', startsAt: '', endsAt: '', notes: '' });
  const [leaseForm, setLeaseForm] = useState({ tenantEmail: '', tenantName: '', startDate: '', endDate: '', rentAmount: '', rentPeriod: 'MONTH', depositAmount: '' });
  const [maintForm, setMaintForm] = useState({ title: '', description: '', priority: 'MEDIUM', tenantEmail: '' });

  const load = () => {
    propertyManagerService.dashboard().then((r) => setDash(r.data?.data)).catch((e) => { if (e?.response?.status === 404) setDash(null); else setErr(e?.response?.data?.error || 'Could not load dashboard'); });
  };
  useEffect(load, []);

  const enroll = async () => { setEnrolling(true); setErr(''); try { await propertyManagerService.enroll({ companyName: 'My Properties' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not enroll'); } finally { setEnrolling(false); } };
  const addProperty = async () => { if (!propForm.title) return; try { await propertyManagerService.addProperty({ ...propForm, rentAmount: propForm.rentAmount ? Number(propForm.rentAmount) : undefined }); setPropForm({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not add property'); } };
  const addTenant = async () => { if (!tenantForm.email) return; try { await propertyManagerService.addTenant(tenantForm); setTenantForm({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not add tenant'); } };
  const screenTenant = async () => { if (!screenForm.tenantEmail) return; try { await propertyManagerService.screenTenant(screenForm); setScreenForm({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'COURTLISTENER', state: '' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not screen tenant'); } };
  const addAppointment = async () => { if (!apptForm.tenantEmail || !apptForm.startsAt) return; try { await propertyManagerService.addAppointment(apptForm); setApptForm({ tenantEmail: '', tenantName: '', startsAt: '', endsAt: '', notes: '' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create appointment'); } };
  const addLease = async () => { if (!leaseForm.tenantEmail || !leaseForm.startDate || !leaseForm.endDate || !leaseForm.rentAmount) return; try { await propertyManagerService.addLease({ ...leaseForm, rentAmount: Number(leaseForm.rentAmount), depositAmount: leaseForm.depositAmount ? Number(leaseForm.depositAmount) : 0 }); setLeaseForm({ tenantEmail: '', tenantName: '', startDate: '', endDate: '', rentAmount: '', rentPeriod: 'MONTH', depositAmount: '' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create lease'); } };
  const addMaintenance = async () => { if (!maintForm.title) return; try { await propertyManagerService.addMaintenance(maintForm); setMaintForm({ title: '', description: '', priority: 'MEDIUM', tenantEmail: '' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create maintenance request'); } };

  const inputClass = "w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-4 py-3 outline-none font-body text-sm";
  const selectClass = inputClass;

  if (dash === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: tokens.color.background }}>
        <Surface className="text-center max-w-lg p-10">
          <div className="text-6xl mb-4">🏘️</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 font-headline">Property Manager CRM</h1>
          <p className="mt-3 text-slate-400 leading-relaxed">Screen tenants with real court checks, schedule showings, track leases & maintenance, and offer tenants a branded portal.</p>
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
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-headline">{dash!.profile.companyName || 'My Properties'}</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Property Manager CRM · Pabandi</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['overview', 'properties', 'tenants', 'screen', 'appointments', 'leases', 'maintenance', 'portal'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger, border: `1px solid ${tokens.color.danger}30` }}>{err}</div>}

        {tab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{s.totalProperties}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Properties</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-emerald-300">{s.occupied}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Occupied</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-indigo-300">{s.vacant}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Vacant</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">${s.totalDepositHeld.toLocaleString()}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Deposits</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{s.totalTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Tenants</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold" style={{ color: s.highRiskTenants > 0 ? tokens.color.danger : tokens.color.text }}>{s.highRiskTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>High-risk</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{s.upcomingAppointments}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Showings</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{s.activeLeases}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Active leases</div></Surface>
          </div>
        )}

        {tab === 'properties' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">Add a property</h3>
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
                  <div><div className="font-semibold text-slate-100">{p.title}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{p.address}{p.city ? `, ${p.city}` : ''}{p.state ? ` ${p.state}` : ''} · {p.bedrooms}bd/{p.bathrooms}ba</div></div>
                  <div className="text-right">
                    {p.rentAmount && <div className="font-bold text-slate-100">${p.rentAmount}/{p.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</div>}
                    <Badge tone={statusTone[p.status] || 'info'}>{p.status}</Badge>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {tab === 'tenants' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">Add / update a tenant</h3>
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
                  <div><div className="font-semibold text-slate-100">{t.firstName || ''} {t.lastName || ''} <span className="font-normal text-xs" style={{ color: tokens.color.muted }}>{t.email}</span></div><div className="text-xs" style={{ color: tokens.color.muted }}>{t.totalStays} stays · {t.totalDisputes} disputes</div></div>
                  <div className="text-right">
                    {t.riskBand && <Badge tone={riskTone[t.riskBand] || 'info'}>{t.riskBand}</Badge>}
                    <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{t.status}</div>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {tab === 'screen' && (
          <div className="space-y-4">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-2">🔍 Screen a tenant</h3>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Run a real US court (CourtListener) eviction check. Risk band auto-calculates the deposit surcharge.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={screenForm.tenantEmail} onChange={(e) => setScreenForm({ ...screenForm, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className={inputClass} />
                <input value={screenForm.tenantName} onChange={(e) => setScreenForm({ ...screenForm, tenantName: e.target.value })} placeholder="Tenant name" className={inputClass} />
                <input value={screenForm.state} onChange={(e) => setScreenForm({ ...screenForm, state: e.target.value })} placeholder="State (e.g. IL)" className={inputClass} />
                <select value={screenForm.source} onChange={(e) => setScreenForm({ ...screenForm, source: e.target.value })} className={selectClass}>
                  <option value="COURTLISTENER">🏛️ US CourtListener (real)</option>
                  <option value="BACKGROUND_CHECK">🇵🇰 PK BackgroundCheck</option>
                  <option value="MANUAL">✏️ Manual</option>
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
                    <div className="text-xs" style={{ color: tokens.color.muted }}>
                      {screeningSourceIcon[sc.source] || '✏️'} {screeningSourceLabel[sc.source] || sc.source} · {new Date(sc.screenedAt).toLocaleDateString()}
                    </div>
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

        {tab === 'appointments' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">Schedule a showing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={apptForm.tenantEmail} onChange={(e) => setApptForm({ ...apptForm, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className={inputClass} />
                <input value={apptForm.tenantName} onChange={(e) => setApptForm({ ...apptForm, tenantName: e.target.value })} placeholder="Tenant name" className={inputClass} />
                <input value={apptForm.startsAt} onChange={(e) => setApptForm({ ...apptForm, startsAt: e.target.value })} type="datetime-local" className={inputClass} />
                <input value={apptForm.endsAt} onChange={(e) => setApptForm({ ...apptForm, endsAt: e.target.value })} type="datetime-local" className={inputClass} />
              </div>
              <Button onClick={addAppointment} className="mt-4">Schedule showing</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.appointments.length === 0 && <p style={{ color: tokens.color.muted }}>No appointments yet.</p>}
              {dash!.appointments.map((a) => (
                <Surface key={a.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{a.tenantName || a.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(a.startsAt).toLocaleString()}</div></div>
                  <Badge tone={apptTone[a.status] || 'info'}>{a.status}</Badge>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {tab === 'leases' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">Add a lease</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={leaseForm.tenantEmail} onChange={(e) => setLeaseForm({ ...leaseForm, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" className={inputClass} />
                <input value={leaseForm.tenantName} onChange={(e) => setLeaseForm({ ...leaseForm, tenantName: e.target.value })} placeholder="Tenant name" className={inputClass} />
                <input value={leaseForm.startDate} onChange={(e) => setLeaseForm({ ...leaseForm, startDate: e.target.value })} type="date" className={inputClass} />
                <input value={leaseForm.endDate} onChange={(e) => setLeaseForm({ ...leaseForm, endDate: e.target.value })} type="date" className={inputClass} />
                <input value={leaseForm.rentAmount} onChange={(e) => setLeaseForm({ ...leaseForm, rentAmount: e.target.value })} placeholder="Rent/mo *" type="number" className={inputClass} />
                <input value={leaseForm.depositAmount} onChange={(e) => setLeaseForm({ ...leaseForm, depositAmount: e.target.value })} placeholder="Deposit" type="number" className={inputClass} />
              </div>
              <Button onClick={addLease} className="mt-4">Add lease</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.leases.length === 0 && <p style={{ color: tokens.color.muted }}>No leases yet.</p>}
              {dash!.leases.map((l) => (
                <Surface key={l.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{l.tenantName || l.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()} · ${l.rentAmount}/{l.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</div></div>
                  <Badge tone={l.status === 'ACTIVE' ? 'success' : 'info'}>{l.status}</Badge>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">Report maintenance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={maintForm.title} onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })} placeholder="Title *" className={inputClass} />
                <input value={maintForm.tenantEmail} onChange={(e) => setMaintForm({ ...maintForm, tenantEmail: e.target.value })} placeholder="Tenant email" className={inputClass} />
                <select value={maintForm.priority} onChange={(e) => setMaintForm({ ...maintForm, priority: e.target.value })} className={selectClass}>
                  <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option>
                </select>
                <input value={maintForm.description} onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })} placeholder="Description" className={inputClass} />
              </div>
              <Button onClick={addMaintenance} className="mt-4">Submit request</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.maintenance.length === 0 && <p style={{ color: tokens.color.muted }}>No maintenance requests yet.</p>}
              {dash!.maintenance.map((m) => (
                <Surface key={m.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{m.title}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{m.description}{m.tenantEmail ? ` · ${m.tenantEmail}` : ''}</div></div>
                  <div className="text-right">
                    <Badge tone={priorityTone[m.priority] || 'info'}>{m.priority}</Badge>
                    <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{m.status}</div>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {tab === 'portal' && (
          <Surface>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Your white-label tenant portal</h3>
            <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Tenants visit this link to see your available listings.</p>
            <div className="flex gap-2"><input readOnly value={portalUrl} className={inputClass} /><Button onClick={() => navigator.clipboard?.writeText(portalUrl)} variant="ghost">Copy</Button></div>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default PropertyManagerPage;
