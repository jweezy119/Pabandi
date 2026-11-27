import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/**
 * Lightweight enter-only route transition.
 *
 * Deliberately does NOT use `<AnimatePresence mode="popLayout">`: wrapping a
 * live React Router `<Outlet />` with `React.lazy` routes inside
 * `AnimatePresence` leaves exiting `<motion.div>` nodes mounted when a lazy
 * chunk suspends or a nested `DashboardLayout` animation runs, causing each
 * stuck wrapper to render the current route and stack duplicate pages/sidebars.
 */
export function PageTransition({
  children,
  className = 'w-full min-h-full',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const location = useLocation();
  const reduced = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0.12 : 0.22,
        ease: [0.22, 1.0, 0.36, 1],
      }}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}
