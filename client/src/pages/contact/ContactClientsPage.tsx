import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Link } from 'react-router-dom';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

function ClayCard({ children, className = '', hover = true, ...props }: any) {
  return (
    <div
      className={`rounded-[28px] bg-white transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{ boxShadow: 'var(--shadow-soft)' }}
      {...props}
    >
      <div className="p-4">{children}</div>
    </div>
  );
}

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-headline text-[var(--warm-ink)]">Clients</h1>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="btn btn-primary"
          >
            <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">add</span>
            Add Client
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--soft-stone)]">Loading...</div>
        ) : clients.length === 0 ? (
          <ClayCard hover={false} className="text-center p-12">
            <span className="material-symbols-outlined text-[48px] text-[var(--clay)] mb-4 block">person_add</span>
            <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">No Clients Yet</h2>
            <p className="text-[var(--soft-stone)] mb-6 max-w-md mx-auto">
              Start building your CRM by adding your first client. You can track their deals, lifetime value, and activities here.
            </p>
            <button onClick={() => { resetForm(); setShowAddModal(true); }} className="btn btn-primary">
              Add Your First Client
            </button>
          </ClayCard>
        ) : (
          <ClayCard hover={false} className="p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--warm-sand)]">
                  <th className="text-left p-4 text-sm font-semibold text-[var(--warm-ink)]">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--warm-ink)]">Company</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--warm-ink)]">Contact</th>
                  <th className="text-right p-4 text-sm font-semibold text-[var(--warm-ink)]">Lifetime Value</th>
                  <th className="text-right p-4 text-sm font-semibold text-[var(--warm-ink)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-t border-[rgba(191,179,163,0.2)] hover:bg-[var(--warm-sand)]/50 transition">
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
                      <button onClick={() => openEditModal(client)} className="p-2 text-[var(--soft-stone)] hover:text-[var(--clay)] transition" aria-label="Edit">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button onClick={() => setShowDeleteConfirm(client.id)} className="p-2 text-[var(--soft-stone)] hover:text-[var(--terracotta)] transition" aria-label="Delete">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ClayCard>
        )}

        {/* Add/Edit Modal */}
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(42,37,32,0.5)] backdrop-blur-sm" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>
            <ClayCard className="w-full max-w-md p-6" onClick={(e: any) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-6 font-headline text-[var(--warm-ink)]">{showEditModal ? 'Edit Client' : 'New Client'}</h3>
              <form onSubmit={showEditModal ? handleEditClient : handleAddClient} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--warm-ink)] mb-1">Full Name</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--warm-ink)] mb-1">Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--warm-ink)] mb-1">Phone</label>
                    <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--warm-ink)] mb-1">Company (Optional)</label>
                  <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--warm-ink)] mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] px-4 py-3 text-sm text-[var(--warm-ink)] outline-none focus:border-[var(--clay)]" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="flex-1 btn btn-secondary text-center">Cancel</button>
                  <button type="submit" className="flex-1 btn btn-primary text-center">{showEditModal ? 'Save Changes' : 'Create Client'}</button>
                </div>
              </form>
            </ClayCard>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(42,37,32,0.5)] backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
            <ClayCard className="w-full max-w-sm p-6 text-center" onClick={(e: any) => e.stopPropagation()}>
              <div className="w-16 h-16 mx-auto bg-[#fee2e2] rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[32px] text-[var(--terracotta)]">warning</span>
              </div>
              <h3 className="text-xl font-bold mb-2 font-headline text-[var(--warm-ink)]">Delete Client?</h3>
              <p className="text-[var(--soft-stone)] mb-6 text-sm">
                This action cannot be undone. All associated deals and activities will also be removed.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 btn btn-secondary text-center">Cancel</button>
                <button onClick={() => handleDeleteClient(showDeleteConfirm)} className="flex-1 rounded-xl bg-[var(--terracotta)] text-white font-medium hover:opacity-90 transition text-center py-2.5">Delete</button>
              </div>
            </ClayCard>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
