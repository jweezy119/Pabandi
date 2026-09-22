import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/freight', label: 'Dashboard', icon: 'inventory_2', end: true },
  { path: '/freight/post-load', label: 'Post Load', icon: 'add_circle' },
  { path: '/freight/my-loads', label: 'My Loads', icon: 'list_alt' },
  { path: '/freight/carriers', label: 'Carriers', icon: 'local_shipping' },
  { path: '/freight/rates', label: 'Rate Calculator', icon: 'calculate' },
];

export default function FreightRateCalculatorPage() {
  const [form, setForm] = useState({ distance: '', weight: '', cargoType: 'GENERAL' });
  const [estimate, setEstimate] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  const calculate = async () => {
    setCalculating(true);
    try {
      const res = await api.get(`/api/v1/saf/rates?distance=${form.distance}&weight=${form.weight}&type=${form.cargoType}`);
      setEstimate(res.data?.data);
    } catch (e) { console.error(e); } finally { setCalculating(false); }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm mt-1";
  const inputStyle = { background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.3)', color: 'var(--warm-ink)' };

  return (
    <DashboardLayout osName="FreightOS" osIcon="S" osColor="amber" navItems={navItems}>
      <div className="space-y-5 max-w-lg">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Shipping Rate Calculator</h1>
        <div className="rounded-[var(--radius-card)] p-5 space-y-4" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--soft-stone)' }}>Distance (miles)</label>
            <input
              value={form.distance}
              onChange={(e) => setForm({ ...form, distance: e.target.value })}
              placeholder="Enter distance"
              type="number"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--soft-stone)' }}>Weight (lbs)</label>
            <input
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder="Enter weight"
              type="number"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--soft-stone)' }}>Cargo Type</label>
            <select
              value={form.cargoType}
              onChange={(e) => setForm({ ...form, cargoType: e.target.value })}
              className={inputClass}
              style={inputStyle}
            >
              <option value="GENERAL">General (×1.0)</option>
              <option value="REFRIGERATED">Refrigerated (×1.3)</option>
              <option value="HAZARDOUS">Hazardous (×1.5)</option>
              <option value="OVERSIZED">Oversized (×1.4)</option>
              <option value="FRAGILE">Fragile (×1.2)</option>
            </select>
          </div>
          <button
            onClick={calculate}
            disabled={calculating}
            className="w-full py-3 rounded-full font-medium transition hover:-translate-y-0.5"
            style={{ background: 'var(--clay)', color: 'white', boxShadow: 'var(--shadow-soft)' }}
          >
            {calculating ? 'Calculating...' : 'Calculate Rate'}
          </button>
        </div>
        {estimate && (
          <div className="rounded-[var(--radius-card)] p-5 space-y-3" style={{ background: 'white', boxShadow: 'var(--shadow-soft)' }}>
            <h3 className="font-medium" style={{ color: 'var(--warm-ink)' }}>Rate Estimate</h3>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--soft-stone)' }}>Distance</span>
              <span style={{ color: 'var(--warm-ink)' }}>{estimate.distance} miles</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--soft-stone)' }}>Weight</span>
              <span style={{ color: 'var(--warm-ink)' }}>{estimate.weight?.toLocaleString()} lbs</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--soft-stone)' }}>Cargo Type</span>
              <span style={{ color: 'var(--warm-ink)' }}>{estimate.cargoType} (×{estimate.multiplier})</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--soft-stone)' }}>Base Rate</span>
              <span style={{ color: 'var(--warm-ink)' }}>${estimate.baseRate?.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between pt-3"
              style={{ borderTop: '1px solid rgba(191,179,163,0.3)' }}
            >
              <span className="font-bold" style={{ color: 'var(--warm-ink)' }}>Total Estimate</span>
              <span className="font-bold text-lg" style={{ color: 'var(--terracotta)' }}>${estimate.total}</span>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
