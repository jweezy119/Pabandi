import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button, ClaySkeletonCard, Modal } from '../../components/primitives';
import { InvoiceList, InvoiceListRow } from './components/InvoiceList';
import { InvoiceFormModal } from './components/InvoiceFormModal';
import { getAuthToken } from '../../utils/authToken';
import { withBusinessId } from '../../utils/businessContext';
import DashboardLayout, { type NavItem } from '../../components/DashboardLayout';
import { Breadcrumbs } from '../../components/Breadcrumbs';
import { crmService } from '../../services/api';

const CRM_API = `${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/crm`;

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CRM_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

type InvoiceData = {
  id: string;
  number: string;
  client: { name: string; reliabilityScore?: number; paymentScore?: number } | null;
  subtotal: number;
  status: string;
  dateDue: string;
};

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>('invoices');
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);

  // Quote Form State
  const [quoteForm, setQuoteForm] = useState({
    clientId: '',
    clientName: '',
    clientEmail: '',
    title: '',
    description: '',
    totalAmount: '1200',
    currency: 'USDC',
    depositPercentage: 30,
    milestones: [
      { title: 'Phase 1: Mobilization & Materials Deposit', amount: 360, description: 'Initial lock to secure schedule and procure materials' },
      { title: 'Phase 2: Rough-in & Midpoint Delivery', amount: 420, description: 'Core work inspection and verification' },
      { title: 'Phase 3: Final Walkthrough & Handover', amount: 420, description: 'Client acceptance and Sulha signoff' },
    ],
  });
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [quoteCreatedUrl, setQuoteCreatedUrl] = useState<string | null>(null);

  // Draft deletion.
  const [pendingDelete, setPendingDelete] = useState<InvoiceListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('status') || 'all';
  const businessId = useAuthStore((s) => (s.user as { businessId?: string } | undefined)?.businessId);

  const setFilter = useCallback((next: string) => {
    setSearchParams(next === 'all' ? {} : { status: next }, { replace: true });
  }, [setSearchParams]);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (search) params.append('search', search);
      if (businessId) params.append('businessId', businessId);
      
      const data = await api(`/invoices?${params.toString()}`);
      setInvoices(data.data || []);
    } finally { setLoading(false); }
  }, [filter, search, businessId]);

  const loadQuotes = useCallback(async () => {
    try {
      setLoadingQuotes(true);
      const res = await crmService.getQuotes();
      setQuotes(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load quotes:', e);
    } finally {
      setLoadingQuotes(false);
    }
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);
  useEffect(() => { api('/clients').then(d => setClients(d.data || [])).catch(() => {}); }, []);
  useEffect(() => { if (activeTab === 'quotes') loadQuotes(); }, [activeTab, loadQuotes]);

  const handleCreateMilestoneQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingQuote(true);
    try {
      const total = Number(quoteForm.totalAmount) || 1000;
      const res = await crmService.createQuote({
        clientId: quoteForm.clientId || undefined,
        title: quoteForm.title,
        description: quoteForm.description,
        totalAmount: total,
        currency: quoteForm.currency,
        depositPercentage: quoteForm.depositPercentage,
        milestones: quoteForm.milestones.map((m, idx) => ({
          title: m.title,
          amount: Number(m.amount) || Math.round(total / quoteForm.milestones.length),
          description: m.description,
          order: idx + 1,
        })),
      });

      if (res.data?.success) {
        const quoteRef = res.data.data?.quote?.quoteRef || res.data.data?.escrow?.referenceId || '';
        const fullUrl = `https://pabandi.com/p/estimate/${quoteRef}`;
        setQuoteCreatedUrl(fullUrl);
        loadQuotes();
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to create milestone quote');
    } finally {
      setCreatingQuote(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuoteId(id);
    setTimeout(() => setCopiedQuoteId(null), 2000);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/invoices/${pendingDelete.id}?${withBusinessId()}`, { method: 'DELETE' });
      setPendingDelete(null);
      await loadInvoices();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the invoice');
    } finally {
      setDeleting(false);
    }
  };

  const CONTACT_OS_NAV = [
    { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
    { path: '/contact/clients', label: 'Verified Clients', icon: 'verified_user' },
    { path: '/contact/deals', label: 'Guaranteed Bookings', icon: 'workspace_premium' },
    { path: '/contact/jobs', label: 'Jobs', icon: 'work' },
    { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
    { path: '/contact/tasks', label: 'Tasks', icon: 'check' },
    { path: '/contact/invoices', label: 'Escrow & Payments', icon: 'lock' },
    { path: '/contact/money-flow', label: 'Money Flow', icon: 'account_balance_wallet' },
    { path: '/contact/team', label: 'Team', icon: 'users' },
    { path: '/business-os', label: 'Workspace', icon: 'grid_view' },
    { path: '/contact/settings/modules', label: 'Settings', icon: 'settings' },
  ] as NavItem[];

  if (loading && activeTab === 'invoices') {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={CONTACT_OS_NAV}>
        <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-8">
          <ClaySkeletonCard />
          <ClaySkeletonCard />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={CONTACT_OS_NAV}>
      <Breadcrumbs items={[{ label: 'Escrow & Payments', path: '/contact/invoices' }]} />
      <div className="px-6 py-8 space-y-6 clay-fade">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 clay-heading">
          <div>
            <h2 className="text-xl font-bold text-[var(--warm-ink)]">Escrow &amp; Payments Hub</h2>
            <p className="text-xs text-[var(--soft-stone)]">Dynamic multi-phase milestone quotes and verified invoices with programmable escrow</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'invoices' ? (
              <Button onClick={() => setShowCreate(true)} icon="add">
                New Invoice
              </Button>
            ) : (
              <Button onClick={() => { setShowCreateQuote(true); setQuoteCreatedUrl(null); }} icon="add">
                + New Milestone Quote
              </Button>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 border-b border-[rgba(191,179,163,0.3)] pb-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'invoices'
                ? 'bg-[var(--clay)] text-[var(--warm-ink)] shadow-sm'
                : 'bg-[var(--warm-sand)]/60 text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'
            }`}
          >
            📋 Traditional Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('quotes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === 'quotes'
                ? 'bg-[var(--clay)] text-[var(--warm-ink)] shadow-sm'
                : 'bg-[var(--warm-sand)]/60 text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'
            }`}
          >
            <span>🔒 Dynamic Milestone Quotes (Escrow)</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--sage)]/30 text-[10px] font-bold text-[var(--warm-ink)]">
              {quotes.length}
            </span>
          </button>
        </div>

        {/* TAB 1: Invoices */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="flex flex-wrap gap-2">
                {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`clay-filter-chip px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                    filter === f ? 'clay-filter-chip--active' : 'clay-filter-chip--inactive'
                  }`}>{f}</button>
                ))}
              </div>
            
              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  placeholder="Search by invoice number..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-white text-sm"
                />
              </div>
            </div>

            {invoices.length === 0 ? (
              <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-white p-12 text-center clay-scale-in">
                <p className="text-[var(--soft-stone)]">No invoices yet. <button onClick={() => setShowCreate(true)} className="text-[var(--clay)] hover:underline font-semibold">Create your first invoice</button></p>
              </div>
            ) : (
              <InvoiceList
                invoices={invoices}
                deletingId={deleting ? pendingDelete?.id ?? null : null}
                onDelete={(invoice) => { setDeleteError(null); setPendingDelete(invoice); }}
              />
            )}
          </div>
        )}

        {/* TAB 2: Dynamic Milestone Quotes (Escrow) */}
        {activeTab === 'quotes' && (
          <div className="space-y-4">
            {loadingQuotes ? (
              <div className="p-8 text-center text-[var(--soft-stone)]">Loading milestone quotes...</div>
            ) : quotes.length === 0 ? (
              <div className="rounded-2xl border border-[rgba(191,179,163,0.3)] bg-white p-12 text-center clay-scale-in space-y-3">
                <p className="text-3xl">🛡️</p>
                <h3 className="text-base font-bold text-[var(--warm-ink)]">No Milestone Quotes Created Yet</h3>
                <p className="text-xs text-[var(--soft-stone)] max-w-md mx-auto">
                  Protect both your business and clients. Create multi-phase milestone quotes where client deposit is secured in Solana escrow and released as you deliver each phase.
                </p>
                <button
                  onClick={() => setShowCreateQuote(true)}
                  className="px-5 py-2.5 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-bold transition shadow-sm"
                >
                  Create First Milestone Quote
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((q: any) => {
                  const shareUrl = `https://pabandi.com/p/estimate/${q.quoteRef || q.referenceId || q.id}`;
                  const isCopied = copiedQuoteId === q.id;
                  return (
                    <div key={q.id} className="rounded-2xl border border-[rgba(191,179,163,0.35)] bg-white p-5 hover:border-[var(--clay)] transition shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[rgba(191,179,163,0.25)]">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-[var(--warm-ink)]">{q.title || 'Service Milestone Quote'}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--sage)]/25 text-[var(--warm-ink)]">
                              🔒 Escrow Protected
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--warm-sand)] text-[var(--warm-ink)]">
                              {q.status || 'PENDING_ACCEPTANCE'}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--soft-stone)] mt-0.5">
                            Client: <span className="font-semibold text-[var(--warm-ink)]">{q.client?.name || q.clientName || 'Valued Client'}</span> • Currency: <span className="font-semibold text-[var(--warm-ink)]">{q.currency || 'USDC'}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-center">
                          <div className="text-right">
                            <p className="text-lg font-black text-[var(--warm-ink)]">${Number(q.totalAmount || 0).toLocaleString()}</p>
                            <p className="text-[10px] text-[var(--soft-stone)]">Ref: {q.quoteRef || q.id?.slice(-8)}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(shareUrl, q.id)}
                            className="px-3 py-1.5 rounded-xl border border-[rgba(191,179,163,0.4)] hover:bg-[var(--warm-sand)] text-xs font-bold text-[var(--warm-ink)] transition flex items-center gap-1.5"
                          >
                            <span>{isCopied ? '✓ Copied!' : '🔗 Copy Client Link'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Milestones chips */}
                      {Array.isArray(q.milestones) && q.milestones.length > 0 && (
                        <div className="pt-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--soft-stone)] mb-2">Milestone Phases:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {q.milestones.map((m: any, idx: number) => (
                              <div key={idx} className="p-2.5 rounded-xl bg-[var(--warm-sand)]/40 border border-[rgba(191,179,163,0.25)] text-xs">
                                <div className="flex items-center justify-between font-semibold text-[var(--warm-ink)]">
                                  <span>{m.title}</span>
                                  <span>${Number(m.amount).toLocaleString()}</span>
                                </div>
                                {m.description && <p className="text-[10px] text-[var(--soft-stone)] mt-0.5 truncate">{m.description}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal: New Traditional Invoice */}
        {showCreate && (
          <InvoiceFormModal
            clients={clients}
            businessId={businessId || undefined}
            onClose={() => setShowCreate(false)}
            onSave={() => { setShowCreate(false); loadInvoices(); }}
          />
        )}

        {/* Modal: New Milestone Quote */}
        {showCreateQuote && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(191,179,163,0.3)]">
                <div>
                  <h3 className="font-bold text-lg text-[var(--warm-ink)]">Create Dynamic Milestone Quote</h3>
                  <p className="text-xs text-[var(--soft-stone)]">Multi-phase proposal with 1-click programmable escrow initialization</p>
                </div>
                <button onClick={() => setShowCreateQuote(false)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] text-lg font-bold">✕</button>
              </div>

              {quoteCreatedUrl ? (
                <div className="p-6 rounded-2xl bg-[var(--sage)]/20 border border-[var(--sage)] text-center space-y-3">
                  <p className="text-3xl">🎉</p>
                  <h4 className="font-bold text-base text-[var(--warm-ink)]">Milestone Quote &amp; Escrow Initialized!</h4>
                  <p className="text-xs text-[var(--soft-stone)]">Send this shareable proposal link to your client to review milestones and lock escrow deposit:</p>
                  <div className="p-2.5 rounded-xl bg-white border border-[rgba(191,179,163,0.4)] text-xs font-mono break-all text-[var(--warm-ink)] select-all">
                    {quoteCreatedUrl}
                  </div>
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={() => copyToClipboard(quoteCreatedUrl, 'created_link')}
                      className="px-4 py-2 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] font-bold text-xs shadow-sm transition"
                    >
                      {copiedQuoteId === 'created_link' ? '✓ Link Copied!' : 'Copy Link to Clipboard'}
                    </button>
                    <button
                      onClick={() => { setShowCreateQuote(false); setQuoteCreatedUrl(null); }}
                      className="px-4 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] font-bold text-xs hover:bg-[var(--warm-sand)] transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateMilestoneQuote} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Select Client</label>
                    <select
                      value={quoteForm.clientId}
                      onChange={(e) => {
                        const sel = clients.find(c => c.id === e.target.value);
                        setQuoteForm({
                          ...quoteForm,
                          clientId: e.target.value,
                          clientName: sel?.name || '',
                          clientEmail: sel?.email || '',
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-sm text-[var(--warm-ink)] focus:outline-none"
                    >
                      <option value="">-- Choose verified client or enter manual --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.email || 'No email'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Project / Quote Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Commercial HVAC Replacement &amp; Duct Overhaul"
                      value={quoteForm.title}
                      onChange={(e) => setQuoteForm({ ...quoteForm, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-sm text-[var(--warm-ink)] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Total Project Budget</label>
                      <input
                        type="number"
                        min="10"
                        required
                        value={quoteForm.totalAmount}
                        onChange={(e) => {
                          const tot = Number(e.target.value) || 0;
                          const dep = Math.round(tot * (quoteForm.depositPercentage / 100));
                          const rem = Math.round((tot - dep) / 2);
                          setQuoteForm({
                            ...quoteForm,
                            totalAmount: e.target.value,
                            milestones: [
                              { ...quoteForm.milestones[0], amount: dep },
                              { ...quoteForm.milestones[1], amount: rem },
                              { ...quoteForm.milestones[2], amount: tot - dep - rem },
                            ],
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-sm text-[var(--warm-ink)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Settlement Currency</label>
                      <select
                        value={quoteForm.currency}
                        onChange={(e) => setQuoteForm({ ...quoteForm, currency: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-sm text-[var(--warm-ink)] focus:outline-none"
                      >
                        <option value="USDC">USDC (Solana Escrow)</option>
                        <option value="USD">USD (Square / Card)</option>
                        <option value="PAB">PAB (Governance Token)</option>
                      </select>
                    </div>
                  </div>

                  {/* Milestone breakdown configuration */}
                  <div>
                    <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Dynamic Milestones (Escrow Phases)</label>
                    <div className="space-y-2">
                      {quoteForm.milestones.map((m, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-[var(--warm-sand)]/50 border border-[rgba(191,179,163,0.3)] space-y-1.5">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={m.title}
                              onChange={(e) => {
                                const newM = [...quoteForm.milestones];
                                newM[idx].title = e.target.value;
                                setQuoteForm({ ...quoteForm, milestones: newM });
                              }}
                              className="flex-1 px-2.5 py-1 rounded-lg border border-[rgba(191,179,163,0.4)] bg-white text-xs font-semibold text-[var(--warm-ink)]"
                            />
                            <div className="w-24">
                              <input
                                type="number"
                                value={m.amount}
                                onChange={(e) => {
                                  const newM = [...quoteForm.milestones];
                                  newM[idx].amount = Number(e.target.value);
                                  setQuoteForm({ ...quoteForm, milestones: newM });
                                }}
                                className="w-full px-2.5 py-1 rounded-lg border border-[rgba(191,179,163,0.4)] bg-white text-xs font-bold text-[var(--warm-ink)] text-right"
                              />
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Deliverable condition for release..."
                            value={m.description}
                            onChange={(e) => {
                              const newM = [...quoteForm.milestones];
                              newM[idx].description = e.target.value;
                              setQuoteForm({ ...quoteForm, milestones: newM });
                            }}
                            className="w-full px-2.5 py-1 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white text-[11px] text-[var(--soft-stone)]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateQuote(false)}
                      className="px-4 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] text-xs font-semibold text-[var(--soft-stone)] hover:bg-[var(--warm-sand)] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingQuote}
                      className="px-5 py-2.5 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-bold shadow-md transition disabled:opacity-60"
                    >
                      {creatingQuote ? 'Initializing Escrow…' : 'Generate Quote & Initialize Escrow'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal: Delete Draft */}
        <Modal
          isOpen={!!pendingDelete}
          onClose={() => { if (!deleting) { setPendingDelete(null); setDeleteError(null); } }}
          title="Delete draft invoice?"
          actionText={deleting ? 'Deleting…' : 'Delete'}
          actionVariant="danger"
          onAction={confirmDelete}
        >
          <p className="text-[var(--soft-stone)] mb-4 text-sm">
            <strong style={{ color: 'var(--warm-ink)' }}>{pendingDelete?.number}</strong> for{' '}
            ${pendingDelete?.subtotal?.toLocaleString() ?? 0} will be removed. This cannot be undone.
          </p>
          <p className="text-[var(--soft-stone)] mb-4 text-sm">
            Only drafts can be deleted. Once an invoice has been sent it stays on the record.
          </p>
          {deleteError && (
            <div className="clay-alert clay-alert--critical">
              <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{deleteError}</p>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
