import { usePrivy } from '@privy-io/react-auth'
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet'

interface PrivyWalletConnectorProps {
  onConnect?: (publicKey: string) => void
  onDisconnect?: () => void
}

export function PrivyWalletConnector({ onConnect, onDisconnect }: PrivyWalletConnectorProps) {
  const { login, logout, user, authenticated } = usePrivy()
  const { wallet } = useEmbeddedSolanaWallet()

  // Derive public key from Privy wallet
  const publicKey = wallet?.address ?? ''

  const handleConnect = async () => {
    // login() triggers Privy modal — email or existing wallet
    await login()
    // After login, Privy auto-creates embedded wallet if needed.
    // The useEmbeddedSolanaWallet hook picks it up on next render.
    onConnect?.(publicKey)
  }

  const handleDisconnect = async () => {
    await logout()
    onDisconnect?.()
  }

  if (authenticated && publicKey) {
    return (
      <div className="privy-wallet-connector">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-[var(--warm-ink)] bg-[var(--warm-sand)] px-3 py-1 rounded-lg">
            {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
          </span>
          <button
            onClick={handleDisconnect}
            className="px-3 py-1 text-xs rounded-lg bg-[var(--terracotta)]/20 text-[var(--terracotta)] hover:bg-[var(--terracotta)]/30 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="privy-wallet-connector">
      <button
        onClick={handleConnect}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
        style={{ background: 'var(--clay)', color: 'var(--warm-ink)' }}
      >
        {user?.email ? `Sign in as ${user.email}` : 'Sign in with email'}
      </button>
    </div>
  )
}

export default PrivyWalletConnector
