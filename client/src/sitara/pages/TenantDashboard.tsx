// Sitara OS — Tenant Dashboard
// Main dashboard for tenants

import { useSitaraStore } from '../store/sitaraStore';

export default function TenantDashboard() {
  const { user } = useSitaraStore();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Welcome, {user?.name || 'Tenant'}</h1>
        <p className="text-slate-600 mt-1">Your tenant portal</p>
      </div>

      {/* Star Power Card */}
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Your Star Power</h3>
          <span className="text-sm opacity-80">★ {user?.starPower || 0}</span>
        </div>
        <p className="text-4xl font-bold mb-2">{user?.starTier || 'Tara'}</p>
        <p className="text-sm opacity-80">Verified check-ins: {user?.verifiedCheckIns || 0}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <button className="bg-white border border-slate-200 rounded-lg p-6 text-left hover:shadow-md transition-shadow">
          <span className="text-2xl mb-2 block">💳</span>
          <h3 className="font-semibold text-slate-900">Pay Rent</h3>
          <p className="text-sm text-slate-600">Next payment due in 12 days</p>
        </button>
        <button className="bg-white border border-slate-200 rounded-lg p-6 text-left hover:shadow-md transition-shadow">
          <span className="text-2xl mb-2 block">🔧</span>
          <h3 className="font-semibold text-slate-900">Maintenance</h3>
          <p className="text-sm text-slate-600">0 open requests</p>
        </button>
        <button className="bg-white border border-slate-200 rounded-lg p-6 text-left hover:shadow-md transition-shadow">
          <span className="text-2xl mb-2 block">📄</span>
          <h3 className="font-semibold text-slate-900">My Lease</h3>
          <p className="text-sm text-slate-600">View lease details</p>
        </button>
      </div>

      {/* Lease Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Lease Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Unit</p>
            <p className="font-medium">2A</p>
          </div>
          <div>
            <p className="text-slate-500">Monthly Rent</p>
            <p className="font-medium">$1,850</p>
          </div>
          <div>
            <p className="text-slate-500">Lease End</p>
            <p className="font-medium">Jun 30, 2027</p>
          </div>
          <div>
            <p className="text-slate-500">Deposit</p>
            <p className="font-medium">$1,850</p>
          </div>
        </div>
      </div>
    </div>
  );
}
