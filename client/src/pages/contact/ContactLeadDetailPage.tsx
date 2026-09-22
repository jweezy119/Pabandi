import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/leads', label: 'Leads', icon: 'person_add' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

export default function ContactLeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLead() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLead(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch lead:', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchLead();
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
        <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
        <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Lead not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
      <div className="space-y-6">
        <Link to="/contact/leads" className="text-sm" style={{ color: 'var(--terracotta)' }}>← Back to Leads</Link>
        <div className="rounded-xl p-6" style={{ background: 'white', border: '1px solid var(--soft-stone)' }}>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>{lead.name}</h1>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Email</p>
              <p style={{ color: 'var(--warm-ink)' }}>{lead.email || '—'}</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Phone</p>
              <p style={{ color: 'var(--warm-ink)' }}>{lead.phone || '—'}</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Stage</p>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--warm-sand)', color: 'var(--warm-ink)' }}>{lead.stage || 'lead'}</span>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Total Spent</p>
              <p style={{ color: 'var(--terracotta)' }}>${(lead.totalSpent || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Trust Score</p>
              <p style={{ color: 'var(--warm-ink)' }}>{lead.reliabilityScore || 50}/100</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>Jobs</p>
              <p style={{ color: 'var(--warm-ink)' }}>{lead.totalJobs || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
