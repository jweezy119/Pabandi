import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Modal, EmptyState } from '../../components/primitives';
import { Input } from '../../components/primitives/Input';
import PipelineForecastWidget from '../crm/components/PipelineForecastWidget';
import DealKanbanBoard from '../crm/components/DealKanbanBoard';
import DealListTable from '../crm/components/DealListTable';
import DealFormModal from '../crm/components/DealFormModal';
import CSVImportModal from '../crm/components/CSVImportModal';
import { Upload } from 'lucide-react';
import { getAuthToken } from '../../utils/authToken';
import { DEAL_STAGES, DEAL_STAGE_LABELS, STAGE_PROBABILITY, type DealStage } from '@shared/crm';



/**
 * Kanban column colours. Presentation only — the ids come from the shared
 * vocabulary below, because this array used to be the authority and there were
 * three other copies of it.
 */
const STAGE_COLORS: Record<DealStage, string> = {
  LEAD: '#8A9A7B',
  QUALIFIED: '#D9A854',
  PROPOSAL: '#C97B5A',
  NEGOTIATION: '#B26B4C',
  WON: '#5C7A54',
  LOST: '#A85A5A',
};

/**
 * WHY THIS IGNORES settings.pipelineStages
 *
 * That setting used to drive these columns, and completing the setup wizard
 * breaks them. `applyPreset` writes stages shaped `{id: 'stage-1', name: 'Lead'}`,
 * so every column rendered with an undefined label and every `<option>` sent
 * `stage-1` as a stage — which `parseStage` rejects with a 400. Anyone who
 * finished onboarding got a blank, unwritable pipeline board.
 *
 * The server accepts six stages and no others, so six is what the board is built
 * from. Renaming or adding stages is a server-side change (PipelineSettingsPage
 * still offers it, which is the remaining half of this problem); until then the
 * board is right and the saved customisation is not used.
 */
const stages = DEAL_STAGES.map((id) => ({
  id,
  label: DEAL_STAGE_LABELS[id],
  color: STAGE_COLORS[id],
}));

export default function ContactDealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [selectedDealForLost, setSelectedDealForLost] = useState<any>(null);
  const [lostReason, setLostReason] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchDealsAndClients();
  }, []);

  async function fetchDealsAndClients() {
    setLoading(true);
    try {
      const token = getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const [dealsRes, clientsRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/crm/deals`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/clients`, { headers }),
      ]);

      if (dealsRes.ok) setDeals((await dealsRes.json()).data || []);
      if (clientsRes.ok) setClients((await clientsRes.json()).data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDeal(form: any) {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/v1/crm/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ ...form, value: parseFloat(form.value) || 0, probability: parseInt(form.probability) || 10 }),
      });
      if (res.ok) {
        setIsCreateOpen(false);
        fetchDealsAndClients();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleImportDeals(csvData: string) {
    // Same baseUrl as every other call in this file (see fetchDealsAndClients). This one
    // used to fall back to 'https://pabandi.onrender.com' — PRODUCTION — while the rest of
    // the page falls back to localhost. With VITE_API_URL unset, a developer's test import
    // would have written deals into the live database.
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const res = await fetch(`${baseUrl}/api/v1/crm/import/deals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ csvData }),
    });
    const data = await res.json();
    if (data.success) {
      fetchDealsAndClients();
      return data.data;
    }
    // The API error shape is { success: false, message }. Reading `data.error` — which only
    // exists in development — meant every real reason (no title column, too many rows,
    // unbalanced quote, oversized file) surfaced as a bare "Import failed".
    throw new Error(data.message || data.error || 'Import failed');
  }

  async function handleUpdateStage(dealId: string, newStage: string) {
    if (newStage === 'LOST') {
      setSelectedDealForLost(deals.find(d => d.id === dealId));
      setIsLostModalOpen(true);
      return;
    }
    await submitStageUpdate(dealId, newStage);
  }

  async function submitStageUpdate(dealId: string, stage: string, reason?: string) {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/v1/crm/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        // Probability follows the stage unless overridden — STAGE_PROBABILITY is the
        // same map the server uses to derive it, so the two cannot disagree.
        body: JSON.stringify({
          stage,
          probability: STAGE_PROBABILITY[stage as DealStage] ?? 10,
          ...(reason ? { lostReason: reason } : {}),
        }),
      });
      if (res.ok) fetchDealsAndClients();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 clay-heading">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Deals Pipeline</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage opportunities and track stage conversion.</p>
          </div>
          <div className="flex gap-2">
            <div className="flex bg-[var(--warm-sand)]/20 rounded-xl p-1 border border-[rgba(191,179,163,0.3)]">
              <button onClick={() => setViewMode('kanban')} className={`px-3 py-1 rounded-lg text-sm font-bold ${viewMode === 'kanban' ? 'bg-white shadow-sm text-[var(--warm-ink)]' : 'text-[var(--soft-stone)]'}`}>Kanban</button>
              <button onClick={() => setViewMode('table')} className={`px-3 py-1 rounded-lg text-sm font-bold ${viewMode === 'table' ? 'bg-white shadow-sm text-[var(--warm-ink)]' : 'text-[var(--soft-stone)]'}`}>Table</button>
            </div>
            <Button variant="ghost" icon="upload" onClick={() => setShowImportModal(true)}>Import CSV</Button>
            <Button variant="primary" icon="add" onClick={() => setIsCreateOpen(true)}>New Deal</Button>
          </div>
        </div>

        <PipelineForecastWidget deals={deals} />

        {loading ? (
          <div className="p-12 text-center text-[var(--soft-stone)]">Loading pipeline...</div>
        ) : deals.length === 0 ? (
          <EmptyState icon="handshake" title="No Deals" description="Create your first deal opportunity." actionLabel="Create Deal" onAction={() => setIsCreateOpen(true)} />
        ) : viewMode === 'kanban' ? (
          <DealKanbanBoard STAGES={stages} deals={deals} onUpdateStage={handleUpdateStage} />
        ) : (
          <DealListTable STAGES={stages} deals={deals} onUpdateStage={handleUpdateStage} />
        )}

        <CSVImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImportDeals}
          title="Import Deals from CSV"
          expectedFields={['title', 'value', 'stage', 'probability', 'expectedCloseDate', 'client', 'notes']}
          templateHeaders={['title', 'value', 'stage', 'probability', 'expectedCloseDate', 'client', 'notes']}
        />

        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Deal">
          <DealFormModal clients={clients} onClose={() => setIsCreateOpen(false)} onSave={handleCreateDeal} />
        </Modal>

        <Modal isOpen={isLostModalOpen} onClose={() => setIsLostModalOpen(false)} title="Close Deal as Lost">
          <form onSubmit={(e) => { e.preventDefault(); submitStageUpdate(selectedDealForLost.id, 'LOST', lostReason); setIsLostModalOpen(false); }} className="space-y-4">
            <p className="text-sm text-[var(--soft-stone)]">Reason for closing <strong>"{selectedDealForLost?.title}"</strong> as lost:</p>
            <Input label="Lost Reason" value={lostReason} onChange={(e: any) => setLostReason(e.target.value)} required />
            <div className="flex justify-end gap-3 pt-4"><Button variant="ghost" onClick={() => setIsLostModalOpen(false)}>Cancel</Button><Button type="submit" variant="danger">Mark as Lost</Button></div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
