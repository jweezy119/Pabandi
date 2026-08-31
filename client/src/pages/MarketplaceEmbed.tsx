import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { marketplaceService } from '../services/api';

const SITE = 'https://pabandi.com';

type Sale = {
  saleId: string;
  status: 'VERIFIED' | 'FUNDED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  amount: number;
  currency: string;
  itemTitle?: string | null;
  sellerEmail?: string;
  buyerEmail?: string | null;
  simulated: boolean;
};

const wrap: React.CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  background: '#fff',
  color: '#0a0a0a',
  padding: 16,
  borderRadius: 14,
  border: '1px solid #e5e7eb',
  boxShadow: '0 6px 24px rgba(0,0,0,0.10)',
  width: 320,
  maxWidth: '100%',
  boxSizing: 'border-box',
};

// Chrome-free embed for marketplaces. Two modes:
//   1) Seller opens a sale:  /embed/marketplace?code=PARTNER&amount=350&item=Used%20Sofa
//   2) Buyer completes a sale the seller shared:  /embed/marketplace?sale=SALE_ID
// Drop mode 1 on a listing; the seller sends the returned secure link (mode 2) to the buyer.
const MarketplaceEmbed: React.FC = () => {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const saleParam = params.get('sale');

  // Seller-open state
  const [amount, setAmount] = useState(params.get('amount') || '');
  const [item, setItem] = useState(params.get('item') || '');
  const [email, setEmail] = useState('');
  const [secureLink, setSecureLink] = useState('');

  // Shared-sale (buyer/seller) state
  const [sale, setSale] = useState<Sale | null>(null);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [mode, setMode] = useState<'open' | 'sale'>('open');

  useEffect(() => {
    if (saleParam) {
      setMode('sale');
      marketplaceService.getLocalSale(saleParam)
        .then((r) => setSale(r.data?.data))
        .catch(() => setMsg('This secured sale link is invalid or expired.'));
    }
  }, [saleParam]);

  const open = async () => {
    setBusy(true); setMsg('');
    try {
      const res = await marketplaceService.openLocalSale({
        referralCode: code || undefined,
        listingUrl: params.get('listing') || undefined,
        itemTitle: item || undefined,
        amount: Number(amount),
        sellerEmail: email,
      });
      const d = res.data?.data || {};
      setSecureLink(d.secureLink || `${SITE}/embed/marketplace?sale=${d.saleId}`);
      setMsg('');
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Could not open secured sale');
    } finally { setBusy(false); }
  };

  const fund = async () => {
    if (!sale) return;
    setBusy(true); setMsg('');
    try {
      await marketplaceService.fundLocalSale(sale.saleId, buyerEmail);
      const r = await marketplaceService.getLocalSale(sale.saleId);
      setSale(r.data?.data);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Could not fund escrow');
    } finally { setBusy(false); }
  };

  const release = async () => {
    if (!sale) return;
    setBusy(true); setMsg('');
    try {
      await marketplaceService.releaseLocalSale(sale.saleId);
      const r = await marketplaceService.getLocalSale(sale.saleId);
      setSale(r.data?.data);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Could not release escrow');
    } finally { setBusy(false); }
  };

  const money = (n: number, c: string) => `${c} ${Number(n).toLocaleString()}`;

  // ---- Mode 1: seller opens a sale ----
  if (mode === 'open') {
    if (secureLink) {
      return (
        <div style={wrap}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a', marginBottom: 6 }}>
            ✓ Sale secured by Pabandi
          </div>
          <p style={{ fontSize: 12, color: '#444', margin: '0 0 10px' }}>
            Send this link to your buyer. Funds are held in escrow and released only after the
            in-person exchange. Neither of you can be robbed or ghosted.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={secureLink}
              style={{ flex: 1, fontSize: 11, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, minWidth: 0 }} />
            <button onClick={() => navigator.clipboard?.writeText(secureLink)}
              style={{ background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Copy
            </button>
          </div>
        </div>
      );
    }
    return (
      <div style={wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>P</div>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Sell this safely with Pabandi</div>
        </div>
        <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 3 }}>What are you selling?</label>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Used sofa"
          style={input} />
        <label style={{ fontSize: 11, color: '#666', display: 'block', margin: '8px 0 3px' }}>Sale price (USD)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" placeholder="350"
          style={input} />
        <label style={{ fontSize: 11, color: '#666', display: 'block', margin: '8px 0 3px' }}>Your email (to receive funds)</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com"
          style={input} />
        {msg && <div style={{ fontSize: 12, color: '#dc2626', margin: '8px 0' }}>{msg}</div>}
        <button onClick={open} disabled={busy || !amount || !email}
          style={btn}>
          {busy ? 'Securing…' : 'Secure this sale'}
        </button>
        <div style={{ fontSize: 10, color: '#999', marginTop: 8, textAlign: 'center' }}>Escrow-backed · ID-verified · no scams</div>
      </div>
    );
  }

  // ---- Mode 2: shared sale (buyer funds, then either confirms meetup) ----
  if (!sale) {
    return (
      <div style={wrap}>
        <p style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>{msg || 'Loading secured sale…'}</p>
      </div>
    );
  }

  const isBuyer = sale.status === 'VERIFIED';
  const isFunded = sale.status === 'FUNDED';
  const isDone = sale.status === 'COMPLETED';

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>P</div>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Pabandi-secured sale</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#0a0a0a' }}>{money(sale.amount, sale.currency)}</div>
      {sale.itemTitle && <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{sale.itemTitle}</div>}

      <div style={{ fontSize: 11, color: '#888', margin: '6px 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Status: {sale.status}
        {sale.simulated ? ' · simulated' : ''}
      </div>

      {isDone ? (
        <div style={{ fontSize: 13, fontWeight: 800, color: '#16a34a', textAlign: 'center', padding: '10px 0' }}>
          ✓ Exchange complete — funds released to the seller. Stay safe!
        </div>
      ) : isFunded ? (
        <button onClick={release} disabled={busy} style={btn}>
          {busy ? 'Releasing…' : '✓ We met — release funds'}
        </button>
      ) : isBuyer ? (
        <>
          <p style={{ fontSize: 12, color: '#444', margin: '0 0 8px' }}>
            Your money is locked in Pabandi escrow the moment you fund. Meet the seller in person,
            inspect the item, then tap release. No scams, no robberies.
          </p>
          <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 3 }}>Your email</label>
          <input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} type="email" placeholder="buyer@email.com" style={input} />
          {msg && <div style={{ fontSize: 12, color: '#dc2626', margin: '8px 0' }}>{msg}</div>}
          <button onClick={fund} disabled={busy || !buyerEmail} style={btn}>
            {busy ? 'Funding…' : `Fund ${money(sale.amount, sale.currency)} in escrow`}
          </button>
        </>
      ) : null}

      <div style={{ fontSize: 10, color: '#999', marginTop: 8, textAlign: 'center' }}>
        Protected by Pabandi · Commitment, Secured.
      </div>
    </div>
  );
};

const input: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8,
  marginBottom: 0, boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  width: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none',
  borderRadius: 10, padding: '11px', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 6,
};

export default MarketplaceEmbed;
