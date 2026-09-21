import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/pipeline', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/pipeline/leads', label: 'Leads', icon: 'person_add' },
  { path: '/pipeline/deals', label: 'Deals', icon: 'handshake' },
  { path: '/pipeline/activities', label: 'Activities', icon: 'notifications' },
];

export default function PipelineLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setLeads([
      { id: '1', name: 'Acme Corp', email: 'contact@acme.com', stage: 'Qualified', value: 50000, owner: 'Sarah', source: 'Website' },
      { id: '2', name: 'TechStart Inc', email: 'hello@techstart.io', stage: 'Proposal', value: 75000, owner: 'Mike', source: 'Referral' },
      { id: '3', name: 'Global Ventures', email: 'info@global.vc', stage: 'New', value: 120000, owner: 'Sarah', source: 'LinkedIn' },
      { id: '4', name: 'NextGen Solutions', email: 'sales@nextgen.com', stage: 'Contacted', value: 45000, owner: 'Mike', source: 'Cold Call' },
    ]);
    setLoading(false);
  }, []);

  const filtered = leads.filter((l) => {
    const matchesSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || l.stage.toLowerCase() === filter;
    return matchesSearch && matchesFilter;
  });

  const getStageBadge = (stage: string) => {
    const colors: Record<string, string> = {
      'New': 'bg-blue-500/20 text-blue-400',
      'Contacted': 'bg-indigo-500/20 text-indigo-400',
      'Qualified': 'bg-violet-500/20 text-violet-400',
      'Proposal': 'bg-purple-500/20 text-purple-400',
      'Negotiation': 'bg-fuchsia-500/20 text-fuchsia-400',
      'Closed Won': 'bg-emerald-500/20 text-emerald-400',
    };
    return <span className={`px-2 py-0.5 text-xs rounded ${colors[stage] || 'bg-white/10 text-gray-400'}`}>{stage}</span>;
  };

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="indigo" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Leads</h1>
          <Link to="/pipeline/leads/new" className="px-3 py-1.5 bg-indigo-500 text-white rounded text-sm">Add Lead</Link>
        </div>
        <div className="flex gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm">
            <option value="all">All Stages</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal</option>
          </select>
        </div>
        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-3 text-gray-400">Name</th>
                  <th className="text-left p-3 text-gray-400">Stage</th>
                  <th className="text-left p-3 text-gray-400">Value</th>
                  <th className="text-left p-3 text-gray-400">Owner</th>
                  <th className="text-left p-3 text-gray-400">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3"><Link to={`/pipeline/leads/${l.id}`} className="text-white hover:text-indigo-400">{l.name}</Link></td>
                    <td className="p-3">{getStageBadge(l.stage)}</td>
                    <td className="p-3 text-indigo-400">${l.value.toLocaleString()}</td>
                    <td className="p-3 text-gray-400">{l.owner}</td>
                    <td className="p-3 text-gray-400">{l.source}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-gray-500">No leads found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
