import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Chip, EmptyState } from '../../components/primitives';
import ClientTimeline from '../crm/components/ClientTimeline';
import { TrustPanel } from '../../components/TrustPanel';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/jobs', label: 'Jobs', icon: 'work' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
  { path: '/contact/settings/modules', label: 'Settings', icon: 'settings' },
];

export default function ContactDealDetailPage() {
  const { id } = useParams();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Related entities
  const [activities, setActivities] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    if (id) fetchDealData();
  }, [id]);

  async function fetchDealData() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      const dealRes = await fetch(`${baseUrl}/api/v1/crm/deals/${id}`, { headers });
      if (dealRes.ok) {
        const dData = await dealRes.json();
        setDeal(dData.data);
        
        // Fetch related entities. Activities related to deal:
        if (dData.data.clientId) {
          const [actRes, invRes, jobsRes] = await Promise.all([
            fetch(`${baseUrl}/api/v1/crm/activities?clientId=${dData.data.clientId}`, { headers }),
            fetch(`${baseUrl}/api/v1/crm/invoices?clientId=${dData.data.clientId}`, { headers }),
            fetch(`${baseUrl}/api/v1/crm/jobs?clientId=${dData.data.clientId}`, { headers }),
          ]);
          if (actRes.ok) setActivities((await actRes.json()).data || []);
          if (invRes.ok) setInvoices((await invRes.json()).data || []);
          if (jobsRes.ok) setJobs((await jobsRes.json()).data || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}><div className="p-8 text-center text-[var(--soft-stone)]">Loading...</div></DashboardLayout>;
  if (!deal) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}><EmptyState icon="handshake" title="Deal Not Found" description="This deal does not exist." actionLabel="Go Back" onAction={() => window.location.href = '/contact/deals'} /></DashboardLayout>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <Link to="/contact/deals" className="inline-flex items-center gap-2 text-sm text-[var(--clay)] font-medium hover:underline clay-fade">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Deals
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 clay-heading">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--warm-ink)' }}>{deal.title}</h1>
              <Chip label={deal.stage} variant={deal.stage === 'WON' ? 'success' : deal.stage === 'LOST' ? 'danger' : 'neutral'} />
            </div>
            {deal.client && (
              <p className="text-[var(--soft-stone)] text-sm flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[14px]">person</span>
                Client: <Link to={`/contact/clients/${deal.client.id}`} className="hover:underline">{deal.client.name}</Link>
                {deal.client.reliabilityScore < 60 && <span className="text-[var(--dusty-rose)] ml-1 font-bold">(Risk)</span>}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--clay)]">${(deal.value || 0).toLocaleString()}</div>
            <div className="text-sm text-[var(--soft-stone)]">Probability: {deal.probability}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ClientTimeline activities={activities} deals={[deal]} invoices={invoices} jobs={jobs} notes={deal.notes} files={[]} />
          </div>
          <div className="space-y-6">
            {/* Sidebar content */}
            {deal.client && (
              <TrustPanel score={deal.client.reliabilityScore || 85} entityType="Client" entityName={deal.client.name} />
            )}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[rgba(191,179,163,0.3)]">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Trust OS Terms Recommendation</h3>
              {deal.client ? (
                deal.client.reliabilityScore >= 80 ? (
                  <div className="bg-[var(--sage)]/10 text-[var(--sage)] p-3 rounded-xl text-sm border border-[var(--sage)]/20">
                    <strong>Standard Terms:</strong> Client has high payment reliability ({deal.client.reliabilityScore}/100). Standard invoicing is recommended.
                  </div>
                ) : deal.client.reliabilityScore >= 60 ? (
                  <div className="bg-[var(--muted-ochre)]/10 text-[var(--muted-ochre)] p-3 rounded-xl text-sm border border-[var(--muted-ochre)]/20">
                    <strong>Deposit Recommended:</strong> Client has mixed reliability ({deal.client.reliabilityScore}/100). Require 30% upfront deposit.
                  </div>
                ) : (
                  <div className="bg-[var(--dusty-rose)]/10 text-[var(--dusty-rose)] p-3 rounded-xl text-sm border border-[var(--dusty-rose)]/20">
                    <strong>Escrow Required:</strong> Client is high-risk ({deal.client.reliabilityScore}/100). Require full payment into escrow before starting work.
                  </div>
                )
              ) : (
                <div className="text-sm text-[var(--soft-stone)]">Link a client to get term recommendations.</div>
              )}
            </div>

            {deal.customData && Object.keys(deal.customData).length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[rgba(191,179,163,0.3)]">
                <h3 className="font-bold text-[var(--warm-ink)] mb-4">Custom Fields</h3>
                <div className="space-y-2">
                  {Object.entries(deal.customData).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[rgba(191,179,163,0.1)] pb-2 last:border-0 last:pb-0">
                      <span className="text-[var(--soft-stone)] text-sm">{k}</span>
                      <span className="font-medium text-sm">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
