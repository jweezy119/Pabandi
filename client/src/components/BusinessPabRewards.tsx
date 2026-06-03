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
      className="rounded-2xl p-6 mb-8 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(153,69,255,0.08) 0%, var(--color-surface-raised) 45%, rgba(240,180,41,0.06) 100%)',
        border: '1px solid rgba(153, 69, 255, 0.25)',
      }}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
            style={{ background: 'rgba(153,69,255,0.15)', color: '#c084fc' }}
          >
            Solana · $PAB Rewards
          </span>
          <h2 className="text-xl font-black text-[#e8e8e8] mt-2">Earn $PAB for running a tight operation</h2>
          <p className="text-sm text-[#757575] mt-1 max-w-xl">
            Businesses earn Pabandi tokens automatically — withdraw to your Phantom wallet on Solana.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#757575]">Your $PAB balance</p>
          <p className="text-3xl font-black" style={{ color: '#f0b429' }}>
            {isLoading ? '…' : balance.toLocaleString()} <span className="text-base text-[#616161]">PAB</span>
          </p>
          {data?.solanaConnected ? (
            <p className="text-xs text-[#10b981] mt-1">◎ Phantom connected</p>
          ) : (
            <Link to="/business/settings" className="text-xs font-semibold text-purple-600 hover:underline mt-1 inline-block">
              Connect Phantom for payouts →
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
          <p className="text-xs font-semibold uppercase tracking-wide text-[#757575] mb-2">Recent $PAB earnings</p>
          <div className="space-y-2">
            {data.recentRewards.slice(0, 5).map((r: { id: string; type: string; amount: number; createdAt: string }) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-sm py-2 px-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid var(--color-border)' }}
              >
                <span className="text-[#9e9e9e]">{REWARD_LABELS[r.type] || r.type}</span>
                <span className="font-bold" style={{ color: '#22c55e' }}>+{r.amount} PAB</span>
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
      className="rounded-xl p-4"
      style={{
        background: highlight ? 'rgba(240,180,41,0.08)' : 'rgba(255,255,255,0.6)',
        border: `1px solid ${highlight ? 'rgba(240,180,41,0.25)' : 'var(--color-border)'}`,
      }}
    >
      <p className="text-2xl font-black" style={{ color: '#f0b429' }}>
        +{amount}
      </p>
      <p className="text-xs text-[#757575] mt-1">{label}</p>
    </div>
  );
}
