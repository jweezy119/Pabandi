import React from 'react';

interface ClayBadgeProps {
  label: string;
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export function ClayBadge({ label, variant = 'neutral', size = 'md', className = '' }: ClayBadgeProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    info: { backgroundColor: 'rgba(201,123,90,0.12)', color: 'var(--clay)', border: '1px solid rgba(201,123,90,0.2)' },
    success: { backgroundColor: 'rgba(138,154,123,0.15)', color: 'var(--sage)', border: '1px solid rgba(138,154,123,0.2)' },
    warning: { backgroundColor: 'rgba(217,168,84,0.15)', color: 'var(--muted-ochre)', border: '1px solid rgba(217,168,84,0.2)' },
    danger: { backgroundColor: 'rgba(212,165,165,0.15)', color: 'var(--dusty-rose)', border: '1px solid rgba(212,165,165,0.2)' },
    neutral: { backgroundColor: 'rgba(232,217,197,0.5)', color: 'var(--warm-ink)', border: '1px solid rgba(191,179,163,0.3)' },
  };

  const sizeStyles = {
    sm: { padding: '3px 8px', fontSize: '10px' },
    md: { padding: '4px 10px', fontSize: '11px' },
  };

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full ${className}`}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        fontFamily: 'var(--font-label)',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  );
}
