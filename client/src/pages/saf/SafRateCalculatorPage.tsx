import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/saf', label: 'Dashboard', icon: '📦', end: true },
  { path: '/saf/post-load', label: 'Post Load', icon: '➕' },
  { path: '/saf/my-loads', label: 'My Loads', icon: '📋' },
  { path: '/saf/carriers', label: 'Carriers', icon: '🚛' },
  { path: '/saf/rates', label: 'Rate Calculator', icon: '💰' },
];

export default function SafRateCalculatorPage() {
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

  return (
    <DashboardLayout osName="SafOS" osIcon="S" osColor="amber" navItems={navItems}>
      <div className="space-y-4 max-w-lg">
        <h1 className="text-xl font-bold text-white">Shipping Rate Calculator</h1>
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-gray-400 text-xs">Distance (miles)</label>
            <input value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value })} placeholder="Enter distance" type="number" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm mt-1" />
          </div>
          <div>
            <label className="text-gray-400 text-xs">Weight (lbs)</label>
            <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Enter weight" type="number" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm mt-1" />
          </div>
          <div>
            <label className="text-gray-400 text-xs">Cargo Type</label>
            <select value={form.cargoType} onChange={(e) => setForm({ ...form, cargoType: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm mt-1">
              <option value="GENERAL">General (×1.0)</option>
              <option value="REFRIGERATED">Refrigerated (×1.3)</option>
              <option value="HAZARDOUS">Hazardous (×1.5)</option>
              <option value="OVERSIZED">Oversized (×1.4)</option>
              <option value="FRAGILE">Fragile (×1.2)</option>
            </select>
          </div>
          <button onClick={calculate} disabled={calculating} className="w-full py-2 bg-amber-500 text-white rounded font-medium">{calculating ? 'Calculating...' : 'Calculate Rate'}</button>
        </div>
        {estimate && (
          <div className="bg-[#0a0f1a] border border-amber-500/30 rounded-xl p-4 space-y-2">
            <h3 className="text-white font-medium">Rate Estimate</h3>
            <div className="flex justify-between"><span className="text-gray-400 text-sm">Distance</span><span className="text-white text-sm">{estimate.distance} miles</span></div>
            <div className="flex justify-between"><span className="text-gray-400 text-sm">Weight</span><span className="text-white text-sm">{estimate.weight?.toLocaleString()} lbs</span></div>
            <div className="flex justify-between"><span className="text-gray-400 text-sm">Cargo Type</span><span className="text-white text-sm">{estimate.cargoType} (×{estimate.multiplier})</span></div>
            <div className="flex justify-between"><span className="text-gray-400 text-sm">Base Rate</span><span className="text-white text-sm">${estimate.baseRate?.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-white/5 pt-2"><span className="text-white font-bold">Total Estimate</span><span className="text-amber-400 font-bold text-lg">${estimate.total}</span></div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
