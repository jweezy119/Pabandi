import { useEffect, useState } from 'react';

export default function PersonalRewardsPage() {
  const [rewards, setRewards] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/rewards/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          setRewards(await res.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRewards();
  }, []);

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--warm-ink)]">My Rewards</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">PAB Balance</div>
          <div className="text-2xl font-bold text-[var(--clay)]">{rewards?.data?.pabBalance || 0}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">Staked</div>
          <div className="text-2xl font-bold text-[var(--sage)]">{rewards?.data?.pabStaked || 0}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-[rgba(191,179,163,0.2)]">
          <div className="text-xs text-[var(--soft-stone)] mb-1">Earned</div>
          <div className="text-2xl font-bold text-[var(--muted-ochre)]">{rewards?.data?.pabEarned || 0}</div>
        </div>
      </div>
    </div>
  );
}
