import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheckIcon, ExclamationTriangleIcon, FingerPrintIcon, LockClosedIcon, CheckCircleIcon, ArrowPathIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { ShareIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import IDL from '../utils/pabandi_escrow.json';

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
  gateway?: string;
  providerUrl?: string;
  successUrl?: string;
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

  const PROGRAM_ID = new PublicKey('6ebgdhyUV7zEHqRmpnaPguWQPYJu9Vq4dpFs79VduTjG');

  const isAnchorAvailable = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const anchorModule = require('@coral-xyz/anchor');
      return Boolean(anchorModule);
    } catch {
      return false;
    }
  };

  const handlePayment = async () => {
    if (!session) return;

    if (!phantomWallet) {
      toast.error('Please connect your Phantom Wallet to proceed.');
      return;
    }

    if (!isAnchorAvailable()) {
      toast.error('Solana escrow checkout is temporarily unavailable. Please use Credit Card checkout.');
      return;
    }

    setPaying(true);
    try {
      const anchor = require('@coral-xyz/anchor') as any;
      const AnchorProvider = anchor.AnchorProvider;
      const BN = anchor.BN;
      const Program = anchor.Program;
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const provider = new AnchorProvider(connection, (window as any).solana, { commitment: 'confirmed' });
      const program = new Program(IDL as any, provider);

      const customerPubkey = new PublicKey(phantomWallet);
      const mintPubkey = new PublicKey(import.meta.env.VITE_SOLANA_PAB_MINT_ADDRESS || 'PAB1111111111111111111111111111111111111111');
      const oraclePubkey = new PublicKey(import.meta.env.VITE_SOLANA_ORACLE_PUBKEY || 'oracle1111111111111111111111111111111111111');

      // Use the session.id as the reservation_id for the escrow
      const reservationId = session.id;

      const [escrowStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow_state'), Buffer.from(reservationId), customerPubkey.toBuffer()],
        PROGRAM_ID
      );
      const [vaultTokenPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow_vault'), Buffer.from(reservationId), customerPubkey.toBuffer()],
        PROGRAM_ID
      );
      const customerTokenAccount = getAssociatedTokenAddressSync(mintPubkey, customerPubkey);

      toast('Building transaction...', { icon: '🏗️' });

      // Build the initialize_escrow instruction
      const ix = await program.methods
        .initializeEscrow(
          reservationId,
          new BN(user?.trustScore || 50),
          new BN(session.amount * 10 ** 9),
          new BN(Math.floor(Date.now() / 1000) + 86400) // 24h deadline
        )
        .accounts({
          customer: customerPubkey,
          escrowState: escrowStatePDA,
          vaultTokenAccount: vaultTokenPDA,
          customerTokenAccount,
          mint: mintPubkey,
          oracle: oraclePubkey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: customerPubkey,
      }).add(ix);

      // We serialize without signing to send to the backend Oracle
      const serializedTxBase64 = transaction.serialize({ requireAllSignatures: false }).toString('base64');

      // 1. Get partially signed transaction from Backend Oracle
      toast('Requesting Oracle Signature...', { icon: '🔮' });
      const txRes = await api.post('/escrow/sign-init-tx', {
        serializedTxBase64,
        customerWallet: phantomWallet,
        sponsorFees: isGasless, // Tell backend treasury to sign as fee payer
      });

      if (!txRes.data.success) throw new Error('Oracle rejected the transaction');

      // 2. Deserialize txRes.data.data.signedTxBase64 and prompt Phantom to sign
      toast('Confirming via Phantom...', { icon: '👻' });
      const partiallySignedTx = Transaction.from(Buffer.from(txRes.data.data.signedTxBase64, 'base64'));

      // Request signature from user
      const signedTx = await (window as any).solana.signTransaction(partiallySignedTx);

      // Broadcast to network
      const txSignature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txSignature, 'confirmed');

      // 3. Mark session complete
      const response = await api.post(`/checkout/session/${session.id}/complete`, {
        transactionHash: txSignature,
      });
      if (response.data.success && response.data.data.redirectUrl) {
        toast.success('Payment accepted and escrow locked!');
        window.location.href = response.data.data.redirectUrl;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Payment failed');
      setPaying(false);
    }
  };

  const handleStripePayment = async () => {
    if (!session || session.gateway === 'safepay') return;
    setPaying(true);
    try {
      const response = await api.post(`/checkout/session/${session.id}/stripe`);
      if (response.data.success && response.data.data.url) {
        window.location.href = response.data.data.url;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to initiate Stripe payment');
      setPaying(false);
    }
  };

  const handleSafepayPayment = () => {
    if (!session?.providerUrl) return;
    window.location.href = session.providerUrl;
  };

  const handleEscrowPayment = async () => {
    if (!session) return;
    try {
      setPaying(true);
      if (!session.providerUrl) {
        const response = await api.post(`/checkout/session/${session.id}/escrow`, {
          buyerEmail: session.successUrl || 'buyer@pabandi.com',
          sellerEmail: 'seller@pabandi.com',
        });
        if (response.data?.success && response.data?.data?.url) {
          window.location.href = response.data.data.url;
          return;
        }
        throw new Error(response.data?.error || 'Failed to start Escrow.com checkout');
      }
      window.location.href = session.providerUrl;
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to initiate Escrow.com payment');
      setPaying(false);
    }
  };

  const shareOnWhatsApp = () => {
    if (!session) return;
    const text = encodeURIComponent(
      `Pay securely with Pabandi escrow.\nAmount: ${session.amount} ${session.currency}\nLink: ${window.location.origin}/checkout/${session.id}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleTapPayment = async () => {
    if (!session) return;
    try {
      const payload: any = { sellerId: session.business.id, amount: session.amount };
      if (session.gateway !== 'crypto') payload.currency = 'USDC';
      const response = await api.post('/tap/intents', payload);
      if (response.data?.success && response.data?.data?.id) {
        const intent = response.data.data;
        const merchantUrl = `${window.location.origin}/t/pay/${intent.sellerId}?amount=${encodeURIComponent(intent.amount)}&currency=${encodeURIComponent(intent.currency || 'USDC')}`;
        window.location.href = merchantUrl;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to initiate Tap payment');
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
          <p className="text-zinc-400">
            {(session as any).metadata?.source === 'freelance_escrow' 
              ? 'Fund Escrow Milestone' 
              : 'Secure Escrow Checkout'}
          </p>
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
        <div className="flex flex-col gap-3">
          {session?.gateway === 'safepay' && (
            <button
              onClick={handleSafepayPayment}
              disabled={paying || !session?.providerUrl}
              className="w-full py-4 rounded-xl bg-[#95BF47] text-black font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {paying ? (
                <ArrowPathIcon className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CreditCardIcon className="w-5 h-5" />
                  Pay with SafePay
                </>
              )}
            </button>
          )}

          {(session?.gateway === 'crypto' || session?.currency === 'USDC') && (
            <button
              onClick={handleTapPayment}
              disabled={paying}
              className="w-full py-4 rounded-xl bg-[#14F195] text-black font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {paying ? (
                <ArrowPathIcon className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CreditCardIcon className="w-5 h-5" />
                  Pay with USDC
                </>
              )}
            </button>
          )}

          {session?.gateway === 'escrow' && (
            <button
              onClick={handleEscrowPayment}
              disabled={paying || !session?.providerUrl}
              className="w-full py-4 rounded-xl bg-[#1F2937] text-white font-bold text-lg border border-indigo-500/40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {paying ? (
                <ArrowPathIcon className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CreditCardIcon className="w-5 h-5" />
                  Pay with Escrow.com
                </>
              )}
            </button>
          )}

          {session?.gateway !== 'safepay' && session?.currency !== 'USDC' && session?.gateway !== 'crypto' && session?.gateway !== 'escrow' && (
            <>
              <button
                onClick={handleStripePayment}
                disabled={paying}
                className="w-full py-4 rounded-xl bg-indigo-500 text-white font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
              >
                {paying ? (
                  <ArrowPathIcon className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <CreditCardIcon className="w-5 h-5" />
                    Pay with Credit Card
                  </>
                )}
              </button>
              
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink-0 mx-4 text-zinc-500 text-xs font-bold uppercase">Or pay with Crypto</span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

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
                    Pay with Solana ($PAB)
                  </>
                )}
              </button>
            </>
          )}
        </div>

        <div className="mt-3">
          <button
            onClick={shareOnWhatsApp}
            className="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-sm border border-zinc-800 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <ShareIcon className="w-4 h-4" />
            Share checkout on WhatsApp
          </button>
        </div>

        <p className="text-center text-xs text-zinc-500 mt-4">
          Protected by Pabandi Escrow. Funds are not released to the seller until terms are met.
        </p>
      </div>
    </div>
  );
};
