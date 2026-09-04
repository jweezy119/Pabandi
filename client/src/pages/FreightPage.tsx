import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { freightService } from '../services/api';
import { useAuthStore } from '../store/authStore';

const CARGO_TYPES = ['GENERAL', 'REFRIGERATED', 'HAZARDOUS', 'OVERSIZED', 'FRAGILE'];

export const FreightPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'loads' | 'post' | 'carriers' | 'my-loads'>('dashboard');
  const [stats, setStats] = useState<any>({});
  const [loads, setLoads] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [myLoads, setMyLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDest, setSearchDest] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'loads') loadLoads();
    if (activeTab === 'carriers') loadCarriers();
    if (activeTab === 'my-loads') loadMyLoads();
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      const [statsRes, loadsRes, carriersRes] = await Promise.all([
        freightService.getStats(),
        freightService.listLoads({ status: 'OPEN' }),
        freightService.listCarriers({ verified: true }),
      ]);
      setStats(statsRes.data?.data || {});
      setLoads(loadsRes.data?.data || []);
      setCarriers(carriersRes.data?.data || []);
    } catch (e) {
      console.error('Failed to load initial data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLoads = async () => {
    setLoading(true);
    try {
      const res = await freightService.listLoads({
        status: 'OPEN',
        originCity: searchOrigin || undefined,
        destCity: searchDest || undefined,
      });
      setLoads(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load loads:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCarriers = async () => {
    setLoading(true);
    try {
      const res = await freightService.listCarriers({});
      setCarriers(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load carriers:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMyLoads = async () => {
    setLoading(true);
    try {
      const res = await freightService.listLoads({ shipperId: user?.id });
      setMyLoads(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load my loads:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* App Header */}
      <header className="bg-[#111827] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg">
              F
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">FreightOS</h1>
              <p className="text-xs text-slate-400">by Pabandi</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Pabandi
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-sm font-bold">
              {user?.firstName?.[0] || '?'}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-[#111827]/50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'loads', label: 'Load Board', icon: '📦' },
            { id: 'post', label: 'Post Load', icon: '➕' },
            { id: 'carriers', label: 'Carriers', icon: '🚛' },
            { id: 'my-loads', label: 'My Loads', icon: '📋' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-orange-400 border-orange-400'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard stats={stats} loads={loads} carriers={carriers} onNavigate={setActiveTab} />}
        {activeTab === 'loads' && <LoadBoard loads={loads} loading={loading} searchOrigin={searchOrigin} searchDest={searchDest} setSearchOrigin={setSearchOrigin} setSearchDest={setSearchDest} onSearch={loadLoads} />}
        {activeTab === 'post' && <PostLoadForm onSuccess={() => { loadInitialData(); setActiveTab('my-loads'); }} />}
        {activeTab === 'carriers' && <CarrierDirectory carriers={carriers} loading={loading} />}
        {activeTab === 'my-loads' && <MyLoads loads={myLoads} loading={loading} />}
      </main>
    </div>
  );
};

const Dashboard: React.FC<{ stats: any; loads: any[]; carriers: any[]; onNavigate: (tab: any) => void }> = ({ stats, loads, carriers, onNavigate }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white">{stats.activeLoads || 0}</div>
          <div className="text-sm text-slate-400">Active Loads</div>
        </div>
        <div className="bg-[#111827] rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white">{stats.verifiedCarriers || 0}</div>
          <div className="text-sm text-slate-400">Verified Carriers</div>
        </div>
        <div className="bg-[#111827] rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white">{stats.completedLoads || 0}</div>
          <div className="text-sm text-slate-400">Completed</div>
        </div>
        <div className="bg-[#111827] rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-emerald-400">98%</div>
          <div className="text-sm text-slate-400">On-Time Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => onNavigate('post')} className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-6 text-left text-white hover:opacity-90 transition-opacity">
          <div className="text-3xl mb-2">📦</div>
          <div className="font-bold text-lg">Post a Load</div>
          <div className="text-sm text-white/80">Get instant bids from carriers</div>
        </button>
        <button onClick={() => onNavigate('loads')} className="bg-[#111827] rounded-xl p-6 text-left text-white border border-white/5 hover:border-orange-400/50 transition-all">
          <div className="text-3xl mb-2">🔍</div>
          <div className="font-bold text-lg">Browse Loads</div>
          <div className="text-sm text-slate-400">{loads.length} loads available</div>
        </button>
        <button onClick={() => onNavigate('carriers')} className="bg-[#111827] rounded-xl p-6 text-left text-white border border-white/5 hover:border-orange-400/50 transition-all">
          <div className="text-3xl mb-2">🚛</div>
          <div className="font-bold text-lg">Find Carriers</div>
          <div className="text-sm text-slate-400">{carriers.length} verified carriers</div>
        </button>
      </div>

      <div className="bg-[#111827] rounded-xl border border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-bold text-white">Recent Loads</h3>
          <button onClick={() => onNavigate('loads')} className="text-sm text-orange-400 hover:text-orange-300">View All</button>
        </div>
        <div className="divide-y divide-white/5">
          {loads.slice(0, 5).map((load) => (
            <div key={load.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
              <div>
                <div className="font-medium text-white">{load.title}</div>
                <div className="text-sm text-slate-400">{load.originCity} → {load.destCity} · {load.weightLbs} lbs</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-400">${load.budgetUsd}</div>
                <div className="text-xs text-slate-500">{load._count?.bids || 0} bids</div>
              </div>
            </div>
          ))}
          {loads.length === 0 && <div className="px-4 py-8 text-center text-slate-400">No loads available yet</div>}
        </div>
      </div>
    </div>
  );
};

const LoadBoard: React.FC<any> = ({ loads, loading, searchOrigin, searchDest, setSearchOrigin, setSearchDest, onSearch }) => {
  return (
    <div className="space-y-4">
      <div className="bg-[#111827] rounded-xl p-4 border border-white/5">
        <div className="flex gap-3">
          <input value={searchOrigin} onChange={(e) => setSearchOrigin(e.target.value)} placeholder="Origin city..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-slate-500 outline-none focus:border-orange-400" />
          <input value={searchDest} onChange={(e) => setSearchDest(e.target.value)} placeholder="Destination city..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-slate-500 outline-none focus:border-orange-400" />
          <button onClick={onSearch} className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">Search</button>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : loads.length === 0 ? (
        <div className="bg-[#111827] rounded-xl p-12 text-center border border-white/5">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-xl font-bold text-white mb-2">No loads found</h3>
          <p className="text-slate-400">Try adjusting your search or post a load yourself.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loads.map((load: any) => (
            <div key={load.id} className="bg-[#111827] rounded-xl p-4 border border-white/5 hover:border-orange-400/30 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white">{load.title}</h3>
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">{load.cargoType}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span>📍 {load.originCity}, {load.originState}</span>
                    <span>→</span>
                    <span>{load.destCity}, {load.destState}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                    <span>{load.weightLbs.toLocaleString()} lbs</span>
                    {load.dimensions && <span>{load.dimensions} in</span>}
                    <span>Pickup: {new Date(load.pickupDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-emerald-400">${load.budgetUsd.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{load._count?.bids || 0} bids</div>
                  <button className="mt-2 px-4 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors">View & Bid</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PostLoadForm: React.FC<any> = ({ onSuccess }) => {
  const { isAuthenticated } = useAuthStore();
  const [form, setForm] = useState({
    title: '', description: '', cargoType: 'GENERAL', weightLbs: '', dimensions: '', valueUsd: '',
    originAddress: '', originCity: '', originState: '', originZip: '',
    destAddress: '', destCity: '', destState: '', destZip: '',
    pickupDate: '', deliveryDate: '', budgetUsd: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    setSubmitting(true);
    try {
      await freightService.createLoad({
        ...form,
        weightLbs: Number(form.weightLbs),
        valueUsd: Number(form.valueUsd),
        budgetUsd: Number(form.budgetUsd),
        pickupDate: new Date(form.pickupDate),
        deliveryDate: new Date(form.deliveryDate),
      });
      onSuccess();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to post load');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-[#111827] rounded-xl p-12 text-center border border-white/5">
        <div className="text-5xl mb-4">🔐</div>
        <h3 className="text-xl font-bold text-white mb-2">Sign in to post a load</h3>
        <button className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg" onClick={() => window.location.href = '/login'}>Sign In</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#111827] rounded-xl p-6 border border-white/5">
        <h3 className="text-lg font-bold text-white mb-4">📦 Cargo Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Electronics shipment" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Cargo Type</label>
            <select value={form.cargoType} onChange={(e) => setForm({ ...form, cargoType: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400">
              {CARGO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Weight (lbs) *</label>
            <input type="number" value={form.weightLbs} onChange={(e) => setForm({ ...form, weightLbs: e.target.value })} placeholder="1000" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Dimensions (LxWxH in)</label>
            <input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="48x40x48" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Declared Value ($) *</label>
            <input type="number" value={form.valueUsd} onChange={(e) => setForm({ ...form, valueUsd: e.target.value })} placeholder="5000" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-300 mb-1 block">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the cargo, special handling requirements..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400 resize-none" />
          </div>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-white/5">
        <h3 className="text-lg font-bold text-white mb-4">📍 Pickup Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={form.originAddress} onChange={(e) => setForm({ ...form, originAddress: e.target.value })} placeholder="Street address *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          <div className="grid grid-cols-3 gap-2">
            <input value={form.originCity} onChange={(e) => setForm({ ...form, originCity: e.target.value })} placeholder="City *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
            <input value={form.originState} onChange={(e) => setForm({ ...form, originState: e.target.value })} placeholder="State *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
            <input value={form.originZip} onChange={(e) => setForm({ ...form, originZip: e.target.value })} placeholder="ZIP *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          </div>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-white/5">
        <h3 className="text-lg font-bold text-white mb-4">🏁 Delivery Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={form.destAddress} onChange={(e) => setForm({ ...form, destAddress: e.target.value })} placeholder="Street address *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          <div className="grid grid-cols-3 gap-2">
            <input value={form.destCity} onChange={(e) => setForm({ ...form, destCity: e.target.value })} placeholder="City *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
            <input value={form.destState} onChange={(e) => setForm({ ...form, destState: e.target.value })} placeholder="State *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
            <input value={form.destZip} onChange={(e) => setForm({ ...form, destZip: e.target.value })} placeholder="ZIP *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          </div>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl p-6 border border-white/5">
        <h3 className="text-lg font-bold text-white mb-4">📅 Schedule & Budget</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Pickup Date *</label>
            <input type="date" value={form.pickupDate} onChange={(e) => setForm({ ...form, pickupDate: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400" required />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Delivery Date *</label>
            <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400" required />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Budget ($) *</label>
            <input type="number" value={form.budgetUsd} onChange={(e) => setForm({ ...form, budgetUsd: e.target.value })} placeholder="1500" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          </div>
        </div>
      </div>

      <button type="submit" disabled={submitting} className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50">
        {submitting ? 'Posting...' : 'Post Load & Get Bids'}
      </button>
    </form>
  );
};

const CarrierDirectory: React.FC<any> = ({ carriers, loading }) => {
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading carriers...</div>
      ) : carriers.length === 0 ? (
        <div className="bg-[#111827] rounded-xl p-12 text-center border border-white/5">
          <div className="text-5xl mb-4">🚛</div>
          <h3 className="text-xl font-bold text-white mb-2">No carriers yet</h3>
          <p className="text-slate-400">Be the first to register as a carrier!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {carriers.map((carrier: any) => (
            <div key={carrier.id} className="bg-[#111827] rounded-xl p-4 border border-white/5 hover:border-orange-400/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-300 font-bold text-lg">
                  {carrier.companyName[0]}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{carrier.companyName}</div>
                  <div className="text-xs text-slate-400">{carrier.equipmentType?.join(', ')}</div>
                </div>
                {carrier.verified && <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300">Verified</span>}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{carrier.totalDeliveries} deliveries</span>
                <span className="font-bold text-emerald-400">{carrier.rating.toFixed(1)} ⭐</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {carrier.operatingStates?.length || 0} states · {carrier.fleetSize} vehicles
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MyLoads: React.FC<any> = ({ loads, loading }) => {
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : loads.length === 0 ? (
        <div className="bg-[#111827] rounded-xl p-12 text-center border border-white/5">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-white mb-2">No loads yet</h3>
          <p className="text-slate-400">Post your first load to get started.</p>
        </div>
      ) : (
        loads.map((load: any) => (
          <div key={load.id} className="bg-[#111827] rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">{load.title}</h3>
                <p className="text-sm text-slate-400">{load.originCity} → {load.destCity}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded text-xs ${load.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-300' : load.status === 'ASSIGNED' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-500/20 text-slate-300'}`}>
                  {load.status}
                </span>
                <div className="font-bold text-emerald-400 mt-1">${load.budgetUsd}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default FreightPage;
