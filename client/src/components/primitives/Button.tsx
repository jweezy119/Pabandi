import React from 'react';
import { Link } from 'react-router-dom';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  href?: string;
  icon?: string;
}

export function Button({ variant = 'primary', href, icon, className = '', children, ...props }: ButtonProps) {
  const baseStyle = "inline-flex items-center justify-center px-4 py-2 rounded-full font-bold transition-all text-sm gap-2";
  const variants = {
    primary: "bg-[var(--clay)] text-white hover:opacity-90",
    secondary: "bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]",
    danger: "bg-[var(--dusty-rose)] text-white hover:opacity-90",
    ghost: "text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]/50 hover:text-[var(--warm-ink)]",
  };

  const combinedClass = `${baseStyle} ${variants[variant]} ${className}`;

  const content = (
    <>
      {icon && <span className="material-symbols-outlined text-[18px] align-[-3px]">{icon}</span>}
      {children}
    </>
  );

  if (href) {
    return <Link to={href} className={combinedClass}>{content}</Link>;
  }

  return <button className={combinedClass} {...props}>{content}</button>;
}
