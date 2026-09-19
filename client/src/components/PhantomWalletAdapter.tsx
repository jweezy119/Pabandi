import { useState, useEffect } from 'react';

interface PhantomWalletAdapterProps {
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
}

function PhantomWalletAdapter({ onConnect, onDisconnect }: PhantomWalletAdapterProps) {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string>('');

  useEffect(() => {
    const solana = (window as any).solana;
    if (solana?.isPhantom) {
      const handleConnect = (pk: any) => {
        setConnected(true);
        setPublicKey(pk.toString());
        onConnect?.(pk.toString());
      };
      const handleDisconnect = () => {
        setConnected(false);
        setPublicKey('');
        onDisconnect?.();
      };
      solana.on('connect', handleConnect);
      solana.on('disconnect', handleDisconnect);
      if (solana.publicKey) {
        setConnected(true);
        setPublicKey(solana.publicKey.toString());
      }
      return () => {
        solana.off('connect', handleConnect);
        solana.off('disconnect', handleDisconnect);
      };
    }
  }, []);

  const connect = async () => {
    const solana = (window as any).solana;
    if (!solana?.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }
    try {
      const resp = await solana.connect();
      setPublicKey(resp.publicKey.toString());
      setConnected(true);
      onConnect?.(resp.publicKey.toString());
    } catch (err) {
      console.error('Phantom connection failed:', err);
    }
  };

  const disconnect = async () => {
    await (window as any).solana?.disconnect();
    setConnected(false);
    setPublicKey('');
    onDisconnect?.();
  };

  return (
    <div className="phantom-wallet-adapter">
      {!connected ? (
        <button onClick={connect} className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105">
          Connect Phantom Wallet
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-slate-300 bg-slate-800 px-3 py-1 rounded-lg">
            {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
          </span>
          <button onClick={disconnect} className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export { PhantomWalletAdapter };
export default PhantomWalletAdapter;
