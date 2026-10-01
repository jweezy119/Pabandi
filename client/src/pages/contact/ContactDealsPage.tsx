import { useState, useEffect } from 'react';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
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



const DEFAULT_STAGES = [
  { id: 'LEAD', label: 'Lead', color: '#8A9A7B' },
  { id: 'QUALIFIED', label: 'Qualified', color: '#D9A854' },
  { id: 'PROPOSAL', label: 'Proposal', color: '#C97B5A' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: '#B26B4C' },
  { id: 'WON', label: 'Closed Won', color: '#5C7A54' },
  { id: 'LOST', label: 'Closed Lost', color: '#A85A5A' },
];

export default function ContactDealsPage() {
  const { settings } = useBusinessSettings();
  const stages = settings.pipelineStages?.length > 0 
    ? settings.pipelineStages 
    : DEFAULT_STAGES;

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
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/import/deals`, {
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
    throw new Error(data.error || 'Import failed');
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
      const probMap: Record<string, number> = { LEAD: 10, QUALIFIED: 30, PROPOSAL: 60, NEGOTIATION: 80, WON: 100, LOST: 0 };
      const res = await fetch(`${baseUrl}/api/v1/crm/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ stage, probability: probMap[stage] ?? 10, ...(reason ? { lostReason: reason } : {}) }),
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
