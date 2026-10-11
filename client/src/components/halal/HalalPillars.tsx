import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

type Pillar = {
  icon: string;
  title: string;
  titleUr: string;
  desc: string;
  descUr: string;
  color: string;
};

const PILLARS: Pillar[] = [
  {
    icon: '🚫',
    title: 'No Riba (Interest)',
    titleUr: 'Koi Riba (Sood) Nahi',
    desc: 'No guaranteed fixed returns. All profit comes from real business activity, not from lending money for interest.',
    descUr: 'Koi fixed sood nahi. Munafa siraf haqeeqi business activity se ata hai.',
    color: 'from-red-500/20 to-red-500/5',
  },
  {
    icon: '📋',
    title: 'No Gharar (Uncertainty)',
    titleUr: 'Koi Gharar (Ghair Yakeeni) Nahi',
    desc: 'All contracts are transparent with clearly defined terms, assets, and profit-sharing ratios. No ambiguity.',
    descUr: 'Tamam contracts shaffaf hain, maqsood assets aur profit-sharing ratios ke saath.',
    color: 'from-blue-500/20 to-blue-500/5',
  },
  {
    icon: '🤝',
    title: 'No Maysir (Gambling)',
    titleUr: 'Koi Maysir (Juwa) Nahi',
    desc: 'Returns are tied to real economic activity — trading fees, asset appreciation, or genuine services. No speculation.',
    descUr: 'Returns haqeeqi economic activity se tied hain — trading fees, asset appreciation, ya genuine services.',
    color: 'from-emerald-500/20 to-emerald-500/5',
  },
];

type HalalPillarsProps = {
  compact?: boolean;
  className?: string;
};

export const HalalPillars: React.FC<HalalPillarsProps> = ({
  compact = false,
  className = '',
}) => {
  const { language } = useLanguage();

  if (compact) {
    return (
      <div className={`grid grid-cols-3 gap-2 ${className}`}>
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className={`rounded-lg bg-gradient-to-br ${p.color} border border-white/5 p-3 text-center`}
          >
            <div className="text-xl mb-1">{p.icon}</div>
            <div className="text-[10px] font-bold text-white/90 leading-tight">
              {language === 'en' ? p.title : p.titleUr}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {PILLARS.map((p) => (
        <div
          key={p.title}
          className={`rounded-2xl bg-gradient-to-br ${p.color} border border-white/8 p-5 hover:border-white/15 transition-all duration-300`}
        >
          <div className="text-3xl mb-3">{p.icon}</div>
          <h3 className="font-bold text-white/90 text-sm mb-2">
            {language === 'en' ? p.title : p.titleUr}
          </h3>
          <p className="text-xs text-white/60 leading-relaxed">
            {language === 'en' ? p.desc : p.descUr}
          </p>
        </div>
      ))}
    </div>
  );
};

export default HalalPillars;
