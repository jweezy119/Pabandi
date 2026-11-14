import React, { useState } from 'react';
import { SecureQRCode } from './SecureQRCode';
import { generateRaastEmvcoPayload } from '../utils/raastEmvco';
import { Check, Copy, Building2 } from 'lucide-react';

export interface RaastQRProps {
  amount: number;
  merchantId: string;
  description?: string;
  reference?: string;
  merchantName?: string;
  merchantCity?: string;
  onReceiptUpload?: () => void;
}

export const RaastQR: React.FC<RaastQRProps> = ({
  amount,
  merchantId,
  description,
  reference,
  merchantName = 'Pabandi Escrow',
  merchantCity = 'Karachi',
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Generate EMVCo standard payload with SBP Raast tag 26 and CRC16 checksum
  const emvcoPayload = generateRaastEmvcoPayload({
    raastId: merchantId,
    amountPkr: amount,
    referenceId: reference,
    merchantName: description ? `${merchantName} - ${description.slice(0, 15)}` : merchantName,
    merchantCity,
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div
      role="region"
      aria-label="Raast Payment QR Code"
      className="p-4 sm:p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 text-center space-y-4 shadow-lg backdrop-blur-sm"
    >
      {/* SBP Raast Banner */}
      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
        <span className="flex items-center gap-1.5 font-['Space_Grotesk',sans-serif] tracking-wider uppercase">
          <Building2 className="w-4 h-4 text-emerald-400" />
          State Bank of Pakistan · Raast
        </span>
        <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono px-2 py-0.5 rounded-full">
          0% SBP Fee
        </span>
      </div>

      {/* Interoperable EMVCo QR Code */}
      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-inner">
        <SecureQRCode
          value={emvcoPayload}
          size={160}
          label="Scan via Nayapay, Sadapay, Easypaisa, or any Pakistani Bank"
        />
        <span className="text-[10px] font-mono text-slate-500 mt-2 font-semibold">
          EMVCo SBP Dynamic QR (Auto-fills amount &amp; ref)
        </span>
      </div>

      {/* Account Details & 1-Click Copy */}
      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-left space-y-2 text-xs font-mono">
        {/* Exact Amount */}
        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-slate-400">Exact Amount:</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-emerald-400 text-sm">
              Rs. {amount.toLocaleString()} PKR
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(String(amount), 'amount')}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Copy amount"
            >
              {copiedKey === 'amount' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Raast Mobile / IBAN */}
        <div className="flex items-center justify-between py-1 border-b border-white/5">
          <span className="text-slate-400">Raast ID (Mobile):</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">{merchantId}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(merchantId, 'raastId')}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Copy Raast ID"
            >
              {copiedKey === 'raastId' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Reference / Memo */}
        {reference && (
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-400">Reference Note:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-teal-300">{reference}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(reference, 'reference')}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Copy reference"
              >
                {copiedKey === 'reference' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Supported Banking Apps list */}
      <div className="pt-1 text-center">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
          Supported in all 1LINK &amp; Raast banking apps
        </span>
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-mono text-slate-300">
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">SadaPay</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">NayaPay</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Easypaisa</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">JazzCash</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Meezan</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">HBL</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Alfalah</span>
        </div>
      </div>
    </div>
  );
};

export default RaastQR;
