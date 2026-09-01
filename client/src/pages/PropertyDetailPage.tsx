import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Surface, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

type Unit = { id: string; unitNumber: string; bedrooms: number; bathrooms: number; sqft?: number | null; rentAmount?: number | null; status: string; };
type Tenant = { id: string; email: string; firstName?: string | null; lastName?: string | null; status: string; riskBand?: string | null; };
type Payment = { id: string; tenantEmail: string; amount: number; dueDate: string; status: string; };
type Financial = { id: string; type: string; category: string; amount: number; description?: string | null; date: string; };

export const PropertyDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [property, setProperty] = useState<any>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [financials, setFinancials] = useState<Financial[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [tab, setTab] = useState<'overview' | 'units' | 'tenants' | 'financials'>('overview');
  const [err, setErr] = useState('');

  useEffect(() => {
    propertyManagerService.dashboard().then((r) => {
      const props = r.data?.data?.properties || [];
      const found = props.find((p: any) => p.id === id);
      setProperty(found);
    }).catch((e) => setErr(e?.response?.data?.error || 'Could not load property'));

    propertyManagerService.units(id).then((r) => setUnits(r.data?.data || [])).catch(() => {});
    propertyManagerService.rentPayments(id).then((r) => setPayments(r.data?.data || [])).catch(() => {});
    propertyManagerService.financials(id).then((r) => setFinancials(r.data?.data || [])).catch(() => {});
    propertyManagerService.financialSummary(id).then((r) => setSummary(r.data?.data || null)).catch(() => {});
  }, [id]);

  if (err) return <div style={page}><div style={{ ...card, textAlign: 'center' }}><p style={{ color: '#888' }}>{err}</p></div></div>;
  if (!property) return <div style={page}><div style={card}><p style={{ color: '#888' }}>Loading…</p></div></div>;

  return (
    <div style={page}>
      <div style={{ maxWidth: 900, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <Link to="/property-manager" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← Back to CRM</Link>
          <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{property.title}</h1>
          <p style={{ fontSize: 13, color: '#888' }}>{property.address}{property.city ? `, ${property.city}` : ''}{property.state ? ` ${property.state}` : ''}</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
          {(['overview', 'units', 'tenants', 'financials'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 16px', borderRadius: 8, border: tab === t ? '2px solid #6366f1' : '1px solid rgba(139,92,246,0.3)', background: tab === t ? '#eef2ff' : 'transparent', color: tab === t ? '#6366f1' : '#888', fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{units.length}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Units</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-emerald-300">{units.filter((u) => u.status === 'OCCUPIED').length}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Occupied</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-indigo-300">{units.filter((u) => u.status === 'VACANT').length}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Vacant</div></Surface>
            <Surface className="text-center"><div className="text-2xl font-bold text-slate-100">{payments.filter((p) => p.status === 'PENDING').length}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Pending payments</div></Surface>
            {summary && (
              <>
                <Surface className="text-center"><div className="text-2xl font-bold text-emerald-300">${summary.income?.toLocaleString()}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Income</div></Surface>
                <Surface className="text-center"><div className="text-2xl font-bold text-rose-300">${summary.expenses?.toLocaleString()}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Expenses</div></Surface>
                <Surface className="text-center col-span-2"><div className="text-2xl font-bold text-indigo-300">${summary.noi?.toLocaleString()}</div><div className="text-xs mt-1" style={{ color: tokens.color.muted }}>Net Operating Income</div></Surface>
              </>
            )}
          </div>
        )}

        {/* Units */}
        {tab === 'units' && (
          <div className="space-y-2">
            {units.length === 0 && <p style={{ color: '#888' }}>No units yet.</p>}
            {units.map((u) => (
              <Surface key={u.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-100">Unit {u.unitNumber}</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>{u.bedrooms}bd/{u.bathrooms}ba{u.sqft ? ` · ${u.sqft}sqft` : ''}</div>
                </div>
                <div className="text-right">
                  {u.rentAmount && <div className="font-bold text-slate-100">${u.rentAmount}/mo</div>}
                  <Badge tone={u.status === 'VACANT' ? 'info' : u.status === 'OCCUPIED' ? 'success' : 'warning'}>{u.status}</Badge>
                </div>
              </Surface>
            ))}
          </div>
        )}

        {/* Tenants */}
        {tab === 'tenants' && (
          <div className="space-y-2">
            {tenants.length === 0 && <p style={{ color: '#888' }}>No tenants yet.</p>}
            {tenants.map((t) => (
              <Surface key={t.id} className="flex items-center justify-between">
                <div><div className="font-semibold text-slate-100">{t.firstName || ''} {t.lastName || t.email}</div></div>
                <div className="text-right">
                  {t.riskBand && <Badge tone={t.riskBand === 'HIGH' ? 'danger' : t.riskBand === 'MEDIUM' ? 'warning' : 'success'}>{t.riskBand}</Badge>}
                  <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{t.status}</div>
                </div>
              </Surface>
            ))}
          </div>
        )}

        {/* Financials */}
        {tab === 'financials' && (
          <div className="space-y-2">
            {financials.length === 0 && <p style={{ color: '#888' }}>No financial records yet.</p>}
            {financials.map((f) => (
              <Surface key={f.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-100">{f.category}</div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>{f.description || '—'}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${f.type === 'INCOME' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {f.type === 'INCOME' ? '+' : '-'}${f.amount.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(f.date).toLocaleDateString()}</div>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const page: React.CSSProperties = {
  minHeight: '100vh', background: 'radial-gradient(800px 400px at 50% -10%, rgba(99,102,241,0.12), transparent 60%), #020617',
  color: 'var(--foreground)', padding: '40px 20px',
};
const card: React.CSSProperties = {
  background: '#fff', color: '#0a0a0a', borderRadius: 14, padding: 18,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)', border: '1px solid rgba(139,92,246,0.15)',
};

export default PropertyDetailPage;
