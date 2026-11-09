import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/property', label: 'Dashboard', icon: '📊', end: true },
  { path: '/property/tenants', label: 'Tenants', icon: '👥' },
  { path: '/property/leases', label: 'Leases', icon: '📝' },
  { path: '/property/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/property/financials', label: 'Financials', icon: '💰' },
];

const COLUMNS = ['OPEN', 'IN_PROGRESS', 'COMPLETED'];

export default function PropertyMaintenancePage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', priority: '', status: '' });
  const [dispatchModalTicket, setDispatchModalTicket] = useState<any | null>(null);
  const [contractorForm, setContractorForm] = useState({
    contractorName: '',
    contractorEmail: '',
    estimatedCost: '250',
    scopeOfWork: '',
    requireEscrow: true,
  });
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  useEffect(() => { loadRequests(); }, [filter.status]);

  const loadRequests = async () => {
    try {
      const query = filter.status ? `?status=${filter.status}` : '';
      const res = await api.get(`/property-manager/maintenance${query}`);
      setRequests(res.data?.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleDispatchContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalTicket) return;
    setDispatching(true);
    setDispatchSuccess(null);
    try {
      const res = await api.post(`/property-manager/maintenance/${dispatchModalTicket.id}/dispatch-contractor`, {
        contractorName: contractorForm.contractorName,
        contractorEmail: contractorForm.contractorEmail,
        estimatedCost: Number(contractorForm.estimatedCost),
        scopeOfWork: contractorForm.scopeOfWork || dispatchModalTicket.description,
        requireEscrow: contractorForm.requireEscrow,
      });
      if (res.data?.success) {
        setDispatchSuccess(`Dispatched to ContactOS Job #${res.data?.data?.job?.id?.slice(-6) || ''}. Escrow funds locked in contract.`);
        setTimeout(() => {
          setDispatchModalTicket(null);
          setDispatchSuccess(null);
          loadRequests();
        }, 1800);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to dispatch contractor');
    } finally {
      setDispatching(false);
    }
  };

  const handleCompleteTicket = async (ticketId: string) => {
    try {
      await api.patch(`/property-manager/maintenance/${ticketId}`, { status: 'COMPLETED' });
      loadRequests();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Could not complete ticket');
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p?.toUpperCase()) {
      case 'LOW': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--sky-wash)]/20 text-[var(--sky-wash)]">Low</span>;
      case 'MEDIUM': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)]">Medium</span>;
      case 'HIGH': return <span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-[var(--terracotta)]">High</span>;
      case 'URGENT': return <span className="px-2 py-0.5 text-xs rounded bg-[var(--terracotta)]/20 text-[var(--terracotta)]">Urgent</span>;
      default: return <span className="px-2 py-0.5 text-xs rounded bg-[var(--warm-sand)] text-[var(--soft-stone)]">{p}</span>;
    }
  };

  const getColumnRequests = (status: string) => requests.filter((r: any) => r.status === status);

  return (
    <DashboardLayout osName="PropertyOS" osIcon="H" osColor="emerald" navItems={navItems}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--warm-ink)]">Maintenance & Contractor Dispatch</h1>
            <p className="text-xs text-[var(--soft-stone)]">Automated ContactOS dispatch with milestone escrow protection</p>
          </div>
          <button className="px-3 py-1.5 bg-[var(--sage)] text-[var(--warm-ink)] rounded-full text-sm font-semibold hover:opacity-90 transition">
            + New Request
          </button>
        </div>

        <div className="flex gap-2">
          <select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })} className="bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded-lg px-3 py-1.5 text-[var(--warm-ink)] text-sm">
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-4 border-[var(--sage)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <div key={col} className="bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[rgba(191,179,163,0.2)]">
                  <h3 className="text-[var(--warm-ink)] text-sm font-bold tracking-wide uppercase">{col.replace('_', ' ')}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--warm-sand)] text-[var(--warm-ink)]">{getColumnRequests(col).length}</span>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {getColumnRequests(col).map((r: any) => (
                    <div key={r.id} className="bg-[var(--warm-sand)]/60 hover:bg-[var(--warm-sand)] rounded-xl p-3.5 border border-[rgba(191,179,163,0.35)] transition">
                      <div className="flex justify-between items-start mb-1.5">
                        <p className="text-[var(--warm-ink)] text-sm font-semibold">{r.title}</p>
                        {getPriorityBadge(r.priority)}
                      </div>
                      <p className="text-[var(--soft-stone)] text-xs font-medium">{r.property?.title || 'Main Property'}</p>
                      {r.description && (
                        <p className="text-[var(--soft-stone)] text-xs mt-1 line-clamp-2">{r.description}</p>
                      )}

                      {/* Vendor & Escrow Badges */}
                      {r.vendor && (
                        <div className="mt-2.5 pt-2 border-t border-[rgba(191,179,163,0.25)] flex items-center justify-between text-[11px]">
                          <span className="text-[var(--warm-ink)] font-medium">👷 {r.vendor}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[var(--sage)]/25 text-[var(--warm-ink)] font-semibold">🔒 Escrow Active</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="mt-3 pt-2 border-t border-[rgba(191,179,163,0.25)] flex items-center gap-2">
                        {r.status === 'OPEN' && (
                          <button
                            onClick={() => {
                              setDispatchModalTicket(r);
                              setContractorForm({
                                contractorName: '',
                                contractorEmail: '',
                                estimatedCost: r.cost ? String(r.cost) : '250',
                                scopeOfWork: r.description || '',
                                requireEscrow: true,
                              });
                            }}
                            className="w-full py-1.5 px-3 rounded-lg bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <span>⚡ Dispatch Contractor &amp; Escrow</span>
                          </button>
                        )}
                        {r.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleCompleteTicket(r.id)}
                            className="w-full py-1.5 px-3 rounded-lg bg-[var(--sage)] hover:opacity-90 text-[var(--warm-ink)] text-xs font-semibold transition text-center"
                          >
                            ✓ Release Escrow &amp; Resolve
                          </button>
                        )}
                        {r.status === 'COMPLETED' && (
                          <span className="text-[11px] font-semibold text-[var(--sage)] flex items-center gap-1">
                            ✓ Resolved &amp; Escrow Settled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {getColumnRequests(col).length === 0 && (
                    <div className="text-center py-6 text-xs text-[var(--soft-stone)]">No tickets in this column</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dispatch Contractor Modal */}
        {dispatchModalTicket && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(191,179,163,0.3)]">
                <div>
                  <h3 className="font-bold text-lg text-[var(--warm-ink)]">Dispatch Contractor</h3>
                  <p className="text-xs text-[var(--soft-stone)]">Ticket: {dispatchModalTicket.title}</p>
                </div>
                <button
                  onClick={() => setDispatchModalTicket(null)}
                  className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {dispatchSuccess ? (
                <div className="p-4 rounded-xl bg-[var(--sage)]/20 border border-[var(--sage)] text-center space-y-2">
                  <p className="text-2xl">✅</p>
                  <p className="text-sm font-bold text-[var(--warm-ink)]">{dispatchSuccess}</p>
                </div>
              ) : (
                <form onSubmit={handleDispatchContractor} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Contractor / Trade Company</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Plumbing &amp; Electrical"
                      value={contractorForm.contractorName}
                      onChange={(e) => setContractorForm({ ...contractorForm, contractorName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-sm text-[var(--warm-ink)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Contractor Email (For Job Notice &amp; Escrow)</label>
                    <input
                      type="email"
                      placeholder="contractor@example.com"
                      value={contractorForm.contractorEmail}
                      onChange={(e) => setContractorForm({ ...contractorForm, contractorEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-sm text-[var(--warm-ink)] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Estimated Cost (USDC / USD)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={contractorForm.estimatedCost}
                        onChange={(e) => setContractorForm({ ...contractorForm, estimatedCost: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-sm text-[var(--warm-ink)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Escrow Lock</label>
                      <div className="pt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="escrowCheckbox"
                          checked={contractorForm.requireEscrow}
                          onChange={(e) => setContractorForm({ ...contractorForm, requireEscrow: e.target.checked })}
                          className="w-4 h-4 rounded text-[var(--clay)]"
                        />
                        <label htmlFor="escrowCheckbox" className="text-xs font-medium text-[var(--warm-ink)]">
                          Lock in Escrow
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Work Scope / Access Notes</label>
                    <textarea
                      rows={3}
                      value={contractorForm.scopeOfWork}
                      onChange={(e) => setContractorForm({ ...contractorForm, scopeOfWork: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-sm text-[var(--warm-ink)] focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDispatchModalTicket(null)}
                      className="px-4 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] text-sm font-semibold text-[var(--soft-stone)] hover:bg-[var(--warm-sand)] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={dispatching}
                      className="px-5 py-2 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-sm font-bold shadow-md transition disabled:opacity-60"
                    >
                      {dispatching ? 'Dispatching…' : 'Dispatch & Lock Escrow'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
