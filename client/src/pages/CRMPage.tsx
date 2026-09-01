import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';
import { CRM_CONFIG, BUSINESS_TYPES, BusinessType } from '../config/crmConfig';

type Profile = { id: string; companyName?: string | null; businessType: BusinessType; slug?: string | null; domain?: string | null; brandColor?: string | null; logoUrl?: string | null; tagline?: string | null; active: boolean; };
type Property = { id: string; title: string; address?: string | null; city?: string | null; state?: string | null; bedrooms: number; bathrooms: number; rentAmount?: number | null; rentPeriod: string; status: string; };
type Tenant = { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; status: string; riskBand?: string | null; depositHeld: number; totalStays: number; totalDisputes: number; lastStayAt?: string | null; notes?: string | null; };
type Screening = { id: string; tenantEmail: string; tenantName?: string | null; band: string; depositAdjPct: number; screenedAt: string; source: string; };
type Appointment = { id: string; propertyId?: string | null; tenantEmail: string; tenantName?: string | null; startsAt: string; endsAt?: string | null; status: string; notes?: string | null; };
type Lease = { id: string; propertyId?: string | null; tenantEmail: string; tenantName?: string | null; startDate: string; endDate: string; rentAmount: number; rentPeriod: string; depositAmount: number; status: string; notes?: string | null; };
type Maintenance = { id: string; propertyId?: string | null; tenantEmail?: string | null; title: string; description?: string | null; priority: string; status: string; resolvedAt?: string | null; notes?: string | null; };
type Application = { id: string; email: string; firstName?: string | null; lastName?: string | null; status: string; screeningBand?: string | null; depositAdjPct: number; decisionNotes?: string | null; decidedAt?: string | null; createdAt: string; message?: string | null; };
type Dashboard = { profile: Profile; properties: Property[]; tenants: Tenant[]; screenings: Screening[]; appointments: Appointment[]; leases: Lease[]; maintenance: Maintenance[]; applications: Application[]; stats: any; };

const riskTone: Record<string, 'success' | 'warning' | 'danger'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };

export const CRMPage: React.FC = () => {
  const [enrolling, setEnrolling] = useState(false);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<string>('overview');
  const [propForm, setPropForm] = useState({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' });
  const [tenantForm, setTenantForm] = useState({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' });
  const [screenForm, setScreenForm] = useState({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'COURTLISTENER', state: '' });
  const [apptForm, setApptForm] = useState({ tenantEmail: '', tenantName: '', startsAt: '', endsAt: '', notes: '' });
  const [leaseForm, setLeaseForm] = useState({ tenantEmail: '', tenantName: '', startDate: '', endDate: '', rentAmount: '', rentPeriod: 'MONTH', depositAmount: '' });
  const [maintForm, setMaintForm] = useState({ title: '', description: '', priority: 'MEDIUM', tenantEmail: '' });
  const [bizType, setBizType] = useState<BusinessType>('GENERAL');

  const config = dash?.profile ? CRM_CONFIG[dash.profile.businessType] || CRM_CONFIG.GENERAL : CRM_CONFIG.GENERAL;

  const load = () => {
    propertyManagerService.dashboard().then((r) => setDash(r.data?.data)).catch((e) => { if (e?.response?.status === 404) setDash(null); else setErr(e?.response?.data?.error || 'Could not load dashboard'); });
  };
  useEffect(load, []);

  const enroll = async () => { setEnrolling(true); setErr(''); try { await propertyManagerService.enroll({ companyName: 'My Business', businessType: bizType }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not enroll'); } finally { setEnrolling(false); } };
  const addProperty = async () => { if (!propForm.title) return; try { await propertyManagerService.addProperty({ ...propForm, rentAmount: propForm.rentAmount ? Number(propForm.rentAmount) : undefined }); setPropForm({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not add'); } };
  const addTenant = async () => { if (!tenantForm.email) return; try { await propertyManagerService.addTenant(tenantForm); setTenantForm({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not add'); } };
  const screenTenant = async () => { if (!screenForm.tenantEmail) return; try { await propertyManagerService.screenTenant(screenForm); setScreenForm({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'COURTLISTENER', state: '' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not screen'); } };
  const addAppointment = async () => { if (!apptForm.tenantEmail || !apptForm.startsAt) return; try { await propertyManagerService.addAppointment(apptForm); setApptForm({ tenantEmail: '', tenantName: '', startsAt: '', endsAt: '', notes: '' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); } };
  const addLease = async () => { if (!leaseForm.tenantEmail || !leaseForm.startDate || !leaseForm.endDate || !leaseForm.rentAmount) return; try { await propertyManagerService.addLease({ ...leaseForm, rentAmount: Number(leaseForm.rentAmount), depositAmount: leaseForm.depositAmount ? Number(leaseForm.depositAmount) : 0 }); setLeaseForm({ tenantEmail: '', tenantName: '', startDate: '', endDate: '', rentAmount: '', rentPeriod: 'MONTH', depositAmount: '' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); } };
  const addMaintenance = async () => { if (!maintForm.title) return; try { await propertyManagerService.addMaintenance(maintForm); setMaintForm({ title: '', description: '', priority: 'MEDIUM', tenantEmail: '' }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); } };

  const inputClass = "w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-4 py-3 outline-none font-body text-sm";
  const selectClass = inputClass;

  if (dash === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: tokens.color.background }}>
        <Surface className="text-center max-w-lg p-10">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 font-headline">Universal CRM</h1>
          <p className="mt-3 text-slate-400 leading-relaxed">One CRM for any business — property management, sales, services, freelance, or general.</p>
          <div className="mt-6 text-left">
            <label className="text-sm font-semibold text-slate-300 mb-2 block">What kind of business?</label>
            <div className="grid gap-2">
              {BUSINESS_TYPES.map((bt) => (
                <button key={bt.value} onClick={() => setBizType(bt.value)}
                  className={`text-left p-3 rounded-lg border transition-all ${bizType === bt.value ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                  <div className="font-semibold text-slate-100">{bt.label}</div>
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

  const s = dash!.stats;
  const portalUrl = `${window.location.origin}/p/${dash!.profile.slug || ''}`;

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-headline">{dash!.profile.companyName || 'My Business'}</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>{config.label} · Pabandi CRM</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {config.tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
                {config.entities[t]?.icon || (t === 'overview' ? '📊' : t === 'portal' ? '🎨' : t === 'webhooks' ? '🔗' : t === 'activity' ? '📜' : '📋')} {config.entities[t]?.label || t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger, border: `1px solid ${tokens.color.danger}30` }}>{err}</div>}

        {/* Overview */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Surface className="text-center" onClick={() => setTab('properties')}><div className="text-2xl font-bold text-slate-100">{s.totalProperties}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{config.entities.properties.label}</div></Surface>
            <Surface className="text-center" onClick={() => setTab('tenants')}><div className="text-2xl font-bold text-emerald-300">{s.occupied}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Active</div></Surface>
            <Surface className="text-center" onClick={() => setTab('tenants')}><div className="text-2xl font-bold text-indigo-300">{s.vacant}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Available</div></Surface>
            <Surface className="text-center" onClick={() => setTab('tenants')}><div className="text-2xl font-bold text-slate-100">{s.totalTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{config.entities.tenants.label}</div></Surface>
            <Surface className="text-center" onClick={() => setTab('screen')}><div className="text-2xl font-bold" style={{ color: s.highRiskTenants > 0 ? tokens.color.danger : tokens.color.text }}>{s.highRiskTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>High-risk</div></Surface>
            <Surface className="text-center" onClick={() => setTab('appointments')}><div className="text-2xl font-bold text-slate-100">{s.upcomingAppointments}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{config.entities.appointments.label}</div></Surface>
            <Surface className="text-center" onClick={() => setTab('leases')}><div className="text-2xl font-bold text-slate-100">{s.activeLeases}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{config.entities.leases.label}</div></Surface>
            <Surface className="text-center" onClick={() => setTab('maintenance')}><div className="text-2xl font-bold text-slate-100">{s.openMaintenance || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{config.entities.maintenance.label}</div></Surface>
          </div>
        )}

        {/* Properties / Products / Services / Gigs */}
        {tab === 'properties' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">{config.entities.properties.icon} Add {config.entities.properties.singular}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={propForm.title} onChange={(e) => setPropForm({ ...propForm, title: e.target.value })} placeholder={`${config.entities.properties.singular} name *`} className={inputClass} />
                <input value={propForm.address} onChange={(e) => setPropForm({ ...propForm, address: e.target.value })} placeholder="Address / Location" className={inputClass} />
                <input value={propForm.city} onChange={(e) => setPropForm({ ...propForm, city: e.target.value })} placeholder="City" className={inputClass} />
                <input value={propForm.state} onChange={(e) => setPropForm({ ...propForm, state: e.target.value })} placeholder="State" className={inputClass} />
                <input value={propForm.zip} onChange={(e) => setPropForm({ ...propForm, zip: e.target.value })} placeholder="ZIP / Postal" className={inputClass} />
                <input value={propForm.rentAmount} onChange={(e) => setPropForm({ ...propForm, rentAmount: e.target.value })} placeholder="Price / Rate" type="number" className={inputClass} />
              </div>
              <Button onClick={addProperty} className="mt-4">Add {config.entities.properties.singular}</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.properties.length === 0 && <p style={{ color: tokens.color.muted }}>No {config.entities.properties.label.toLowerCase()} yet.</p>}
              {dash!.properties.map((p) => (
                <Surface key={p.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{p.title}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{p.address}{p.city ? `, ${p.city}` : ''}</div></div>
                  <div className="text-right">
                    {p.rentAmount && <div className="font-bold text-slate-100">${p.rentAmount}</div>}
                    <Badge tone={p.status === 'VACANT' ? 'info' : p.status === 'OCCUPIED' ? 'success' : 'warning'}>{p.status}</Badge>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Tenants / Clients / Customers */}
        {tab === 'tenants' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">{config.entities.tenants.icon} Add {config.entities.tenants.singular}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="Email *" type="email" className={inputClass} />
                <input value={tenantForm.firstName} onChange={(e) => setTenantForm({ ...tenantForm, firstName: e.target.value })} placeholder="First name" className={inputClass} />
                <input value={tenantForm.lastName} onChange={(e) => setTenantForm({ ...tenantForm, lastName: e.target.value })} placeholder="Last name" className={inputClass} />
                <input value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} placeholder="Phone" className={inputClass} />
              </div>
              <Button onClick={addTenant} className="mt-4">Save {config.entities.tenants.singular}</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.tenants.length === 0 && <p style={{ color: tokens.color.muted }}>No {config.entities.tenants.label.toLowerCase()} yet.</p>}
              {dash!.tenants.map((t) => (
                <Surface key={t.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{t.firstName || ''} {t.lastName || ''} <span className="font-normal text-xs" style={{ color: tokens.color.muted }}>{t.email}</span></div></div>
                  <div className="text-right">
                    {t.riskBand && <Badge tone={riskTone[t.riskBand] || 'info'}>{t.riskBand}</Badge>}
                    <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{t.status}</div>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Screening / Vetting / Checks */}
        {tab === 'screen' && (
          <div className="space-y-4">
            <Surface>
              <h3 className="text-lg font-bold text-slate-100 mb-2">{config.entities.screen.icon} {config.entities.screen.singular}</h3>
              <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>{config.entities.screen.description}. Run a real US court (CourtListener) eviction check.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={screenForm.tenantEmail} onChange={(e) => setScreenForm({ ...screenForm, tenantEmail: e.target.value })} placeholder={`${config.entities.tenants.singular} email *`} type="email" className={inputClass} />
                <input value={screenForm.tenantName} onChange={(e) => setScreenForm({ ...screenForm, tenantName: e.target.value })} placeholder={`${config.entities.tenants.singular} name`} className={inputClass} />
                <input value={screenForm.state} onChange={(e) => setScreenForm({ ...screenForm, state: e.target.value })} placeholder="State (e.g. IL)" className={inputClass} />
                <select value={screenForm.source} onChange={(e) => setScreenForm({ ...screenForm, source: e.target.value })} className={selectClass}>
                  <option value="COURTLISTENER">🏛️ US CourtListener (real)</option>
                  <option value="BACKGROUND_CHECK">🇵🇰 PK BackgroundCheck</option>
                  <option value="MANUAL">✏️ Manual</option>
                </select>
              </div>
              <Button onClick={screenTenant} className="mt-4">Run {config.entities.screen.singular}</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.screenings.length === 0 && <p style={{ color: tokens.color.muted }}>No {config.entities.screen.label.toLowerCase()} yet.</p>}
              {dash!.screenings.map((sc) => (
                <Surface key={sc.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{sc.tenantName || sc.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{sc.source} · {new Date(sc.screenedAt).toLocaleDateString()}</div></div>
                  <div className="text-right">
                    <Badge tone={riskTone[sc.band] || 'info'}>{sc.band}</Badge>
                    {sc.depositAdjPct > 0 && <div className="text-xs mt-1 font-semibold" style={{ color: tokens.color.danger }}>+{sc.depositAdjPct}%</div>}
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Appointments / Meetings / Calls */}
        {tab === 'appointments' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">{config.entities.appointments.icon} Schedule {config.entities.appointments.singular}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={apptForm.tenantEmail} onChange={(e) => setApptForm({ ...apptForm, tenantEmail: e.target.value })} placeholder={`${config.entities.tenants.singular} email *`} type="email" className={inputClass} />
                <input value={apptForm.tenantName} onChange={(e) => setApptForm({ ...apptForm, tenantName: e.target.value })} placeholder={`${config.entities.tenants.singular} name`} className={inputClass} />
                <input value={apptForm.startsAt} onChange={(e) => setApptForm({ ...apptForm, startsAt: e.target.value })} type="datetime-local" className={inputClass} />
                <input value={apptForm.endsAt} onChange={(e) => setApptForm({ ...apptForm, endsAt: e.target.value })} type="datetime-local" className={inputClass} />
              </div>
              <Button onClick={addAppointment} className="mt-4">Schedule</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.appointments.length === 0 && <p style={{ color: tokens.color.muted }}>No {config.entities.appointments.label.toLowerCase()} yet.</p>}
              {dash!.appointments.map((a) => (
                <Surface key={a.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{a.tenantName || a.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(a.startsAt).toLocaleString()}</div></div>
                  <Badge tone={a.status === 'CONFIRMED' ? 'success' : a.status === 'COMPLETED' ? 'success' : 'info'}>{a.status}</Badge>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Leases / Deals / Contracts / Agreements */}
        {tab === 'leases' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">{config.entities.leases.icon} Add {config.entities.leases.singular}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={leaseForm.tenantEmail} onChange={(e) => setLeaseForm({ ...leaseForm, tenantEmail: e.target.value })} placeholder={`${config.entities.tenants.singular} email *`} type="email" className={inputClass} />
                <input value={leaseForm.tenantName} onChange={(e) => setLeaseForm({ ...leaseForm, tenantName: e.target.value })} placeholder={`${config.entities.tenants.singular} name`} className={inputClass} />
                <input value={leaseForm.startDate} onChange={(e) => setLeaseForm({ ...leaseForm, startDate: e.target.value })} type="date" className={inputClass} />
                <input value={leaseForm.endDate} onChange={(e) => setLeaseForm({ ...leaseForm, endDate: e.target.value })} type="date" className={inputClass} />
                <input value={leaseForm.rentAmount} onChange={(e) => setLeaseForm({ ...leaseForm, rentAmount: e.target.value })} placeholder="Amount *" type="number" className={inputClass} />
                <input value={leaseForm.depositAmount} onChange={(e) => setLeaseForm({ ...leaseForm, depositAmount: e.target.value })} placeholder="Deposit" type="number" className={inputClass} />
              </div>
              <Button onClick={addLease} className="mt-4">Add {config.entities.leases.singular}</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.leases.length === 0 && <p style={{ color: tokens.color.muted }}>No {config.entities.leases.label.toLowerCase()} yet.</p>}
              {dash!.leases.map((l) => (
                <Surface key={l.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{l.tenantName || l.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()} · ${l.rentAmount}</div></div>
                  <Badge tone={l.status === 'ACTIVE' ? 'success' : 'info'}>{l.status}</Badge>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Maintenance / Tasks / Deliverables / Tickets */}
        {tab === 'maintenance' && (
          <div className="space-y-4">
            <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">{config.entities.maintenance.icon} Report {config.entities.maintenance.singular}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={maintForm.title} onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })} placeholder="Title *" className={inputClass} />
                <input value={maintForm.tenantEmail} onChange={(e) => setMaintForm({ ...maintForm, tenantEmail: e.target.value })} placeholder={`${config.entities.tenants.singular} email`} className={inputClass} />
                <select value={maintForm.priority} onChange={(e) => setMaintForm({ ...maintForm, priority: e.target.value })} className={selectClass}>
                  <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option>
                </select>
                <input value={maintForm.description} onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })} placeholder="Description" className={inputClass} />
              </div>
              <Button onClick={addMaintenance} className="mt-4">Submit</Button>
            </Surface>
            <div className="space-y-2">
              {dash!.maintenance.length === 0 && <p style={{ color: tokens.color.muted }}>No {config.entities.maintenance.label.toLowerCase()} yet.</p>}
              {dash!.maintenance.map((m) => (
                <Surface key={m.id} className="flex items-center justify-between">
                  <div><div className="font-semibold text-slate-100">{m.title}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{m.description}</div></div>
                  <Badge tone={m.priority === 'URGENT' || m.priority === 'HIGH' ? 'danger' : 'warning'}>{m.priority}</Badge>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Applications / Leads / Inquiries / Proposals */}
        {tab === 'applications' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-100">{config.entities.applications.icon} {config.entities.applications.label}</h3>
            <div className="space-y-2">
              {dash!.applications.length === 0 && <p style={{ color: tokens.color.muted }}>No {config.entities.applications.label.toLowerCase()} yet.</p>}
              {dash!.applications.map((a) => (
                <Surface key={a.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-100">{a.firstName || ''} {a.lastName || a.email}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Applied {new Date(a.createdAt).toLocaleDateString()}{a.message ? ` — ${a.message}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <Badge tone={a.status === 'APPROVED' ? 'success' : a.status === 'DENIED' ? 'danger' : 'info'}>{a.status}</Badge>
                    {a.screeningBand && <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Band: {a.screeningBand}</div>}
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Portal / Branding */}
        {tab === 'portal' && (
          <Surface>
            <h3 className="text-lg font-bold text-slate-100 mb-2">🎨 Your client portal</h3>
            <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Clients visit this link to see your offerings and apply.</p>
            <div className="flex gap-2"><input readOnly value={portalUrl} className={inputClass} /><Button onClick={() => navigator.clipboard?.writeText(portalUrl)} variant="ghost">Copy</Button></div>
          </Surface>
        )}

        {/* Webhooks */}
        {tab === 'webhooks' && <WebhooksTab />}

        {/* Activity */}
        {tab === 'activity' && <ActivityTab />}
      </div>
    </div>
  );
};

// Sub-components for webhooks + activity
const WebhooksTab: React.FC = () => {
  const [wh, setWh] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  useEffect(() => { propertyManagerService.webhooks().then((r) => setWh(r.data?.data || [])).catch(() => {}); }, []);
  const add = async () => { if (!url) return; await propertyManagerService.addWebhook({ url }); setUrl(''); propertyManagerService.webhooks().then((r) => setWh(r.data?.data || [])); };
  const remove = async (id: string) => { await propertyManagerService.deleteWebhook(id); setWh(wh.filter((w) => w.id !== id)); };
  return (
    <div className="space-y-4">
      <Surface><h3 className="text-lg font-bold text-slate-100 mb-4">🔗 Webhooks</h3>
        <p className="text-sm mb-4" style={{ color: tokens.color.muted }}>Connect your own CRM/external system. Events are signed with HMAC-SHA256.</p>
        <div className="flex gap-2"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-crm.com/webhook" className={inputClass} /><Button onClick={add}>Add</Button></div>
      </Surface>
      <div className="space-y-2">
        {wh.length === 0 && <p style={{ color: tokens.color.muted }}>No webhooks yet.</p>}
        {wh.map((w) => (
          <Surface key={w.id} className="flex items-center justify-between">
            <div><div className="font-semibold text-slate-100">{w.url}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{w.events?.join(', ')} · {w.lastStatus || 'never sent'}</div></div>
            <Button onClick={() => remove(w.id)} variant="ghost">Delete</Button>
          </Surface>
        ))}
      </div>
    </div>
  );
};

const ActivityTab: React.FC = () => {
  const [acts, setActs] = useState<any[]>([]);
  useEffect(() => { propertyManagerService.activity().then((r) => setActs(r.data?.data || [])).catch(() => {}); }, []);
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-slate-100 mb-4">📜 Activity Log</h3>
      {acts.length === 0 && <p style={{ color: tokens.color.muted }}>No activity yet.</p>}
      {acts.map((a) => (
        <Surface key={a.id}>
          <div className="flex items-center justify-between">
            <div><div className="font-semibold text-slate-100">{a.description}</div><div className="text-xs" style={{ color: tokens.color.muted }}>{a.action} · {a.entityType}</div></div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(a.createdAt).toLocaleString()}</div>
          </div>
        </Surface>
      ))}
    </div>
  );
};

const inputClass = "w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-lg focus:ring-1 focus:ring-primary px-4 py-3 outline-none font-body text-sm";

export default CRMPage;
