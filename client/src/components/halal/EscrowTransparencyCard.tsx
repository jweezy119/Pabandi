import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

type EscrowTransparencyCardProps = {
  variant?: 'booking' | 'freight' | 'property' | 'crm' | 'capital';
  compact?: boolean;
  className?: string;
};

const VARIANT_CONTENT: Record<string, { title: string; titleUr: string; desc: string; descUr: string; icon: string }> = {
  booking: {
    title: 'Escrow-Backed Booking',
    titleUr: 'Escrow-Booked Booking',
    desc: 'Your deposit is locked in a smart contract. It only releases to the business when you check in. No-shows are covered by the trust pool.',
    descUr: 'Aapka deposit smart contract mein lock hai. Yeh tabhi release hota hai jab aap check in karte hain.',
    icon: '📅',
  },
  freight: {
    title: 'Escrow-Backed Shipment',
    titleUr: 'Escrow-Backed Shipment',
    desc: 'Payment is held in escrow until the shipment is delivered and verified. Both shipper and carrier are protected.',
    descUr: 'Payment escrow mein held hai jab tak shipment deliver aur verify na ho.',
    icon: '📦',
  },
  property: {
    title: 'Escrow-Backed Lease',
    titleUr: 'Escrow-Backed Lease',
    desc: 'Rent payments flow through escrow. The landlord gets paid on time, the tenant gets receipts. No cash, no disputes.',
    descUr: 'Rent payments escrow se flow hoti hain. Landlord ko waqt par milta hai, tenant ko receipts milte hain.',
    icon: '🏠',
  },
  crm: {
    title: 'Trust-Backed Deal',
    titleUr: 'Trust-Backed Deal',
    desc: 'Every deal is backed by your Trust Passport. Clients can verify your reliability before committing.',
    descUr: 'Har deal aapke Trust Passport se backed hai. Clients commit karne se pehle aapki reliability verify kar sakte hain.',
    icon: '🤝',
  },
  capital: {
    title: 'Transparent Ledger',
    titleUr: 'Shaffaf Ledger',
    desc: 'Every expense and income is recorded transparently. Profit-sharing is calculated openly — no hidden fees.',
    descUr: 'Har expense aur income transparently record hota hai. Profit-sharing openly calculate hoti hai.',
    icon: '📊',
  },
};

export const EscrowTransparencyCard: React.FC<EscrowTransparencyCardProps> = ({
  variant = 'booking',
  compact = false,
  className = '',
}) => {
  const { language } = useLanguage();
  const content = VARIANT_CONTENT[variant];

  if (compact) {
    return (
      <div className={`rounded-xl bg-white/[0.03] border border-white/8 p-3 flex items-center gap-3 ${className}`}>
        <span className="text-xl">{content.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white/90 truncate">
            {language === 'en' ? content.title : content.titleUr}
          </p>
          <p className="text-[10px] text-white/50 truncate">
            {language === 'en' ? content.desc : content.descUr}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-gradient-to-br from-emerald-500/8 to-teal-500/5 border border-emerald-500/15 p-5 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="text-3xl">{content.icon}</div>
        <div className="flex-1">
          <h3 className="font-bold text-white/90 text-base mb-2">
            {language === 'en' ? content.title : content.titleUr}
          </h3>
          <p className="text-sm text-white/60 leading-relaxed">
            {language === 'en' ? content.desc : content.descUr}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              🛡️ Halal
            </span>
            <span className="text-[10px] font-bold text-emerald-400/70">
              No Riba · No Gharar · No Maysir
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EscrowTransparencyCard;
