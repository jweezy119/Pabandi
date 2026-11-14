import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Shield,
  CreditCard,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Wallet,
  Building2,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  QrCode,
  Upload,
  Camera,
  Loader2,
} from 'lucide-react';
import { Connection, Transaction } from '@solana/web3.js';
import { API_HOST } from '../utils/apiHost';
import { getAuthToken } from '../utils/authToken';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';
import { SecureQRCode } from './SecureQRCode';
import { generateRaastEmvcoPayload } from '../utils/raastEmvco';

export type PaymentRail = 'solana' | 'square' | 'raast' | 'wallets';

export interface PabandiCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  amount: number;
  currency?: string;
  referenceId: string;
  /** Exact Square / Escrow webhook note (e.g. pabandi:invoice:<id>:<num>, pabandi:booking:<id>, pabandi:universalescrow:<ref>) */
  squareNote: string;
  /** Optional pre-existing Square/merchant payment link */
  existingPaymentLink?: string | null;
  /** Optional merchant Solana recipient wallet */
  recipientWallet?: string | null;
  customerEmail?: string;
  redirectUrl?: string;
  onSuccess?: (rail: PaymentRail, paymentUrlOrTxHash?: string) => void;
  /** Optional Pakistani merchant rail details */
  merchantRaastId?: string | null;
  merchantIban?: string | null;
  merchantJazzCash?: string | null;
  merchantEasyPaisa?: string | null;
  initialRail?: PaymentRail;
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DEFAULT_ESCROW_VAULT =
  import.meta.env.VITE_ESCROW_VAULT_ADDRESS || 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';
const DEFAULT_RAAST_ID = '03001234567';
const PKR_PER_USD = 280;

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
  merchantRaastId,
  merchantIban,
  merchantJazzCash,
  merchantEasyPaisa,
  initialRail = 'solana',
}) => {
  const [selectedRail, setSelectedRail] = useState<PaymentRail>(initialRail);
  const [loading, setLoading] = useState(false);
  const [signingPrivy, setSigningPrivy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<boolean>(true);
  const [claimSent, setClaimSent] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState<string>('');
  const [squareCardInstance, setSquareCardInstance] = useState<any>(null);
  const [squareLoadingSdk, setSquareLoadingSdk] = useState(false);

  // In-Modal AI OCR Receipt Verification
  const [ocrReceiptFile, setOcrReceiptFile] = useState<File | null>(null);
  const [ocrReceiptPreview, setOcrReceiptPreview] = useState<string | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrVerified, setOcrVerified] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [verifiedRrn, setVerifiedRrn] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const { wallet } = useEmbeddedSolanaWallet();
  const solanaWallet = wallet as SignableSolanaWallet | null;
  const walletAddress = solanaWallet?.address ?? '';
  const targetVault =
    recipientWallet && recipientWallet.length >= 32 ? recipientWallet : DEFAULT_ESCROW_VAULT;

  const raastId = merchantRaastId || DEFAULT_RAAST_ID;
  const jazzCashNumber = merchantJazzCash || raastId;
  const easyPaisaNumber = merchantEasyPaisa || raastId;
  const ibanNumber = merchantIban || 'PK00PABN0000000000000000';

  // Compute normalized currency values
  const isPkr = currency.toUpperCase() === 'PKR';
  const amountInUsd = isPkr ? amount / PKR_PER_USD : amount;
  const amountInPkr = isPkr ? amount : Math.round(amount * PKR_PER_USD);

  const solanaPayUri = `solana:${targetVault}?amount=${amountInUsd.toFixed(2)}&spl-token=${USDC_MINT}&label=${encodeURIComponent(
    title
  )}&message=${encodeURIComponent(squareNote || referenceId)}`;

  // Standard SBP EMVCo Interoperable QR Payload
  const raastPayload = generateRaastEmvcoPayload({
    raastId,
    amountPkr: amountInPkr,
    referenceId: squareNote || referenceId,
  });

  const handleReceiptUpload = async (file: File) => {
    setOcrReceiptFile(file);
    setOcrError(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const b64 = reader.result as string;
      setOcrReceiptPreview(b64);
      setOcrScanning(true);
      setSrAnnouncement('Scanning payment receipt with AI OCR...');

      try {
        const res = await fetch(`${API_HOST}/api/v1/payments/raast/verify-public`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: squareNote || referenceId,
            referenceId,
            amount: amountInPkr,
            raastId,
            imageBase64: b64,
          }),
        });

        const json = await res.json();
        if (json.success && json.verified) {
          setOcrVerified(true);
          setVerifiedRrn(json.rrn || 'CONFIRMED');
          triggerHaptic('success');
          setClaimSent(true);
          setSrAnnouncement(`Payment verified via AI OCR! RRN: ${json.rrn || 'confirmed'}`);
          setTimeout(() => {
            onSuccess?.('raast', squareNote || referenceId);
          }, 1500);
        } else {
          setClaimSent(true);
          setOcrError(json.message || 'Receipt submitted. Confidence below threshold, queued for coordinator confirmation.');
        }
      } catch (err: any) {
        setOcrError(err?.message || 'Failed to analyze receipt. You can still confirm manually.');
      } finally {
        setOcrScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Keyboard navigation & Accessibility Focus Trap
  useEffect(() => {
    if (!open) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Initial focus on modal
    const timer = setTimeout(() => {
      modalRef.current?.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [open, onClose]);

  const copyToClipboard = useCallback(async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      } catch {}
      setSrAnnouncement(`${label} copied to clipboard`);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
    }
  }, []);

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'success' | 'warning' = 'light') => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg?.HapticFeedback) return;
      if (type === 'success' || type === 'warning') {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
    } catch {}
  }, []);

  const openExternalOrDeepLink = useCallback((url: string) => {
    triggerHaptic('medium');
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [triggerHaptic]);

  const phantomDeepLink = `https://phantom.app/ul/browse/${encodeURIComponent(solanaPayUri)}?ref=pabandi`;
  const solflareDeepLink = `https://solflare.com/ul/v1/browse/${encodeURIComponent(solanaPayUri)}`;

  const handleSelectRail = (rail: PaymentRail) => {
    setSelectedRail(rail);
    setError(null);
    triggerHaptic('light');
    setSrAnnouncement(`Selected ${rail} payment method`);
  };

  // ── Square Web Payments SDK Initialization (Card, Apple Pay, Google Pay) ──
  useEffect(() => {
    if (!open || selectedRail !== 'square') return;

    let mounted = true;
    const initSquareSdk = async () => {
      setSquareLoadingSdk(true);
      try {
        if (!(window as any).Square) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.getElementById('square-web-sdk');
            if (existingScript) {
              existingScript.addEventListener('load', () => resolve());
              return;
            }
            const script = document.createElement('script');
            script.id = 'square-web-sdk';
            script.src = 'https://web.squarecdn.com/v1/square.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Square Web Payments SDK'));
            document.head.appendChild(script);
          });
        }

        if (!mounted || !(window as any).Square) return;

        const appId = import.meta.env.VITE_SQUARE_APP_ID || 'sq0idp-demo';
        const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID || 'LPABANDI';

        const payments = (window as any).Square.payments(appId, locationId);
        const card = await payments.card();
        const container = document.getElementById('pabandi-square-card-container');
        if (container) {
          container.innerHTML = '';
          await card.attach('#pabandi-square-card-container');
          if (mounted) {
            setSquareCardInstance(card);
          }
        }
      } catch (e: any) {
        console.warn('[SquareSDK] Direct card embed fallback to hosted checkout:', e.message);
      } finally {
        if (mounted) setSquareLoadingSdk(false);
      }
    };

    const timer = setTimeout(initSquareSdk, 200);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [open, selectedRail]);

  const handleSquareTokenPayment = async () => {
    if (!squareCardInstance) {
      return handleSquareCheckout();
    }
    setLoading(true);
    setError(null);
    try {
      const tokenResult = await squareCardInstance.tokenize();
      if (tokenResult.status !== 'OK') {
        throw new Error(tokenResult.errors?.[0]?.message || 'Card verification failed');
      }

      const res = await fetch(`${API_HOST}/api/v1/square-checkout/process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          amount: amountInUsd,
          currency: 'USD',
          referenceId,
          note: squareNote,
          customerEmail,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Payment failed');
      }

      setClaimSent(true);
      triggerHaptic('success');
      onSuccess?.('square', tokenResult.token);
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSquareCheckout = async () => {
    setLoading(true);
    setError(null);
    setSrAnnouncement('Initiating secure Square checkout');
    try {
      if (existingPaymentLink) {
        setCheckoutUrl(existingPaymentLink);
        openExternalOrDeepLink(existingPaymentLink);
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
          amount: amountInUsd,
          currency: 'USD',
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
      setSrAnnouncement('Square checkout link generated successfully');
      openExternalOrDeepLink(url);
      onSuccess?.('square', url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Square checkout failed';
      setError(msg);
      setSrAnnouncement(`Square error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivySolanaPay = async () => {
    if (!walletAddress) {
      setError(
        'Connect your Privy Solana wallet in settings first, or scan the Solana Pay QR code below.'
      );
      return;
    }

    setSigningPrivy(true);
    setError(null);
    setSrAnnouncement('Building and signing Solana USDC transaction with Privy wallet');
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
          amountUsdc: amountInUsd,
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
        const rpcUrl =
          import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
      } else {
        throw new Error(
          'Connected wallet does not support direct signing; please use the Solana Pay QR code or link below.'
        );
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
          amountUsdc: amountInUsd,
          txHash: signature,
          type: 'FUNDING',
          referenceId: squareNote || referenceId,
        }),
      });

      setTxSignature(signature);
      setSrAnnouncement('Solana payment verified and escrow funded on-chain');
      onSuccess?.('solana', signature);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Solana USDC payment failed';
      setError(msg);
      setSrAnnouncement(`Solana error: ${msg}`);
    } finally {
      setSigningPrivy(false);
    }
  };

  const handleClaimPaid = async () => {
    setClaimSent(true);
    triggerHaptic('success');
    setSrAnnouncement('Payment claim submitted for merchant verification');
    onSuccess?.(selectedRail, squareNote || referenceId);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pabandi-checkout-modal-title"
      aria-describedby="pabandi-checkout-modal-desc"
      onClick={onClose}
    >
      {/* Screen Reader Announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>

      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[#FBF8F3] text-[#2A2520] border border-[#BFB3A3]/50 shadow-2xl overflow-hidden focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#BFB3A3]/30 bg-[#F5EFE6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#8A9A7B]/15 text-[#5F6F52] flex items-center justify-center">
              <Shield size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="pabandi-checkout-modal-title"
                className="text-base font-bold text-[#2A2520] leading-tight"
              >
                {title}
              </h2>
              <p id="pabandi-checkout-modal-desc" className="text-xs text-[#5C5248]">
                {subtitle || 'Pabandi Non-Custodial Escrow Settlement'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout modal"
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-[#5C5248] hover:bg-[#E8D9C5] focus-visible:ring-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none transition-colors flex items-center justify-center"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Amount Banner with Dual Currency */}
        <div className="px-5 py-3.5 bg-[#E8D9C5]/40 border-b border-[#BFB3A3]/30 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B5E52] block">
              Escrow Protected Total
            </span>
            <span className="text-xs text-[#5C5248]">
              {selectedRail === 'raast' || selectedRail === 'wallets'
                ? `≈ $${amountInUsd.toFixed(2)} USD`
                : `≈ Rs. ${amountInPkr.toLocaleString()} PKR`}
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-[#C97B5A] tracking-tight">
              {selectedRail === 'raast' || selectedRail === 'wallets'
                ? `Rs. ${amountInPkr.toLocaleString()}`
                : `$${amountInUsd.toFixed(2)}`}
            </span>
            <span className="ml-1 text-xs font-semibold text-[#5C5248]">
              {selectedRail === 'solana'
                ? 'USDC'
                : selectedRail === 'raast' || selectedRail === 'wallets'
                ? 'PKR'
                : 'USD'}
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Rail Selector (Accessible Tablist) */}
          <div>
            <label className="block text-xs font-bold text-[#4A3E31] mb-2 uppercase tracking-wide">
              Select Payment Rail
            </label>
            <div
              role="tablist"
              aria-label="Payment rails"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              {/* Solana USDC */}
              <button
                type="button"
                role="tab"
                id="tab-solana"
                aria-selected={selectedRail === 'solana'}
                aria-controls="panel-solana"
                onClick={() => handleSelectRail('solana')}
                className={`min-h-[56px] flex flex-col items-center justify-center p-2 rounded-xl border-2 text-center transition-all focus-visible:ring-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none ${
                  selectedRail === 'solana'
                    ? 'border-[#C97B5A] bg-[#C97B5A]/10 text-[#2A2520] font-bold shadow-sm'
                    : 'border-[#BFB3A3]/40 bg-white/70 text-[#5C5248] hover:border-[#C97B5A]/50'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Zap size={14} className="text-[#5F6F52]" aria-hidden="true" />
                  <span className="text-xs">Solana</span>
                </div>
                <span className="text-[10px] text-[#5C5248]">USDC (0% FX)</span>
              </button>

              {/* Square / Card */}
              <button
                type="button"
                role="tab"
                id="tab-square"
                aria-selected={selectedRail === 'square'}
                aria-controls="panel-square"
                onClick={() => handleSelectRail('square')}
                className={`min-h-[56px] flex flex-col items-center justify-center p-2 rounded-xl border-2 text-center transition-all focus-visible:ring-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none ${
                  selectedRail === 'square'
                    ? 'border-[#C97B5A] bg-[#C97B5A]/10 text-[#2A2520] font-bold shadow-sm'
                    : 'border-[#BFB3A3]/40 bg-white/70 text-[#5C5248] hover:border-[#C97B5A]/50'
                }`}
              >
                <div className="flex items-center gap-1">
                  <CreditCard size={14} className="text-[#C97B5A]" aria-hidden="true" />
                  <span className="text-xs">Cards</span>
                </div>
                <span className="text-[10px] text-[#5C5248]">Apple/Google Pay</span>
              </button>

              {/* Raast */}
              <button
                type="button"
                role="tab"
                id="tab-raast"
                aria-selected={selectedRail === 'raast'}
                aria-controls="panel-raast"
                onClick={() => handleSelectRail('raast')}
                className={`min-h-[56px] flex flex-col items-center justify-center p-2 rounded-xl border-2 text-center transition-all focus-visible:ring-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none ${
                  selectedRail === 'raast'
                    ? 'border-[#C97B5A] bg-[#C97B5A]/10 text-[#2A2520] font-bold shadow-sm'
                    : 'border-[#BFB3A3]/40 bg-white/70 text-[#5C5248] hover:border-[#C97B5A]/50'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Building2 size={14} className="text-[#5F6F52]" aria-hidden="true" />
                  <span className="text-xs">Raast</span>
                </div>
                <span className="text-[10px] text-[#5C5248]">0% Fee Bank</span>
              </button>

              {/* Wallets (JazzCash / EasyPaisa) */}
              <button
                type="button"
                role="tab"
                id="tab-wallets"
                aria-selected={selectedRail === 'wallets'}
                aria-controls="panel-wallets"
                onClick={() => handleSelectRail('wallets')}
                className={`min-h-[56px] flex flex-col items-center justify-center p-2 rounded-xl border-2 text-center transition-all focus-visible:ring-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none ${
                  selectedRail === 'wallets'
                    ? 'border-[#C97B5A] bg-[#C97B5A]/10 text-[#2A2520] font-bold shadow-sm'
                    : 'border-[#BFB3A3]/40 bg-white/70 text-[#5C5248] hover:border-[#C97B5A]/50'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Smartphone size={14} className="text-[#C97B5A]" aria-hidden="true" />
                  <span className="text-xs">Wallets</span>
                </div>
                <span className="text-[10px] text-[#5C5248]">Jazz/EasyPaisa</span>
              </button>
            </div>
          </div>

          {/* Feedback & Error State */}
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
              <div>
                <span className="font-semibold block">Payment Notice</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              PANEL 1: SOLANA USDC
             ───────────────────────────────────────────────────────────── */}
          {selectedRail === 'solana' && (
            <div
              id="panel-solana"
              role="tabpanel"
              aria-labelledby="tab-solana"
              className="space-y-3"
            >
              {/* Trust & Vault Details */}
              <div className="p-3.5 rounded-xl bg-[#E8D9C5]/50 border border-[#BFB3A3]/40 text-xs space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-[#2A2520] flex items-center gap-1.5">
                    <Wallet size={14} className="text-[#C97B5A]" aria-hidden="true" />
                    Privy Embedded Wallet
                  </span>
                  <span className="font-mono text-[11px] text-[#4A3E31] bg-white/80 px-2 py-0.5 rounded border border-[#BFB3A3]/40">
                    {walletAddress
                      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                      : 'None Connected'}
                  </span>
                </div>
                <div className="text-[11px] text-[#5C5248] flex items-center justify-between pt-1 border-t border-[#BFB3A3]/30">
                  <span>
                    Escrow Vault:{' '}
                    <code className="font-mono font-semibold text-[#2A2520]">
                      {targetVault.slice(0, 6)}...{targetVault.slice(-4)}
                    </code>
                  </span>
                  <span className="font-mono text-[10px] text-[#6B5E52]">Ref: {referenceId}</span>
                </div>
              </div>

              {/* Successful Signature */}
              {txSignature && (
                <div
                  role="status"
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
                    <span>On-Chain USDC Escrow Funded Successfully</span>
                  </div>
                  <div className="font-mono text-[11px] text-emerald-800 break-all bg-emerald-100/50 p-1.5 rounded">
                    Tx: {txSignature}
                  </div>
                  <a
                    href={`https://solscan.io/tx/${txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 underline hover:text-emerald-950"
                  >
                    View on Solscan Explorer <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              )}

              {/* QR Toggle & Display */}
              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5C5248] hover:text-[#2A2520] underline"
                >
                  <QrCode size={13} aria-hidden="true" />
                  {showQr ? 'Hide Solana Pay QR' : 'Show Solana Pay QR Code'}
                </button>

                {showQr && (
                  <div className="p-3 bg-white/70 rounded-2xl border border-[#BFB3A3]/30 flex flex-col items-center">
                    <SecureQRCode
                      value={solanaPayUri}
                      size={160}
                      label="Scan with Phantom, Solflare, or Solana Pay wallet"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                {walletAddress ? (
                  <button
                    type="button"
                    disabled={signingPrivy}
                    onClick={handlePrivySolanaPay}
                    className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#C97B5A] text-white font-bold text-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none"
                  >
                    <Wallet size={16} aria-hidden="true" />
                    {signingPrivy
                      ? 'Signing & Broadcasting USDC...'
                      : `Sign & Pay ${amountInUsd.toFixed(2)} USDC (Privy)`}
                  </button>
                ) : null}

                {/* Mobile Wallet 1-Tap Deep Link Row */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      openExternalOrDeepLink(phantomDeepLink);
                    }}
                    className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#AB9FF2]/20 hover:bg-[#AB9FF2]/30 text-[#4E44CE] border border-[#AB9FF2]/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#AB9FF2] focus-visible:outline-none"
                  >
                    <Zap size={14} className="text-[#4E44CE]" aria-hidden="true" />
                    <span>Open in Phantom</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      openExternalOrDeepLink(solflareDeepLink);
                    }}
                    className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#FC8181]/20 hover:bg-[#FC8181]/30 text-[#C53030] border border-[#FC8181]/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#FC8181] focus-visible:outline-none"
                  >
                    <Zap size={14} className="text-[#C53030]" aria-hidden="true" />
                    <span>Open in Solflare</span>
                  </button>
                </div>

                <a
                  href={solanaPayUri}
                  onClick={(e) => {
                    const tg = (window as any).Telegram?.WebApp;
                    if (tg?.openLink) {
                      e.preventDefault();
                      openExternalOrDeepLink(phantomDeepLink);
                    }
                    onSuccess?.('solana', solanaPayUri);
                  }}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#2A2520] text-[#F5EFE6] font-bold text-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2A2520] focus-visible:outline-none"
                >
                  <Zap size={15} aria-hidden="true" />
                  Direct Solana Pay ({amountInUsd.toFixed(2)} USDC)
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(solanaPayUri, 'solana_uri', 'Solana Pay URI')}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-[#BFB3A3]/50 bg-white text-xs font-semibold text-[#2A2520] flex items-center justify-center gap-1.5 hover:bg-[#F5EFE6] transition-colors focus-visible:ring-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none"
                >
                  {copiedKey === 'solana_uri' ? (
                    <Check size={14} className="text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  {copiedKey === 'solana_uri' ? 'Copied Solana Pay URI!' : 'Copy Solana Pay URI'}
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              PANEL 2: SQUARE / CREDIT CARD / APPLE PAY / GOOGLE PAY
             ───────────────────────────────────────────────────────────── */}
          {selectedRail === 'square' && (
            <div
              id="panel-square"
              role="tabpanel"
              aria-labelledby="tab-square"
              className="space-y-3.5"
            >
              <div className="p-3.5 rounded-xl bg-white/70 border border-[#BFB3A3]/40 text-xs text-[#4A3E31] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[#2A2520]">
                  <CreditCard size={15} className="text-[#C97B5A]" aria-hidden="true" />
                  <span>Square Web Payments (Card, Apple Pay, Google Pay)</span>
                </div>
                <p className="leading-relaxed text-[#5C5248]">
                  Pay directly via Credit/Debit Card, Apple Pay, Google Pay, or Cash App. Zero crypto required.
                </p>
              </div>

              {/* Square Web Payments SDK Card Input Container */}
              <div className="p-3 rounded-2xl bg-white border border-[#BFB3A3]/50 shadow-inner">
                <div id="pabandi-square-card-container" className="min-h-[90px] flex items-center justify-center">
                  {squareLoadingSdk && (
                    <span className="text-xs text-[#8a9aa8] font-mono animate-pulse">
                      Initializing Square Web Payments SDK...
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSquareTokenPayment}
                  className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-[#C97B5A] text-white font-bold text-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none cursor-pointer"
                >
                  <CreditCard size={16} aria-hidden="true" />
                  {loading ? 'Processing via Square...' : `Pay $${amountInUsd.toFixed(2)} with Card / Wallets`}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSquareCheckout}
                  className="w-full py-2 px-3 rounded-xl bg-black/5 hover:bg-black/10 text-xs font-mono font-semibold text-[#5C5248] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Launch Square Express Checkout Page</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              {checkoutUrl && (
                <div
                  role="status"
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs space-y-1.5"
                >
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-700" aria-hidden="true" />
                    <span>Square Checkout Window Opened</span>
                  </div>
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#C97B5A] font-bold underline hover:opacity-90"
                  >
                    Click here if checkout did not open automatically <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              PANEL 3: RAAST (STATE BANK OF PAKISTAN INSTANT)
             ───────────────────────────────────────────────────────────── */}
          {selectedRail === 'raast' && (
            <div id="panel-raast" role="tabpanel" aria-labelledby="tab-raast" className="space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-950 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Building2 size={14} className="text-emerald-700" aria-hidden="true" />
                    Raast Instant Transfer (0% Fee)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    State Bank of Pakistan
                  </span>
                </div>
                <p className="text-[#4A3E31] leading-relaxed text-[11px]">
                  Send from any Pakistani bank app. <strong>0% FX markup:</strong> You save approx. <strong>Rs. {Math.round(amountInPkr * 0.065).toLocaleString()} PKR</strong> (6.5%) compared to international wire surcharges.
                </p>
              </div>

              {/* Raast QR Code */}
              <div className="p-3 bg-white rounded-2xl border border-[#BFB3A3]/40 flex flex-col items-center">
                <SecureQRCode
                  value={raastPayload}
                  size={150}
                  label="Scan with any banking app supporting Raast P2M / P2P"
                />
              </div>

              {/* Account Details & 1-Click Copy */}
              <div className="p-3 rounded-xl bg-white/90 border border-[#BFB3A3]/40 space-y-2 text-xs">
                {/* Exact Amount */}
                <div className="flex items-center justify-between py-1.5 border-b border-[#BFB3A3]/20">
                  <span className="text-[#5C5248] font-medium">Exact Amount:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-sm text-[#2A2520]">
                      Rs. {amountInPkr.toLocaleString()} PKR
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(amountInPkr), 'raast_amount', 'Amount')}
                      aria-label="Copy exact amount"
                      className="p-1 rounded hover:bg-[#E8D9C5] text-[#5C5248]"
                    >
                      {copiedKey === 'raast_amount' ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Raast ID */}
                <div className="flex items-center justify-between py-1.5 border-b border-[#BFB3A3]/20">
                  <span className="text-[#5C5248] font-medium">Raast ID (Mobile):</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#2A2520]">{raastId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(raastId, 'raast_id', 'Raast ID')}
                      aria-label="Copy Raast ID"
                      className="p-1 rounded hover:bg-[#E8D9C5] text-[#5C5248]"
                    >
                      {copiedKey === 'raast_id' ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bank IBAN (if provided) */}
                {merchantIban && (
                  <div className="flex items-center justify-between py-1.5 border-b border-[#BFB3A3]/20">
                    <span className="text-[#5C5248] font-medium">Bank IBAN:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-[#2A2520]">{ibanNumber}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(ibanNumber, 'raast_iban', 'Bank IBAN')}
                        aria-label="Copy Bank IBAN"
                        className="p-1 rounded hover:bg-[#E8D9C5] text-[#5C5248]"
                      >
                        {copiedKey === 'raast_iban' ? (
                          <Check size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Reference */}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[#5C5248] font-medium">Reference / Memo:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#C97B5A]">
                      {squareNote || referenceId}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          squareNote || referenceId,
                          'raast_ref',
                          'Raast reference note'
                        )
                      }
                      aria-label="Copy Raast reference"
                      className="p-1 rounded hover:bg-[#E8D9C5] text-[#5C5248]"
                    >
                      {copiedKey === 'raast_ref' ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bank Apps Chip Strip */}
              <div className="pt-0.5 text-center">
                <span className="text-[10px] text-[#6B5E52] uppercase tracking-wide block mb-1">
                  Supported in all Pakistani mobile apps
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1 text-[10px] font-mono text-[#4A3E31]">
                  <span className="px-2 py-0.5 bg-white rounded border border-[#BFB3A3]/30">Meezan</span>
                  <span className="px-2 py-0.5 bg-white rounded border border-[#BFB3A3]/30">SadaPay</span>
                  <span className="px-2 py-0.5 bg-white rounded border border-[#BFB3A3]/30">NayaPay</span>
                  <span className="px-2 py-0.5 bg-white rounded border border-[#BFB3A3]/30">HBL</span>
                  <span className="px-2 py-0.5 bg-white rounded border border-[#BFB3A3]/30">Alfalah</span>
                </div>
              </div>

              {/* Instant AI OCR Receipt Upload */}
              <div className="p-3.5 rounded-2xl bg-white/80 border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-700" />
                    Instant Verification (Upload Screenshot)
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    AI OCR
                  </span>
                </div>

                <p className="text-[11px] text-[#5C5248] leading-tight">
                  Take a screenshot in your banking app after transfer. Our OCR scans the RRN and confirms your payment in seconds.
                </p>

                {ocrVerified ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-2.5 text-xs font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p>Payment Verified Instantly!</p>
                      <p className="text-[10px] font-mono text-emerald-600">RRN: {verifiedRrn}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold text-emerald-900 transition-colors">
                      {ocrScanning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                          <span>Scanning receipt via OCR...</span>
                        </>
                      ) : (
                        <>
                          {ocrReceiptPreview ? (
                            <img src={ocrReceiptPreview} alt="Receipt" className="w-5 h-5 object-cover rounded border border-emerald-400" />
                          ) : (
                            <Upload className="w-4 h-4 text-emerald-600" />
                          )}
                          <span>{ocrReceiptFile ? 'Change Receipt Screenshot' : 'Upload Bank Transfer Screenshot'}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={ocrScanning}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleReceiptUpload(f);
                        }}
                      />
                    </label>

                    {ocrError && (
                      <p className="text-[11px] text-amber-700 font-mono">
                        {ocrError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Paid Action */}
              <button
                type="button"
                onClick={handleClaimPaid}
                disabled={claimSent || ocrScanning}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#5F6F52] text-white font-bold text-xs hover:opacity-95 transition-opacity disabled:opacity-75 flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#5F6F52] focus-visible:outline-none"
              >
                {claimSent ? (
                  <>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>Payment Claimed — Awaiting Verification</span>
                  </>
                ) : (
                  <>
                    <Check size={16} aria-hidden="true" />
                    <span>I Have Sent Rs. {amountInPkr.toLocaleString()} via Raast</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              PANEL 4: PAKISTAN MOBILE WALLETS (JAZZCASH & EASYPAISA)
             ───────────────────────────────────────────────────────────── */}
          {selectedRail === 'wallets' && (
            <div
              id="panel-wallets"
              role="tabpanel"
              aria-labelledby="tab-wallets"
              className="space-y-3"
            >
              <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-950 flex items-center gap-1.5">
                    <Smartphone size={14} className="text-orange-700" aria-hidden="true" />
                    JazzCash & EasyPaisa Direct
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-900">
                    Instant Mobile Wallets
                  </span>
                </div>
                <p className="text-[#4A3E31] leading-relaxed">
                  Transfer directly to the merchant’s verified wallet number. Always include the
                  reference code in the transaction note.
                </p>
              </div>

              {/* Wallet Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* JazzCash */}
                <div className="p-3 rounded-xl bg-white border border-[#BFB3A3]/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#991B1B]">JazzCash</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(jazzCashNumber, 'jazzcash_num', 'JazzCash number')
                      }
                      className="text-[10px] text-[#5C5248] hover:text-[#2A2520] underline flex items-center gap-1"
                    >
                      {copiedKey === 'jazzcash_num' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="font-mono text-sm font-bold text-[#2A2520]">{jazzCashNumber}</div>
                  <span className="text-[10px] text-[#5C5248]">Account Title: Verified Merchant</span>
                </div>

                {/* EasyPaisa */}
                <div className="p-3 rounded-xl bg-white border border-[#BFB3A3]/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#166534]">EasyPaisa</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(easyPaisaNumber, 'easypaisa_num', 'EasyPaisa number')
                      }
                      className="text-[10px] text-[#5C5248] hover:text-[#2A2520] underline flex items-center gap-1"
                    >
                      {copiedKey === 'easypaisa_num' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="font-mono text-sm font-bold text-[#2A2520]">{easyPaisaNumber}</div>
                  <span className="text-[10px] text-[#5C5248]">Account Title: Verified Merchant</span>
                </div>
              </div>

              {/* Exact Amount & Reference */}
              <div className="p-3 rounded-xl bg-white border border-[#BFB3A3]/40 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-[#BFB3A3]/20">
                  <span className="text-[#5C5248]">Exact Transfer Amount:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#2A2520]">
                      Rs. {amountInPkr.toLocaleString()} PKR
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(amountInPkr), 'wallet_amount', 'Amount')}
                      aria-label="Copy exact amount"
                      className="p-1 rounded hover:bg-[#E8D9C5] text-[#5C5248]"
                    >
                      {copiedKey === 'wallet_amount' ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-[#5C5248]">Mandatory Reference / Memo:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#C97B5A]">
                      {squareNote || referenceId}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(squareNote || referenceId, 'wallet_ref', 'Reference code')
                      }
                      aria-label="Copy Reference"
                      className="p-1 rounded hover:bg-[#E8D9C5] text-[#5C5248]"
                    >
                      {copiedKey === 'wallet_ref' ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Instant AI OCR Verification Dropzone for Wallets */}
              <div className="p-3 rounded-xl bg-white border border-[#BFB3A3]/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#2A2520] flex items-center gap-1.5">
                    <Camera size={14} className="text-[#C97B5A]" />
                    <span>Upload Wallet Screenshot (Instant Verification)</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#5F6F52] font-semibold bg-[#5F6F52]/10 px-2 py-0.5 rounded">
                    AI OCR
                  </span>
                </div>
                <p className="text-[11px] text-[#5C5248]">
                  Paid via JazzCash or EasyPaisa? Upload your receipt screenshot and our AI engine will verify the transaction ID instantly without manual review.
                </p>

                {ocrVerified ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-2 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <p>Payment Verified Instantly!</p>
                      <p className="text-[10px] font-mono text-emerald-600">Ref: {verifiedRrn}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleReceiptUpload(f);
                        }}
                        disabled={ocrScanning}
                      />
                      <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-[#BFB3A3] hover:border-[#C97B5A] bg-[#FAF8F5] text-xs font-medium text-[#2A2520] transition-colors">
                        {ocrScanning ? (
                          <>
                            <Loader2 size={14} className="animate-spin text-[#C97B5A]" />
                            <span>Scanning receipt...</span>
                          </>
                        ) : (
                          <>
                            {ocrReceiptPreview ? (
                              <img src={ocrReceiptPreview} alt="Receipt" className="w-5 h-5 object-cover rounded border border-[#C97B5A]" />
                            ) : (
                              <Upload size={14} className="text-[#C97B5A]" />
                            )}
                            <span>{ocrReceiptFile ? 'Change Screenshot' : 'Choose Screenshot'}</span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                )}

                {ocrError && (
                  <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700">
                    {ocrError}
                  </div>
                )}
              </div>

              {/* Submit Claim Action */}
              <button
                type="button"
                onClick={handleClaimPaid}
                disabled={claimSent || ocrScanning}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#C97B5A] text-white font-bold text-xs hover:opacity-95 transition-opacity disabled:opacity-75 flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C97B5A] focus-visible:outline-none"
              >
                {claimSent ? (
                  <>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>Receipt Claim Sent</span>
                  </>
                ) : (
                  <>
                    <Check size={16} aria-hidden="true" />
                    <span>I Have Sent Rs. {amountInPkr.toLocaleString()} via Mobile Wallet</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Sharia Compliance & Escrow Notice */}
          <div className="p-2.5 rounded-xl bg-[#5F6F52]/10 border border-[#5F6F52]/25 text-[11px] text-[#3e4935] flex items-start gap-2">
            <Shield size={14} className="text-[#5F6F52] mt-0.5 shrink-0" aria-hidden="true" />
            <span className="leading-snug">
              <strong>Sharia-Compliant Escrow:</strong> Your funds are held in a Sharia-compliant escrow. Any profit generated by the liquidity vault is shared 50/50, with no guaranteed interest (Riba) involved.
            </span>
          </div>

          {/* Trust & Escrow Guarantee Footer */}
          <div className="pt-2 border-t border-[#BFB3A3]/30 flex items-center justify-between text-[11px] text-[#5C5248]">
            <div className="flex items-center gap-1.5">
              <Shield size={13} className="text-[#5F6F52]" aria-hidden="true" />
              <span>Sulha Cryptographic Escrow Guarantee · AAOIFI Aligned</span>
            </div>
            <span className="font-mono text-[10px]">PABANDI v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PabandiCheckoutModal;
