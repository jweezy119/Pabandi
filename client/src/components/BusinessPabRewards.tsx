import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { cryptoService } from '../services/api';

const REWARD_LABELS: Record<string, string> = {
  BUSINESS_RESERVATION_HONORED: 'Honored booking',
  BUSINESS_NO_SHOW_PROTECTED: 'No-show deposit kept',
  BUSINESS_RELIABILITY_BONUS: 'Reliability bonus',
  BUSINESS_REFERRAL: 'Business referral',
};

export default function BusinessPabRewards() {
  const { data, isLoading } = useQuery(
    'business-pab-rewards',
    async () => {
      const res = await cryptoService.getBusinessRewards();
      return res.data?.data;
    },
    { retry: false, refetchOnWindowFocus: false }
  );

  const rules = data?.rules;
  const balance = data?.balance ?? 0;

return (
    <div
      className="rounded-2xl p-6 mb-8 overflow-hidden border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-amber-500/5 backdrop-blur-xl"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-purple-500/15 text-purple-300">
            Solana · BNB Chain · Stellar · $PAB Rewards
          </span>
          <h2 className="text-xl font-black text-slate-100 mt-2 flex items-center gap-2">
            <img src="/logo-coin-3d.jpg" alt="Pabandi" className="h-6 w-6 rounded-full object-cover" />
            Earn $PAB for running a tight operation
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Businesses earn $PAB automatically — withdraw to your preferred wallet on Solana, BNB Chain, or Stellar.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your $PAB balance</p>
          <p className="text-3xl font-black text-amber-400">
            {isLoading ? '…' : balance.toLocaleString()} <span className="text-base text-slate-500">$PAB</span>
          </p>
          {data?.solanaConnected ? (
            <p className="text-xs text-emerald-400 mt-1">◎ Wallet connected</p>
          ) : (
            <Link to="/business/settings" className="text-xs font-semibold text-purple-400 hover:underline mt-1 inline-block">
              Connect Web3 wallet for payouts →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {rules && (
          <>
            <RewardRule amount={rules.HONORED_BOOKING} label="Per completed booking" />
            <RewardRule amount={rules.NO_SHOW_DEPOSIT_KEPT} label="No-show deposit protected" highlight />
            <RewardRule amount={rules.LOW_NO_SHOW_MONTH} label="Low no-show month bonus" />
            <RewardRule amount={rules.CUSTOMER_REFERRAL} label="Refer another business" />
          </>
        )}
      </div>

      {data?.recentRewards?.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Recent $PAB earnings</p>
          <div className="space-y-2">
            {data.recentRewards.slice(0, 5).map((r: { id: string; type: string; amount: number; createdAt: string }) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-white/5 border border-white/10"
              >
                <span className="text-slate-400">{REWARD_LABELS[r.type] || r.type}</span>
                <span className="font-bold text-emerald-400">+{r.amount} $PAB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RewardRule({
  amount,
  label,
  highlight,
}: {
  amount: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 border border-white/10 bg-white/5"
      style={highlight ? { background: 'rgba(240,180,41,0.08)', borderColor: 'rgba(240,180,41,0.25)' } : {}}
    >
      <p className="text-2xl font-black text-amber-400">
        +{amount}
      </p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
