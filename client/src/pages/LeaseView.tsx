import React from 'react';

interface LeaseData {
  propertyName: string;
  address: string;
  unit: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  depositStatus: 'locked' | 'released' | 'partially_released';
  petDeposit: number;
  status: 'active' | 'expiring' | 'terminated';
  renewalAvailable: boolean;
  renewalDeadline: string;
  earlyTermFee: number;
  paymentHistory: Array<{ id: string; amount: number; date: string; status: string; token: string }>;
}

export default function LeaseView() {
  const [showTermCalc, setShowTermCalc] = React.useState(false);

  // Simulated data — would fetch from lease API
  const lease: LeaseData = {
    propertyName: 'Parkview Apartments',
    address: '1234 Oak Street, Austin, TX 78701',
    unit: 'Unit 4B',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    monthlyRent: 1850,
    deposit: 1850,
    depositStatus: 'locked',
    petDeposit: 300,
    status: 'active',
    renewalAvailable: true,
    renewalDeadline: '2026-11-01',
    earlyTermFee: 3700,
    paymentHistory: [
      { id: '1', amount: 1850, date: '2026-09-01', status: 'completed', token: 'USDC' },
      { id: '2', amount: 1850, date: '2026-08-01', status: 'completed', token: 'USDC' },
      { id: '3', amount: 1757.5, date: '2026-07-01', status: 'completed', token: 'PAB' },
      { id: '4', amount: 1850, date: '2026-06-01', status: 'completed', token: 'USDC' },
    ],
  };

  const daysRemaining = Math.ceil(
    (new Date(lease.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Your Lease</h1>
          <p className="text-slate-400 text-sm mt-1">Review your lease terms and payment history</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${
          lease.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
          lease.status === 'expiring' ? 'bg-amber-500/20 text-amber-300' :
          'bg-red-500/20 text-red-300'
        }`}>
          {lease.status === 'active' ? 'Active' : lease.status === 'expiring' ? 'Expiring Soon' : 'Terminated'}
        </span>
      </div>

      {/* Property Info */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-3">Property</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Property</div>
            <div className="text-white font-medium">{lease.propertyName}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Unit</div>
            <div className="text-white font-medium">{lease.unit}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Address</div>
            <div className="text-white text-sm">{lease.address}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Days Remaining</div>
            <div className="text-white font-medium">{daysRemaining}</div>
          </div>
        </div>
      </div>

      {/* Lease Terms */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Lease Terms</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/5 p-4 border border-white/5">
            <div className="text-xs text-slate-500 mb-1">Start Date</div>
            <div className="text-white text-sm font-medium">
              {new Date(lease.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4 border border-white/5">
            <div className="text-xs text-slate-500 mb-1">End Date</div>
            <div className="text-white text-sm font-medium">
              {new Date(lease.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4 border border-white/5">
            <div className="text-xs text-slate-500 mb-1">Monthly Rent</div>
            <div className="text-white text-sm font-medium">${lease.monthlyRent.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4 border border-white/5">
            <div className="text-xs text-slate-500 mb-1">Pet Deposit</div>
            <div className="text-white text-sm font-medium">${lease.petDeposit.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Deposit Status */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Deposit Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                lease.depositStatus === 'locked' ? 'bg-emerald-500/20' : 'bg-slate-500/20'
              }`}>
                <span className={`material-symbols-outlined text-xl ${
                  lease.depositStatus === 'locked' ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {lease.depositStatus === 'locked' ? 'lock' : 'lock_open'}
                </span>
              </div>
              <div>
                <div className="text-white text-sm font-medium">Security Deposit</div>
                <div className="text-slate-400 text-xs capitalize">
                  {lease.depositStatus.replace('_', ' ')}
                </div>
              </div>
            </div>
            <div className="text-white font-bold">${lease.deposit.toLocaleString()}</div>
          </div>
          <div className="text-xs text-slate-500">
            Your deposit is held securely and will be returned within 30 days of lease end, minus any deductions.
          </div>
        </div>
      </div>

      {/* Renewal */}
      {lease.renewalAvailable && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold">Renew Your Lease</h3>
              <p className="text-slate-400 text-sm mt-1">
                Renew by {new Date(lease.renewalDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </p>
            </div>
            <button className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-all">
              Renew Now
            </button>
          </div>
        </div>
      )}

      {/* Early Termination Calculator */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <button
          onClick={() => setShowTermCalc(!showTermCalc)}
          className="flex items-center justify-between w-full"
        >
          <h2 className="text-lg font-bold text-white">Early Termination</h2>
          <span className={`material-symbols-outlined text-slate-400 transition-transform ${showTermCalc ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>
        {showTermCalc && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-amber-400">warning</span>
              <span className="text-amber-300 text-sm font-medium">Early Termination Fee</span>
            </div>
            <p className="text-slate-400 text-sm mb-3">
              Ending your lease before {new Date(lease.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} incurs a fee of 2 months rent.
            </p>
            <div className="text-2xl font-bold text-white">
              ${lease.earlyTermFee.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Plus any outstanding rent and damages
            </p>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Payment History</h2>
        <div className="space-y-2">
          {lease.paymentHistory.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  payment.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
                <div>
                  <div className="text-white text-sm font-medium">
                    {new Date(payment.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Rent
                  </div>
                  <div className="text-slate-500 text-xs">
                    {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold text-sm">${payment.amount.toLocaleString()}</div>
                <div className="text-slate-500 text-xs">{payment.token}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
