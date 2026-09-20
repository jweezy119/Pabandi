import React from 'react';

const ALL_PAYMENTS = [
  { id: '1', amount: 1850, token: 'USDC', status: 'completed', date: '2026-09-01', description: 'Monthly Rent', method: 'USDC' },
  { id: '2', amount: 1850, token: 'USDC', status: 'completed', date: '2026-08-01', description: 'Monthly Rent', method: 'USDC' },
  { id: '3', amount: 1757.5, token: 'PAB', status: 'completed', date: '2026-07-01', description: 'Monthly Rent (5% discount)', method: 'PAB' },
  { id: '4', amount: 1850, token: 'USDC', status: 'completed', date: '2026-06-01', description: 'Monthly Rent', method: 'USDC' },
  { id: '5', amount: 1850, token: 'USDC', status: 'completed', date: '2026-05-01', description: 'Monthly Rent', method: 'USDC' },
  { id: '6', amount: 1757.5, token: 'PAB', status: 'completed', date: '2026-04-01', description: 'Monthly Rent (5% discount)', method: 'PAB' },
  { id: '7', amount: 1850, token: 'USDC', status: 'completed', date: '2026-03-01', description: 'Monthly Rent', method: 'USDC' },
  { id: '8', amount: 1850, token: 'USDC', status: 'completed', date: '2026-02-01', description: 'Monthly Rent', method: 'USDC' },
  { id: '9', amount: 300, token: 'USDC', status: 'completed', date: '2026-01-15', description: 'Pet Deposit', method: 'USDC' },
  { id: '10', amount: 1850, token: 'USDC', status: 'completed', date: '2026-01-01', description: 'Security Deposit', method: 'USDC' },
];

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/20 text-emerald-300',
  pending: 'bg-amber-500/20 text-amber-300',
  failed: 'bg-red-500/20 text-red-300',
};

export default function PaymentHistory() {
  const [filter, setFilter] = React.useState<'all' | 'USDC' | 'PAB'>('all');

  const filtered = filter === 'all' ? ALL_PAYMENTS : ALL_PAYMENTS.filter((p) => p.token === filter);
  const totalPaid = filtered.reduce((sum, p) => sum + p.amount, 0);
  const totalSaved = ALL_PAYMENTS.filter((p) => p.token === 'PAB').reduce((sum, p) => sum + (1850 - p.amount), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Payment History</h1>
        <p className="text-slate-400 text-sm mt-1">All your rent payments in one place</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Paid</div>
          <div className="text-2xl font-bold text-white">
            ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5">
          <div className="text-xs text-emerald-400 uppercase tracking-wider mb-1">Saved with PAB</div>
          <div className="text-2xl font-bold text-emerald-300">
            ${totalSaved.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Payments</div>
          <div className="text-2xl font-bold text-white">{filtered.length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'USDC', 'PAB'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Payment List */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <div className="space-y-3">
          {filtered.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  payment.token === 'PAB' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                }`}>
                  <span className={`material-symbols-outlined text-xl ${
                    payment.token === 'PAB' ? 'text-purple-400' : 'text-blue-400'
                  }`}>
                    {payment.token === 'PAB' ? 'account_balance_wallet' : 'attach_money'}
                  </span>
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{payment.description}</div>
                  <div className="text-slate-500 text-xs">
                    {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">${payment.amount.toLocaleString()}</div>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-slate-500 text-xs">{payment.token}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[payment.status]}`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
