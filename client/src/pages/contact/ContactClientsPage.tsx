import { useState, useEffect, useRef } from 'react';
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

  /**
   * Everything the server needs to answer, in one object, so a change to any part of
   * it re-fetches exactly once. Four separate useEffects watching four separate
   * pieces of state is how you end up firing four requests for one keystroke.
   */
  const [listQuery, setListQuery] = useState({
    page: 1,
    limit: 25,
    search: '',
    sortBy: '',
    sortOrder: '',
  });
  /** What the server said about the whole result set. Null when not paginated. */
  const [pagination, setPagination] = useState<{
    page: number; limit: number; total: number; totalPages: number;
  } | null>(null);
  /** True while a search box is in use, which is the only debounced input. */
  const searchTimer = useRef(true);
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

  // One request per query change. 250ms on search so typing a name does not fire a
  // request per keystroke; immediate for a page or sort change, which are deliberate.
  useEffect(() => {
    if (!searchTimer.current) {
      fetchClients();
      return;
    }
    const t = setTimeout(() => fetchClients(), 250);
    return () => clearTimeout(t);
  }, [listQuery.search]);

  useEffect(() => {
    if (searchTimer.current) fetchClients();
  }, [listQuery.page, listQuery.sortBy, listQuery.sortOrder]);

  /**
   * Client-side paging is gone; the server does it.
   *
   * This used to receive the tenant's entire client list and slice ten rows at a time
   * in the browser. Two things followed from that: the dashboard API call moved every
   * row on every page load, and the table's search and sort could only ever see the
   * rows it had been given.
   *
   * Search, sort and the page are now all sent to the server together, because a
   * client-side filter over a page of results is not a filter — it is a search of the
   * current page, which silently returns nothing whenever the match is on another one.
   */
  async function fetchClients(overrides: Partial<typeof listQuery> = {}) {
    const q = { ...listQuery, ...overrides };
    try {
      const params = new URLSearchParams();
      if (q.search) params.set('search', q.search);
      if (q.sortBy) params.set('sortBy', q.sortBy);
      if (q.sortOrder) params.set('sortOrder', q.sortOrder);
      params.set('page', String(q.page));
      params.set('limit', String(q.limit));

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data.data || []);
        setPagination(data.pagination ?? null);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  }

  // Set when a save fails, rendered next to the form. See handleSaveClient.
  const [saveError, setSaveError] = useState<string | null>(null);

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
        const err = await res.json().catch(() => ({}));
        console.error('Failed to save client:', err);

        // Surface it. This was console.error-only, so a 403 closed the modal on
        // nothing and left the customer pressing a button that appeared to do
        // nothing at all — the reported symptom. A write that fails must say so.
        //
        // The 403 case is specifically called out because it has a known cause and
        // a known fix: this account has no CrmServiceBusiness row, so every /crm
        // route 403s before reaching a handler. That is fixed by completing setup.
        const message =
          res.status === 403 && err?.message === 'No service business enrolled for this account'
            ? 'Finish setting up your business before adding clients.'
            : err?.message || err?.error || `Could not save (${res.status})`;
        setSaveError(message);
        return;
      }

      setSaveError(null);
      setShowFormModal(false);
      setSelectedClient(null);
      fetchClients();
    } catch (err: any) {
      console.error('Failed to save client:', err);
      setSaveError(err?.message || 'Could not save. Check your connection and try again.');
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
        ) : clients.length === 0 && listQuery.search ? (
          // Not an empty CRM. The search ran against the whole tenant and matched
          // nothing, and telling someone they have no clients when they have four
          // hundred is the kind of confident wrong that loses their trust in the page.
          <EmptyState
            icon="search_off"
            title="No matches"
            description={`Nothing matches “${listQuery.search}”.`}
            actionText="Clear search"
            onAction={() => setListQuery((q) => ({ ...q, search: '', page: 1 }))}
          />
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
            query={listQuery}
            pagination={pagination}
            onQueryChange={(patch) => setListQuery((q) => ({ ...q, ...patch }))}
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
            onClose={() => { setSaveError(null); setShowFormModal(false); }} 
            onSave={handleSaveClient} 
            customFields={customFields}
            error={saveError}
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
