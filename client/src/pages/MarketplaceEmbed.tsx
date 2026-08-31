import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { marketplaceService } from '../services/api';

const SITE = 'https://pabandi.com';

// Chrome-free embed for marketplaces. Drop on a listing:
//   <iframe src="https://pabandi.com/embed/marketplace?code=PARTNERCODE&amount=350&item=Used%20Sofa" />
// A seller opens a Pabandi-secured sale; the buyer then completes via the returned secure link.
// No nav, no layout — safe to mount inside any third-party page.
const MarketplaceEmbed: React.FC = () => {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const presetAmount = params.get('amount') || '';
  const presetItem = params.get('item') || '';

  const [amount, setAmount] = useState(presetAmount);
  const [item, setItem] = useState(presetItem);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [secureLink, setSecureLink] = useState('');

  const open = async () => {
    setStatus('working');
    setMsg('');
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
      setStatus('done');
    } catch (e: any) {
      setStatus('error');
      setMsg(e?.response?.data?.error || 'Could not open secured sale');
    }
  };

  const wrap: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#fff',
    color: '#0a0a0a',
    padding: 16,
    borderRadius: 14,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 24px rgba(0,0,0,0.10)',
    width: 300,
    maxWidth: '100%',
    boxSizing: 'border-box',
  };

  if (status === 'done') {
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
          <input
            readOnly
            value={secureLink}
            style={{ flex: 1, fontSize: 11, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, minWidth: 0 }}
          />
          <button
            onClick={() => navigator.clipboard?.writeText(secureLink)}
            style={{ background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
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
      <input
        value={item}
        onChange={(e) => setItem(e.target.value)}
        placeholder="e.g. Used sofa"
        style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box' }}
      />

      <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 3 }}>Sale price (USD)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        min="1"
        placeholder="350"
        style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box' }}
      />

      <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 3 }}>Your email (to receive funds)</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="you@email.com"
        style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }}
      />

      {status === 'error' && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{msg}</div>}

      <button
        onClick={open}
        disabled={status === 'working' || !amount || !email}
        style={{ width: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 700, fontSize: 13, cursor: status === 'working' ? 'wait' : 'pointer' }}
      >
        {status === 'working' ? 'Securing…' : 'Secure this sale'}
      </button>
      <div style={{ fontSize: 10, color: '#999', marginTop: 8, textAlign: 'center' }}>
        Escrow-backed · ID-verified · no scams
      </div>
    </div>
  );
};

export default MarketplaceEmbed;
