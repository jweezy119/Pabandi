import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { trustPassportService } from '../services/api';

const bandColor: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444',
};

const SITE = 'https://pabandi.com';

/**
 * Standalone, chrome-free embeddable badge. Rendered at /badge/:handle and
 * embedded by providers on their own sites via an iframe. No layout, no nav.
 */
export default function TrustBadgeEmbed() {
  const { handle } = useParams<{ handle: string }>();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!handle) return;
    trustPassportService.getPublic(handle)
      .then((r) => setData(r.data?.data))
      .catch((e) => setErr(e.response?.data?.error || e.message));
  }, [handle]);

  if (err) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#ef4444', padding: '8px 12px', border: '1px solid #ef444433', borderRadius: 10, display: 'inline-block', background: '#fff' }}>
        Unverified
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#888', padding: '8px 12px', border: '1px solid #eee', borderRadius: 10, display: 'inline-block', background: '#fff' }}>
        Loading…
      </div>
    );
  }

  const band = data.trust?.trustBand || 'D';
  const bc = data.backgroundCheck;
  const prot = data.protections || {};
  const verified = bc?.recommendation === 'PASS';

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: '#fff', border: `1px solid ${bandColor[band]}55`, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', maxWidth: 280 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: bandColor[band], color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
        {band}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {data.displayName}
        </div>
        <div style={{ fontSize: 11, color: verified ? '#16a34a' : '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{verified ? '✓ Pabandi Verified' : 'Unverified'}</span>
          {(prot.activeBonds > 0 || prot.activeDeposits > 0) && (
            <span style={{ color: '#666' }}>· ${Math.round((prot.totalBondedUSD || 0) + (prot.totalDepositsUSD || 0)).toLocaleString()} backed</span>
          )}
        </div>
      </div>
      <a href={`${SITE}/trust/${handle}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#fff', background: '#0a0a0a', padding: '4px 8px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>
        View
      </a>
    </div>
  );
}
