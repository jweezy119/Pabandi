import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Card } from '../../components/primitives/Card';
import { Button } from '../../components/primitives/Button';
import { Chip } from '../../components/primitives/Chip';
import { Input } from '../../components/primitives/Input';
import { Modal } from '../../components/primitives/Modal';
import { EmptyState } from '../../components/primitives/EmptyState';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/jobs', label: 'Jobs', icon: 'work' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
  { path: '/contact/settings/modules', label: 'Settings', icon: 'settings' },
];

const STAGES = [
  { id: 'LEAD', label: 'Lead', color: '#8A9A7B', probability: 10 },
  { id: 'QUALIFIED', label: 'Qualified', color: '#D9A854', probability: 30 },
  { id: 'PROPOSAL', label: 'Proposal', color: '#C97B5A', probability: 60 },
  { id: 'NEGOTIATION', label: 'Negotiation', color: '#B26B4C', probability: 80 },
  { id: 'WON', label: 'Closed Won', color: '#5C7A54', probability: 100 },
  { id: 'LOST', label: 'Closed Lost', color: '#A85A5A', probability: 0 },
];

export default function ContactDealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [selectedDealForLost, setSelectedDealForLost] = useState<any>(null);
  const [lostReason, setLostReason] = useState('');

  // New Deal Form State
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    stage: 'LEAD',
    clientId: '',
    probability: '10',
    expectedCloseDate: '',
    notes: '',
  });

  useEffect(() => {
    fetchDealsAndClients();
  }, []);

  async function fetchDealsAndClients() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const [dealsRes, clientsRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/crm/deals`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/clients`, { headers }),
      ]);

      if (dealsRes.ok) {
        const dData = await dealsRes.json();
        setDeals(dData.data || []);
      }
      if (clientsRes.ok) {
        const cData = await clientsRes.json();
        setClients(cData.data || []);
      }
    } catch (err) {
      console.error('Failed to load deals or clients:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDeal(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const res = await fetch(`${baseUrl}/api/v1/crm/deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          value: parseFloat(formData.value) || 0,
          stage: formData.stage,
          probability: parseInt(formData.probability, 10) || 10,
          clientId: formData.clientId || undefined,
          expectedCloseDate: formData.expectedCloseDate || undefined,
          notes: formData.notes,
        }),
      });

      if (res.ok) {
        setIsCreateOpen(false);
        setFormData({ title: '', value: '', stage: 'LEAD', clientId: '', probability: '10', expectedCloseDate: '', notes: '' });
        fetchDealsAndClients();
      }
    } catch (err) {
      console.error('Failed to create deal:', err);
    }
  }

  async function handleUpdateStage(dealId: string, newStage: string) {
    if (newStage === 'LOST') {
      const deal = deals.find(d => d.id === dealId);
      setSelectedDealForLost(deal);
      setIsLostModalOpen(true);
      return;
    }

    await submitStageUpdate(dealId, newStage);
  }

  async function submitStageUpdate(dealId: string, stage: string, reason?: string) {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const probMap: Record<string, number> = { LEAD: 10, QUALIFIED: 30, PROPOSAL: 60, NEGOTIATION: 80, WON: 100, LOST: 0 };

      const res = await fetch(`${baseUrl}/api/v1/crm/deals/${dealId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage,
          probability: probMap[stage] ?? 10,
          ...(reason ? { lostReason: reason } : {}),
        }),
      });

      if (res.ok) {
        fetchDealsAndClients();
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  }

  function handleLostReasonSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDealForLost) {
      submitStageUpdate(selectedDealForLost.id, 'LOST', lostReason);
      setIsLostModalOpen(false);
      setSelectedDealForLost(null);
      setLostReason('');
    }
  }

  const getDealsByStage = (stageId: string) => deals.filter(d => d.stage === stageId);

  // Compute total pipeline value and weighted value
  const totalPipelineValue = deals.reduce((acc, d) => acc + (d.value || 0), 0);
  const weightedPipelineValue = deals.reduce((acc, d) => acc + ((d.value || 0) * ((d.probability || 0) / 100)), 0);

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 clay-heading">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Deals Pipeline</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">
              Manage opportunities, forecast revenue, and track stage conversion.
            </p>
          </div>
          <Button variant="primary" icon="add" onClick={() => setIsCreateOpen(true)}>
            New Deal
          </Button>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="flat" padding="sm" className="flex items-center gap-4 clay-rise">
            <div className="w-10 h-10 rounded-xl bg-[var(--warm-sand)] flex items-center justify-center text-[var(--clay)]">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div>
              <div className="text-xs text-[var(--soft-stone)] font-label">Total Pipeline Value</div>
              <div className="text-xl font-bold text-[var(--warm-ink)]">${totalPipelineValue.toLocaleString()}</div>
            </div>
          </Card>

          <Card variant="flat" padding="sm" className="flex items-center gap-4 clay-rise clay-delay-1">
            <div className="w-10 h-10 rounded-xl bg-[var(--sage)]/20 flex items-center justify-center text-[var(--sage)]">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
            <div>
              <div className="text-xs text-[var(--soft-stone)] font-label">Weighted Forecast</div>
              <div className="text-xl font-bold text-[var(--warm-ink)]">${Math.round(weightedPipelineValue).toLocaleString()}</div>
            </div>
          </Card>

          <Card variant="flat" padding="sm" className="flex items-center gap-4 clay-rise clay-delay-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--ochre)]/20 flex items-center justify-center text-[var(--ochre)]">
              <span className="material-symbols-outlined">bar_chart</span>
            </div>
            <div>
              <div className="text-xs text-[var(--soft-stone)] font-label">Active Deals</div>
              <div className="text-xl font-bold text-[var(--warm-ink)]">{deals.filter(d => d.stage !== 'WON' && d.stage !== 'LOST').length}</div>
            </div>
          </Card>
        </div>

        {/* Kanban Board View */}
        {loading ? (
          <div className="p-12 text-center text-[var(--soft-stone)]">Loading pipeline...</div>
        ) : deals.length === 0 ? (
          <EmptyState
            icon="handshake"
            title="No Deals in Pipeline"
            description="Create your first deal opportunity to start forecasting pipeline revenue and tracking sales conversions."
            actionLabel="Create First Deal"
            onAction={() => setIsCreateOpen(true)}
          />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6 mobile-scroll">
            {STAGES.map(stage => {
              const stageDeals = getDealsByStage(stage.id);
              const stageTotal = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

              return (
                <div key={stage.id} className="min-w-[280px] w-[280px] flex-shrink-0 clay-kanban-column rounded-2xl p-3 flex flex-col h-[calc(100vh-280px)] min-h-[500px] clay-rise">
                  {/* Stage Header */}
                  <div className="flex justify-between items-center mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <h3 className="font-bold text-sm text-[var(--warm-ink)] font-label">{stage.label}</h3>
                      <span className="text-xs bg-white px-2 py-0.5 rounded-full text-[var(--soft-stone)] font-medium shadow-xs">
                        {stageDeals.length}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[var(--warm-ink)]">
                      ${stageTotal.toLocaleString()}
                    </span>
                  </div>

                  {/* Stage Deals List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                    {stageDeals.map(deal => (
                      <Card key={deal.id} variant="default" padding="sm" hover className="border border-[var(--warm-sand)] hover:border-[var(--clay)] transition-all clay-card--interactive">
                        <div className="flex justify-between items-start mb-1.5">
                          <h4 className="font-semibold text-sm text-[var(--warm-ink)] line-clamp-1">{deal.title}</h4>
                          <span className="text-xs font-bold text-[var(--clay)]">${(deal.value || 0).toLocaleString()}</span>
                        </div>

                        {deal.client && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--soft-stone)] mb-2">
                            <span className="material-symbols-outlined text-[14px]">person</span>
                            <span className="line-clamp-1">{deal.client.name}</span>
                          </div>
                        )}

                        {deal.lostReason && (
                          <div className="text-[11px] text-[var(--rose)] bg-[var(--rose)]/10 p-1.5 rounded-lg mb-2">
                            <strong>Reason:</strong> {deal.lostReason}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--warm-sand)]/40 text-[11px] text-[var(--soft-stone)]">
                          <span>Prob: {deal.probability}%</span>

                          {/* Quick Move Dropdown */}
                          <select
                            value={deal.stage}
                            onChange={(e) => handleUpdateStage(deal.id, e.target.value)}
                            className="text-[11px] bg-white text-[var(--warm-ink)] border border-[var(--warm-sand)] rounded-lg px-1.5 py-0.5 outline-none cursor-pointer hover:border-[var(--clay)]"
                          >
                            {STAGES.map(s => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Deal Modal */}
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Deal">
          <form onSubmit={handleCreateDeal} className="space-y-4">
            <Input
              label="Deal Title"
              placeholder="e.g. Commercial Office Cleaning Contract"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Value ($)"
                type="number"
                placeholder="1200"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                required
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--warm-ink)]">Stage</label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]"
                >
                  {STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--warm-ink)]">Associated Client</label>
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]"
              >
                <option value="">-- Select Client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Win Probability (%)"
                type="number"
                min="0"
                max="100"
                value={formData.probability}
                onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
              />

              <Input
                label="Expected Close Date"
                type="date"
                value={formData.expectedCloseDate}
                onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--warm-ink)]">Notes & Context</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Key requirements, budget constraints, timeline..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] text-[var(--warm-ink)] text-sm focus:outline-none focus:border-[var(--clay)]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--warm-sand)]">
              <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Create Deal</Button>
            </div>
          </form>
        </Modal>

        {/* Lost Reason Modal */}
        <Modal isOpen={isLostModalOpen} onClose={() => setIsLostModalOpen(false)} title="Close Deal as Lost">
          <form onSubmit={handleLostReasonSubmit} className="space-y-4">
            <p className="text-sm text-[var(--soft-stone)]">
              Please provide a reason for closing deal <strong>"{selectedDealForLost?.title}"</strong> as lost.
            </p>

            <Input
              label="Lost Reason"
              placeholder="e.g. Competitor priced lower, Client budget cut, Scope mismatch..."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--warm-sand)]">
              <Button variant="ghost" onClick={() => setIsLostModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="danger">Mark as Lost</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
