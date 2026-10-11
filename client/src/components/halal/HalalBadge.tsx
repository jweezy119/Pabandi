import React from 'react';

type HalalBadgeProps = {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'solid';
  className?: string;
  showIcon?: boolean;
};

const sizeMap = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

const variantMap = {
  default: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  outline: 'bg-transparent text-emerald-400 border-emerald-500/30',
  solid: 'bg-emerald-500 text-white border-emerald-500',
};

export const HalalBadge: React.FC<HalalBadgeProps> = ({
  size = 'md',
  variant = 'default',
  className = '',
  showIcon = true,
}) => {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold tracking-wide ${sizeMap[size]} ${variantMap[variant]} ${className}`}
    >
      {showIcon && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      )}
      Halal
    </span>
  );
};

export default HalalBadge;
