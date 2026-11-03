import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type TrustScores = {
  paymentScore?: number;
  showUpScore?: number;
  deliveryScore?: number;
};

type EscrowItem = {
  id: string;
  businessName: string;
  service: string;
  amount: number;
  status: string;
  createdAt?: string;
};

type BusinessItem = {
  id: string;
  name: string;
  category: string;
  rating: number;
  image?: string;
};

const tierForScore = (score: number) => {
  if (score >= 800) return { label: 'Platinum', color: 'text-amber-500' };
  if (score >= 650) return { label: 'Gold', color: 'text-amber-400' };
  if (score >= 500) return { label: 'Silver', color: 'text-amber-300' };
  return { label: 'Bronze', color: 'text-amber-600' };
};

export default function ConsumerHomePage() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [greetingName, setGreetingName] = useState('');
  const [trustScores, setTrustScores] = useState<TrustScores>({});
  const [activeEscrows, setActiveEscrows] = useState<EscrowItem[]>([]);
  const [discoverBusinesses, setDiscoverBusinesses] = useState<BusinessItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGreetingName(user?.firstName || user?.email?.split('@')[0] || 'there');

    fetch('/api/v1/trust-passport/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const p = data.data as any;
          setTrustScores({
            paymentScore: p.paymentScore,
            showUpScore: p.showUpScore,
            deliveryScore: p.deliveryScore,
          });
        }
      })
      .catch(() => { });

    fetch('/api/v1/marketplace/escrows/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setActiveEscrows(data.data || []);
        }
      })
      .catch(() => { });

    fetch('/api/v1/marketplace/listings?limit=10')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setDiscoverBusinesses(data.data.items || data.data || []);
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [token]);

  const overallScore = Math.round(
    ((trustScores.paymentScore || 500) + (trustScores.showUpScore || 500) + (trustScores.deliveryScore || 500)) / 3
  );
  const tier = tierForScore(overallScore);

  return (
    <div className="min-h-screen bg-amber-50 text-amber-900 font-sans">
      <div className="px-4 py-4 bg-amber-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-amber-900">Hello, {greetingName}</h1>
            <p className="text-xs text-amber-600">Your personal trust &amp; escrow hub</p>
          </div>
          <button
            onClick={() => navigate('/app/passport')}
            className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-[var(--warm-ink)] shadow-md"
          >
            <span className="text-sm">◈</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Your Trust Score</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black">{overallScore}</span>
                <span className={tier.color + ' font-bold'}>{tier.label}</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center border border-amber-500/30">
              <span className="text-2xl font-bold text-amber-500">{overallScore > 700 ? '★' : '☆'}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center border-t border-amber-100 pt-3">
            <div>
              <p className="text-xs text-amber-600">Payment</p>
              <p className="text-lg font-bold">{trustScores.paymentScore || 500}</p>
            </div>
            <div>
              <p className="text-xs text-amber-600">Show Up</p>
              <p className="text-lg font-bold">{trustScores.showUpScore || 500}</p>
            </div>
            <div>
              <p className="text-xs text-amber-600">Delivery</p>
              <p className="text-lg font-bold">{trustScores.deliveryScore || 500}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-amber-900">Active Escrows</h2>
        </div>

        {loading && (
          <div className="h-64 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
          </div>
        )}

        {!loading && activeEscrows.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <p className="text-amber-600 text-sm">No active escrows</p>
            <p className="text-xs text-amber-400 mt-1">Funds are held safely until work is verified.</p>
          </div>
        )}

        {!loading && activeEscrows.length > 0 && (
          <div className="space-y-3">
            {activeEscrows.map((escrow) => (
              <div key={escrow.id} className="bg-white rounded-xl shadow-sm border border-amber-200 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-sm">{escrow.businessName}</h3>
                    <p className="text-xs text-amber-600">{escrow.service}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      escrow.status === 'WORK_COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {escrow.status}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-xl font-black">{escrow.amount}</span>
                  <span className="text-xs text-amber-600">in escrow</span>
                </div>

                {escrow.status === 'WORK_COMPLETED' && (
                  <button
                    key={escrow.id}
                    onClick={() => navigate(`/app/release/${escrow.id}`)}
                    className="mt-3 w-full py-3 rounded-xl bg-amber-500 text-[var(--warm-ink)] font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-amber-600 transition-colors"
                  >
                    <span>Review &amp; Release Funds</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-amber-900">Discover Nearby</h2>
          <input
            type="text"
            placeholder="Search businesses..."
            className="w-32 text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {discoverBusinesses.map((biz) => (
            <div key={biz.id} className="w-32 flex-shrink-0 bg-white rounded-xl shadow-sm border border-amber-200 p-3">
              <div className="h-20 rounded-lg bg-amber-100 flex items-center justify-center mb-2">
                <span className="text-lg">{biz.category === 'restaurant' ? '🍽️' : biz.category === 'salon' ? '💇' : biz.category === 'spa' ? '🧖' : '🏪'}</span>
              </div>
              <h4 className="text-sm font-bold line-clamp-1">{biz.name}</h4>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-amber-500 font-bold">★ {biz.rating}</span>
                <span className="text-xs text-amber-600">· {biz.category}</span>
              </div>
            </div>
          ))}
          {discoverBusinesses.length === 0 && (
            <div className="w-32 flex-shrink-0 bg-white rounded-xl shadow-sm border border-amber-200 p-3 flex flex-col items-center justify-center">
              <p className="text-xs text-amber-400">No businesses</p>
            </div>
          )}
        </div>
      </div>

      <div className="pb-20" />
    </div>
  );
}
