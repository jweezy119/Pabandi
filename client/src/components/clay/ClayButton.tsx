import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CLAY_SPRING, CLAY_FADE } from '../animations/clayMotion';

interface ClayButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}

/**
 * Tactile button: pressing compresses the clay (scale 0.95) on a weighted
 * spring, so release "pops" back instead of snapping. Touch props are
 * transform-only for 60fps. Reduced motion: opacity feedback only.
 */
export function ClayButton({
  children,
  className = '',
  variant = 'primary',
  onClick,
  type = 'button',
  disabled = false,
}: ClayButtonProps) {
  const reduced = useReducedMotion();
  const base =
    'inline-flex items-center justify-center px-4 py-2 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-sm shadow-emerald-500/20',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
  } as const;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      whileTap={reduced ? undefined : { scale: 0.95 }}
      whileHover={reduced ? undefined : { scale: 1.03 }}
      transition={reduced ? CLAY_FADE : CLAY_SPRING}
      style={{ willChange: 'transform' }}
    >
      {children}
    </motion.button>
  );
}
