import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/freight', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/freight/post-load', label: 'Post Load', icon: 'add_circle' },
  { path: '/freight/my-loads', label: 'My Loads', icon: 'receipt_long' },
  { path: '/freight/carriers', label: 'Carriers', icon: 'local_shipping' },
  { path: '/freight/rates', label: 'Rate Calculator', icon: 'calculate' },
];

export default function FreightOSPage() {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLoads(); }, []);

  const loadLoads = async () => {
    try {
      const res = await api.get('/api/v1/saf/loads?status=OPEN').catch(() => ({ data: { data: [] } }));
      setLoads(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <DashboardLayout osName="FreightOS" osIcon="S" osColor="amber" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400">Freight & logistics management platform</p>
          </div>
          <Link to="/saf/post-load" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium transition">
            + Post Load
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Active Loads</p>
            <p className="text-2xl font-bold text-white">{loads.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Completed</p>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Total Spent</p>
            <p className="text-2xl font-bold text-white">$0</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Trust Score</p>
            <p className="text-2xl font-bold text-amber-400">50</p>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white">Recent Loads</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : loads.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="text-4xl mb-2">📦</p>
              <p>No loads yet. Post your first load to get started!</p>
              <Link to="/saf/post-load" className="inline-block mt-4 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium transition">
                Post a Load
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {loads.map((load: any) => (
                <div key={load.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{load.title || 'Load'}</p>
                    <p className="text-sm text-slate-400">{load.origin} → {load.destination}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm">{load.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-8 border-t border-white/5 text-center">
          <p className="text-sm text-slate-500">
            Powered by <Link to="/" className="text-amber-400 hover:text-amber-300 transition">Pabandi</Link> — The Global Trust Layer
          </p>
          <p className="text-xs text-slate-600 mt-2">
            © 2026 Pabandi. All rights reserved.
          </p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
