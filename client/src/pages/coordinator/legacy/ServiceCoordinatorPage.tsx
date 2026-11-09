/**
 * LEGACY — pre-redesign Service Coordinator page.
 *
 * This file is kept, not deleted, because Phases 2–5 rebuild its behaviour
 * (create-work-order form, assign dialog, completion flow, AI triage) inside
 * the new three-pane command surface. It is no longer routed: `/coordinator`
 * renders `../CoordinatorCommandSurface`.
 *
 * It is frozen reference material. Do not edit it to fix bugs in the new
 * surface, and delete it once the new surface reaches feature parity.
 */
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout, { type NavItem } from '../../../components/DashboardLayout';
import { Breadcrumbs } from '../../../components/Breadcrumbs';
import { coordinatorService } from '../../../services/api';

const COORDINATOR_NAV: NavItem[] = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard' },
  { path: '/coordinator', label: 'Service Coordinator', icon: 'precision_manufacturing', end: true },
  { path: '/contact/jobs', label: 'All Jobs', icon: 'work' },
  { path: '/contact/invoices', label: 'Escrow & Payments', icon: 'lock' },
  { path: '/contact/team', label: 'Technicians & Team', icon: 'groups' },
  { path: '/business-os', label: 'Workspace', icon: 'grid_view' },
];

export default function ServiceCoordinatorPage() {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<any | null>(null);
  const [showAiModal, setShowAiModal] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<any | null>(null);

  // AI Triage State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Form State: Create Work Order
  const [createForm, setCreateForm] = useState({
    customerId: '',
    issueType: 'Active Roof Leak',
    priority: 'EMERGENCY',
    description: '',
    address: '',
    accessNotes: 'Roof ladder at North loading dock. Hard hats & OSHA harness required.',
    scheduledFor: '',
  });
  const [creating, setCreating] = useState(false);

  // Form State: Quick Customer
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  // Form State: Completion
  const [completeNotes, setCompleteNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Assign Form State
  const [selectedTechId, setSelectedTechId] = useState('');
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [woRes, techRes, custRes] = await Promise.all([
        coordinatorService.getWorkOrders({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          search: search || undefined,
        }).catch(() => ({ data: { data: [] } })),
        coordinatorService.getTechnicians().catch(() => ({ data: { data: [] } })),
        coordinatorService.getCustomers().catch(() => ({ data: { data: [] } })),
      ]);
      setWorkOrders(woRes.data?.data || []);
      setTechnicians(techRes.data?.data || []);
      setCustomers(custRes.data?.data || []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Create Work Order
  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const idempotencyKey = `create_wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let targetCustomerId = createForm.customerId;

      // Create inline customer if needed
      if (showNewCustomer && customerForm.name) {
        const custRes = await coordinatorService.createCustomer(customerForm, `cust_${Date.now()}`);
        if (custRes.data?.data?.id) {
          targetCustomerId = custRes.data.data.id;
        }
      }

      if (!targetCustomerId) {
        alert('Please select or create a customer');
        setCreating(false);
        return;
      }

      await coordinatorService.createWorkOrder({
        customerId: targetCustomerId,
        issueType: createForm.issueType,
        priority: createForm.priority,
        description: createForm.description,
        address: createForm.address,
        accessNotes: createForm.accessNotes || undefined,
        scheduledFor: createForm.scheduledFor ? new Date(createForm.scheduledFor).toISOString() : undefined,
      }, idempotencyKey);

      setShowCreateModal(false);
      setCreateForm({
        customerId: '',
        issueType: 'Active Roof Leak',
        priority: 'EMERGENCY',
        description: '',
        address: '',
        accessNotes: 'Roof ladder at North loading dock. Hard hats & OSHA harness required.',
        scheduledFor: '',
      });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to create work order');
    } finally {
      setCreating(false);
    }
  };

  // Handle Run AI Triage
  const handleRunAiTriage = async (wo: any) => {
    setShowAiModal(wo);
    setAiLoading(true);
    setAiResult(null);
    setAiError(null);
    try {
      const res = await coordinatorService.runAiTriage(wo.id, {
        commercialBuildingType: 'Commercial Warehouse / Industrial',
        roofSystem: wo.issueType.includes('Metal') ? 'Standing Seam Metal' : 'TPO Single-Ply Membrane',
      });
      setAiResult(res.data?.data);
    } catch (err: any) {
      setAiError(err?.response?.data?.error || 'AI triage service encountered an error.');
    } finally {
      setAiLoading(false);
    }
  };

  // Handle Assign Technician
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal || !selectedTechId) return;
    setAssigning(true);
    try {
      const idempotencyKey = `assign_${showAssignModal.id}_${Date.now()}`;
      await coordinatorService.assignTechnician(showAssignModal.id, {
        technicianId: selectedTechId,
        notifyWhatsApp,
      }, idempotencyKey);

      setShowAssignModal(null);
      setSelectedTechId('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to assign technician');
    } finally {
      setAssigning(false);
    }
  };

  // Handle Complete Work Order
  const handleCompleteWorkOrder = async (workOrderId: string) => {
    if (!completeNotes.trim()) {
      alert('Please enter completion and verification notes');
      return;
    }
    setCompleting(true);
    try {
      const idempotencyKey = `comp_${workOrderId}_${Date.now()}`;
      await coordinatorService.completeWorkOrder(workOrderId, {
        completionNotes: completeNotes,
        readyForInvoice: true,
      }, idempotencyKey);

      setShowDetailModal(null);
      setCompleteNotes('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to complete work order');
    } finally {
      setCompleting(false);
    }
  };

  // Stats calculation
  const emergencyCount = workOrders.filter(w => w.priority === 'EMERGENCY' && w.status !== 'COMPLETED').length;
  const inProgressCount = workOrders.filter(w => ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'].includes(w.status)).length;
  const completedCount = workOrders.filter(w => w.status === 'COMPLETED').length;

  return (
    <DashboardLayout osName="Service Coordinator" osIcon="precision_manufacturing" osColor="clay" navItems={COORDINATOR_NAV}>
      <Breadcrumbs items={[{ label: 'Service Coordinator', path: '/coordinator' }]} />
      <div className="px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Service Coordinator</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--terracotta)]/15 text-[var(--terracotta)]">
                Commercial Roofing &amp; MEP
              </span>
            </div>
            <p className="text-xs text-[var(--soft-stone)] mt-0.5">
              AI-assisted dispatch, skill matching, immutable audits, and Raast escrow work orders
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <span>+ New Commercial Work Order</span>
          </button>
        </div>

        {/* Operational Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.35)] shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">Active Work Orders</p>
            <p className="text-2xl font-black text-[var(--warm-ink)] mt-1">{workOrders.length}</p>
            <p className="text-[11px] text-[var(--soft-stone)] mt-0.5">{technicians.length} certified technicians</p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--terracotta)]/10 border border-[var(--terracotta)]/30 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">Emergency Leaks</p>
            <p className="text-2xl font-black text-[var(--terracotta)] mt-1">{emergencyCount}</p>
            <p className="text-[11px] text-[var(--soft-stone)] mt-0.5">Water intrusion / high risk</p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--sage)]/10 border border-[var(--sage)]/30 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--warm-ink)]">Dispatched / En Route</p>
            <p className="text-2xl font-black text-[var(--sage)] mt-1">{inProgressCount}</p>
            <p className="text-[11px] text-[var(--soft-stone)] mt-0.5">WhatsApp utility alerts active</p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.35)] shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">Completed &amp; Escrow Ready</p>
            <p className="text-2xl font-black text-[var(--warm-ink)] mt-1">{completedCount}</p>
            <p className="text-[11px] text-[var(--sage)] font-semibold mt-0.5">Raast / USDC Ready</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center border-b border-[rgba(191,179,163,0.3)] pb-3">
          <div className="flex flex-wrap gap-1.5">
            {['all', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide transition ${
                  statusFilter === s
                    ? 'bg-[var(--clay)] text-[var(--warm-ink)] shadow-sm'
                    : 'bg-[var(--warm-sand)]/60 text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--cream)] text-xs text-[var(--warm-ink)] font-semibold"
            >
              <option value="all">All Priorities</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="URGENT">Urgent</option>
              <option value="ROUTINE">Routine</option>
            </select>
            <input
              type="text"
              placeholder="Search address or issue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--cream)] text-xs text-[var(--warm-ink)] w-48"
            />
          </div>
        </div>

        {/* Work Orders Board */}
        {loading ? (
          <div className="p-12 text-center text-[var(--soft-stone)]">Loading work orders...</div>
        ) : workOrders.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.35)] space-y-3">
            <p className="text-3xl">🏗️</p>
            <h3 className="text-base font-bold text-[var(--warm-ink)]">No Work Orders Matching Filter</h3>
            <p className="text-xs text-[var(--soft-stone)] max-w-sm mx-auto">
              Create a commercial roofing dispatch ticket to test the AI triage, skill matching, and WhatsApp alert engine.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-[var(--clay)] text-[var(--warm-ink)] text-xs font-bold"
            >
              + Create First Work Order
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workOrders.map((wo) => {
              const assignedTech = wo.assignments?.[0]?.technician;
              const isEmergency = wo.priority === 'EMERGENCY';
              return (
                <div
                  key={wo.id}
                  className={`rounded-2xl p-4 transition-all duration-200 border bg-white flex flex-col justify-between shadow-sm hover:shadow-md ${
                    isEmergency
                      ? 'border-[var(--terracotta)]/40 hover:border-[var(--terracotta)]'
                      : 'border-[rgba(191,179,163,0.35)] hover:border-[var(--clay)]'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                        wo.priority === 'EMERGENCY'
                          ? 'bg-[var(--terracotta)] text-white animate-pulse'
                          : wo.priority === 'URGENT'
                          ? 'bg-[var(--muted-ochre)]/25 text-[var(--warm-ink)]'
                          : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'
                      }`}>
                        {wo.priority}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--soft-stone)]">
                        #{wo.id.slice(-6)}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-[var(--warm-ink)] line-clamp-1">{wo.issueType}</h3>
                      <p className="text-xs text-[var(--soft-stone)] line-clamp-2 mt-0.5">{wo.description}</p>
                    </div>

                    <div className="text-[11px] text-[var(--soft-stone)] space-y-1 pt-1 border-t border-[rgba(191,179,163,0.2)]">
                      <p className="flex items-center gap-1 truncate">
                        <span>📍</span>
                        <span className="font-medium text-[var(--warm-ink)]">{wo.address}</span>
                      </p>
                      <p className="flex items-center gap-1">
                        <span>🏢</span>
                        <span>{wo.customer?.name || 'Commercial Client'} ({wo.customer?.phoneMasked || 'Phone on file'})</span>
                      </p>
                    </div>

                    {/* Technician assignment card */}
                    <div className="p-2 rounded-xl bg-[var(--warm-sand)]/50 border border-[rgba(191,179,163,0.25)] flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[var(--soft-stone)]">Assigned Lead</p>
                        <p className="font-bold text-[var(--warm-ink)] text-xs">
                          {assignedTech ? assignedTech.name : 'Unassigned'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        wo.status === 'COMPLETED' ? 'bg-[var(--sage)]/30 text-[var(--warm-ink)]' : 'bg-white text-[var(--soft-stone)]'
                      }`}>
                        {wo.status}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="pt-3 mt-3 border-t border-[rgba(191,179,163,0.25)] flex items-center gap-2">
                    <button
                      onClick={() => handleRunAiTriage(wo)}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-[var(--clay)]/20 hover:bg-[var(--clay)]/40 text-[var(--warm-ink)] text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <span>🤖 AI Triage</span>
                    </button>
                    {!assignedTech && (
                      <button
                        onClick={() => { setShowAssignModal(wo); setSelectedTechId(technicians[0]?.id || ''); }}
                        className="py-1.5 px-3 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-bold transition"
                      >
                        Assign
                      </button>
                    )}
                    <button
                      onClick={() => setShowDetailModal(wo)}
                      className="py-1.5 px-2.5 rounded-xl border border-[rgba(191,179,163,0.4)] hover:bg-[var(--warm-sand)] text-[var(--soft-stone)] text-xs font-semibold"
                    >
                      Audit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL 1: Create Commercial Work Order */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(191,179,163,0.3)]">
                <div>
                  <h3 className="font-bold text-lg text-[var(--warm-ink)]">Dispatch Commercial Work Order</h3>
                  <p className="text-xs text-[var(--soft-stone)]">Roofing, HVAC, and commercial facility repair</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] font-bold text-lg">✕</button>
              </div>

              <form onSubmit={handleCreateWorkOrder} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[var(--warm-ink)]">Commercial Facility / Client</label>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomer(!showNewCustomer)}
                      className="text-[11px] font-bold text-[var(--terracotta)] hover:underline"
                    >
                      {showNewCustomer ? 'Select Existing' : '+ New Client'}
                    </button>
                  </div>

                  {showNewCustomer ? (
                    <div className="p-3 rounded-xl bg-[var(--warm-sand)]/60 border border-[rgba(191,179,163,0.3)] space-y-2">
                      <input
                        type="text"
                        placeholder="Company / Facility Name (e.g. Amazon Air Logistics Hub)"
                        required
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border bg-white text-xs text-[var(--warm-ink)]"
                      />
                      <input
                        type="text"
                        placeholder="Facility Manager Phone (Stored Encrypted)"
                        required
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border bg-white text-xs text-[var(--warm-ink)]"
                      />
                    </div>
                  ) : (
                    <select
                      value={createForm.customerId}
                      onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-xs text-[var(--warm-ink)] font-semibold"
                    >
                      <option value="">-- Choose registered customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.phoneMasked || 'No phone'})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Issue Category</label>
                    <select
                      value={createForm.issueType}
                      onChange={(e) => setCreateForm({ ...createForm, issueType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-xs text-[var(--warm-ink)] font-semibold"
                    >
                      <option value="Active Roof Leak">Active Roof Leak</option>
                      <option value="TPO Membrane Puncture">TPO Membrane Puncture</option>
                      <option value="EPDM Seam Separation">EPDM Seam Separation</option>
                      <option value="Drainage / Ponding Hazard">Drainage / Ponding Hazard</option>
                      <option value="Flashing &amp; Coping Repair">Flashing &amp; Coping Repair</option>
                      <option value="Annual Commercial Inspection">Annual Commercial Inspection</option>
                      <option value="Rooftop HVAC Drain Overhaul">Rooftop HVAC Drain Overhaul</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Urgency Priority</label>
                    <select
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-xs text-[var(--warm-ink)] font-semibold"
                    >
                      <option value="EMERGENCY">EMERGENCY (Active Water Ingress)</option>
                      <option value="URGENT">URGENT (Storm / Flashing Damage)</option>
                      <option value="ROUTINE">ROUTINE (Scheduled Maintenance)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Facility Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1420 Logistics Way, Bay 3, Houston TX"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-xs text-[var(--warm-ink)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Roof Access &amp; Safety Notes</label>
                  <input
                    type="text"
                    value={createForm.accessNotes}
                    onChange={(e) => setCreateForm({ ...createForm, accessNotes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-xs text-[var(--warm-ink)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Detailed Defect Description</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe leak location, ceiling drip rate, equipment endangered, and suspected membrane issue..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-xs text-[var(--warm-ink)]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] text-xs font-bold text-[var(--soft-stone)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-bold shadow-md transition disabled:opacity-60"
                  >
                    {creating ? 'Creating Work Order…' : 'Create & Dispatch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: AI Dispatch & Triage Assistant */}
        {showAiModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(191,179,163,0.3)]">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">🤖</span>
                    <h3 className="font-bold text-lg text-[var(--warm-ink)]">AI Service Coordinator Triage</h3>
                  </div>
                  <p className="text-xs text-[var(--soft-stone)]">Ticket #{showAiModal.id.slice(-6)}: {showAiModal.issueType}</p>
                </div>
                <button onClick={() => setShowAiModal(null)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] font-bold text-lg">✕</button>
              </div>

              {aiLoading ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-8 h-8 border-4 border-[var(--clay)] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-[var(--warm-ink)]">Analyzing commercial roofing defect...</p>
                  <p className="text-[11px] text-[var(--soft-stone)]">Matching certified technician skills against building envelope requirements</p>
                </div>
              ) : aiError ? (
                <div className="p-4 rounded-xl bg-[var(--terracotta)]/20 border border-[var(--terracotta)] text-xs text-[var(--warm-ink)]">
                  {aiError}
                </div>
              ) : aiResult ? (
                <div className="space-y-4 text-xs">
                  {/* Priority banner */}
                  <div className="p-3 rounded-xl bg-[var(--sage)]/20 border border-[var(--sage)] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--soft-stone)]">Assessed Severity</p>
                      <p className="font-black text-sm text-[var(--warm-ink)]">{aiResult.triagePriority}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[var(--soft-stone)]">Match Confidence</p>
                      <p className="font-bold text-[var(--sage)]">{Math.round(aiResult.confidenceScore * 100)}%</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-[var(--warm-ink)] mb-1">Defect Analysis</h4>
                    <p className="text-[var(--soft-stone)] bg-white p-2.5 rounded-xl border border-[rgba(191,179,163,0.3)]">
                      {aiResult.problemAnalysis}
                    </p>
                  </div>

                  {/* Technician Recommendation */}
                  <div className="p-3.5 rounded-xl bg-white border border-[var(--clay)]/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-[var(--warm-ink)]">
                        👷 Recommended Lead: {aiResult.recommendedTechnicianName}
                      </p>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--clay)]/20 text-[var(--warm-ink)] text-[10px] font-bold">
                        {aiResult.estimatedHours} hrs est.
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--soft-stone)]">{aiResult.matchReason}</p>
                  </div>

                  {/* Tools & Safety */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-white border border-[rgba(191,179,163,0.3)]">
                      <p className="font-bold text-[var(--warm-ink)] mb-1 text-[11px]">⚠️ OSHA &amp; Safety</p>
                      <ul className="list-disc pl-3 text-[10px] text-[var(--soft-stone)] space-y-1">
                        {aiResult.safetyRequirements?.slice(0, 3).map((s: string, idx: number) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[rgba(191,179,163,0.3)]">
                      <p className="font-bold text-[var(--warm-ink)] mb-1 text-[11px]">🔧 Required Kit</p>
                      <ul className="list-disc pl-3 text-[10px] text-[var(--soft-stone)] space-y-1">
                        {aiResult.requiredToolsAndMaterials?.slice(0, 3).map((t: string, idx: number) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 1-Click Dispatch */}
                  {aiResult.recommendedTechnicianId && (
                    <button
                      onClick={async () => {
                        const idempotencyKey = `ai_disp_${showAiModal.id}_${Date.now()}`;
                        await coordinatorService.assignTechnician(showAiModal.id, {
                          technicianId: aiResult.recommendedTechnicianId,
                          notifyWhatsApp: true,
                        }, idempotencyKey);
                        setShowAiModal(null);
                        loadData();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                    >
                      <span>⚡ Accept Recommendation &amp; Dispatch via WhatsApp</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* MODAL 3: Assign Technician */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(191,179,163,0.3)]">
                <div>
                  <h3 className="font-bold text-base text-[var(--warm-ink)]">Assign Certified Technician</h3>
                  <p className="text-xs text-[var(--soft-stone)]">Ticket: {showAssignModal.issueType}</p>
                </div>
                <button onClick={() => setShowAssignModal(null)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] font-bold">✕</button>
              </div>

              <form onSubmit={handleAssign} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--warm-ink)] mb-1">Select Technician</label>
                  <select
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--warm-sand)] text-xs text-[var(--warm-ink)] font-semibold"
                  >
                    <option value="">-- Choose active technician --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} (Skills: {t.skills?.join(', ')})</option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-[var(--warm-sand)]/50 border border-[rgba(191,179,163,0.3)] flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="waNotifyCheck"
                    checked={notifyWhatsApp}
                    onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--clay)]"
                  />
                  <label htmlFor="waNotifyCheck" className="text-xs text-[var(--warm-ink)] font-medium">
                    Send WhatsApp dispatch alert (Utility template compliant)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(null)}
                    className="px-4 py-2 rounded-xl border border-[rgba(191,179,163,0.4)] text-xs font-bold text-[var(--soft-stone)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigning}
                    className="px-5 py-2 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-bold shadow-md transition disabled:opacity-60"
                  >
                    {assigning ? 'Dispatching…' : 'Dispatch Technician'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: Work Order Details & Immutable Audit Log */}
        {showDetailModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(191,179,163,0.3)]">
                <div>
                  <h3 className="font-bold text-lg text-[var(--warm-ink)]">Work Order #{showDetailModal.id.slice(-6)}</h3>
                  <p className="text-xs text-[var(--soft-stone)]">{showDetailModal.issueType} • Priority: {showDetailModal.priority}</p>
                </div>
                <button onClick={() => setShowDetailModal(null)} className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)] font-bold text-lg">✕</button>
              </div>

              {/* Status and details */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-[rgba(191,179,163,0.3)]">
                <div>
                  <p className="text-[10px] font-bold uppercase text-[var(--soft-stone)]">Facility Location</p>
                  <p className="font-bold text-[var(--warm-ink)]">{showDetailModal.address}</p>
                  <p className="text-[11px] text-[var(--soft-stone)] mt-1">Access: {showDetailModal.accessNotes || 'Standard'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-[var(--soft-stone)]">Client Contact</p>
                  <p className="font-bold text-[var(--warm-ink)]">{showDetailModal.customer?.name}</p>
                  <p className="text-[11px] text-[var(--soft-stone)] mt-1">{showDetailModal.customer?.phoneMasked || 'Phone on file'}</p>
                </div>
              </div>

              {/* Completion Section */}
              {showDetailModal.status !== 'COMPLETED' ? (
                <div className="p-4 rounded-xl bg-[var(--warm-sand)]/60 border border-[rgba(191,179,163,0.35)] space-y-2">
                  <h4 className="font-bold text-xs text-[var(--warm-ink)]">Submit Technician Completion Report</h4>
                  <textarea
                    rows={2}
                    placeholder="Document membrane repair details, patch dimensions, core sample results..."
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border bg-white text-xs text-[var(--warm-ink)]"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleCompleteWorkOrder(showDetailModal.id)}
                      disabled={completing}
                      className="px-4 py-2 rounded-xl bg-[var(--sage)] hover:opacity-90 text-[var(--warm-ink)] text-xs font-bold transition disabled:opacity-60"
                    >
                      {completing ? 'Resolving…' : '✓ Mark Complete & Ready for Invoice'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[var(--sage)]/20 border border-[var(--sage)] text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[var(--warm-ink)]">✓ Work Order Resolved</p>
                    <p className="text-[11px] text-[var(--soft-stone)]">Invoice status: READY for commercial escrow settlement</p>
                  </div>
                  <a
                    href="/contact/invoices"
                    className="px-3 py-1.5 rounded-xl bg-[var(--clay)] text-[var(--warm-ink)] font-bold text-xs"
                  >
                    Generate Invoice
                  </a>
                </div>
              )}

              {/* Immutable Audit Log */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--soft-stone)] mb-2">Immutable Audit Trail (Append-Only)</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {showDetailModal.auditLog && showDetailModal.auditLog.length > 0 ? (
                    showDetailModal.auditLog.map((log: any) => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-white border border-[rgba(191,179,163,0.25)] flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-[var(--warm-ink)]">{log.action}</span>
                          <span className="text-[10px] text-[var(--soft-stone)] ml-2">by {log.actorId}</span>
                        </div>
                        <span className="text-[10px] text-[var(--soft-stone)] font-mono">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--soft-stone)] p-2">No historical audit rows recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

