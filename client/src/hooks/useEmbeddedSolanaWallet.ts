import { useWallets } from '@privy-io/react-auth/solana'
import { useMemo } from 'react'

/**
 * Returns the embedded Privy wallet (auto-created for email users) or
 * the first available external wallet. Returns null until wallets are ready.
 */
export function useEmbeddedSolanaWallet() {
  const { wallets, ready } = useWallets()

  const wallet = useMemo(() => {
    if (!ready || !wallets.length) return null
    // Prefer the embedded Privy wallet; fallback to first available
    return (
      wallets.find(w => w.standardWallet?.name === 'Privy') ?? wallets[0]
    )
  }, [wallets, ready])

  return { wallet, ready }
}
