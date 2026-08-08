import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { loanService } from '../services/api';
import { CurrencyDollarIcon, BanknotesIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { tokens } from '../design-system';

export default function LoanDashboard() {
  const [usdcAmount, setUsdcAmount] = useState<number | ''>('');

  const { data: power, isLoading, refetch } = useQuery('loanPower', loanService.getPower, {
    refetchInterval: 60000,
  });

  const requestLoanMutation = useMutation(
    (amount: number) => loanService.requestLoan({ usdcAmount: amount }),
    {
      onSuccess: () => {
        alert('Loan requested successfully! USDC has been credited to your wallet.');
        setUsdcAmount('');
        refetch();
      },
      onError: (err: any) => {
        alert(`Error: ${err.response?.data?.error || err.message}`);
      }
    }
  );

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usdcAmount || Number(usdcAmount) <= 0) return;
    requestLoanMutation.mutate(Number(usdcAmount));
  };

  if (isLoading) {
    return <div className="p-8 text-center font-headline" style={{ background: tokens.color.background, color: tokens.color.text }}>Loading DeFi Profile...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-on-surface font-headline tracking-tight">Halal DeFi Lending</h1>
          <p className="text-on-surface-variant mt-2 max-w-2xl text-sm leading-relaxed font-body">
            Collateralize your PAB tokens for USDC. No interest (Riba). We charge a flat 5% processing fee. 
            Your Loan-to-Value (LTV) limit is determined by your Trust Score.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-primary mb-4">
            <ChartBarIcon className="h-8 w-8" />
            <h3 className="font-headline font-bold text-lg text-on-surface">Your Trust Score</h3>
          </div>
          <p className="text-5xl font-black text-primary font-headline">{power?.trustScore || 0}</p>
          <p className="text-xs text-on-surface-variant mt-2">
            Higher score unlocks higher borrowing limits (up to 80% LTV).
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-secondary mb-4">
            <BanknotesIcon className="h-8 w-8" />
            <h3 className="font-headline font-bold text-lg text-on-surface">Available PAB</h3>
          </div>
          <p className="text-4xl font-black text-secondary font-headline">{(power?.availablePab || 0).toLocaleString()}</p>
          <p className="text-xs text-on-surface-variant mt-2">
            ≈ ${(power?.usdValueOfPab || 0).toFixed(2)} USD in collateral value
          </p>
        </div>

        <div className="bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-on-surface mb-4">
            <CurrencyDollarIcon className="h-8 w-8" />
            <h3 className="font-headline font-bold text-lg text-on-surface">Borrowing Power</h3>
          </div>
          <p className="text-4xl font-black text-on-surface font-headline">${(power?.maxUsdcBorrow || 0).toFixed(2)}</p>
          <p className="text-xs text-on-surface-variant mt-2 font-bold">
            Current LTV Limit: {(power?.ltvRatio * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {power?.ltvRatio > 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8 shadow-sm">
          <h2 className="text-xl font-black text-on-surface font-headline mb-4">Request USDC Loan</h2>
          <form onSubmit={handleRequest} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">USDC Amount</label>
              <input
                type="number"
                min="1"
                max={power?.maxUsdcBorrow || 0}
                value={usdcAmount}
                onChange={e => setUsdcAmount(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-body text-on-surface"
                placeholder="Enter amount in USDC"
              />
              {usdcAmount && (
                <p className="text-xs text-on-surface-variant mt-2">
                  Flat Fee (5%): ${(Number(usdcAmount) * 0.05).toFixed(2)}<br />
                  Total Repayment: ${(Number(usdcAmount) * 1.05).toFixed(2)}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={requestLoanMutation.isLoading || !usdcAmount || Number(usdcAmount) > (power?.maxUsdcBorrow || 0)}
              className="w-full py-3 px-4 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {requestLoanMutation.isLoading ? 'Processing (Solana Tx)...' : 'Collateralize & Borrow'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-error/10 border border-error/20 rounded-3xl p-8 shadow-sm text-center">
          <h2 className="text-xl font-black text-error font-headline mb-2">Borrowing Disabled</h2>
          <p className="text-on-error-container">
            Your Trust Score ({power?.trustScore}) is too low to qualify for a loan. You must reach a minimum Trust Score of 50.
          </p>
        </div>
      )}

      {/* Reputation-backed (collateral-FREE) loan */}
      <ReputationLoanPanel />
    </div>
  );
}

function ReputationLoanPanel() {
  const [amount, setAmount] = useState<number | ''>('');
  const { data: quote, isLoading, refetch } = useQuery('reputationQuote', loanService.getReputationQuote, { refetchInterval: 60000 });
  const mutation = useMutation(
    (amt: number) => loanService.requestReputationLoan({ usdcAmount: amt }),
    {
      onSuccess: () => { alert('Reputation loan issued — no collateral locked. USDC credited.'); setAmount(''); refetch(); },
      onError: (err: any) => alert(`Error: ${err.response?.data?.error || err.message}`),
    }
  );
  if (isLoading) return null;
  const band = (quote?.band || 'D') as 'A' | 'B' | 'C' | 'D' | 'E';
  const bandColor = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444' }[band] || '#888';
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-9 h-9 rounded-full flex items-center justify-center font-black text-on-primary" style={{ background: bandColor }}>{band}</span>
        <h2 className="text-xl font-black text-on-surface font-headline">Reputation Loan — No Collateral</h2>
      </div>
      <p className="text-sm text-on-surface-variant mb-4">
        Priced on your Trust Passport band. We extend credit on your verified track record — no PAB lock required.
        Flat {quote?.feePct}% processing fee (no interest).
      </p>
      {!quote?.eligible ? (
        <div className="bg-error/10 border border-error/20 rounded-2xl p-4 text-center text-sm text-error">
          Band {band} — build your trust passport to qualify.
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-primary mb-3">Max borrow: ${(quote?.maxBorrowUsdc || 0).toLocaleString()} USDC</p>
          <form onSubmit={(e) => { e.preventDefault(); if (amount && Number(amount) > 0) mutation.mutate(Number(amount)); }} className="space-y-3 max-w-md">
            <input
              type="number" min="1" max={quote?.maxBorrowUsdc || 0} value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant focus:border-primary transition-all font-body text-on-surface"
              placeholder="USDC amount"
            />
            {amount && (
              <p className="text-xs text-on-surface-variant">
                Fee ({quote?.feePct}%): ${(Number(amount) * (quote?.feePct / 100)).toFixed(2)} · Repay: ${(Number(amount) * (1 + quote?.feePct / 100)).toFixed(2)}
              </p>
            )}
            <button type="submit" disabled={mutation.isLoading || !amount || Number(amount) > (quote?.maxBorrowUsdc || 0)}
              className="w-full py-3 px-4 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
              {mutation.isLoading ? 'Issuing…' : 'Borrow on Reputation'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
