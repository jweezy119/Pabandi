import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/property', label: 'Dashboard', icon: '📊', end: true },
  { path: '/property/tenants', label: 'Tenants', icon: '👥' },
  { path: '/property/leases', label: 'Leases', icon: '📝' },
  { path: '/property/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/property/financials', label: 'Financials', icon: '💰' },
];

export default function PropertyLeasesPage() {
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadLeases(); }, [filter]);

  const loadLeases = async () => {
    try {
      const query = filter !== 'all' ? `?status=${filter}` : '';
      const res = await api.get(`/api/v1/property/leases${query}`);
      setLeases(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getDaysUntilExpiry = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <DashboardLayout osName="PropertyOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Leases</h1>
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-emerald-500 text-white rounded text-sm">New Lease</button>
        </div>
        <div className="flex gap-2">
          {['all', 'ACTIVE', 'EXPIRED', 'TERMINATED'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded text-sm ${filter === s ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400'}`}>{s === 'all' ? 'All' : s}</button>
          ))}
        </div>
        {showForm && (
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4 space-y-3">
            <input placeholder="Tenant Email" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" placeholder="Start Date" className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
              <input type="date" placeholder="End Date" className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
            </div>
            <input placeholder="Rent Amount" type="number" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
            <button className="px-4 py-2 bg-emerald-500 text-white rounded text-sm" onClick={() => setShowForm(false)}>Create Lease</button>
          </div>
        )}
        {loading ? <div className="text-center py-8"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> : (
          <div className="space-y-2">
            {leases.map((l: any) => {
              const daysLeft = getDaysUntilExpiry(l.endDate);
              const expiring = daysLeft <= 30 && daysLeft > 0;
              return (
                <div key={l.id} className={`bg-[#0a0f1a] border rounded-xl p-4 ${expiring ? 'border-yellow-500/30' : 'border-white/5'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white text-sm font-medium">{l.property?.title || 'Property'} - {l.unit?.unitNumber || 'N/A'}</p>
                      <p className="text-gray-500 text-xs">{l.tenantName || l.tenantEmail}</p>
                      <p className="text-gray-500 text-xs">{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400">${l.rentAmount}/mo</p>
                      {expiring && <span className="text-yellow-400 text-xs">{daysLeft}d left</span>}
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded ${l.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : l.status === 'EXPIRED' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>{l.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {leases.length === 0 && <p className="text-gray-500 text-center py-8">No leases found</p>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
