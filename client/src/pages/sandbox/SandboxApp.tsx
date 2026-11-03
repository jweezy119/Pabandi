import { AnimatePresence, motion } from 'framer-motion';
import { Check, FlaskConical, RotateCcw, User, Building2 } from 'lucide-react';
import { QUESTS, useSandboxStore, type QuestId, type SandboxMode } from './sandboxStore';
import StandardView from './StandardView';
import ProView from './ProView';

const MODES: Array<{ id: SandboxMode; label: string; sub: string; icon: typeof User }> = [
  { id: 'standard', label: 'View as Customer (Standard)', sub: 'Consumer app', icon: User },
  { id: 'pro', label: 'View as Business (Pro)', sub: 'Business OS', icon: Building2 },
];

/**
 * SandboxApp — shell for the Advanced Gamified Sandbox at /sandbox.
 * Replaces the basic 3-step walk-through: a shared $500 plumbing job seen from
 * both sides of the escrow, with a Quest Log driving the tour. The sandbox is
 * deliberately styled as a "simulator": a faint blueprint grid and dashed
 * frames sit on top of the Warm Clay palette.
 */
export default function SandboxApp() {
  const mode = useSandboxStore((s) => s.mode);
  const completedQuests = useSandboxStore((s) => s.completedQuests);
  const setMode = useSandboxStore((s) => s.setMode);
  const reset = useSandboxStore((s) => s.reset);

  const xp = completedQuests.length * 25;

  return (
    <div className="relative min-h-screen bg-[var(--cream)] text-[var(--warm-ink)]">
      {/* Simulator grid backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 sandbox-grid opacity-60" />

      <div className="relative z-10">
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-dashed border-[var(--terracotta)]/40 bg-[var(--cream)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--clay)] text-[var(--cream)] shadow-[var(--shadow-btn)]">
                <FlaskConical className="h-5 w-5" />
              </span>
              <div>
                <p className="font-headline text-lg font-bold leading-none tracking-tight">Pabandi Sandbox</p>
                <p className="font-label text-[10px] uppercase tracking-[0.2em] text-[var(--soft-stone)]">
                  Advanced Walkthrough Sim
                </p>
              </div>
            </div>

            <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--terracotta)] bg-[var(--terracotta)]/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-[var(--terracotta)]">
              Sandbox Mode — No real funds
            </span>

            <div className="ml-auto flex items-center gap-2">
              {/* XP bar — gamified progress */}
              <div className="hidden items-center gap-2 sm:flex" title={`${xp} XP earned`}>
                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-[var(--soft-stone)]">
                  XP {xp}
                </span>
                <div className="h-2.5 w-28 overflow-hidden rounded-full bg-[var(--warm-sand)]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(xp / 100) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                  />
                </div>
              </div>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--clay)]/40 bg-[var(--warm-sand)] px-3 py-1.5 font-label text-xs font-bold text-[var(--warm-ink)] transition-colors hover:border-[var(--clay)]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset Sim
              </button>
            </div>

            {/* Perspective toggle */}
            <div className="flex w-full flex-wrap gap-2 rounded-2xl border border-dashed border-[var(--clay)]/40 bg-[var(--warm-sand)]/60 p-2 sm:w-auto">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex flex-1 items-center gap-2 rounded-xl px-4 py-2.5 text-left transition-all sm:flex-none ${
                      active
                        ? 'bg-[var(--clay)] text-[var(--cream)] shadow-[var(--shadow-btn)]'
                        : 'bg-[var(--cream)]/70 text-[var(--warm-ink)] hover:bg-[var(--cream)]'
                    }`}
                    aria-pressed={active}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>
                      <span className="block text-xs font-bold leading-tight sm:text-sm">{m.label}</span>
                      <span
                        className={`block font-label text-[10px] uppercase tracking-widest ${
                          active ? 'text-[var(--cream)]/80' : 'text-[var(--soft-stone)]'
                        }`}
                      >
                        {m.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* ── Scenario banner ─────────────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="rounded-2xl border border-dashed border-[var(--clay)]/50 bg-[var(--clay)]/10 px-4 py-2.5">
            <p className="font-label text-[10px] uppercase tracking-[0.25em] text-[var(--terracotta)]">
              Simulated Scenario
            </p>
            <p className="text-sm text-[var(--warm-ink)]">
              🔧 A <strong>$500 Plumbing Job</strong> between{' '}
              <strong>Ayesha (Homeowner)</strong> and <strong>Nadeem &amp; Sons Plumbing</strong> —
              toggle perspectives to watch the same escrow from both sides.
            </p>
          </div>
        </div>

        {/* ── Main stage ──────────────────────────────────────────── */}
        <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {mode === 'standard' ? <StandardView /> : <ProView />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Quest Log sidebar ─────────────────────────────────── */}
          <QuestLog completed={completedQuests} />
        </main>

        <footer className="border-t border-dashed border-[var(--clay)]/40 py-6 text-center">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-[var(--soft-stone)]">
            Pabandi Sandbox — simulated data · Solana mainnet timing · zero real funds
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Floating quest tracker — the gamified spine of the walkthrough. */
function QuestLog({ completed }: { completed: QuestId[] }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 140, damping: 20 }}
      className="h-fit w-full shrink-0 rounded-[var(--radius-card)] border border-dashed border-[var(--clay)]/60 bg-[var(--cream)] p-5 shadow-[var(--shadow-soft)] lg:sticky lg:top-28 lg:w-80"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-headline text-base font-bold tracking-tight">Quest Log</h2>
        <span className="rounded-full bg-[var(--warm-sand)] px-2.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-[var(--terracotta)]">
          {completed.length}/{QUESTS.length} done
        </span>
      </div>

      <ol className="space-y-2.5">
        {QUESTS.map((q, i) => {
          const done = completed.includes(q.id);
          return (
            <motion.li
              key={q.id}
              layout
              animate={done ? { scale: [1, 1.03, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                done
                  ? 'border-[var(--sage)]/60 bg-[var(--sage)]/10'
                  : i === completed.length
                    ? 'border-dashed border-[var(--clay)] bg-[var(--clay)]/5'
                    : 'border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)]/40'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${
                  done ? 'bg-[var(--sage)] text-[var(--warm-ink)]' : 'border-[var(--soft-stone)]/40'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <p className={`text-xs leading-snug ${done ? 'text-[var(--warm-ink)]' : 'text-[var(--soft-stone)]'}`}>
                {q.label}
                <span className="ml-1 font-label text-[9px] font-bold uppercase tracking-widest text-[var(--terracotta)]">
                  +{q.xp} XP
                </span>
              </p>
            </motion.li>
          );
        })}
      </ol>

      {/* Final CTA always present in the Quest Log */}
      <div className="mt-4 rounded-xl bg-[var(--warm-ink)] p-4">
        <p className="mb-2.5 text-xs font-semibold text-[var(--cream)]">
          Ready to use the real thing? Sign Up.
        </p>
        <a href="/register" className="block rounded-full bg-[var(--clay)] py-2 text-center font-label text-xs font-bold uppercase tracking-widest text-[var(--warm-ink)] transition-opacity hover:opacity-90">
          Sign Up →
        </a>
      </div>
    </motion.aside>
  );
}
