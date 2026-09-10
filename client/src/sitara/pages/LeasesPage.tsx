// Sitara OS — Leases Page (real property backend)
// Create by tenant email + dates + rent; live list with terms.
import { useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';
import { useRental, RentalGate } from '../utils/useRental';

export default function LeasesPage() {
  const { data, loading, enrolled, enrolling, enroll, refresh } = useRental();
  const [showCreate, setShowCreate] = useState(false);
  const [tenantEmail, setTenantEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const leases: any[] = data?.leases || [];

  const handleCreate = async () => {
    if (!tenantEmail.trim() || !startDate || !endDate || !rentAmount) return;
    setSaving(true);
    setNotice(null);
    try {
      await sitaraApi.rentalAddLease({
        tenantEmail: tenantEmail.trim(),
        startDate,
        endDate,
        rentAmount: Number(rentAmount),
      });
      setNotice({ ok: true, text: 'Lease created.' });
      setTenantEmail('');
      setStartDate('');
      setEndDate('');
      setRentAmount('');
      setShowCreate(false);
      await refresh();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.response?.data?.error || 'Could not create lease.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm p-8">Loading leases…</p>;
  if (!enrolled) return <RentalGate onEnroll={(n) => void enroll(n)} enrolling={enrolling} />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leases</h1>
          <p className="text-slate-600 mt-1">{leases.length} on record · live</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          + Create Lease
        </button>
      </div>

      {notice && (
        <div className={`rounded-lg p-3 mb-4 text-sm font-medium ${notice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.text}
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} placeholder="Tenant email *" inputMode="email" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <input value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} placeholder="Monthly rent $ *" inputMode="decimal" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <button onClick={() => void handleCreate()} disabled={saving} className="sm:col-span-2 px-4 py-2.5 bg-amber-500 text-white font-medium rounded-lg disabled:opacity-50">
            {saving ? 'Creating…' : 'Create lease'}
          </button>
        </div>
      )}

      {leases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="font-semibold text-slate-900 mb-1">No leases yet</p>
          <p className="text-sm text-slate-500">Create one above — tenant email, dates, rent. That's the whole form.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {leases.map((l: any) => (
            <div key={l.id} className="tile bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div>
                  <h3 className="font-semibold text-slate-900">{l.tenantName || l.tenantEmail || 'Lease'}</h3>
                  <p className="text-sm text-slate-500">{l.tenantEmail || ''}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${l.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                  {String(l.status || '').toLowerCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-slate-500">Start</p><p className="font-medium">{l.startDate ? new Date(l.startDate).toLocaleDateString() : '—'}</p></div>
                <div><p className="text-slate-500">End</p><p className="font-medium">{l.endDate ? new Date(l.endDate).toLocaleDateString() : '—'}</p></div>
                <div><p className="text-slate-500">Rent</p><p className="font-medium">${l.rentAmount ?? '—'}/mo</p></div>
                <div><p className="text-slate-500">Deposit</p><p className="font-medium">{l.depositAmount != null ? `$${l.depositAmount}` : '—'}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
