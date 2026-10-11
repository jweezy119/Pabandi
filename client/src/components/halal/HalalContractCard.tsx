import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

type ContractType = 'mudarabah' | 'musharakah' | 'wakala' | 'murabaha' | 'ijarah';

type HalalContractCardProps = {
  contract: ContractType;
  compact?: boolean;
  className?: string;
};

const CONTRACTS: Record<ContractType, { name: string; nameUr: string; desc: string; descUr: string; useCase: string; useCaseUr: string; icon: string }> = {
  mudarabah: {
    name: 'Mudarabah',
    nameUr: 'مضاربة',
    desc: 'Profit-sharing partnership. Capital provider + manager. Profits split pre-agreed. Losses borne by capital provider (unless negligence).',
    descUr: 'Munafa-sharing partnership. Capital provider + manager. Munafa pre-agreed ratio se taqseem hota hai.',
    useCase: 'Managed profit-sharing vaults, curated yield strategies',
    useCaseUr: 'Managed profit-sharing vaults, curated yield strategies',
    icon: '💼',
  },
  musharakah: {
    name: 'Musharakah',
    nameUr: 'مشاركة',
    desc: 'Joint venture. All partners contribute capital and share profits and losses proportionally to investment.',
    descUr: 'Joint venture. Tamap partners capital dete hain aur munafa aur nuksan proportionally taqseem karte hain.',
    useCase: 'Joint liquidity pools, DEX LP positions, DAO treasuries',
    useCaseUr: 'Joint liquidity pools, DEX LP positions, DAO treasuries',
    icon: '🤝',
  },
  wakala: {
    name: 'Wakala',
    nameUr: 'وكالة',
    desc: 'Agency agreement. Investor appoints agent to invest on their behalf for a pre-agreed fee or profit share.',
    descUr: 'Agency agreement. Investor agent ko appoint karta hai apne liye invest karne ke liye.',
    useCase: 'Staking-as-a-service, agency yield, delegated investment',
    useCaseUr: 'Staking-as-a-service, agency yield, delegated investment',
    icon: '🏛️',
  },
  murabaha: {
    name: 'Murabaha',
    nameUr: 'مرابحة',
    desc: 'Cost-plus sale. Protocol buys an asset and sells it to the user at a disclosed markup, payable in installments.',
    descUr: 'Cost-plus sale. Protocol asset kharidta hai aur user ko disclosed markup par bechta hai.',
    useCase: 'Asset-backed lending, stablecoin minting, interest-free borrowing',
    useCaseUr: 'Asset-backed lending, stablecoin minting, interest-free borrowing',
    icon: '📦',
  },
  ijarah: {
    name: 'Ijarah',
    nameUr: 'إجارة',
    desc: 'Leasing contract. User leases an income-generating asset and receives payouts.',
    descUr: 'Leasing contract. User income-generating asset lease karta hai aur payouts receive karta hai.',
    useCase: 'Leasing, yield-bearing assets, equipment financing',
    useCaseUr: 'Leasing, yield-bearing assets, equipment financing',
    icon: '🏠',
  },
};

export const HalalContractCard: React.FC<HalalContractCardProps> = ({
  contract,
  compact = false,
  className = '',
}) => {
  const { language } = useLanguage();
  const c = CONTRACTS[contract];

  if (compact) {
    return (
      <div className={`rounded-xl bg-white/[0.03] border border-white/8 p-3 ${className}`}>
        <div className="flex items-center gap-2 mb-1">
          <span>{c.icon}</span>
          <span className="text-xs font-bold text-white/90">{c.name}</span>
          <span className="text-[10px] text-white/40">{c.nameUr}</span>
        </div>
        <p className="text-[10px] text-white/50 leading-relaxed">
          {language === 'en' ? c.useCase : c.useCaseUr}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-white/[0.03] border border-white/8 p-5 hover:border-emerald-500/20 transition-all duration-300 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{c.icon}</span>
        <div>
          <h3 className="font-bold text-white/90 text-sm">{c.name}</h3>
          <p className="text-xs text-white/40">{c.nameUr}</p>
        </div>
      </div>
      <p className="text-xs text-white/60 leading-relaxed mb-3">
        {language === 'en' ? c.desc : c.descUr}
      </p>
      <div className="text-[10px] font-semibold text-emerald-400/80 bg-emerald-500/8 rounded-lg px-2 py-1">
        {language === 'en' ? c.useCase : c.useCaseUr}
      </div>
    </div>
  );
};

export default HalalContractCard;
