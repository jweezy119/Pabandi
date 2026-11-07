import React, { useState } from 'react';
import { X, Shield, CreditCard, Zap, ExternalLink, Copy, Check, Wallet } from 'lucide-react';
import { Connection, Transaction } from '@solana/web3.js';
import { API_HOST } from '../utils/apiHost';
import { getAuthToken } from '../utils/authToken';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';

export interface PabandiCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  amount: number;
  currency?: string;
  referenceId: string;
  /** Exact Square webhook note (e.g. pabandi:invoice:<id>:<num>, pabandi:booking:<id>, pabandi:universalescrow:<ref>) */
  squareNote: string;
  /** Optional pre-existing Square/merchant payment link */
  existingPaymentLink?: string | null;
  /** Optional merchant Solana recipient wallet */
  recipientWallet?: string | null;
  customerEmail?: string;
  redirectUrl?: string;
  onSuccess?: (rail: 'square' | 'solana', paymentUrlOrTxHash?: string) => void;
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DEFAULT_ESCROW_VAULT =
  import.meta.env.VITE_ESCROW_VAULT_ADDRESS || 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';

interface SignableSolanaWallet {
  address?: string;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
}

export const PabandiCheckoutModal: React.FC<PabandiCheckoutModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  amount,
  currency = 'USD',
  referenceId,
  squareNote,
  existingPaymentLink,
  recipientWallet,
  customerEmail,
  redirectUrl,
  onSuccess,
}) => {
  const [selectedRail, setSelectedRail] = useState<'square' | 'solana'>('solana');
  const [loading, setLoading] = useState(false);
  const [signingPrivy, setSigningPrivy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { wallet } = useEmbeddedSolanaWallet();
  const solanaWallet = wallet as SignableSolanaWallet | null;
  const walletAddress = solanaWallet?.address ?? '';
  const targetVault = recipientWallet && recipientWallet.length >= 32 ? recipientWallet : DEFAULT_ESCROW_VAULT;

  if (!open) return null;

  const solanaPayUri = `solana:${targetVault}?amount=${amount.toFixed(2)}&spl-token=${USDC_MINT}&label=${encodeURIComponent(
    title
  )}&message=${encodeURIComponent(squareNote || referenceId)}`;

  const handleSquareCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      if (existingPaymentLink) {
        setCheckoutUrl(existingPaymentLink);
        window.open(existingPaymentLink, '_blank', 'noopener,noreferrer');
        onSuccess?.('square', existingPaymentLink);
        return;
      }

      const token = getAuthToken();
      const res = await fetch(`${API_HOST}/api/v1/square-checkout/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          referenceId,
          amount,
          currency: currency === 'USDC' ? 'USD' : currency,
          redirectUrl: redirectUrl || window.location.href,
          cancelUrl: window.location.href,
          note: squareNote,
          label: title,
          customerEmail,
        }),
      });

      const data = (await res.json()) as {
        checkout?: { url?: string; paymentLink?: { url?: string } };
        data?: { url?: string };
        error?: string;
        message?: string;
      };
      const url = data?.checkout?.url || data?.checkout?.paymentLink?.url || data?.data?.url;
      if (!res.ok || !url) {
        throw new Error(data?.error || data?.message || 'Could not create Square checkout session');
      }

      setCheckoutUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
      onSuccess?.('square', url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Square checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePrivySolanaPay = async () => {
    if (!walletAddress) {
      setError('Connect your Privy Solana wallet in Trust & Verification settings first, or use the Solana Pay URI below.');
      return;
    }

    setSigningPrivy(true);
    setError(null);
    try {
      const token = getAuthToken();
      const buildRes = await fetch(`${API_HOST}/api/v1/solana-usdc/transfer/build`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fromWallet: walletAddress,
          toWallet: targetVault,
          amountUsdc: amount,
        }),
      });

      const buildData = (await buildRes.json()) as {
        success?: boolean;
        transaction?: string;
        error?: string;
      };

      if (!buildRes.ok || !buildData.transaction) {
        throw new Error(buildData.error || 'Could not build Solana USDC transfer transaction');
      }

      const txBytes = Uint8Array.from(atob(buildData.transaction), (c) => c.charCodeAt(0));
      const tx = Transaction.from(txBytes);

      let signature = '';
      if (typeof solanaWallet?.signTransaction === 'function') {
        const signedTx = await solanaWallet.signTransaction(tx);
        const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
      } else {
        throw new Error('Connected wallet does not support direct transaction signing; use Open in Solana Wallet below.');
      }

      await fetch(`${API_HOST}/api/v1/solana-usdc/transfer/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fromWallet: walletAddress,
          toWallet: targetVault,
          amountUsdc: amount,
          txHash: signature,
          type: 'FUNDING',
          referenceId: squareNote || referenceId,
        }),
      });

      setTxSignature(signature);
      onSuccess?.('solana', signature);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Solana USDC payment failed');
    } finally {
      setSigningPrivy(false);
    }
  };

  const handleCopySolana = async () => {
    try {
      await navigator.clipboard.writeText(solanaPayUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--cream,#F5EFE6)] text-[var(--warm-ink,#2A2520)] border border-[rgba(191,179,163,0.4)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(191,179,163,0.25)]">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[var(--sage,#8A9A7B)]" />
            <div>
              <h2 className="text-base font-bold leading-tight">{title}</h2>
              {subtitle && <p className="text-xs text-[var(--soft-stone,#8C8275)]">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-[var(--soft-stone,#8C8275)] hover:bg-[var(--warm-sand,#E8D9C5)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="px-5 py-3.5 bg-[var(--warm-sand,#E8D9C5)]/50 border-b border-[rgba(191,179,163,0.25)] flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--soft-stone,#8C8275)]">
            Escrow Protected Total
          </span>
          <span className="text-2xl font-bold text-[var(--clay,#C97B5A)]">
            ${amount.toFixed(2)}{' '}
            <span className="text-xs font-normal text-[var(--soft-stone,#8C8275)]">
              {selectedRail === 'solana' ? 'USDC' : 'USD'}
            </span>
          </span>
        </div>

        {/* Rail Selector */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedRail('solana');
                setError(null);
              }}
              className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                selectedRail === 'solana'
                  ? 'border-[var(--clay,#C97B5A)] bg-[var(--clay,#C97B5A)]/10'
                  : 'border-[rgba(191,179,163,0.3)] bg-white/60 hover:border-[var(--clay,#C97B5A)]/40'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <Zap size={15} className="text-[var(--sage,#8A9A7B)]" />
                <span>Solana USDC</span>
              </div>
              <span className="text-[11px] text-[var(--soft-stone,#8C8275)] mt-0.5">
                Privy Wallet / Solana Pay (0% FX)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRail('square');
                setError(null);
              }}
              className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                selectedRail === 'square'
                  ? 'border-[var(--clay,#C97B5A)] bg-[var(--clay,#C97B5A)]/10'
                  : 'border-[rgba(191,179,163,0.3)] bg-white/60 hover:border-[var(--clay,#C97B5A)]/40'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <CreditCard size={15} className="text-[var(--clay,#C97B5A)]" />
                <span>Square</span>
              </div>
              <span className="text-[11px] text-[var(--soft-stone,#8C8275)] mt-0.5">
                Card, Apple Pay, Cash App
              </span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs">
              {error}
            </div>
          )}

          {selectedRail === 'square' ? (
            <div className="space-y-3">
              <p className="text-xs text-[var(--soft-stone,#8C8275)] leading-relaxed">
                Pay securely with any major debit/credit card, Apple Pay, Google Pay, or Cash App via Square Checkout.
                Webhook verification automatically updates your Pabandi escrow status.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={handleSquareCheckout}
                className="w-full py-3.5 px-4 rounded-xl bg-[var(--clay,#C97B5A)] text-white font-semibold text-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                <CreditCard size={16} />
                {loading ? 'Creating Square Checkout…' : `Pay $${amount.toFixed(2)} via Square`}
                <ExternalLink size={14} />
              </button>
              {checkoutUrl && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5">
                  <div className="font-semibold text-emerald-800">✓ Square Checkout Ready</div>
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--clay,#C97B5A)] font-bold underline"
                  >
                    Click here if Square Checkout did not open automatically ↗
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[var(--warm-sand,#E8D9C5)]/60 border border-[rgba(191,179,163,0.35)] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--warm-ink,#2A2520)] flex items-center gap-1.5">
                    <Wallet size={13} className="text-[var(--clay,#C97B5A)]" />
                    Privy Embedded Solana Wallet
                  </span>
                  <span className="font-mono text-[11px] text-[var(--soft-stone,#8C8275)]">
                    {walletAddress
                      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                      : 'External / Solana Pay URI'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--soft-stone,#8C8275)]">
                  Escrow Target: <code className="font-mono">{targetVault.slice(0, 8)}...{targetVault.slice(-6)}</code> · Ref:{' '}
                  <code className="font-mono">{referenceId}</code>
                </p>
              </div>

              {txSignature && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                  <div className="font-semibold text-emerald-800">✓ On-Chain USDC Escrow Funded</div>
                  <div className="font-mono text-[11px] text-emerald-700 break-all">Tx: {txSignature}</div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {walletAddress && (
                  <button
                    type="button"
                    disabled={signingPrivy}
                    onClick={handlePrivySolanaPay}
                    className="w-full py-3.5 px-4 rounded-xl bg-[var(--clay,#C97B5A)] text-white font-semibold text-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                  >
                    <Wallet size={16} />
                    {signingPrivy
                      ? 'Signing & Broadcasting USDC…'
                      : `Sign & Pay ${amount.toFixed(2)} USDC with Privy Wallet`}
                  </button>
                )}

                <a
                  href={solanaPayUri}
                  onClick={() => onSuccess?.('solana', solanaPayUri)}
                  className="w-full py-3 px-4 rounded-xl bg-[var(--warm-ink,#2A2520)] text-[var(--cream,#F5EFE6)] font-semibold text-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-sm"
                >
                  <Zap size={15} />
                  Open in Phantom / Solflare ({amount.toFixed(2)} USDC)
                </a>

                <button
                  type="button"
                  onClick={handleCopySolana}
                  className="w-full py-2.5 px-4 rounded-xl border border-[rgba(191,179,163,0.4)] bg-white/70 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied Solana Pay URI!' : 'Copy Solana Pay URI'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PabandiCheckoutModal;
