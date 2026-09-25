import { useEffect, useState } from 'react'
import { PrivyProvider as PrivyReactProvider } from '@privy-io/react-auth'

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [appId, setAppId] = useState<string | null>(null)

  useEffect(() => {
    const id = import.meta.env.VITE_PRIVY_APP_ID
    if (id) {
      setAppId(id)
      setReady(true)
    }
  }, [])

  if (!ready || !appId) {
    return <>{children}</>
  }

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

  return (
    <PrivyReactProvider appId={appId} config={config}>
      {children}
    </PrivyReactProvider>
  )
}
