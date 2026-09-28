'use client';

import { motion, AnimatePresence } from 'framer-motion';

export interface MorphItemProps {
  children: React.ReactNode;
  isVisible: boolean;
  index?: number;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export function MorphItem({ children, isVisible, index = 0, direction = 'vertical', className = '' }: MorphItemProps) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="item"
          initial={{ opacity: 0, y: direction === 'vertical' ? 20 : 0, x: direction === 'horizontal' ? 20 : 0, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={{ opacity: 0, y: direction === 'vertical' ? -20 : 0, x: direction === 'horizontal' ? -20 : 0, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 30,
            delay: index * 0.06,
            duration: 0.3,
          }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface MorphListProps {
  children: React.ReactNode;
  className?: string;
}

export function MorphList({ children, className = '' }: MorphListProps) {
  return (
    <motion.div
      layout
      className={`flex flex-col gap-3 ${className}`}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 30,
        duration: 0.3,
      }}
    >
      {children}
    </motion.div>
  );
}

export interface SlideInOutProps {
  children: React.ReactNode;
  isOpen: boolean;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export function SlideInOut({ children, isOpen, direction = 'right', className = '' }: SlideInOutProps) {
  const x = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const y = direction === 'top' ? -1 : direction === 'bottom' ? 1 : 0;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: x * 300, y: y * 300 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: x * 300, y: y * 300 }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 30,
            duration: 0.3,
          }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function StaggerContainer({ children, staggerDelay = 0.06, className = '' }: StaggerContainerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: staggerDelay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  scale?: boolean;
}

export function StaggerItem({ children, className = '', scale = true }: StaggerItemProps) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20, scale: scale ? 0.95 : 1 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: 'spring',
            stiffness: 380,
            damping: 30,
            duration: 0.3,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export interface CollapseProps {
  children: React.ReactNode;
  isOpen: boolean;
  className?: string;
}

export function Collapse({ children, isOpen, className = '' }: CollapseProps) {
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 30,
            duration: 0.3,
          }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface FadeInOutProps {
  children: React.ReactNode;
  isVisible: boolean;
  className?: string;
}

export function FadeInOut({ children, isVisible, className = '' }: FadeInOutProps) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.9, 0.35, 1] }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useReducedMotion() {
  if (typeof window === 'undefined') return false;
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const [reduceMotion, setReduceMotion] = React.useState(mediaQuery.matches);
  React.useEffect(() => {
    const handler = () => setReduceMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  return reduceMotion;
}

import React from 'react';