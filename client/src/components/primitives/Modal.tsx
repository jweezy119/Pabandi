import React from 'react';
import { Button } from './Button';

export function Modal({ isOpen, onClose, title, children, actionText, onAction, actionVariant = 'primary' }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--warm-ink)]/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[28px] w-full max-w-md p-6 relative" style={{ boxShadow: 'var(--shadow-soft)' }}>
        <button onClick={onClose} className="absolute top-6 right-6 text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">{title}</h2>
        <div className="mb-6">{children}</div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {onAction && <Button variant={actionVariant} onClick={onAction}>{actionText}</Button>}
        </div>
      </div>
    </div>
  );
}
