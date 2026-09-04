import React, { useState, useEffect } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { authService } from '../services/api';

declare global {
  interface Window {
    solana?: any;
    solflare?: any;
    phantom?: any;
 }
}

type WalletType = 'phantom' | 'solflare' | 'sollet' | 'torus' | 'walletconnect' | null;

export const WalletConnectPage: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if already connected
    if (window.solana?.isConnected) {
      setConnected(true);
      setAddress(window.solana.publicKey?.toString() || '');
      setWalletType('phantom');
    } else if (window.solflare?.isConnected) {
      setConnected(true);
      setAddress(window.solflare.publicKey?.toString() || '');
      setWalletType('solflare');
    }
  }, []);

  const connectPhantom = async () => {
    setConnecting(true);
    setError('');
    try {
      if (window.solana?.isPhantom) {
        const resp = await window.solana.connect();
        setAddress(resp.publicKey.toString());
        setWalletType('phantom');
        setConnected(true);
        saveWallet(resp.publicKey.toString(), 'solana');
      } else {
        // Mobile: open Phantom app via deep link
        const deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`;
        window.open(deepLink, '_blank');
        setError('Phantom not detected. Opening app store...');
      }
    } catch (e: any) {
      setError(e.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const connectSolflare = async () => {
    setConnecting(true);
    setError('');
    try {
      if (window.solflare) {
        await window.solflare.connect();
        setAddress(window.solflare.publicKey?.toString() || '');
        setWalletType('solflare');
        setConnected(true);
        saveWallet(window.solflare.publicKey?.toString() || '', 'solana');
      } else {
        window.open('https://solflare.com', '_blank');
        setError('Solflare not detected. Opening website...');
      }
    } catch (e: any) {
      setError(e.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const connectWalletConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      // WalletConnect v2 for mobile wallets
      setError('WalletConnect coming soon. Use Phantom or Solflare for now.');
    } catch (e: any) {
      setError(e.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const saveWallet = async (addr: string, chain: string) => {
    try {
      await authService.connectWallet(addr, chain);
    } catch (e: any) {
      console.error('Failed to save wallet:', e);
    }
  };

  const disconnect = async () => {
    try {
      if (walletType === 'phantom' && window.solana) {
        await window.solana.disconnect();
      } else if (walletType === 'solflare' && window.solflare) {
        await window.solflare.disconnect();
      }
      setConnected(false);
      setAddress('');
      setWalletType(null);
      setBalance(null);
    } catch (e: any) {
      setError(e.message || 'Disconnect failed');
    }
  };

  const truncate = (addr: string) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🔗 Wallet Connect</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100 font-headline">
            Connect Your Wallet
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Connect your Solana wallet to earn $PAB, stake for trust, and access all Pabandi features.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger, border: `1px solid ${tokens.color.danger}30` }}>
            {error}
          </div>
        )}

        {connected ? (
          <Surface className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Wallet Connected</h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge tone="success">{walletType === 'phantom' ? 'Phantom' : walletType === 'solflare' ? 'Solflare' : 'Wallet'}</Badge>
              <span className="text-sm text-slate-400 font-mono">{truncate(address)}</span>
            </div>
            {balance !== null && (
              <div className="text-2xl font-bold text-emerald-300 mb-4">{balance.toFixed(4)} SOL</div>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigator.clipboard.writeText(address)} variant="ghost">Copy Address</Button>
              <Button onClick={disconnect} variant="ghost">Disconnect</Button>
            </div>
          </Surface>
        ) : (
          <div className="space-y-3">
            <Surface className="p-4">
              <h3 className="text-base font-bold text-slate-100 mb-3">Choose Wallet</h3>
              <div className="space-y-2">
                <button onClick={connectPhantom} disabled={connecting} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl">👻</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-100">Phantom</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Most popular Solana wallet</div>
                  </div>
                  <Badge tone="success">Recommended</Badge>
                </button>

                <button onClick={connectSolflare} disabled={connecting} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-xl">🔥</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-100">Solflare</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Feature-rich Solana wallet</div>
                  </div>
                </button>

                <button onClick={connectWalletConnect} disabled={connecting} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl">🔗</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-100">WalletConnect</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>Mobile wallets (Trust, SafePal, etc.)</div>
                  </div>
                  <Badge tone="info">Coming Soon</Badge>
                </button>
              </div>
            </Surface>

            <Surface className="p-4">
              <h3 className="text-sm font-bold text-slate-100 mb-2">Don't have a wallet?</h3>
              <p className="text-xs mb-3" style={{ color: tokens.color.muted }}>Download Phantom or Solflare to get started. Both work on mobile and desktop.</p>
              <div className="flex gap-2">
                <Button onClick={() => window.open('https://phantom.app', '_blank')} size="sm" className="flex-1">Get Phantom</Button>
                <Button onClick={() => window.open('https://solflare.com', '_blank')} size="sm" className="flex-1">Get Solflare</Button>
              </div>
            </Surface>
          </div>
        )}

        {/* What you can do */}
        <Surface className="p-4 mt-6">
          <h3 className="text-base font-bold text-slate-100 mb-3">What you can do with a connected wallet</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '💰', text: 'Earn $PAB rewards' },
              { icon: '🏆', text: 'Stake for trust badges' },
              { icon: '🛡️', text: 'Secure escrow sales' },
              { icon: '🗳️', text: 'Vote on governance' },
              { icon: '📈', text: 'Earn yield' },
              { icon: '🤝', text: 'Refer and earn' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs text-slate-300">{item.text}</span>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default WalletConnectPage;
