import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/freight', label: 'Dashboard', icon: 'inventory_2', end: true },
  { path: '/freight/post-load', label: 'Post Load', icon: 'add_circle' },
  { path: '/freight/my-loads', label: 'My Loads', icon: 'list_alt' },
  { path: '/freight/carriers', label: 'Carriers', icon: 'local_shipping' },
  { path: '/freight/rates', label: 'Rate Calculator', icon: 'calculate' },
];

export default function FreightPostLoadPage() {
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

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm transition";
  const inputStyle = { background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.3)', color: 'var(--warm-ink)' };

  return (
    <DashboardLayout osName="FreightOS" osIcon="S" osColor="amber" navItems={navItems}>
      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Post New Load</h1>

        <div className="rounded-[var(--radius-card)] p-5 space-y-4" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <h3 className="font-medium" style={{ color: 'var(--warm-ink)' }}>Cargo Details</h3>
          <input value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Load Title" required className={inputClass} style={inputStyle} />
          <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Description" className={`${inputClass} h-20`} style={inputStyle} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.cargoType} onChange={(e) => updateField('cargoType', e.target.value)} className={inputClass} style={inputStyle}>
              <option value="GENERAL">General</option>
              <option value="REFRIGERATED">Refrigerated</option>
              <option value="HAZARDOUS">Hazardous</option>
              <option value="OVERSIZED">Oversized</option>
              <option value="FRAGILE">Fragile</option>
            </select>
            <input value={form.weightLbs} onChange={(e) => updateField('weightLbs', e.target.value)} placeholder="Weight (lbs)" type="number" required className={inputClass} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.dimensions} onChange={(e) => updateField('dimensions', e.target.value)} placeholder="Dimensions (LxWxH)" className={inputClass} style={inputStyle} />
            <input value={form.valueUsd} onChange={(e) => updateField('valueUsd', e.target.value)} placeholder="Declared Value ($)" type="number" className={inputClass} style={inputStyle} />
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] p-5 space-y-4" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <h3 className="font-medium" style={{ color: 'var(--warm-ink)' }}>Origin</h3>
          <input value={form.originAddress} onChange={(e) => updateField('originAddress', e.target.value)} placeholder="Address" required className={inputClass} style={inputStyle} />
          <div className="grid grid-cols-3 gap-3">
            <input value={form.originCity} onChange={(e) => updateField('originCity', e.target.value)} placeholder="City" required className={inputClass} style={inputStyle} />
            <input value={form.originState} onChange={(e) => updateField('originState', e.target.value)} placeholder="State" required className={inputClass} style={inputStyle} />
            <input value={form.originZip} onChange={(e) => updateField('originZip', e.target.value)} placeholder="ZIP" className={inputClass} style={inputStyle} />
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] p-5 space-y-4" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <h3 className="font-medium" style={{ color: 'var(--warm-ink)' }}>Destination</h3>
          <input value={form.destAddress} onChange={(e) => updateField('destAddress', e.target.value)} placeholder="Address" required className={inputClass} style={inputStyle} />
          <div className="grid grid-cols-3 gap-3">
            <input value={form.destCity} onChange={(e) => updateField('destCity', e.target.value)} placeholder="City" required className={inputClass} style={inputStyle} />
            <input value={form.destState} onChange={(e) => updateField('destState', e.target.value)} placeholder="State" required className={inputClass} style={inputStyle} />
            <input value={form.destZip} onChange={(e) => updateField('destZip', e.target.value)} placeholder="ZIP" className={inputClass} style={inputStyle} />
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] p-5 space-y-4" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <h3 className="font-medium" style={{ color: 'var(--warm-ink)' }}>Timing & Budget</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--soft-stone)' }}>Pickup Date</label>
              <input type="date" value={form.pickupDate} onChange={(e) => updateField('pickupDate', e.target.value)} required className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--soft-stone)' }}>Delivery Date</label>
              <input type="date" value={form.deliveryDate} onChange={(e) => updateField('deliveryDate', e.target.value)} required className={inputClass} style={inputStyle} />
            </div>
          </div>
          <input value={form.budgetUsd} onChange={(e) => updateField('budgetUsd', e.target.value)} placeholder="Budget (USD)" type="number" className={inputClass} style={inputStyle} />
          <button
            type="button"
            onClick={getEstimate}
            className="px-5 py-2.5 rounded-full text-sm font-medium transition hover:-translate-y-0.5"
            style={{ background: 'var(--muted-ochre)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-[-3px]" aria-hidden="true">insights</span>
            Get Rate Estimate
          </button>
          {estimate && (
            <div className="rounded-xl p-4" style={{ background: 'var(--warm-sand)' }}>
              <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>
                Estimated Cost: <span className="font-bold" style={{ color: 'var(--terracotta)' }}>${estimate.total}</span>
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
                Base: ${estimate.baseRate?.toFixed(2)} × {estimate.multiplier} multiplier
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-full font-medium transition hover:-translate-y-0.5"
          style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
        >
          {submitting ? 'Posting...' : 'Post Load'}
        </button>
      </form>
    </DashboardLayout>
  );
}
