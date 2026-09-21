import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/pipeline', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/pipeline/leads', label: 'Leads', icon: 'person_add' },
  { path: '/pipeline/deals', label: 'Deals', icon: 'handshake' },
  { path: '/pipeline/activities', label: 'Activities', icon: 'notifications' },
];

const FUNNEL_STAGES = [
  { name: 'New', count: 12, color: 'bg-blue-500' },
  { name: 'Contacted', count: 8, color: 'bg-indigo-500' },
  { name: 'Qualified', count: 5, color: 'bg-violet-500' },
  { name: 'Proposal', count: 3, color: 'bg-purple-500' },
  { name: 'Negotiation', count: 2, color: 'bg-fuchsia-500' },
  { name: 'Closed Won', count: 1, color: 'bg-emerald-500' },
];

export default function PipelineOSPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated data
    setLeads([
      { id: '1', name: 'Acme Corp', stage: 'Qualified', value: 50000, owner: 'Sarah' },
      { id: '2', name: 'TechStart Inc', stage: 'Proposal', value: 75000, owner: 'Mike' },
      { id: '3', name: 'Global Ventures', stage: 'New', value: 120000, owner: 'Sarah' },
    ]);
    setLoading(false);
  }, []);

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="indigo" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Pipeline Dashboard</h1>
            <p className="text-slate-400">CRM & sales pipeline management</p>
          </div>
          <Link to="/pipeline/leads" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition">
            + Add Lead
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Total Leads</p>
            <p className="text-2xl font-bold text-white">{leads.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Pipeline Value</p>
            <p className="text-2xl font-bold text-white">${leads.reduce((sum, l) => sum + l.value, 0).toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Conversion Rate</p>
            <p className="text-2xl font-bold text-emerald-400">24%</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-400">Avg Deal Size</p>
            <p className="text-2xl font-bold text-white">$81,667</p>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Lead Funnel</h2>
          <div className="flex items-end gap-2 h-48">
            {FUNNEL_STAGES.map((stage) => (
              <div key={stage.name} className="flex-1 flex flex-col items-center">
                <div className={`w-full ${stage.color} rounded-t-lg transition-all`} style={{ height: `${(stage.count / 12) * 100}%` }} />
                <p className="text-xs text-slate-400 mt-2 text-center">{stage.name}</p>
                <p className="text-sm font-bold text-white">{stage.count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white">Recent Leads</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (
            <div className="divide-y divide-white/5">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{lead.name}</p>
                    <p className="text-sm text-slate-400">{lead.stage} • Owner: {lead.owner}</p>
                  </div>
                  <span className="text-indigo-400 font-medium">${lead.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-8 border-t border-white/5 text-center">
          <p className="text-sm text-slate-500">
            Powered by <Link to="/" className="text-indigo-400 hover:text-indigo-300 transition">Pabandi</Link> — The Global Trust Layer
          </p>
          <p className="text-xs text-slate-600 mt-2">© 2026 Pabandi. All rights reserved.</p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
