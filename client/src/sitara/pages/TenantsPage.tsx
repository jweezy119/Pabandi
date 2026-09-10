// Sitara OS — Tenants Page (real property backend)
// Invite by email (upsert — inviting twice just updates), live list.
import { useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';
import { useRental, RentalGate } from '../utils/useRental';

export default function TenantsPage() {
  const { data, loading, enrolled, enrolling, enroll, refresh } = useRental();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const tenants: any[] = data?.tenants || [];
  const properties: any[] = data?.properties || [];
  const [propertyId, setPropertyId] = useState('');

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await sitaraApi.rentalAddTenant({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        phone: phone.trim() || undefined,
        propertyId: propertyId || undefined,
      });
      setNotice({ ok: true, text: `Tenant ${email.trim()} saved.` });
      setEmail('');
      setFirstName('');
      setPhone('');
      setShowInvite(false);
      await refresh();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.response?.data?.error || 'Could not save tenant.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm p-8">Loading tenants…</p>;
  if (!enrolled) return <RentalGate onEnroll={(n) => void enroll(n)} enrolling={enrolling} />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tenants</h1>
          <p className="text-slate-600 mt-1">{tenants.length} on record · live</p>
        </div>
        <button onClick={() => setShowInvite(!showInvite)} className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
          + Invite Tenant
        </button>
      </div>

      {notice && (
        <div className={`rounded-lg p-3 mb-4 text-sm font-medium ${notice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.text}
        </div>
      )}

      {showInvite && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" inputMode="email" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white">
            <option value="">No property yet</option>
            {properties.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <button onClick={() => void handleInvite()} disabled={saving} className="sm:col-span-2 px-4 py-2.5 bg-amber-500 text-white font-medium rounded-lg disabled:opacity-50">
            {saving ? 'Saving…' : 'Save tenant'}
          </button>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="font-semibold text-slate-900 mb-1">No tenants yet</p>
          <p className="text-sm text-slate-500">Invite your first tenant above — they become screenable, leaseable, billable.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Tenant</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Deposit held</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tenants.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {[t.firstName, t.lastName].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-xs text-slate-500">{t.email}{t.phone ? ` · ${t.phone}` : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {String(t.status || '').toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {t.depositHeld ? `$${t.depositHeld}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
