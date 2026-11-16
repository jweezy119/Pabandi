import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
        transition={{
          duration: reduced ? 0.12 : 0.22,
          ease: [0.22, 1.0, 0.36, 1],
        }}
        className="w-full min-h-full"
        style={{ willChange: 'transform, opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
