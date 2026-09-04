import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { freightService } from '../services/api';
import { useAuthStore } from '../store/authStore';

const CARGO_TYPES = ['GENERAL', 'REFRIGERATED', 'HAZARDOUS', 'OVERSIZED', 'FRAGILE'];

export const FreightPage: React.FC = () => {
  const [tab, setTab] = useState<'loads' | 'post' | 'carriers'>('loads');
  const [loads, setLoads] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'loads') {
        const res = await freightService.listLoads({});
        setLoads(res.data?.data || []);
      } else if (tab === 'carriers') {
        const res = await freightService.listCarriers({});
        setCarriers(res.data?.data || []);
      }
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: tokens.color.background, fontFamily: tokens.font.body }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Freight & Logistics</h1>
          <p className="mt-2 text-slate-400">Ship goods with trusted carriers. Escrow-protected payments.</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('loads')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'loads' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            Available Loads
          </button>
          <button
            onClick={() => setTab('post')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'post' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            Post a Load
          </button>
          <button
            onClick={() => setTab('carriers')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'carriers' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            Carriers
          </button>
        </div>

        {tab === 'loads' && <LoadsList loads={loads} loading={loading} />}
        {tab === 'post' && <PostLoadForm onSuccess={loadData} />}
        {tab === 'carriers' && <CarriersList carriers={carriers} loading={loading} />}
      </div>
    </div>
  );
};

const LoadsList: React.FC<{ loads: any[]; loading: boolean }> = ({ loads, loading }) => {
  if (loading) return <p className="text-slate-400">Loading loads...</p>;

  return (
    <div className="space-y-4">
      {loads.length === 0 ? (
        <Surface className="p-8 text-center">
          <div className="text-4xl mb-4">🚚</div>
          <p className="text-slate-400">No loads available. Post one to get started!</p>
        </Surface>
      ) : (
        loads.map((load) => (
          <Surface key={load.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-white text-lg">{load.title}</h3>
                <p className="text-sm text-slate-400">
                  {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {load.weightLbs} lbs · {load.cargoType} · Pickup {new Date(load.pickupDate).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-300">${load.budgetUsd}</div>
                <Badge tone={load.status === 'OPEN' ? 'success' : 'info'}>{load.status}</Badge>
                <div className="text-xs text-slate-500 mt-1">
                  {load._count?.bids || 0} bids
                </div>
              </div>
            </div>
          </Surface>
        ))
      )}
    </div>
  );
};

const PostLoadForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { isAuthenticated } = useAuthStore();
  const [form, setForm] = useState({
    title: '',
    description: '',
    cargoType: 'GENERAL',
    weightLbs: '',
    dimensions: '',
    valueUsd: '',
    originAddress: '',
    originCity: '',
    originState: '',
    originZip: '',
    destAddress: '',
    destCity: '',
    destState: '',
    destZip: '',
    pickupDate: '',
    deliveryDate: '',
    budgetUsd: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
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
      alert('Load posted successfully!');
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to post load');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Surface className="p-8 text-center">
        <div className="text-4xl mb-4">🔐</div>
        <p className="text-white font-semibold">Sign in to post a load</p>
        <Button className="mt-4" onClick={() => window.location.href = '/login'}>Sign In</Button>
      </Surface>
    );
  }

  return (
    <Surface className="p-6">
      <h3 className="text-lg font-bold text-white mb-4">Post a New Load</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Electronics shipment"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Cargo Type</label>
            <select
              value={form.cargoType}
              onChange={(e) => setForm({ ...form, cargoType: e.target.value })}
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
            >
              {CARGO_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the cargo..."
            rows={3}
            className="w-full rounded-lg px-4 py-3 outline-none resize-none bg-white/5 border border-white/10 text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Weight (lbs) *</label>
            <input
              type="number"
              value={form.weightLbs}
              onChange={(e) => setForm({ ...form, weightLbs: e.target.value })}
              placeholder="1000"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Dimensions (LxWxH)</label>
            <input
              value={form.dimensions}
              onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
              placeholder="48x40x48"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Declared Value ($) *</label>
            <input
              type="number"
              value={form.valueUsd}
              onChange={(e) => setForm({ ...form, valueUsd: e.target.value })}
              placeholder="5000"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h4 className="font-semibold text-white mb-3">Origin</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={form.originAddress}
              onChange={(e) => setForm({ ...form, originAddress: e.target.value })}
              placeholder="Address *"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                value={form.originCity}
                onChange={(e) => setForm({ ...form, originCity: e.target.value })}
                placeholder="City *"
                className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
                required
              />
              <input
                value={form.originState}
                onChange={(e) => setForm({ ...form, originState: e.target.value })}
                placeholder="State *"
                className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
                required
              />
              <input
                value={form.originZip}
                onChange={(e) => setForm({ ...form, originZip: e.target.value })}
                placeholder="ZIP *"
                className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
                required
              />
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h4 className="font-semibold text-white mb-3">Destination</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={form.destAddress}
              onChange={(e) => setForm({ ...form, destAddress: e.target.value })}
              placeholder="Address *"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                value={form.destCity}
                onChange={(e) => setForm({ ...form, destCity: e.target.value })}
                placeholder="City *"
                className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
                required
              />
              <input
                value={form.destState}
                onChange={(e) => setForm({ ...form, destState: e.target.value })}
                placeholder="State *"
                className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
                required
              />
              <input
                value={form.destZip}
                onChange={(e) => setForm({ ...form, destZip: e.target.value })}
                placeholder="ZIP *"
                className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Pickup Date *</label>
            <input
              type="date"
              value={form.pickupDate}
              onChange={(e) => setForm({ ...form, pickupDate: e.target.value })}
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Delivery Date *</label>
            <input
              type="date"
              value={form.deliveryDate}
              onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Budget ($) *</label>
            <input
              type="number"
              value={form.budgetUsd}
              onChange={(e) => setForm({ ...form, budgetUsd: e.target.value })}
              placeholder="1500"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
        </div>

        <Button type="submit" disabled={submitting} className="w-full py-4 text-lg">
          {submitting ? 'Posting...' : 'Post Load'}
        </Button>
      </form>
    </Surface>
  );
};

const CarriersList: React.FC<{ carriers: any[]; loading: boolean }> = ({ carriers, loading }) => {
  if (loading) return <p className="text-slate-400">Loading carriers...</p>;

  return (
    <div className="space-y-4">
      {carriers.length === 0 ? (
        <Surface className="p-8 text-center">
          <div className="text-4xl mb-4">🚛</div>
          <p className="text-slate-400">No carriers registered yet.</p>
        </Surface>
      ) : (
        carriers.map((carrier) => (
          <Surface key={carrier.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">
                  {carrier.companyName[0]}
                </div>
                <div>
                  <div className="font-semibold text-white">{carrier.companyName}</div>
                  <div className="text-xs text-slate-400">
                    {carrier.equipmentType?.join(', ')} · {carrier.operatingStates?.length || 0} states
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-300">{carrier.rating.toFixed(1)} ⭐</div>
                {carrier.verified && <Badge tone="success">Verified</Badge>}
                <div className="text-xs text-slate-500 mt-1">
                  {carrier.totalDeliveries} deliveries
                </div>
              </div>
            </div>
          </Surface>
        ))
      )}
    </div>
  );
};

export default FreightPage;
