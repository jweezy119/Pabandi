import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import ReliabilityChip from '../../components/reliability/ReliabilityChip';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/leads', label: 'Leads', icon: 'person_add' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

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
        <p className="text-sm font-medium text-[var(--warm-ink)]">{value}</p>
        <p className="text-xs text-[var(--soft-stone)]">{label}</p>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function ContactLeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    setLoading(true);
    Promise.all([
      fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}`, { headers }),
      fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}/invoices`, { headers }),
    ]).then(async ([leadRes, invRes]) => {
      if (leadRes.ok) setLead((await leadRes.json()).data);
      if (invRes.ok) {
        const data = (await invRes.json()).data || [];
        setInvoices(data.sort((a: any, b: any) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime()));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
        <div className="p-8 text-center text-[var(--soft-stone)]">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
        <div className="p-8 text-center text-[var(--soft-stone)]">Lead not found</div>
      </DashboardLayout>
    );
  }

  const totalBilled = invoices.reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const hasStats = totalBilled > 0 || totalPaid > 0 || outstanding > 0;
  const paymentScore = lead.passport?.paymentScore ?? null;

  return (
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
      <div className="space-y-6">
        <Link to="/contact/leads" className="text-sm text-[var(--terracotta)]">← Back to Leads</Link>

        <div className="rounded-xl p-6 bg-white border border-[var(--soft-stone)]">
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">{lead.name}</h1>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[var(--soft-stone)]">Email</p>
              <p className="text-[var(--warm-ink)]">{lead.email || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--soft-stone)]">Phone</p>
              <p className="text-[var(--warm-ink)]">{lead.phone || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--soft-stone)]">Stage</p>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--warm-sand)] text-[var(--warm-ink)]">{lead.stage || 'lead'}</span>
            </div>
            <div>
              <p className="text-sm text-[var(--soft-stone)]">Total Spent</p>
              <p className="text-[var(--terracotta)]">${(lead.totalSpent || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-6 bg-white border border-[var(--soft-stone)]">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Reliability</h2>
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[var(--warm-sand)]/20 flex items-center justify-center text-[var(--warm-ink)] text-2xl font-bold">
              {lead.showUpScore != null && lead.paymentScore != null
                ? Math.round(lead.showUpScore * 0.6 + lead.paymentScore * 0.4)
                : '—'}
            </div>
            <div>
              <p className="text-xs text-[var(--soft-stone)]">Combined Score</p>
              <p className="text-[var(--warm-ink)] font-medium">
                {lead.showUpScore != null && lead.paymentScore != null
                  ? `${Math.round(lead.showUpScore * 0.6 + lead.paymentScore * 0.4)}/1000`
                  : '—/1000'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-[var(--soft-stone)] font-medium mb-2">Show-Up Score</p>
              <div className="flex items-center gap-2">
                <ReliabilityChip score={lead.showUpScore ?? null} showLabel={false} size="lg" />
                <span className="text-[var(--warm-ink)] font-medium text-lg">
                  {lead.showUpScore != null ? `${lead.showUpScore}/1000` : '—/1000'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--soft-stone)] font-medium mb-2">Payment Score</p>
              <div className="flex items-center gap-2">
                <ReliabilityChip score={lead.paymentScore ?? null} showLabel={false} size="lg" />
                <span className="text-[var(--warm-ink)] font-medium text-lg">
                  {lead.paymentScore != null ? `${lead.paymentScore}/1000` : '—/1000'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-6" style={{ boxShadow: '0 4px 20px rgba(180,130,90,0.12)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[var(--warm-ink)]">Invoices</h2>
            {paymentScore != null && <ReliabilityChip score={paymentScore} showLabel={true} size="md" />}
          </div>
          {hasStats && (
            <div className="flex gap-4 mb-4">
              <ClayStat icon="receipt_long" value={`$${totalBilled.toLocaleString()}`} label="Total Billed" color="ochre" />
              <ClayStat icon="check_circle" value={`$${totalPaid.toLocaleString()}`} label="Total Paid" color="sage" />
              <ClayStat icon="cancel" value={`$${outstanding.toLocaleString()}`} label="Outstanding" color="terracotta" />
            </div>
          )}
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <div className="h-20 w-20 mx-auto rounded-full bg-[var(--clay)]/20 flex items-center justify-center mb-4">
                <span className="text-[var(--clay)] text-2xl">📄</span>
              </div>
              <p className="text-[var(--soft-stone)] mb-4">No invoices yet.</p>
              <button onClick={() => { window.location.href = `/contact/invoices?clientId=${id}`; }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-[var(--clay)] text-white hover:bg-[var(--terracotta)]">
                + Create Invoice
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map(inv => (
                <Link key={inv.id} to={`/contact/invoices/${inv.id}`} className="block">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--soft-stone)]/30 bg-white hover:border-[var(--clay)]/30 transition">
                    <div className="flex-1">
                      <p className="font-medium text-[var(--warm-ink)]">{inv.number}</p>
                      <p className="text-sm text-[var(--soft-stone)]">${inv.subtotal?.toLocaleString() || 0} · Due {new Date(inv.dateDue).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
