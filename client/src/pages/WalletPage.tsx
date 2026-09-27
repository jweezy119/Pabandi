import React from 'react';
import { PageTransition } from '../components/PageTransition';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Button } from '../components/primitives/Button';
import toast from 'react-hot-toast';

export default function WalletPage() {
  const handleAction = () => {
    toast.success('Action initiated');
  };

  return (
    <ErrorBoundary>
      <PageTransition>
        <div className="max-w-4xl mx-auto p-6 lg:p-10 space-y-8">
          
          <header>
            <h1 className="text-3xl font-bold text-[var(--warm-ink)] font-headline tracking-tight">
              Pabandi Wallet
            </h1>
            <p className="text-[var(--soft-stone)] mt-1">
              Manage your funds, escrow deposits, and crypto balances.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-[var(--warm-ink)] to-[#1a1816] p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              
              <div className="flex items-center gap-2 opacity-80 mb-2">
                <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                <span className="text-sm font-semibold uppercase tracking-wider">USDC Balance</span>
              </div>
              <div className="text-5xl font-bold tracking-tight mb-8">$0.00</div>
              
              <div className="flex gap-3">
                <Button variant="primary" onClick={handleAction} className="bg-white text-[var(--warm-ink)] hover:bg-[rgba(255,255,255,0.9)] border-none">
                  Deposit
                </Button>
                <Button variant="secondary" onClick={handleAction} className="bg-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.2)] border-none">
                  Withdraw
                </Button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-[rgba(191,179,163,0.2)] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[var(--soft-stone)] mb-2">
                  <span className="material-symbols-outlined text-sm">stars</span>
                  <span className="text-sm font-semibold uppercase tracking-wider">Trust Tokens (PAB)</span>
                </div>
                <div className="text-4xl font-bold text-[var(--clay)] mb-2">0.00 PAB</div>
                <p className="text-sm text-[var(--soft-stone)]">
                  Earn PAB by completing jobs reliably and keeping commitments.
                </p>
              </div>
              <Button variant="outline" className="mt-6 self-start" onClick={handleAction}>
                View Rewards
              </Button>
            </div>
          </div>

          <section>
            <h2 className="text-sm font-bold text-[var(--soft-stone)] uppercase tracking-wider mb-4">Transaction History</h2>
            <div className="bg-white rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)] p-10 text-center">
              <span className="material-symbols-outlined text-[48px] text-[rgba(191,179,163,0.3)] mb-4">receipt_long</span>
              <h3 className="text-lg font-bold text-[var(--warm-ink)]">No transactions yet</h3>
              <p className="text-[var(--soft-stone)] max-w-sm mx-auto mt-2 text-sm">
                Your deposit and withdrawal history will appear here.
              </p>
            </div>
          </section>

        </div>
      </PageTransition>
    </ErrorBoundary>
  );
}
