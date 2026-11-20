import React, { useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useExportWallet } from '@privy-io/react-auth/solana';
import { KeyRound, Sparkles } from 'lucide-react';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';

interface PrivyEmbeddedSetupButtonProps {
  onAddressReady: (solanaAddress: string) => Promise<void>;
  onError?: (message: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

interface PrivyExportKeyButtonProps {
  activeAddress?: string | null;
  isExternalPhantom?: boolean;
  onShowPhantomGuidance: () => void;
  onError?: (message: string) => void;
}

export function isPrivyEmbeddedConfigured(): boolean {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;
  return Boolean(appId && typeof appId === 'string' && appId.length === 25);
}

/**
 * 1-click Email / Google / Apple embedded Solana wallet setup powered by Pabandi's
 * live Privy integration (`createOnLogin: 'users-without-wallets'`).
 *
 * Safely guards hooks behind `isPrivyEmbeddedConfigured()` so local environments
 * without `VITE_PRIVY_APP_ID` never crash.
 */
export const PrivyEmbeddedSetupButton: React.FC<PrivyEmbeddedSetupButtonProps> = (props) => {
  if (!isPrivyEmbeddedConfigured()) {
    return null;
  }
  return <PrivyEmbeddedSetupButtonActive {...props} />;
};

const PrivyEmbeddedSetupButtonActive: React.FC<PrivyEmbeddedSetupButtonProps> = ({
  onAddressReady,
  onError,
  label = 'Create Free Account with Email / Google',
  disabled = false,
  className = '',
}) => {
  const { login, authenticated, ready: authReady } = usePrivy();
  const { wallet, ready: walletReady } = useEmbeddedSolanaWallet();

  const [waitingForWallet, setWaitingForWallet] = useState(false);
  const [saving, setSaving] = useState(false);
  const handledAddressRef = useRef<string | null>(null);

  const commitAddress = async (address: string) => {
    if (handledAddressRef.current === address) return;
    handledAddressRef.current = address;
    setSaving(true);
    try {
      await onAddressReady(address);
    } catch (err: any) {
      handledAddressRef.current = null;
      onError?.(err?.message || 'Could not save your digital dollar payout account.');
    } finally {
      setSaving(false);
      setWaitingForWallet(false);
    }
  };

  useEffect(() => {
    if (!waitingForWallet) return;
    if (authenticated && walletReady && wallet?.address) {
      void commitAddress(wallet.address);
    }
  }, [waitingForWallet, authenticated, walletReady, wallet?.address]);

  const handleClick = async () => {
    if (disabled || saving) return;

    if (authenticated && wallet?.address) {
      await commitAddress(wallet.address);
      return;
    }

    setWaitingForWallet(true);
    try {
      await login();
    } catch (err: any) {
      setWaitingForWallet(false);
      onError?.(err?.message || 'Sign-in was cancelled. You can try again anytime.');
    }
  };

  const busy = waitingForWallet || saving;

  return (
    <button
      type="button"
      disabled={disabled || busy || !authReady}
      onClick={handleClick}
      className={
        className ||
        'flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-white border border-[rgba(191,179,163,0.55)] text-[var(--warm-ink)] hover:border-[var(--clay)] transition disabled:opacity-50'
      }
    >
      <Sparkles size={15} className="text-[var(--clay)]" />
      {saving
        ? 'Saving embedded wallet…'
        : waitingForWallet
        ? 'Creating your 1-Click wallet…'
        : label}
    </button>
  );
};

/**
 * Exports the user's Pabandi Embedded Wallet private key via Privy's MFA-protected
 * iframe modal (`useExportWallet`), or surfaces calm self-custody Phantom guidance
 * when the merchant is using an external Phantom extension wallet.
 */
export const PrivyExportKeyButton: React.FC<PrivyExportKeyButtonProps> = (props) => {
  if (!isPrivyEmbeddedConfigured() || props.isExternalPhantom) {
    return (
      <button
        type="button"
        onClick={props.onShowPhantomGuidance}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-[rgba(191,179,163,0.55)] bg-white text-[var(--warm-ink)] hover:border-[var(--clay)] transition"
      >
        <KeyRound size={14} className="text-[var(--clay)]" />
        Export Private Key
      </button>
    );
  }
  return <PrivyExportKeyButtonActive {...props} />;
};

const PrivyExportKeyButtonActive: React.FC<PrivyExportKeyButtonProps> = ({
  activeAddress,
  onShowPhantomGuidance,
  onError,
}) => {
  const { authenticated } = usePrivy();
  const { wallet } = useEmbeddedSolanaWallet();
  const { exportWallet } = useExportWallet();
  const [exporting, setExporting] = useState(false);

  const embeddedAddress = wallet?.address ?? null;
  const isUsingEmbeddedWallet = Boolean(
    authenticated &&
      embeddedAddress &&
      (!activeAddress || activeAddress === embeddedAddress)
  );

  const handleExport = async () => {
    if (!isUsingEmbeddedWallet) {
      onShowPhantomGuidance();
      return;
    }
    setExporting(true);
    try {
      await exportWallet(embeddedAddress ? { address: embeddedAddress } : undefined);
    } catch (err: any) {
      onError?.(err?.message || 'Private key export was cancelled.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={exporting}
      onClick={handleExport}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-[rgba(191,179,163,0.55)] bg-white text-[var(--warm-ink)] hover:border-[var(--clay)] transition disabled:opacity-50"
    >
      <KeyRound size={14} className="text-[var(--clay)]" />
      {exporting ? 'Opening Secure Key Export…' : 'Export Private Key'}
    </button>
  );
};
