import React from 'react';
import { Link } from 'react-router-dom';

const PAB_PRICE = 0.000178;
const PAB_DISCOUNT = 0.05; // 5%

interface PaymentState {
  amount: number;
  usePab: boolean;
  status: 'idle' | 'confirming' | 'processing' | 'success' | 'error';
  txHash?: string;
}

export default function RentPayment() {
  const [state, setState] = React.useState<PaymentState>({
    amount: 1850.0,
    usePab: false,
    status: 'idle',
  });

  const discountedAmount = state.amount * (1 - PAB_DISCOUNT);
  const pabRequired = discountedAmount / PAB_PRICE;
  const pabBalance = 15000;
  const canPayPab = state.usePab && pabRequired <= pabBalance;

  const handlePay = async () => {
    setState((s) => ({ ...s, status: 'confirming' }));
    // Simulate API call to POST /api/v1/jev/payment-route/:userId
    await new Promise((r) => setTimeout(r, 1500));
    setState((s) => ({
      ...s,
      status: 'success',
      txHash: '0x7f8e9d...3a2b1c',
    }));
  };

  const reset = () => setState({ amount: 1850.0, usePab: false, status: 'idle' });

  if (state.status === 'success') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-emerald-400 text-3xl">check_circle</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
          <p className="text-slate-400 mb-6">
            Your rent payment of ${state.usePab ? (state.amount * (1 - PAB_DISCOUNT)).toFixed(2) : state.amount.toFixed(2)} has been processed.
          </p>
          {state.txHash && (
            <div className="rounded-xl bg-black/30 p-3 mb-6 inline-block">
              <div className="text-xs text-slate-500 mb-1">Transaction Reference</div>
              <div className="text-emerald-400 font-mono text-sm">{state.txHash}</div>
            </div>
          )}
          {state.usePab && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 mb-6 inline-block">
              <div className="text-sm text-emerald-300 font-medium">
                🎉 You saved ${(state.amount * PAB_DISCOUNT).toFixed(2)} with the PAB discount!
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Link
              to="/tenant-portal"
              className="px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-all"
            >
              Make Another Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Pay Rent</h1>
        <p className="text-slate-400 text-sm mt-1">Fast, secure, save 5% with PAB</p>
      </div>

      {/* Amount Card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Amount Due</div>
        <div className="text-4xl font-bold text-white">${state.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div className="mt-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300">
            Due in 11 days
          </span>
        </div>
      </div>

      {/* Payment Method Toggle */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Payment Method</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setState((s) => ({ ...s, usePab: false }))}
            className={`p-4 rounded-xl border transition-all ${
              !state.usePab
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                !state.usePab ? 'border-emerald-400' : 'border-slate-500'
              }`}>
                {!state.usePab && <div className="w-3 h-3 rounded-full bg-emerald-400" />}
              </div>
              <span className="text-white font-semibold">USDC</span>
            </div>
            <div className="text-slate-400 text-sm">Standard payment</div>
            <div className="text-white font-bold mt-1">${state.amount.toFixed(2)}</div>
          </button>

          <button
            onClick={() => setState((s) => ({ ...s, usePab: true }))}
            className={`p-4 rounded-xl border transition-all relative ${
              state.usePab
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-xs font-bold text-white">
              -5%
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                state.usePab ? 'border-emerald-400' : 'border-slate-500'
              }`}>
                {state.usePab && <div className="w-3 h-3 rounded-full bg-emerald-400" />}
              </div>
              <span className="text-white font-semibold">PAB</span>
            </div>
            <div className="text-emerald-400 text-sm font-medium">5% discount!</div>
            <div className="text-white font-bold mt-1">${discountedAmount.toFixed(2)}</div>
            <div className="text-slate-400 text-xs mt-1">
              ≈ {Math.ceil(pabRequired).toLocaleString()} PAB
            </div>
          </button>
        </div>

        {state.usePab && (
          <div className={`mt-4 p-4 rounded-xl border ${
            canPayPab
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-xl ${canPayPab ? 'text-emerald-400' : 'text-red-400'}`}>
                {canPayPab ? 'check_circle' : 'error'}
              </span>
              <div>
                <div className={`text-sm font-medium ${canPayPab ? 'text-emerald-300' : 'text-red-300'}`}>
                  {canPayPab ? 'Sufficient PAB balance' : 'Insufficient PAB balance'}
                </div>
                <div className="text-xs text-slate-400">
                  Your balance: {pabBalance.toLocaleString()} PAB
                  {!canPayPab && ` (need ${Math.ceil(pabRequired).toLocaleString()})`}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Payment Summary</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Rent</span>
            <span className="text-white">${state.amount.toFixed(2)}</span>
          </div>
          {state.usePab && (
            <div className="flex justify-between text-sm">
              <span className="text-emerald-400">PAB Discount (5%)</span>
              <span className="text-emerald-400">-${(state.amount * PAB_DISCOUNT).toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-3 flex justify-between">
            <span className="text-white font-semibold">Total</span>
            <span className="text-white font-bold text-lg">
              ${state.usePab ? discountedAmount.toFixed(2) : state.amount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <button
        onClick={handlePay}
        disabled={state.status === 'confirming' || state.status === 'processing' || (state.usePab && !canPayPab)}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.status === 'confirming' || state.status === 'processing' ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing...
          </span>
        ) : (
          `Pay $${state.usePab ? discountedAmount.toFixed(2) : state.amount.toFixed(2)}`
        )}
      </button>

      <p className="text-center text-slate-500 text-xs">
        Your payment is secured by the Pabandi agent. No crypto knowledge needed.
      </p>
    </div>
  );
}
