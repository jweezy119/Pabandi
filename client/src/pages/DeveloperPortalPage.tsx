import { useState } from 'react';
import {
  Chip,
  Surface,
  Section,
  Stack,
  Callout,
  CodeBlock,
  Button,
  tokens,
} from '../design-system';

const SESSION_OPEN_CODE = `// 1. Your agent opens a tab — the Trust Score sets the ceiling, server-side.
const session = await fetch('https://pabandi.onrender.com/api/v1/engine/session/open', {
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

// 2. Settle against the tab — bookings cost the service value, deposits are
//    the engine's decision, not yours to compute.
const action = await fetch('https://pabandi.onrender.com/api/v1/engine/action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: session.data.sessionId,
    actionType: 'booking',
    amount: 1000,
    payload: { businessId, serviceId, date, time },
  })
}).then(r => r.json());
// → { success: true, actionRequired: 'deposit_required'|'none', deposit?: {
//      amount, currency, explanation, checkoutUrl } }

// 3. Settle once on Solana when the tab is done.
await fetch('https://pabandi.onrender.com/api/v1/engine/session/close', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: session.data.sessionId, settle: true })
});`;

const LIVE_SALE_CODE = `app.post('/live-sale/checkout', async (req, res) => {
  const { buyer_wallet, amount, seller_id, currency } = req.body;

  const result = await fetch(
        'https://pabandi-backend-97129395003.asia-south1.run.app/api/v1/checkout/embed-checkout',
    {
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
      }),
      method: 'POST'
    }
  );

  const data = await result.json();

  if (data.success && data.data?.checkoutUrl) {
    return res.json({ checkout_allowed: true, checkoutUrl: data.data.checkoutUrl });
  } else {
    return res.json({
      checkout_allowed: false,
      reason: data.error || 'Checkout session creation failed'
    });
  }
})`;

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

# Create escrow
escrow = client.escrow.create(
    reference_id="order-123",
    template="freelance",
    parties=[{"partyId": "buyer-1", "role": "buyer"}],
    amount=500,
    currency="USDC",
    conditions=[{"type": "milestone", "verify": {"milestoneId": "m1"}}],
    deadline="2026-12-31"
)`;

const PLAYGROUND_CODE = `// Try it right here — no auth needed for public endpoints
const identifier = prompt('Enter email, wallet, or handle:');
if (!identifier) throw new Error('identifier required');

const res = await fetch(\`/api/v1/trust/resolve/\${encodeURIComponent(identifier)}\`);
const json = await res.json();
console.log(json);`;

export default function DeveloperPortalPage() {
  const [copied, setCopied] = useState(false);
  const [playgroundOutput, setPlaygroundOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'engine' | 'overview' | 'quickstart' | 'sdks' | 'playground'>('engine');

  const handleCopy = () => {
    navigator.clipboard.writeText(LIVE_SALE_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runPlayground = async () => {
    const identifier = prompt('Enter email, wallet, or handle:');
    if (!identifier) return;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
      const res = await fetch(`${baseUrl}/api/v1/trust/resolve/${encodeURIComponent(identifier)}`);
      const json = await res.json();
      setPlaygroundOutput(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setPlaygroundOutput(`Error: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen antialiased" style={{ background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>
      <section
        className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 lg:px-8"
        style={{ background: 'linear-gradient(180deg, rgba(42,37,32,0.92) 0%, rgba(42,37,32,0.97) 100%)' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 20% 0%, rgba(201,123,90,0.18), transparent), radial-gradient(ellipse 40% 30% at 80% 10%, rgba(217,168,84,0.10), transparent)',
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <Chip tone="info">PABANDI API · MCP READY</Chip>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl" style={{ fontFamily: 'var(--font-headline)' }}>
            <span className="bg-gradient-to-br from-[var(--warm-sand)] via-[var(--clay)] to-[var(--muted-ochre)] bg-clip-text text-transparent">
              The Settlement Layer for the Agent Economy.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-[var(--warm-sand)]/80">
            Your agent opens a session with $100. Makes 50 API calls. Settles once on Solana.
            Bookings, escrow and no-show guarantees — priced by the Trust Score, enforced
            server-side, settled in a single transaction.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href="mailto:jay@pabandi.com" className="no-underline">
              <Button variant="primary">Get API Key →</Button>
            </a>
            <Chip tone="success">v0.1 Beta · Free for partners</Chip>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto">
          {(['engine', 'overview', 'quickstart', 'sdks', 'playground'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap ${activeTab === tab ? 'bg-[var(--clay)]/20 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.2)]'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {/* Engine Tab — the open-tab settlement concept */}
      {activeTab === 'engine' && (
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
          {/*
            One section, one idea: the tab is the unit of integration. The
            three surfaces below (concept strip, code, safety callout) all
            explain the same lifecycle so a reader who skips the words can
            still read the flow in any order.
          */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { n: '01', title: 'Open a tab', body: 'One call. The Trust Score sets the ceiling server-side — an agent can declare itself unproven, never proven.', icon: 'tab' },
              { n: '02', title: 'Spend against it', body: 'Bookings, invoice payments, escrow. The engine decides deposits; nobody signs per payment.', icon: 'credit_score' },
              { n: '03', title: 'Settle once', body: 'Fifty calls, one Solana settlement. Receipts hash what was authorised against what shipped.', icon: 'receipt_long' },
            ].map(step => (
              <Surface key={step.n} className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined" style={{ color: 'var(--terracotta)' }}>{step.icon}</span>
                  <span className="text-xs font-bold tracking-widest" style={{ color: 'var(--soft-stone)' }}>{step.n}</span>
                </div>
                <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--warm-ink)' }}>{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--soft-stone)' }}>{step.body}</p>
              </Surface>
            ))}
          </div>

          <Surface className="p-6">
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-headline)', color: 'var(--warm-ink)' }}>
              The whole lifecycle in three calls
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--soft-stone)' }}>
              Sessions are quoted in USDC by default and every response carries the remaining
              balance. Malformed payloads are rejected with field-level Zod errors, not a 500.
            </p>
            <CodeBlock code={SESSION_OPEN_CODE} language="javascript" />
          </Surface>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Callout accent="var(--terracotta)">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--warm-ink)' }}>
                <strong>MCP native.</strong> The same surface is exposed as Model Context
                Protocol tools at <code>POST /mcp</code> — <code>pabandi_open_session</code>,{' '}
                <code>pabandi_execute_transaction</code>, <code>pabandi_discover</code>. Any MCP
                client can drive the engine without custom glue code. Tools that move money
                require a <code>sessionId</code> and will tell the agent to open one first.
              </p>
            </Callout>
            <Callout accent="var(--sage)">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--warm-ink)' }}>
                <strong>Deposits are the engine's decision.</strong> The booking response{' '}
                <code>actionRequired</code> field is the whole contract: <code>none</code> means
                the guarantee was satisfied, <code>deposit_required</code> means fund{' '}
                <code>deposit.checkoutUrl</code>. A decision priced in a browser can be relabel;
                a decision priced by the session's owner principal cannot.
              </p>
            </Callout>
          </div>
        </section>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
          <Stack>
            <p className="text-lg leading-relaxed text-[var(--warm-ink)]/90">
              Pabandi is the WhatsApp-native commerce escrow layer with a portable reliability API.
              Integrate escrow-backed bookings, trust verification, and checkout into live selling,
              marketplaces, rentals, clinic bookings, and hospitality—without rebuilding trust from
              scratch.
            </p>

            <Callout accent="#334155">
              <p className="text-base leading-relaxed text-[var(--warm-ink)]/80">
                <strong className="text-[var(--warm-ink)]">The problem today:</strong> Manual deposits, late
                cash, and informal trust still dominate local commerce. WhatsApp is where the
                conversation happens—commitment, protection, and verification should happen there too.
              </p>
            </Callout>

            <Callout accent="#818cf8">
              <p className="text-base leading-relaxed text-[var(--warm-ink)]/80">
                <strong className="text-[var(--warm-ink)]">The Pabandi answer:</strong> The Passport is the
                portable trust ID; the escrow layer is the guarantee. Buyers and sellers transact on
                WhatsApp with verified commitment, deposit protection, and $PAB rewards.
              </p>
            </Callout>
          </Stack>
        </section>
      )}

      {/* Quickstart Tab */}
      {activeTab === 'quickstart' && (
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-[var(--warm-ink)]">
              Quickstart
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--warm-ink)]/80">
              Get started in 5 minutes. Sign up for an API key, install the SDK, and make your first trust lookup.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">1. Get your API key</h3>
              <p className="text-sm text-[var(--soft-stone)] mb-3">Email jay@pabandi.com to request a free API key for beta partners.</p>
              <CodeBlock code={`export PABANDI_API_KEY="pab_live_..."`} language="bash" />
            </Surface>

            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">2. Resolve a trust score</h3>
              <p className="text-sm text-[var(--soft-stone)] mb-3">Call the trust resolver with any identifier: email, wallet, or GitHub handle.</p>
              <CodeBlock code={TRUST_API_CODE} language="javascript" />
            </Surface>

            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">3. Create an escrow</h3>
              <p className="text-sm text-[var(--soft-stone)] mb-3">Generalize escrow for any transaction type.</p>
              <CodeBlock code={`POST /api/v1/escrow
{
  "referenceId": "order-123",
  "template": "freelance",
  "parties": [{"partyId": "buyer-1", "role": "buyer"}],
  "amount": 500,
  "currency": "USDC",
  "conditions": [{"type": "milestone", "verify": {"milestoneId": "m1"}}]
}`} language="json" />
            </Surface>
          </div>
        </section>
      )}

      {/* SDKs Tab */}
      {activeTab === 'sdks' && (
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-[var(--warm-ink)]">
              SDKs
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--warm-ink)]/80">
              Official libraries for JavaScript and Python. Go SDK coming soon.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">JavaScript / TypeScript</h3>
              <CodeBlock code={`npm install @pabandi/trust

import { TrustClient } from '@pabandi/trust';

const client = new TrustClient({ apiKey: process.env.PABANDI_API_KEY });
const score = await client.trust.resolve('user@example.com');`} language="javascript" />
            </Surface>

            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">Python</h3>
              <CodeBlock code={PYTHON_SDK} language="python" />
            </Surface>

            <Surface className="p-6">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">cURL</h3>
              <CodeBlock code={`curl -H "Authorization: Bearer YOUR_KEY" \\
  https://api.pabandi.com/api/v1/trust/resolve/user@example.com`} language="bash" />
            </Surface>
          </div>
        </section>
      )}

      {/* Playground Tab */}
      {activeTab === 'playground' && (
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-[var(--warm-ink)]">
              Playground
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--warm-ink)]/80">
              Test the Trust API without authentication. Try resolving a public profile.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <Surface className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Button onClick={runPlayground}>Run Example</Button>
                <span className="text-xs text-[var(--soft-stone)]">No API key required for public endpoints</span>
              </div>
              {playgroundOutput && (
                <div className="rounded-xl bg-[var(--warm-sand)] p-4">
                  <pre className="text-xs text-[var(--warm-ink)] whitespace-pre-wrap">{playgroundOutput}</pre>
                </div>
              )}
            </Surface>
          </div>
        </section>
      )}

      {/* Live Sale Integration Example */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-[var(--warm-ink)]">
            Live-Sale Integration Example
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--warm-ink)]/80">
            Integrate checkout into live selling by calling the embed endpoint from your seller backend.
            For multi-region or mirror deployments, set <code className="rounded-md bg-[var(--warm-sand)] px-1.5 py-0.5 text-[var(--terracotta)]">window.PABANDI_API_BASE</code> before loading the embed,
            or use <code className="rounded-md bg-[var(--warm-sand)] px-1.5 py-0.5 text-[var(--terracotta)]">PabandiEmbedConfig.setApiBase(...)</code> to redirect requests
            without changing the copied snippet.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="text-xs font-semibold text-[var(--warm-ink)]/70">checkout.js</span>
            <button onClick={handleCopy} className="rounded-lg border border-[var(--soft-stone)]/30 bg-[var(--cream)] px-3 py-1 text-xs font-bold text-[var(--warm-ink)]/80 hover:bg-[var(--warm-sand)] transition-colors">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-4">
            <CodeBlock code={LIVE_SALE_CODE} language="javascript" />
          </div>
        </div>
      </section>
    </div>
  );
}
