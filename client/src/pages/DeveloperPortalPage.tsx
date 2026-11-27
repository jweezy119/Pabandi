import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Copy, Check, Play, Cpu, ShieldCheck, Layers } from 'lucide-react';
import GlassNavHeader from '../components/GlassNavHeader';
import { API_HOST } from '../services/api';

const SESSION_OPEN_CODE = `// 1. Your agent opens a tab — the Trust Score sets the ceiling, server-side.
const session = await fetch('https://api.pabandi.com/api/v1/engine/session/open', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ownerType: 'agent',
    ownerId: 'your-agent-id',
    trustScore: 780,          // Optional floor — can only lower the tier
    currency: 'USDC'
  })
}).then(r => r.json());
// → 201 { success: true, data: { sessionId, totalLimit: 500, remaining, ... } }

// 2. Settle against the tab — deposits are the engine's decision.
const action = await fetch('https://api.pabandi.com/api/v1/engine/action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: session.data.sessionId,
    actionType: 'booking',
    amount: 1000,
    payload: { businessId, serviceId, date, time },
  })
}).then(r => r.json());

// 3. Settle once on Solana when the tab is done.
await fetch('https://api.pabandi.com/api/v1/engine/session/close', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: session.data.sessionId, settle: true })
});`;

const PREDICTIVE_CODE = `// Forward-predict task fulfillment & Human-in-the-Loop policy
const risk = await fetch('https://api.pabandi.com/api/v1/predictive/task-risk', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.PABANDI_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scopeComplexity: 'high',
    budgetUsd: 850,
    leadTimeHours: 12,
    requiresVcapProof: true
  })
}).then(r => r.json());
// → { completionProbability: 0.91, riskTier: 'LOW', hitlPolicy: 'ASSISTED', factors: [...] }`;

const LIVE_SALE_CODE = `app.post('/live-sale/checkout', async (req, res) => {
  const { amount, seller_id, currency } = req.body;

  const result = await fetch(
    'https://api.pabandi.com/api/v1/checkout/embed-checkout',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.PABANDI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        businessId: seller_id,
        amount,
        currency: currency || 'USD',
        successUrl: 'https://your-site.com/order/success',
        cancelUrl: 'https://your-site.com/order/cancel',
        source: 'LIVE_SELLER'
      })
    }
  );

  const data = await result.json();
  if (data.success && data.data?.checkoutUrl) {
    return res.json({ checkout_allowed: true, checkoutUrl: data.data.checkoutUrl });
  }
  return res.json({ checkout_allowed: false, reason: data.error || 'Checkout failed' });
});`;

const TRUST_API_CODE = `// Quickstart: Resolve a trust score by email or wallet
const response = await fetch('https://api.pabandi.com/api/v1/trust/resolve/user@example.com', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
});
const { data } = await response.json();
console.log(data.scores.payment, data.scores.showUp);`;

const PYTHON_SDK = `pip install pabandi-sdk

from pabandi import TrustClient

client = TrustClient(api_key="YOUR_KEY")

# Resolve trust score
score = client.trust.resolve("user@example.com")
print(score.payment, score.show_up)

# Create milestone escrow
escrow = client.escrow.create(
    reference_id="order-123",
    template="freelance",
    parties=[{"partyId": "buyer-1", "role": "buyer"}],
    amount=500,
    currency="USDC",
    conditions=[{"type": "milestone", "verify": {"milestoneId": "m1"}}],
    deadline="2026-12-31"
)`;

function GlassCode({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="pg-glass overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--pg-line)', background: 'rgba(0,0,0,0.25)' }}>
        <span className="text-xs font-mono flex items-center gap-2" style={{ color: 'var(--pg-muted)' }}>
          <Terminal className="w-3.5 h-3.5" style={{ color: 'var(--pg-clay)' }} />
          {title}
        </span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono"
          style={{ background: 'var(--pg-glass-2)', border: '1px solid var(--pg-line)', color: 'var(--pg-muted)' }}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto text-xs sm:text-sm leading-relaxed m-0" style={{ fontFamily: 'var(--pg-mono)', color: '#d7dbe6' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DeveloperPortalPage() {
  const [playgroundInput, setPlaygroundInput] = useState('apex-design');
  const [playgroundOutput, setPlaygroundOutput] = useState<string>('');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'engine' | 'predictive' | 'quickstart' | 'sdks' | 'playground'>('engine');

  const runPlayground = async () => {
    if (!playgroundInput.trim()) return;
    setPlaygroundLoading(true);
    try {
      const res = await fetch(`${API_HOST}/api/v1/trust/resolve/${encodeURIComponent(playgroundInput.trim())}`);
      const json = await res.json();
      setPlaygroundOutput(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setPlaygroundOutput(`Error: ${e.message}`);
    } finally {
      setPlaygroundLoading(false);
    }
  };

  return (
    <div className="pg-root">
      <div className="pg-grid-bg" aria-hidden="true" />
      <div className="pg-aurora a1" aria-hidden="true" />
      <div className="pg-aurora a2" aria-hidden="true" />

      <GlassNavHeader />

      <main className="pg-container" style={{ paddingTop: 52, paddingBottom: 96 }}>
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto mb-12">
          <span className="pg-eyebrow">PABANDI API · MCP · OPENAPI 3.0</span>
          <h1 style={{ fontFamily: 'var(--pg-display)', fontSize: 'clamp(34px, 4.8vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 700, margin: '14px 0 16px' }}>
            The settlement layer for <span className="pg-grad">the agent economy.</span>
          </h1>
          <p style={{ color: 'var(--pg-muted)', fontSize: 17, lineHeight: 1.6, margin: '0 auto 26px', maxWidth: 620 }}>
            Open a session with $100, execute 50 API or MCP calls, predict risk before funds move, and settle once on Solana or fiat rails.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="mailto:jay@pabandi.com" className="pg-btn pg-btn-primary">
              Request API Key →
            </a>
            <a href={`${API_HOST}/.well-known/openapi.json`} target="_blank" rel="noopener noreferrer" className="pg-btn pg-btn-ghost">
              OpenAPI Spec
            </a>
            <Link to="/agents" className="pg-btn pg-btn-ghost">
              MCP &amp; Agent SDK
            </Link>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-10" role="tablist">
          {([
            ['engine', 'Session Engine'],
            ['predictive', 'Predictive ML'],
            ['quickstart', 'Quickstart'],
            ['sdks', 'SDKs'],
            ['playground', 'Live Playground'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`pg-tab ${activeTab === key ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Engine */}
        {activeTab === 'engine' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { n: '01', icon: <Layers className="w-4 h-4" style={{ color: 'var(--pg-clay)' }} />, title: 'Open a tab', body: 'One call. The Trust Score sets the ceiling server-side — an agent can declare itself unproven, never proven.' },
                { n: '02', icon: <Cpu className="w-4 h-4" style={{ color: 'var(--pg-indigo)' }} />, title: 'Spend against it', body: 'Bookings, invoice payments, escrow. The engine decides deposits; nobody signs per payment.' },
                { n: '03', icon: <ShieldCheck className="w-4 h-4" style={{ color: 'var(--pg-green)' }} />, title: 'Settle once', body: 'Fifty calls, one Solana settlement. Receipts hash what was authorised against what shipped.' },
              ].map((step) => (
                <div key={step.n} className="pg-glass p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    {step.icon}
                    <span className="text-xs font-mono" style={{ color: 'var(--pg-dim)' }}>{step.n}</span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--pg-display)', fontSize: 17, fontWeight: 700, margin: 0 }}>{step.title}</h3>
                  <p style={{ color: 'var(--pg-muted)', fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{step.body}</p>
                </div>
              ))}
            </div>

            <GlassCode title="session_lifecycle.js" code={SESSION_OPEN_CODE} />
          </div>
        )}

        {/* Tab: Predictive ML */}
        {activeTab === 'predictive' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="pg-glass p-6 space-y-2">
              <span className="pg-badge new">BAYESIAN ENGINE V2</span>
              <h2 style={{ fontFamily: 'var(--pg-display)', fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>
                Forward-predict completion &amp; dispute risk
              </h2>
              <p style={{ color: 'var(--pg-muted)', fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
                Call <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>POST /api/v1/predictive/task-risk</code>,{' '}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>/deal-risk</code>, or{' '}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>/simulate</code> to receive calibrated probabilities, recommended collateral ratios, and explainable factor attribution.
              </p>
            </div>
            <GlassCode title="predictive_risk.js" code={PREDICTIVE_CODE} />
          </div>
        )}

        {/* Tab: Quickstart */}
        {activeTab === 'quickstart' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <GlassCode title="1. Export your API key" code={`export PABANDI_API_KEY="pab_live_..."`} />
            <GlassCode title="2. Resolve a trust score" code={TRUST_API_CODE} />
            <GlassCode title="3. Live-Sale embed checkout (Node/Express)" code={LIVE_SALE_CODE} />
          </div>
        )}

        {/* Tab: SDKs */}
        {activeTab === 'sdks' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <GlassCode
              title="JavaScript / TypeScript"
              code={`npm install @pabandi/trust

import { TrustClient } from '@pabandi/trust';

const client = new TrustClient({ apiKey: process.env.PABANDI_API_KEY });
const score = await client.trust.resolve('user@example.com');`}
            />
            <GlassCode title="Python" code={PYTHON_SDK} />
          </div>
        )}

        {/* Tab: Live Playground */}
        {activeTab === 'playground' && (
          <div className="max-w-3xl mx-auto">
            <div className="pg-glass p-6 space-y-4">
              <div>
                <h2 style={{ fontFamily: 'var(--pg-display)', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
                  Live Trust API Playground
                </h2>
                <p style={{ color: 'var(--pg-muted)', fontSize: 14, margin: 0 }}>
                  Test the public trust resolver right here — no API key required.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={playgroundInput}
                  onChange={(e) => setPlaygroundInput(e.target.value)}
                  placeholder="Enter handle, email, or wallet address..."
                  className="pg-input font-mono text-sm flex-1"
                />
                <button onClick={runPlayground} disabled={playgroundLoading} className="pg-btn pg-btn-primary">
                  <Play className="w-4 h-4" />
                  {playgroundLoading ? 'Running…' : 'Run Request'}
                </button>
              </div>
              {playgroundOutput && (
                <pre className="p-4 rounded-xl overflow-x-auto text-xs m-0" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid var(--pg-line)', fontFamily: 'var(--pg-mono)', color: 'var(--pg-green)' }}>
                  {playgroundOutput}
                </pre>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
