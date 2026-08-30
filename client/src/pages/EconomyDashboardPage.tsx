import { useQuery, useQueryClient } from 'react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { economyService } from '../services/api';
import { tokens } from '../design-system';
import PageHeader from '../components/PageHeader';

export default function EconomyDashboardPage() {
  const queryClient = useQueryClient();
  const [demo, setDemo] = useState<{ loading: boolean; result: any; error: string | null }>({ loading: false, result: null, error: null });

  const { data: statsData } = useQuery(['economy-stats'], async () => {
    const res = await economyService.getStats();
    return (res?.data?.data) as any;
  }, { refetchInterval: 15000 });

  const runDemoBooking = async () => {
    setDemo({ loading: true, result: null, error: null });
    try {
      const res = await economyService.runDemoBooking({ amountPab: 100 });
      setDemo({ loading: false, result: res?.data?.data, error: null });
      await queryClient.invalidateQueries(['economy-stats']);
    } catch (e: any) {
      setDemo({ loading: false, result: null, error: e?.message || 'Demo booking failed' });
    }
  };

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
          title="Self-Economy"
          description="Autonomous bookings, fees, and $PAB circulation from the seeded network."
          eyebrow="Economy"
          actions={
            <>
              <Link to="/freelance" className="px-4 py-2.5 rounded-2xl border border-outline-variant/20 bg-surface-container-high font-headline font-bold text-sm">View Freelancers</Link>
              <Link to="/search" className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 font-headline font-bold text-sm text-white shadow-sm hover:opacity-90">Explore Businesses</Link>
              <button
                onClick={runDemoBooking}
                disabled={demo.loading}
                className="px-4 py-2.5 rounded-2xl bg-emerald-500 font-headline font-bold text-sm text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {demo.loading ? 'Booking…' : '⚡ Run demo booking'}
              </button>
            </>
          }
        />

        {demo.result && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 space-y-2">
            <p className="font-headline font-bold text-emerald-300">⚡ Demo booking settled {demo.result.simulated ? '(simulated)' : ''} — {demo.result.amountPab} PAB</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-on-surface-variant">Fee (2%)</span><br /><b>{demo.result.feePab} PAB</b></div>
              <div><span className="text-on-surface-variant">Burned</span><br /><b>{demo.result.burnPab} PAB</b></div>
              <div><span className="text-on-surface-variant">To LP liquidity</span><br /><b>{demo.result.allocation.LP_PROVISION} PAB</b></div>
              <div><span className="text-on-surface-variant">Treasury Δ</span><br /><b>+{demo.result.delta.accrualTotal} PAB</b></div>
            </div>
            <p className="text-xs text-on-surface-variant">Ops {demo.result.allocation.OPERATING} · Yield {demo.result.allocation.YIELD_REINVEST} · Emergency {demo.result.allocation.EMERGENCY} PAB</p>
          </div>
        )}
        {demo.error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Demo booking failed: {demo.error}</div>
        )}

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

        {/* Pool fee ticker + badge/wallet stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Pool Fees (USDC)</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(poolFees).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Treasury Accrual</p>
            <p className="font-headline font-black text-2xl mt-1">{Number(accrual.total).toLocaleString()} PAB</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Wallets Funded</p>
            <p className="font-headline font-black text-2xl mt-1">{String(walletsFunded)}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h2 className="font-headline text-xl sm:text-2xl font-bold mb-2">Network Coverage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Agent Wallets</p>
              <p className="font-headline font-black text-xl mt-1">{String(walletsFunded)}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Fees → Accrual</p>
              <p className="font-headline font-black text-xl mt-1">{Number(totalFees).toLocaleString()} PAB</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Last Run</p>
              <p className="font-headline font-black text-xl mt-1">{lastRun ? new Date(lastRun).toLocaleString() : '—'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h2 className="font-headline text-xl sm:text-2xl font-bold mb-2">Treasury Accrual by Bucket</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accrualRows.map((row) => (
              <div key={row.bucket} className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">{row.bucket}</p>
                <p className="font-headline font-black text-xl mt-1">{Number(row.amount).toLocaleString()} PAB</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
