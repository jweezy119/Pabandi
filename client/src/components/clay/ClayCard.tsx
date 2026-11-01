import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CLAY_SPRING,
  CLAY_FADE,
  CLAY_TILT_MAX_DEG,
} from '../animations/clayMotion';

interface ClayCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const BASE_SHADOW = '0 4px 14px rgba(180,130,90,0.12)';
const DEEP_SHADOW = '0 12px 28px rgba(180,130,90,0.28)';

type Tilt = { rotateX: number; rotateY: number };
const TILT_REST: Tilt = { rotateX: 0, rotateY: 0 };

/**
 * The weighted-clay card primitive.
 *
 * Hover: lifts (y -4), breathes (scale 1.02) and deepens the warm shadow on a
 * stiffness-300 / damping-20 spring. Pointer tilt follows the cursor up to
 * 2deg using rotateX/rotateY — transform-only, so the card stays composited
 * and rendered at 60fps (never layout props like width/height/top).
 * With `prefers-reduced-motion` the card does not lift, tilt or spring.
 */
export function ClayCard({
  children,
  className = '',
  hover = true,
  onClick,
}: ClayCardProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<Tilt>(TILT_REST);

  if (!hover) {
    return (
      <div className={`rounded-3xl ${className}`} onClick={onClick}>
        {children}
      </div>
    );
  }

  const onPointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    // -1..1 around the card's center, capped at the tilt maximum.
    const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const py = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setTilt({
      rotateY: px * CLAY_TILT_MAX_DEG,
      rotateX: -py * CLAY_TILT_MAX_DEG,
    });
  };

  const tiltTarget: Tilt =
    reduced || (tilt.rotateX === 0 && tilt.rotateY === 0)
      ? TILT_REST
      : tilt;

  return (
    <motion.div
      ref={ref}
      className={`rounded-3xl ${className}`}
      onClick={onClick}
      style={{ transformPerspective: 800, willChange: 'transform' }}
      onMouseMove={onPointerMove}
      onMouseLeave={() => setTilt(TILT_REST)}
      // Tilt follows the pointer; the hover lift composes on top because the
      // two animations never touch the same properties.
      animate={{
        rotateX: tiltTarget.rotateX,
        rotateY: tiltTarget.rotateY,
        boxShadow: BASE_SHADOW,
      }}
      whileHover={reduced ? undefined : { y: -4, scale: 1.02, boxShadow: DEEP_SHADOW }}
      transition={reduced ? CLAY_FADE : CLAY_SPRING}
    >
      {children}
    </motion.div>
  );
}
