import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { partnerRewardsService } from '../services/api';
import { useAuthStore } from '../store/authStore';

const CATEGORIES = ['FOOD', 'RETAIL', 'SERVICES', 'TRAVEL', 'HEALTH', 'OTHER'];

export const RewardsPage: React.FC = () => {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('');
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadOffers();
  }, [category]);

  const loadOffers = async () => {
    setLoading(true);
    try {
      const res = await partnerRewardsService.listOffers({ category: category || undefined });
      setOffers(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load offers:', e);
    } finally {
      setLoading(false);
    }
  };

  const redeemOffer = async (offerId: string) => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    setRedeeming(offerId);
    try {
      const res = await partnerRewardsService.redeem(offerId);
      const code = res.data?.data?.redemptionCode;
      alert(`Offer redeemed! Your code: ${code}\nShow this at the business to claim your reward.`);
      loadOffers();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to redeem');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: tokens.color.background, fontFamily: tokens.font.body }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Rewards & Offers</h1>
          <p className="mt-2 text-slate-400">Earn rewards at businesses you already shop at.</p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setCategory('')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${!category ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === cat ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Offers Grid */}
        {loading ? (
          <p className="text-slate-400">Loading offers...</p>
        ) : offers.length === 0 ? (
          <Surface className="p-8 text-center">
            <div className="text-4xl mb-4">🎁</div>
            <p className="text-slate-400">No offers available yet. Check back soon!</p>
          </Surface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map((offer) => (
              <Surface key={offer.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge tone="info">{offer.category}</Badge>
                  <span className="text-xs text-slate-500">
                    {offer.totalRedeemed}/{offer.maxRedeemed} claimed
                  </span>
                </div>
                <h3 className="font-bold text-white text-lg">{offer.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{offer.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <span className="text-emerald-300 font-bold">
                      {offer.rewardType === 'PERCENTAGE_OFF' && `${offer.rewardValue}% OFF`}
                      {offer.rewardType === 'FIXED_OFF' && `$${offer.rewardValue} OFF`}
                      {offer.rewardType === 'CASHBACK_PAB' && `${offer.rewardValue}% Cashback`}
                      {offer.rewardType === 'FREE_ITEM' && 'FREE ITEM'}
                    </span>
                    {offer.minPurchase && (
                      <span className="text-xs text-slate-500 ml-2">
                        Min. purchase ${offer.minPurchase}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => redeemOffer(offer.id)}
                    disabled={redeeming === offer.id}
                  >
                    {redeeming === offer.id ? '...' : 'Redeem'}
                  </Button>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Valid until {new Date(offer.endsAt).toLocaleDateString()}
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardsPage;
