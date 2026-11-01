/**
 * Shared "warm clay physics" motion primitives.
 *
 * Every tactile animation in the app should source its springs from here so
 * the whole UI feels like the same weighted material — not a mix of robotic
 * CSS linear transitions. All values animate `transform` / `opacity` / paint
 * only (never layout: width, height, top) to keep frames at 60fps.
 *
 * `prefers-reduced-motion` is respected everywhere: when reduced, callers
 * swap to a plain opacity fade with zero transform / spring.
 */
import { useReducedMotion } from 'framer-motion';
import type { Transition, Variants } from 'framer-motion';

/** Default "weighted clay" spring — the house feel for hover/snap. */
export const CLAY_SPRING = { type: 'spring', stiffness: 300, damping: 20 } as const;

/** Softer settle for cards landing in lists (post-drag, post-layout). */
export const CLAY_SETTLE = { type: 'spring', stiffness: 260, damping: 26 } as const;

/** Heavy, weighty spring for the vault lock drop — stone sealing a vault. */
export const CLAY_HEAVY = { type: 'spring', stiffness: 280, damping: 14, mass: 1.4 } as const;

/** Spring used while dragging a card — the "pull in" resistance. */
export const CLAY_DRAG = { type: 'spring', stiffness: 400, damping: 28 } as const;

/** Simple fade transition for prefers-reduced-motion. */
export const CLAY_FADE = { duration: 0.2, ease: 'linear' } as const;

/** Pick the right transition for the motion preference. */
export function clayTransition(reduced: boolean | null): Transition {
  return reduced ? CLAY_FADE : CLAY_SPRING;
}

/** Hover/lift variants for card-sized surfaces. Uses paint-safe props only. */
export function clayHoverVariants(reduced: boolean | null, deepShadow: string): Variants {
  if (reduced) {
    return { rest: {}, hover: {} };
  }
  return {
    rest: { y: 0, scale: 1, boxShadow: '0 4px 14px rgba(180,130,90,0.12)' },
    hover: { y: -4, scale: 1.02, boxShadow: deepShadow },
  };
}

/** Convenience hook so components spell `useReducedMotion` the same way. */
export function useClayMotion(): { reduced: boolean | null } {
  const reduced = useReducedMotion();
  return { reduced };
}

/** Max tilt (degrees) for the pointer-tracking card tilt. Spec: 2deg. */
export const CLAY_TILT_MAX_DEG = 2;
