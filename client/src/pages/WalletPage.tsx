import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';

export const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    setLoading(true);
    setError('');
    try {
      const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
      const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
      const res = await fetch(`${backendUrl}/api/v1/wallet`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setWallet(data.wallet);
      } else {
        setShowCreate(true);
      }
    } catch (err) {
      setError('Failed to fetch wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    setLoading(true);
    setError('');
    try {
      const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
      const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
      const res = await fetch(`${backendUrl}/api/v1/wallet/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        setWallet(data.wallet);
        setShowCreate(false);
      } else {
        setError(data.message || 'Failed to create wallet');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimAirdrop = async () => {
    setLoading(true);
    setError('');
    try {
      const rawBase = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
      const backendUrl = rawBase.replace(/\/api\/v\d+\/?$/, '');
      const res = await fetch(`${backendUrl}/api/v1/wallet/claim-airdrop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchWallet();
      } else {
        setError(data.message || 'Failed to claim airdrop');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white/60">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (showCreate || !wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: tokens.color.background }}>
        <div className="w-full max-w-md">
          <Surface className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px] text-indigo-400">account_balance_wallet</span>
            </div>
            <h1 className="text-2xl font-black text-white mb-2">Create Your Wallet</h1>
            <p className="text-sm text-white/60 mb-6">
              Get a Solana wallet to interact with the Pabandi ecosystem — earn $PAB rewards, make bookings, and more.
            </p>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200">
                {error}
              </div>
            )}
            <Button onClick={handleCreateWallet} disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create Wallet'}
            </Button>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-sm text-white/50 hover:text-white"
            >
              Skip for now
            </button>
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">My Wallet</h1>
            <p className="text-sm text-white/60">Manage your $PAB and Solana assets</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/profile')}>
            Back to Profile
          </Button>
        </div>

        <Surface className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-white/60">Total Balance</p>
              <p className="text-3xl font-black text-white">{wallet.balance || 0} <span className="text-lg text-indigo-400">$PAB</span></p>
            </div>
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px] text-indigo-400">account_balance_wallet</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(wallet.address)}>
              Copy Address
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {}}>
              Receive
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/40 font-mono truncate">{wallet.address}</p>
        </Surface>

        {!wallet.airdropClaimed && (
          <Surface className="p-6 mb-6 border border-green-500/20 bg-green-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-300">🎉 Welcome Airdrop Available</p>
                <p className="text-xs text-white/60">Claim your free $PAB to get started</p>
              </div>
              <Button onClick={handleClaimAirdrop} disabled={loading}>
                Claim {wallet.airdropAmount || 100} $PAB
              </Button>
            </div>
          </Surface>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Surface className="p-4 text-center">
            <p className="text-xl font-bold text-white">{wallet.totalStaked || 0}</p>
            <p className="text-xs text-white/60">Staked</p>
          </Surface>
          <Surface className="p-4 text-center">
            <p className="text-xl font-bold text-white">{wallet.lockedPab || 0}</p>
            <p className="text-xs text-white/60">Locked</p>
          </Surface>
          <Surface className="p-4 text-center">
            <p className="text-xl font-bold text-white">{wallet.usdcBalance || 0}</p>
            <p className="text-xs text-white/60">USDC</p>
          </Surface>
          <Surface className="p-4 text-center">
            <Badge tone={wallet.airdropClaimed ? 'success' : 'warning'}>
              {wallet.airdropClaimed ? 'Airdrop Claimed' : 'Airdrop Pending'}
            </Badge>
          </Surface>
        </div>

        <Surface className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-center">
              <span className="material-symbols-outlined text-[24px] text-indigo-400 mb-2">send</span>
              <p className="text-xs font-semibold text-white">Send</p>
            </button>
            <button className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-center">
              <span className="material-symbols-outlined text-[24px] text-green-400 mb-2">call_received</span>
              <p className="text-xs font-semibold text-white">Receive</p>
            </button>
            <button className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-center">
              <span className="material-symbols-outlined text-[24px] text-yellow-400 mb-2">swap_horiz</span>
              <p className="text-xs font-semibold text-white">Swap</p>
            </button>
            <button className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-center">
              <span className="material-symbols-outlined text-[24px] text-blue-400 mb-2">history</span>
              <p className="text-xs font-semibold text-white">History</p>
            </button>
          </div>
        </Surface>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
