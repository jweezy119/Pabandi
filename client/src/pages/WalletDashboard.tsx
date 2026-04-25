import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import {
  WalletIcon, CurrencyDollarIcon, ArrowUpRightIcon,
  StarIcon, LinkIcon, XMarkIcon, CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../services/api';

/* ── Types ── */
type WalletType = 'metamask' | 'phantom' | null;
interface ConnectedWallet {
  address: string;
  type: WalletType;
  chainName: string;
}

/* ── Helpers ── */
function shortAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

const BSC_CHAIN_ID = '0x38'; // 56 decimal

async function switchToBSC() {
  await (window as any).ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: BSC_CHAIN_ID }],
  }).catch(async (err: any) => {
    if (err.code === 4902) {
      await (window as any).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BSC_CHAIN_ID,
          chainName: 'BNB Smart Chain',
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          rpcUrls: ['https://bsc-dataseed.binance.org/'],
          blockExplorerUrls: ['https://bscscan.com'],
        }],
      });
    }
  });
}

/* ── Wallet Option Card ── */
function WalletOption({
  id, icon, name, desc, badge, onClick, disabled, loading,
}: {
  id: string; icon: React.ReactNode; name: string; desc: string;
  badge?: string; onClick: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
      onMouseEnter={e => {
        if (!disabled && !loading) {
          (e.currentTarget as HTMLElement).style.background = '#f9fafb';
          (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
      }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-gray-50"
        >
        {loading ? (
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        ) : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-slate-900" >{name}</span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5 truncate text-slate-600" >{desc}</p>
      </div>
      <ArrowUpRightIcon className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: '#60a5fa' }} />
    </button>
  );
}

/* ── Main Component ── */
const WalletDashboard: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);
  const [error, setError] = useState('');
  const [loadingWallet, setLoadingWallet] = useState<WalletType>(null);

  // Restore previously connected wallet from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pabandi_wallet');
    if (saved) {
      try { setConnected(JSON.parse(saved)); } catch { /**/ }
    }
  }, []);

  const saveWallet = (w: ConnectedWallet) => {
    localStorage.setItem('pabandi_wallet', JSON.stringify(w));
    setConnected(w);
  };

  const disconnect = () => {
    localStorage.removeItem('pabandi_wallet');
    setConnected(null);
  };

  /* ── MetaMask / TrustWallet (BSC) ── */
  const connectMetaMask = async () => {
    setError('');
    setLoadingWallet('metamask');
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('MetaMask (or TrustWallet) not found. Please install the extension.');

      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) throw new Error('No accounts returned. Please unlock your wallet.');

      await switchToBSC();

      saveWallet({ address: accounts[0], type: 'metamask', chainName: 'BNB Smart Chain' });

      // Persist to backend
      await apiClient.put('/auth/wallet', { address: accounts[0], chain: 'BSC' }).catch(() => { /* non-fatal */ });

      setShowModal(false);
    } catch (err: any) {
      setError(err?.message || 'Connection failed. Please try again.');
    } finally {
      setLoadingWallet(null);
    }
  };

  /* ── Phantom (Solana) ── */
  const connectPhantom = async () => {
    setError('');
    setLoadingWallet('phantom');
    try {
      const solana = (window as any).solana;
      if (!solana?.isPhantom) throw new Error('Phantom wallet not found. Please install the Phantom browser extension.');

      const resp = await solana.connect();
      const address: string = resp.publicKey.toString();

      saveWallet({ address, type: 'phantom', chainName: 'Solana' });

      await apiClient.put('/auth/wallet', { address, chain: 'Solana' }).catch(() => { /* non-fatal */ });

      setShowModal(false);
    } catch (err: any) {
      setError(err?.message || 'Connection failed. Please try again.');
    } finally {
      setLoadingWallet(null);
    }
  };

  // Mock wallet data (real API fetch can replace this)
  const { data: wallet, isLoading } = useQuery('wallet', async () => ({
    balance: 145.50,
    currency: 'PAB',
    recentRewards: [
      { id: 1, type: 'RESERVATION_COMPLETION', amount: 10, date: '2026-01-02', business: 'Kolachi' },
      { id: 2, type: 'GOOGLE_REVIEW', amount: 5, date: '2026-01-01', business: 'Cafe Flo' },
      { id: 3, type: 'RESERVATION_COMPLETION', amount: 10, date: '2025-12-30', business: 'The BBQ Tonight' },
    ],
  }));

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-600" >Loading wallet...</p>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', color: 'var(--color-text)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900" >Pabandi Wallet</h1>
            <p className="mt-1 text-sm text-slate-600" >
              Track your PAB rewards and connect your crypto wallet
            </p>
          </div>
          {connected ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
                <CheckCircleIcon className="h-4 w-4" />
                {connected.type === 'phantom' ? '👻' : '🦊'} {shortAddr(connected.address)}
                <span className="text-xs opacity-70">· {connected.chainName}</span>
              </div>
              <button onClick={disconnect}
                className="p-2 rounded-lg transition-colors"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                title="Disconnect wallet">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              id="btn-connect-wallet"
              onClick={() => { setShowModal(true); setError(''); }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <LinkIcon className="h-4 w-4" />
              Connect Web3 Wallet
            </button>
          )}
        </div>

        {/* Balance + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Balance Card */}
          <div className="relative overflow-hidden rounded-2xl p-6 text-white"
            style={{ background: 'linear-gradient(135deg, #1e40af 0%, #5b21b6 100%)', boxShadow: '0 20px 40px rgba(30,64,175,0.35)' }}>
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-5">
                <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <WalletIcon className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.15)' }}>Active Balance</span>
              </div>
              <div className="mb-4">
                <span className="text-4xl font-black">{wallet?.balance?.toFixed(2)}</span>
                <span className="ml-2 text-lg opacity-80">{wallet?.currency}</span>
              </div>
              {connected ? (
                <p className="text-xs opacity-70 font-mono">{shortAddr(connected.address)} · {connected.chainName}</p>
              ) : (
                <button onClick={() => { setShowModal(true); setError(''); }}
                  className="text-xs opacity-80 hover:opacity-100 flex items-center gap-1 underline underline-offset-2">
                  <LinkIcon className="h-3 w-3" /> Connect a wallet to claim PAB
                </button>
              )}
            </div>
          </div>

          {/* Stats Card */}
          <div className="rounded-2xl p-6 flex flex-col justify-between"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-700" >
                Estimated Value
              </h3>
              <CurrencyDollarIcon className="h-5 w-5" style={{ color: '#10b981' }} />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-slate-900" >
                ${((wallet?.balance || 0) * 0.15).toFixed(2)}
              </p>
              <p className="text-xs mt-1 text-slate-700" >Based on current PAB/USDT rate</p>
            </div>
            <div className="mt-5 pt-4 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-sm font-semibold flex items-center gap-1 cursor-pointer"
                style={{ color: '#60a5fa' }}>
                Explore PAB Staking <ArrowUpRightIcon className="h-4 w-4" />
              </span>
              <span className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}>
                +{wallet?.recentRewards?.length || 0} rewards
              </span>
            </div>
          </div>
        </div>

        {/* Rewards History */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-6 py-4 flex justify-between items-center"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="font-bold text-slate-900" >Recent Rewards</h3>
            <button className="text-sm font-medium" style={{ color: '#60a5fa' }}>View All</button>
          </div>
          <div>
            {wallet?.recentRewards.map((reward: any) => (
              <div key={reward.id} className="px-6 py-4 flex items-center justify-between transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl`}
                    style={{
                      background: reward.type === 'GOOGLE_REVIEW' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                      color: reward.type === 'GOOGLE_REVIEW' ? '#fbbf24' : '#34d399',
                    }}>
                    {reward.type === 'GOOGLE_REVIEW'
                      ? <StarIcon className="h-4 w-4" />
                      : <CheckCircleIcon className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900" >
                      {reward.type === 'GOOGLE_REVIEW' ? 'Proof of Review Reward' : 'Proof of Reservation Reward'}
                    </p>
                    <p className="text-xs text-slate-700" >
                      {reward.business} · {reward.date}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-sm" style={{ color: '#34d399' }}>+{reward.amount} PAB</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Connect Wallet Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="w-full max-w-sm rounded-3xl p-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>

            {/* Modal header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900" >Connect Wallet</h2>
                <p className="text-xs mt-0.5 text-slate-700" >Choose your preferred wallet</p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="p-2 rounded-xl transition-colors bg-gray-100 hover:bg-gray-200">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3 text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Wallet options */}
            <div className="space-y-3">
              <WalletOption
                id="btn-connect-metamask"
                icon="🦊"
                name="MetaMask"
                desc="Connect via MetaMask · BNB Smart Chain"
                badge="BSC"
                onClick={connectMetaMask}
                loading={loadingWallet === 'metamask'}
                disabled={loadingWallet !== null && loadingWallet !== 'metamask'}
              />
              <WalletOption
                id="btn-connect-trustwallet"
                icon="🛡️"
                name="TrustWallet"
                desc="Connect via TrustWallet · BNB Smart Chain"
                badge="BSC"
                onClick={connectMetaMask}
                loading={false}
                disabled={loadingWallet !== null}
              />
              <WalletOption
                id="btn-connect-phantom"
                icon="👻"
                name="Phantom"
                desc="Connect via Phantom · Solana network"
                badge="SOL"
                onClick={connectPhantom}
                loading={loadingWallet === 'phantom'}
                disabled={loadingWallet !== null && loadingWallet !== 'phantom'}
              />
            </div>

            <p className="text-center text-xs mt-5 text-slate-800" >
              By connecting, you agree to our{' '}
              <a href="#" className="underline" style={{ color: '#60a5fa' }}>Terms of Service</a>.
              Your wallet address is stored securely.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletDashboard;
