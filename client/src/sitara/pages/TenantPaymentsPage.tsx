// Sitara OS — Tenant Payments Page with PAB/USDC toggle
// Shows payment history with token breakdown and staking info

import { useState, useEffect } from 'react';

interface Payment {
  id: string;
  date: string;
  amount: number;
  token: 'USDC' | 'PAB';
  status: string;
  method?: string;
  discountApplied?: number;
  stakedAmount?: number;
  txHash?: string;
}

export default function TenantPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<'all' | 'USDC' | 'PAB'>('all');
  const [pabBalance, setPabBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    try {
      // In production, this would call the API
      // const response = await fetch('/api/v1/lease-pab/payment-history');
      // const data = await response.json();
      
      // Mock data for demonstration
      const mockPayments: Payment[] = [
        { id: '1', date: '2026-09-01', amount: 1757.50, token: 'PAB', status: 'CONFIRMED', discountApplied: 92.50, stakedAmount: 175.75, txHash: 'pabc...123' },
        { id: '2', date: '2026-08-01', amount: 1850, token: 'USDC', status: 'PAID', method: 'ACH' },
        { id: '3', date: '2026-07-01', amount: 1757.50, token: 'PAB', status: 'CONFIRMED', discountApplied: 92.50, stakedAmount: 175.75, txHash: 'pabc...456' },
        { id: '4', date: '2026-06-01', amount: 1850, token: 'USDC', status: 'PAID', method: 'Card' },
        { id: '5', date: '2026-05-01', amount: 1757.50, token: 'PAB', status: 'CONFIRMED', discountApplied: 92.50, stakedAmount: 175.75, txHash: 'pabc...789' },
      ];
      setPayments(mockPayments);
      setPabBalance(1250);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => filter === 'all' || p.token === filter);

  const totalSaved = payments
    .filter(p => p.discountApplied)
    .reduce((sum, p) => sum + (p.discountApplied || 0), 0);

  const totalStaked = payments
    .filter(p => p.stakedAmount)
    .reduce((sum, p) => sum + (p.stakedAmount || 0), 0);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Payments</h1>
      <p className="text-slate-600 mb-6">Your rent payment history with PAB savings</p>

      {/* PAB Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-80">PAB Balance</div>
          <div className="text-2xl font-bold">{pabBalance.toLocaleString()} PAB</div>
          <div className="text-xs opacity-70 mt-1">~${pabBalance.toLocaleString()} USD value</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-80">Total Saved (PAB Discount)</div>
          <div className="text-2xl font-bold">${totalSaved.toFixed(2)}</div>
          <div className="text-xs opacity-70 mt-1">5% discount on PAB payments</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-80">Auto-Staked (Trust Boost)</div>
          <div className="text-2xl font-bold">{totalStaked.toFixed(2)} PAB</div>
          <div className="text-xs opacity-70 mt-1">10% of PAB payments staked</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'USDC', 'PAB'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'all' ? 'All Payments' : f}
          </button>
        ))}
      </div>

      {/* Payment Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Token</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Savings</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Staked</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredPayments.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm text-slate-900">{payment.date}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {payment.amount.toFixed(2)} {payment.token}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    payment.token === 'PAB'
                      ? 'bg-violet-100 text-violet-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {payment.token}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {payment.discountApplied ? (
                    <span className="text-emerald-600 font-medium">
                      -${payment.discountApplied.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {payment.stakedAmount ? (
                    <span className="text-blue-600 font-medium">
                      {payment.stakedAmount.toFixed(2)} PAB
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    payment.status === 'CONFIRMED' || payment.status === 'PAID'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {payment.status.toLowerCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAB Payment CTA */}
      <div className="mt-8 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Pay with PAB for 5% Discount</h3>
            <p className="text-sm text-slate-600 mt-1">
              Next payment: <strong>1,850 USDC</strong> → <strong>1,757.50 PAB</strong> (save $92.50)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              10% of PAB payment auto-staked for trust score boost
            </p>
          </div>
          <button className="px-6 py-3 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors">
            Pay with PAB
          </button>
        </div>
      </div>
    </div>
  );
}
