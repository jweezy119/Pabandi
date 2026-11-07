import { useEffect, useState } from 'react';
import { X, Shield, AlertTriangle, Wallet, Zap, CreditCard, Copy, Check } from 'lucide-react';
import { Connection, Transaction } from '@solana/web3.js';
import { API_HOST } from '../utils/apiHost';
import { getAuthToken } from '../utils/authToken';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';

export interface DepositPrompt {
  /** Where to send the user to fund. Absolute URL or solana: URI supplied by the engine. */
  checkoutUrl: string;
  /** What the deposit is for, shown so the figure is not a mystery. */
  description?: string;
  amount?: number;
  currency?: string;
  band?: string | null;
  referenceId?: string;
}

interface Props {
  prompt: DepositPrompt | null;
  onClose: () => void;
  /** Fired when the user says they have funded. Not proof -- the engine re-checks. */
  onFunded: () => void;
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DEFAULT_ESCROW_VAULT =
  import.meta.env.VITE_ESCROW_VAULT_ADDRESS || 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';

interface SignableSolanaWallet {
  address?: string;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
}

function parseSolanaRecipient(checkoutUrl: string): string {
  if (!checkoutUrl.startsWith('solana:')) return DEFAULT_ESCROW_VAULT;
  const withoutScheme = checkoutUrl.slice('solana:'.length);
  const addressPart = withoutScheme.split('?')[0]?.trim() || '';
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addressPart) ? addressPart : DEFAULT_ESCROW_VAULT;
}

export function EmbeddedCheckoutModal({ prompt, onClose, onFunded }: Props) {
  const isSolanaNativeUrl = Boolean(prompt?.checkoutUrl?.startsWith('solana:'));
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'solana' | 'hosted'>(isSolanaNativeUrl ? 'solana' : 'hosted');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { wallet } = useEmbeddedSolanaWallet();
  const solanaWallet = wallet as SignableSolanaWallet | null;
  const walletAddress = solanaWallet?.address ?? '';

  useEffect(() => {
    setLoaded(false);
    setError(null);
    setTxHash(null);
    setMode(prompt?.checkoutUrl?.startsWith('solana:') ? 'solana' : 'hosted');
  }, [prompt?.checkoutUrl]);

  useEffect(() => {
    if (!prompt) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, onClose]);

  if (!prompt) return null;

  const amountVal = prompt.amount ?? 0;
  const targetVault = parseSolanaRecipient(prompt.checkoutUrl);
  const solanaUri = prompt.checkoutUrl.startsWith('solana:')
    ? prompt.checkoutUrl
    : `solana:${targetVault}?amount=${amountVal.toFixed(2)}&spl-token=${USDC_MINT}`;

  const handlePrivySignAndFund = async () => {
    if (!walletAddress) {
      setError('Connect your Privy Solana wallet in Trust & Verification settings first, or use the Solana Pay link below.');
      return;
    }

    setSigning(true);
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
          amountUsdc: amountVal,
        }),
      });

      const buildData = (await buildRes.json()) as {
        transaction?: string;
        error?: string;
      };

      if (!buildRes.ok || !buildData.transaction) {
        throw new Error(buildData.error || 'Could not construct USDC escrow transaction');
      }

      const txBytes = Uint8Array.from(atob(buildData.transaction), (c) => c.charCodeAt(0));
      const tx = Transaction.from(txBytes);

      if (typeof solanaWallet?.signTransaction !== 'function') {
        throw new Error('Wallet does not expose signTransaction; use Open in Solana Wallet below.');
      }

      const signedTx = await solanaWallet.signTransaction(tx);
      const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await fetch(`${API_HOST}/api/v1/solana-usdc/transfer/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fromWallet: walletAddress,
          toWallet: targetVault,
          amountUsdc: amountVal,
          txHash: signature,
          type: 'FUNDING',
          referenceId: prompt.referenceId || 'booking-escrow-deposit',
        }),
      });

      setTxHash(signature);
      onFunded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Privy Solana USDC transfer failed');
    } finally {
      setSigning(false);
    }
  };

  const handleCopyUri = async () => {
    try {
      await navigator.clipboard.writeText(solanaUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--cream)]/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Complete your deposit"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--cream)] rounded-2xl border border-[rgba(191,179,163,0.3)] shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(191,179,163,0.2)]">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[var(--sage)]" />
            <h2 className="text-base font-semibold text-[var(--warm-ink)]">Confirm your deposit</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-[var(--soft-stone)] hover:bg-[var(--warm-sand)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {prompt.amount !== undefined && (
          <div className="px-5 py-3 bg-[var(--sage)]/8 border-b border-[var(--sage)]/15">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--soft-stone)]">Deposit</span>
                {prompt.band && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--clay)]/15 text-[var(--clay)]">
                    Band {prompt.band}
                  </span>
                )}
              </div>
              <span className="text-lg font-bold text-[var(--warm-ink)]">
                {mode === 'solana' ? 'USDC' : prompt.currency ?? 'USDC'} {prompt.amount}
              </span>
            </div>
            {prompt.description && (
              <p className="text-xs text-[var(--soft-stone)] mt-1">{prompt.description}</p>
            )}
          </div>
        )}

        {/* Rail Toggle when a hosted HTTP URL is also present */}
        {!isSolanaNativeUrl && (
          <div className="px-5 pt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode('hosted')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                mode === 'hosted'
                  ? 'bg-[var(--clay)] text-white border-[var(--clay)]'
                  : 'bg-[var(--warm-sand)]/60 text-[var(--warm-ink)] border-[rgba(191,179,163,0.3)]'
              }`}
            >
              <CreditCard size={13} />
              Hosted Checkout
            </button>
            <button
              type="button"
              onClick={() => setMode('solana')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                mode === 'solana'
                  ? 'bg-[var(--clay)] text-white border-[var(--clay)]'
                  : 'bg-[var(--warm-sand)]/60 text-[var(--warm-ink)] border-[rgba(191,179,163,0.3)]'
              }`}
            >
              <Zap size={13} />
              Privy Solana USDC
            </button>
          </div>
        )}

        {mode === 'hosted' && !isSolanaNativeUrl ? (
          <div className="relative bg-white/40" style={{ height: 420 }}>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[var(--clay)]/20 border-t-[var(--clay)] rounded-full animate-spin" />
              </div>
            )}
            <iframe
              src={prompt.checkoutUrl}
              title="Deposit checkout"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-forms allow-popups"
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
            />
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="p-3.5 rounded-xl bg-[var(--warm-sand)]/60 border border-[rgba(191,179,163,0.35)] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--warm-ink)] flex items-center gap-1.5">
                  <Wallet size={14} className="text-[var(--clay)]" />
                  Privy Programmatic Key Wallet
                </span>
                <span className="font-mono text-[11px] text-[var(--soft-stone)]">
                  {walletAddress
                    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : 'Solana Pay Compatible'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--soft-stone)]">
                Vault: <code className="font-mono">{targetVault.slice(0, 8)}...{targetVault.slice(-6)}</code> · Mint: USDC (SPL)
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs">
                {error}
              </div>
            )}

            {txHash && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-mono break-all">
                ✓ Broadcast Tx: {txHash}
              </div>
            )}

            {walletAddress && (
              <button
                type="button"
                disabled={signing}
                onClick={handlePrivySignAndFund}
                className="w-full py-3 rounded-xl bg-[var(--clay)] text-white text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Wallet size={15} />
                {signing ? 'Signing USDC Escrow…' : `Sign & Lock ${amountVal.toFixed(2)} USDC with Privy`}
              </button>
            )}

            <a
              href={solanaUri}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--warm-ink)] text-[var(--cream)] text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity"
            >
              <Zap size={14} />
              Open in Solana Wallet ({amountVal.toFixed(2)} USDC)
            </a>

            <button
              type="button"
              onClick={handleCopyUri}
              className="w-full py-2 px-4 rounded-xl border border-[rgba(191,179,163,0.4)] bg-white/70 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied Solana Pay URI!' : 'Copy Solana Pay URI'}
            </button>
          </div>
        )}

        <div className="px-5 py-4 border-t border-[rgba(191,179,163,0.2)] space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-[var(--clay)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--soft-stone)] leading-relaxed">
              Your booking is held until the deposit clears. Close this window to go back and review your
              details — nothing is lost.
            </p>
          </div>
          <button
            onClick={onFunded}
            className="w-full py-3 rounded-xl bg-[var(--clay)] text-[var(--warm-ink)] font-semibold hover:bg-[var(--terracotta)] transition-colors"
          >
            I&apos;ve funded it
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmbeddedCheckoutModal;
