import React from 'react';
import { PrivyProvider as PrivyReactProvider, type PrivyClientConfig } from '@privy-io/react-auth';

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID || 'cm1pabandi_dev_app';

  const config: PrivyClientConfig = {
    solana: {
      rpcs: {
        'solana:mainnet': {
          rpc: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        },
      },
    },
    appearance: {
      walletChainType: 'solana-only',
      showWalletLoginFirst: false,
    },
    loginMethods: ['email', 'wallet'],
    embeddedWallets: {
      solana: { createOnLogin: 'users-without-wallets' },
    },
  };

  return (
    <PrivyReactProvider appId={appId} config={config}>
      {children}
    </PrivyReactProvider>
  );
}
