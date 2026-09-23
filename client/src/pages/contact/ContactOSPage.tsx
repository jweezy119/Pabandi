import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/leads', label: 'Leads', icon: 'person_add' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

const FUNNEL_STAGES = [
  { name: 'Lead', color: 'var(--clay)' },
  { name: 'Verified', color: 'var(--muted-ochre)' },
  { name: 'Booked', color: 'var(--sage)' },
  { name: 'Repeat', color: 'var(--sky-wash)' },
  { name: 'VIP', color: 'var(--dusty-rose)' },
  { name: 'At Risk', color: 'var(--terracotta)' },
];

function ClayCard({ children, className = '', hover = true, ...props }: any) {
  return (
    <div
      className={`rounded-[28px] bg-white transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{ boxShadow: 'var(--shadow-soft)' }}
      {...props}
    >
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatCard({ icon, value, label, valueColor = 'warm-ink' }: { icon: string; value: string; label: string; valueColor?: string }) {
  return (
    <ClayCard className="p-5" hover={false}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm mb-1" style={{ color: 'var(--soft-stone)' }}>{label}</p>
          <p className="text-2xl font-bold" style={{ color: `var(--${valueColor})` }}>{value}</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-[var(--clay)] flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--warm-ink)' }}>{icon}</span>
        </div>
      </div>
    </ClayCard>
  );
}

export default function ContactOSPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        setLeads([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  if (loading) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="clay" navItems={navItems}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>ContactOS — Every relationship, one trusted record</title>
      </Head>
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="clay" navItems={navItems}>
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon="groups"
              value={leads.length.toString()}
              label="Total Leads"
              valueColor="warm-ink"
            />
            <StatCard
              icon="trending_up"
              value={leads.filter(l => l.stage === 'booked').length.toString()}
              label="Booked"
              valueColor="sage"
            />
            <StatCard
              icon="calendar_today"
              value={leads.filter(l => l.stage === 'repeat').length.toString()}
              label="Repeat"
              valueColor="sky-wash"
            />
            <StatCard
              icon="star"
              value={leads.filter(l => l.stage === 'vip').length.toString()}
              label="VIP"
              valueColor="dusty-rose"
            />
          </div>

          {/* Leads List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Leads</h2>
              <Link to="/contact/leads" className="px-4 py-2 bg-primary/10 rounded-lg hover:bg-primary/20 text-sm font-medium">
                View All
              </Link>
            </div>

            {leads.length === 0 ? (
              <p className="text-center py-8 text-muted">No leads yet. Add your first lead to get started.</p>
            ) : (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <div key={lead.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--warm-sand)' }}>
                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--soft-stone)' }}>person</span>
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--warm-ink)' }}>{lead.name}</p>
                        <p className="text-sm" style={{ color: 'var(--soft-stone)' }}>{lead.stage || 'lead'} • {lead.totalJobs || 0} jobs</p>
                      </div>
                    </div>
                    <span className="font-medium" style={{ color: 'var(--terracotta)' }}>${(lead.totalSpent || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
