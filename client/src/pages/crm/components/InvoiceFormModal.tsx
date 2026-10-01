import { useState, useEffect, useCallback } from 'react';
import { FiX } from 'react-icons/fi';
import { Button } from '../../../components/primitives';
import { getAuthToken } from '../../../utils/authToken';

type Client = { id: string; name: string; passportId?: string; paymentScore?: number };
type Job = { id: string; clientId: string; serviceType?: string; price?: number; scheduledDate?: string };

type TermsRecommendation = {
  tier: 'net_30' | 'immediate' | 'deposit_escrow';
  label: string;
  dueInDays: number;
  requireEscrow: boolean;
  reason: string;
  paymentScore: number;
};

type TermsView = {
  recommendation: TermsRecommendation;
  suggestedDueDate: string;
  railReasoning: string | null;
  clientCountry: string | null;
  defaulted: boolean;
};

const CRM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;

export function InvoiceFormModal({ onClose, onSave, clients, businessId }: { onClose: () => void; onSave: () => void; clients: Client[]; businessId?: string }) {
  const [selectedClient, setSelectedClient] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [requireEscrow, setRequireEscrow] = useState(false);

  // Terms recommendation
  const [terms, setTerms] = useState<TermsView | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(true);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedClient) return;
    const fetchJobs = async () => {
      try {
        const res = await fetch(`${CRM_API}/jobs?status=COMPLETED`, {
          headers: { Authorization: `Bearer ${getAuthToken() || ''}` }
        });
        const d = await res.json();
        const clientJobs = (d.data || []).filter((j: Job) => j.clientId === selectedClient);
        setJobs(clientJobs);
      } catch (err) {}
    };
    fetchJobs();
  }, [selectedClient]);

  const subtotal = jobs.reduce((s, j) => s + (j.price || 0), 0);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);


  /**
   * Fetch the trust-adjusted terms recommendation whenever the client or the
   * invoice total changes, since ticket size feeds the rail router.
   */
  const loadTerms = useCallback(async () => {
    if (!selectedClient) {
      setTerms(null);
      return;
    }
    setTermsLoading(true);
    setTermsError(null);
    try {
      const params = new URLSearchParams({ clientId: selectedClient, amount: String(subtotal) });
      if (businessId) params.set('businessId', businessId);
      const res = await fetch(`${CRM_API}/invoices/terms-recommendation?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      if (!res.ok) throw new Error('Recommendation unavailable');
      const d = await res.json();
      const view = d.data as TermsView | undefined;
      setTerms(view ?? null);
      if (view) {
        setRequireEscrow(view.recommendation.requireEscrow);
        setAcceptedTerms(true);
        setShowOverride(false);
        setOverrideReason('');
      }
    } catch {
      setTerms(null);
      // A missing recommendation must not block invoicing. The business can
      // still create and send; they just get no trust-based advice.
      setTermsError('Could not load a terms recommendation for this client.');
    } finally {
      setTermsLoading(false);
    }
  }, [selectedClient, subtotal, businessId]);

  useEffect(() => { loadTerms(); }, [loadTerms]);

  /** The due date actually used: the recommendation's, or manual entry. */
  const effectiveDueDate = useCallback((): string => {
    if (terms && acceptedTerms) {
      return new Date(terms.suggestedDueDate).toISOString();
    }
    return new Date(dateRange.to || lastDay).toISOString();
  }, [terms, acceptedTerms, dateRange.to, lastDay]);

  const handleSave = async (status: 'draft' | 'sent') => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        clientId: selectedClient,
        dateDue: effectiveDueDate(),
        lineItems: jobs.map(j => ({ date: j.scheduledDate, service: j.serviceType, price: j.price })),
        subtotal,
        notes,
        requireEscrow,
        ...(status === 'sent' && { status: 'sent' }),
      };

      if (terms) {
        payload.terms = {
          tier: terms.recommendation.tier,
          label: terms.recommendation.label,
          dueInDays: acceptedTerms ? terms.recommendation.dueInDays : 0,
        };
        if (!acceptedTerms) {
          payload.overrideReason = overrideReason.trim() || 'No reason given';
        }
      }

      await fetch(`${CRM_API}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` },
        body: JSON.stringify(payload),
      });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[var(--soft-stone)]/30 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 clay-heading">
          <h3 className="text-lg font-bold" style={{ color: 'var(--warm-ink)' }}>Create Invoice</h3>
          <button onClick={onClose} className="p-2 rounded-lg clay-card--interactive" style={{ backgroundColor: 'rgba(232, 217, 197, 0.3)', color: 'var(--soft-stone)' }}><FiX className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Client *</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm">
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {termsLoading && (
            <p className="text-xs" style={{ color: 'var(--soft-stone)' }}>Checking payment history...</p>
          )}

          {termsError && !termsLoading && (
            <div className="clay-alert clay-alert--info">
              <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{termsError}</p>
            </div>
          )}

          {terms && !termsLoading && (
            <div className="clay-alert clay-alert--info">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-px" style={{ color: 'var(--clay)' }} aria-hidden="true">
                  verified
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>
                    Recommended: {terms.recommendation.label} (based on client&apos;s {terms.recommendation.paymentScore} payment score)
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
                    {terms.recommendation.reason}
                  </p>
                  {terms.railReasoning && (
                    <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>{terms.railReasoning}</p>
                  )}
                  {terms.defaulted && (
                    <p className="text-xs mt-1 italic" style={{ color: 'var(--soft-stone)' }}>
                      This client has no payment history yet, so this is a default rather than a judgement.
                    </p>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      variant={acceptedTerms ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => { setAcceptedTerms(true); setShowOverride(false); }}
                    >
                      Accept
                    </Button>
                    <Button
                      variant={!acceptedTerms ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => { setAcceptedTerms(false); setShowOverride(true); }}
                    >
                      Override
                    </Button>
                  </div>

                  {showOverride && !acceptedTerms && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--soft-stone)' }}>
                        Why are you overriding? (logged to the audit trail)
                      </label>
                      <textarea
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        rows={2}
                        placeholder="e.g. Long-standing client, verbally agreed to net-60"
                        className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm"
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>
                        The invoice will still be created. The reason is recorded so this decision can be reviewed later.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">From</label>
              <input type="date" value={dateRange.from || firstDay.toISOString().split('T')[0]} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">To</label>
              <input
                type="date"
                value={terms && acceptedTerms ? new Date(terms.suggestedDueDate).toISOString().split('T')[0] : (dateRange.to || lastDay.toISOString().split('T')[0])}
                onChange={e => { setDateRange({ ...dateRange, to: e.target.value }); setAcceptedTerms(false); }}
                className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm"
              />
              {terms && acceptedTerms && (
                <p className="text-xs mt-1" style={{ color: 'var(--soft-stone)' }}>Set by the recommendation. Change the date to override.</p>
              )}
            </div>
          </div>

          {jobs.length > 0 && (
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-2">Line Items ({jobs.length} completed jobs)</label>
              <div className="space-y-2">
                {jobs.map(j => (
                  <div key={j.id} className="flex justify-between p-2 rounded-lg bg-[var(--warm-sand)] text-sm">
                    <span>{j.scheduledDate ? new Date(j.scheduledDate).toLocaleDateString() : ''} · {j.serviceType}</span>
                    <span className="font-medium">${j.price?.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between p-2 rounded-lg bg-[var(--soft-stone)]/20 font-bold text-sm">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm" placeholder="Optional notes..." />
          </div>

          {terms?.recommendation.requireEscrow && (
            <div className="clay-alert clay-alert--warning">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="escrowToggle"
                  checked={requireEscrow}
                  onChange={(e) => setRequireEscrow(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="escrowToggle" className="text-sm font-medium" style={{ color: 'var(--warm-ink)' }}>
                  Deposit required — hold funds in escrow. Recommended for this client&apos;s {terms.recommendation.paymentScore} payment score.
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => handleSave('draft')} disabled={saving || !selectedClient}>Save as Draft</Button>
            <Button variant="primary" onClick={() => handleSave('sent')} disabled={saving || !selectedClient}>Save & Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
