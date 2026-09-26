import { Helmet } from 'react-helmet-async';
import DashboardLayout from '../../components/DashboardLayout';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
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

function FirstRunWizard() {
  const [step, setStep] = useState(1);
  return (
    <div className="max-w-xl mx-auto py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-headline font-bold" style={{ color: 'var(--warm-ink)' }}>Welcome to Contact OS</h1>
        <p className="mt-2" style={{ color: 'var(--soft-stone)' }}>Let's set up your CRM.</p>
      </div>
      
      <ClayCard className="p-8">
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-4 font-headline" style={{ color: 'var(--warm-ink)' }}>1. Name your business</h2>
            <input className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)] mb-6" placeholder="e.g. Acme Studio" />
            <button onClick={() => setStep(2)} className="w-full rounded-xl bg-[var(--clay)] px-4 py-3 font-semibold text-[var(--warm-ink)] transition hover:bg-[var(--terracotta)]">Continue</button>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-4 font-headline" style={{ color: 'var(--warm-ink)' }}>2. Add your first client</h2>
            <input className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)] mb-6" placeholder="Client Name" />
            <button onClick={() => setStep(3)} className="w-full rounded-xl bg-[var(--clay)] px-4 py-3 font-semibold text-[var(--warm-ink)] transition hover:bg-[var(--terracotta)]">Continue</button>
          </div>
        )}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-4 font-headline" style={{ color: 'var(--warm-ink)' }}>3. Draft your first invoice</h2>
            <input className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)] mb-6" placeholder="Amount ($)" type="number" />
            <button onClick={() => window.location.href='/contact'} className="w-full rounded-xl bg-[var(--sage)] px-4 py-3 font-semibold text-[var(--warm-ink)] transition hover:bg-opacity-80">Finish Setup</button>
          </div>
        )}
      </ClayCard>
    </div>
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

  const location = useLocation();
  const showWizard = new URLSearchParams(location.search).get('wizard') === 'true';

  if (showWizard) {
    return (
      <>
        <Helmet>
          <title>Welcome to Contact OS</title>
        </Helmet>
        <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
          <FirstRunWizard />
        </DashboardLayout>
      </>
    );
  }

  if (loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Contact OS — Every relationship, one trusted record</title>
      </Helmet>
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
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

          {/* Clients List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Clients</h2>
              <Link to="/contact/clients" className="px-4 py-2 bg-primary/10 rounded-lg hover:bg-primary/20 text-sm font-medium">
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
