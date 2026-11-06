import { useWallets } from '@privy-io/react-auth/solana';
import { useMemo } from 'react';

export interface EmbeddedWalletInfo {
  address?: string;
  standardWallet?: { name?: string };
  [key: string]: unknown;
}

/**
 * Returns the embedded Privy wallet (auto-created for email users) or
 * the first available external wallet. Returns null until wallets are ready.
 *
 * If Privy is not configured (no valid VITE_PRIVY_APP_ID), returns safe null state.
 */
export function useEmbeddedSolanaWallet() {
  const isPrivyConfigured = Boolean(
    import.meta.env.VITE_PRIVY_APP_ID &&
      typeof import.meta.env.VITE_PRIVY_APP_ID === 'string' &&
      import.meta.env.VITE_PRIVY_APP_ID.length === 25
  );

  let wallets: EmbeddedWalletInfo[] = [];
  let ready = false;

  if (isPrivyConfigured) {
    try {
      const result = useWallets();
      wallets = (result?.wallets ?? []) as unknown as EmbeddedWalletInfo[];
      ready = result?.ready ?? false;
    } catch {
      wallets = [];
      ready = false;
    }
  }

  const wallet = useMemo(() => {
    if (!ready || !wallets.length) return null;
    return wallets.find((w) => w.standardWallet?.name === 'Privy') ?? wallets[0];
  }, [wallets, ready]);

  return { wallet, ready };
}
