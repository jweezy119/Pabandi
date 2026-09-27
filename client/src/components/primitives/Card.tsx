import React from 'react';

export function Card({ children, className = '', hover = false, noPadding = false, style, variant = 'default', padding, ...props }: any) {
  const variantClasses = {
    default: '',
    flat: 'clay-card--flat',
    pressed: 'clay-card--pressed',
  };

  return (
    <div
      className={`clay-card ${variantClasses[variant]} ${hover ? 'clay-card--interactive' : ''} ${className}`}
      style={{
        borderRadius: 'var(--radius-card)',
        background: variant === 'flat' ? 'var(--cream)' : variant === 'pressed' ? 'var(--cream)' : 'white',
        boxShadow: variant === 'flat' ? 'none' : variant === 'pressed' ? 'var(--shadow-pressed)' : 'var(--shadow-soft)',
        borderTop: '1px solid rgba(255, 255, 255, 0.6)',
        transition: 'transform 250ms var(--ease-smooth), box-shadow 250ms var(--ease-smooth), border-color 250ms ease',
        ...style,
      }}
      {...props}
    >
      <div className={noPadding ? '' : `p-${padding || '7'}`}>{children}</div>
    </div>
  );
}
