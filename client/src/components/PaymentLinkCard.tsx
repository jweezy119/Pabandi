import { useState } from 'react';

type PaymentLinkCardProps = {
  businessId: string;
  businessName: string;
  amount?: string;
  currency?: string;
};

export const PaymentLinkCard = ({ businessId, businessName, amount = '0', currency = 'USD' }: PaymentLinkCardProps) => {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/t/pay/${businessId}?amount=${encodeURIComponent(amount || '0')}&currency=${encodeURIComponent(currency)}`;
  const shortLabel = businessName || 'seller';

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waMessage = `Hi, you can pay ${shortLabel} directly with Pabandi Checkout: ${url}`;

  const whatsapp = () => {
    const fallback = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
    return fallback;
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5">
      <div className="flex flex-col gap-3">
        <div className="bg-surface border border-outline-variant/20 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Hosted Payment Link</p>
              <p className="font-headline text-sm font-bold text-on-surface break-all">{url}</p>
            </div>
            <button onClick={copy} className="shrink-0 px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a href={whatsapp()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white font-headline text-xs font-bold py-2.5 hover:bg-[#20ba5a] transition-colors">
            Share on WhatsApp
          </a>
          <a href={url} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-surface border border-outline-variant/40 text-on-surface font-headline text-xs font-bold py-2.5 hover:bg-surface-container transition-colors">
            Open Checkout
          </a>
        </div>
      </div>
    </div>
  );
};

export default PaymentLinkCard;
