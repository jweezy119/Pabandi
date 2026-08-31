import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { marketplaceService } from '../services/api';

type Sale = {
  saleId: string;
  status: string;
  amount: number;
  currency: string;
  itemTitle?: string | null;
  sellerEmail?: string;
  buyerEmail?: string | null;
  simulated: boolean;
};

const statusCopy: Record<string, { label: string; color: string; note: string }> = {
  VERIFIED: { label: 'Secured — awaiting buyer', color: '#6366f1', note: 'Send the secure link below to your buyer so they can fund the escrow.' },
  FUNDED: { label: 'Funded — meet in person', color: '#f59e0b', note: 'The buyer has locked funds in escrow. Meet safely, then release once the exchange is done.' },
  COMPLETED: { label: 'Completed', color: '#16a34a', note: 'Funds released to you. Thank you for selling safely.' },
  CANCELLED: { label: 'Cancelled', color: '#6b7280', note: 'This sale was cancelled.' },
  DISPUTED: { label: 'Disputed', color: '#dc2626', note: 'A dispute is open on this sale.' },
};

export const SalePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => {
    marketplaceService.getLocalSale(id)
      .then((r) => setSale(r.data?.data))
      .catch((e) => setErr(e?.response?.data?.error || 'Sale not found'));
  };

  useEffect(load, [id]);

  const release = async () => {
    setBusy(true);
    try {
      await marketplaceService.releaseLocalSale(id);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not release');
    } finally { setBusy(false); }
  };

  const secureLink = `${window.location.origin}/embed/marketplace?sale=${id}`;

  if (err) {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Sale not found</h1>
          <p style={{ color: '#888' }}>{err}</p>
        </div>
      </div>
    );
  }
  if (!sale) return <div style={page}><div style={card}><p style={{ color: '#888' }}>Loading…</p></div></div>;

  const sc = statusCopy[sale.status] || statusCopy.VERIFIED;
  const money = `${sale.currency} ${Number(sale.amount).toLocaleString()}`;

  return (
    <div style={page}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>P</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Your secured sale</div>
            <div style={{ fontSize: 12, color: '#888' }}>Pabandi — Commitment, Secured.</div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{money}</div>
          {sale.itemTitle && <div style={{ color: '#666' }}>{sale.itemTitle}</div>}
        </div>

        <div style={{ marginTop: 14, display: 'inline-block', padding: '6px 12px', borderRadius: 999, background: `${sc.color}1a`, color: sc.color, fontWeight: 700, fontSize: 13 }}>
          {sc.label}
        </div>
        <p style={{ color: '#555', fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{sc.note}</p>

        {(sale.status === 'VERIFIED') && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Secure link for your buyer</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={secureLink}
                style={{ flex: 1, fontSize: 12, padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, minWidth: 0 }} />
              <button onClick={() => { navigator.clipboard?.writeText(secureLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={btnGhost}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>Send this to your buyer. They fund the escrow from it; you never handle their payment directly.</p>
          </div>
        )}

        {sale.status === 'FUNDED' && (
          <button onClick={release} disabled={busy} style={btnPrimary}>
            {busy ? 'Releasing…' : '✓ We met — release funds to me'}
          </button>
        )}

        {sale.simulated && (
          <p style={{ fontSize: 11, color: '#999', marginTop: 14 }}>Demo mode: escrow is simulated (no real on-chain transaction).</p>
        )}
      </div>
    </div>
  );
};

const page: React.CSSProperties = {
  minHeight: '100vh', background: 'radial-gradient(800px 400px at 50% -10%, rgba(99,102,241,0.15), transparent 60%), #020617',
  color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 430, background: '#fff', color: '#0a0a0a', borderRadius: 18, padding: 26,
  boxShadow: '0 20px 60px rgba(0,0,0,0.35)', border: '1px solid rgba(139,92,246,0.2)',
};
const btnPrimary: React.CSSProperties = {
  marginTop: 18, width: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
  border: 'none', borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 14, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};

export default SalePage;
