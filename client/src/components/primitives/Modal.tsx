import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export function Modal({ isOpen, onClose, title, children, actionText, onAction, actionVariant = 'primary' }: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(42, 37, 32, 0.25)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal card */}
          <motion.div
            className="relative w-full max-w-md bg-white clay-card"
            style={{
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-modal)',
              borderTop: '1px solid rgba(255, 255, 255, 0.6)',
              padding: 'var(--space-card-padding)',
            }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.3, ease: [0.34, 1.4, 0.64, 1] }}
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 rounded-full p-1.5 clay-card--interactive transition-all duration-150"
              style={{ color: 'var(--soft-stone)', backgroundColor: 'rgba(232, 217, 197, 0.3)' }}
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-[18px] hover:text-[var(--warm-ink)]">close</span>
            </button>
            <h2 className="text-xl font-bold mb-4 clay-heading">
              {title}
            </h2>
            <div className="mb-6">{children}</div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              {onAction && <Button variant={actionVariant} onClick={onAction}>{actionText}</Button>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
