import { Helmet } from 'react-helmet-async';
import DashboardLayout from '../../components/DashboardLayout';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { Card } from '../../components/primitives';
import ModularDashboard from '../crm/components/ModularDashboard';
import { useAuthStore } from '../../store/authStore';
import { getAuthToken } from '../../utils/authToken';



function StatCard({ icon, value, label, color = 'clay', delay = 0 }: {
  icon: string;
  value: string;
  label: string;
  color?: string;
  delay?: number;
}) {
  const colorMap: Record<string, string> = {
    clay: 'var(--clay)',
    sage: 'var(--sage)',
    ochre: 'var(--muted-ochre)',
    'sky-wash': 'var(--sky-wash)',
    'dusty-rose': 'var(--dusty-rose)',
  };

  return (
    <div className="clay-rise" style={{ animationDelay: `${delay}ms` }}>
      <Card hover={false}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-label" style={{ color: 'var(--soft-stone)' }}>{label}</p>
            <p className="stat-number text-4xl mt-2" style={{ color: 'var(--warm-ink)' }}>{value}</p>
          </div>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center clay-stat-icon"
            style={{ backgroundColor: colorMap[color] || colorMap.clay }}
          >
            <span className="material-symbols-outlined text-[20px] text-white">{icon}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ContactOSPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { settings } = useBusinessSettings();
  const { user } = useAuthStore();
  const businessId = (user as any)?.business?.id || (user as any)?.businessId || localStorage.getItem('businessId') || 'default';

  // Redirect new users to the setup wizard
  useEffect(() => {
    if (!settings.hasCompletedSetup && !settings.vertical) {
      navigate('/contact/setup', { replace: true });
    }
  }, [settings.hasCompletedSetup, settings.vertical, navigate]);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
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

  if (loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--clay)] border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Contact OS — Every relationship, one trusted record</title>
      </Helmet>
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* ── Greeting ─────────────────────────────────────────── */}
          <div className="clay-fade mb-8">
            <h1 className="text-3xl font-bold clay-heading">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
            </h1>
            <p className="mt-1" style={{ color: 'var(--soft-stone)', fontSize: '15px' }}>
              Here's your business at a glance.
            </p>
          </div>

          {/* ── Stat cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            <Link to="/contact/clients" className="block">
              <StatCard icon="groups" value={leads.length.toString()} label="Total Clients" color="clay" delay={160} />
            </Link>
            <Link to="/contact/deals" className="block">
              <StatCard icon="trending_up" value={leads.filter(l => l.stage === 'booked').length.toString()} label="Active Deals" color="sage" delay={240} />
            </Link>
            <Link to="/contact/clients" className="block">
              <StatCard icon="repeat" value={leads.filter(l => l.stage === 'repeat').length.toString()} label="Repeat Clients" color="sky-wash" delay={320} />
            </Link>
            <Link to="/contact/clients" className="block">
              <StatCard icon="star" value={leads.filter(l => l.stage === 'vip').length.toString()} label="VIP" color="dusty-rose" delay={400} />
            </Link>
          </div>

          {/* ── Modular Dashboard ────────────────────────────────── */}
          <div className="clay-rise clay-delay-3 mb-10">
            <ModularDashboard businessId={businessId} data={{ leads }} />
          </div>

          {/* ── Clients list ──────────────────────────────────────── */}
          <div className="clay-rise clay-delay-5">
            <div className="flex items-center justify-between mb-5 clay-heading" style={{ fontSize: '1.25rem' }}>
              <h2 className="font-bold" style={{ color: 'var(--warm-ink)', fontFamily: 'var(--font-headline)' }}>
                Recent Clients
              </h2>
              <Link
                to="/contact/clients"
                className="text-sm font-bold px-4 py-2 rounded-full transition-all duration-200 clay-filter-chip clay-filter-chip--active"
                style={{
                  color: 'white',
                  backgroundColor: 'var(--clay)',
                  boxShadow: 'var(--shadow-btn)',
                }}
              >
                View All →
              </Link>
            </div>

            {leads.length === 0 ? (
              <Card hover={false} className="text-center">
                <div className="py-12">
                  <span className="material-symbols-outlined text-[48px] mb-4 block" style={{ color: 'var(--clay)' }}>
                    person_add
                  </span>
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--warm-ink)', fontFamily: 'var(--font-headline)' }}>
                    Add your first client
                  </h3>
                  <p className="mb-6" style={{ color: 'var(--soft-stone)', fontSize: '14px', maxWidth: '320px', margin: '0 auto 24px' }}>
                    Every great relationship starts here. Add a client to start tracking.
                  </p>
                  <Link
                    to="/contact/clients"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white transition-all duration-150"
                    style={{
                      backgroundColor: 'var(--clay)',
                      boxShadow: 'var(--shadow-btn)',
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Add Client
                  </Link>
                </div>
              </Card>
            ) : (
              <Card hover={false} noPadding>
                <div>
                  {leads.map((lead, i) => (
                    <Link
                      key={lead.id}
                      to={`/contact/clients/${lead.id}`}
                      className="flex items-center justify-between px-7 transition-colors duration-200 clay-table-row"
                      style={{
                        height: 'var(--space-row-height)',
                        borderBottom: i < leads.length - 1 ? '1px solid rgba(191, 179, 163, 0.15)' : 'none',
                        borderRadius: '0',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(232, 217, 197, 0.3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(135deg, var(--warm-sand) 0%, rgba(201,123,90,0.15) 100%)',
                          }}
                        >
                          <span className="text-sm font-bold" style={{ color: 'var(--clay)' }}>
                            {lead.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--warm-ink)' }}>
                            {lead.name}
                          </p>
                          <p style={{ color: 'var(--soft-stone)', fontSize: '12px' }}>
                            {lead.stage || 'lead'} • {lead.totalJobs || 0} jobs
                          </p>
                        </div>
                      </div>
                      <span className="stat-number text-sm" style={{ color: 'var(--terracotta)' }}>
                        ${(lead.totalSpent || 0).toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
