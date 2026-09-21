import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/pipeline', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/pipeline/leads', label: 'Leads', icon: 'person_add' },
  { path: '/pipeline/deals', label: 'Deals', icon: 'handshake' },
  { path: '/pipeline/activities', label: 'Activities', icon: 'notifications' },
];

export default function PipelineLeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLead({
      id,
      name: 'Acme Corp',
      email: 'contact@acme.com',
      phone: '+1 555-0123',
      company: 'Acme Corporation',
      stage: 'Qualified',
      value: 50000,
      owner: 'Sarah',
      source: 'Website',
      notes: 'Interested in enterprise plan. Follow up next week.',
      activities: [
        { id: '1', type: 'call', desc: 'Initial discovery call', date: '2026-09-15' },
        { id: '2', type: 'email', desc: 'Sent proposal', date: '2026-09-18' },
      ],
    });
    setLoading(false);
  }, [id]);

  if (loading) return <DashboardLayout osName="PipelineOS" osIcon="P" osColor="indigo" navItems={navItems}><div className="text-center py-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></DashboardLayout>;

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="indigo" navItems={navItems}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">{lead.name}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-2">Contact Info</h3>
            <p className="text-white text-sm">Email: {lead.email}</p>
            <p className="text-white text-sm">Phone: {lead.phone}</p>
            <p className="text-white text-sm">Company: {lead.company}</p>
          </div>
          <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-2">Deal Info</h3>
            <p className="text-white text-sm">Stage: {lead.stage}</p>
            <p className="text-white text-sm">Value: ${lead.value.toLocaleString()}</p>
            <p className="text-white text-sm">Owner: {lead.owner}</p>
          </div>
        </div>
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-2">Notes</h3>
          <p className="text-white text-sm">{lead.notes}</p>
        </div>
        <div className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-2">Activity Timeline</h3>
          <div className="space-y-2">
            {lead.activities.map((a: any) => (
              <div key={a.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <div>
                  <p className="text-white">{a.desc}</p>
                  <p className="text-gray-500 text-xs">{a.type}</p>
                </div>
                <span className="text-gray-400 text-xs">{a.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
