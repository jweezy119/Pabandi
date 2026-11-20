import { useState, useEffect } from 'react';
import {
  connectWithPhantom,
  disconnectPhantom,
  getCachedPhantomAddress,
  isPhantomEmbeddedConfigured,
  PhantomAuthProvider,
} from '../lib/phantomConnect';

interface PhantomWalletAdapterProps {
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
  showEmbeddedButtons?: boolean;
}

function PhantomWalletAdapter({
  onConnect,
  onDisconnect,
  showEmbeddedButtons = true,
}: PhantomWalletAdapterProps) {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>('');
  const embeddedReady = isPhantomEmbeddedConfigured();

  useEffect(() => {
    const existing = getCachedPhantomAddress();
    if (existing) {
      setConnected(true);
      setPublicKey(existing);
    }

    const solana = (window as any).solana;
    if (solana?.isPhantom) {
      const handleConnect = (pk: any) => {
        const addr = pk?.toString?.() || '';
        if (addr) {
          setConnected(true);
          setPublicKey(addr);
          onConnect?.(addr);
        }
      };
      const handleDisconnect = () => {
        setConnected(false);
        setPublicKey('');
        onDisconnect?.();
      };
      solana.on?.('connect', handleConnect);
      solana.on?.('disconnect', handleDisconnect);
      return () => {
        solana.off?.('connect', handleConnect);
        solana.off?.('disconnect', handleDisconnect);
      };
    }
  }, []);

  const handleConnect = async (provider: PhantomAuthProvider) => {
    setConnecting(true);
    setError('');
    try {
      const { address } = await connectWithPhantom(provider);
      setPublicKey(address);
      setConnected(true);
      onConnect?.(address);
    } catch (err: any) {
      const msg = err?.message || 'Phantom connection failed';
      if (provider === 'injected' && !(window as any).solana?.isPhantom) {
        window.open('https://phantom.app/', '_blank');
      }
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectPhantom();
    setConnected(false);
    setPublicKey('');
    onDisconnect?.();
  };

  return (
    <div className="phantom-wallet-adapter space-y-2">
      {!connected ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleConnect('injected')}
            disabled={connecting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50"
          >
            {connecting ? 'Connecting…' : 'Connect Phantom'}
          </button>
          {showEmbeddedButtons && embeddedReady && (
            <button
              onClick={() => handleConnect('google')}
              disabled={connecting}
              className="px-4 py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 font-medium text-sm text-[var(--warm-ink)] transition-all disabled:opacity-50"
            >
              Email / Google (Phantom Connect)
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-slate-200 bg-slate-800 px-3 py-1 rounded-lg">
            {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
          </span>
          <button
            onClick={handleDisconnect}
            className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export { PhantomWalletAdapter };
export default PhantomWalletAdapter;
