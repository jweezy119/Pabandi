import { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { payoutService } from '../services/api';
import { tokens } from '../design-system';
import DisputeButton from '../components/DisputeButton';

export default function CashOutPage() {
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<'BANK' | 'CONNECT' | 'LOCAL'>('BANK');
  const [destination, setDestination] = useState('');

  const { data: quote, refetch } = useQuery(
    ['payoutQuote', amount],
    () => payoutService.quote(Number(amount) || 0),
    { enabled: !!amount && Number(amount) > 0, refetchInterval: 0 }
  );
  const { data: history } = useQuery('payoutHistory', payoutService.history, { refetchInterval: 30000 });

  const mutation = useMutation(
    (amt: number) => payoutService.request({ amountUsdc: amt, method, destinationRef: method === 'LOCAL' ? destination : undefined }),
    {
      onSuccess: () => { alert('Cash-out settled. Funds on the way at 1.5% (vs ~7% remittance).'); setAmount(''); setDestination(''); refetch(); },
      onError: (err: any) => alert(`Error: ${err.response?.data?.error || err.message}`),
    }
  );

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in pb-20 font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <h1 className="text-3xl font-black font-headline tracking-tight" style={{ color: tokens.color.text }}>
        Cash Out Earned USDC
      </h1>
      <p className="text-sm mt-2" style={{ color: tokens.color.muted }}>
        Instant payout to your linked bank at a flat <strong>1.5%</strong> — versus ~7% on Western Union / wire.
        Trust-gated: a clean Trust Passport band keeps fees low and unlocks higher limits.
      </p>

      <div className="mt-6 rounded-3xl p-6 shadow-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <label className="block text-sm font-bold mb-2" style={{ color: tokens.color.text }}>Amount to cash out (USDC)</label>
        <input
          type="number" min="1" value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          placeholder="e.g. 500"
          className="w-full px-4 py-3 rounded-xl font-body"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)', color: tokens.color.text }}
        />

        <div className="mt-4 flex flex-wrap gap-3">
          {(['BANK', 'CONNECT', 'LOCAL'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{
                background: method === m ? tokens.color.primary : 'transparent',
                color: method === m ? '#0a0a0a' : tokens.color.muted,
                border: `1px solid ${method === m ? tokens.color.primary : 'rgba(255,255,255,0.15)'}`,
              }}
            >
              {m === 'BANK' ? 'Linked Bank' : m === 'CONNECT' ? 'Stripe Connect' : 'Local Wallet'}
            </button>
          ))}
        </div>

        {method === 'LOCAL' && (
          <div className="mt-4">
            <label className="block text-sm font-bold mb-2" style={{ color: tokens.color.text }}>Mobile wallet / bank account (JazzCash, Easypaisa, Raast)</label>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="e.g. 0300-1234567"
              className="w-full px-4 py-3 rounded-xl font-body"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)', color: tokens.color.text }}
            />
            <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Routes through Pabandi's P2P off-ramp — a local liquidity provider settles PKR to your account in minutes.</p>
          </div>
        )}

        {quote && Number(amount) > 0 && (
          <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <div className="flex justify-between text-sm"><span>Band</span><span className="font-bold">{quote.band}</span></div>
            <div className="flex justify-between text-sm mt-1"><span>Fee (1.5%)</span><span>${quote.feeUsdc}</span></div>
            <div className="flex justify-between text-sm mt-1"><span>You receive</span><span className="font-bold text-green-400">${quote.netUsdc}</span></div>
            <div className="flex justify-between text-xs mt-1" style={{ color: tokens.color.muted }}>
              <span>Saved vs 7% remittance</span><span className="text-green-400">${quote.vsRemittance}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => amount && Number(amount) > 0 && mutation.mutate(Number(amount))}
          disabled={mutation.isLoading || !amount || Number(amount) <= 0 || (quote && !quote.eligible)}
          className="w-full mt-4 py-3 px-4 rounded-xl font-bold"
          style={{ background: tokens.color.primary, color: '#0a0a0a', opacity: mutation.isLoading ? 0.6 : 1 }}
        >
          {mutation.isLoading ? 'Settling…' : quote?.eligible ? 'Cash Out Now' : 'Band E — build trust to unlock'}
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3" style={{ color: tokens.color.text }}>Cash-out history</h2>
        {!history || history.length === 0 ? (
          <p className="text-sm" style={{ color: tokens.color.muted }}>No payouts yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((p: any) => (
              <div key={p.id} className="rounded-xl p-3 text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex flex-wrap gap-2 justify-between items-center sm:flex-nowrap">
                  <span className="font-semibold">${p.amountUsdc} → <strong>${p.netUsdc}</strong> ({p.method})</span>
                  <span className="shrink-0" style={{ color: tokens.color.muted }}>{new Date(p.createdAt).toLocaleDateString()} · {p.status}</span>
                </div>
                <DisputeButton contextType="PAYOUT" contextId={p.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
