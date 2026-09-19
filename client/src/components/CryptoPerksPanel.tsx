interface CryptoPerksPanelProps {
  settlement?: {
    chain: string;
    finalityMs: number;
    costPerTx: number;
  } | null;
  arbitrage?: {
    opportunity: boolean;
    spread: number;
    action: string;
  } | null;
}

export default function CryptoPerksPanel({ settlement, arbitrage }: CryptoPerksPanelProps) {
  const perks = [
    {
      icon: '⚡',
      label: 'Solana Finality',
      value: `${settlement?.finalityMs || 400}ms`,
      description: 'vs Ethereum 12s',
      color: 'text-yellow-400',
    },
    {
      icon: '💸',
      label: 'Tx Cost',
      value: `$${settlement?.costPerTx || 0.00025}`,
      description: 'vs Ethereum $1-50',
      color: 'text-emerald-400',
    },
    {
      icon: '🌐',
      label: 'Uptime',
      value: '24/7',
      description: 'Always running',
      color: 'text-blue-400',
    },
    {
      icon: '🌍',
      label: 'Global',
      value: 'Anywhere',
      description: 'Permissionless',
      color: 'text-purple-400',
    },
    {
      icon: '🔗',
      label: 'Atomic',
      value: 'Instant',
      description: 'Payment + settlement',
      color: 'text-orange-400',
    },
    {
      icon: '🧩',
      label: 'Composable',
      value: 'DeFi Ready',
      description: 'Integrate anything',
      color: 'text-cyan-400',
    },
    {
      icon: '🔄',
      label: 'Programmable',
      value: 'Smart Contracts',
      description: 'Auto-execute',
      color: 'text-pink-400',
    },
    {
      icon: '📊',
      label: 'Arbitrage',
      value: arbitrage?.opportunity ? `${(arbitrage.spread * 100).toFixed(2)}%` : 'Scanning',
      description: arbitrage?.action || 'PAB/USDC/SOL',
      color: arbitrage?.opportunity ? 'text-yellow-400' : 'text-slate-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {perks.map((perk) => (
        <div
          key={perk.label}
          className="p-3 rounded-xl bg-slate-800/50 border border-white/5 hover:border-white/10 transition-all"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{perk.icon}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{perk.label}</span>
          </div>
          <p className={`text-sm font-bold ${perk.color}`}>{perk.value}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{perk.description}</p>
        </div>
      ))}
    </div>
  );
}
