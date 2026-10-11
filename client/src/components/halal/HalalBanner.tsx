import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

type HalalBannerProps = {
  variant?: 'info' | 'success' | 'warning';
  compact?: boolean;
  className?: string;
};

const variantStyles = {
  info: 'bg-emerald-500/8 border-emerald-500/20 text-emerald-300',
  success: 'bg-emerald-500/12 border-emerald-500/25 text-emerald-200',
  warning: 'bg-amber-500/8 border-amber-500/20 text-amber-300',
};

const iconStyles = {
  info: '🛡️',
  success: '✅',
  warning: '⚠️',
};

export const HalalBanner: React.FC<HalalBannerProps> = ({
  variant = 'info',
  compact = false,
  className = '',
}) => {
  const { t } = useLanguage();

  return (
    <div
      className={`rounded-xl border ${variantStyles[variant]} ${compact ? 'px-3 py-2' : 'px-4 py-3'} flex items-start gap-3 ${className}`}
    >
      <span className="text-lg leading-none mt-0.5">{iconStyles[variant]}</span>
      <div className={compact ? 'text-xs' : 'text-sm'}>
        <p className="font-semibold">
          {t(
            'Sharia-Compliant by Design',
            'Sharia ke mutabiq tayar karda'
          )}
        </p>
        {!compact && (
          <p className="mt-1 opacity-80 leading-relaxed">
            {t(
              'No Riba (interest), no Gharar (excessive uncertainty), no Maysir (gambling). Every transaction is backed by real economic activity and profit-sharing.',
              'Koi Riba (sood) nahi, koi Gharar (ghair yakeeni) nahi, koi Maysir (juwa) nahi. Har transaction haqeeqi economic activity aur profit-sharing se backed hai.'
            )}
          </p>
        )}
      </div>
    </div>
  );
};

export default HalalBanner;
