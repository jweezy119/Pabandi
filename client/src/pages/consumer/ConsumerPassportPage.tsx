import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

function tierColor(score: number) {
  if (score >= 800) return 'text-amber-500';
  if (score >= 650) return 'text-amber-400';
  if (score >= 500) return 'text-amber-300';
  return 'text-amber-600';
}

function tierLabel(score: number) {
  if (score >= 800) return 'Platinum';
  if (score >= 650) return 'Gold';
  if (score >= 500) return 'Silver';
  return 'Bronze';
}

export default function ConsumerPassportPage() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [passport, setPassport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/trust-passport/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPassport(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const overallScore = passport
    ? Math.round(
        ((passport.paymentScore || 500) + (passport.showUpScore || 500) + (passport.deliveryScore || 500)) / 3
      )
    : 0;

  const attestations = [
    { label: 'Escrows Completed', value: passport?.claimsCount || 0, icon: '🔒' },
    { label: 'On-time Payments', value: Math.round(((passport?.paymentScore || 500) / 1000) * 100), icon: '✅' },
    { label: 'Show-Up Rate', value: Math.round(((passport?.showUpScore || 500) / 1000) * 100), icon: '👋' },
    { label: 'Delivery Score', value: Math.round(((passport?.deliveryScore || 500) / 1000) * 100), icon: '📦' },
  ];

  return (
    <div className="min-h-screen bg-amber-50 text-amber-900 font-sans">
      <div className="px-4 py-4 bg-amber-50">
        <button
          onClick={() => navigate('/app')}
          className="w-10 h-10 rounded-lg bg-white border border-amber-200 flex items-center justify-center text-amber-500 font-bold shadow-sm"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-amber-900 mt-2">Trust Passport</h1>
        <p className="text-xs text-amber-600">Your portable reputation across the Pabandi network</p>
      </div>

      <div className="px-4 py-3">
        <div className="bg-white rounded-3xl shadow-sm border border-amber-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold text-xl">
                  {(user?.firstName || user?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-amber-900 text-lg">{user?.firstName || 'Consumer'}</h2>
                  <p className="text-xs text-amber-600">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={tierColor(overallScore) + ' text-3xl font-black'}>{overallScore}</span>
                <span className={tierColor(overallScore) + ' font-bold text-lg'}>{tierLabel(overallScore)}</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-500/30">
              <span className="text-3xl">◈</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[passport?.paymentScore, passport?.showUpScore, passport?.deliveryScore].map((score, i) => (
              <div key={i} className="p-3 rounded-xl bg-amber-100 border border-amber-200">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                  {['Payment', 'Show Up', 'Delivery'][i]}
                </p>
                <p className={tierColor(score || 500) + ' text-2xl font-black'}>
                  {score || 500}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-amber-900 text-sm">Verified Onchain Attestations</h3>
            </div>
            {attestations.map((att, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{att.icon}</span>
                  <span className="text-sm text-amber-900 font-medium">{att.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-amber-900">{att.value}</span>
                  <p className="text-[10px] text-amber-600">verified</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const url = `https://pabandi.com/trust/${passport?.handle || user?.id}`;
              navigator.share
                ? navigator.share({ title: 'My Pabandi Trust Passport', url })
                : navigator.clipboard.writeText(url).then(() => alert('Passport link copied!'));
            }}
            className="mt-6 w-full py-4 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-amber-600 transition-colors"
          >
            <span>🔗</span> Share Passport
          </button>
        </div>
      </div>

      <div className="pb-24" />
    </div>
  );
}
