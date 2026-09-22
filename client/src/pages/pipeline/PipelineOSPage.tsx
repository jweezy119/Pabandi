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
  { name: 'Lead', color: '#C97B5A' },
  { name: 'Verified', color: '#D9A854' },
  { name: 'Booked', color: '#8A9A7B' },
  { name: 'Repeat', color: '#B8C9D4' },
  { name: 'VIP', color: '#D4A5A5' },
  { name: 'At Risk', color: '#A85A3C' },
];

export default function PipelineOSPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch real leads from API
    const fetchLeads = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLeads(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch leads:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  const totalValue = leads.reduce((sum, l) => sum + (l.totalSpent || 0), 0);
  const avgScore = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + (l.reliabilityScore || 50), 0) / leads.length) : 0;

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="#C97B5A" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Pipeline Dashboard</h1>
            <p style={{ color: 'var(--soft-stone)' }}>Trust-aware CRM & revenue engine</p>
          </div>
          <Link to="/pipeline/leads" className="px-4 py-2 rounded-xl font-medium transition" style={{ background: 'var(--clay)', color: 'white' }}>
            + Add Lead
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl" style={{ background: 'white', border: '1px solid var(--soft-stone)', boxShadow: '0 2px 8px rgba(180,130,90,0.1)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Total Leads</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>{leads.length}</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'white', border: '1px solid var(--soft-stone)', boxShadow: '0 2px 8px rgba(180,130,90,0.1)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Pipeline Value</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>${totalValue.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'white', border: '1px solid var(--soft-stone)', boxShadow: '0 2px 8px rgba(180,130,90,0.1)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Avg Trust Score</p>
            <p className="text-2xl font-bold" style={{ color: avgScore >= 70 ? 'var(--sage)' : avgScore >= 50 ? 'var(--muted-ochre)' : 'var(--terracotta)' }}>{avgScore}/100</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'white', border: '1px solid var(--soft-stone)', boxShadow: '0 2px 8px rgba(180,130,90,0.1)' }}>
            <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>At Risk</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--terracotta)' }}>{leads.filter(l => (l.reliabilityScore || 50) < 30).length}</p>
          </div>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--warm-sand)', border: '1px solid var(--soft-stone)' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>Trust-Based Funnel</h2>
          <div className="flex items-end gap-2 h-48">
            {FUNNEL_STAGES.map((stage) => {
              const count = leads.filter(l => l.stage === stage.name.toLowerCase()).length;
              return (
                <div key={stage.name} className="flex-1 flex flex-col items-center">
                  <div className="w-full rounded-t-lg transition-all" style={{ background: stage.color, height: `${Math.max(10, (count / Math.max(1, leads.length)) * 100)}%` }} />
                  <p className="text-xs mt-2 text-center" style={{ color: 'var(--soft-stone)' }}>{stage.name}</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--warm-ink)' }}>{count}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--soft-stone)', boxShadow: '0 2px 8px rgba(180,130,90,0.1)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--soft-stone)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Recent Leads</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>
              <p>No leads yet. Add your first lead to get started.</p>
              <Link to="/pipeline/leads" className="inline-block mt-2 px-4 py-2 rounded-xl text-white font-medium" style={{ background: 'var(--clay)' }}>Add Lead</Link>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--soft-stone)' }}>
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{lead.name}</p>
                    <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>{lead.stage || 'lead'} • {lead.totalJobs || 0} jobs</p>
                  </div>
                  <span className="font-medium" style={{ color: 'var(--terracotta)' }}>${(lead.totalSpent || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
