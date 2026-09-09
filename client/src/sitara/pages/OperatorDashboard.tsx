// Sitara OS — Operator Dashboard
// Main dashboard for property managers / business operators

import { useSitaraStore } from '../store/sitaraStore';

export default function OperatorDashboard() {
  const { user, units, bookings } = useSitaraStore();

  const stats = [
    { label: 'Total Units', value: units.length, icon: '🏢' },
    { label: 'Occupied', value: units.filter(u => u.status === 'occupied').length, icon: '🏠' },
    { label: 'Available', value: units.filter(u => u.status === 'available').length, icon: '🔑' },
    { label: 'Bookings This Month', value: bookings.length, icon: '📅' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Welcome back, {user?.name || 'Operator'}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-sm text-slate-600">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full px-4 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 text-left flex items-center gap-3">
              <span>➕</span> Add Unit
            </button>
            <button className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-left flex items-center gap-3">
              <span>📄</span> Create Lease
            </button>
            <button className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-left flex items-center gap-3">
              <span>👥</span> Invite Tenant
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-slate-600">New booking at Unit 2A</span>
              <span className="text-slate-400 ml-auto">2h ago</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-slate-600">Deposit held for Oak Tower viewing</span>
              <span className="text-slate-400 ml-auto">5h ago</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-slate-600">Tenant screening approved</span>
              <span className="text-slate-400 ml-auto">1d ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Star Power Insights */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6">
        <h3 className="font-semibold text-amber-900 mb-2">⭐ Star Power Insights</h3>
        <p className="text-sm text-amber-800 mb-4">
          Your top customers are your best asset. Use Star Finder to identify them and send exclusive promos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <p className="text-2xl font-bold text-slate-900">24</p>
            <p className="text-xs text-slate-600">Verified visitors this month</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-2xl font-bold text-slate-900">4.8</p>
            <p className="text-xs text-slate-600">Average rating</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-2xl font-bold text-green-600">92%</p>
            <p className="text-xs text-slate-600">Check-in rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
