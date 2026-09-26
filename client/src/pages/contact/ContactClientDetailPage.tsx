import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import ReliabilityChip from '../../components/reliability/ReliabilityChip';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

function ClayCard({ children, className = '', hover = true, ...props }: any) {
  return (
    <div
      className={`rounded-[28px] bg-white transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{ boxShadow: 'var(--shadow-soft)' }}
      {...props}
    >
      <div className="p-6">{children}</div>
    </div>
  );
}

function ClayStat({ icon, value, label, trend, color = 'terracotta' }: { icon: string; value: string; label: string; trend?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    terracotta: 'bg-[var(--clay)]',
    sage: 'bg-[var(--sage)]',
    'dusty-rose': 'bg-[var(--dusty-rose)]',
    ochre: 'bg-[var(--muted-ochre)]',
    'sky-wash': 'bg-[var(--sky-wash)]',
  };
  const bgColor = colorMap[color] || colorMap.terracotta;
  return (
    <div className={`${bgColor} rounded-[20px] p-4 flex items-center gap-3`}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20">
        <span className="material-symbols-outlined text-[var(--warm-ink)] text-[18px]">{icon}</span>
      </div>
      <div>
        {trend && <p className="text-xs text-[var(--soft-stone)]">{trend}</p>}
        <p className="text-sm font-bold text-[var(--warm-ink)]">{value}</p>
        <p className="text-xs text-[var(--soft-stone)]">{label}</p>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-[var(--sage)]/20 text-[var(--warm-ink)]',
  overdue: 'bg-[var(--terracotta)]/20 text-[var(--warm-ink)]',
};

export default function ContactClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    setLoading(true);
    Promise.all([
      fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}`, { headers }),
      fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}/invoices`, { headers }),
    ]).then(async ([clientRes, invRes]) => {
      if (clientRes.ok) setClient((await clientRes.json()).data);
      if (invRes.ok) {
        const data = (await invRes.json()).data || [];
        setInvoices(data.sort((a: any, b: any) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime()));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="clay" navItems={navItems}>
        <div className="p-8 text-center text-[var(--soft-stone)]">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="clay" navItems={navItems}>
        <ClayCard hover={false} className="text-center p-12">
          <span className="material-symbols-outlined text-[48px] text-[var(--clay)] mb-4 block">person_off</span>
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">Client Not Found</h2>
          <p className="text-[var(--soft-stone)] mb-6">The client you are looking for does not exist or has been deleted.</p>
          <Link to="/contact/clients" className="btn btn-primary inline-flex">Go Back to Clients</Link>
        </ClayCard>
      </DashboardLayout>
    );
  }

  const totalBilled = invoices.reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const hasStats = totalBilled > 0 || totalPaid > 0 || outstanding > 0;
  const paymentScore = client.passport?.paymentScore ?? null;

  return (
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <Link to="/contact/clients" className="inline-flex items-center gap-2 text-sm text-[var(--terracotta)] font-medium hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Clients
        </Link>

        <ClayCard hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold font-headline text-[var(--warm-ink)]">{client.name}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--warm-sand)] text-[var(--warm-ink)]">
              {client.stage || 'Active'}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Email</p>
              <p className="text-sm font-medium text-[var(--warm-ink)]">{client.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Phone</p>
              <p className="text-sm font-medium text-[var(--warm-ink)]">{client.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Company</p>
              <p className="text-sm font-medium text-[var(--warm-ink)]">{client.company || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Total LTV</p>
              <p className="text-lg font-bold text-[var(--terracotta)]">${(client.totalSpent || 0).toLocaleString()}</p>
            </div>
          </div>
          {client.notes && (
            <div className="mt-6 pt-6 border-t border-[rgba(191,179,163,0.2)]">
              <p className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-[var(--warm-ink)] whitespace-pre-wrap leading-relaxed">{client.notes}</p>
            </div>
          )}
        </ClayCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ClayCard hover={false}>
              <h2 className="text-xl font-bold font-headline text-[var(--warm-ink)] mb-6">Trust & Reliability</h2>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between p-4 bg-[var(--warm-sand)] rounded-[20px]">
                  <p className="text-sm font-bold text-[var(--warm-ink)]">Show-Up Score</p>
                  <div className="flex items-center gap-3">
                    <ReliabilityChip score={client.showUpScore ?? null} showLabel={false} size="lg" />
                    <span className="text-[var(--warm-ink)] font-bold text-lg">
                      {client.showUpScore != null ? `${client.showUpScore}` : '—'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-[var(--warm-sand)] rounded-[20px]">
                  <p className="text-sm font-bold text-[var(--warm-ink)]">Payment Score</p>
                  <div className="flex items-center gap-3">
                    <ReliabilityChip score={client.paymentScore ?? null} showLabel={false} size="lg" />
                    <span className="text-[var(--warm-ink)] font-bold text-lg">
                      {client.paymentScore != null ? `${client.paymentScore}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </ClayCard>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <ClayCard hover={false}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-headline text-[var(--warm-ink)]">Invoices</h2>
                {paymentScore != null && <ReliabilityChip score={paymentScore} showLabel={true} size="md" />}
              </div>
              
              {hasStats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <ClayStat icon="receipt_long" value={`$${totalBilled.toLocaleString()}`} label="Total Billed" color="ochre" />
                  <ClayStat icon="check_circle" value={`$${totalPaid.toLocaleString()}`} label="Paid" color="sage" />
                  <ClayStat icon="cancel" value={`$${outstanding.toLocaleString()}`} label="Outstanding" color="terracotta" />
                </div>
              )}

              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[var(--warm-sand)] flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-[32px] text-[var(--clay)]">receipt_long</span>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-2">No Invoices</h3>
                  <p className="text-sm text-[var(--soft-stone)] mb-4">You haven't billed this client yet.</p>
                  <button onClick={() => { window.location.href = `/contact/invoices?clientId=${id}`; }} className="btn btn-primary">
                    Create Invoice
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map(inv => (
                    <Link key={inv.id} to={`/contact/invoices/${inv.id}`} className="block">
                      <div className="flex items-center justify-between p-4 rounded-[20px] bg-[var(--warm-sand)] border border-transparent hover:border-[var(--clay)]/30 transition-all">
                        <div className="flex-1">
                          <p className="font-bold text-[var(--warm-ink)]">{inv.number}</p>
                          <p className="text-xs text-[var(--soft-stone)] mt-1">
                            ${inv.subtotal?.toLocaleString() || 0} · Due {new Date(inv.dateDue).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[inv.status] || ''}`}>
                          {inv.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ClayCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
