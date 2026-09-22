import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Button, Chip, Surface, tokens } from '../design-system';

type Lead = {
  email: string;
  name?: string;
  propertyType?: string;
  portfolioSize?: number;
  country?: string;
};

export default function UsdyPage() {
  const { data: usdyConfig } = useQuery('usdy-config-landing', () =>
    fetch('/api/v1/pyd/usdy/config').then((r) => r.json()),
    { refetchOnWindowFocus: false }
  );
  const { data: usdyCount, refetch: refetchUsdyCount } = useQuery('usdy-leads-count-landing', () =>
    fetch('/api/v1/pyd/usdy/leads/count').then((r) => r.json()),
    { refetchOnWindowFocus: false }
  );

  const [form, setForm] = useState<Lead>({ email: '', name: '', propertyType: '', portfolioSize: undefined, country: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = usdyConfig?.data?.live;
  const apy = usdyConfig?.data?.apy ?? 4.5;
  const total = usdyCount?.data?.totalPreRegistered ?? 0;
  // Always share the live site origin (pabandi.com), never a backend/Render URL.
  const shareUrl = `${window.location.origin}/usdy`;

  const [copied, setCopied] = useState(false);
  const shareWithOndo = () => {
    const url = `${window.location.origin}/usdy`;
    const msg =
      `Hi Ondo team — Pabandi is bringing USDY (tokenized US Treasuries) to the global rental economy. ` +
      `Rent held for the settlement window earns native T-bill yield, split 50/50 between tenants and landlords, ` +
      `non-custodial and anchored on Solana with zero-knowledge Proof-of-Rent. ` +
      `${total} properties have already pre-registered for early access: ${url}`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/pyd/usdy/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          portfolioSize: form.portfolioSize ? Number(form.portfolioSize) : undefined,
          source: 'usdy_landing',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        refetchUsdyCount();
      } else {
        setError(data.message || 'Could not pre-register. Try again.');
      }
    } catch {
      setError('Network error. Try again.');
    }
    setSubmitting(false);
  };

  return (
    <div
      className="min-h-screen text-[var(--warm-ink)] antialiased"
      style={{ background: 'radial-gradient(circle at 20% 0%, #064e3b 0%, #0b1120 45%, #0b1120 100%)', fontFamily: tokens.font.body }}
    >
      {/* Top nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="text-sm font-black tracking-tight text-[var(--warm-ink)]">Pabandi</Link>
        <div className="flex items-center gap-3">
          <Link to="/hospitality" className="text-xs text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">Hospitality</Link>
          <Link to="/contact" className="text-xs text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">Contact</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-5 pt-10 pb-6 text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2">
          <Chip tone="info" className="bg-[var(--sage)]/15 text-[var(--sage)] border-[var(--sage)]/30">Pabandi × Ondo</Chip>
          {live ? (
            <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-[var(--sage)]/20 text-[var(--sage)] border border-[var(--sage)]/40">LIVE</span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-[var(--muted-ochre)]/15 text-[var(--muted-ochre)] border border-[var(--muted-ochre)]/40">Coming Soon</span>
          )}
        </div>

        <h1
          className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
          style={{ background: 'linear-gradient(135deg, var(--sage) 0%, var(--sage) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          Tokenized US Treasury Yield on Every Rent Payment
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-medium text-[var(--warm-ink)]">
          Pabandi is bringing <strong className="text-[var(--sage)]">Ondo Finance USDY</strong> — tokenized US Treasuries — to the global rental economy. Rent held for the settlement window earns real T-bill yield, split fairly between tenants and landlords. Built on Solana, anchored by zero-knowledge Proof-of-Rent.
        </p>

        <div className="mx-auto mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[var(--soft-stone)]">
          <span>✓ Yield from US Treasuries (not lending)</span>
          <span>✓ Non-custodial &amp; Sharia-aligned</span>
          <span>✓ Treasury-protected settlement</span>
          <span>✓ Portable on-chain reliability</span>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mx-auto mt-4 max-w-4xl px-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { v: `${apy.toFixed(1)}%`, l: 'USDY APY (T-bills)', c: 'var(--sage)' },
            { v: '50/50', l: 'Tenant / Landlord split', c: 'var(--clay)' },
            { v: 'ZK', l: 'Proof-of-Rent', c: 'var(--muted-ochre)' },
            { v: 'SOL', l: 'Settlement chain', c: '#2dd4bf' },
          ].map((s) => (
            <Surface key={s.l} className="flex flex-col items-center gap-1 text-center">
              <p className="text-2xl font-black" style={{ color: s.c }}>{s.v}</p>
              <p className="text-[10px] font-bold text-[var(--warm-ink)]">{s.l}</p>
            </Surface>
          ))}
        </div>
      </section>

      {/* Two-column: explainer + pre-reg */}
      <section className="mx-auto mt-8 grid max-w-5xl gap-8 px-5 pb-16 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <h2 className="text-xl font-bold text-[var(--warm-ink)]">How rent becomes yield</h2>
          <ol className="flex flex-col gap-3">
            {[
              { t: 'Rent is held in USDY', d: 'When a tenant pays, the rent is parked in Ondo USDY for the float window (paid 1st → settles 5th) in a treasury-protected settlement wallet.' },
              { t: 'T-bills accrue yield', d: 'USDY is backed by short-term US Treasuries, so the held balance earns native yield — no lending, no rehypothecation.' },
              { t: '50/50 split on settlement', d: 'On settlement, yield is split equally: 50% to the tenant’s Renter Equity Wallet, 50% to the landlord bonus.' },
              { t: 'Proof-of-Rent (ZK)', d: 'Each settled stream emits a portable zero-knowledge attestation of on-time rent — reliability you can take anywhere.' },
            ].map((step, i) => (
              <li key={step.t} className="flex gap-3 rounded-xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--sage)]/15 text-xs font-black text-[var(--sage)]">0{i + 1}</span>
                <div>
                  <p className="text-sm font-bold text-[var(--warm-ink)]">{step.t}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--soft-stone)] leading-relaxed">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>

          {live ? (
            <p className="mt-2 rounded-xl border border-[var(--sage)]/30 bg-[var(--sage)]/10 px-4 py-3 text-[11px] font-bold text-[var(--sage)]">
              ● The USDY rail is LIVE — real on-chain holding + yield distribution is active.
            </p>
          ) : (
            <p className="mt-2 rounded-xl border border-amber-400/30 bg-[var(--muted-ochre)]/10 px-4 py-3 text-[11px] text-[var(--warm-ink)]">
              Status: <span className="font-bold text-[var(--muted-ochre)]">Simulated</span> — the full Solana USDY rail is wired and gated on the Ondo mainnet mint + settlement wallet. Flip goes live with zero code changes.
            </p>
          )}
        </div>

        {/* Pre-reg card */}
        <Surface className="h-fit">
          {done ? (
            <div className="py-8 text-center">
              <div className="text-4xl">✅</div>
              <p className="mt-3 text-base font-bold text-[var(--warm-ink)]">You’re pre-registered!</p>
              <p className="mt-1 text-[11px] text-[var(--soft-stone)]">We’ll reach out the moment the USDY rail goes live.</p>
              <p className="mt-4 text-[13px] font-bold text-[var(--sage)]">
                {total} {total === 1 ? 'property' : 'properties'} pre-registered so far.
              </p>
              <Link to="/hospitality" className="mt-5 inline-block text-xs text-primary hover:underline">Back to Pabandi Hospitality →</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-base font-bold text-[var(--warm-ink)]">Get early access</p>
              <p className="text-[10px] text-[var(--soft-stone)] -mt-1">Pre-register your portfolio for USDY rent yield. No commitment.</p>
              <input type="email" required placeholder="Work email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-lg border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] px-3 py-2.5 text-sm text-[var(--warm-ink)] placeholder:text-[var(--soft-stone)] outline-none focus:border-[var(--sage)]/50" />
              <input type="text" placeholder="Name (optional)" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] px-3 py-2.5 text-sm text-[var(--warm-ink)] placeholder:text-[var(--soft-stone)] outline-none focus:border-[var(--sage)]/50" />
              <select value={form.propertyType}
                onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
                className="rounded-lg border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] px-3 py-2.5 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--sage)]/50">
                <option value="">Property type</option>
                <option value="hotel">Hotel / Resort</option>
                <option value="guesthouse">Guesthouse / B&B</option>
                <option value="vacation_rental">Vacation Rental</option>
                <option value="serviced_apartment">Serviced Apartment</option>
                <option value="other">Other</option>
              </select>
              <input type="number" min="1" placeholder="Portfolio size (units)" value={form.portfolioSize ?? ''}
                onChange={(e) => setForm({ ...form, portfolioSize: e.target.value ? Number(e.target.value) : undefined })}
                className="rounded-lg border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] px-3 py-2.5 text-sm text-[var(--warm-ink)] placeholder:text-[var(--soft-stone)] outline-none focus:border-[var(--sage)]/50" />
              <input type="text" placeholder="Country (optional)" value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="rounded-lg border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] px-3 py-2.5 text-sm text-[var(--warm-ink)] placeholder:text-[var(--soft-stone)] outline-none focus:border-[var(--sage)]/50" />
              {error && <p className="text-[10px] text-[var(--terracotta)]">{error}</p>}
              <Button type="submit" disabled={submitting} className="mt-1 w-full bg-[var(--sage)] py-3 text-sm font-bold hover:bg-[var(--sage)]">
                {submitting ? 'Submitting...' : 'Pre-register for USDY Yield'}
              </Button>
              <p className="text-[9px] text-[var(--soft-stone)] text-center">
                {total} {total === 1 ? 'property' : 'properties'} already pre-registered.
              </p>
            </form>
          )}
        </Surface>
      </section>

      {/* Social proof / campaign CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-20 text-center">
        <div className="rounded-3xl border border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)] p-8">
          <p className="text-2xl font-bold text-[var(--warm-ink)]">Built in public with Ondo</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--soft-stone)]">
            We’re showing Ondo the real demand for tokenized T-bill yield on global rent. Every pre-registration here is a data point. Help us reach the tipping point.
          </p>
          <p className="mt-4 text-[13px] font-bold text-[var(--sage)]">
            {total} {total === 1 ? 'property has' : 'properties have'} pre-registered for USDY rent yield.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                'Excited for @pabandiglobal bringing @OndoFinance USDY tokenized T-bill yield to global rent — non-custodial, Solana-anchored, 50/50 tenant-landlord split. Pre-register: '
              )}${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[var(--sage)] px-5 py-2.5 text-xs font-bold text-[var(--warm-ink)] transition-colors hover:bg-[var(--sage)]"
            >
              Share on X
            </a>
            <button
              onClick={shareWithOndo}
              className="rounded-xl border border-[var(--sage)]/40 bg-[var(--sage)]/10 px-5 py-2.5 text-xs font-bold text-[var(--sage)] transition-colors hover:bg-[var(--sage)]/20"
            >
              {copied ? '✓ Copied outreach message' : 'Copy "Share with Ondo" message'}
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgba(191,179,163,0.2)] py-6 text-center text-[10px] text-[var(--soft-stone)]">
        Pabandi · USDY yield rail is simulated until Ondo mainnet mint + settlement wallet are configured. Not investment advice.
      </footer>
    </div>
  );
}
