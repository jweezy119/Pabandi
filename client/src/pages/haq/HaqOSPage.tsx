import { useState } from 'react';
import DashboardLayout, { NavItem } from '../../components/DashboardLayout';

const NAV_ITEMS: NavItem[] = [
  { path: '/haq', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/haq#tenants', label: 'Tenants', icon: 'people' },
  { path: '/haq#leases', label: 'Leases', icon: 'description' },
  { path: '/haq#inspections', label: 'Inspections', icon: 'fact_check' },
  { path: '/haq#financials', label: 'Financials', icon: 'bar_chart' },
];

const STAT_CARDS = [
  { label: 'Properties', value: '12', sub: '10 occupied', icon: 'apartment', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { label: 'Tenants', value: '18', sub: '2 at risk', icon: 'people', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { label: 'Revenue', value: '$24.5K', sub: 'This month', icon: 'attach_money', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { label: 'Open Issues', value: '5', sub: '2 urgent', icon: 'build', color: 'text-rose-400', bg: 'bg-rose-500/10' },
];

const SAMPLE_TENANTS = [
  { id: '1', name: 'Ahmed Khan', email: 'ahmed@email.com', property: 'Sunset Apartments', unit: '2A', status: 'Active', risk: 'Low' },
  { id: '2', name: 'Sara Ali', email: 'sara@email.com', property: 'Maple Grove', unit: '1B', status: 'Active', risk: 'Medium' },
  { id: '3', name: 'Omar Hassan', email: 'omar@email.com', property: 'Ocean View', unit: '3C', status: 'Active', risk: 'High' },
  { id: '4', name: 'Fatima Noor', email: 'fatima@email.com', property: 'Sunset Apartments', unit: '4D', status: 'Active', risk: 'Low' },
];

const SAMPLE_LEASES = [
  { id: '1', tenant: 'Ahmed Khan', property: 'Sunset Apartments', unit: '2A', start: '2025-01-01', end: '2026-12-31', rent: '$1,500', status: 'Active' },
  { id: '2', tenant: 'Sara Ali', property: 'Maple Grove', unit: '1B', start: '2025-06-01', end: '2026-05-31', rent: '$1,200', status: 'Expiring Soon' },
  { id: '3', tenant: 'Omar Hassan', property: 'Ocean View', unit: '3C', start: '2025-03-01', end: '2026-02-28', rent: '$1,800', status: 'Expiring Soon' },
];

const SAMPLE_INSPECTIONS = [
  { id: '1', property: 'Sunset Apartments', unit: '2A', date: '2026-10-15', type: 'Routine', status: 'Scheduled' },
  { id: '2', property: 'Maple Grove', unit: '1B', date: '2026-10-10', type: 'Move-out', status: 'Pending' },
  { id: '3', property: 'Ocean View', unit: '3C', date: '2026-10-05', type: 'Maintenance', status: 'Completed' },
];

type Tab = 'dashboard' | 'tenants' | 'leases' | 'inspections' | 'financials';

export default function HaqOSPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'tenants', label: 'Tenants' },
    { key: 'leases', label: 'Leases' },
    { key: 'inspections', label: 'Inspections' },
    { key: 'financials', label: 'Financials' },
  ];

  return (
    <DashboardLayout osName="Haq OS" osIcon="H" osColor="violet" navItems={NAV_ITEMS}>
      {/* Tab Navigation */}
      <div className="flex overflow-x-auto gap-1 mb-6 bg-white/5 rounded-xl p-1 border border-white/5">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-white">Dashboard</h1>
            <p className="text-slate-400 mt-1">Property management overview.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STAT_CARDS.map((stat) => (
              <div key={stat.label} className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{stat.label}</p>
                    <p className="text-2xl lg:text-3xl font-black text-white mt-1">{stat.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                    <span className="material-symbols-outlined text-[24px]">{stat.icon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Add Tenant', desc: 'Register a new tenant', icon: 'person_add', tab: 'tenants' as Tab },
                { title: 'Create Lease', desc: 'Draft a new lease agreement', icon: 'description', tab: 'leases' as Tab },
                { title: 'Schedule Inspection', desc: 'Plan property inspection', icon: 'event', tab: 'inspections' as Tab },
                { title: 'View Reports', desc: 'Financial performance', icon: 'bar_chart', tab: 'financials' as Tab },
              ].map((action) => (
                <button
                  key={action.title}
                  onClick={() => setActiveTab(action.tab)}
                  className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5 hover:border-violet-400/30 transition-all text-left"
                >
                  <span className="material-symbols-outlined text-3xl text-violet-400 mb-3">{action.icon}</span>
                  <p className="font-bold text-white">{action.title}</p>
                  <p className="text-sm text-slate-400 mt-1">{action.desc}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Tenants Tab */}
      {activeTab === 'tenants' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-white">Tenants</h1>
              <p className="text-slate-400 mt-1">Manage tenant profiles and risk scores.</p>
            </div>
            <button className="px-4 py-2 bg-violet-500/20 text-violet-300 rounded-lg text-sm font-medium hover:bg-violet-500/30 transition-colors">
              + Add Tenant
            </button>
          </div>

          <div className="bg-white/5 backdrop-blur rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Property</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_TENANTS.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-white">{tenant.name}</p>
                          <p className="text-xs text-slate-500">{tenant.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-300">{tenant.property}</p>
                        <p className="text-xs text-slate-500">Unit {tenant.unit}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300">
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tenant.risk === 'Low' ? 'bg-emerald-500/20 text-emerald-300' :
                          tenant.risk === 'Medium' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-rose-500/20 text-rose-300'
                        }`}>
                          {tenant.risk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Leases Tab */}
      {activeTab === 'leases' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-white">Leases</h1>
              <p className="text-slate-400 mt-1">Active leases and expiring soon.</p>
            </div>
            <button className="px-4 py-2 bg-violet-500/20 text-violet-300 rounded-lg text-sm font-medium hover:bg-violet-500/30 transition-colors">
              + Create Lease
            </button>
          </div>

          <div className="grid gap-4">
            {SAMPLE_LEASES.map((lease) => (
              <div key={lease.id} className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5 hover:border-violet-400/20 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white">{lease.tenant}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {lease.property} • Unit {lease.unit}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {lease.start} → {lease.end} • {lease.rent}/mo
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      lease.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {lease.status}
                    </span>
                    <button className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors">
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inspections Tab */}
      {activeTab === 'inspections' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-white">Inspections</h1>
              <p className="text-slate-400 mt-1">Schedule and manage property inspections.</p>
            </div>
            <button className="px-4 py-2 bg-violet-500/20 text-violet-300 rounded-lg text-sm font-medium hover:bg-violet-500/30 transition-colors">
              + Schedule Inspection
            </button>
          </div>

          <div className="grid gap-4">
            {SAMPLE_INSPECTIONS.map((inspection) => (
              <div key={inspection.id} className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5 hover:border-violet-400/20 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white">{inspection.property}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Unit {inspection.unit} • {inspection.type}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      <span className="material-symbols-outlined text-[14px] align-middle">event</span>{' '}
                      {inspection.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      inspection.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' :
                      inspection.status === 'Scheduled' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-amber-500/20 text-amber-300'
                    }`}>
                      {inspection.status}
                    </span>
                    <button className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors">
                      View Report
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financials Tab */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-white">Financials</h1>
            <p className="text-slate-400 mt-1">Revenue, expenses, and profit overview.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5">
              <p className="text-sm text-slate-400">Total Revenue</p>
              <p className="text-3xl font-black text-white mt-1">$72,500</p>
              <p className="text-xs text-emerald-400 mt-1">+12% from last month</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5">
              <p className="text-sm text-slate-400">Total Expenses</p>
              <p className="text-3xl font-black text-white mt-1">$18,200</p>
              <p className="text-xs text-slate-500 mt-1">Maintenance, utilities, etc.</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5">
              <p className="text-sm text-slate-400">Net Profit</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">$54,300</p>
              <p className="text-xs text-emerald-400 mt-1">74.9% margin</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Monthly Breakdown</h3>
            <div className="space-y-3">
              {[
                { month: 'September 2026', revenue: '$24,500', expenses: '$5,200', profit: '$19,300' },
                { month: 'August 2026', revenue: '$23,800', expenses: '$6,100', profit: '$17,700' },
                { month: 'July 2026', revenue: '$24,200', expenses: '$6,900', profit: '$17,300' },
              ].map((row) => (
                <div key={row.month} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-slate-300">{row.month}</span>
                  <div className="flex gap-6 text-sm">
                    <span className="text-white font-medium">{row.revenue}</span>
                    <span className="text-rose-400">-{row.expenses}</span>
                    <span className="text-emerald-400 font-medium">{row.profit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
