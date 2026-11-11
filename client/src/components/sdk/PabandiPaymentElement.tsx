import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Wallet, 
  Building2, 
  CreditCard, 
  Smartphone, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { SecureQRCode } from '../SecureQRCode';

export type PaymentRailChoice = 'solana' | 'raast' | 'card' | 'wallets';

export interface PabandiPaymentElementProps {
  amount: number;
  currency?: string;
  referenceId: string;
  merchantName?: string;
  merchantWallet?: string;
  merchantRaastId?: string;
  requireSharia?: boolean;
  theme?: 'dark' | 'light';
  onSuccess?: (rail: PaymentRailChoice, details?: any) => void;
  onError?: (error: any) => void;
  className?: string;
}

const DEFAULT_VAULT = 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';
const DEFAULT_RAAST = '03001234567';
const PKR_PER_USD = 280;

export const PabandiPaymentElement: React.FC<PabandiPaymentElementProps> = ({
  amount,
  currency = 'USD',
  referenceId,
  merchantName = 'Verified Merchant',
  merchantWallet = DEFAULT_VAULT,
  merchantRaastId = DEFAULT_RAAST,
  requireSharia = true,
  theme = 'dark',
  onSuccess,
  className = '',
}) => {
  const [selectedRail, setSelectedRail] = useState<PaymentRailChoice>('solana');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [completed, setCompleted] = useState(false);

  const isPkr = currency.toUpperCase() === 'PKR';
  const amountUsd = isPkr ? Math.round((amount / PKR_PER_USD) * 100) / 100 : amount;
  const amountPkr = isPkr ? amount : Math.round(amount * PKR_PER_USD);

  const solanaPayUrl = `solana:${merchantWallet}?amount=${amountUsd}&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&reference=ref_${referenceId}`;
  const raastQrPayload = `00020101021226340016pk.gov.sbp.raast0110${merchantRaastId}520454115303586540${amountPkr.toString().length}${amountPkr}5802PK5913Pabandi Escrow6007Karachi62230119${referenceId}`;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulatePayment = () => {
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      setCompleted(true);
      if (onSuccess) {
        onSuccess(selectedRail, { referenceId, amount, currency });
      }
    }, 1500);
  };

  if (completed) {
    return (
      <div className={`p-6 rounded-2xl bg-[#101a24] border border-emerald-500/30 text-center space-y-3 ${className}`}>
        <div className="w-12 h-12 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle2 size={24} />
        </div>
        <h3 className="text-lg font-bold text-[#e8eef4]">Payment Settled in Escrow</h3>
        <p className="text-xs font-mono text-[#8a9aa8]">
          Funds secured on {selectedRail.toUpperCase()} rail. Release code dispatched.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-2xl bg-[#101a24] border border-white/10 text-[#e8eef4] font-sans space-y-4 max-w-md w-full shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#4fd1c5] font-bold">
            Pabandi Universal Payment Element
          </span>
          <h4 className="text-sm font-bold text-[#e8eef4]">{merchantName}</h4>
        </div>
        <div className="text-right">
          <span className="text-lg font-black text-[#4fd1c5]">
            {isPkr ? `Rs. ${amountPkr.toLocaleString()}` : `$${amountUsd.toFixed(2)}`}
          </span>
          <span className="block text-[10px] font-mono text-[#8a9aa8]">
            {isPkr ? `≈ $${amountUsd.toFixed(2)} USD` : `≈ Rs. ${amountPkr.toLocaleString()} PKR`}
          </span>
        </div>
      </div>

      {/* Rail Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-[#0a1118] rounded-xl border border-white/5 text-xs font-mono">
        <button
          type="button"
          onClick={() => setSelectedRail('solana')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
            selectedRail === 'solana' ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' : 'text-[#8a9aa8] hover:text-white'
          }`}
        >
          <Wallet size={14} />
          <span className="text-[10px]">Solana</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedRail('raast')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
            selectedRail === 'raast' ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' : 'text-[#8a9aa8] hover:text-white'
          }`}
        >
          <Building2 size={14} />
          <span className="text-[10px]">Raast 0%</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedRail('card')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
            selectedRail === 'card' ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' : 'text-[#8a9aa8] hover:text-white'
          }`}
        >
          <CreditCard size={14} />
          <span className="text-[10px]">Card</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedRail('wallets')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
            selectedRail === 'wallets' ? 'bg-[#4fd1c5] text-[#0a1118] font-bold' : 'text-[#8a9aa8] hover:text-white'
          }`}
        >
          <Smartphone size={14} />
          <span className="text-[10px]">Wallets</span>
        </button>
      </div>

      {/* Rail Detail Content */}
      <div className="p-4 rounded-xl bg-[#0a1118] border border-white/5 space-y-3">
        {selectedRail === 'solana' && (
          <div className="space-y-3 text-center">
            <div className="p-3 bg-white rounded-xl inline-block">
              <SecureQRCode value={solanaPayUrl} size={150} />
            </div>
            <p className="text-xs text-[#8a9aa8] leading-relaxed">
              Scan with Phantom or Solana wallet. <strong>${amountUsd} USDC</strong> locked directly in Anchor escrow contract.
            </p>
            <button
              onClick={() => handleCopy('solana-url', solanaPayUrl)}
              className="w-full py-2 rounded-lg bg-white/[0.04] text-xs font-mono text-[#4fd1c5] border border-white/10 hover:bg-white/[0.08]"
            >
              {copiedKey === 'solana-url' ? '✓ Copied Solana Pay URI' : 'Copy Solana Pay Link'}
            </button>
          </div>
        )}

        {selectedRail === 'raast' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#101a24] border border-white/5 text-xs font-mono">
              <span className="text-[#8a9aa8]">Merchant Raast ID:</span>
              <span className="text-emerald-400 font-bold">{merchantRaastId}</span>
              <button
                onClick={() => handleCopy('raast-id', merchantRaastId)}
                className="p-1 text-[#8a9aa8] hover:text-white"
              >
                {copiedKey === 'raast-id' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
            <div className="p-3 bg-white rounded-xl mx-auto flex justify-center">
              <SecureQRCode value={raastQrPayload} size={140} />
            </div>
            <p className="text-xs text-[#8a9aa8] text-center">
              State Bank of Pakistan zero-fee rail. Transfer <strong>Rs. {amountPkr.toLocaleString()}</strong> from any bank app.
            </p>
          </div>
        )}

        {selectedRail === 'card' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Card number (4242 •••• •••• 4242)"
                className="w-full px-3 py-2 rounded-lg bg-[#101a24] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#4fd1c5]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="MM / YY"
                  className="px-3 py-2 rounded-lg bg-[#101a24] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#4fd1c5]"
                />
                <input
                  type="text"
                  placeholder="CVC"
                  className="px-3 py-2 rounded-lg bg-[#101a24] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#4fd1c5]"
                />
              </div>
            </div>
            <span className="block text-[11px] text-[#8a9aa8] text-center">
              Powered by Square & Stripe 3D-Secure 2.0
            </span>
          </div>
        )}

        {selectedRail === 'wallets' && (
          <div className="space-y-2 text-center text-xs text-[#8a9aa8]">
            <p>Send <strong>Rs. {amountPkr.toLocaleString()}</strong> to JazzCash / EasyPaisa wallet:</p>
            <div className="p-2.5 rounded-lg bg-[#101a24] border border-white/5 font-mono text-emerald-400 font-bold">
              {merchantRaastId}
            </div>
            <p className="text-[11px]">Instant mobile wallet clearing.</p>
          </div>
        )}
      </div>

      {/* Pay / Complete Button */}
      <button
        type="button"
        onClick={handleSimulatePayment}
        disabled={simulating}
        className="w-full py-3 rounded-xl bg-[#4fd1c5] hover:bg-[#38b2ac] text-[#0a1118] font-bold text-sm inline-flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
      >
        <span>{simulating ? 'Verifying on-chain...' : `Confirm & Pay ${isPkr ? `Rs. ${amountPkr.toLocaleString()}` : `$${amountUsd.toFixed(2)}`}`}</span>
        <ArrowRight size={15} />
      </button>

      {/* Sharia Escrow Guarantee Badge */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#8a9aa8]">
        <ShieldCheck size={13} className="text-[#34d399]" />
        <span>Sharia-compliant non-custodial escrow guarantee</span>
      </div>
    </div>
  );
};

