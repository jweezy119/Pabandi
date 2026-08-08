import { useQuery } from 'react-query';
import { ppdService } from '../services/api';
import { tokens } from '../design-system';
import DisputeButton from '../components/DisputeButton';

export default function PayrollPage() {
  const { data, isLoading } = useQuery('workerPayouts', ppdService.getWorkerPayouts, { refetchInterval: 30000 });

  if (isLoading) {
    return <div className="p-8 text-center font-headline" style={{ background: tokens.color.background, color: tokens.color.text }}>Loading payroll…</div>;
  }

  const d = data?.data || { payouts: [], totalNetUsdc: 0, totalFeesUsdc: 0, count: 0 };

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in pb-20 font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <h1 className="text-3xl font-black font-headline tracking-tight">Instant Pay — Pay-on-Verified-Work</h1>
      <p className="text-sm mt-2" style={{ color: tokens.color.muted }}>
        Every milestone your client releases hits your wallet the same block — at a 0.5% settlement fee
        versus ~7% on Western Union. No 3-day wait. No chargebacks. Your Trust Passport is the payroll rail.
      </p>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: tokens.color.muted }}>Total paid to you</p>
          <p className="text-2xl font-black text-green-400">${d.totalNetUsdc}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: tokens.color.muted }}>Payouts</p>
          <p className="text-2xl font-black">{d.count}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: tokens.color.muted }}>Saved vs 7% remittance</p>
          <p className="text-2xl font-black text-green-400">${(d.totalNetUsdc * 0.07).toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3">Payroll ledger</h2>
        {!d.payouts || d.payouts.length === 0 ? (
          <p className="text-sm" style={{ color: tokens.color.muted }}>No milestone payouts yet. When a client releases a draw, it lands here instantly.</p>
        ) : (
          <div className="space-y-2">
            {d.payouts.map((p: any) => (
              <div key={p.id} className="rounded-xl p-3 text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex flex-wrap gap-2 justify-between items-center sm:flex-nowrap">
                  <div>
                    <span className="font-bold">${p.grossUsdc}</span> released
                    <span className="ml-2 text-xs" style={{ color: tokens.color.muted }}>fee ${p.feeUsdc} ({p.settlementBps}bps)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-400">+${p.netUsdc}</span>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{new Date(p.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                {p.milestoneId && (
                  <DisputeButton contextType="MILESTONE" contextId={p.milestoneId} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
