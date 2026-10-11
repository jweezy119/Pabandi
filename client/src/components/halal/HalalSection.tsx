import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { HalalBadge, HalalPillars } from './index';

type HalalSectionProps = {
  variant?: 'booking' | 'freight' | 'property' | 'crm' | 'capital';
  compact?: boolean;
  className?: string;
};

const VARIANT_HEADLINES: Record<string, { title: string; titleUr: string; subtitle: string; subtitleUr: string }> = {
  booking: {
    title: 'Halal Booking, Secured by Escrow',
    titleUr: 'Halal Booking, Escrow se Secured',
    subtitle: 'Every booking is backed by a smart contract. No interest, no speculation — just fair deposit protection and commitment.',
    subtitleUr: 'Har booking smart contract se backed hai. Koi sood nahi, koi speculation nahi.',
  },
  freight: {
    title: 'Halal Freight, Secured by Escrow',
    titleUr: 'Halal Freight, Escrow se Secured',
    subtitle: 'Shipment payments held in escrow until delivery is verified. Both shipper and carrier protected by halal smart contracts.',
    subtitleUr: 'Shipment payments escrow mein held hain jab tak delivery verify na ho.',
  },
  property: {
    title: 'Halal Property, Secured by Escrow',
    titleUr: 'Halal Property, Escrow se Secured',
    subtitle: 'Rent, leases, and property deals all flow through escrow. Transparent, halal, and backed by real assets.',
    subtitleUr: 'Rent, leases, aur property deals sab escrow se flow hoti hain.',
  },
  crm: {
    title: 'Halal Business, Secured by Trust',
    titleUr: 'Halal Business, Trust se Secured',
    subtitle: 'Every deal is backed by your Trust Passport. Clients verify your reliability before committing. No hidden terms.',
    subtitleUr: 'Har deal aapke Trust Passport se backed hai. Clients commit karne se pehle verify karte hain.',
  },
  capital: {
    title: 'Halal Capital, Secured by Transparency',
    titleUr: 'Halal Capital, Transparency se Secured',
    subtitle: 'Every expense and income recorded transparently. Profit-sharing calculated openly — no hidden fees, no interest.',
    subtitleUr: 'Har expense aur income transparently record hota hai. Koi hidden fees nahi, koi sood nahi.',
  },
};

export const HalalSection: React.FC<HalalSectionProps> = ({
  variant = 'booking',
  compact = false,
  className = '',
}) => {
  const { language } = useLanguage();
  const headline = VARIANT_HEADLINES[variant];

  if (compact) {
    return (
      <div className={`rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <HalalBadge size="sm" />
          <span className="text-xs font-bold text-emerald-300">
            {language === 'en' ? headline.title : headline.titleUr}
          </span>
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed">
          {language === 'en' ? headline.subtitle : headline.subtitleUr}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-gradient-to-br from-emerald-500/8 via-transparent to-teal-500/5 border border-emerald-500/15 p-6 md:p-8 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <HalalBadge size="lg" />
        <div>
          <h2 className="text-xl font-bold text-white/90">
            {language === 'en' ? headline.title : headline.titleUr}
          </h2>
          <p className="text-sm text-white/50 mt-1">
            {language === 'en' ? headline.subtitle : headline.subtitleUr}
          </p>
        </div>
      </div>
      <HalalPillars />
    </div>
  );
};

export default HalalSection;
