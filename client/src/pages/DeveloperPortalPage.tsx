import { useState } from 'react';
import {
  Button,
  Chip,
  Surface,
  Section,
  Stack,
  Callout,
  CodeBlock,
  tokens,
} from '../design-system';

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

export default function DeveloperPortalPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(LIVE_SALE_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="min-h-screen text-slate-100 antialiased"
      style={{ background: tokens.color.background, fontFamily: tokens.font.body }}
    >
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Chip tone="info">PABANDI API</Chip>

          <h1
            className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #818cf8 50%, #c084fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Reliability score as portable identity.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-slate-300">
            One score. Every platform. Real behavior, not self-reported claims.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href="mailto:team@pabandi.com" className="no-underline">
              <Button>Get API Key →</Button>
            </a>
            <Chip tone="success">v0.1 Beta · Free for partners</Chip>
          </div>
        </div>
      </section>

      {/* ── Overview & Problem ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <Stack>
          <p className="text-lg leading-relaxed text-slate-200">
            Pabandi is the WhatsApp-native commerce escrow layer with a portable reliability API.
            Integrate escrow-backed bookings, trust verification, and checkout into live selling,
            marketplaces, rentals, clinic bookings, and hospitality—without rebuilding trust from
            scratch.
          </p>

          <Callout accent="#334155">
            <p className="text-base leading-relaxed text-slate-300">
              <strong className="text-slate-100">The problem today:</strong> Manual deposits, late
              cash, and informal trust still dominate local commerce. WhatsApp is where the
              conversation happens—commitment, protection, and verification should happen there too.
            </p>
          </Callout>

          <Callout accent="#818cf8">
            <p className="text-base leading-relaxed text-slate-300">
              <strong className="text-slate-100">The Pabandi answer:</strong> The Passport is the
              portable trust ID; the escrow layer is the guarantee. Buyers and sellers transact on
              WhatsApp with verified commitment, deposit protection, and $PAB rewards.
            </p>
          </Callout>
        </Stack>
      </section>

      {/* ── Use Cases ─────────────────────────────────────────────────────────── */}
      <Section
        title="Use Cases"
        description="Trust and escrow primitives for local commerce, whether the transaction starts on WhatsApp, a storefront, or a booking widget."
      >
        {[
          {
            icon: '🛍️',
            title: 'Live Selling',
            desc: 'Verify buyer score before allowing pay-on-delivery on Instagram/TikTok live drops.',
          },
          {
            icon: '🗓️',
            title: 'Booking Platforms',
            desc: 'Flag high-risk appointments before confirmation for salons, clinics, and drivers.',
          },
          {
            icon: '🤝',
            title: 'Marketplaces',
            desc: 'Weight bids by seller reliability. OLX-style local platforms can reduce fraud.',
          },
          {
            icon: '💻',
            title: 'Freelance Tools',
            desc: 'Port reputation from Pabandi into gig platforms. Better rates for better history.',
          },
          {
            icon: '🔐',
            title: 'Gated Access',
            desc: 'Require minimum score for premium or vetted community access.',
          },
        ].map((item) => (
          <Surface key={item.title} className="flex flex-col gap-3">
            <div className="text-3xl">{item.icon}</div>
            <h3 className="text-lg font-semibold text-slate-100">{item.title}</h3>
            <p className="text-sm leading-relaxed text-slate-300">{item.desc}</p>
          </Surface>
        ))}
      </Section>

      {/* ── Live Sale Integration ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-100">
            Live-Sale Integration Example
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
            Integrate checkout into live selling by calling the embed endpoint from your seller backend.
            For multi-region or mirror deployments, set <code className="rounded-md bg-white/10 px-1.5 py-0.5 text-indigo-200">window.PABANDI_API_BASE</code> before loading the embed,
            or use <code className="rounded-md bg-white/10 px-1.5 py-0.5 text-indigo-200">PabandiEmbedConfig.setApiBase(...)</code> to redirect requests
            without changing the copied snippet.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="text-xs font-semibold text-slate-400">checkout.js</span>
            <Button variant="ghost" onClick={handleCopy} className="px-3 py-1 text-xs">
              {copied ? '✓ Copied' : 'Copy'}
            </Button>
          </div>
          <div className="p-4">
            <CodeBlock code={LIVE_SALE_CODE} language="javascript" />
          </div>
        </div>
      </section>
    </div>
  );
}
