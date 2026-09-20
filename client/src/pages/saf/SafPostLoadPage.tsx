import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/saf', label: 'Dashboard', icon: '📦', end: true },
  { path: '/saf/post-load', label: 'Post Load', icon: '➕' },
  { path: '/saf/my-loads', label: 'My Loads', icon: '📋' },
  { path: '/saf/carriers', label: 'Carriers', icon: '🚛' },
  { path: '/saf/rates', label: 'Rate Calculator', icon: '💰' },
];

export default function SafPostLoadPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', cargoType: 'GENERAL', weightLbs: '', dimensions: '', valueUsd: '',
    originAddress: '', originCity: '', originState: '', originZip: '',
    destAddress: '', destCity: '', destState: '', destZip: '',
    pickupDate: '', deliveryDate: '', budgetUsd: '',
  });
  const [estimate, setEstimate] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: string, value: string) => setForm({ ...form, [field]: value });

  const getEstimate = async () => {
    if (!form.originCity || !form.destCity || !form.weightLbs) return;
    try {
      const res = await api.get(`/api/v1/saf/rates?distance=500&weight=${form.weightLbs}&type=${form.cargoType}`);
      setEstimate(res.data?.data);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/v1/saf/loads', {
        ...form,
        weightLbs: Number(form.weightLbs),
        valueUsd: Number(form.valueUsd) || 0,
        budgetUsd: Number(form.budgetUsd) || 0,
        pickupDate: new Date(form.pickupDate),
        deliveryDate: new Date(form.deliveryDate),
      });
      navigate('/saf/my-loads');
    } catch (e) { console.error(e); } finally { setSubmitting(false); }
  };

  return (
    <DashboardLayout osName="SafOS" osIcon="S" osColor="amber" navItems={navItems}>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
        <h1 className="text-xl font-bold text-white">Post New Load</h1>

        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-white text-sm font-medium">Cargo Details</h3>
          <input value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Load Title" required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Description" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm h-20" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.cargoType} onChange={(e) => updateField('cargoType', e.target.value)} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm">
              <option value="GENERAL">General</option>
              <option value="REFRIGERATED">Refrigerated</option>
              <option value="HAZARDOUS">Hazardous</option>
              <option value="OVERSIZED">Oversized</option>
              <option value="FRAGILE">Fragile</option>
            </select>
            <input value={form.weightLbs} onChange={(e) => updateField('weightLbs', e.target.value)} placeholder="Weight (lbs)" type="number" required className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.dimensions} onChange={(e) => updateField('dimensions', e.target.value)} placeholder="Dimensions (LxWxH)" className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
            <input value={form.valueUsd} onChange={(e) => updateField('valueUsd', e.target.value)} placeholder="Declared Value ($)" type="number" className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-white text-sm font-medium">Origin</h3>
          <input value={form.originAddress} onChange={(e) => updateField('originAddress', e.target.value)} placeholder="Address" required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <input value={form.originCity} onChange={(e) => updateField('originCity', e.target.value)} placeholder="City" required className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
            <input value={form.originState} onChange={(e) => updateField('originState', e.target.value)} placeholder="State" required className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
            <input value={form.originZip} onChange={(e) => updateField('originZip', e.target.value)} placeholder="ZIP" className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-white text-sm font-medium">Destination</h3>
          <input value={form.destAddress} onChange={(e) => updateField('destAddress', e.target.value)} placeholder="Address" required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <input value={form.destCity} onChange={(e) => updateField('destCity', e.target.value)} placeholder="City" required className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
            <input value={form.destState} onChange={(e) => updateField('destState', e.target.value)} placeholder="State" required className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
            <input value={form.destZip} onChange={(e) => updateField('destZip', e.target.value)} placeholder="ZIP" className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-white text-sm font-medium">Timing & Budget</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-gray-400 text-xs">Pickup Date</label><input type="date" value={form.pickupDate} onChange={(e) => updateField('pickupDate', e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" /></div>
            <div><label className="text-gray-400 text-xs">Delivery Date</label><input type="date" value={form.deliveryDate} onChange={(e) => updateField('deliveryDate', e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" /></div>
          </div>
          <input value={form.budgetUsd} onChange={(e) => updateField('budgetUsd', e.target.value)} placeholder="Budget (USD)" type="number" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <button type="button" onClick={getEstimate} className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded text-sm">Get Rate Estimate</button>
          {estimate && (
            <div className="bg-white/5 rounded p-3">
              <p className="text-white text-sm">Estimated Cost: <span className="text-amber-400 font-bold">${estimate.total}</span></p>
              <p className="text-gray-500 text-xs">Base: ${estimate.baseRate?.toFixed(2)} × {estimate.multiplier} multiplier</p>
            </div>
          )}
        </div>

        <button type="submit" disabled={submitting} className="w-full py-3 bg-amber-500 text-white rounded font-medium">{submitting ? 'Posting...' : 'Post Load'}</button>
      </form>
    </DashboardLayout>
  );
}
