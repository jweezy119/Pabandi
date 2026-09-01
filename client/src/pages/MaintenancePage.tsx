import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

export const MaintenancePage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');
  const [form, setForm] = useState({
    propertyId: '', tenantEmail: '', title: '', description: '',
    priority: 'MEDIUM', cost: '', vendor: '', vendorNotes: '',
  });
  const [err, setErr] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await propertyManagerService.dashboard();
      const dash = res.data?.data;
      setRequests(dash?.maintenance || []);
      setProperties(dash?.properties || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async () => {
    if (!form.title) return setErr('Title is required');
    setErr('');
    try {
      await propertyManagerService.addMaintenance({
        ...form,
        cost: form.cost ? Number(form.cost) : undefined,
      });
      setShowForm(false);
      setForm({ propertyId: '', tenantEmail: '', title: '', description: '', priority: 'MEDIUM', cost: '', vendor: '', vendorNotes: '' });
      loadData();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to create');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await propertyManagerService.updateMaintenance(id, { status });
      loadData();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to update');
    }
  };

  const filteredRequests = filter === 'ALL' ? requests : requests.filter(r => r.status === filter);

  const priorityColor: Record<string, string> = { LOW: '#65a30d', MEDIUM: '#ca8a04', HIGH: '#ea580c', URGENT: '#dc2626' };
  const statusOptions = ['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  if (loading) return <div className="min-h-screen p-8" style={{ background: tokens.color.background, color: 'white' }}>Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">🔧 Maintenance</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Track requests, assign vendors, and manage costs</p>
          </div>
          <Link to="/property-manager" className="text-sm text-indigo-300 hover:text-indigo-200">← Back to CRM</Link>
        </div>

        {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger }}>{err}</div>}

        {/* Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {statusOptions.map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filter === s ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {s === 'ALL' ? `All (${requests.length})` : `${s.replace('_', ' ')} (${requests.filter(r => r.status === s).length})`}
            </button>
          ))}
        </div>

        {!showForm && <Button onClick={() => setShowForm(true)} className="mb-6">+ New Request</Button>}

        {showForm && (
          <Surface className="mb-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">New Maintenance Request</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Property</label>
                <select value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })} className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <option value="">Select property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Tenant Email</label>
                <input value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} placeholder="tenant@email.com" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Leaky faucet in kitchen" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detailed description of the issue..." rows={3} className="w-full rounded-xl px-4 py-3 outline-none resize-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Vendor</label>
                <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor name" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Estimated Cost</label>
                <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" type="number" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Vendor Notes</label>
                <input value={form.vendorNotes} onChange={(e) => setForm({ ...form, vendorNotes: e.target.value })} placeholder="Notes for vendor" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button onClick={createRequest} className="flex-1">Submit Request</Button>
              <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
            </div>
          </Surface>
        )}

        {/* Request List */}
        {filteredRequests.length === 0 ? (
          <p className="text-center py-8" style={{ color: tokens.color.muted }}>No maintenance requests found.</p>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map(r => {
              const property = properties.find(p => p.id === r.propertyId);
              return (
                <Surface key={r.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-bold text-slate-100">{r.title}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>
                        {property?.title || 'No property'} · {r.tenantEmail || 'No tenant'}
                      </div>
                    </div>
                    <Badge tone={r.status === 'COMPLETED' ? 'success' : r.status === 'IN_PROGRESS' ? 'info' : r.status === 'CANCELLED' ? 'danger' : 'warning'}>{r.status}</Badge>
                  </div>
                  {r.description && <p className="text-sm mb-2" style={{ color: tokens.color.muted }}>{r.description}</p>}
                  <div className="flex items-center gap-3 text-xs" style={{ color: tokens.color.muted }}>
                    <span style={{ color: priorityColor[r.priority] || '#888' }}>● {r.priority}</span>
                    {r.vendor && <span>🔧 {r.vendor}</span>}
                    {r.cost && <span>💰 ${r.cost}</span>}
                  </div>
                  {r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && (
                    <div className="flex gap-2 mt-3">
                      {r.status === 'OPEN' && <Button size="sm" onClick={() => updateStatus(r.id, 'IN_PROGRESS')}>Start Work</Button>}
                      {r.status === 'IN_PROGRESS' && <Button size="sm" onClick={() => updateStatus(r.id, 'COMPLETED')}>Mark Complete</Button>}
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, 'CANCELLED')}>Cancel</Button>
                    </div>
                  )}
                </Surface>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenancePage;
