// Sitara OS — Operator maintenance (real property backend)
// Track every fix across the portfolio; create in one form.
import { useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';
import { useRental, RentalGate } from '../utils/useRental';

const statusColors: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function OperatorMaintenancePage() {
  const { data, loading, enrolled, enrolling, enroll, refresh } = useRental();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const jobs: any[] = data?.maintenance || [];
  const open = jobs.filter((m: any) => ['OPEN', 'IN_PROGRESS'].includes(String(m.status)));

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await sitaraApi.rentalAddMaintenance({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      });
      setNotice({ ok: true, text: 'Work order created.' });
      setTitle('');
      setDescription('');
      setShowCreate(false);
      await refresh();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.response?.data?.error || 'Could not create work order.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm p-8">Loading maintenance…</p>;
  if (!enrolled) return <RentalGate onEnroll={(n) => void enroll(n)} enrolling={enrolling} />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-slate-600 mt-1">{open.length} open · {jobs.length} total · live</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          + Work Order
        </button>
      </div>

      {notice && (
        <div className={`rounded-lg p-3 mb-4 text-sm font-medium ${notice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.text}
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's broken? *" className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (unit, access notes…)" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500">
            <option value="LOW">Low priority</option>
            <option value="MEDIUM">Medium priority</option>
            <option value="HIGH">High priority</option>
            <option value="URGENT">Urgent</option>
          </select>
          <button onClick={() => void handleCreate()} disabled={saving} className="sm:col-span-2 px-4 py-2.5 bg-amber-500 text-white font-medium rounded-lg disabled:opacity-50">
            {saving ? 'Creating…' : 'Create work order'}
          </button>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="font-semibold text-slate-900 mb-1">Nothing broken — yet</p>
          <p className="text-sm text-slate-500">Work orders from you (and tenant requests) land here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((m: any) => (
            <div key={m.id} className="tile bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">{m.title}</h3>
                <div className="flex items-center gap-2">
                  {m.priority && ['HIGH', 'URGENT'].includes(String(m.priority)) && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      {String(m.priority).toLowerCase()}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[String(m.status)] || 'bg-slate-100 text-slate-600'}`}>
                    {String(m.status || '').toLowerCase().replace('_', ' ')}
                  </span>
                </div>
              </div>
              {m.description && <p className="text-sm text-slate-600 mt-1">{m.description}</p>}
              <p className="text-xs text-slate-400 mt-1.5">
                {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ''}
                {m.cost ? ` · $${m.cost}` : ''}
                {m.vendor ? ` · ${m.vendor}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
