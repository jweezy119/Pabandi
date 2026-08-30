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
      className="min-h-screen text-slate-100 antialiased"
      style={{ background: 'radial-gradient(circle at 20% 0%, #064e3b 0%, #0b1120 45%, #0b1120 100%)', fontFamily: tokens.font.body }}
    >
      {/* Top nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="text-sm font-black tracking-tight text-white">Pabandi</Link>
        <div className="flex items-center gap-3">
          <Link to="/hospitality" className="text-xs text-slate-400 hover:text-white">Hospitality</Link>
          <Link to="/contact" className="text-xs text-slate-400 hover:text-white">Contact</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-5 pt-10 pb-6 text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2">
          <Chip tone="info" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Pabandi × Ondo</Chip>
          {live ? (
            <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">LIVE</span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 bg-amber-400/15 text-amber-300 border border-amber-400/40">Coming Soon</span>
          )}
        </div>

        <h1
          className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
          style={{ background: 'linear-gradient(135deg, #34d399 0%, #5eead4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          Tokenized US Treasury Yield on Every Rent Payment
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-medium text-slate-300">
          Pabandi is bringing <strong className="text-emerald-300">Ondo Finance USDY</strong> — tokenized US Treasuries — to the global rental economy. Rent held for the settlement window earns real T-bill yield, split fairly between tenants and landlords. Built on Solana, anchored by zero-knowledge Proof-of-Rent.
        </p>

        <div className="mx-auto mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
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
            { v: `${apy.toFixed(1)}%`, l: 'USDY APY (T-bills)', c: '#34d399' },
            { v: '50/50', l: 'Tenant / Landlord split', c: '#818cf8' },
            { v: 'ZK', l: 'Proof-of-Rent', c: '#fbbf24' },
            { v: 'SOL', l: 'Settlement chain', c: '#2dd4bf' },
          ].map((s) => (
            <Surface key={s.l} className="flex flex-col items-center gap-1 text-center">
              <p className="text-2xl font-black" style={{ color: s.c }}>{s.v}</p>
              <p className="text-[10px] font-bold text-white">{s.l}</p>
            </Surface>
          ))}
        </div>
      </section>

      {/* Two-column: explainer + pre-reg */}
      <section className="mx-auto mt-8 grid max-w-5xl gap-8 px-5 pb-16 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <h2 className="text-xl font-bold text-white">How rent becomes yield</h2>
          <ol className="flex flex-col gap-3">
            {[
              { t: 'Rent is held in USDY', d: 'When a tenant pays, the rent is parked in Ondo USDY for the float window (paid 1st → settles 5th) in a treasury-protected settlement wallet.' },
              { t: 'T-bills accrue yield', d: 'USDY is backed by short-term US Treasuries, so the held balance earns native yield — no lending, no rehypothecation.' },
              { t: '50/50 split on settlement', d: 'On settlement, yield is split equally: 50% to the tenant’s Renter Equity Wallet, 50% to the landlord bonus.' },
              { t: 'Proof-of-Rent (ZK)', d: 'Each settled stream emits a portable zero-knowledge attestation of on-time rent — reliability you can take anywhere.' },
            ].map((step, i) => (
              <li key={step.t} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-black text-emerald-300">0{i + 1}</span>
                <div>
                  <p className="text-sm font-bold text-white">{step.t}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>

          {live ? (
            <p className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300">
              ● The USDY rail is LIVE — real on-chain holding + yield distribution is active.
            </p>
          ) : (
            <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[11px] text-slate-300">
              Status: <span className="font-bold text-amber-300">Simulated</span> — the full Solana USDY rail is wired and gated on the Ondo mainnet mint + settlement wallet. Flip goes live with zero code changes.
            </p>
          )}
        </div>

        {/* Pre-reg card */}
        <Surface className="h-fit">
          {done ? (
            <div className="py-8 text-center">
              <div className="text-4xl">✅</div>
              <p className="mt-3 text-base font-bold text-white">You’re pre-registered!</p>
              <p className="mt-1 text-[11px] text-slate-400">We’ll reach out the moment the USDY rail goes live.</p>
              <p className="mt-4 text-[13px] font-bold text-emerald-300">
                {total} {total === 1 ? 'property' : 'properties'} pre-registered so far.
              </p>
              <Link to="/hospitality" className="mt-5 inline-block text-xs text-primary hover:underline">Back to Pabandi Hospitality →</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-base font-bold text-white">Get early access</p>
              <p className="text-[10px] text-slate-400 -mt-1">Pre-register your portfolio for USDY rent yield. No commitment.</p>
              <input type="email" required placeholder="Work email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/50" />
              <input type="text" placeholder="Name (optional)" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/50" />
              <select value={form.propertyType}
                onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50">
                <option value="">Property type</option>
                <option value="hotel">Hotel / Resort</option>
                <option value="guesthouse">Guesthouse / B&B</option>
                <option value="vacation_rental">Vacation Rental</option>
                <option value="serviced_apartment">Serviced Apartment</option>
                <option value="other">Other</option>
              </select>
              <input type="number" min="1" placeholder="Portfolio size (units)" value={form.portfolioSize ?? ''}
                onChange={(e) => setForm({ ...form, portfolioSize: e.target.value ? Number(e.target.value) : undefined })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/50" />
              <input type="text" placeholder="Country (optional)" value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/50" />
              {error && <p className="text-[10px] text-rose-400">{error}</p>}
              <Button type="submit" disabled={submitting} className="mt-1 w-full bg-emerald-500 py-3 text-sm font-bold hover:bg-emerald-400">
                {submitting ? 'Submitting...' : 'Pre-register for USDY Yield'}
              </Button>
              <p className="text-[9px] text-slate-500 text-center">
                {total} {total === 1 ? 'property' : 'properties'} already pre-registered.
              </p>
            </form>
          )}
        </Surface>
      </section>

      {/* Social proof / campaign CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-20 text-center">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-2xl font-bold text-white">Built in public with Ondo</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
            We’re showing Ondo the real demand for tokenized T-bill yield on global rent. Every pre-registration here is a data point. Help us reach the tipping point.
          </p>
          <p className="mt-4 text-[13px] font-bold text-emerald-300">
            {total} {total === 1 ? 'property has' : 'properties have'} pre-registered for USDY rent yield.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                'Excited for @pabandiglobal bringing @OndoFinance USDY tokenized T-bill yield to global rent — non-custodial, Solana-anchored, 50/50 tenant-landlord split. Pre-register: '
              )}${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-emerald-950 transition-colors hover:bg-emerald-400"
            >
              Share on X
            </a>
            <button
              onClick={shareWithOndo}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              {copied ? '✓ Copied outreach message' : 'Copy "Share with Ondo" message'}
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-[10px] text-slate-500">
        Pabandi · USDY yield rail is simulated until Ondo mainnet mint + settlement wallet are configured. Not investment advice.
      </footer>
    </div>
  );
}
