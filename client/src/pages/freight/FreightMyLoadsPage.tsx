import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/freight', label: 'Dashboard', icon: '📦', end: true },
  { path: '/freight/post-load', label: 'Post Load', icon: '➕' },
  { path: '/freight/my-loads', label: 'My Loads', icon: '📋' },
  { path: '/freight/carriers', label: 'Carriers', icon: '🚛' },
  { path: '/freight/rates', label: 'Rate Calculator', icon: '💰' },
];

export default function FreightMyLoadsPage() {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLoads(); }, []);

  const loadLoads = async () => {
    try {
      const res = await api.get('/api/v1/saf/loads');
      setLoads(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'bg-green-500/20 text-green-400',
      ASSIGNED: 'bg-blue-500/20 text-blue-400',
      IN_TRANSIT: 'bg-yellow-500/20 text-yellow-400',
      DELIVERED: 'bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)]',
      COMPLETED: 'bg-[var(--sage)]/20 text-[var(--sage)]',
      CANCELLED: 'bg-[var(--terracotta)]/20 text-[var(--terracotta)]',
    };
    return <span className={`px-2 py-0.5 text-xs rounded ${colors[status] || 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'}`}>{status}</span>;
  };

  return (
    <DashboardLayout osName="FreightOS" osIcon="S" osColor="amber" navItems={navItems}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-[var(--warm-ink)]">My Shipments</h1>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="bg-[#0a0f1a] border border-[var(--soft-stone)]/30 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--soft-stone)]/30">
                  <th className="text-left p-3 text-[var(--soft-stone)]">Load</th>
                  <th className="text-left p-3 text-[var(--soft-stone)]">Route</th>
                  <th className="text-left p-3 text-[var(--soft-stone)]">Status</th>
                  <th className="text-left p-3 text-[var(--soft-stone)]">Budget</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((l: any) => (
                  <tr key={l.id} className="border-b border-[var(--soft-stone)]/30 hover:bg-[var(--cream)]">
                    <td className="p-3">
                      <p className="text-[var(--warm-ink)]">{l.title}</p>
                      <p className="text-[var(--soft-stone)] text-xs">{l.weightLbs?.toLocaleString()} lbs • {l.cargoType}</p>
                    </td>
                    <td className="p-3 text-[var(--soft-stone)] text-xs">{l.originCity} → {l.destCity}</td>
                    <td className="p-3">{getStatusBadge(l.status)}</td>
                    <td className="p-3 text-[var(--muted-ochre)]">${l.budgetUsd?.toLocaleString()}</td>
                  </tr>
                ))}
                {loads.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-[var(--soft-stone)]">No shipments found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}