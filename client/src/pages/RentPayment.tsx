import { useState, useEffect } from 'react';

const PAB_PRICE = 0.000178;
const PAB_DISCOUNT = 0.05; // 5%

interface PaymentState {
  amount: number;
  usePab: boolean;
  status: 'idle' | 'confirming' | 'processing' | 'success' | 'error';
  txHash?: string;
}

export default function RentPayment() {
  const [state, setState] = useState<PaymentState>({
    amount: 0,
    usePab: false,
    status: 'idle',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pabBalance, setPabBalance] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setError('Not authenticated'); setLoading(false); return; }

        // Fetch PAB balance
        const balanceRes = await fetch('/api/v1/crm-pab/balance', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const balanceData = await balanceRes.json();
        if (balanceData.success) {
          setPabBalance(balanceData.data.totalPabBalance || 0);
        }
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const discountedAmount = state.amount * (1 - PAB_DISCOUNT);
  const pabRequired = discountedAmount / PAB_PRICE;
  const canPayPab = state.usePab && pabRequired <= pabBalance;

  const handlePay = async () => {
    setState((s) => ({ ...s, status: 'confirming' }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/jev/payment-route/me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: state.amount }),
      });
      const data = await res.json();
      if (data.success) {
        setState((s) => ({ ...s, status: 'success', txHash: data.data.txHash }));
      } else {
        setState((s) => ({ ...s, status: 'error' }));
      }
    } catch {
      setState((s) => ({ ...s, status: 'error' }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
          <h2 className="text-xl font-semibold text-slate-200 mb-2">Error</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4">Pay Rent</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Amount (USD)</label>
            <input
              type="number"
              value={state.amount || ''}
              onChange={(e) => setState((s) => ({ ...s, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white mt-1"
              placeholder="Enter amount"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setState((s) => ({ ...s, usePab: false }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                !state.usePab ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              Pay with USDC
            </button>
            <button
              onClick={() => setState((s) => ({ ...s, usePab: true }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                state.usePab ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              Pay with PAB (5% off)
            </button>
          </div>

          {state.usePab && state.amount > 0 && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
              <p className="text-sm text-purple-300">
                You need <span className="font-bold">{pabRequired.toFixed(0)} PAB</span> for this payment
              </p>
              <p className="text-xs text-purple-400 mt-1">
                Your balance: {pabBalance.toFixed(0)} PAB
                {!canPayPab && ' — Insufficient balance'}
              </p>
              <p className="text-xs text-emerald-400 mt-1">
                You save: ${(state.amount * PAB_DISCOUNT).toFixed(2)} with PAB!
              </p>
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={state.amount <= 0 || state.status === 'confirming' || (state.usePab && !canPayPab)}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium transition"
          >
            {state.status === 'confirming' ? 'Confirming...' : state.status === 'success' ? '✓ Paid!' : `Pay $${state.amount.toFixed(2)}`}
          </button>

          {state.status === 'success' && (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-sm text-emerald-300">Payment successful!</p>
              {state.txHash && <p className="text-xs text-emerald-400 mt-1">TX: {state.txHash}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
