import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CLAY_HEAVY, CLAY_FADE } from './clayMotion';

interface ClayStampProps {
  children: React.ReactNode;
  /** Play the stamp exactly once when this flips from false → true. */
  stamped: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The "stamp" — used when an API action lands, e.g. a project post succeeds.
 *
 * The new card lands on screen like a fresco impression: a quick over-scale
 * (1.1) pressing down to rest (1.0) on the heavy vault spring, while a
 * terracotta border flashes once. Transform + opacity + paint only.
 * With `prefers-reduced-motion` it fades in plainly.
 */
export function ClayStamp({ children, stamped, className, style }: ClayStampProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <motion.div
        key={stamped ? 'stamped' : 'idle'}
        className={className}
        style={style}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={CLAY_FADE}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      key={stamped ? 'stamped' : 'idle'}
      className={className}
      style={style}
      initial={{ scale: 1.1, opacity: 0 }}
      animate={stamped ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={CLAY_HEAVY}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        initial={{ boxShadow: '0 0 0 0px rgba(198,92,54,0)' }}
        animate={
          stamped
            ? { boxShadow: ['0 0 0 3px rgba(198,92,54,0.85)', '0 0 0 0px rgba(198,92,54,0)'] }
            : { boxShadow: '0 0 0 0px rgba(198,92,54,0)' }
        }
        transition={stamped ? { duration: 0.6, ease: 'easeOut' } : CLAY_FADE}
      />
      {children}
    </motion.div>
  );
}
