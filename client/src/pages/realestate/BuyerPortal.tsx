import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/buyer', label: 'Portal', icon: '🏠', end: true },
  { path: '/buyer/payments', label: 'Payments', icon: '💰' },
  { path: '/buyer/progress', label: 'Progress', icon: '📊' },
];

export default function BuyerPortal() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/api/v1/buyer/profile');
      setProfile(res.data?.data);
    } catch (e) {
      console.error('Failed to load buyer profile', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout osName="Haq OS" osIcon="🏠" osColor="emerald" navItems={navItems}>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="Haq OS" osIcon="🏠" osColor="emerald" navItems={navItems}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Buyer Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome back, {profile?.user?.firstName || 'Valued Buyer'}</p>
        </div>

        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-bold mb-4">Your Unit</h2>
          {profile?.units?.length > 0 ? (
            <div className="space-y-4">
              {profile.units.map((unit: any) => (
                <div key={unit.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{unit.project?.name}</p>
                      <p className="text-gray-400 text-sm">Unit {unit.unitNumber} • {unit.type} • {unit.size} sqft</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${unit.status === 'SOLD' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {unit.status}
                    </span>
                  </div>
                  <p className="text-emerald-400 font-bold mt-2">Rs {unit.price?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">You don't have any units yet.</p>
          )}
        </div>

        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-bold mb-4">Payment Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Amount</p>
              <p className="text-xl font-bold text-white">Rs 12,500,000</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Paid</p>
              <p className="text-xl font-bold text-emerald-400">Rs 5,000,000</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Pending</p>
              <p className="text-xl font-bold text-amber-400">Rs 7,500,000</p>
            </div>
          </div>
        </div>

        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-bold mb-4">Upcoming Payments</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-white text-sm">Installment #3 - Q4 2026</p>
                <p className="text-gray-500 text-xs">Due: Dec 15, 2026</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-medium">Rs 1,500,000</span>
                <button className="px-3 py-1 bg-emerald-500 text-white text-sm rounded hover:bg-emerald-600">
                  Pay via Raast
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-white text-sm">Installment #4 - Q1 2027</p>
                <p className="text-gray-500 text-xs">Due: Mar 15, 2027</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-medium">Rs 1,500,000</span>
                <button className="px-3 py-1 bg-white/10 text-gray-400 text-sm rounded cursor-not-allowed">
                  Pay via Raast
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-bold mb-4">Project Progress</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="text-white text-sm">Foundation Complete</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="text-white text-sm">Ground Floor Complete</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-amber-500"></div>
              <span className="text-white text-sm">First Floor (In Progress)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-gray-500"></div>
              <span className="text-gray-500 text-sm">Roofing</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
