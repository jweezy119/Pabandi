import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Modal, EmptyState, ClaySkeletonCard } from '../../components/primitives';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
  { path: '/contact/settings/modules', label: 'Settings', icon: 'settings' },
];

export default function ContactClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const [form, setForm] = useState({ id: '', name: '', email: '', phone: '', company: '', notes: '' });

  useEffect(() => {
    fetchClients();
  }, []);

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

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(form),
      });
      setShowAddModal(false);
      resetForm();
      fetchClients();
    } catch (err) {
      console.error('Failed to add client:', err);
    }
  }

  async function handleEditClient(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients/${form.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(form),
      });
      setShowEditModal(false);
      resetForm();
      fetchClients();
    } catch (err) {
      console.error('Failed to update client:', err);
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

  function openEditModal(client: any) {
    setForm(client);
    setShowEditModal(true);
  }

  function resetForm() {
    setForm({ id: '', name: '', email: '', phone: '', company: '', notes: '' });
  }

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between clay-heading">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Clients</h1>
          <Button onClick={() => { resetForm(); setShowAddModal(true); }} icon="add">
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
            onAction={() => { resetForm(); setShowAddModal(true); }} 
          />
        ) : (
          <Card hover={false} className="clay-rise p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--warm-sand)]">
                  <th className="text-left p-4 text-sm font-semibold text-[var(--warm-ink)] font-label">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--warm-ink)] font-label">Company</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--warm-ink)] font-label">Contact</th>
                  <th className="text-right p-4 text-sm font-semibold text-[var(--warm-ink)] font-label">Lifetime Value</th>
                  <th className="text-right p-4 text-sm font-semibold text-[var(--warm-ink)] font-label">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="clay-table-row border-t border-[rgba(191,179,163,0.2)]">
                    <td className="p-4 font-medium text-[var(--warm-ink)]">
                      <Link to={`/contact/clients/${client.id}`} className="hover:text-[var(--clay)] transition">
                        {client.name}
                      </Link>
                    </td>
                    <td className="p-4 text-[var(--soft-stone)] text-sm">{client.company || '—'}</td>
                    <td className="p-4 text-[var(--soft-stone)] text-sm">
                      <div>{client.email || '—'}</div>
                      <div className="text-xs">{client.phone || '—'}</div>
                    </td>
                    <td className="p-4 text-right font-medium text-[var(--terracotta)]">
                      ${(client.totalSpent || 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => openEditModal(client)} className="p-2 text-[var(--soft-stone)] hover:text-[var(--clay)] transition clay-card--interactive rounded-full" aria-label="Edit">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button onClick={() => setShowDeleteConfirm(client.id)} className="p-2 text-[var(--soft-stone)] hover:text-[var(--terracotta)] transition clay-card--interactive rounded-full" aria-label="Delete">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Add/Edit Modal */}
        <Modal
          isOpen={showAddModal || showEditModal}
          onClose={() => { setShowAddModal(false); setShowEditModal(false); }}
          title={showEditModal ? 'Edit Client' : 'New Client'}
        >
          <form onSubmit={showEditModal ? handleEditClient : handleAddClient} className="space-y-4">
            <Input label="Full Name" required value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })} />
              <Input label="Phone" type="text" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <Input label="Company (Optional)" type="text" value={form.company} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, company: e.target.value })} />
            <Input label="Notes" textarea rows={3} value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex gap-3 pt-4 justify-end">
              <Button type="button" variant="ghost" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>Cancel</Button>
              <Button type="submit">{showEditModal ? 'Save Changes' : 'Create Client'}</Button>
            </div>
          </form>
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
