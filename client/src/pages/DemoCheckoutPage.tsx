import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { tokens } from '../design-system';

export const DemoCheckoutPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const startDemo = async () => {
    setLoading(true);
    try {
      const response = await api.post('/checkout/session/demo');
      const sessionId = response.data?.data?.sessionId;
      if (sessionId) {
        navigate(`/checkout/${sessionId}`);
      } else {
        toast.error('Demo session creation failed.');
        setLoading(false);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to connect to demo server');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-24 px-4 sm:px-6 flex items-center justify-center font-body" style={{ background: '#0f172a', color: tokens.color.text }}>
      <div className="max-w-xl w-full bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <span className="text-8xl">🛡️</span>
        </div>

        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-lg shadow-indigo-500/20">
          ⚡
        </div>

        <h1 className="font-headline text-3xl font-black text-white mb-3">Pabandi Demo Checkout</h1>
        <p className="text-slate-300 text-sm max-w-md mx-auto mb-8 leading-relaxed">
          Test our trust-based smart escrow checkout. Experience deposit locks, milestone tracking, and instant Solana payouts in simulated sandbox mode.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-8 text-left">
          <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-bold text-indigo-400 mb-1">1. Deposit Lock</p>
            <p className="text-[11px] text-slate-400">Funds locked safely in Web3 smart contract</p>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-bold text-cyan-400 mb-1">2. Verification</p>
            <p className="text-[11px] text-slate-400">AI arbitration and milestone approval</p>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-bold text-emerald-400 mb-1">3. Instant Release</p>
            <p className="text-[11px] text-slate-400">Zero-fee payout to freelancer wallet</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={startDemo}
            disabled={loading}
            className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 text-white font-headline font-bold text-sm px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Initializing Demo Session...' : 'Start Demo Checkout →'}
          </button>
          <Link
            to="/"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-headline font-bold text-sm px-6 py-3.5 rounded-xl transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};
