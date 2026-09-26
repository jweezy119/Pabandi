import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import ReliabilityChip from '../../components/reliability/ReliabilityChip';
import { Card, Button, Chip, EmptyState } from '../../components/primitives';
import { Modal } from '../../components/primitives/Modal';
import { Input } from '../../components/primitives/Input';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/jobs', label: 'Jobs', icon: 'work' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

function Stat({ icon, value, label, color = 'terracotta' }: { icon: string; value: string; label: string; color?: string }) {
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
        <p className="text-sm font-bold text-[var(--warm-ink)]">{value}</p>
        <p className="text-xs text-[var(--soft-stone)]">{label}</p>
      </div>
    </div>
  );
}

const TABS = ['Overview', 'Activity', 'Deals', 'Invoices', 'Jobs', 'Notes', 'Files'];

export default function ContactClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  // Related Entities Data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  // Modals
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);

  // Forms
  const [activityForm, setActivityForm] = useState({ type: 'NOTE', title: '', description: '' });
  const [dealForm, setDealForm] = useState({ title: '', value: '', stage: 'LEAD' });
  const [invoiceForm, setInvoiceForm] = useState({ description: 'Service Fee', amount: '', dateDue: '' });
  const [fileForm, setFileForm] = useState({ fileName: '', fileUrl: 'https://pabandi.com/docs/sample.pdf' });

  useEffect(() => {
    if (!id) return;
    fetchClientAllData();
  }, [id]);

  async function fetchClientAllData() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      const [clientRes, invRes, actRes, dealsRes, jobsRes, filesRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/crm/clients/${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/invoices?clientId=${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/activities?clientId=${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/deals?clientId=${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/jobs?clientId=${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/files?clientId=${id}`, { headers }),
      ]);

      if (clientRes.ok) setClient((await clientRes.json()).data);
      if (invRes.ok) setInvoices((await invRes.json()).data || []);
      if (actRes.ok) setActivities((await actRes.json()).data || []);
      if (dealsRes.ok) setDeals((await dealsRes.json()).data || []);
      if (jobsRes.ok) setJobs((await jobsRes.json()).data || []);
      if (filesRes.ok) setFiles((await filesRes.json()).data || []);
    } catch (err) {
      console.error('Failed to load client details:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handlers for creating related items
  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/v1/crm/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...activityForm, clientId: id }),
      });
      if (res.ok) {
        setShowActivityModal(false);
        setActivityForm({ type: 'NOTE', title: '', description: '' });
        fetchClientAllData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateDeal(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/v1/crm/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...dealForm, value: parseFloat(dealForm.value) || 0, clientId: id }),
      });
      if (res.ok) {
        setShowDealModal(false);
        setDealForm({ title: '', value: '', stage: 'LEAD' });
        fetchClientAllData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/v1/crm/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientId: id,
          dateDue: invoiceForm.dateDue || new Date(Date.now() + 7 * 86400000).toISOString(),
          lineItems: [{ description: invoiceForm.description, amount: parseFloat(invoiceForm.amount) || 0, quantity: 1 }],
        }),
      });
      if (res.ok) {
        setShowInvoiceModal(false);
        setInvoiceForm({ description: 'Service Fee', amount: '', dateDue: '' });
        fetchClientAllData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddFile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/v1/crm/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId: id, ...fileForm }),
      });
      if (res.ok) {
        setShowFileModal(false);
        setFileForm({ fileName: '', fileUrl: 'https://pabandi.com/docs/sample.pdf' });
        fetchClientAllData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMarkPaid(invoiceId: string) {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/v1/crm/invoices/${invoiceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'paid' }),
      });
      if (res.ok) {
        fetchClientAllData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
        <div className="p-8 text-center text-[var(--soft-stone)]">Loading client profile...</div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
        <EmptyState 
          icon="person_off" 
          title="Client Not Found" 
          description="The client you are looking for does not exist or has been deleted." 
          actionLabel="Go Back to Clients"
          onAction={() => window.location.href = '/contact/clients'}
        />
      </DashboardLayout>
    );
  }

  const totalBilled = invoices.reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'draft').reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const paymentScore = client.passport?.paymentScore ?? 85;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <Link to="/contact/clients" className="inline-flex items-center gap-2 text-sm text-[var(--clay)] font-medium hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Clients
        </Link>

        {/* Header section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--clay)] text-white text-2xl font-bold shadow-md">
              {client.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold font-headline text-[var(--warm-ink)]">{client.name}</h1>
                <Chip label={client.status || 'ACTIVE'} variant="neutral" />
              </div>
              <p className="text-[var(--soft-stone)] text-sm">{client.email || 'No email provided'} · {client.phone || 'No phone'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon="add" onClick={() => setShowDealModal(true)}>New Deal</Button>
            <Button variant="primary" icon="add" onClick={() => setShowActivityModal(true)}>Log Activity</Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 border-b border-[rgba(191,179,163,0.3)] pb-2 overflow-x-auto hide-scrollbar">
          {TABS.map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-bold text-sm rounded-full transition-all ${
                activeTab === tab 
                  ? 'bg-[var(--clay)] text-white shadow-xs' 
                  : 'text-[var(--soft-stone)] hover:bg-[var(--warm-sand)] hover:text-[var(--warm-ink)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card hover={false}>
                <h2 className="text-lg font-bold font-headline text-[var(--warm-ink)] mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Email Address</p>
                    <p className="text-sm font-medium text-[var(--warm-ink)]">{client.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Phone Number</p>
                    <p className="text-sm font-medium text-[var(--warm-ink)]">{client.phone || '—'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold text-[var(--soft-stone)] uppercase tracking-wider mb-1">Physical Address</p>
                    <p className="text-sm font-medium text-[var(--warm-ink)]">{client.address || '—'}</p>
                  </div>
                </div>
              </Card>

              <Card hover={false}>
                <h2 className="text-lg font-bold font-headline text-[var(--warm-ink)] mb-4">Financial Overview</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Stat icon="receipt_long" value={`$${totalBilled.toLocaleString()}`} label="Total Billed" color="ochre" />
                  <Stat icon="check_circle" value={`$${totalPaid.toLocaleString()}`} label="Paid to Date" color="sage" />
                  <Stat icon="cancel" value={`$${outstanding.toLocaleString()}`} label="Outstanding" color="terracotta" />
                </div>
              </Card>
              
              <Card hover={false}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold font-headline text-[var(--warm-ink)]">Recent Activity</h2>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('Activity')}>View All</Button>
                </div>
                {activities.length === 0 ? (
                  <EmptyState icon="history" title="No Recent Activity" description="Activities logged with this client will appear here." actionLabel="Log Activity" onAction={() => setShowActivityModal(true)} />
                ) : (
                  <div className="space-y-2">
                    {activities.slice(0, 3).map(act => (
                      <div key={act.id} className="p-3 rounded-xl bg-[var(--warm-sand)]/30 flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-[var(--warm-ink)]">{act.title}</strong> ({act.type})
                          {act.description && <p className="text-[var(--soft-stone)] mt-0.5">{act.description}</p>}
                        </div>
                        <span className="text-[var(--soft-stone)]">{new Date(act.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Right Column: Reliability & Next Action */}
            <div className="space-y-6">
              <Card hover={false}>
                <h2 className="text-lg font-bold font-headline text-[var(--warm-ink)] mb-4">Trust & Reliability Engine</h2>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-3.5 bg-[var(--warm-sand)]/50 rounded-2xl">
                    <div>
                      <p className="text-sm font-bold text-[var(--warm-ink)]">Payment Reliability</p>
                      <p className="text-[11px] text-[var(--soft-stone)]">On-time payment track record</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ReliabilityChip score={paymentScore} showLabel={false} size="md" />
                      <span className="text-[var(--warm-ink)] font-bold text-sm">{paymentScore}/100</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-[var(--warm-sand)]/50 rounded-2xl">
                    <div>
                      <p className="text-sm font-bold text-[var(--warm-ink)]">Show-Up Score</p>
                      <p className="text-[11px] text-[var(--soft-stone)]">Service appointment attendance</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ReliabilityChip score={90} showLabel={false} size="md" />
                      <span className="text-[var(--warm-ink)] font-bold text-sm">90/100</span>
                    </div>
                  </div>
                </div>
              </Card>
              
              <Card hover={false}>
                <h2 className="text-lg font-bold font-headline text-[var(--warm-ink)] mb-4">Next Recommended Action</h2>
                <div className="p-4 rounded-2xl bg-[var(--clay)]/10 border border-[var(--clay)]/30 space-y-2">
                  <div className="flex items-center gap-2 text-[var(--clay)] font-bold text-sm">
                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                    Follow-up Call Suggested
                  </div>
                  <p className="text-xs text-[var(--soft-stone)]">
                    Client has an open invoice of ${outstanding}. Schedule a reminder call or send payment link.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => setShowActivityModal(true)}>Schedule Task</Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 2: Activity */}
        {activeTab === 'Activity' && (
          <Card hover={false} className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold font-headline text-[var(--warm-ink)]">Activity & Task History</h2>
              <Button icon="add" onClick={() => setShowActivityModal(true)}>Log Activity</Button>
            </div>
            {activities.length === 0 ? (
              <EmptyState icon="history" title="No Activities" description="No logged calls, emails, or meetings for this client." />
            ) : (
              <div className="space-y-3">
                {activities.map(act => (
                  <div key={act.id} className="p-4 rounded-2xl bg-[var(--warm-sand)]/30 border border-[var(--warm-sand)] flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Chip label={act.type} variant="info" />
                        <h4 className="font-bold text-sm text-[var(--warm-ink)]">{act.title}</h4>
                      </div>
                      {act.description && <p className="text-xs text-[var(--soft-stone)] mt-2">{act.description}</p>}
                    </div>
                    <span className="text-xs text-[var(--soft-stone)]">{new Date(act.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 3: Deals */}
        {activeTab === 'Deals' && (
          <Card hover={false} className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold font-headline text-[var(--warm-ink)]">Deals & Opportunities</h2>
              <Button icon="add" onClick={() => setShowDealModal(true)}>New Deal</Button>
            </div>
            {deals.length === 0 ? (
              <EmptyState icon="handshake" title="No Deals" description="No active or past deal opportunities associated with this client." />
            ) : (
              <div className="space-y-3">
                {deals.map(deal => (
                  <div key={deal.id} className="p-4 rounded-2xl bg-[var(--warm-sand)]/30 border border-[var(--warm-sand)] flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--warm-ink)]">{deal.title}</h4>
                      <p className="text-xs text-[var(--soft-stone)] mt-1">Stage: <strong>{deal.stage}</strong> · Win Probability: {deal.probability}%</p>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[var(--clay)]">${(deal.value || 0).toLocaleString()}</div>
                      <span className="text-[11px] text-[var(--soft-stone)]">{new Date(deal.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 4: Invoices */}
        {activeTab === 'Invoices' && (
          <Card hover={false} className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold font-headline text-[var(--warm-ink)]">Invoices & Billing</h2>
              <Button icon="add" onClick={() => setShowInvoiceModal(true)}>Create Invoice</Button>
            </div>
            {invoices.length === 0 ? (
              <EmptyState icon="receipt_long" title="No Invoices" description="You haven't billed this client yet." />
            ) : (
              <div className="space-y-3">
                {invoices.map(inv => (
                  <div key={inv.id} className="p-4 rounded-2xl bg-[var(--warm-sand)]/30 border border-[var(--warm-sand)] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[var(--warm-ink)]">{inv.number}</h4>
                        <Chip label={inv.status} variant={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'warning'} />
                      </div>
                      <p className="text-xs text-[var(--soft-stone)] mt-1">
                        Subtotal: ${inv.subtotal?.toLocaleString() || 0} · Due: {new Date(inv.dateDue).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {inv.status !== 'paid' && (
                        <Button variant="secondary" size="sm" onClick={() => handleMarkPaid(inv.id)}>
                          Mark Paid (+15 Rel)
                        </Button>
                      )}
                      <span className="text-base font-bold text-[var(--warm-ink)]">${(inv.subtotal || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 5: Jobs */}
        {activeTab === 'Jobs' && (
          <Card hover={false} className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold font-headline text-[var(--warm-ink)]">Jobs & Service Orders</h2>
              <Link to="/contact/jobs">
                <Button icon="work">Manage All Jobs</Button>
              </Link>
            </div>
            {jobs.length === 0 ? (
              <EmptyState icon="work" title="No Jobs Scheduled" description="No active or completed service jobs for this client." />
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <div key={job.id} className="p-4 rounded-2xl bg-[var(--warm-sand)]/30 border border-[var(--warm-sand)] flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--warm-ink)]">{job.serviceType}</h4>
                      <p className="text-xs text-[var(--soft-stone)] mt-1">
                        Status: <strong>{job.status}</strong> · Date: {new Date(job.scheduledDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--clay)]">${(job.price || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 6: Notes */}
        {activeTab === 'Notes' && (
          <Card hover={false} className="space-y-4">
            <h2 className="text-xl font-bold font-headline text-[var(--warm-ink)]">Internal Notes</h2>
            <div className="p-4 rounded-2xl bg-[var(--warm-sand)]/40 border border-[var(--warm-sand)] text-sm text-[var(--warm-ink)]">
              {client.notes || 'No custom notes provided for this client.'}
            </div>
          </Card>
        )}

        {/* Tab 7: Files */}
        {activeTab === 'Files' && (
          <Card hover={false} className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold font-headline text-[var(--warm-ink)]">Attachments & Documents</h2>
              <Button icon="upload" onClick={() => setShowFileModal(true)}>Upload File</Button>
            </div>
            {files.length === 0 ? (
              <EmptyState icon="attach_file" title="No Files Attached" description="Upload contracts, proposals, or receipts for this client." />
            ) : (
              <div className="space-y-3">
                {files.map(f => (
                  <div key={f.id} className="p-4 rounded-2xl bg-[var(--warm-sand)]/30 border border-[var(--warm-sand)] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[var(--clay)] text-[24px]">description</span>
                      <div>
                        <h4 className="font-bold text-sm text-[var(--warm-ink)]">{f.fileName}</h4>
                        <p className="text-xs text-[var(--soft-stone)]">{f.fileSize || 'PDF'} · Uploaded {new Date(f.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[var(--clay)] hover:underline">
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Modals for Quick Creation */}
        <Modal isOpen={showActivityModal} onClose={() => setShowActivityModal(false)} title="Log Activity">
          <form onSubmit={handleCreateActivity} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--warm-ink)]">Type</label>
              <select
                value={activityForm.type}
                onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] text-[var(--warm-ink)] text-sm"
              >
                <option value="NOTE">Note</option>
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="MEETING">Meeting</option>
                <option value="TASK">Task</option>
              </select>
            </div>

            <Input label="Title" placeholder="e.g. Call regarding contract renewal" value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} required />
            <Input label="Description" placeholder="Details of conversation..." value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} />

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--warm-sand)]">
              <Button variant="ghost" onClick={() => setShowActivityModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showDealModal} onClose={() => setShowDealModal(false)} title="Create Deal">
          <form onSubmit={handleCreateDeal} className="space-y-4">
            <Input label="Deal Title" placeholder="e.g. Annual Maintenance Contract" value={dealForm.title} onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })} required />
            <Input label="Value ($)" type="number" placeholder="2500" value={dealForm.value} onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })} required />

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--warm-sand)]">
              <Button variant="ghost" onClick={() => setShowDealModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Create Deal</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Create Invoice">
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <Input label="Item Description" placeholder="e.g. Monthly Deep Cleaning Service" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} required />
            <Input label="Amount ($)" type="number" placeholder="450" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} required />
            <Input label="Due Date" type="date" value={invoiceForm.dateDue} onChange={(e) => setInvoiceForm({ ...invoiceForm, dateDue: e.target.value })} required />

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--warm-sand)]">
              <Button variant="ghost" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Generate Invoice</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showFileModal} onClose={() => setShowFileModal(false)} title="Attach Document">
          <form onSubmit={handleAddFile} className="space-y-4">
            <Input label="File Name" placeholder="e.g. Service_Agreement_2026.pdf" value={fileForm.fileName} onChange={(e) => setFileForm({ ...fileForm, fileName: e.target.value })} required />
            <Input label="File URL" placeholder="https://..." value={fileForm.fileUrl} onChange={(e) => setFileForm({ ...fileForm, fileUrl: e.target.value })} required />

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--warm-sand)]">
              <Button variant="ghost" onClick={() => setShowFileModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Attach File</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
