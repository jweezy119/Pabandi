// Sitara OS — Promos Page (Operator)
// Live promo list with redemption counts + a create form.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';

export default function PromosPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    value: 10,
    promoType: 'PERCENT',
    targetTier: '',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  const load = async (bizId: string) => {
    try {
      setPromos(await sitaraApi.listPromos(bizId));
    } catch {
      setPromos([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const biz = await sitaraApi.myBusiness().catch(() => null);
        if (biz?.id) {
          setBusinessId(biz.id);
          await load(biz.id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreate = async () => {
    if (!businessId || !form.title.trim() || !form.description.trim()) return;
    setCreating(true);
    setNotice(null);
    try {
      const promo = await sitaraApi.sendPromo({
        businessId,
        targetTier: form.targetTier || null,
        title: form.title.trim(),
        description: form.description.trim(),
        value: Number(form.value),
        promoType: form.promoType,
        expiresAt: new Date(form.expiresAt).toISOString(),
      });
      setNotice({ ok: true, text: `Promo created — code ${promo?.code || ''}` });
      setShowCreate(false);
      setForm({ ...form, title: '', description: '' });
      await load(businessId);
    } catch (e: any) {
      setNotice({ ok: false, text: e?.response?.data?.error || 'Could not create promo.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Promos</h1>
          <p className="text-slate-600 mt-1">Offers to your customers, redeemed by code at the venue</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
        >
          + Create Promo
        </button>
      </div>

      {notice && (
        <div className={`rounded-lg p-4 mb-6 text-sm font-medium ${notice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.text}
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title (e.g. 20% Off Weekends)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <select
                value={form.promoType}
                onChange={(e) => setForm({ ...form, promoType: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="PERCENT">% off</option>
                <option value="FIXED">$ off</option>
                <option value="FREE_SERVICE">Free service</option>
              </select>
            </div>
            <div className="flex gap-2">
              <select
                value={form.targetTier}
                onChange={(e) => setForm({ ...form, targetTier: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">All tiers</option>
                <option value="sitara-e-noor">Sitara-e-Noor+</option>
                <option value="sitara-e-roshan">Sitara-e-Roshan+</option>
                <option value="sitara-e-darakshan">Sitara-e-Darakshan+</option>
                <option value="sitara-e-izzat">Sitara-e-Izzat</option>
              </select>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => void handleCreate()}
            disabled={creating || !form.title.trim()}
            className="px-6 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create Promo'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading promos…</p>
      ) : !businessId ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
          No business connected.{' '}
          <Link to="/business/register" className="text-amber-600 font-medium">Register your business</Link>{' '}
          to send promos.
        </div>
      ) : promos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
          No promos yet — create one above or send targeted offers from{' '}
          <Link to="/sitara/operator/star-finder" className="text-amber-600 font-medium">Star Finder</Link>.
        </div>
      ) : (
        <div className="space-y-4">
          {promos.map((promo: any) => (
            <div key={promo.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{promo.title}</h3>
                  <p className="text-sm text-slate-600">
                    Code <code className="font-mono font-semibold">{promo.code}</code>
                    {' · '}
                    {promo.targetTier ? `${promo.targetTier}` : 'All tiers'}
                    {' · expires '}
                    {new Date(promo.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-slate-900">
                    {promo.promoType === 'PERCENT' ? `${promo.value}%` : promo.value > 0 ? `$${promo.value}` : '★'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {promo._count?.redemptions ?? promo.redeemedCount ?? 0} redeemed
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${promo.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                  {promo.isActive ? 'active' : 'inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
