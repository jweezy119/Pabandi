import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService, teamService, documentAIService } from '../services/api';
import { CRM_CONFIG, BUSINESS_TYPES, BusinessType } from '../config/crmConfig';
import { TenantWorkflowPage } from './TenantWorkflowPage';
import TenantDashboardPage from './TenantDashboardPage';
import { AIAssistantPage } from './AIAssistantPage';
import { crmService } from '../services/api';
import { Link } from 'react-router-dom';

type Profile = { id: string; companyName?: string | null; businessType: BusinessType; slug?: string | null; domain?: string | null; brandColor?: string | null; logoUrl?: string | null; tagline?: string | null; active: boolean; };
type Property = { id: string; title: string; address?: string | null; city?: string | null; state?: string | null; bedrooms: number; bathrooms: number; rentAmount?: number | null; rentPeriod: string; status: string; unit?: { id: string; unitNumber?: string | null; title?: string | null } | null; };
type Tenant = { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; status: string; riskBand?: string | null; depositHeld: number; totalStays: number; totalDisputes: number; lastStayAt?: string | null; notes?: string | null; property?: { id: string; title?: string | null; address?: string | null; city?: string | null; state?: string | null } | null; lease?: { id: string; startDate?: string | null; endDate?: string | null; rentAmount?: number | null; status?: string; unit?: { id: string; unitNumber?: string | null; title?: string | null } | null; petFee?: number | null; petMonthly?: number | null; lateFee?: number | null; utilities?: string[] | null } | null; screenedAt?: string | null; screeningBand?: string | null; };
type Screening = { id: string; tenantEmail: string; tenantName?: string | null; band: string; depositAdjPct: number; screenedAt: string; source: string; };
type Appointment = { id: string; propertyId?: string | null; tenantEmail: string; tenantName?: string | null; startsAt: string; endsAt?: string | null; status: string; notes?: string | null; };
type Lease = { id: string; propertyId?: string | null; tenantEmail: string; tenantName?: string | null; startDate: string; endDate: string; rentAmount: number; rentPeriod: string; depositAmount: number; status: string; notes?: string | null; unit?: { id: string; unitNumber?: string | null; title?: string | null } | null; petFee?: number | null; petMonthly?: number | null; lateFee?: number | null; utilities?: string[] | null; };
type Maintenance = { id: string; propertyId?: string | null; tenantEmail?: string | null; title: string; description?: string | null; priority: string; status: string; resolvedAt?: string | null; notes?: string | null; cost?: number | null; vendor?: string | null; vendorNotes?: string | null; };
type Application = { id: string; email: string; firstName?: string | null; lastName?: string | null; status: string; screeningBand?: string | null; depositAdjPct: number; decisionNotes?: string | null; decidedAt?: string | null; createdAt: string; message?: string | null; };
type Dashboard = { profile: Profile; properties: Property[]; tenants: Tenant[]; screenings: Screening[]; appointments: Appointment[]; leases: Lease[]; maintenance: Maintenance[]; applications: Application[]; stats: any; };

const riskTone: Record<string, 'success' | 'warning' | 'danger'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };

export const CRMPage: React.FC = () => {
  const [enrolling, setEnrolling] = useState(false);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<string>('overview');
  const [showForm, setShowForm] = useState(false);
  const [propForm, setPropForm] = useState({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' });
  const [tenantForm, setTenantForm] = useState({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' });
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [screenForm, setScreenForm] = useState({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'COURTLISTENER', state: '' });
  const [apptForm, setApptForm] = useState({ tenantEmail: '', tenantName: '', startsAt: '', endsAt: '', notes: '' });
  const [leaseForm, setLeaseForm] = useState({ tenantEmail: '', tenantName: '', startDate: '', endDate: '', rentAmount: '', rentPeriod: 'MONTH', depositAmount: '' });
  const [maintForm, setMaintForm] = useState({ title: '', description: '', priority: 'MEDIUM', tenantEmail: '' });
  const [bizType, setBizType] = useState<BusinessType>('GENERAL');
  const [crmDeals, setCrmDeals] = useState<any[]>([]);
  const [crmPipeline, setCrmPipeline] = useState<any[]>([]);
  const [crmTasks, setCrmTasks] = useState<any[]>([]);

  const loadCrm = async () => {
    try {
      const [dealsRes, pipelineRes, tasksRes] = await Promise.all([
        crmService.deals().catch(() => ({ data: { data: [] } })),
        crmService.pipeline().catch(() => ({ data: { data: { pipeline: [] } } })),
        crmService.tasks().catch(() => ({ data: { data: [] } })),
      ]);
      setCrmDeals(dealsRes.data?.data || []);
      setCrmPipeline(pipelineRes.data?.data?.pipeline || []);
      setCrmTasks(tasksRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load CRM data', e);
    }
  };

  useEffect(() => { loadCrm(); }, []);

  const config = dash?.profile ? CRM_CONFIG[dash.profile.businessType] || CRM_CONFIG.GENERAL : CRM_CONFIG.GENERAL;

  const load = () => {
    propertyManagerService.dashboard().then((r) => setDash(r.data?.data)).catch((e) => { if (e?.response?.status === 404) setDash(null); else setErr(e?.response?.data?.error || 'Could not load dashboard'); });
    loadCrm();
  };
  useEffect(load, []);

  const enroll = async () => { setEnrolling(true); setErr(''); try { await propertyManagerService.enroll({ companyName: 'My Business', businessType: bizType }); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not enroll'); } finally { setEnrolling(false); } };
  const addProperty = async () => { if (!propForm.title) return; try { await propertyManagerService.addProperty({ ...propForm, rentAmount: propForm.rentAmount ? Number(propForm.rentAmount) : undefined }); setPropForm({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' }); setShowForm(false); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not add'); } };
  const addTenant = async () => { if (!tenantForm.email) return; try { await propertyManagerService.addTenant(tenantForm); setTenantForm({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' }); setShowForm(false); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not add'); } };
  const screenTenant = async () => { if (!screenForm.tenantEmail) return; try { await propertyManagerService.screenTenant(screenForm); setScreenForm({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'COURTLISTENER', state: '' }); setShowForm(false); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not screen'); } };
  const addAppointment = async () => { if (!apptForm.tenantEmail || !apptForm.startsAt) return; try { await propertyManagerService.addAppointment(apptForm); setApptForm({ tenantEmail: '', tenantName: '', startsAt: '', endsAt: '', notes: '' }); setShowForm(false); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); } };
  const addLease = async () => { if (!leaseForm.tenantEmail || !leaseForm.startDate || !leaseForm.endDate || !leaseForm.rentAmount) return; try { await propertyManagerService.addLease({ ...leaseForm, rentAmount: Number(leaseForm.rentAmount), depositAmount: leaseForm.depositAmount ? Number(leaseForm.depositAmount) : 0 }); setLeaseForm({ tenantEmail: '', tenantName: '', startDate: '', endDate: '', rentAmount: '', rentPeriod: 'MONTH', depositAmount: '' }); setShowForm(false); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); } };
  const addMaintenance = async () => { if (!maintForm.title) return; try { await propertyManagerService.addMaintenance(maintForm); setMaintForm({ title: '', description: '', priority: 'MEDIUM', tenantEmail: '' }); setShowForm(false); load(); } catch (e: any) { setErr(e?.response?.data?.error || 'Could not create'); } };

  const inputClass = "w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3.5 outline-none font-body text-base transition-all";
  const selectClass = inputClass;

  if (dash === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 md:p-6" style={{ background: tokens.color.background }}>
        <Surface className="text-center max-w-md w-full p-8 md:p-10">
          <div className="text-5xl md:text-6xl mb-4">📋</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--warm-ink)] font-headline">Universal CRM</h1>
          <p className="mt-3 text-[var(--soft-stone)] leading-relaxed text-sm md:text-base">One CRM for any business — property management, sales, services, freelance, or general.</p>
          <div className="mt-6 text-left">
            <label className="text-sm font-semibold text-[var(--warm-ink)] mb-2 block">What kind of business?</label>
            <div className="grid gap-2">
              {BUSINESS_TYPES.map((bt) => (
                <button key={bt.value} onClick={() => setBizType(bt.value)}
                  className={`text-left p-3 rounded-xl border transition-all active:scale-[0.98] ${bizType === bt.value ? 'border-indigo-400/60 bg-[var(--clay)]/10' : 'border-[var(--soft-stone)]/30 bg-[var(--cream)] hover:bg-[var(--warm-sand)]'}`}>
                  <div className="font-semibold text-[var(--warm-ink)] text-sm">{bt.label}</div>
                  <div className="text-xs text-[var(--soft-stone)]">{bt.description}</div>
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

  const navItems = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'properties', icon: config.entities.properties.icon, label: config.entities.properties.label },
    { id: 'tenants', icon: config.entities.tenants.icon, label: config.entities.tenants.label },
    { id: 'screen', icon: config.entities.screen.icon, label: config.entities.screen.label },
    { id: 'appointments', icon: config.entities.appointments.icon, label: config.entities.appointments.label },
    { id: 'leases', icon: config.entities.leases.icon, label: config.entities.leases.label },
    { id: 'maintenance', icon: config.entities.maintenance.icon, label: config.entities.maintenance.label },
    { id: 'applications', icon: config.entities.applications.icon, label: config.entities.applications.label },
    { id: 'pipeline', icon: '📈', label: 'Pipeline' },
    { id: 'tasks', icon: '✅', label: 'Tasks' },
    { id: 'team', icon: '👥', label: 'Team' },
    { id: 'documents', icon: '📄', label: 'Documents' },
    { id: 'webhooks', icon: '🔗', label: 'Webhooks' },
    { id: 'activity', icon: '📜', label: 'Activity' },
  ];

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: tokens.color.background }}>
      {/* Secondary CRM Header (Layout header handles top-level nav) */}
      <div className="sticky top-16 z-40 backdrop-blur-sm bg-surface/80 border-b border-[var(--soft-stone)]/30 px-4 py-3 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-[var(--warm-ink)] font-headline">{dash!.profile.companyName || 'My Business'}</h1>
            <p className="text-xs md:text-sm" style={{ color: tokens.color.textDim }}>{config.label}</p>
          </div>
          <div className="md:hidden flex gap-1">
            {navItems.slice(0, 4).map((n) => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`p-2 rounded-lg text-lg transition-all ${tab === n.id ? 'bg-[var(--clay)]/20' : ''}`}>
                {n.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Tab Bar */}
      <div className="hidden md:flex gap-2 px-8 py-3 max-w-5xl mx-auto flex-wrap">
        {navItems.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === n.id ? 'bg-[var(--clay)]/20 text-[var(--terracotta)] border border-[var(--clay)]/30' : 'bg-[var(--cream)] text-[var(--soft-stone)] border border-[var(--soft-stone)]/30 hover:bg-[var(--warm-sand)]'}`}>
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
        {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger, border: `1px solid ${tokens.color.danger}30` }}>{err}</div>}

        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('properties')}><div className="text-2xl font-bold text-[var(--warm-ink)]">{s.totalProperties}</div><div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{config.entities.properties.label}</div></Surface>
              <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('tenants')}><div className="text-2xl font-bold text-[var(--sage)]">{s.occupied}</div><div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Active</div></Surface>
              <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('tenants')}><div className="text-2xl font-bold text-[var(--terracotta)]">{s.vacant}</div><div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Available</div></Surface>
              <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('tenants')}><div className="text-2xl font-bold text-[var(--warm-ink)]">{s.totalTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{config.entities.tenants.label}</div></Surface>
              <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('screen')}><div className="text-2xl font-bold" style={{ color: s.highRiskTenants > 0 ? tokens.color.danger : tokens.color.text }}>{s.highRiskTenants}</div><div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>High-risk</div></Surface>
              <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('appointments')}><div className="text-2xl font-bold text-[var(--warm-ink)]">{s.upcomingAppointments}</div><div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{config.entities.appointments.label}</div></Surface>
              <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('leases')}><div className="text-2xl font-bold text-[var(--warm-ink)]">{s.activeLeases}</div><div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{config.entities.leases.label}</div></Surface>
              <Surface className="text-center active:scale-[0.97] transition-transform cursor-pointer" onClick={() => setTab('maintenance')}><div className="text-2xl font-bold text-[var(--warm-ink)]">{s.openMaintenance || 0}</div><div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{config.entities.maintenance.label}</div></Surface>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Link to="/sales-crm">
                <Surface className="p-6 hover:bg-[var(--warm-sand)] transition-colors cursor-pointer">
                  <div className="text-2xl mb-2">📈</div>
                  <div className="text-lg font-bold text-[var(--warm-ink)]">Sales CRM</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Pipeline · Deals · Tasks · Campaigns</div>
                  <div className="text-xs mt-2 text-[var(--terracotta)]">{crmDeals.length} deals · ${crmPipeline.reduce((sum: number, p: any) => sum + p.value, 0).toLocaleString()} pipeline</div>
                </Surface>
              </Link>
              <Link to="/dashboard">
                <Surface className="p-6 hover:bg-[var(--warm-sand)] transition-colors cursor-pointer">
                  <div className="text-2xl mb-2">📊</div>
                  <div className="text-lg font-bold text-[var(--warm-ink)]">Dashboard</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Business overview · Multi-type</div>
                </Surface>
              </Link>
              <Link to="/tenant-workflow">
                <Surface className="p-6 hover:bg-[var(--warm-sand)] transition-colors cursor-pointer">
                  <div className="text-2xl mb-2">🔄</div>
                  <div className="text-lg font-bold text-[var(--warm-ink)]">Workflows</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Tenant lifecycle automation</div>
                </Surface>
              </Link>
            </div>
          </div>
        )}

        {/* Properties */}
        {tab === 'properties' && (
          <div className="space-y-3">
            {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Add {config.entities.properties.singular}</Button>}
            {showForm && (
              <Surface>
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">{config.entities.properties.icon} Add {config.entities.properties.singular}</h3>
                <div className="space-y-3">
                  <input value={propForm.title} onChange={(e) => setPropForm({ ...propForm, title: e.target.value })} placeholder={`${config.entities.properties.singular} name *`} className={inputClass} />
                  <input value={propForm.address} onChange={(e) => setPropForm({ ...propForm, address: e.target.value })} placeholder="Address" className={inputClass} />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={propForm.city} onChange={(e) => setPropForm({ ...propForm, city: e.target.value })} placeholder="City" className={inputClass} />
                    <input value={propForm.state} onChange={(e) => setPropForm({ ...propForm, state: e.target.value })} placeholder="State" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={propForm.zip} onChange={(e) => setPropForm({ ...propForm, zip: e.target.value })} placeholder="ZIP" className={inputClass} />
                    <input value={propForm.rentAmount} onChange={(e) => setPropForm({ ...propForm, rentAmount: e.target.value })} placeholder="Rent" type="number" className={inputClass} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={addProperty} className="flex-1">Save</Button>
                  <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
                </div>
              </Surface>
            )}
            {dash!.properties.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No {config.entities.properties.label.toLowerCase()} yet.</p>}
            {dash!.properties.map((p) => (
              <Surface key={p.id} className="flex items-center justify-between">
                <div><div className="font-semibold text-[var(--warm-ink)]">{p.title}</div><div className="text-xs" style={{ color: tokens.color.textDim }}>{p.address}{p.city ? `, ${p.city}` : ''}</div></div>
                <div className="text-right">
                  {p.rentAmount && <div className="font-bold text-[var(--warm-ink)]">${p.rentAmount}</div>}
                  <Badge tone={p.status === 'VACANT' ? 'info' : p.status === 'OCCUPIED' ? 'success' : 'warning'}>{p.status}</Badge>
                </div>
              </Surface>
            ))}
          </div>
        )}

        {/* Tenants */}
        {tab === 'tenants' && (
          <div className="space-y-3">
            {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Add {config.entities.tenants.singular}</Button>}
            {showForm && (
              <Surface>
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">{config.entities.tenants.icon} Add {config.entities.tenants.singular}</h3>
                <div className="space-y-3">
                  <input value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="Email *" type="email" className={inputClass} />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={tenantForm.firstName} onChange={(e) => setTenantForm({ ...tenantForm, firstName: e.target.value })} placeholder="First name" className={inputClass} />
                    <input value={tenantForm.lastName} onChange={(e) => setTenantForm({ ...tenantForm, lastName: e.target.value })} placeholder="Last name" className={inputClass} />
                  </div>
                  <input value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} placeholder="Phone" className={inputClass} />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={addTenant} className="flex-1">Save</Button>
                  <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
                </div>
              </Surface>
            )}
            {dash!.tenants.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No {config.entities.tenants.label.toLowerCase()} yet.</p>}
            {dash!.tenants.map((t) => (
              <button key={t.id} onClick={() => setSelectedTenant(t)} className="w-full text-left active:scale-[0.98] transition-transform">
                <Surface className="flex items-center justify-between">
                  <div><div className="font-semibold text-[var(--warm-ink)]">{t.firstName || ''} {t.lastName || ''}</div><div className="text-xs" style={{ color: tokens.color.textDim }}>{t.email}{t.property ? ` · ${t.property.title || ''}` : ''}</div></div>
                  <div className="text-right">
                    {t.riskBand && <Badge tone={riskTone[t.riskBand] || 'info'}>{t.riskBand}</Badge>}
                    <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{t.status}</div>
                  </div>
                </Surface>
              </button>
            ))}
          </div>
        )}

        {/* Tenant Detail Modal */}
        {selectedTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setSelectedTenant(null)}>
            <div className="max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--warm-ink)] font-headline">Tenant Profile</h2>
                <button onClick={() => setSelectedTenant(null)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] text-xl leading-none">&times;</button>
              </div>
              {/* Profile Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-[var(--clay)]/20 flex items-center justify-center text-[var(--terracotta)] text-xl font-bold">
                  {(selectedTenant.firstName || '?')[0]}{(selectedTenant.lastName || '?')[0]}
                </div>
                <div>
                  <div className="font-semibold text-[var(--warm-ink)] text-lg">{selectedTenant.firstName || ''} {selectedTenant.lastName || ''}</div>
                  <div className="text-sm text-[var(--soft-stone)]">{selectedTenant.email}</div>
                  {selectedTenant.phone && <div className="text-sm text-[var(--soft-stone)]">{selectedTenant.phone}</div>}
                </div>
              </div>
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <Surface className="p-3">
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Status</div>
                  <div className="font-semibold text-[var(--warm-ink)] capitalize">{selectedTenant.status}</div>
                </Surface>
                <Surface className="p-3">
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Risk Band</div>
                  <div className="font-semibold text-[var(--warm-ink)]">{selectedTenant.riskBand || 'N/A'}</div>
                </Surface>
                {selectedTenant.depositHeld > 0 && (
                  <Surface className="p-3">
                    <div className="text-xs" style={{ color: tokens.color.textDim }}>Deposit Held</div>
                    <div className="font-semibold text-[var(--warm-ink)]">${selectedTenant.depositHeld.toLocaleString()}</div>
                  </Surface>
                )}
                <Surface className="p-3">
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Total Stays</div>
                  <div className="font-semibold text-[var(--warm-ink)]">{selectedTenant.totalStays}</div>
                </Surface>
                {selectedTenant.screenedAt && (
                  <Surface className="p-3">
                    <div className="text-xs" style={{ color: tokens.color.textDim }}>Screened</div>
                    <div className="font-semibold text-[var(--warm-ink)] text-sm">{new Date(selectedTenant.screenedAt).toLocaleDateString()}</div>
                  </Surface>
                )}
                {selectedTenant.screeningBand && (
                  <Surface className="p-3">
                    <div className="text-xs" style={{ color: tokens.color.textDim }}>Screening</div>
                    <div className="font-semibold text-[var(--warm-ink)]">{selectedTenant.screeningBand}</div>
                  </Surface>
                )}
              </div>
              {/* Property */}
              {selectedTenant.property && (
                <Surface className="p-4 mb-4">
                  <div className="text-sm font-semibold text-[var(--warm-ink)] mb-1">Property</div>
                  <div className="text-[var(--warm-ink)]">{selectedTenant.property.title || ''}</div>
                  <div className="text-[var(--soft-stone)] text-sm">{[selectedTenant.property.address, selectedTenant.property.city, selectedTenant.property.state].filter(Boolean).join(', ')}</div>
                </Surface>
              )}
              {/* Lease */}
              {selectedTenant.lease && (
                <Surface className="p-4 mb-4">
                  <div className="text-sm font-semibold text-[var(--warm-ink)] mb-1">Current Lease</div>
                  <div className="text-[var(--warm-ink)] text-sm">{selectedTenant.lease.unit?.unitNumber ? `Unit ${selectedTenant.lease.unit.unitNumber}` : ''} {selectedTenant.lease.unit?.title ? `(${selectedTenant.lease.unit.title})` : ''}</div>
                  <div className="text-[var(--warm-ink)] text-sm">{selectedTenant.lease.startDate ? new Date(selectedTenant.lease.startDate).toLocaleDateString() : ''} — {selectedTenant.lease.endDate ? new Date(selectedTenant.lease.endDate).toLocaleDateString() : ''}</div>
                  <div className="text-[var(--soft-stone)] text-sm">{selectedTenant.lease.rentAmount ? `$${selectedTenant.lease.rentAmount}/mo` : ''}{selectedTenant.lease.petFee ? ` · Pet fee: $${selectedTenant.lease.petFee}` : ''}{selectedTenant.lease.petMonthly ? ` · Pet rent: $${selectedTenant.lease.petMonthly}/mo` : ''}{selectedTenant.lease.lateFee ? ` · Late fee: $${selectedTenant.lease.lateFee}` : ''}</div>
                  {selectedTenant.lease.utilities?.length ? <div className="text-[var(--soft-stone)] text-sm">Utilities: {selectedTenant.lease.utilities.join(', ')}</div> : null}
                  <Badge tone={selectedTenant.lease.status === 'ACTIVE' ? 'success' : 'info'} className="mt-1">{selectedTenant.lease.status}</Badge>
                </Surface>
              )}
              {/* Notes */}
              {selectedTenant.notes && (
                <Surface className="p-4 mb-6">
                  <div className="text-sm font-semibold text-[var(--warm-ink)] mb-1">Notes</div>
                  <div className="text-[var(--warm-ink)] text-sm">{selectedTenant.notes}</div>
                </Surface>
              )}
              <div className="flex gap-2">
                <Button onClick={() => setSelectedTenant(null)} variant="ghost" className="flex-1">Close</Button>
              </div>
            </div>
          </div>
        )}

        {/* Screening */}
        {tab === 'screen' && (
          <div className="space-y-3">
            {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Run {config.entities.screen.singular}</Button>}
            {showForm && (
              <Surface>
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">{config.entities.screen.icon} {config.entities.screen.singular}</h3>
                <div className="space-y-3">
                  <input value={screenForm.tenantEmail} onChange={(e) => setScreenForm({ ...screenForm, tenantEmail: e.target.value })} placeholder={`${config.entities.tenants.singular} email *`} type="email" className={inputClass} />
                  <input value={screenForm.tenantName} onChange={(e) => setScreenForm({ ...screenForm, tenantName: e.target.value })} placeholder={`${config.entities.tenants.singular} name`} className={inputClass} />
                  <input value={screenForm.state} onChange={(e) => setScreenForm({ ...screenForm, state: e.target.value })} placeholder="State (e.g. IL)" className={inputClass} />
                  <select value={screenForm.source} onChange={(e) => setScreenForm({ ...screenForm, source: e.target.value })} className={selectClass}>
                    <option value="COURTLISTENER">🏛️ US CourtListener (real)</option>
                    <option value="BACKGROUND_CHECK">🇵🇰 PK BackgroundCheck</option>
                    <option value="MANUAL">✏️ Manual</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={screenTenant} className="flex-1">Run</Button>
                  <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
                </div>
              </Surface>
            )}
            {dash!.screenings.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No {config.entities.screen.label.toLowerCase()} yet.</p>}
            {dash!.screenings.map((sc) => (
              <Surface key={sc.id} className="flex items-center justify-between">
                <div><div className="font-semibold text-[var(--warm-ink)]">{sc.tenantName || sc.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.textDim }}>{sc.source} · {new Date(sc.screenedAt).toLocaleDateString()}</div></div>
                <div className="text-right">
                  <Badge tone={riskTone[sc.band] || 'info'}>{sc.band}</Badge>
                  {sc.depositAdjPct > 0 && <div className="text-xs mt-1 font-semibold" style={{ color: tokens.color.danger }}>+{sc.depositAdjPct}%</div>}
                </div>
              </Surface>
            ))}
          </div>
        )}

        {/* Appointments */}
        {tab === 'appointments' && (
          <div className="space-y-3">
            {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Schedule</Button>}
            {showForm && (
              <Surface>
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">{config.entities.appointments.icon} Schedule {config.entities.appointments.singular}</h3>
                <div className="space-y-3">
                  <input value={apptForm.tenantEmail} onChange={(e) => setApptForm({ ...apptForm, tenantEmail: e.target.value })} placeholder={`${config.entities.tenants.singular} email *`} type="email" className={inputClass} />
                  <input value={apptForm.tenantName} onChange={(e) => setApptForm({ ...apptForm, tenantName: e.target.value })} placeholder={`${config.entities.tenants.singular} name`} className={inputClass} />
                  <input value={apptForm.startsAt} onChange={(e) => setApptForm({ ...apptForm, startsAt: e.target.value })} type="datetime-local" className={inputClass} />
                  <input value={apptForm.endsAt} onChange={(e) => setApptForm({ ...apptForm, endsAt: e.target.value })} type="datetime-local" className={inputClass} />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={addAppointment} className="flex-1">Save</Button>
                  <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
                </div>
              </Surface>
            )}
            {dash!.appointments.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No {config.entities.appointments.label.toLowerCase()} yet.</p>}
            {dash!.appointments.map((a) => (
              <Surface key={a.id} className="flex items-center justify-between">
                <div><div className="font-semibold text-[var(--warm-ink)]">{a.tenantName || a.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.textDim }}>{new Date(a.startsAt).toLocaleString()}</div></div>
                <Badge tone={a.status === 'CONFIRMED' ? 'success' : a.status === 'COMPLETED' ? 'success' : 'info'}>{a.status}</Badge>
              </Surface>
            ))}
          </div>
        )}

        {/* Leases */}
        {tab === 'leases' && (
          <div className="space-y-3">
            {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Add {config.entities.leases.singular}</Button>}
            {showForm && (
              <Surface>
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">{config.entities.leases.icon} Add {config.entities.leases.singular}</h3>
                <div className="space-y-3">
                  <input value={leaseForm.tenantEmail} onChange={(e) => setLeaseForm({ ...leaseForm, tenantEmail: e.target.value })} placeholder={`${config.entities.tenants.singular} email *`} type="email" className={inputClass} />
                  <input value={leaseForm.tenantName} onChange={(e) => setLeaseForm({ ...leaseForm, tenantName: e.target.value })} placeholder={`${config.entities.tenants.singular} name`} className={inputClass} />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={leaseForm.startDate} onChange={(e) => setLeaseForm({ ...leaseForm, startDate: e.target.value })} type="date" className={inputClass} />
                    <input value={leaseForm.endDate} onChange={(e) => setLeaseForm({ ...leaseForm, endDate: e.target.value })} type="date" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={leaseForm.rentAmount} onChange={(e) => setLeaseForm({ ...leaseForm, rentAmount: e.target.value })} placeholder="Rent *" type="number" className={inputClass} />
                    <input value={leaseForm.depositAmount} onChange={(e) => setLeaseForm({ ...leaseForm, depositAmount: e.target.value })} placeholder="Deposit" type="number" className={inputClass} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={addLease} className="flex-1">Save</Button>
                  <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
                </div>
              </Surface>
            )}
            {dash!.leases.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No {config.entities.leases.label.toLowerCase()} yet.</p>}
            {dash!.leases.map((l) => (
              <Surface key={l.id} className="flex items-center justify-between">
                <div><div className="font-semibold text-[var(--warm-ink)]">{l.tenantName || l.tenantEmail}</div><div className="text-xs" style={{ color: tokens.color.textDim }}>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()} · ${l.rentAmount}</div></div>
                <Badge tone={l.status === 'ACTIVE' ? 'success' : 'info'}>{l.status}</Badge>
              </Surface>
            ))}
          </div>
        )}

        {/* Maintenance */}
        {tab === 'maintenance' && (
          <div className="space-y-3">
            {!showForm && <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">+ Report</Button>}
            {showForm && (
              <Surface>
                <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">{config.entities.maintenance.icon} Report {config.entities.maintenance.singular}</h3>
                <div className="space-y-3">
                  <input value={maintForm.title} onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })} placeholder="Title *" className={inputClass} />
                  <input value={maintForm.tenantEmail} onChange={(e) => setMaintForm({ ...maintForm, tenantEmail: e.target.value })} placeholder={`${config.entities.tenants.singular} email`} className={inputClass} />
                  <select value={maintForm.priority} onChange={(e) => setMaintForm({ ...maintForm, priority: e.target.value })} className={selectClass}>
                    <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option>
                  </select>
                  <input value={maintForm.description} onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })} placeholder="Description" className={inputClass} />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={addMaintenance} className="flex-1">Submit</Button>
                  <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
                </div>
              </Surface>
            )}
            {dash!.maintenance.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No {config.entities.maintenance.label.toLowerCase()} yet.</p>}
            {dash!.maintenance.map((m) => (
              <Surface key={m.id} className="flex items-center justify-between">
                <div><div className="font-semibold text-[var(--warm-ink)]">{m.title}</div><div className="text-xs" style={{ color: tokens.color.textDim }}>{m.description}{m.cost ? ` · $${m.cost}` : ''}</div></div>
                <Badge tone={m.priority === 'URGENT' || m.priority === 'HIGH' ? 'danger' : 'warning'}>{m.priority}</Badge>
              </Surface>
            ))}
          </div>
        )}

        {/* Applications */}
        {tab === 'applications' && (
          <div className="space-y-3">
            {dash!.applications.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No {config.entities.applications.label.toLowerCase()} yet.</p>}
            {dash!.applications.map((a) => (
              <Surface key={a.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[var(--warm-ink)]">{a.firstName || ''} {a.lastName || a.email}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Applied {new Date(a.createdAt).toLocaleDateString()}{a.message ? ` — ${a.message}` : ''}</div>
                </div>
                <div className="text-right">
                  <Badge tone={a.status === 'APPROVED' ? 'success' : a.status === 'DENIED' ? 'danger' : 'info'}>{a.status}</Badge>
                  {a.screeningBand && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Band: {a.screeningBand}</div>}
                </div>
              </Surface>
            ))}
          </div>
        )}

        {/* Applications */}
        {tab === 'applications' && (
          <div className="space-y-3">
            {dash!.applications.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No {config.entities.applications.label.toLowerCase()} yet.</p>}
            {dash!.applications.map((a) => (
              <Surface key={a.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[var(--warm-ink)]">{a.firstName || ''} {a.lastName || a.email}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Applied {new Date(a.createdAt).toLocaleDateString()}{a.message ? ` — ${a.message}` : ''}</div>
                </div>
                <div className="text-right">
                  <Badge tone={a.status === 'APPROVED' ? 'success' : a.status === 'DENIED' ? 'danger' : 'info'}>{a.status}</Badge>
                  {a.screeningBand && <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Band: {a.screeningBand}</div>}
                </div>
              </Surface>
            ))}
          </div>
        )}

        {/* Pipeline */}
        {tab === 'pipeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--warm-ink)]">📈 Sales Pipeline</h3>
              <Link to="/sales-crm" className="text-sm text-[var(--terracotta)] hover:text-[var(--terracotta)]">Open full CRM →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {crmPipeline.map((p: any) => (
                <Surface key={p.stage} className="text-center p-4">
                  <div className="text-2xl font-bold text-[var(--warm-ink)]">{p.count}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>{p.stage}</div>
                  <div className="text-sm font-semibold text-[var(--terracotta)] mt-1">${p.value.toLocaleString()}</div>
                </Surface>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {crmDeals.map((d: any) => (
                <Surface key={d.id} className="p-4">
                  <div className="font-semibold text-[var(--warm-ink)]">{d.title}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>{d.description}</div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-lg font-bold text-[var(--terracotta)]">${d.value.toLocaleString()}</div>
                    <Badge tone={d.stage === 'WON' ? 'success' : d.stage === 'LOST' ? 'danger' : 'info'}>{d.stage}</Badge>
                  </div>
                  {d.contact && <div className="text-xs mt-2" style={{ color: tokens.color.textDim }}>Contact: {d.contact.firstName} {d.contact.lastName}</div>}
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        {tab === 'tasks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--warm-ink)]">✅ Tasks</h3>
              <Link to="/sales-crm" className="text-sm text-[var(--terracotta)] hover:text-[var(--terracotta)]">Manage in Sales CRM →</Link>
            </div>
            {crmTasks.length === 0 && <p className="text-center py-8" style={{ color: tokens.color.textDim }}>No tasks yet.</p>}
            {crmTasks.map((t: any) => (
              <Surface key={t.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[var(--warm-ink)]">{t.title}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>{t.description} {t.dueDate && `· Due: ${new Date(t.dueDate).toLocaleDateString()}`}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={t.priority === 'URGENT' || t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'info'}>{t.priority}</Badge>
                  <Badge tone={t.status === 'COMPLETED' ? 'success' : 'info'}>{t.status}</Badge>
                </div>
              </Surface>
            ))}
          </div>
        )}

        {/* Portal */}
        {tab === 'portal' && (
          <Surface>
            <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">🎨 Your client portal</h3>
            <p className="text-sm mb-4" style={{ color: tokens.color.textDim }}>Clients visit this link to see your offerings and apply.</p>
            <div className="flex gap-2">
              <input readOnly value={portalUrl} className={inputClass} />
              <Button onClick={() => navigator.clipboard?.writeText(portalUrl)} variant="ghost">Copy</Button>
            </div>
          </Surface>
        )}

        {/* Team */}
        {tab === 'team' && <TeamTab />}

        {/* Documents */}
        {tab === 'documents' && <DocumentsTab />}

        {/* Webhooks */}
        {tab === 'webhooks' && <WebhooksTab />}

        {/* Activity */}
        {tab === 'activity' && <ActivityTab />}

        {/* Tenant Workflow */}
        {tab === 'tenant-workflow' && <TenantWorkflowPage />}

        {/* Tenant Dashboard */}
        {tab === 'tenant-dashboard' && <TenantDashboardPage />}

        {/* AI Assistant */}
        {tab === 'ai-assistant' && <AIAssistantPage />}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm bg-surface/90 border-t border-[var(--soft-stone)]/30 safe-area-pb">
        <div className="flex justify-around items-center px-2 py-2">
          {navItems.slice(0, 5).map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${tab === n.id ? 'text-[var(--terracotta)]' : 'text-[var(--soft-stone)]'}`}>
              <span className="text-lg">{n.icon}</span>
              <span className="text-[10px] font-medium">{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const WebhooksTab: React.FC = () => {
  const [wh, setWh] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  useEffect(() => { propertyManagerService.webhooks().then((r) => setWh(r.data?.data || [])).catch(() => {}); }, []);
  const add = async () => { if (!url) return; await propertyManagerService.addWebhook({ url }); setUrl(''); propertyManagerService.webhooks().then((r) => setWh(r.data?.data || [])); };
  const remove = async (id: string) => { await propertyManagerService.deleteWebhook(id); setWh(wh.filter((w) => w.id !== id)); };
  return (
    <div className="space-y-3">
      <Surface>
        <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">🔗 Webhooks</h3>
        <p className="text-sm mb-4" style={{ color: tokens.color.textDim }}>Connect your own CRM/external system. Events are signed with HMAC-SHA256.</p>
        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-crm.com/webhook" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3.5 outline-none font-body text-base" />
          <Button onClick={add}>Add</Button>
        </div>
      </Surface>
      {wh.length === 0 && <p style={{ color: tokens.color.textDim }}>No webhooks yet.</p>}
      {wh.map((w) => (
        <Surface key={w.id} className="flex items-center justify-between">
          <div><div className="font-semibold text-[var(--warm-ink)]">{w.url}</div><div className="text-xs" style={{ color: tokens.color.textDim }}>{w.events?.join(', ')} · {w.lastStatus || 'never sent'}</div></div>
          <Button onClick={() => remove(w.id)} variant="ghost">Delete</Button>
        </Surface>
      ))}
    </div>
  );
};

const ActivityTab: React.FC = () => {
  const [acts, setActs] = useState<any[]>([]);
  useEffect(() => { propertyManagerService.activity().then((r) => setActs(r.data?.data || [])).catch(() => {}); }, []);
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">📜 Activity Log</h3>
      {acts.length === 0 && <p style={{ color: tokens.color.textDim }}>No activity yet.</p>}
      {acts.map((a) => (
        <Surface key={a.id}>
          <div className="flex items-center justify-between">
            <div><div className="font-semibold text-[var(--warm-ink)]">{a.description}</div><div className="text-xs" style={{ color: tokens.color.textDim }}>{a.action} · {a.entityType}</div></div>
            <div className="text-xs" style={{ color: tokens.color.textDim }}>{new Date(a.createdAt).toLocaleString()}</div>
          </div>
        </Surface>
      ))}
    </div>
  );
};

const TeamTab: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('MEMBER');

  const load = () => teamService.listMembers().then(r => setMembers(r.data?.data || []));
  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!email) return;
    await teamService.invite({ email, firstName, lastName, role });
    setEmail(''); setFirstName(''); setLastName(''); setRole('MEMBER');
    load();
  };

  return (
    <div className="space-y-4">
      <Surface className="p-6">
        <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">Invite Team Member</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
          <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="AGENT">Agent</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
        <Button onClick={invite} className="mt-4">Send Invite</Button>
      </Surface>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(m => (
          <Surface key={m.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-[var(--warm-ink)]">{m.firstName} {m.lastName}</div>
              <div className="text-xs" style={{ color: tokens.color.textDim }}>{m.email}</div>
              <div className="text-xs mt-1"><span className="px-2 py-0.5 rounded bg-[var(--clay)]/20 text-[var(--terracotta)]">{m.role}</span></div>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
};

const DocumentsTab: React.FC = () => {
  const [fileName, setFileName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [documentType, setDocumentType] = useState('LEASE');
  const [analyses, setAnalyses] = useState<any[]>([]);

  const analyze = async () => {
    if (!fileName || !textContent) return;
    const res = await documentAIService.analyze({ fileName, textContent, documentType });
    setAnalyses([res.data?.data, ...analyses]);
    setFileName(''); setTextContent('');
  };

  useEffect(() => { documentAIService.history().then(r => setAnalyses(r.data?.data || [])).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <Surface className="p-6">
        <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-4">AI Document Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="File name" className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
          <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="w-full bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base">
            <option value="LEASE">Lease</option>
            <option value="APPLICATION">Application</option>
            <option value="NOTICE">Notice</option>
            <option value="RECEIPT">Receipt</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <textarea value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Paste document text here..." rows={6} className="w-full mt-3 bg-surface-container-highest/50 border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary px-4 py-3 outline-none font-body text-base" />
        <Button onClick={analyze} className="mt-4">Analyze Document</Button>
      </Surface>

      <div className="space-y-3">
        {analyses.map(a => (
          <Surface key={a.id} className="p-4">
            <div className="font-semibold text-[var(--warm-ink)]">{a.fileName}</div>
            <div className="text-xs" style={{ color: tokens.color.textDim }}>{a.documentType} · {new Date(a.createdAt).toLocaleString()}</div>
            {a.analysis && (
              <div className="mt-2 text-sm" style={{ color: tokens.color.text }}>
                <div><strong>Summary:</strong> {a.analysis.summary}</div>
                {a.analysis.risks?.length > 0 && <div className="mt-1"><strong>Risks:</strong> {a.analysis.risks.join(', ')}</div>}
              </div>
            )}
          </Surface>
        ))}
      </div>
    </div>
  );
};

export default CRMPage;
