import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  Handshake,
  Radio,
  ShieldCheck,
  Wallet,
  Wrench,
} from 'lucide-react';
import { SCENARIO, useSandboxStore } from './sandboxStore';

const money = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * ProView — the Business OS in the sandbox.
 * Shows the inbound escrow as "secured" revenue, lets the contractor mark the
 * $500 job complete (pings the Customer view across the shared store), tracks
 * SaaS credits, and runs a mock M2M agent feed.
 */
export default function ProView() {
  const phase = useSandboxStore((s) => s.phase);
  const saasCredit = useSandboxStore((s) => s.saasCredit);
  const markJobComplete = useSandboxStore((s) => s.markJobComplete);
  const creditGranted = useSandboxStore((s) => s.creditGranted);
  const rebate = useSandboxStore((s) => Math.max(SCENARIO.minRebate, s.yieldEarned));

  const [showCreditBurst, setShowCreditBurst] = useState(false);

  // When the yield rebate lands in the business account, pop the "+" animation.
  useEffect(() => {
    if (creditGranted) {
      setShowCreditBurst(true);
      const t = window.setTimeout(() => setShowCreditBurst(false), 3200);
      return () => window.clearTimeout(t);
    }
  }, [creditGranted]);

  return (
    <div className="space-y-5">
      {/* ── Job dashboard ───────────────────────────────────────── */}
      <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--clay)]/60 bg-[var(--cream)] p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--terracotta)]">
            Business Dashboard — Pro
          </span>
          {phase !== 'start' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sage)]/20 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-[var(--terracotta)]">
              <ShieldCheck className="h-3 w-3" /> Escrow Secured
            </span>
          )}
          {phase === 'released' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sage)]/30 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-[var(--terracotta)]">
              <CheckCircle2 className="h-3 w-3" /> Funds Released
            </span>
          )}
        </div>

        <p className="font-headline text-2xl font-bold tracking-tight">{SCENARIO.jobTitle}</p>
        <p className="text-sm text-[var(--soft-stone)]">
          Client: {SCENARIO.customer} · {phase === 'start' ? 'Escrow not yet funded' : '$500 pooled by Pabandi before work began'}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Job Value in Escrow" value={money(SCENARIO.amount)} accent="clay" locked={phase === 'start'} />
          <StatCard label="Your Technical Escrow" value={money(50)} accent="ochre" locked={phase === 'start'} />
          <StatCard
            label={phase === 'released' ? 'Payout' : 'Pending Payout'}
            value={money(SCENARIO.amount)}
            accent="sage"
            locked={phase === 'start'}
          />
        </div>

        <div className="mt-4">
          {phase === 'locked' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={markJobComplete}
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-[var(--clay)] px-6 py-3 font-label text-sm font-bold uppercase tracking-widest text-[var(--cream)] shadow-[var(--shadow-btn)] hover:shadow-[var(--shadow-btn-hover)]"
            >
              <Wrench className="h-4 w-4" /> Mark Job Complete
            </motion.button>
          )}
          {phase === 'start' && (
            <p className="font-label text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">
              The customer hasn’t escrowed yet — switch to “Standard” view to lock the funds.
            </p>
          )}
          {phase === 'job_complete' && (
            <p className="font-label text-[10px] uppercase tracking-widest text-[var(--sage)]">
              Sent to {SCENARIO.customer} — awaiting their VCAP verification. Switch to Standard view to release.
            </p>
          )}
        </div>
      </section>

      {/* ── SaaS credit balance ────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-dashed border-[var(--clay)]/60 bg-[var(--warm-ink)] p-6 text-[var(--cream)] shadow-[var(--shadow-soft)]">
        <p className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.25em] text-[var(--muted-ochre)]">
          <Wallet className="h-3.5 w-3.5" /> SaaS Credit Balance
        </p>
        <div className="mt-2 flex items-end gap-3">
          <motion.p
            key={saasCredit}
            initial={{ y: 6, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            className="font-headline text-4xl font-black tabular-nums tracking-tight"
          >
            {money(saasCredit)}
          </motion.p>
          {/* The satisfying "+" burst when the yield rebate lands */}
          <AnimatePresence>
            {showCreditBurst && (
              <motion.span
                initial={{ opacity: 0, y: 10, scale: 0.6 }}
                animate={{ opacity: 1, y: -6, scale: 1.15 }}
                exit={{ opacity: 0, y: -22, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                className="mb-1 inline-flex items-center gap-1 rounded-full bg-[var(--sage)] px-3 py-1 text-xs font-black text-white shadow-lg"
              >
                +{money(rebate)} yield credit
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-2 max-w-md text-[11px] leading-snug text-[var(--cream)]/60">
          Protocol fees paid in PAB are offset against this balance — deeper liquidity, lower take rate.
        </p>
      </section>

      {/* ── M2M Agent feed ─────────────────────────────────────── */}
      <AgentFeed />
    </div>
  );
}

function StatCard({ label, value, accent, locked }: { label: string; value: string; accent: 'clay' | 'sage' | 'ochre'; locked: boolean }) {
  const fg = accent === 'clay' ? 'var(--clay)' : accent === 'sage' ? 'var(--sage)' : 'var(--muted-ochre)';
  return (
    <motion.div
      layout
      className="rounded-2xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)]/50 p-4"
    >
      <p className="font-label text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">{label}</p>
      <p className="font-headline text-xl font-black tabular-nums" style={{ color: locked ? 'var(--soft-stone)' : fg }}>
        {locked ? '—' : value}
      </p>
    </motion.div>
  );
}

/** Mock machine-to-machine agent activity — the "business runs itself" story. */
function AgentFeed() {
  const events: Array<{ icon: typeof Bot; text: string; tone: string }> = [
    { icon: Bot, text: 'Scout found 2 new leads. Agent negotiated a $200 data scrape.', tone: 'border-[var(--sage)]/50 bg-[var(--sage)]/10' },
    { icon: Handshake, text: 'Agent contacted Pools-R-Us for a joint bid — margin projected +12%.', tone: 'border-[var(--sky-wash)]/60 bg-[var(--sky-wash)]/20' },
    { icon: Radio, text: 'M2M heartbeat: trust passport verified against 3 client agents.', tone: 'border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)]/50' },
  ];
  return (
    <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--clay)]/60 bg-[var(--cream)] p-6 shadow-[var(--shadow-soft)]">
      <h2 className="mb-1 font-headline text-lg font-bold tracking-tight">Agent Feed</h2>
      <p className="mb-4 font-label text-[10px] uppercase tracking-[0.25em] text-[var(--soft-stone)]">
        M2M — machines doing the admin
      </p>
      <div className="space-y-3">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <motion.div
              key={e.text}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.12, type: 'spring', stiffness: 180, damping: 20 }}
              className={`flex items-start gap-3 rounded-xl border p-3 ${e.tone}`}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--warm-ink)] text-[var(--cream)]">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-xs leading-snug text-[var(--warm-ink)]">{e.text}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
