import React from 'react';
import { Link } from 'react-router-dom';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  icon?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  icon,
  className = '',
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-7 py-3.5 text-base gap-2.5',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--clay)',
      color: 'white',
      boxShadow: 'var(--shadow-btn)',
      border: 'none',
    },
    secondary: {
      background: 'rgba(232, 217, 197, 0.5)',
      color: 'var(--warm-ink)',
      boxShadow: '0 1px 3px rgba(180, 130, 90, 0.08)',
      border: '1px solid rgba(191, 179, 163, 0.3)',
    },
    danger: {
      background: 'var(--dusty-rose)',
      color: 'white',
      boxShadow: 'var(--shadow-btn)',
      border: 'none',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--soft-stone)',
      boxShadow: 'none',
      border: '1px solid transparent',
    },
  };

  const combinedClass = [
    'inline-flex items-center justify-center rounded-full font-bold',
    'transition-all duration-150',
    'select-none',
    sizeClasses[size],
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    className,
  ].join(' ');

  const combinedStyle: React.CSSProperties = {
    ...variantStyles[variant],
    transitionTimingFunction: 'var(--ease-clay)',
    ...style,
  };

  const content = (
    <>
      {icon && <span className="material-symbols-outlined text-[18px] align-[-3px]">{icon}</span>}
      {children}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={combinedClass} style={combinedStyle}>
        {content}
      </Link>
    );
  }

  return (
    <button className={combinedClass} style={combinedStyle} disabled={disabled} {...props}>
      {content}
    </button>
  );
}
