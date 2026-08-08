import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircleIcon, ShareIcon, XCircleIcon, ArrowPathIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { tokens } from '../design-system';
import api from '../services/api';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState('0.00');
  const [business, setBusiness] = useState('Business');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    const amountParam = searchParams.get('amount');
    const businessParam = searchParams.get('business');
    const statusParam = searchParams.get('status');

    setAmount(amountParam || '0.00');
    setBusiness(businessParam || 'Business');
    setStatus(statusParam);

    let cancelled = false;
    if (sessionId) {
      (async () => {
        try {
          const response = await api.get(`/checkout/session/${sessionId}`);
          if (!cancelled && response.data?.success) {
            const s = response.data.data?.status;
            if (s) setStatus(s);
          }
        } catch (err: any) {
          if (!cancelled) setError(err?.response?.data?.message || 'Unable to verify checkout status');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [searchParams]);

  const handleShare = () => {
    const text = `I just booked ${business} through Pabandi escrow for $${amount}! Protected by smart contracts. Check it out: https://pabandi.com`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    window.location.href = whatsappUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
        <div className="flex items-center gap-2 text-white/70">
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
          Verifying payment...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#121212] p-8 text-center">
          <h1 className="font-headline text-2xl font-bold text-white">We could not verify this payment</h1>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
          <Link to="/" className="mt-6 inline-block rounded-xl bg-zinc-900 px-5 py-3 font-bold text-white hover:bg-zinc-800">Back to Home</Link>
        </div>
      </div>
    );
  }

  const terminalStatus = String(status || '').toUpperCase();
  const isPaid = terminalStatus === 'PAID' || terminalStatus === 'COMPLETED';
  const isCancelled = terminalStatus === 'CANCELLED' || terminalStatus === 'EXPIRED' || terminalStatus === 'FAILED';

  const icon = isPaid
    ? <CheckCircleIcon className="w-10 h-10 text-[#14F195]" />
    : <XCircleIcon className="w-10 h-10 text-red-400" />;
  const title = isPaid ? 'Payment confirmed' : isCancelled ? 'Payment not completed' : 'Payment status';
  const subtitle = isPaid
    ? 'Funds are secured in Pabandi escrow.'
    : isCancelled
      ? 'This checkout was cancelled or expired.'
      : 'We could not confirm completion for this checkout.';

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="w-full max-w-md">
        <div id="receipt-card" className="bg-[#121212] rounded-3xl border border-zinc-800 p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#14F195]/20 blur-[60px] rounded-full pointer-events-none" />

          <div className="flex flex-col items-center relative z-10 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${isPaid ? 'bg-[#14F195]/10' : 'bg-red-500/10'}`}>
              {icon}
            </div>

            <h1 className="font-headline text-3xl font-bold mb-2 text-white">{title}</h1>
            <p className="text-zinc-400 mb-8">{subtitle}</p>

            <div className="w-full border-t border-dashed border-zinc-700 py-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-zinc-400">Amount</span>
                <span className="font-bold text-xl">${amount}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-zinc-400">Business</span>
                <span className="font-bold">{business}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Status</span>
                <span className={`font-bold ${isPaid ? 'text-[#14F195]' : isCancelled ? 'text-red-400' : 'text-zinc-300'}`}>{status || 'UNKNOWN'}
                </span>
              </div>
            </div>

            {isPaid && (
              <div className="mt-4 p-4 bg-[#14F195]/5 border border-[#14F195]/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="h-5 w-5 text-[#14F195] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-[#14F195] text-sm">Protected by Pabandi Escrow</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Your payment of ${amount} is held securely in escrow until you confirm receipt of service from {business}.
                      If you don't receive what you paid for, your funds are automatically refunded.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 pt-6 border-t border-zinc-800 w-full justify-center">
              <img src="/pabandi-logo.svg" alt="Pabandi" className="h-5 opacity-70" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <span className="font-headline font-bold text-zinc-500 tracking-wider">PABANDI ESCROW</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {isPaid && (
            <>
              <button
                onClick={handleShare}
                className="w-full py-4 rounded-xl bg-[#25D366] text-white font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <ShareIcon className="w-5 h-5" />
                Share receipt via WhatsApp
              </button>
              <a
                href={`/passport/verify?ref=${searchParams.get('sessionId') || ''}`}
                className="w-full py-3 rounded-xl bg-zinc-900 text-center text-zinc-300 font-body text-xs hover:text-white transition-colors border border-zinc-800"
              >
                Verify this transaction on the Pabandi Passport
              </a>
            </>
          )}
          <Link
            to="/"
            className="w-full py-4 rounded-xl bg-zinc-900 text-white font-bold text-lg hover:bg-zinc-800 transition-colors flex items-center justify-center"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
