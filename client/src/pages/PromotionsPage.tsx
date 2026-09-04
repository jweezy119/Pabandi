import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { promotionsService } from '../services/api';
import { useAuthStore } from '../store/authStore';

const PROMO_TYPES = [
  { value: 'DISCOUNT_PERCENT', label: '% Off' },
  { value: 'DISCOUNT_FIXED', label: '$ Off' },
  { value: 'FREE_SHIPPING', label: 'Free Shipping' },
  { value: 'BOGO', label: 'BOGO' },
  { value: 'VOLUME_DISCOUNT', label: 'Volume' },
];

export const PromotionsPage: React.FC = () => {
  const [tab, setTab] = useState<'browse' | 'create' | 'my-promotions'>('browse');
  const [promotions, setPromotions] = useState<any[]>([]);
  const [myPromotions, setMyPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'browse') {
        const res = await promotionsService.listPromotions({});
        setPromotions(res.data?.data || []);
      } else if (tab === 'my-promotions') {
        const res = await promotionsService.getMyPromotions();
        setMyPromotions(res.data?.data || []);
      }
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  const redeemPromotion = async (id: string) => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    setRedeeming(id);
    try {
      const res = await promotionsService.redeem(id);
      const code = res.data?.data?.redemptionCode;
      alert(`Promotion redeemed! Code: ${code}\nShow this at checkout.`);
      loadData();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to redeem');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Promotions & Loyalty</h1>
          <p className="mt-2 text-slate-400">Exclusive deals from vendors you shop at. Earn loyalty rewards.</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('browse')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'browse' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            Browse Promotions
          </button>
          <button
            onClick={() => setTab('create')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'create' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            Create Promotion
          </button>
          <button
            onClick={() => setTab('my-promotions')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'my-promotions' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            My Promotions
          </button>
        </div>

        {tab === 'browse' && (
          <div className="space-y-4">
            {loading ? (
              <p className="text-slate-400">Loading...</p>
            ) : promotions.length === 0 ? (
              <Surface className="p-8 text-center">
                <div className="text-4xl mb-4">🏷️</div>
                <p className="text-slate-400">No promotions available. Check back soon!</p>
              </Surface>
            ) : (
              promotions.map((promo) => (
                <Surface key={promo.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white">{promo.title}</h3>
                        <Badge tone="success">
                          {PROMO_TYPES.find(t => t.value === promo.promotionType)?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">{promo.description}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {promo.business?.name} · {promo.business?.address}
                      </p>
                      {promo.minPurchase && (
                        <p className="text-xs text-slate-500">Min. purchase: ${promo.minPurchase}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-300 text-lg">
                        {promo.promotionType === 'DISCOUNT_PERCENT' && `${promo.value}%`}
                        {promo.promotionType === 'DISCOUNT_FIXED' && `$${promo.value}`}
                        {promo.promotionType === 'FREE_SHIPPING' && 'FREE'}
                        {promo.promotionType === 'BOGO' && 'BOGO'}
                        {promo.promotionType === 'VOLUME_DISCOUNT' && `${promo.value}%`}
                      </div>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => redeemPromotion(promo.id)}
                        disabled={redeeming === promo.id}
                      >
                        {redeeming === promo.id ? '...' : 'Redeem'}
                      </Button>
                    </div>
                  </div>
                </Surface>
              ))
            )}
          </div>
        )}

        {tab === 'create' && <CreatePromotionForm onSuccess={loadData} />}
        {tab === 'my-promotions' && (
          <div className="space-y-4">
            {loading ? (
              <p className="text-slate-400">Loading...</p>
            ) : myPromotions.length === 0 ? (
              <Surface className="p-8 text-center">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-slate-400">You haven't created any promotions yet.</p>
              </Surface>
            ) : (
              myPromotions.map((promo) => (
                <Surface key={promo.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white">{promo.title}</h3>
                      <p className="text-sm text-slate-400">{promo.description}</p>
                      <p className="text-xs text-slate-500">
                        {promo.totalRedeemed} redemptions · ${promo.totalSavings.toFixed(2)} total savings
                      </p>
                    </div>
                    <Badge tone={promo.isActive ? 'success' : 'info'}>
                      {promo.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </Surface>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CreatePromotionForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { isAuthenticated } = useAuthStore();
  const [form, setForm] = useState({
    businessId: '',
    title: '',
    description: '',
    promotionType: 'DISCOUNT_PERCENT',
    value: '',
    minPurchase: '',
    maxDiscount: '',
    quantityLimit: '',
    perCustomerLimit: '1',
    customerSegments: ['ALL'],
    categories: [],
    startsAt: '',
    endsAt: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    setSubmitting(true);
    try {
      await promotionsService.createPromotion({
        ...form,
        value: Number(form.value),
        minPurchase: form.minPurchase ? Number(form.minPurchase) : undefined,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        quantityLimit: form.quantityLimit ? Number(form.quantityLimit) : undefined,
        perCustomerLimit: Number(form.perCustomerLimit),
        startsAt: new Date(form.startsAt),
        endsAt: new Date(form.endsAt),
      });
      onSuccess();
      alert('Promotion created!');
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to create promotion');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Surface className="p-8 text-center">
        <div className="text-4xl mb-4">🔐</div>
        <p className="text-white font-semibold">Sign in to create a promotion</p>
        <Button className="mt-4" onClick={() => window.location.href = '/login'}>Sign In</Button>
      </Surface>
    );
  }

  return (
    <Surface className="p-6">
      <h3 className="text-lg font-bold text-white mb-4">Create New Promotion</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Summer Sale - 20% Off"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Promotion Type</label>
            <select
              value={form.promotionType}
              onChange={(e) => setForm({ ...form, promotionType: e.target.value })}
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
            >
              {PROMO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the promotion..."
            rows={3}
            className="w-full rounded-lg px-4 py-3 outline-none resize-none bg-white/5 border border-white/10 text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Value *</label>
            <input
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="20"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Min. Purchase ($)</label>
            <input
              type="number"
              value={form.minPurchase}
              onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
              placeholder="50"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Max Discount ($)</label>
            <input
              type="number"
              value={form.maxDiscount}
              onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
              placeholder="100"
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Start Date *</label>
            <input
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">End Date *</label>
            <input
              type="date"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className="w-full rounded-lg px-4 py-3 outline-none bg-white/5 border border-white/10 text-white"
              required
            />
          </div>
        </div>

        <Button type="submit" disabled={submitting} className="w-full py-4">
          {submitting ? 'Creating...' : 'Create Promotion'}
        </Button>
      </form>
    </Surface>
  );
};

export default PromotionsPage;
