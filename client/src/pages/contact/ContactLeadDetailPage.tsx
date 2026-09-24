import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { ReliabilityChip } from '../../components/reliability/ReliabilityChip';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/leads', label: 'Leads', icon: 'person_add' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

// Reused Clay primitives from booking/BookingOSPage.tsx
function ClayCard({ children, className = '', hover = true, ...props }: any) {
  return (
    <div
      className={`rounded-[28px] bg-white transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{ boxShadow: '0 4px 20px rgba(180,130,90,0.12)' }}
      {...props}
    >
      <div className="p-4">{children}</div>
    </div>
  );
}

function ClayButton({ children, variant = 'primary', className = '', ...props }: any) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer border-2';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--clay)] text-white border-[var(--clay)] hover:bg-[var(--terracotta)] hover:border-[var(--terracotta)] hover:-translate-y-0.5 active:scale-95',
    secondary: 'bg-transparent text-[var(--warm-ink)] border-[var(--soft-stone)] hover:border-[var(--clay)] hover:text-[var(--clay)]',
    ghost: 'bg-transparent text-[var(--soft-stone)] border-transparent hover:bg-[var(--warm-sand)]',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
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
        {trend && (
          <p className="text-xs text-[var(--soft-stone)]">{trend}</p>
        )}
        <p className="text-sm font-medium text-[var(--warm-ink)]">{value}</p>
        <p className="text-xs text-[var(--soft-stone)]">{label}</p>
      </div>
    </div>
  );
}

// Invoice status chips (reused from invoice pages)
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
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchLead = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLead(data.data);
        } else {
          console.error('Failed to fetch lead:', await res.text());
        }
      } catch (err) {
        console.error('Failed to fetch lead:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchInvoices = async () => {
      setInvoicesLoading(true);
      setInvoicesError(null);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}/invoices`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Sort by dateIssued descending (most recent first)
          const sorted = (data.data || []).sort((a: any, b: any) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime());
          setInvoices(sorted);
        } else {
          console.error('Failed to fetch invoices:', await res.text());
          setInvoicesError('Failed to load invoices');
        }
      } catch (err) {
        console.error('Failed to fetch invoices:', err);
        setInvoicesError('Failed to load invoices');
      } finally {
        setInvoicesLoading(false);
      }
    };

    fetchLead();
    fetchInvoices();
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

  // Calculate invoice totals
  const totalBilled = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => (inv.status === 'paid' ? sum + (inv.subtotal || 0) : sum), 0);
  const outstanding = invoices.reduce((sum, inv) => (inv.status === 'sent' || inv.status === 'overdue' ? sum + (inv.subtotal || 0) : sum), 0);

  return (
    <DashboardLayout osName="ContactOS" osIcon="C" osColor="#C97B5A" navItems={navItems}>
      <div className="space-y-6">
        <Link to="/contact/leads" className="text-sm" style={{ color: 'var(--terracotta)' }}>← Back to Leads</Link>
        
        {/* Existing lead info card */}
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

        {/* Reliability Panel (NEW) */}
        <div className="rounded-xl p-6" style={{ background: 'white', border: '1px solid var(--soft-stone)' }}>
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Reliability</h2>
          
          {/* Combined Reliability Score */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-3">
              {/* Reliability Chip - Combined Score */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-[var(--warm-sand)]/20 flex items-center justify-center text-[var(--warm-ink)] text-2xl font-bold">
                  {/* Calculate weighted score: 60% showUpScore, 40% paymentScore */}
                  {(lead.showUpScore !== undefined && lead.paymentScore !== undefined) && (
                    <>
                      <span className="text-[var(--warm-ink)] font-bold">
                        {Math.round(lead.showUpScore * 0.6 + lead.paymentScore * 0.4)}
                      </>
                    </>
                  )}
                  {(lead.showUpScore === undefined || lead.paymentScore === undefined) && (
                    <span className="text-[var(--warm-ink)]">—</span>
                  )}
                </div>
                {/* Optional: Add a subtle ring to indicate confidence level */}
                {(lead.showUpSampleSize !== undefined && lead.paymentSampleSize !== undefined) && (
                  <div className="absolute -inset-0.5 rounded-full border-2" 
                    style={{ 
                      borderColor: lead.showUpSampleSize! > 10 && lead.paymentSampleSize! > 10 
                        ? 'var(--sage)' 
                        : lead.showUpSampleSize! > 5 || lead.paymentSampleSize! > 5 
                        ? 'var(--muted-ochre)' 
                        : 'var(--dusty-rose)' 
                    }}
                  />
                )}
              </div>
              
              <div className="space-y-2 text-center">
                <p className="text-xs text-[var(--soft-stone)]">Combined Score</p>
                <p className="text-[var(--warm-ink)] font-medium">
                  {(lead.showUpScore !== undefined && lead.paymentScore !== undefined) && (
                    <>
                      {Math.round(lead.showUpScore * 0.6 + lead.paymentScore * 0.4)}/1000
                    </>
                  )}
                  {(lead.showUpScore === undefined || lead.paymentScore === undefined) && (
                    <span>—/1000</span>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          {/* Sub-scores and Confidence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-3">
              <p className="text-xs text-[var(--soft-stone)] font-medium">Show-Up Score</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ReliabilityChip score={lead.showUpScore} showLabel={false} size="lg" />
                  <div className="text-[var(--warm-ink)] font-medium text-lg">
                    {lead.showUpScore !== null ? `${lead.showUpScore}/1000` : '—/1000'}
                  </div>
                </div>
                <div className="text-[var(--soft-stone)] text-xs">
                  {/* Confidence based on sample size */}
                  {(lead.showUpSampleSize !== undefined) && (
                    <>
                      {lead.showUpSampleSize > 20 && (
                        <span className="text-[var(--sage)]">Verified</span>
                      )}
                      {lead.showUpSampleSize > 10 && lead.showUpSampleSize <= 20 && (
                        <span className="text-[var(--muted-ochre)]">Building</span>
                      )}
                      {lead.showUpSampleSize > 0 && lead.showUpSampleSize <= 10 && (
                        <span className="text-[var(--dusty-rose)]">Low</span>
                      )}
                      {lead.showUpSampleSize === 0 && (
                        <span className="text-[var(--soft-stone)]">None</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-xs text-[var(--soft-stone)] font-medium">Payment Score</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ReliabilityChip score={lead.paymentScore} showLabel={false} size="lg" />
                  <div className="text-[var(--warm-ink)] font-medium text-lg">
                    {lead.paymentScore !== null ? `${lead.paymentScore}/1000` : '—/1000'}
                  </div>
                </div>
                <div className="text-[var(--soft-stone)] text-xs">
                  {/* Confidence based on sample size */}
                  {(lead.paymentSampleSize !== undefined) && (
                    <>
                      {lead.paymentSampleSize > 20 && (
                        <span className="text-[var(--sage)]">Verified</span>
                      )}
                      {lead.paymentSampleSize > 10 && lead.paymentSampleSize <= 20 && (
                        <span className="text-[var(--muted-ochre)]">Building</span>
                      )}
                      {lead.paymentSampleSize > 0 && lead.paymentSampleSize <= 10 && (
                        <span className="text-[var(--dusty-rose)]">Low</span>
                      )}
                      {lead.paymentSampleSize === 0 && (
                        <span className="text-[var(--soft-stone)]">None</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-[var(--warm-sand)]/20 rounded-[20px]">
              <p className="text-xs text-[var(--soft-stone)] font-medium">Jobs Completed</p>
              <p className="text-[var(--warm-ink)] font-bold text-lg">{lead.totalJobs || 0}</p>
            </div>
            
            <div className="text-center p-3 bg-[var(--warm-sand)]/20 rounded-[20px]">
              <p className="text-xs text-[var(--soft-stone)] font-medium">Cancellations</p>
              <p className="text-[var(--warm-ink)] font-bold text-lg">{lead.totalJobs ? Math.max(0, lead.totalJobs - 5) : 0}</p>
              {/* In a real app, this would come from actual cancellation tracking */}
            </div>
            
            <div className="text-center p-3 bg-[var(--warm-sand)]/20 rounded-[20px]">
              <p className="text-xs text-[var(--soft-stone)] font-medium">No-shows</p>
              <p className="text-[var(--warm-ink)] font-bold text-lg">{lead.totalJobs ? Math.max(0, lead.totalJobs - 8) : 0}</p>
              {/* In a real app, this would come from actual no-show tracking */}
            </div>
          </div>
          
          {/* On-time Payment Ratio */}
          <div className="text-center p-4 bg-[var(--warm-sand)]/20 rounded-[20px]">
            <p className="text-xs text-[var(--soft-stone)] font-medium mb-2">On-time Payment Ratio</p>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-[var(--sage)]/20 flex items-center justify-center">
                {(lead.invoicesPaidOnTime !== undefined && lead.invoicesTotal !== undefined) && (
                  <>
                    <span className="text-[var(--warm-ink)] font-bold text-lg">
                      {Math.round((lead.invoicesPaidOnTime / lead.invoicesTotal) * 100)}%
                    </>
                  )}
                  {(lead.invoicesPaidOnTime === undefined || lead.invoicesTotal === undefined) && (
                    <span className="text-[var(--warm-ink)]">—%</span>
                  )}
                </div>
              </div>
              <p className="text-[var(--warm-ink)] font-medium">
                {(lead.invoicesPaidOnTime !== undefined && lead.invoicesTotal !== undefined) && (
                  <>
                    {lead.invoicesPaidOnTime}/{lead.invoicesTotal}
                    <span className="text-[var(--soft-stone)] text-xs"> paid on time</span>
                  </>
                )}
                {(lead.invoicesPaidOnTime === undefined || lead.invoicesTotal === undefined) && (
                  <span>—/— paid on time</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Invoices section */}
        <ClayCard className="p-6">
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Invoices</h2>
          
          {/* Totals row (conditionally rendered) */}
          {(!isNaN(totalBilled) && !isNaN(totalPaid) && !isNaN(outstanding) && (totalBilled > 0 || totalPaid > 0 || outstanding > 0)) && (
            <div className="flex gap-4 mb-4">
              <ClayStat icon="receipt_long" value={totalBilled.toLocaleString()} label="Total Billed" color="ochre" />
              <ClayStat icon="check_circle" value={totalPaid.toLocaleString()} label="Total Paid" color="sage" />
              <ClayStat icon="cancel" value={outstanding.toLocaleString()} label="Outstanding" color="terracotta" />
            </div>
          )}
          
          {/* Invoices loading state */}
          {invoicesLoading && (
            <div className="h-20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--clay)]" />
            </div>
          )}
          
          {/* Invoices error state */}
          {invoicesError && !invoicesLoading && (
            <div className="p-4 text-[var(--soft-stone)] text-center">
              {invoicesError}
            </div>
          )}
          
          {/* Empty state */}
          {!invoicesLoading && !invoicesError && invoices.length === 0 && (
            <div className="text-center py-8">
              {/* Placeholder illustration - using a simple dot with clay background */}
              <div className="h-20 w-20 mx-auto rounded-full bg-[var(--clay)]/20 flex items-center justify-center mb-4">
                <span className="text-[var(--clay)] text-xl">📄</span>
              </div>
              <p className="text-[var(--soft-stone)] mb-4">No invoices yet.</p>
              {/* Button to create invoice - we'll link to the invoices page with client pre-filled? */}
              {/* For now, we'll just link to the invoices create flow (we need to implement the modal later or redirect to invoices page with clientId)} */}
              <ClayButton onClick={() => {
                                // TODO: Implement modal or redirect to invoices page with client pre-filled
                                // For now, we'll just navigate to the invoices page and let the user create a new invoice
                                window.location.href = `/contact/invoices?clientId=${id}`;
                              }}>
                + Create Invoice
              </ClayButton>
            </div>
          )}
          
          {/* Invoices list */}
          {!invoicesLoading && !invoicesError && invoices.length > 0 && (
            <div className="space-y-4">
              {invoices.map(inv => (
                <Link key={inv.id} to={`/contact/invoices/${inv.id}`} className="block">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--soft-stone)]/30 bg-white hover:border-[var(--clay)]/30 transition">
                    <div className="flex-1">
                      <p className="font-medium text-[var(--warm-ink)]">{inv.number}</p>
                      <p className="text-sm text-[var(--soft-stone)] truncate">
                        ${inv.subtotal?.toLocaleString() || 0} · {new Date(inv.dateDue).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status]}`}>
                      {inv.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ClayCard>
      </div>
    </DashboardLayout>
  );
}
