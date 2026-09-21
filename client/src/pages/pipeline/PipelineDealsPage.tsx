import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/pipeline', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/pipeline/leads', label: 'Leads', icon: 'person_add' },
  { path: '/pipeline/deals', label: 'Deals', icon: 'handshake' },
  { path: '/pipeline/activities', label: 'Activities', icon: 'notifications' },
];

export default function PipelineDealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDeals([
      { id: '1', name: 'Acme Enterprise License', stage: 'Negotiation', value: 50000, probability: 75, closeDate: '2026-10-15' },
      { id: '2', name: 'TechStart Annual', stage: 'Proposal', value: 75000, probability: 50, closeDate: '2026-11-01' },
      { id: '3', name: 'Global Ventures Series', stage: 'Qualified', value: 120000, probability: 30, closeDate: '2026-12-01' },
    ]);
    setLoading(false);
  }, []);

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Qualified': 'bg-violet-500/20 text-violet-400',
      'Proposal': 'bg-purple-500/20 text-purple-400',
      'Negotiation': 'bg-fuchsia-500/20 text-fuchsia-400',
      'Closed Won': 'bg-emerald-500/20 text-emerald-400',
    };
    return colors[stage] || 'bg-white/10 text-gray-400';
  };

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="indigo" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Deals</h1>
          <Link to="/pipeline/deals/new" className="px-3 py-1.5 bg-indigo-500 text-white rounded text-sm">New Deal</Link>
        </div>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-3">
            {deals.map((d) => (
              <div key={d.id} className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white text-sm font-medium">{d.name}</p>
                    <p className="text-gray-500 text-xs">Close: {d.closeDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-indigo-400 font-medium">${d.value.toLocaleString()}</p>
                    <span className={`px-2 py-0.5 text-xs rounded ${getStageColor(d.stage)}`}>{d.stage}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Probability</span>
                    <span>{d.probability}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${d.probability}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
