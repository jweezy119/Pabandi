import { useState } from 'react'
import { PrivyProvider as PrivyReactProvider } from '@privy-io/react-auth'

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID || undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
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
  }

  // When no Privy app ID is configured, render children without the wallet
  // provider. Components that call useWallets must handle missing context
  // gracefully (e.g. EmbeddedCheckoutModal checks VITE_PRIVY_APP_ID first).
  if (!appId) {
    return <>{children}</>
  }

  return (
    <PrivyReactProvider appId={appId} config={config}>
      {children}
    </PrivyReactProvider>
  )
}
