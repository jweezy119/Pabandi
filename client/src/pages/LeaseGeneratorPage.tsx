import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

export const LeaseGeneratorPage: React.FC = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    propertyId: '', tenantEmail: '', tenantName: '',
    startDate: '', endDate: '', rentAmount: '', depositAmount: '',
    petFee: '0', petMonthly: '0', lateFee: '75', lateGraceDays: '5',
    utilities: [] as string[], renewalTerms: '', terminationNoticeDays: '30',
  });
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await propertyManagerService.dashboard();
      const dash = res.data?.data;
      setProperties(dash?.properties || []);
      setLeases(dash?.leases || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const createLease = async () => {
    if (!form.propertyId || !form.tenantEmail || !form.startDate || !form.endDate || !form.rentAmount) {
      setErr('Please fill all required fields');
      return;
    }
    setErr('');
    try {
      await propertyManagerService.addLease({
        ...form,
        rentAmount: Number(form.rentAmount),
        depositAmount: Number(form.depositAmount) || 0,
        petFee: Number(form.petFee) || 0,
        petMonthly: Number(form.petMonthly) || 0,
        lateFee: Number(form.lateFee) || 0,
        lateGraceDays: Number(form.lateGraceDays) || 5,
        terminationNoticeDays: Number(form.terminationNoticeDays) || 30,
      });
      setSuccess('Lease created successfully!');
      setShowForm(false);
      loadData();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to create lease');
    }
  };

  const toggleUtility = (u: string) => {
    setForm(f => ({
      ...f,
      utilities: f.utilities.includes(u) ? f.utilities.filter(x => x !== u) : [...f.utilities, u],
    }));
  };

  if (loading) return <div className="min-h-screen p-8" style={{ background: tokens.color.background, color: 'white' }}>Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">📝 Lease Agreements</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Create and manage lease agreements</p>
          </div>
          <Link to="/property-manager" className="text-sm text-indigo-300 hover:text-indigo-200">← Back to CRM</Link>
        </div>

        {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger }}>{err}</div>}
        {success && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#10b98115', color: '#10b981' }}>{success}</div>}

        {!showForm && <Button onClick={() => setShowForm(true)} className="mb-6">+ Create Lease Agreement</Button>}

        {showForm && (
          <Surface className="mb-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">New Lease Agreement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Property *</label>
                <select value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })} className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <option value="">Select property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Tenant Email *</label>
                <input value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} placeholder="tenant@email.com" type="email" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Tenant Name</label>
                <input value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} placeholder="Full name" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Start Date *</label>
                  <input value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} type="date" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">End Date *</label>
                  <input value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} type="date" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Monthly Rent *</label>
                <input value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} placeholder="1500" type="number" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Security Deposit</label>
                <input value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} placeholder="1500" type="number" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Pet Fee (one-time)</label>
                <input value={form.petFee} onChange={(e) => setForm({ ...form, petFee: e.target.value })} placeholder="300" type="number" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Pet Monthly</label>
                <input value={form.petMonthly} onChange={(e) => setForm({ ...form, petMonthly: e.target.value })} placeholder="25" type="number" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Late Fee</label>
                <input value={form.lateFee} onChange={(e) => setForm({ ...form, lateFee: e.target.value })} placeholder="75" type="number" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Late Grace Days</label>
                <input value={form.lateGraceDays} onChange={(e) => setForm({ ...form, lateGraceDays: e.target.value })} placeholder="5" type="number" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Termination Notice (days)</label>
                <input value={form.terminationNoticeDays} onChange={(e) => setForm({ ...form, terminationNoticeDays: e.target.value })} placeholder="30" type="number" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Included Utilities</label>
                <div className="flex flex-wrap gap-2">
                  {['WATER', 'ELECTRIC', 'GAS', 'INTERNET', 'TRASH'].map(u => (
                    <button key={u} onClick={() => toggleUtility(u)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${form.utilities.includes(u) ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Renewal Terms</label>
                <input value={form.renewalTerms} onChange={(e) => setForm({ ...form, renewalTerms: e.target.value })} placeholder="e.g. Month-to-month after initial term" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button onClick={createLease} className="flex-1">Create Lease</Button>
              <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
            </div>
          </Surface>
        )}

        {/* Lease List */}
        <h2 className="text-lg font-bold text-slate-100 mb-3">Lease Agreements ({leases.length})</h2>
        {leases.length === 0 ? (
          <p className="text-center py-8" style={{ color: tokens.color.muted }}>No lease agreements yet.</p>
        ) : (
          <div className="space-y-3">
            {leases.map((l) => (
              <Surface key={l.id}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-bold text-slate-100">{l.tenantName || l.tenantEmail}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Lease #{l.id.slice(-6)}</div>
                  </div>
                  <Badge tone={l.status === 'ACTIVE' ? 'success' : l.status === 'DRAFT' ? 'info' : l.status === 'EXPIRED' ? 'danger' : 'warning'}>{l.status}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Rent</div>
                    <div className="font-bold text-emerald-300">${l.rentAmount}/mo</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Deposit</div>
                    <div className="font-bold text-slate-100">${l.depositAmount}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Start</div>
                    <div className="font-bold text-slate-100">{new Date(l.startDate).toLocaleDateString()}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-xs" style={{ color: tokens.color.muted }}>End</div>
                    <div className="font-bold text-slate-100">{new Date(l.endDate).toLocaleDateString()}</div>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaseGeneratorPage;
