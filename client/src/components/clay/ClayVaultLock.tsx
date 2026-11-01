import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CLAY_HEAVY, CLAY_FADE } from '../animations/clayMotion';

interface ClayVaultLockProps {
  /** Whether the vault ritual is on screen. */
  open: boolean;
  /** Called when the user closes (or after auto-dismiss when `autoDismissMs` set). */
  onClose: () => void;
  /** Optional headline override. */
  message?: string;
  /** Auto-dismiss delay (ms). Default 2600 — enough to see the seal land. */
  autoDismissMs?: number;
}

const WARM_GREEN = 'rgba(105,131,98,0.55)'; // sage glow
const TERRACOTTA = 'rgba(198,92,54,0.45)'; // terracotta glow

/**
 * The "Lock In" — the most important moment in the product.
 *
 * When escrow funds move, this overlay seals the screen: a padlock (open
 * shackle hangs open) is raised high, then drops like a stone on the heavy
 * mass-1.4 spring, its shackle snapping closed at the moment of impact. Two
 * warm glows (sage + terracotta) pulse outward from the seal, and
 * "Funds Secured in Escrow." fades in after the stone has landed.
 *
 * Everything animates transform/opacity/box-shadow only — 60fps on a
 * compositor layer. With `prefers-reduced-motion`: a plain opacity fade of
 * the finished locked state, no drop, no spring.
 */
export function ClayVaultLock({ open, onClose, message, autoDismissMs = 2600 }: ClayVaultLockProps) {
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [open, autoDismissMs, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center"
          style={{ willChange: 'opacity' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="presentation"
        >
          {/* Dimmed, warm backdrop — the vault walls */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 42%, rgba(60,45,36,0.82), rgba(30,24,19,0.94))',
              backdropFilter: 'blur(6px)',
            }}
          />

          <div className="relative flex flex-col items-center">
            {/* Pulse rings behind the padlock */}
            {!reduced && <VaultPulseRings />}

            {/* The stone — padlock raised high, dropped with heavy mass */}
            <motion.div
              initial={reduced ? { y: 0, scale: 1, opacity: 1 } : { y: -120, scale: 1.06, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { y: 6, scale: 0.98, opacity: 0 }}
              transition={reduced ? CLAY_FADE : CLAY_HEAVY}
              style={{ willChange: 'transform' }}
              aria-label={message ?? 'Funds Secured in Escrow'}
            >
              <VaultPadlock reduced={!!reduced} />
            </motion.div>

            {/* Impact flash — sage/terracotta glow at the moment of seal */}
            {!reduced && (
              <motion.div
                aria-hidden
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 300,
                  height: 300,
                  top: '50%',
                  left: '50%',
                  marginLeft: -150,
                  marginTop: -150,
                  background: `radial-gradient(circle, ${WARM_GREEN} 0%, ${TERRACOTTA} 55%, transparent 72%)`,
                }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{
                  opacity: [0, 0.9, 0],
                  scale: [0.4, 1.15, 1.55],
                }}
                transition={{
                  delay: 0.28, // lands with the stone
                  duration: 0.9,
                  ease: 'easeOut',
                }}
              />
            )}

            {/* Text after the stone lands — physically earned, so it waits */}
            <motion.p
              className="relative mt-8 font-headline text-xl text-[var(--cream)] text-center px-6"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={
                reduced
                  ? { delay: 0.05, ...CLAY_FADE }
                  : { delay: 0.55, ...{ type: 'spring', stiffness: 260, damping: 24 } }
              }
            >
              {message ?? 'Funds Secured in Escrow.'}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Two staggered warm glow rings pulsing outward from beneath the padlock. */
function VaultPulseRings() {
  const spreads = [
    { color: WARM_GREEN, delay: 0.35, duration: 1.6 },
    { color: TERRACOTTA, delay: 0.6, duration: 1.9 },
  ];
  return (
    <div aria-hidden className="absolute pointer-events-none" style={{ top: '42%', left: '50%' }}>
      {spreads.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2"
          style={{
            width: 90,
            height: 90,
            marginLeft: -45,
            marginTop: -65,
            borderColor: s.color,
          }}
          initial={{ opacity: 0.7, scale: 0.5 }}
          animate={{ opacity: 0, scale: 3.4 }}
          transition={{
            delay: s.delay,
            duration: s.duration,
            repeat: Infinity,
            repeatDelay: 0.7,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

/**
 * The padlock glyph. The body is the stone; the shackle is animated from an
 * open arc (raised, swung aside) to a closed lock on the heavy spring —
 * the morph from "open" to "locked".
 */
function VaultPadlock({ reduced }: { reduced: boolean }) {
  const body = 'M18 34h28a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V38a4 4 0 0 1 4-4Z';
  return (
    <svg width="84" height="84" viewBox="0 0 64 64" fill="none" aria-hidden>
      <motion.path
        d={body}
        fill="var(--clay, #C65C36)"
        stroke="rgba(255,240,225,0.35)"
        strokeWidth="1.5"
        initial={reduced ? undefined : { scale: 1 }}
        animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
        transition={reduced ? undefined : { delay: 0.26, duration: 0.45 }}
        style={{ originX: '32px', originY: '46px' }}
      />
      {/* Shackle: open (chest tilt) → closed (sealed) */}
      <motion.path
        d="M23 34V21a9 9 0 0 1 18 0v13"
        stroke="rgba(240,225,210,0.9)"
        strokeWidth="4.5"
        strokeLinecap="round"
        initial={reduced ? undefined : { rotate: 14, y: -2, pathLength: 0.9 }}
        animate={{ rotate: 0, y: 0, pathLength: 1 }}
        transition={reduced ? { ...CLAY_FADE, delay: 0.1 } : CLAY_HEAVY}
        style={{ originX: '32px', originY: '34px' }}
      />
      {/* Keyhole */}
      <circle cx="32" cy="44" r="3.4" fill="rgba(60,40,30,0.75)" />
      <rect x="30.8" y="46" width="2.4" height="6" rx="1.2" fill="rgba(60,40,30,0.75)" />
    </svg>
  );
}

export default ClayVaultLock;
