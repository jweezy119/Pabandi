import React from 'react';

interface ChipProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
  icon?: string;
}

export function Chip({ label, variant = 'neutral', size = 'md', className = '', icon }: ChipProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    success: { backgroundColor: 'rgba(138, 154, 123, 0.15)', color: 'var(--sage)', border: '1px solid rgba(138, 154, 123, 0.2)' },
    warning: { backgroundColor: 'rgba(217, 168, 84, 0.15)', color: 'var(--muted-ochre)', border: '1px solid rgba(217, 168, 84, 0.2)' },
    danger:  { backgroundColor: 'rgba(212, 165, 165, 0.15)', color: 'var(--dusty-rose)', border: '1px solid rgba(212, 165, 165, 0.2)' },
    info:    { backgroundColor: 'rgba(201, 123, 90, 0.12)', color: 'var(--clay)', border: '1px solid rgba(201, 123, 90, 0.2)' },
    neutral: { backgroundColor: 'rgba(232, 217, 197, 0.5)', color: 'var(--warm-ink)', border: '1px solid rgba(191, 179, 163, 0.3)' },
  };

  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-[11px]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider ${sizeClasses[size]} ${className}`}
      style={{
        ...variantStyles[variant],
        fontFamily: 'var(--font-label)',
      }}
    >
      {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
      {label}
    </span>
  );
}
