import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Modal, EmptyState, ClaySkeletonCard } from '../../components/primitives';
import ClientListTable from '../crm/components/ClientListTable';
import ClientFormModal from '../crm/components/ClientFormModal';
import CSVImportModal from '../crm/components/CSVImportModal';
import { useAuthStore } from '../../store/authStore';
import { getAuthToken } from '../../utils/authToken';
import { withBusinessId } from '../../utils/businessContext';



export default function ContactClientsPage() {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  // A failed delete used to be logged to the console and the dialog closed
  // anyway, so the user was shown a success they never got.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
    fetchBusinessSettings();
  }, []);

  async function fetchBusinessSettings() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/settings`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        const settings = data.data;
        if (settings?.customFields?.client) {
          setCustomFields(settings.customFields.client);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }

  async function fetchClients() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveClient(form: any) {
    const isEdit = !!form.id;
    const url = isEdit 
      ? `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${form.id}`
      : `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`;
    
    const businessId = (user as any)?.business?.id || user?.businessId;
    const payload = {
      ...form,
      ...(businessId ? { businessId } : {}),
    };
    
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to save client:', err);
        return;
      }
      
      setShowFormModal(false);
      setSelectedClient(null);
      fetchClients();
    } catch (err) {
      console.error('Failed to save client:', err);
    }
  }

  async function handleImportClients(csvData: string) {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/import/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ csvData }),
    });
    const data = await res.json();
    if (data.success) {
      fetchClients();
      return data.data;
    }
    throw new Error(data.error || 'Import failed');
  }

  async function handleDeleteClient(id: string) {
    // Check the response instead of assuming success. A 500 from the server
    // used to be swallowed here, the confirm dialog closed, and the client
    // still listed — so the user was told the delete worked when it did not.
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}?${withBusinessId()}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Delete failed (${res.status})`);
    }
    setShowDeleteConfirm(null);
    setDeleteError(null);
    await fetchClients();
  }

  /** Bulk delete: sequential, so one failure does not silently skip the rest. */
  async function handleBulkDeleteClients(ids: string[]) {
    const failures: string[] = [];
    for (const id of ids) {
      try {
        await handleDeleteClient(id);
      } catch {
        failures.push(id);
      }
    }
    if (failures.length > 0) {
      setDeleteError(`${failures.length} of ${ids.length} could not be deleted. They are still listed.`);
      // Refresh anyway, so the ones that did succeed disappear from the table.
      await fetchClients();
      throw new Error(`${failures.length} client${failures.length === 1 ? '' : 's'} could not be deleted.`);
    }
  }

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 clay-heading">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Clients</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowImportModal(true)} variant="ghost" icon="upload">
              Import CSV
            </Button>
            <Button onClick={() => { setSelectedClient(null); setShowFormModal(true); }} icon="add">
              Add Client
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-8">
            <ClaySkeletonCard />
          </div>
        ) : clients.length === 0 ? (
          <EmptyState 
            icon="person_add" 
            title="No Clients Yet" 
            description="Start building your CRM by adding your first client. You can track their deals, lifetime value, and activities here." 
            actionText="Add Your First Client" 
            onAction={() => { setSelectedClient(null); setShowFormModal(true); }} 
          />
        ) : (
          <ClientListTable 
            clients={clients} 
            onEdit={(client) => { setSelectedClient(clients.find((c) => c.id === client.id) ?? null); setShowFormModal(true); }}
            onDelete={(id: string) => { setDeleteError(null); setShowDeleteConfirm(id); }}
            onBulkDelete={handleBulkDeleteClients}
          />
        )}

        {/* Add/Edit Modal */}
        <Modal
          isOpen={showFormModal}
          onClose={() => setShowFormModal(false)}
          title={selectedClient ? 'Edit Client' : 'New Client'}
        >
          <ClientFormModal 
            client={selectedClient} 
            onClose={() => setShowFormModal(false)} 
            onSave={handleSaveClient} 
            customFields={customFields}
          />
        </Modal>

        {/* CSV Import Modal */}
        <CSVImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImportClients}
          title="Import Clients from CSV"
          expectedFields={['name', 'email', 'phone', 'company', 'address', 'notes', 'status']}
          templateHeaders={['name', 'email', 'phone', 'company', 'address', 'notes', 'status']}
        />

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          title="Delete Client?"
          actionText="Delete"
          actionVariant="danger"
          onAction={async () => {
            try {
              await handleDeleteClient(showDeleteConfirm!);
            } catch (err) {
              setDeleteError(err instanceof Error ? err.message : 'Delete failed');
            }
          }}
        >
          <p className="text-[var(--soft-stone)] mb-4 text-sm">
            This action cannot be undone. All associated deals and activities will also be removed.
          </p>
          {deleteError && (
            <div className="clay-alert clay-alert--critical mb-4">
              <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{deleteError}</p>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
