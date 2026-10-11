import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Badge } from '../../design-system';

type HalalStakingInfoProps = {
  compact?: boolean;
  className?: string;
};

export const HalalStakingInfo: React.FC<HalalStakingInfoProps> = ({
  compact = false,
  className = '',
}) => {
  const { language } = useLanguage();

  if (compact) {
    return (
      <div className={`rounded-xl bg-white/[0.03] border border-white/8 p-3 ${className}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">💰</span>
          <span className="text-xs font-bold text-white/90">
            {language === 'en' ? 'Halal Staking' : 'Halal Staking'}
          </span>
        </div>
        <p className="text-[10px] text-white/50 leading-relaxed">
          {language === 'en'
            ? 'Stake $PAB to earn profit-sharing from platform revenue. No fixed interest — pure Mudarabah.'
            : '$PAB stake karein aur platform revenue se profit-sharing kamayein. Koi fixed interest nahi — siraf Mudarabah.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-gradient-to-br from-indigo-500/8 to-purple-500/5 border border-indigo-500/15 p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">💰</span>
        <div>
          <h3 className="font-bold text-white/90 text-base">
            {language === 'en' ? 'Halal Staking — Mudarabah Model' : 'Halal Staking — Mudarabah Model'}
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            {language === 'en'
              ? 'Stake $PAB to earn profit-sharing from platform revenue. No fixed interest — pure Mudarabah.'
              : '$PAB stake karein aur platform revenue se profit-sharing kamayein. Koi fixed interest nahi — siraf Mudarabah.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
          <div className="text-lg mb-1">📊</div>
          <div className="text-xs font-bold text-white/80 mb-1">
            {language === 'en' ? 'Real Revenue Share' : 'Real Revenue Share'}
          </div>
          <p className="text-[10px] text-white/50 leading-relaxed">
            {language === 'en'
              ? 'Earn a proportional share of actual platform revenue from bookings, freight, and services.'
              : 'Bookings, freight, aur services se haqeeqi platform revenue ka hissa kamayein.'}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
          <div className="text-lg mb-1">⚖️</div>
          <div className="text-xs font-bold text-white/80 mb-1">
            {language === 'en' ? 'Risk-Sharing' : 'Risk-Sharing'}
          </div>
          <p className="text-[10px] text-white/50 leading-relaxed">
            {language === 'en'
              ? 'If the platform earns no revenue, stakers earn no profit. Shared risk and reward.'
              : 'Agar platform revenue nahi kamata, toh stakers ko bhi munafa nahi milta. Mushtarika risk.'}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
          <div className="text-lg mb-1">🛡️</div>
          <div className="text-xs font-bold text-white/80 mb-1">
            {language === 'en' ? 'No Riba' : 'Koi Riba Nahi'}
          </div>
          <p className="text-[10px] text-white/50 leading-relaxed">
            {language === 'en'
              ? 'Unlike traditional DeFi, no guaranteed fixed returns. Profit comes from real economic activity.'
              : 'Traditional DeFi ke kabil nahi, koi fixed returns nahi. Munafa haqeeqi economic activity se ata hai.'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Badge tone="success" className="text-[10px]">
          🛡️ Sharia-Compliant
        </Badge>
        <span className="text-[10px] text-white/40">
          {language === 'en'
            ? 'Mudarabah profit-sharing · No interest · No speculation'
            : 'Mudarabah profit-sharing · Koi sood nahi · Koi speculation nahi'}
        </span>
      </div>
    </div>
  );
};

export default HalalStakingInfo;
