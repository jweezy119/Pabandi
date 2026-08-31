import React, { useState, useEffect } from 'react';
import { propertyManagerService } from '../services/api';

type Profile = {
  id: string;
  companyName?: string | null;
  slug?: string | null;
  domain?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  active: boolean;
};

type Property = {
  id: string;
  title: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  bedrooms: number;
  bathrooms: number;
  rentAmount?: number | null;
  rentPeriod: string;
  status: string;
};

type Tenant = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  status: string;
  riskBand?: string | null;
  depositHeld: number;
  totalStays: number;
  totalDisputes: number;
  lastStayAt?: string | null;
  notes?: string | null;
};

type Screening = {
  id: string;
  tenantEmail: string;
  tenantName?: string | null;
  band: string;
  depositAdjPct: number;
  screenedAt: string;
  source: string;
};

type Dashboard = {
  profile: Profile;
  properties: Property[];
  tenants: Tenant[];
  screenings: Screening[];
  stats: {
    totalProperties: number;
    occupied: number;
    vacant: number;
    totalTenants: number;
    activeTenants: number;
    totalDepositHeld: number;
    highRiskTenants: number;
    totalDisputes: number;
  };
};

const riskColor: Record<string, string> = { LOW: '#16a34a', MEDIUM: '#f59e0b', HIGH: '#dc2626' };
const statusColor: Record<string, string> = { VACANT: '#6366f1', OCCUPIED: '#16a34a', MAINTENANCE: '#f59e0b' };

export const PropertyManagerPage: React.FC = () => {
  const [enrolling, setEnrolling] = useState(false);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'overview' | 'properties' | 'tenants' | 'screen' | 'portal'>('overview');

  // Form state
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
    try {
      await propertyManagerService.enroll({ companyName: 'My Properties' });
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not enroll');
    } finally { setEnrolling(false); }
  };

  const addProperty = async () => {
    if (!propForm.title) return;
    try {
      await propertyManagerService.addProperty({ ...propForm, rentAmount: propForm.rentAmount ? Number(propForm.rentAmount) : undefined });
      setPropForm({ title: '', address: '', city: '', state: '', zip: '', bedrooms: 1, bathrooms: 1, rentAmount: '', rentPeriod: 'MONTH' });
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not add property');
    }
  };

  const addTenant = async () => {
    if (!tenantForm.email) return;
    try {
      await propertyManagerService.addTenant(tenantForm);
      setTenantForm({ email: '', firstName: '', lastName: '', phone: '', status: 'PROSPECT' });
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not add tenant');
    }
  };

  const screenTenant = async () => {
    if (!screenForm.tenantEmail) return;
    try {
      await propertyManagerService.screenTenant(screenForm);
      setScreenForm({ tenantEmail: '', tenantName: '', band: 'LOW', source: 'MANUAL' });
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not screen tenant');
    }
  };

  // Not enrolled — show enrollment CTA
  if (dash === null) {
    return (
      <div style={page}>
        <div style={{ ...card, textAlign: 'center', maxWidth: 520 }}>
          <div style={{ fontSize: 40 }}>🏘️</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, marginTop: 12 }}>Property Manager CRM</h1>
          <p style={{ color: '#888', marginTop: 8, lineHeight: 1.6 }}>
            Screen tenants with court & KYC checks, track deposits, manage your portfolio, and
            offer tenants a branded portal — all from one dashboard.
          </p>
          <button onClick={enroll} disabled={enrolling} style={btnPrimary}>
            {enrolling ? 'Setting up…' : 'Activate my free CRM'}
          </button>
          {err && <p style={{ color: '#f87171', marginTop: 12, fontSize: 14 }}>{err}</p>}
        </div>
      </div>
    );
  }

  const s = dash!.stats;
  const portalUrl = `${window.location.origin}/p/${dash!.profile.slug || ''}`;

  return (
    <div style={page}>
      <div style={{ maxWidth: 900, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900 }}>{dash!.profile.companyName || 'My Properties'}</h1>
            <p style={{ color: '#888', fontSize: 13 }}>Property Manager CRM · Pabandi</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['overview', 'properties', 'tenants', 'screen', 'portal'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '8px 14px', borderRadius: 10, border: tab === t ? '2px solid #6366f1' : '1px solid rgba(139,92,246,0.3)', background: tab === t ? '#eef2ff' : 'transparent', color: tab === t ? '#6366f1' : '#c4b5fd', fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12, fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{err}</div>}

        {/* Overview */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <Stat label="Total properties" value={String(s.totalProperties)} />
            <Stat label="Occupied" value={String(s.occupied)} color="#16a34a" />
            <Stat label="Vacant" value={String(s.vacant)} color="#6366f1" />
            <Stat label="Active tenants" value={String(s.activeTenants)} />
            <Stat label="Deposits held" value={`$${s.totalDepositHeld.toLocaleString()}`} />
            <Stat label="High-risk tenants" value={String(s.highRiskTenants)} color={s.highRiskTenants > 0 ? '#dc2626' : undefined} />
            <Stat label="Total disputes" value={String(s.totalDisputes)} color={s.totalDisputes > 0 ? '#dc2626' : undefined} />
          </div>
        )}

        {/* Properties */}
        {tab === 'properties' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Add a property</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={propForm.title} onChange={(e) => setPropForm({ ...propForm, title: e.target.value })} placeholder="Title *" style={input} />
                <input value={propForm.address} onChange={(e) => setPropForm({ ...propForm, address: e.target.value })} placeholder="Address" style={input} />
                <input value={propForm.city} onChange={(e) => setPropForm({ ...propForm, city: e.target.value })} placeholder="City" style={input} />
                <input value={propForm.state} onChange={(e) => setPropForm({ ...propForm, state: e.target.value })} placeholder="State" style={input} />
                <input value={propForm.zip} onChange={(e) => setPropForm({ ...propForm, zip: e.target.value })} placeholder="ZIP" style={input} />
                <input value={propForm.rentAmount} onChange={(e) => setPropForm({ ...propForm, rentAmount: e.target.value })} placeholder="Rent (USD/mo)" type="number" style={input} />
              </div>
              <button onClick={addProperty} style={{ ...btnPrimary, marginTop: 10 }}>Add property</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {dash!.properties.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>No properties yet.</p>}
              {dash!.properties.map((p) => (
                <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{p.address}{p.city ? `, ${p.city}` : ''}{p.state ? ` ${p.state}` : ''} · {p.bedrooms}bd/{p.bathrooms}ba</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {p.rentAmount && <div style={{ fontWeight: 800 }}>${p.rentAmount}/{p.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</div>}
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: `${statusColor[p.status] || '#6b7280'}1a`, color: statusColor[p.status] || '#6b7280', fontWeight: 700 }}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tenants */}
        {tab === 'tenants' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Add / update a tenant</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="Email *" type="email" style={input} />
                <input value={tenantForm.firstName} onChange={(e) => setTenantForm({ ...tenantForm, firstName: e.target.value })} placeholder="First name" style={input} />
                <input value={tenantForm.lastName} onChange={(e) => setTenantForm({ ...tenantForm, lastName: e.target.value })} placeholder="Last name" style={input} />
                <input value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} placeholder="Phone" style={input} />
              </div>
              <button onClick={addTenant} style={{ ...btnPrimary, marginTop: 10 }}>Save tenant</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {dash!.tenants.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>No tenants yet. Add one above or screen a tenant first.</p>}
              {dash!.tenants.map((t) => (
                <div key={t.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{t.firstName || ''} {t.lastName || ''} <span style={{ color: '#888', fontWeight: 400, fontSize: 12 }}>{t.email}</span></div>
                    <div style={{ fontSize: 12, color: '#888' }}>{t.totalStays} stays · {t.totalDisputes} disputes</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {t.riskBand && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: `${riskColor[t.riskBand] || '#6b7280'}1a`, color: riskColor[t.riskBand] || '#6b7280', fontWeight: 700 }}>{t.riskBand}</span>}
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{t.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Screening */}
        {tab === 'screen' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Screen a tenant</div>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                Run a US court (CourtListener) or PK background check. Risk band sets the recommended deposit surcharge.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={screenForm.tenantEmail} onChange={(e) => setScreenForm({ ...screenForm, tenantEmail: e.target.value })} placeholder="Tenant email *" type="email" style={input} />
                <input value={screenForm.tenantName} onChange={(e) => setScreenForm({ ...screenForm, tenantName: e.target.value })} placeholder="Tenant name" style={input} />
                <select value={screenForm.band} onChange={(e) => setScreenForm({ ...screenForm, band: e.target.value })} style={input}>
                  <option value="LOW">LOW risk</option>
                  <option value="MEDIUM">MEDIUM risk</option>
                  <option value="HIGH">HIGH risk</option>
                </select>
                <select value={screenForm.source} onChange={(e) => setScreenForm({ ...screenForm, source: e.target.value })} style={input}>
                  <option value="MANUAL">Manual</option>
                  <option value="COURTLISTENER">US CourtListener</option>
                  <option value="BACKGROUND_CHECK">PK BackgroundCheck</option>
                </select>
              </div>
              <button onClick={screenTenant} style={{ ...btnPrimary, marginTop: 10 }}>Run screening</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {dash!.screenings.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>No screenings yet.</p>}
              {dash!.screenings.map((sc) => (
                <div key={sc.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{sc.tenantName || sc.tenantEmail}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{sc.source} · {new Date(sc.screenedAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: `${riskColor[sc.band] || '#6b7280'}1a`, color: riskColor[sc.band] || '#6b7280', fontWeight: 700 }}>{sc.band}</span>
                    {sc.depositAdjPct > 0 && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>+{sc.depositAdjPct}% deposit</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* White-label portal */}
        {tab === 'portal' && (
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Your white-label tenant portal</div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
              Tenants visit this link to see your available listings and book through your brand.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={portalUrl} style={input} />
              <button onClick={() => navigator.clipboard?.writeText(portalUrl)} style={btnGhost}>Copy</button>
            </div>
            <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700 }}>Branding</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: '#888' }}>Company name</label>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{dash!.profile.companyName || '—'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#888' }}>Brand color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: dash!.profile.brandColor || '#6366f1', border: '1px solid #ddd' }} />
                  <span style={{ fontSize: 14 }}>{dash!.profile.brandColor || '#6366f1'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div style={card}>
    <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 900, color: color || '#0a0a0a', marginTop: 4 }}>{value}</div>
  </div>
);

const input: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box',
};
const page: React.CSSProperties = {
  minHeight: '100vh', background: 'radial-gradient(800px 400px at 50% -10%, rgba(99,102,241,0.15), transparent 60%), #020617',
  color: 'var(--foreground)', padding: '32px 20px',
};
const card: React.CSSProperties = {
  background: '#fff', color: '#0a0a0a', borderRadius: 14, padding: 18,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)', border: '1px solid rgba(139,92,246,0.15)',
};
const btnPrimary: React.CSSProperties = {
  padding: '11px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
  border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};

export default PropertyManagerPage;
