interface RewardTransaction {
  id: string;
  type: string;
  amount: number;
  usdValue: number;
  status: string;
  createdAt: string;
  referenceType?: string;
}

interface RewardCardProps {
  transaction: RewardTransaction;
}

const TYPE_LABELS: Record<string, string> = {
  PURCHASE_REWARD: 'Purchase Reward',
  STAKING_REWARD: 'Staking Reward',
  REFERRAL_REWARD: 'Referral Reward',
  FEE_OFFSET: 'Fee Offset',
};

const TYPE_ICONS: Record<string, string> = {
  PURCHASE_REWARD: '🛍️',
  STAKING_REWARD: '🔒',
  REFERRAL_REWARD: '🤝',
  FEE_OFFSET: '💰',
};

export default function RewardCard({ transaction }: RewardCardProps) {
  const date = new Date(transaction.createdAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-slate-700/50 rounded-xl p-4 flex items-center justify-between hover:bg-slate-700/70 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
          <span className="text-lg">{TYPE_ICONS[transaction.type] || '🪙'}</span>
        </div>
        <div>
          <p className="text-white font-medium">{TYPE_LABELS[transaction.type] || transaction.type}</p>
          <p className="text-slate-400 text-sm">{formattedDate}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-amber-400 font-bold">+{transaction.amount.toFixed(2)} $PAB</p>
        <p className="text-slate-400 text-sm">${transaction.usdValue.toFixed(2)} value</p>
      </div>
    </div>
  );
}
