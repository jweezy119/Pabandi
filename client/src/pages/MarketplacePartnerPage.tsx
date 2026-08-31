import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { referralService } from '../services/api';

const features = [
  {
    icon: '🛡️',
    title: 'No more robberies or ghosts',
    body: 'Buyers and sellers meet verified. Funds sit in escrow until the exchange actually happens — so nobody gets robbed at the meetup or ghosted after paying.',
  },
  {
    icon: '⚡',
    title: 'One-line integration',
    body: 'Drop our iframe on any listing. No SDK, no backend. Your users get a "Sell this safely" button that opens a Pabandi-secured sale.',
  },
  {
    icon: '💸',
    title: 'You earn on every secured sale',
    body: 'Marketplaces and power-sellers join our referral program and earn a share of the platform fee on every deal routed through Pabandi escrow.',
  },
  {
    icon: '🌍',
    title: 'US + Pakistan trust rails',
    body: 'CourtListener court screening in the US and BackgroundCheck KYC in Pakistan — the counterparty is vetted before the meetup, not after.',
  },
];

const steps = [
  'Paste the embed snippet on your listing or profile.',
  'A seller opens a secured sale — funds locked in escrow.',
  'Buyer completes the secure link and meets verified.',
  'Exchange happens, escrow releases, everyone’s safe. You earn.',
];

export const MarketplacePartnerPage: React.FC = () => {
  const navigate = useNavigate();
  const [enrolling, setEnrolling] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const embedSnippet =
    '<iframe src="https://pabandi.com/embed/marketplace?code=YOURCODE&amount=350&item=Used%20Sofa" width="300" height="340" frameborder="0" style="border:0;border-radius:14px;"></iframe>';

  const becomePartner = async () => {
    setEnrolling(true);
    setErr('');
    try {
      await referralService.enroll();
      setDone(true);
    } catch (e: any) {
      // If already a partner, that's fine — go to the dashboard.
      if (e?.response?.status === 400) {
        navigate('/refer');
        return;
      }
      setErr(e?.response?.data?.error || 'Could not enroll. Try signing in first.');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.16), transparent 60%), #020617',
        color: 'var(--foreground)',
        padding: '64px 20px',
      }}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#a78bfa', textTransform: 'uppercase' }}>
            For marketplaces & power-sellers
          </div>
          <h1
            style={{
              fontSize: 'clamp(30px, 5vw, 50px)',
              fontWeight: 900,
              marginTop: 14,
              lineHeight: 1.08,
              background: 'linear-gradient(135deg,#818cf8,#c4b5fd)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Make every local sale safe — without building a trust & escrow stack
          </h1>
          <p style={{ color: 'var(--muted-foreground)', marginTop: 16, fontSize: 17, lineHeight: 1.6 }}>
            Facebook Marketplace, OfferUp, Craigslist, Nextdoor — you already own discovery. Pabandi is
            the <strong style={{ color: 'var(--foreground)' }}>trust layer</strong> you bolt on: identity verification,
            court/KYC screening, and Solana escrow so a seller parting with their valuables never gets robbed.
          </p>

          <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {done ? (
              <a
                href="/refer"
                style={{ padding: '14px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, textDecoration: 'none', fontSize: 15 }}
              >
                Go to your partner dashboard →
              </a>
            ) : (
              <button
                onClick={becomePartner}
                disabled={enrolling}
                style={{ padding: '14px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 15, border: 'none', cursor: enrolling ? 'wait' : 'pointer' }}
              >
                {enrolling ? 'Setting you up…' : 'Become a partner — it’s free'}
              </button>
            )}
            <a
              href="/embed/marketplace?code=DEMO&amount=350&item=Used%20Sofa"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '14px 28px', borderRadius: 12, border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}
            >
              See the widget live
            </a>
          </div>
          {err && <p style={{ color: '#f87171', marginTop: 12, fontSize: 14 }}>{err}</p>}
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginTop: 56 }}>
          {features.map((f) => (
            <div key={f.title} style={{ border: '1px solid rgba(139,92,246,0.2)', borderRadius: 18, padding: 22, background: 'rgba(99,102,241,0.05)' }}>
              <div style={{ fontSize: 30 }}>{f.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 10 }}>{f.title}</div>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>{f.body}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }}>How it works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 22 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <p style={{ color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>{s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Embed snippet */}
        <div style={{ marginTop: 56, border: '1px solid rgba(139,92,246,0.2)', borderRadius: 18, padding: 24, background: 'rgba(2,6,23,0.6)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Drop this on any listing</h3>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: 6 }}>
            Replace <code style={{ color: '#a78bfa' }}>YOURCODE</code> with your partner code after you enroll. That’s the whole integration.
          </p>
          <pre style={{ background: '#0b1020', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, padding: 16, overflowX: 'auto', fontSize: 12.5, color: '#c4b5fd', marginTop: 12, whiteSpace: 'pre-wrap' }}>
            {embedSnippet}
          </pre>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, marginTop: 48 }}>
          Pabandi — Commitment, Secured. Protecting the people who have the most to lose.
        </p>
      </div>
    </div>
  );
};

export default MarketplacePartnerPage;
