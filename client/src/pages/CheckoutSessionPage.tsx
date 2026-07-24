import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheckIcon, ExclamationTriangleIcon, FingerPrintIcon, LockClosedIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';

// Simple Phantom provider interface for MVP
interface PhantomProvider {
  isPhantom: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signTransaction: (transaction: any) => Promise<any>;
}

interface CheckoutSession {
  id: string;
  amount: number;
  currency: string;
  status: string;
  escrowTerms?: {
    depositPercentage?: number;
    description?: string;
  };
  business: {
    id: string;
    name: string;
    logoUrl?: string;
    trustScore: number;
    isVerified: boolean;
  };
}

export const CheckoutSessionPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [phantomWallet, setPhantomWallet] = useState<string | null>(null);
  const [isGasless, setIsGasless] = useState(true); // UX Abstraction: Pabandi pays network fees
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await api.get(`/checkout/session/${sessionId}`);
        if (response.data.success) {
          setSession(response.data.data);
        } else {
          toast.error('Failed to load checkout session');
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to load checkout session');
      } finally {
        setLoading(false);
      }
    };
    if (sessionId) fetchSession();
  }, [sessionId]);

  const connectPhantom = async () => {
    try {
      const provider = (window as any).solana as PhantomProvider;
      if (provider?.isPhantom) {
        const resp = await provider.connect();
        setPhantomWallet(resp.publicKey.toString());
        toast.success('Phantom Wallet Connected!');
      } else {
        toast.error('Please install Phantom Wallet extension.');
        window.open('https://phantom.app/', '_blank');
      }
    } catch (err) {
      toast.error('Failed to connect Phantom wallet.');
    }
  };

  const handlePayment = async () => {
    if (!session) return;
    
    if (!phantomWallet) {
      toast.error('Please connect your Phantom Wallet to proceed.');
      return;
    }

    setPaying(true);
    try {
      // 1. Get partially signed transaction from Backend Oracle
      toast('Requesting Oracle Signature...', { icon: '🔮' });
      const txRes = await api.post('/escrow/sign-init-tx', {
        serializedTxBase64: btoa('dummy_transaction_payload_for_prototype'),
        customerWallet: phantomWallet,
        sponsorFees: isGasless // Tell backend treasury to sign as fee payer
      });

      if (!txRes.data.success) throw new Error('Oracle rejected the transaction');

      // 2. (In production: deserialize txRes.data.data.signedTxBase64 and prompt Phantom to sign)
      toast('Confirming via Phantom...', { icon: '👻' });
      await new Promise(r => setTimeout(r, 1500)); // Simulating wallet delay

      // 3. Mark session complete
      const response = await api.post(`/checkout/session/${session.id}/complete`);
      if (response.data.success && response.data.data.redirectUrl) {
        toast.success('Payment accepted and escrow locked!');
        window.location.href = response.data.data.redirectUrl;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Payment failed');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <ArrowPathIcon className="w-8 h-8 text-[#95BF47] animate-spin" />
      </div>
    );
  }

  if (!session || session.status !== 'PENDING') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Invalid or Expired Session</h1>
        <p className="text-zinc-400 text-center max-w-md">
          This checkout session is no longer active. Please contact the seller for a new link.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-lg bg-[#121212] rounded-3xl border border-zinc-800 p-6 md:p-8 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#95BF47]/10 blur-[100px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-20 h-20 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center mb-4 overflow-hidden">
            {session.business.logoUrl ? (
              <img src={session.business.logoUrl} alt={session.business.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-zinc-400">{session.business.name.charAt(0)}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {session.business.name}
            {session.business.isVerified && <CheckCircleIcon className="w-5 h-5 text-blue-500" />}
          </h1>
          <p className="text-zinc-400">Secure Escrow Checkout</p>
        </div>

        {/* Amount */}
        <div className="text-center mb-8">
          <div className="text-5xl font-extrabold text-white">
            ${session.amount.toFixed(2)}
          </div>
          <p className="text-zinc-500 uppercase mt-1 tracking-wider text-sm font-semibold">{session.currency}</p>
        </div>

        {/* Risk Oracle (Buyer Side) */}
        <div className="bg-[#181818] rounded-2xl p-4 border border-zinc-800 mb-6">
          <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
            <ShieldCheckIcon className="w-4 h-4 text-[#95BF47]" />
            Pabandi Risk Oracle
          </h3>
          <div className="flex items-start gap-3">
            {user ? (
              <>
                <div className="p-2 bg-[#95BF47]/10 rounded-full shrink-0">
                  <ShieldCheckIcon className="w-5 h-5 text-[#95BF47]" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Passport Verified</p>
                  <p className="text-xs text-zinc-400 mt-1">Your trust score allows for deferred escrow. The seller is protected by our guarantee network.</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 bg-orange-500/10 rounded-full shrink-0">
                  <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Guest Checkout</p>
                  <p className="text-xs text-zinc-400 mt-1">Funds will be held in a smart escrow until both parties confirm fulfillment.</p>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-zinc-800">
            {phantomWallet ? (
              <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg border border-purple-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-xs">👻</span>
                  </div>
                  <span className="text-sm font-mono text-zinc-300">
                    {phantomWallet.slice(0, 4)}...{phantomWallet.slice(-4)}
                  </span>
                </div>
                <span className="text-xs text-green-400 font-bold">Connected</span>
              </div>
            ) : (
              <button 
                onClick={connectPhantom}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#AB9FF2] text-black font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Connect Phantom Wallet
              </button>
            )}
          </div>
        </div>

        {/* Gasless / Network Fee Abstraction Toggle */}
        <div className="bg-[#181818] rounded-2xl p-4 border border-zinc-800 mb-6 flex items-center justify-between cursor-pointer" onClick={() => setIsGasless(!isGasless)}>
          <div>
            <h3 className="text-sm font-bold text-white">Gasless Checkout</h3>
            <p className="text-xs text-zinc-400 mt-1">Pabandi treasury covers Solana network fees</p>
          </div>
          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isGasless ? 'bg-[#95BF47]' : 'bg-zinc-700'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isGasless ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
        </div>

        {/* Auto-fill Notice */}
        {user && (
          <div className="flex items-center gap-2 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 mb-8">
            <FingerPrintIcon className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-zinc-300">Using Passport to autofill shipping & secure payment details.</p>
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePayment}
          disabled={paying}
          className="w-full py-4 rounded-xl bg-[#95BF47] text-black font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {paying ? (
            <ArrowPathIcon className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <LockClosedIcon className="w-5 h-5" />
              Pay & Secure Funds
            </>
          )}
        </button>

        <p className="text-center text-xs text-zinc-500 mt-4">
          Protected by Pabandi Escrow. Funds are not released to the seller until terms are met.
        </p>
      </div>
    </div>
  );
};
