import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { propertyManagerService } from '../services/api';

type PortalData = {
  companyName?: string | null;
  slug: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  activeListings: number;
  vacantListings: Array<{
    id: string;
    title: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    bedrooms: number;
    bathrooms: number;
    rentAmount?: number | null;
    rentPeriod: string;
  }>;
};

export const TenantPortalPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    propertyManagerService.portal(slug)
      .then((r) => setPortal(r.data?.data))
      .catch(() => setErr('This portal is not available.'));
  }, [slug]);

  const brand = portal?.brandColor || '#6366f1';

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

  return (
    <div style={page}>
      <div style={{ maxWidth: 700, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {portal.logoUrl && <img src={portal.logoUrl} alt="" style={{ height: 48, marginBottom: 10 }} />}
          <h1 style={{ fontSize: 28, fontWeight: 900, color: brand }}>{portal.companyName || 'Property Manager'}</h1>
          {portal.tagline && <p style={{ color: '#888', marginTop: 6 }}>{portal.tagline}</p>}
          <p style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
            Listings secured by Pabandi — book with escrow-backed deposits and $PAB rewards.
          </p>
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
          {portal.activeListings} available {portal.activeListings === 1 ? 'listing' : 'listings'}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {portal.vacantListings.length === 0 && (
            <div style={card}><p style={{ color: '#888' }}>No listings available right now. Check back soon.</p></div>
          )}
          {portal.vacantListings.map((l) => (
            <div key={l.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{l.title}</div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {l.address}{l.city ? `, ${l.city}` : ''}{l.state ? ` ${l.state}` : ''} · {l.bedrooms}bd/{l.bathrooms}ba
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {l.rentAmount && <div style={{ fontSize: 18, fontWeight: 900, color: brand }}>${l.rentAmount}<span style={{ fontSize: 12, color: '#888' }}>/{l.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</span></div>}
                <a href={`mailto:?subject=Rental inquiry: ${l.title}`}
                  style={{ display: 'inline-block', marginTop: 6, padding: '7px 14px', borderRadius: 8, background: `linear-gradient(135deg,${brand},#8b5cf6)`, color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                  Inquire
                </a>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: '#888', fontSize: 11, marginTop: 32 }}>
          Powered by Pabandi — Commitment, Secured.
        </p>
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

export default TenantPortalPage;
