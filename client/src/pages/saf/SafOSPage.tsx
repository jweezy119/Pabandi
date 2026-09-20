import { useState } from 'react';
import DashboardLayout, { NavItem } from '../../components/DashboardLayout';

const NAV_ITEMS: NavItem[] = [
  { path: '/saf', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/saf#load-board', label: 'Load Board', icon: 'local_shipping' },
  { path: '/saf#my-loads', label: 'My Loads', icon: 'inventory_2' },
  { path: '/saf#post-load', label: 'Post Load', icon: 'add_box' },
  { path: '/saf#carriers', label: 'Carriers', icon: 'groups' },
];

const STAT_CARDS = [
  { label: 'Active Loads', value: '0', icon: 'local_shipping', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { label: 'Verified Carriers', value: '0', icon: 'verified', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { label: 'Completed', value: '0', icon: 'check_circle', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { label: 'Revenue', value: '$0', icon: 'attach_money', color: 'text-amber-400', bg: 'bg-amber-500/10' },
];

const SAMPLE_LOADS = [
  { id: '1', title: 'Electronics Shipment', origin: 'Chicago, IL', dest: 'New York, NY', weight: '500 lbs', budget: '$2,500', status: 'Open' },
  { id: '2', title: 'Frozen Food Delivery', origin: 'Los Angeles, CA', dest: 'Phoenix, AZ', weight: '2,000 lbs', budget: '$1,800', status: 'Open' },
  { id: '3', title: 'Construction Materials', origin: 'Houston, TX', dest: 'Dallas, TX', weight: '15,000 lbs', budget: '$3,200', status: 'Bidding' },
];

const SAMPLE_CARRIERS = [
  { id: '1', name: 'Swift Transport', fleet: 25, rating: 4.8, deliveries: 156, verified: true },
  { id: '2', name: 'Cold Chain Logistics', fleet: 12, rating: 4.9, deliveries: 89, verified: true },
  { id: '3', name: 'Heavy Haul Inc', fleet: 30, rating: 4.7, deliveries: 234, verified: true },
  { id: '4', name: 'Express Freight', fleet: 45, rating: 4.6, deliveries: 512, verified: false },
];

type Tab = 'dashboard' | 'load-board' | 'my-loads' | 'post-load' | 'carriers';

export default function SafOSPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'load-board', label: 'Load Board' },
    { key: 'my-loads', label: 'My Loads' },
    { key: 'post-load', label: 'Post Load' },
    { key: 'carriers', label: 'Carriers' },
  ];

  return (
    <DashboardLayout osName="Saf OS" osIcon="S" osColor="amber" navItems={NAV_ITEMS}>
      {/* Tab Navigation */}
      <div className="flex overflow-x-auto gap-1 mb-6 bg-white/5 rounded-xl p-1 border border-white/5">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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
            <p className="text-slate-400 mt-1">Welcome back. Here's your freight overview.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STAT_CARDS.map((stat) => (
              <div key={stat.label} className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{stat.label}</p>
                    <p className="text-2xl lg:text-3xl font-black text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                    <span className="material-symbols-outlined text-[24px]">{stat.icon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section aria-labelledby="modules-heading">
            <h2 id="modules-heading" className="text-lg font-bold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Post a Load', desc: 'Get instant bids from carriers', icon: 'add_box', tab: 'post-load' as Tab },
                { title: 'Browse Loads', desc: 'Find available freight', icon: 'local_shipping', tab: 'load-board' as Tab },
                { title: 'Find Carriers', desc: 'Verified transport partners', icon: 'groups', tab: 'carriers' as Tab },
                { title: 'My Shipments', desc: 'Track active shipments', icon: 'inventory_2', tab: 'my-loads' as Tab },
              ].map((action) => (
                <button
                  key={action.title}
                  onClick={() => setActiveTab(action.tab)}
                  className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5 hover:border-amber-400/30 transition-all text-left"
                >
                  <span className="material-symbols-outlined text-3xl text-amber-400 mb-3">{action.icon}</span>
                  <p className="font-bold text-white">{action.title}</p>
                  <p className="text-sm text-slate-400 mt-1">{action.desc}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Load Board Tab */}
      {activeTab === 'load-board' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-white">Load Board</h1>
            <p className="text-slate-400 mt-1">Browse and bid on available loads.</p>
          </div>

          <div className="grid gap-4">
            {SAMPLE_LOADS.map((load) => (
              <div key={load.id} className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5 hover:border-amber-400/20 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white">{load.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      <span className="material-symbols-outlined text-[14px] align-middle">location_on</span>{' '}
                      {load.origin} → {load.dest}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {load.weight} • Budget: {load.budget}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      load.status === 'Open' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {load.status}
                    </span>
                    <button className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors">
                      Bid Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Loads Tab */}
      {activeTab === 'my-loads' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-white">My Loads</h1>
            <p className="text-slate-400 mt-1">Manage your active shipments.</p>
          </div>

          <div className="bg-white/5 backdrop-blur rounded-xl border border-white/5 p-8 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">inventory_2</span>
            <h3 className="text-lg font-bold text-white mb-2">No Active Shipments</h3>
            <p className="text-slate-400 mb-4">Post your first load to get started with freight management.</p>
            <button
              onClick={() => setActiveTab('post-load')}
              className="px-6 py-2 bg-amber-500/20 text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors"
            >
              Post a Load
            </button>
          </div>
        </div>
      )}

      {/* Post Load Tab */}
      {activeTab === 'post-load' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-white">Post a Load</h1>
            <p className="text-slate-400 mt-1">Create a new shipment request.</p>
          </div>

          <div className="bg-white/5 backdrop-blur rounded-xl border border-white/5 p-6">
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Origin City</label>
                  <input
                    type="text"
                    placeholder="Chicago, IL"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Destination City</label>
                  <input
                    type="text"
                    placeholder="New York, NY"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cargo Type</label>
                  <select className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50">
                    <option value="">Select type</option>
                    <option value="GENERAL">General</option>
                    <option value="REFRIGERATED">Refrigerated</option>
                    <option value="HAZARDOUS">Hazardous</option>
                    <option value="OVERSIZED">Oversized</option>
                    <option value="FRAGILE">Fragile</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Weight (lbs)</label>
                  <input
                    type="number"
                    placeholder="1000"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Budget (USD)</label>
                <input
                  type="number"
                  placeholder="2500"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe your shipment requirements..."
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Post Load & Get Bids
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Carrier Directory Tab */}
      {activeTab === 'carriers' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-white">Carrier Directory</h1>
            <p className="text-slate-400 mt-1">Browse verified transport partners.</p>
          </div>

          <div className="grid gap-4">
            {SAMPLE_CARRIERS.map((carrier) => (
              <div key={carrier.id} className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/5 hover:border-amber-400/20 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{carrier.name}</h3>
                      {carrier.verified && (
                        <span className="material-symbols-outlined text-[16px] text-amber-400">verified</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      Fleet: {carrier.fleet} vehicles • {carrier.deliveries} deliveries
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-amber-400">star</span>
                      <span className="text-sm text-white font-medium">{carrier.rating}</span>
                    </div>
                    <button className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors">
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
