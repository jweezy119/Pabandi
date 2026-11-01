import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayBadge } from '../../components/primitives';
import { useAuthStore } from '../../store/authStore';
import { getAuthToken } from '../../utils/authToken';

type TrustScore = {
  score?: number;
  tier?: string;
  verifiedIdentity?: boolean;
  badges?: string[];
};

type EscrowJob = {
  id: string;
  businessName: string;
  service: string;
  amount: number;
  status: 'PENDING' | 'FUNDED' | 'WORK_COMPLETED' | 'DELIVERED' | 'RELEASED';
  deliverableHash?: string;
  createdAt?: string;
  providerPassportId?: string;
};

function tierLabel(score: number) {
  if (score >= 800) return 'Platinum';
  if (score >= 650) return 'Gold';
  if (score >= 500) return 'Silver';
  return 'Bronze';
}

function tierColor(score: number) {
  if (score >= 800) return 'text-emerald-500';
  if (score >= 650) return 'text-amber-400';
  if (score >= 500) return 'text-slate-400';
  return 'text-dusty-rose';
}

export default function PersonalDashboardPage() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [trustScore, setTrustScore] = useState<TrustScore>({});
  const [escrows, setEscrows] = useState<EscrowJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [passportRes, escrowsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/trust-passport/me`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/marketplace/escrows/me`, { headers }),
        ]);

        if (passportRes.ok) {
          const data = await passportRes.json();
          setTrustScore({
            score: data.data?.score,
            tier: data.data?.tier,
            verifiedIdentity: data.data?.verifiedIdentity,
            badges: data.data?.badges,
          });
        }

        if (escrowsRes.ok) {
          const escrowData = await escrowsRes.json();
          setEscrows(escrowData.data || escrowData.escrows || []);
        }
      } catch (e) {
        console.error('Failed to load dashboard data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const userName = user?.firstName || 'there';
  const score = trustScore.score ?? 0;
  const tier = tierLabel(score);
  const tierTextColor = tierColor(score);
  const hasActionRequired = escrows.some(e => e.status === 'DELIVERED' || e.status === 'WORK_COMPLETED');

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--clay)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 pb-[env(safe-area-inset-bottom)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-6"
      >
        {/* Hero Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h1 className="text-2xl font-bold text-amber-900">Welcome back, {userName}</h1>
          </div>
          <p className="text-sm text-amber-600">Your personal trust &amp; escrow hub</p>
        </div>

        {/* Trust Passport Card */}
        <div className="mb-6">
          <ClayCard className="bg-white border border-amber-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-amber-900 text-lg">Trust Passport</h2>
                <p className="text-xs text-amber-600">Your portable reputation across Pabandi</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black ${tierTextColor}`}>{score}</span>
                <span className="text-lg font-bold" style={{ color: tierTextColor }}>· {tier}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <p className="text-xs font-bold text-amber-600 uppercase">Payment Score</p>
                <p className="text-xl font-bold text-amber-900">{trustScore.score || 500}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <p className="text-xs font-bold text-amber-600 uppercase">Show Up</p>
                <p className="text-xl font-bold text-amber-900">{trustScore.score || 500}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <p className="text-xs font-bold text-amber-600 uppercase">Delivery</p>
                <p className="text-xl font-bold text-amber-900">{trustScore.score || 500}</p>
              </div>
            </div>
            {trustScore.verifiedIdentity && (
              <div className="mt-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                  Identity Verified
                </span>
              </div>
            )}
          </ClayCard>
        </div>

        {/* Active Escrows */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-amber-900 text-lg">Active Escrows</h2>
            {escrows.length === 0 && (
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">None active</span>
            )}
          </div>

          <AnimatePresence>
            {escrows.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 text-center bg-white rounded-xl border border-amber-200"
              >
                <p className="text-amber-600 text-sm">No active escrows</p>
                <p className="text-xs text-amber-500 mt-1">Funds are held safely until work is verified.</p>
              </motion.div>
            ) : (
              escrows.map((escrow) => {
                const isActionRequired = escrow.status === 'DELIVERED' || escrow.status === 'WORK_COMPLETED';
                return (
                  <motion.div
                    key={escrow.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: escrows.indexOf(escrow) * 0.05 }}
                    className="bg-white rounded-xl shadow-sm border border-amber-200 p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-amber-900 text-sm">{escrow.businessName}</h3>
                        <p className="text-xs text-amber-600">{escrow.service}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {escrow.status === 'RELEASED' ? (
                          <ClayBadge label="Released" variant="success" size="sm" />
                        ) : escrow.status === 'WORK_COMPLETED' || escrow.status === 'DELIVERED' ? (
                          <ClayBadge label="Delivered" variant="warning" size="sm" />
                        ) : escrow.status === 'FUNDED' ? (
                          <ClayBadge label="Funded" variant="info" size="sm" />
                        ) : (
                          <ClayBadge label="Pending" variant="neutral" size="sm" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-2xl font-black text-amber-900">${escrow.amount}</span>
                      <span className="text-xs text-amber-600">in escrow</span>
                    </div>

                    {isActionRequired && (
                      <button
                        onClick={() => navigate(`/app/release/${escrow.id}`)}
                        className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-amber-600 transition-colors"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Review &amp; Release Funds</span>
                      </button>
                    )}

                    {!isActionRequired && (
                      <div className="flex items-center gap-2 text-xs text-amber-500 mt-2">
                        <Clock className="w-3 h-3" />
                        <span>Awaiting provider action</span>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="font-bold text-amber-900 text-lg mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ClayButton
              onClick={() => navigate('/booking')}
              variant="primary"
              className="w-full py-4 flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              Discover Services
            </ClayButton>
            <ClayButton
              onClick={() => navigate('/me/passport')}
              variant="secondary"
              className="w-full py-4 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              My Passport
            </ClayButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
