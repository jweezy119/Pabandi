import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ClayDustProps {
  /** Fire the burst when this flips from false → true (keyed, one-shot). */
  burst: boolean;
  /** Terracotta family tints — clay dust, not neon confetti. */
  colors?: string[];
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_COLORS = ['#C65C36', '#D9A854', '#8A9A7B', '#B47A5E', '#E0C3A3'];

/**
 * A short clay-dust particle burst (think a handful of warm pigment kicked
 * into the air) for moment-of-success feedback, e.g. a bid being accepted.
 *
 * Pure framer-motion particles animating transform (`x`, `y`, `scale`,
 * `rotate`) and `opacity` — no layout properties — so the burst stays on a
 * compositor layer. With `prefers-reduced-motion` nothing renders at all
 * beyond a flat fade.
 */
export function ClayDust({ burst, colors = DEFAULT_COLORS, count = 14, className, style }: ClayDustProps) {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div className={`pointer-events-none overflow-visible ${className ?? ''}`} style={style} aria-hidden>
      {burst &&
        Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.15; // slightly irregular fan
          const distance = 46 + ((i * 37) % 30); // pseudo-random 46–75px reach
          const size = 4 + ((i * 13) % 5);
          return (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                left: '50%',
                top: '50%',
                background: colors[i % colors.length],
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 0.95, rotate: 0 }}
              animate={{
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance + 18, // gravity bias downward
                scale: 0.3,
                opacity: 0,
                rotate: (i % 2 ? 1 : -1) * 90,
              }}
              transition={{ duration: 0.85 + (i % 4) * 0.12, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        })}
    </div>
  );
}
