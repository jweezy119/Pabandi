import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircleIcon, ShareIcon } from '@heroicons/react/24/outline';
import { tokens } from '../design-system';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState('0.00');
  const [business, setBusiness] = useState('Business');
  
  useEffect(() => {
    setAmount(searchParams.get('amount') || '0.00');
    setBusiness(searchParams.get('business') || 'Business');
  }, [searchParams]);

  const handleShare = () => {
    const text = `I just booked ${business} through Pabandi escrow for $${amount}! Protected by smart contracts. Check it out: https://pabandi.com`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    window.location.href = whatsappUrl;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="w-full max-w-md">
        
        {/* Receipt Card DOM Element */}
        <div id="receipt-card" className="bg-[#121212] rounded-3xl border border-zinc-800 p-8 relative overflow-hidden shadow-2xl">
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#14F195]/20 blur-[60px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col items-center relative z-10 text-center">
            <div className="w-16 h-16 bg-[#14F195]/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircleIcon className="w-10 h-10 text-[#14F195]" />
            </div>
            
            <h1 className="font-headline text-3xl font-bold mb-2">Paid successfully</h1>
            <p className="text-zinc-400 mb-8">Funds secured in Pabandi Escrow</p>

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
                <span className="text-zinc-400">Date</span>
                <span className="font-bold">{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 pt-6 border-t border-zinc-800 w-full justify-center">
              <img src="/pabandi-logo.svg" alt="Pabandi" className="h-5 opacity-70" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <span className="font-headline font-bold text-zinc-500 tracking-wider">PABANDI ESCROW</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="w-full py-4 rounded-xl bg-[#25D366] text-white font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <ShareIcon className="w-5 h-5" />
            Share receipt via WhatsApp
          </button>
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
