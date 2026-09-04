import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { economyService } from '../services/api';
import { tokens } from '../design-system';
import PageHeader from '../components/PageHeader';

export default function EconomyDashboardPage() {
  const { data: statsData } = useQuery(['economy-stats'], async () => {
    const res = await economyService.getStats();
    return (res?.data?.data) as any;
  }, { refetchInterval: 15000 });

  const stats = statsData || {};

  const totalBookings = stats?.bookings ?? 0;
  const totalFees = stats?.feesCollected ?? 0;
  const totalRewards = stats?.rewardsPaid ?? 0;
  const totalBurned = stats?.burned ?? 0;
  const poolFees = stats?.poolFees ?? 0;
  const walletsFunded = stats?.walletsFunded ?? 0;
  const lastRun = stats?.lastRunAt ?? null;
  const accrual = stats?.accrual ?? { total: 0, byBucket: {} };
  const ACCRUAL_BUCKETS = ['OPERATING', 'TREASURY', 'LP_PROVISION', 'YIELD_REINVEST', 'EMERGENCY'];
  const accrualRows = ACCRUAL_BUCKETS.map(b => ({ bucket: b, amount: accrual.byBucket?.[b] ?? 0 }));

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <PageHeader
          title="Platform Economy"
          description="Real-time metrics on bookings, fees, and $PAB circulation."
          eyebrow="Analytics"
          actions={
            <>
              <Link to="/freelance" className="px-4 py-2.5 rounded-2xl border border-outline-variant/20 bg-surface-container-high font-headline font-bold text-sm">View Freelancers</Link>
              <Link to="/search" className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 font-headline font-bold text-sm text-white shadow-sm hover:opacity-90">Explore Businesses</Link>
            </>
          }
        />

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Bookings</p>
            <p className="font-headline font-black text-2xl mt-1">{String(totalBookings)}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Fees Collected</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(totalFees).toLocaleString()} PAB</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Rewards Paid</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(totalRewards).toLocaleString()} PAB</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Burned</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(totalBurned).toLocaleString()} PAB</p>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Pool Fees</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(poolFees).toLocaleString()} PAB</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Wallets Funded</p>
            <p className="font-headline font-black text-2xl mt-1">{String(walletsFunded)}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Last Run</p>
            <p className="font-body text-sm mt-1">{lastRun ? new Date(lastRun).toLocaleString() : 'Never'}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6">
          <h3 className="font-headline text-lg font-bold mb-4">Accrual Breakdown</h3>
          <div className="space-y-3">
            {accrualRows.map(row => (
              <div key={row.bucket} className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">{row.bucket.replace(/_/g, ' ')}</span>
                <span className="font-mono font-bold">{row.amount} PAB</span>
              </div>
            ))}
            <div className="border-t border-outline-variant/20 pt-3 flex items-center justify-between">
              <span className="font-bold">Total</span>
              <span className="font-mono font-bold text-lg">{accrual.total} PAB</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
