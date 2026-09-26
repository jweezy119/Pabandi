import React from 'react';

export function Chip({ label, variant = 'neutral', className = '' }: { label: string, variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral', className?: string }) {
  const variants = {
    success: 'bg-[var(--sage)]/20 text-[var(--sage)]',
    warning: 'bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)]',
    danger: 'bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)]',
    info: 'bg-[var(--clay)]/20 text-[var(--clay)]',
    neutral: 'bg-[var(--warm-sand)] text-[var(--warm-ink)]',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${variants[variant]} ${className}`}>
      {label}
    </span>
  );
}
