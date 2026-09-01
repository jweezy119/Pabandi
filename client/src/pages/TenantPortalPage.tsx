import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tenantService } from '../services/api';

type Listing = {
  id: string;
  title: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  bedrooms: number;
  bathrooms: number;
  rentAmount?: number | null;
  rentPeriod: string;
};

type PortalData = {
  companyName?: string | null;
  slug: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  listings: Listing[];
};

export const TenantPortalPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [err, setErr] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [applyForm, setApplyForm] = useState({ email: '', firstName: '', lastName: '', phone: '', message: '', desiredMoveIn: '', monthlyIncome: '' });
  const [applyStatus, setApplyStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [applyMsg, setApplyMsg] = useState('');

  const load = () => {
    tenantService.portal(slug)
      .then((r) => setPortal(r.data?.data))
      .catch(() => setErr('This portal is not available.'));
  };
  useEffect(load, [slug]);

  const apply = async () => {
    if (!applyForm.email) return;
    setApplyStatus('working');
    try {
      const res = await tenantService.apply({
        slug,
        propertyId: selectedProperty || undefined,
        ...applyForm,
        monthlyIncome: applyForm.monthlyIncome ? Number(applyForm.monthlyIncome) : undefined,
      });
      setApplyStatus('done');
      setApplyMsg(res.data?.message || 'Application submitted!');
      setApplyForm({ email: '', firstName: '', lastName: '', phone: '', message: '', desiredMoveIn: '', monthlyIncome: '' });
    } catch (e: any) {
      setApplyStatus('error');
      setApplyMsg(e?.response?.data?.error || 'Could not submit application');
    }
  };

  if (err) {
    return (
      <div style={page}>
        <div style={{ ...card, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Portal not found</h1>
          <p style={{ color: '#888' }}>{err}</p>
        </div>
      </div>
    );
  }
  if (!portal) return <div style={page}><div style={card}><p style={{ color: '#888' }}>Loading…</p></div></div>;

  const brand = portal.brandColor || '#6366f1';

  return (
    <div style={page}>
      <div style={{ maxWidth: 800, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {portal.logoUrl && <img src={portal.logoUrl} alt="" style={{ height: 48, marginBottom: 10 }} />}
          <h1 style={{ fontSize: 28, fontWeight: 900, color: brand }}>{portal.companyName || 'Property Manager'}</h1>
          {portal.tagline && <p style={{ color: '#888', marginTop: 6 }}>{portal.tagline}</p>}
          <p style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
            Listings secured by Pabandi — apply with escrow-backed deposits and $PAB rewards.
          </p>
        </div>

        {/* Application form */}
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📝 Apply for a rental</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Fill out the form below. The manager will review and run a background check.</p>

          {applyStatus === 'done' ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, fontSize: 14, color: '#166534' }}>
              ✅ {applyMsg}
            </div>
          ) : (
            <>
              {selectedProperty && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#eef2ff', fontSize: 13, color: '#4338ca' }}>
                  Applying to: <strong>{portal.listings.find((l) => l.id === selectedProperty)?.title}</strong>
                  <button onClick={() => setSelectedProperty(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>change</button>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={applyForm.email} onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })} placeholder="Email *" type="email" style={input} />
                <input value={applyForm.firstName} onChange={(e) => setApplyForm({ ...applyForm, firstName: e.target.value })} placeholder="First name" style={input} />
                <input value={applyForm.lastName} onChange={(e) => setApplyForm({ ...applyForm, lastName: e.target.value })} placeholder="Last name" style={input} />
                <input value={applyForm.phone} onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })} placeholder="Phone" style={input} />
                <input value={applyForm.desiredMoveIn} onChange={(e) => setApplyForm({ ...applyForm, desiredMoveIn: e.target.value })} type="date" style={input} />
                <input value={applyForm.monthlyIncome} onChange={(e) => setApplyForm({ ...applyForm, monthlyIncome: e.target.value })} placeholder="Monthly income (USD)" type="number" style={input} />
              </div>
              <textarea value={applyForm.message} onChange={(e) => setApplyForm({ ...applyForm, message: e.target.value })} placeholder="Tell the manager about yourself..." rows={3} style={{ ...input, marginTop: 8, resize: 'vertical' }} />
              {applyStatus === 'error' && <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626' }}>{applyMsg}</div>}
              <button onClick={apply} disabled={applyStatus === 'working' || !applyForm.email} style={{ ...btnPrimary, marginTop: 12, background: `linear-gradient(135deg,${brand},#8b5cf6)` }}>
                {applyStatus === 'working' ? 'Submitting…' : 'Submit application'}
              </button>
            </>
          )}
        </div>

        {/* Listings */}
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
          {portal.listings.length} available {portal.listings.length === 1 ? 'listing' : 'listings'}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {portal.listings.length === 0 && (
            <div style={card}><p style={{ color: '#888' }}>No listings available right now. Check back soon.</p></div>
          )}
          {portal.listings.map((l) => (
            <div key={l.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{l.title}</div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {l.address}{l.city ? `, ${l.city}` : ''}{l.state ? ` ${l.state}` : ''} · {l.bedrooms}bd/{l.bathrooms}ba
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {l.rentAmount && <div style={{ fontSize: 18, fontWeight: 900, color: brand }}>${l.rentAmount}<span style={{ fontSize: 12, color: '#888' }}>/{l.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</span></div>}
                <button onClick={() => { setSelectedProperty(l.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  style={{ marginTop: 6, padding: '7px 14px', borderRadius: 8, background: `linear-gradient(135deg,${brand},#8b5cf6)`, color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: '#888', fontSize: 11, marginTop: 32 }}>
          Powered by Pabandi — Commitment, Secured. · <Link to="/login" style={{ color: '#888' }}>Already applied? Track your application</Link>
        </p>
      </div>
    </div>
  );
};

const input: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box',
};
const page: React.CSSProperties = {
  minHeight: '100vh', background: 'radial-gradient(800px 400px at 50% -10%, rgba(99,102,241,0.12), transparent 60%), #020617',
  color: 'var(--foreground)', padding: '40px 20px',
};
const card: React.CSSProperties = {
  background: '#fff', color: '#0a0a0a', borderRadius: 14, padding: 18,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)', border: '1px solid rgba(139,92,246,0.15)',
};
const btnPrimary: React.CSSProperties = {
  padding: '11px 20px', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
};

export default TenantPortalPage;
