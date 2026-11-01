import { useWallets } from '@privy-io/react-auth/solana'
import { useMemo } from 'react'

/**
 * Returns the embedded Privy wallet (auto-created for email users) or
 * the first available external wallet. Returns null until wallets are ready.
 *
 * If Privy is not configured (no VITE_PRIVY_APP_ID), useWallets throws.
 * We catch that and return an empty/waiting state so the app doesn't crash.
 */
export function useEmbeddedSolanaWallet() {
  let wallets: any[] = []
  let ready = false

  try {
    const result = useWallets()
    wallets = result.wallets
    ready = result.ready
  } catch {
    // Privy is not configured; no wallets available
    wallets = []
    ready = false
  }

  const wallet = useMemo(() => {
    if (!ready || !wallets.length) return null
    // Prefer the embedded Privy wallet; fallback to first available
    return (
      wallets.find(w => w.standardWallet?.name === 'Privy') ?? wallets[0]
    )
  }, [wallets, ready])

  return { wallet, ready }
}
