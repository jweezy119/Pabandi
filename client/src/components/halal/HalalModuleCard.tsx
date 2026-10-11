import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { Badge } from '../../design-system';

type HalalModuleCardProps = {
  variant: 'booking' | 'freight' | 'property' | 'crm' | 'capital';
  className?: string;
};

const MODULE_CONTENT: Record<string, { title: string; titleUr: string; desc: string; descUr: string; icon: string; path: string; halalFeature: string; halalFeatureUr: string }> = {
  booking: {
    title: 'BookingOS',
    titleUr: 'BookingOS',
    desc: 'Book with trust. Escrow-backed deposits, halal profit-sharing on every transaction.',
    descUr: 'Trust ke saath book karein. Escrow-backed deposits, har transaction par halal profit-sharing.',
    icon: '📅',
    path: '/booking',
    halalFeature: 'Mudarabah profit-sharing on booking revenue',
    halalFeatureUr: 'Booking revenue par Mudarabah profit-sharing',
  },
  freight: {
    title: 'FreightOS',
    titleUr: 'FreightOS',
    desc: 'Move with escrow. Shippers pay into escrow, carriers get paid on delivery.',
    descUr: 'Escrow se move karein. Shippers escrow mein pay karte hain, carriers delivery par paise lete hain.',
    icon: '📦',
    path: '/freight',
    halalFeature: 'Wakala agency model for shipment tracking',
    halalFeatureUr: 'Shipment tracking ke liye Wakala agency model',
  },
  property: {
    title: 'PropertyOS',
    titleUr: 'PropertyOS',
    desc: 'Buy, rent, manage with trust. Every deal escrow-backed, halal financing options.',
    descUr: 'Trust ke saath kharidein, rent karein, manage karein. Har deal escrow-backed, halal financing options.',
    icon: '🏠',
    path: '/property',
    halalFeature: 'Murabaha asset-backed financing for properties',
    halalFeatureUr: 'Properties ke liye Murabaha asset-backed financing',
  },
  crm: {
    title: 'Contact OS',
    titleUr: 'Contact OS',
    desc: 'Every relationship, one trusted record. Halal business practices baked in.',
    descUr: 'Har relationship, ek trusted record. Halal business practices baked in.',
    icon: '🤝',
    path: '/contact',
    halalFeature: 'Musharakah joint ventures on deals',
    halalFeatureUr: 'Deals par Musharakah joint ventures',
  },
  capital: {
    title: 'CapitalOS',
    titleUr: 'CapitalOS',
    desc: 'Track with clarity. Transparent ledger, no interest, no hidden fees.',
    descUr: 'Clarity se track karein. Shaffaf ledger, koi sood nahi, koi hidden fees nahi.',
    icon: '📊',
    path: '/capital',
    halalFeature: 'Ijarah leasing for equipment & assets',
    halalFeatureUr: 'Equipment & assets ke liye Ijarah leasing',
  },
};

export const HalalModuleCard: React.FC<HalalModuleCardProps> = ({
  variant,
  className = '',
}) => {
  const { language } = useLanguage();
  const content = MODULE_CONTENT[variant];

  return (
    <Link
      to={content.path}
      className={`block rounded-2xl bg-white/[0.03] border border-white/8 p-5 hover:border-emerald-500/25 hover:bg-emerald-500/[0.03] transition-all duration-300 group ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{content.icon}</span>
        <Badge tone="success" className="text-[10px]">
          🛡️ Halal
        </Badge>
      </div>
      <h3 className="font-bold text-white/90 text-base mb-1 group-hover:text-emerald-300 transition-colors">
        {content.title}
      </h3>
      <p className="text-xs text-white/50 leading-relaxed mb-3">
        {language === 'en' ? content.desc : content.descUr}
      </p>
      <div className="text-[10px] font-semibold text-emerald-400/80 bg-emerald-500/8 rounded-lg px-2 py-1">
        {language === 'en' ? content.halalFeature : content.halalFeatureUr}
      </div>
    </Link>
  );
};

export default HalalModuleCard;
