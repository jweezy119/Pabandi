import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';

const navItems = [
  { path: '/pipeline', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/pipeline/leads', label: 'Leads', icon: 'person_add' },
  { path: '/pipeline/deals', label: 'Deals', icon: 'handshake' },
  { path: '/pipeline/activities', label: 'Activities', icon: 'notifications' },
];

export default function PipelineLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', notes: '' });

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/clients`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddLead(e: React.FormEvent) {
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
      setForm({ name: '', email: '', phone: '', company: '', notes: '' });
      fetchLeads();
    } catch (err) {
      console.error('Failed to add lead:', err);
    }
  }

  return (
    <DashboardLayout osName="PipelineOS" osIcon="P" osColor="#C97B5A" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Leads</h1>
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded-xl font-medium" style={{ background: 'var(--clay)', color: 'white' }}>
            + Add Lead
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--soft-stone)' }}>Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center rounded-xl" style={{ background: 'var(--warm-sand)' }}>
            <p style={{ color: 'var(--soft-stone)' }}>No leads yet. Add your first lead to get started.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--soft-stone)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--warm-sand)' }}>
                  <th className="text-left p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Name</th>
                  <th className="text-left p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Email</th>
                  <th className="text-left p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Stage</th>
                  <th className="text-right p-3 text-sm font-semibold" style={{ color: 'var(--warm-ink)' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t" style={{ borderColor: 'var(--soft-stone)' }}>
                    <td className="p-3" style={{ color: 'var(--warm-ink)' }}>{lead.name}</td>
                    <td className="p-3" style={{ color: 'var(--soft-stone)' }}>{lead.email || '—'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--warm-sand)', color: 'var(--warm-ink)' }}>
                        {lead.stage || 'lead'}
                      </span>
                    </td>
                    <td className="p-3 text-right" style={{ color: 'var(--terracotta)' }}>${(lead.totalSpent || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddModal(false)}>
            <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'white' }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>New Lead</h3>
              <form onSubmit={handleAddLead} className="space-y-3">
                <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 rounded-lg" style={{ border: '1px solid var(--soft-stone)' }} />
                <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg" style={{ border: '1px solid var(--soft-stone)' }} />
                <input type="text" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg" style={{ border: '1px solid var(--soft-stone)' }} />
                <input type="text" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2 rounded-lg" style={{ border: '1px solid var(--soft-stone)' }} />
                <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg" style={{ border: '1px solid var(--soft-stone)' }} rows={3} />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-2 rounded-lg font-medium" style={{ background: 'var(--clay)', color: 'white' }}>Add Lead</button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg font-medium" style={{ background: 'var(--warm-sand)' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
