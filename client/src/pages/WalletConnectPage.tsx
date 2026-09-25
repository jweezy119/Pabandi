import { useState } from 'react'
import { Surface, Button, Badge, tokens } from '../design-system'
import { usePrivy } from '@privy-io/react-auth'
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet'

export const WalletConnectPage: React.FC = () => {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const { login, logout, user, authenticated, ready } = usePrivy()
  const { wallet } = useEmbeddedSolanaWallet()

  const handleConnect = async () => {
    setConnecting(true)
    setError('')
    try {
      await login()
    } catch (e: any) {
      setError(e.message || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setConnecting(true)
    setError('')
    try {
      await logout()
    } catch (e: any) {
      setError(e.message || 'Disconnect failed')
    } finally {
      setConnecting(false)
    }
  }

  const truncate = (addr: string) =>
    addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : ''

  const walletAddress = wallet?.address ?? ''

  if (!ready) {
    return (
      <div className="min-h-screen" style={{ background: tokens.color.background }}>
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--sage)] border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-[var(--soft-stone)]">Loading wallet provider...</p>
        </div>
      </div>
    )
  }

  if (authenticated && walletAddress) {
    return (
      <div className="min-h-screen" style={{ background: tokens.color.background }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Surface className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">
              Wallet Ready
            </h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge tone="success">Privy Embedded Wallet</Badge>
              <span className="text-sm text-[var(--soft-stone)] font-mono">
                {truncate(walletAddress)}
              </span>
            </div>
            <p className="text-sm text-[var(--soft-stone)] mb-4">
              Your Solana wallet was created automatically. No seed phrase to save.
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => navigator.clipboard.writeText(walletAddress)}
                variant="ghost"
              >
                Copy Address
              </Button>
              <Button onClick={handleDisconnect} variant="ghost">
                Disconnect
              </Button>
            </div>
          </Surface>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🔗 Wallet Connect</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--warm-ink)] font-headline">
            Connect Your Wallet
          </h1>
          <p className="mt-3 text-[var(--soft-stone)] max-w-2xl mx-auto">
            Sign in with email to get a Solana wallet automatically.
            No downloads, no seed phrases, no SOL needed.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{
              background: tokens.color.danger + '15',
              color: tokens.color.danger,
              border: `1px solid ${tokens.color.danger}30`,
            }}
          >
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Surface className="p-4">
            <h3 className="text-base font-bold text-[var(--warm-ink)] mb-3">
              Sign In
            </h3>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] hover:bg-[var(--warm-sand)] transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--clay)]/20 flex items-center justify-center text-xl">
                🔑
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[var(--warm-ink)]">
                  Email Sign In
                </div>
                <div className="text-xs" style={{ color: tokens.color.textDim }}>
                  Get a Solana wallet instantly. No downloads needed.
                </div>
              </div>
              <Badge tone="success">New</Badge>
            </button>
            {user?.email && (
              <p className="text-xs mt-3 text-[var(--soft-stone)]">
                Signed in as <span className="font-mono">{user.email as string}</span>
              </p>
            )}
          </Surface>

          <Surface className="p-4">
            <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-2">
              Already have a wallet?
            </h3>
            <p className="text-xs mb-3" style={{ color: tokens.color.textDim }}>
              Connect Phantom, Solflare, or any Solana wallet instead.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => window.open('https://phantom.app', '_blank')}
                size="sm"
                className="flex-1"
              >
                Get Phantom
              </Button>
              <Button
                onClick={() => window.open('https://solflare.com', '_blank')}
                size="sm"
                className="flex-1"
              >
                Get Solflare
              </Button>
            </div>
          </Surface>
        </div>

        <Surface className="p-4 mt-6">
          <h3 className="text-base font-bold text-[var(--warm-ink)] mb-3">
            What you can do with a connected wallet
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '💰', text: 'Earn $PAB rewards' },
              { icon: '🏆', text: 'Stake for trust badges' },
              { icon: '🛡️', text: 'Secure escrow sales' },
              { icon: '🗳️', text: 'Vote on governance' },
              { icon: '📈', text: 'Earn yield' },
              { icon: '🤝', text: 'Refer and earn' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-[var(--warm-sand)]"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs text-[var(--warm-ink)]">{item.text}</span>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  )
}

export default WalletConnectPage
