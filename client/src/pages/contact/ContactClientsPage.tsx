import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Modal, EmptyState, ClaySkeletonCard } from '../../components/primitives';
import ClientListTable from '../crm/components/ClientListTable';
import ClientFormModal from '../crm/components/ClientFormModal';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/jobs', label: 'Jobs', icon: 'work' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
  { path: '/contact/settings/modules', label: 'Settings', icon: 'settings' },
];

export default function ContactClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);

  useEffect(() => {
    fetchClients();
    fetchBusinessSettings();
  }, []);

  async function fetchBusinessSettings() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
    
    try {
      await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(form),
      });
      setShowFormModal(false);
      setSelectedClient(null);
      fetchClients();
    } catch (err) {
      console.error('Failed to save client:', err);
    }
  }

  async function handleDeleteClient(id: string) {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setShowDeleteConfirm(null);
      fetchClients();
    } catch (err) {
      console.error('Failed to delete client:', err);
    }
  }

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 clay-heading">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Clients</h1>
          <Button onClick={() => { setSelectedClient(null); setShowFormModal(true); }} icon="add">
            Add Client
          </Button>
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
            onEdit={(client: any) => { setSelectedClient(client); setShowFormModal(true); }}
            onDelete={(id: string) => setShowDeleteConfirm(id)}
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

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          title="Delete Client?"
          actionText="Delete"
          actionVariant="danger"
          onAction={() => handleDeleteClient(showDeleteConfirm!)}
        >
          <p className="text-[var(--soft-stone)] mb-6 text-sm">
            This action cannot be undone. All associated deals and activities will also be removed.
          </p>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
