import { useState } from 'react';

const PASSPORT_MOCK = {
  "wallet_address": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs",
  "trust_score": 742,
  "score_tier": "Gold",
  "total_actions": 148,
  "punctuality_rate": 0.94,
  "completed_bookings": 139,
  "missed_bookings": 9,
  "disputes_lost": 1,
  "disputes_won": 2,
  "first_seen": "2025-08-12T00:00:00Z",
  "last_updated": "2026-06-20T18:32:00Z",
  "flags": [
    "repeat_no_show_resolved",
    "high_value_buyer"
  ]
};

const LIVE_SALE_CODE = `import express from 'express';
const app = express();

app.post('/live-sale/checkout', async (req, res) => {
  const { buyer_wallet } = req.body;

  const result = await fetch(
    'https://pabandi-42c5b.web.app/api/v1/passport/verify',
    {
      headers: {
        'Authorization': \`Bearer \${process.env.PABANDI_API_KEY}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wallet_address: buyer_wallet,
        required_tier: 'Gold'
      }),
      method: 'POST'
    }
  );

  const data = await result.json();

  if (data.status === 'eligible') {
    return res.json({ checkout_allowed: true, score: data.passport.trust_score });
  } else {
    return res.json({
      checkout_allowed: false,
      reason: 'Score below Gold tier',
      deposit_amount_pab: 500
    });
  }
});`;

function JsonViewer({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  const highlighted = json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'color:#a5f3fc'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'color:#c4b5fd'; // key
        } else {
          cls = 'color:#86efac'; // string
        }
      } else if (/true|false/.test(match)) {
        cls = 'color:#fbbf24'; // boolean
      } else if (/null/.test(match)) {
        cls = 'color:#f87171'; // null
      }
      return `<span style="${cls}">${match}</span>`;
    }
  );
  return (
    <pre
      dangerouslySetInnerHTML={{ __html: highlighted }}
      style={{
        fontSize: '13px',
        lineHeight: '1.6',
        overflowX: 'auto',
        margin: 0,
        color: '#e2e8f0',
        fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
      }}
    />
  );
}

export default function DeveloperPortalPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(LIVE_SALE_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ background: '#020617', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(129,140,248,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.3)',
            borderRadius: '20px', padding: '6px 16px', marginBottom: '28px',
            fontSize: '13px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.05em',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            PABANDI API
          </div>

          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1,
            marginBottom: '20px', letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #ffffff 0%, #818cf8 50%, #c084fc 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Reliability score as portable identity.
          </h1>

          <p style={{ fontSize: '20px', color: '#94a3b8', maxWidth: '600px', margin: '0 auto 20px', lineHeight: 1.4, fontWeight: 500 }}>
            One score. Every platform. Real behavior, not self-reported claims.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '40px' }}>
            <a href="mailto:team@pabandi.com" style={{
              padding: '14px 32px', borderRadius: '12px', fontWeight: 700, fontSize: '15px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', textDecoration: 'none', boxShadow: '0 0 30px rgba(99,102,241,0.4)',
              transition: 'all 0.2s',
            }}>
              Get API Key →
            </a>
            <div style={{
              padding: '14px 24px', borderRadius: '12px', fontWeight: 600, fontSize: '14px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#94a3b8',
            }}>
              v0.1 Beta · Free for partners
            </div>
          </div>
        </div>
      </section>

      {/* ── Overview & Problem ────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 60px', maxWidth: '900px', margin: '0 auto' }}>
        <p style={{ fontSize: '18px', color: '#e2e8f0', lineHeight: 1.8, marginBottom: '24px' }}>
          Pabandi is building a portable reliability layer for the global informal economy. If you run a platform where trust between strangers matters — live selling, wholesale markets, freelance gigs, rentals, clinic bookings — this API gives you that trust without building it from scratch.
        </p>
        <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: 1.7, marginBottom: '24px', paddingLeft: '20px', borderLeft: '4px solid #334155' }}>
          <strong>The problem today:</strong> Every live sale, wholesale order, and booking is secured by "bro trust" or advance payment. The informal economy bleeds 20–30% to no-pays and ghosting because there's no portable trust layer.
        </p>
        <p style={{ fontSize: '16px', color: '#818cf8', lineHeight: 1.7, paddingLeft: '20px', borderLeft: '4px solid #818cf8' }}>
          <strong>The Pabandi answer:</strong> Users build a Trust Score through real behavior (showing up, paying on time, completing bookings). That score becomes their Passport — a portable, on-chain reputation ID any platform can verify.
        </p>
      </section>

      {/* ── Use Cases ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '40px', letterSpacing: '-0.02em', textAlign: 'center' }}>
          Use Cases
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {[
            { icon: '🛍️', title: 'Live Selling', desc: 'Verify buyer score before allowing pay-on-delivery on Instagram/TikTok live drops.' },
            { icon: '🗓️', title: 'Booking Platforms', desc: 'Flag high-risk appointments before confirmation for salons, clinics, and drivers.' },
            { icon: '🤝', title: 'Marketplaces', desc: 'Weight bids by seller reliability. OLX-style local platforms can severely reduce fraud.' },
            { icon: '💻', title: 'Freelance Tools', desc: 'Port reputation from Pabandi into gig platforms. Better rates for better history.' },
            { icon: '🔐', title: 'Gated Access', desc: 'Require minimum score for premium or vetted community access.' },
          ].map((item) => (
            <div key={item.title} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px', padding: '24px', transition: 'transform 0.2s',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>{item.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px', color: '#f1f5f9' }}>{item.title}</h3>
              <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The Passport Object ───────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
          <div style={{ flex: '1 1 400px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', letterSpacing: '-0.02em' }}>
              The Passport Object
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '16px', lineHeight: 1.6, marginBottom: '32px' }}>
              Every verified Pabandi user has a Passport — a snapshot of their on-chain reliability history.
            </p>
            
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: '#f1f5f9' }}>Score Tiers</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px 8px', color: '#cbd5e1' }}>Tier</th>
                    <th style={{ padding: '12px 8px', color: '#cbd5e1' }}>Score</th>
                    <th style={{ padding: '12px 8px', color: '#cbd5e1' }}>Population</th>
                    <th style={{ padding: '12px 8px', color: '#cbd5e1' }}>Permission</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#e2e8f0' }}>Platinum</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>850–1000</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>Top 5%</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>No deposit, high-value Tx</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#fbbf24' }}>Gold</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>700–849</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>Reliable</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>COD / Live-sale allowed</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#94a3b8' }}>Silver</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>500–699</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>Proven track</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>Reduced deposit</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#b45309' }}>Bronze</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>300–499</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>Inconsistent</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>Standard deposit required</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#ef4444' }}>Unrated</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>&lt;300</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>—</td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>Deposit or prepay only</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ flex: '1 1 400px', background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', letterSpacing: '0.06em', marginBottom: '16px' }}>PASSPORT JSON</div>
            <JsonViewer data={PASSPORT_MOCK} />
          </div>
        </div>
      </section>

      {/* ── Endpoints ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', letterSpacing: '-0.02em' }}>
          Endpoints
        </h2>
        <div style={{ display: 'grid', gap: '20px' }}>
          
          {/* Verify */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: '6px', fontSize: '13px', fontWeight: 800 }}>POST</span>
              <code style={{ fontSize: '15px', color: '#c4b5fd', fontFamily: "'Fira Code', monospace" }}>/api/v1/passport/verify</code>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '16px' }}>Returns the full Passport object for a wallet address. Optionally enforce a minimum tier.</p>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px' }}>
              <JsonViewer data={{ "wallet_address": "68AQ...", "required_tier": "Gold" }} />
            </div>
          </div>

          {/* Eligibility */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: '6px', fontSize: '13px', fontWeight: 800 }}>POST</span>
              <code style={{ fontSize: '15px', color: '#c4b5fd', fontFamily: "'Fira Code', monospace" }}>/api/v1/passport/eligibility</code>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '16px' }}>Lightweight yes/no check. For high-traffic surfaces where you don't need the full Passport.</p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, background: '#0f172a', padding: '16px', borderRadius: '10px', minWidth: '200px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>REQUEST</div>
                <JsonViewer data={{ "wallet_address": "68AQ...", "required_tier": "Gold" }} />
              </div>
              <div style={{ flex: 1, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', padding: '16px', borderRadius: '10px', minWidth: '200px' }}>
                <div style={{ fontSize: '11px', color: '#22c55e', marginBottom: '8px', fontWeight: 700 }}>200 OK RESPONSE</div>
                <JsonViewer data={{ "status": "eligible", "score_tier": "Gold" }} />
              </div>
            </div>
          </div>

          {/* Incidents */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: '6px', fontSize: '13px', fontWeight: 800 }}>POST</span>
              <code style={{ fontSize: '15px', color: '#c4b5fd', fontFamily: "'Fira Code', monospace" }}>/api/v1/passport/incidents</code>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '16px' }}>Report a no-show, fraud, or dispute outcome. Requires platform auth.</p>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px' }}>
              <JsonViewer data={{
                "subject_wallet": "68AQ...",
                "incident_type": "no_show",
                "reference_id": "order_4532",
                "notes": "Buyer did not collect item from live sale.",
                "platform_id": "instagram_live_seller_xyz"
              }} />
            </div>
          </div>

          {/* Webhooks */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: '6px', fontSize: '13px', fontWeight: 800 }}>POST</span>
              <code style={{ fontSize: '15px', color: '#c4b5fd', fontFamily: "'Fira Code', monospace" }}>/api/v1/webhooks/subscribe</code>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '16px' }}>Get real-time score-change notifications for a wallet.</p>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px' }}>
              <JsonViewer data={{
                "wallet_address": "68AQ...",
                "callback_url": "https://yourplatform.com/api/pabandi-webhook",
                "events": ["score_changed", "tier_changed"]
              }} />
            </div>
          </div>

        </div>
      </section>

      {/* ── Live Sale Integration ─────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', letterSpacing: '-0.02em' }}>
          Live-Sale Integration Example
        </h2>
        <div style={{ background: '#0f172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>checkout.js</span>
            <button
              onClick={handleCopy}
              style={{
                padding: '6px 14px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', fontSize: '12px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ padding: '24px 28px', overflowX: 'auto' }}>
            <pre style={{ margin: 0, fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', fontFamily: "'Fira Code', 'JetBrains Mono', monospace" }}>
              <span style={{ color: '#c678dd' }}>import</span> express <span style={{ color: '#c678dd' }}>from</span> <span style={{ color: '#98c379' }}>'express'</span>;
              <br />
              <span style={{ color: '#c678dd' }}>const</span> app = <span style={{ color: '#61afef' }}>express</span>();
              <br /><br />
              app.<span style={{ color: '#61afef' }}>post</span>(<span style={{ color: '#98c379' }}>'/live-sale/checkout'</span>, <span style={{ color: '#c678dd' }}>async</span> (req, res) <span style={{ color: '#c678dd' }}>{'=>'}</span> {'{'}
              <br />
              {'  '}<span style={{ color: '#c678dd' }}>const</span> {'{'} buyer_wallet {'}'} = req.body;
              <br /><br />
              {'  '}<span style={{ color: '#c678dd' }}>const</span> result = <span style={{ color: '#c678dd' }}>await</span> <span style={{ color: '#61afef' }}>fetch</span>(
              <br />
              {'    '}<span style={{ color: '#98c379' }}>'https://api.pabandi.com/api/v1/passport/verify'</span>,
              <br />
              {'    {'}
              <br />
              {'      '}headers: {'{'}
              <br />
              {'        '}<span style={{ color: '#98c379' }}>'Authorization'</span>: <span style={{ color: '#98c379' }}>`Bearer \${process.env.PABANDI_API_KEY}`</span>,
              <br />
              {'        '}<span style={{ color: '#98c379' }}>'Content-Type'</span>: <span style={{ color: '#98c379' }}>'application/json'</span>
              <br />
              {'      }'},
              <br />
              {'      '}body: JSON.<span style={{ color: '#61afef' }}>stringify</span>({'{'}
              <br />
              {'        '}wallet_address: buyer_wallet,
              <br />
              {'        '}required_tier: <span style={{ color: '#98c379' }}>'Gold'</span>
              <br />
              {'      }'}),
              <br />
              {'      '}method: <span style={{ color: '#98c379' }}>'POST'</span>
              <br />
              {'    }'}
              <br />
              {'  '});
              <br /><br />
              {'  '}<span style={{ color: '#c678dd' }}>const</span> data = <span style={{ color: '#c678dd' }}>await</span> result.<span style={{ color: '#61afef' }}>json</span>();
              <br /><br />
              {'  '}<span style={{ color: '#c678dd' }}>if</span> (data.status === <span style={{ color: '#98c379' }}>'eligible'</span>) {'{'}
              <br />
              {'    '}<span style={{ color: '#c678dd' }}>return</span> res.<span style={{ color: '#61afef' }}>json</span>({'{'} checkout_allowed: <span style={{ color: '#d19a66' }}>true</span>, score: data.passport.trust_score {'}'});
              <br />
              {'  }'} <span style={{ color: '#c678dd' }}>else</span> {'{'}
              <br />
              {'    '}<span style={{ color: '#c678dd' }}>return</span> res.<span style={{ color: '#61afef' }}>json</span>({'{'}
              <br />
              {'      '}checkout_allowed: <span style={{ color: '#d19a66' }}>false</span>,
              <br />
              {'      '}reason: <span style={{ color: '#98c379' }}>'Score below Gold tier'</span>,
              <br />
              {'      '}deposit_amount_pab: <span style={{ color: '#d19a66' }}>500</span>
              <br />
              {'    }'});
              <br />
              {'  }'}
              <br />
              {'}'});
            </pre>
          </div>
        </div>
      </section>

      {/* ── FAQ & Pricing ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 24px 80px', maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        
        {/* FAQ */}
        <div style={{ flex: '1 1 400px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', letterSpacing: '-0.02em' }}>FAQ</h2>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>Is this KYC?</h3>
            <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>No. Pabandi is behavior-based, not identity-based. Users don't upload documents. Their score is built entirely from actions they've already taken (reservations, deposits, completions).</p>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>Is my user data private?</h3>
            <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>You receive only what the user explicitly shares — the Passport object. No private booking history, no deep wallet transactions.</p>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>How do I get an API key?</h3>
            <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Email <a href="mailto:team@pabandi.com" style={{ color: '#818cf8', textDecoration: 'none' }}>team@pabandi.com</a> with your platform name, expected volume, and use case. We are onboarding 10 beta partners for June 2026.</p>
          </div>
        </div>

        {/* Rate Limits / Pricing */}
        <div style={{ flex: '1 1 400px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', letterSpacing: '-0.02em' }}>Rate Limits</h2>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '16px', color: '#cbd5e1' }}>Plan</th>
                  <th style={{ padding: '16px', color: '#cbd5e1' }}>Requests/day</th>
                  <th style={{ padding: '16px', color: '#cbd5e1' }}>Webhooks</th>
                  <th style={{ padding: '16px', color: '#cbd5e1' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px', fontWeight: 700, color: '#e2e8f0' }}>Sandbox</td>
                  <td style={{ padding: '16px', color: '#94a3b8' }}>1,000</td>
                  <td style={{ padding: '16px', color: '#94a3b8' }}>1 event type</td>
                  <td style={{ padding: '16px', color: '#22c55e', fontWeight: 700 }}>Free</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px', fontWeight: 700, color: '#e2e8f0' }}>Growth</td>
                  <td style={{ padding: '16px', color: '#94a3b8' }}>50,000</td>
                  <td style={{ padding: '16px', color: '#94a3b8' }}>10 wallets</td>
                  <td style={{ padding: '16px', color: '#818cf8', fontWeight: 700 }}>Free (beta)</td>
                </tr>
                <tr>
                  <td style={{ padding: '16px', fontWeight: 700, color: '#e2e8f0' }}>Enterprise</td>
                  <td style={{ padding: '16px', color: '#94a3b8' }}>Unlimited</td>
                  <td style={{ padding: '16px', color: '#94a3b8' }}>Unlimited</td>
                  <td style={{ padding: '16px', color: '#818cf8', fontWeight: 700 }}>Free (beta)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '16px', lineHeight: 1.5 }}>
            Pricing activates at $0.001 / verification call only after beta ends at 100K monthly requests. Until then, it's totally free.
          </p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer style={{ padding: '40px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '8px' }}>
          <a href="mailto:team@pabandi.com" style={{ color: '#818cf8', textDecoration: 'none', marginRight: '16px' }}>team@pabandi.com</a>
          <a href="https://twitter.com/PabandiGlobal" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>@PabandiGlobal</a>
        </p>
        <p style={{ color: '#475569', fontSize: '13px' }}>
          Built for the world. Keep your word. Earn rewards.
        </p>
      </footer>
    </div>
  );
}
