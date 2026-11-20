import React, { useState, useEffect, useMemo } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { authService } from '../services/api';
import {
  connectWithPhantom,
  disconnectPhantom,
  getCachedPhantomAddress,
  PhantomAuthProvider,
} from '../lib/phantomConnect';
import {
  PrivyEmbeddedSetupButton,
  isPrivyEmbeddedConfigured,
} from '../components/PrivyEmbeddedSetupButton';

declare global {
  interface Window {
    solana?: any;
    solflare?: any;
  }
}

type WalletType = 'phantom-connect' | 'phantom' | 'solflare' | null;
type StableAsset = 'USDC' | 'CASH';

function computeDrpePreview(trustScore: number, totalAmount: number) {
  const score = Math.max(0, Math.min(100, Math.round(trustScore)));
  if (score >= 95) {
    return {
      tier: 'Platinum',
      depositPct: 10,
      feePct: 0.3,
      deposit: +(totalAmount * 0.1).toFixed(2),
      fee: +(totalAmount * 0.003).toFixed(2),
      unlocked: +(totalAmount * 0.9).toFixed(2),
    };
  }
  if (score >= 80) {
    return {
      tier: 'Gold',
      depositPct: 25,
      feePct: 0.8,
      deposit: +(totalAmount * 0.25).toFixed(2),
      fee: +(totalAmount * 0.008).toFixed(2),
      unlocked: +(totalAmount * 0.75).toFixed(2),
    };
  }
  if (score >= 50) {
    return {
      tier: 'Standard',
      depositPct: 100,
      feePct: 1.5,
      deposit: +totalAmount.toFixed(2),
      fee: +(totalAmount * 0.015).toFixed(2),
      unlocked: 0,
    };
  }
  return {
    tier: 'New / Unverified',
    depositPct: 100,
    feePct: 2.5,
    deposit: +totalAmount.toFixed(2),
    fee: +(totalAmount * 0.025).toFixed(2),
    unlocked: 0,
  };
}

export const WalletConnectPage: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [address, setAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Interactive DRPE Trust-Priced Escrow preview state
  const [simScore, setSimScore] = useState(96);
  const [simAmount, setSimAmount] = useState(250);
  const [simAsset, setSimAsset] = useState<StableAsset>('CASH');

  const embeddedReady = isPrivyEmbeddedConfigured();
  const drpe = useMemo(() => computeDrpePreview(simScore, simAmount), [simScore, simAmount]);

  useEffect(() => {
    const cached = getCachedPhantomAddress();
    if (cached) {
      setConnected(true);
      setAddress(cached);
      setWalletType('phantom');
    } else if (window.solflare?.isConnected) {
      setConnected(true);
      setAddress(window.solflare.publicKey?.toString() || '');
      setWalletType('solflare');
    }
  }, []);

  const saveWallet = async (addr: string, chain: string) => {
    try {
      await authService.connectWallet(addr, chain);
    } catch (e: any) {
      console.error('Failed to save wallet:', e);
    }
  };

  const connectPhantom = async (provider: PhantomAuthProvider) => {
    setConnecting(true);
    setError('');
    try {
      const { address: solAddr } = await connectWithPhantom(provider);
      setAddress(solAddr);
      setWalletType(provider === 'injected' ? 'phantom' : 'phantom-connect');
      setConnected(true);
      await saveWallet(solAddr, 'solana');
    } catch (e: any) {
      if (provider === 'injected' && !window.solana?.isPhantom) {
        const deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`;
        window.open(deepLink, '_blank');
        setError('Phantom extension not detected. Opened Phantom app link.');
      } else {
        setError(e?.message || 'Phantom connection failed');
      }
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
        const addr = window.solflare.publicKey?.toString() || '';
        setAddress(addr);
        setWalletType('solflare');
        setConnected(true);
        await saveWallet(addr, 'solana');
      } else {
        window.open('https://solflare.com', '_blank');
        setError('Solflare not detected. Opening website...');
      }
    } catch (e: any) {
      setError(e?.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      if (walletType === 'phantom' || walletType === 'phantom-connect') {
        await disconnectPhantom();
      } else if (walletType === 'solflare' && window.solflare) {
        await window.solflare.disconnect();
      }
      setConnected(false);
      setAddress('');
      setWalletType(null);
    } catch (e: any) {
      setError(e?.message || 'Disconnect failed');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const truncate = (addr: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : '');

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center">
          <Badge tone="info" className="mb-3">Solana · Phantom Connect · USDC &amp; CASH</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--warm-ink)] font-headline">
            Trust-Priced Solana Wallet
          </h1>
          <p className="mt-3 text-[var(--soft-stone)] max-w-xl mx-auto">
            Sign in with Google/Apple via Phantom Connect or your native Phantom wallet to unlock non-custodial escrow deposits in USDC and Phantom CASH.
          </p>
        </div>

        {error && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{
              background: tokens.color.danger + '15',
              color: tokens.color.danger,
              border: `1px solid ${tokens.color.danger}30`,
            }}
          >
            {error}
          </div>
        )}

        {connected ? (
          <Surface className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">Solana Wallet Connected</h2>
            <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
              <Badge tone="success">
                {walletType === 'phantom-connect'
                  ? 'Embedded Solana Wallet'
                  : walletType === 'phantom'
                  ? 'Phantom'
                  : 'Solflare'}
              </Badge>
              <span className="text-sm text-[var(--soft-stone)] font-mono">{truncate(address)}</span>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleCopy} variant="ghost">
                {copied ? 'Copied!' : 'Copy Address'}
              </Button>
              <Button onClick={disconnect} variant="ghost">
                Disconnect
              </Button>
            </div>
          </Surface>
        ) : (
          <Surface className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--warm-ink)]">Connect with Phantom</h3>
              <Badge tone="success">Recommended</Badge>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => connectPhantom('injected')}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.25)] hover:opacity-95 transition-all text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl">
                  👻
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[var(--warm-ink)]">Phantom Wallet</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>
                    Browser extension &amp; mobile deep link · Supports USDC &amp; CASH
                  </div>
                </div>
              </button>

              {embeddedReady && (
                <PrivyEmbeddedSetupButton
                  disabled={connecting}
                  label="Sign in with Email / Google (Zero Seed Phrases)"
                  className="w-full flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
                  onError={(msg) => setError(msg)}
                  onAddressReady={async (solAddr) => {
                    setError('');
                    setAddress(solAddr);
                    setWalletType('phantom-connect');
                    setConnected(true);
                    await saveWallet(solAddr, 'solana');
                  }}
                />
              )}

              <button
                onClick={connectSolflare}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] hover:opacity-95 transition-all text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-xl">
                  🔥
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[var(--warm-ink)]">Solflare</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>
                    Native Solana wallet alternative
                  </div>
                </div>
              </button>
            </div>
          </Surface>
        )}

        {/* Interactive DRPE Trust-Priced Escrow Simulator */}
        <Surface className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-[var(--warm-ink)]">
                What Trust Unlocks On-Chain (DRPE)
              </h3>
              <p className="text-xs" style={{ color: tokens.color.textDim }}>
                Enforced directly by Pabandi&apos;s Solana Anchor escrow program (SPL Token &amp; Token-2022)
              </p>
            </div>
            <div className="flex gap-1.5">
              {(['CASH', 'USDC'] as StableAsset[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setSimAsset(a)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    simAsset === a
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-transparent text-[var(--soft-stone)] border-[rgba(191,179,163,0.3)]'
                  }`}
                >
                  {a === 'CASH' ? 'CASH (Phantom)' : 'USDC'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--soft-stone)]">Pabandi Trust Score</span>
                <span className="font-bold text-[var(--warm-ink)]">
                  {simScore} / 100 · {drpe.tier}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={simScore}
                onChange={(e) => setSimScore(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--soft-stone)]">Booking / Service Value</span>
                <span className="font-bold text-[var(--warm-ink)]">
                  ${simAmount} {simAsset}
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={1000}
                step={10}
                value={simAmount}
                onChange={(e) => setSimAmount(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)]">
              <div className="text-[11px]" style={{ color: tokens.color.textDim }}>
                Required Deposit ({drpe.depositPct}%)
              </div>
              <div className="text-lg font-black text-[var(--warm-ink)]">
                ${drpe.deposit} {simAsset}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)]">
              <div className="text-[11px]" style={{ color: tokens.color.textDim }}>
                Protocol Fee ({drpe.feePct}%)
              </div>
              <div className="text-lg font-black text-[var(--warm-ink)]">
                ${drpe.fee} {simAsset}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-[11px] text-emerald-400">Capital Unlocked</div>
              <div className="text-lg font-black text-emerald-300">
                ${drpe.unlocked} {simAsset}
              </div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[var(--soft-stone)] break-all">
            Program ID: EUSLC8q2b2SezvMQFhvU98EFrWkEasTdvrjqdJgYn2qc · Non-custodial PDA Vault · Squads Multisig Ready
          </div>
        </Surface>
      </div>
    </div>
  );
};

export default WalletConnectPage;
