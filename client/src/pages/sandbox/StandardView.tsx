import { useEffect, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Camera,
  CheckCircle2,
  Coins,
  Info,
  Lock,
  LockOpen,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import ClayVaultLock from '../../components/clay/ClayVaultLock';
import { SCENARIO, useSandboxStore } from './sandboxStore';

const money = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * StandardView — the Consumer dashboard in the sandbox.
 * The escrow magic: while $500 waits in escrow it keeps ticking yield on
 * Solana, live on screen. Verifying the work (VCAP) releases the funds,
 * plays the Clay Vault unlock, and pays the yield rebate back to the customer.
 */
export default function StandardView() {
  const phase = useSandboxStore((s) => s.phase);
  const yieldEarned = useSandboxStore((s) => s.yieldEarned);
  const lockEscrow = useSandboxStore((s) => s.lockEscrow);
  const releaseFunds = useSandboxStore((s) => s.releaseFunds);
  const tickYield = useSandboxStore((s) => s.tickYield);
  const notification = useSandboxStore((s) => s.customerNotification);
  const dismissNotification = useSandboxStore((s) => s.dismissNotification);

  const [showProofModal, setShowProofModal] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [proofTaken, setProofTaken] = useState(false);

  // Real-time yield ticker: +$0.01/s while money is pooled in escrow.
  useEffect(() => {
    const t = window.setInterval(tickYield, 1000);
    return () => window.clearInterval(t);
  }, [tickYield]);

  const rebate = Math.max(SCENARIO.minRebate, yieldEarned);

  return (
    <div className="space-y-5">
      {/* Business notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex items-start gap-3 rounded-2xl border border-[var(--sage)]/60 bg-[var(--sage)]/15 p-4"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sage)]" />
            <p className="flex-1 text-xs leading-snug text-[var(--warm-ink)]">{notification}</p>
            <button onClick={dismissNotification} aria-label="Dismiss notification">
              <X className="h-4 w-4 text-[var(--soft-stone)]" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Escrow header card ─────────────────────────────────── */}
      <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--clay)]/60 bg-[var(--cream)] p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--terracotta)]">
            Customer Dashboard — Escrow
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest ${
              phase === 'start'
                ? 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'
                : 'bg-[var(--sage)]/20 text-[var(--terracotta)]'
            }`}
          >
            {phase === 'start' ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
            {phase === 'start' ? 'Not locked yet' : phase === 'released' ? 'Released' : 'Escrow Active'}
          </span>
        </div>

        <p className="font-headline text-2xl font-bold tracking-tight">{SCENARIO.jobTitle}</p>
        <p className="text-sm text-[var(--soft-stone)]">
          Contractor: {SCENARIO.contractor} · Pooled in a Solana escrow vault
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* The $500 being held */}
          <motion.div
            layout
            className="rounded-2xl border border-[var(--clay)]/30 bg-[var(--warm-sand)]/60 p-4"
          >
            <p className="font-label text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">
              Active Escrow
            </p>
            <p className="font-headline text-3xl font-black tabular-nums text-[var(--clay)]">
              {money(SCENARIO.amount)}
            </p>
            {phase === 'start' ? (
              <p className="mt-1 text-xs text-[var(--soft-stone)]">Ready to lock</p>
            ) : (
              <p className="mt-1 text-xs text-[var(--soft-stone)]">
                {phase === 'released' ? 'Released · 0 funds held' : 'Held by Pabandi vault until VCAP'}
              </p>
            )}
          </motion.div>

          {/* ── The magic: live yield counter ── */}
          <div className="group relative rounded-2xl border border-[var(--sage)]/50 bg-[var(--sage)]/10 p-4">
            <p className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">
              Yield Earned ({(SCENARIO.apy * 100).toFixed(0)}% APY, live)
              <Info className="h-3 w-3 cursor-help text-[var(--sage)]" />
            </p>
            <YieldCounter value={yieldEarned} />
            <p className="mt-1 text-xs text-[var(--soft-stone)]">
              Your money is working on Solana while you wait.
            </p>
            <TooltipBubble text="Your money is working on Solana while you wait." />
          </div>
        </div>

        {/* ── Action row ── */}
        <div className="mt-4">
          {phase === 'start' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={lockEscrow}
              className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-[var(--clay)] px-6 py-3 font-label text-sm font-bold uppercase tracking-widest text-[var(--cream)] shadow-[var(--shadow-btn)] transition-shadow hover:shadow-[var(--shadow-btn-hover)]"
            >
              <Lock className="h-4 w-4" /> Lock $500 in Escrow
            </motion.button>
          )}

          {(phase === 'locked' || phase === 'job_complete') && (
            <motion.button
              whileTap={{ scale: phase === 'job_complete' ? 0.97 : 1 }}
              disabled={phase === 'locked'}
              onClick={() => setShowProofModal(true)}
              className={`inline-flex items-center gap-2 rounded-[var(--radius-btn)] px-6 py-3 font-label text-sm font-bold uppercase tracking-widest transition-colors ${
                phase === 'job_complete'
                  ? 'bg-[var(--terracotta)] text-[var(--cream)] shadow-[var(--shadow-btn)] hover:shadow-[var(--shadow-btn-hover)]'
                  : 'cursor-not-allowed bg-[var(--warm-sand)] text-[var(--soft-stone)]'
              }`}
            >
              <LockOpen className="h-4 w-4" /> Release Funds
            </motion.button>
          )}

          {phase === 'locked' && (
            <p className="mt-2 font-label text-[10px] uppercase tracking-widest text-[var(--soft-stone)]">
              Waiting for {SCENARIO.contractor} to finish — switch to “Pro” view to act as the business.
            </p>
          )}

          {phase === 'released' && (
            <p className="font-label text-[10px] uppercase tracking-widest text-[var(--sage)]">
              VCAP verification complete.
            </p>
          )}
        </div>
      </section>

      {/* ── Success screen ─────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'released' && (
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            className="rounded-[var(--radius-card)] border border-[var(--sage)]/60 bg-gradient-to-br from-[var(--sage)]/15 to-[var(--cream)] p-6 text-center shadow-[var(--shadow-soft)]"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.15 }}
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sage)] text-white shadow-lg"
            >
              <CheckCircle2 className="h-8 w-8" />
            </motion.div>
            <h2 className="font-headline text-2xl font-bold tracking-tight text-[var(--warm-ink)]">
              Job Complete!
            </h2>
            <p className="mt-1 text-sm text-[var(--soft-stone)]">
              You earned a <strong className="text-[var(--terracotta)]">{money(rebate)} yield rebate</strong> —
              released back to your wallet because your escrow sat in a yield pool, not a dead safe.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--warm-ink)] px-4 py-2 text-xs font-bold text-[var(--cream)]">
              <Coins className="h-4 w-4 text-[var(--muted-ochre)]" /> Rebate credited: {money(rebate)}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Proof modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showProofModal && (
          <ProofModal
            proofTaken={proofTaken}
            onTakePhoto={() => setProofTaken(true)}
            onSubmit={() => {
              setShowProofModal(false);
              setProofTaken(false);
              releaseFunds();
              setShowVault(true);
            }}
            onClose={() => {
              setShowProofModal(false);
              setProofTaken(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Vault ritual — plays on release */}
      <ClayVaultLock open={showVault} message="Funds Released from Escrow." onClose={() => setShowVault(false)} />
    </div>
  );
}

/** Animated dollar figure — counts up on change, never janky. */
function YieldCounter({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `+$${v.toFixed(2)}`);

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.4, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, mv]);

  return (
    <motion.p className="font-headline text-3xl font-black tabular-nums text-[var(--sage)]">
      <motion.span>{text}</motion.span>
    </motion.p>
  );
}

/** Tap target for the "your money is working" tooltip. */
function TooltipBubble({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sage)] text-white shadow"
      aria-label={text}
    >
      <Info className="h-3.5 w-3.5" />
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.92 }}
            className="absolute right-0 top-8 z-20 w-52 rounded-xl bg-[var(--warm-ink)] px-3 py-2 text-left text-[11px] font-medium leading-snug text-[var(--cream)] shadow-[var(--shadow-modal)]"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

interface ProofModalProps {
  proofTaken: boolean;
  onTakePhoto: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

/** "Upload Proof" — simulated VCAP photo capture, then the vault unlocks. */
function ProofModal({ proofTaken, onTakePhoto, onSubmit, onClose }: ProofModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Upload proof of work"
    >
      <div className="absolute inset-0 bg-[rgba(42,37,32,0.6)] backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className="relative w-full max-w-md rounded-[var(--radius-card)] border border-dashed border-[var(--clay)]/60 bg-[var(--cream)] p-6 shadow-[var(--shadow-modal)]"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4">
          <X className="h-5 w-5 text-[var(--soft-stone)]" />
        </button>
        <h3 className="font-headline text-lg font-bold tracking-tight">Verify the work (VCAP)</h3>
        <p className="mt-1 text-xs text-[var(--soft-stone)]">
          Take a photo of the repaired pipe. VCAP uses on-chain verification to confirm the job before release.
        </p>

        <button
          onClick={onTakePhoto}
          className={`mt-4 flex aspect-video w-full items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
            proofTaken ? 'border-[var(--sage)] bg-[var(--sage)]/10' : 'border-[var(--clay)]/50 bg-[var(--warm-sand)]/50 hover:bg-[var(--warm-sand)]'
          }`}
        >
          {proofTaken ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-1.5 text-[var(--sage)]"
            >
              <Camera className="h-8 w-8" />
              <span className="font-label text-[10px] uppercase tracking-widest">Proof captured ✓</span>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-[var(--terracotta)]">
              <Upload className="h-8 w-8" />
              <span className="font-label text-[10px] uppercase tracking-widest">Simulate taking a photo</span>
            </div>
          )}
        </button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!proofTaken}
          onClick={onSubmit}
          className={`mt-4 w-full rounded-[var(--radius-btn)] py-3 font-label text-sm font-bold uppercase tracking-widest transition-colors ${
            proofTaken
              ? 'bg-[var(--clay)] text-[var(--cream)] shadow-[var(--shadow-btn)]'
              : 'cursor-not-allowed bg-[var(--warm-sand)] text-[var(--soft-stone)]'
          }`}
        >
          Verify &amp; Release $500
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
