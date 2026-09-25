import { useState, useEffect } from 'react';
import QRCode from '../components/QRCode';
import { usePrivy } from '@privy-io/react-auth';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';

interface PlatformBalance {
  usdc: number;
  sol: number;
}

interface TransferRecord {
  id: string;
  fromWallet: string;
  toWallet: string;
  amountUsdc: number;
  txHash: string;
  type: string;
  status: string;
  blockTime?: string;
  createdAt: string;
}

interface AgentWalletInfo {
  agentId: string;
  agentName: string;
  publicKey: string;
  balanceUsdc: number;
}

export default function WalletFundingPage() {
  const [platformBalance, setPlatformBalance] = useState<PlatformBalance>({ usdc: 0, sol: 0 });
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [agentWallets] = useState<AgentWalletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundAmount, setFundAmount] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [disburseAmount, setDisburseAmount] = useState<string>('');
  const [platformWallet, setPlatformWallet] = useState<string>('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balanceRes, transfersRes] = await Promise.all([
        fetch('/api/v1/solana-usdc/platform-balance', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then(r => r.json()),
        fetch('/api/v1/solana-usdc/transfers', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then(r => r.json()).catch(() => ({ success: false })),
      ]);

      if (balanceRes.success) {
        setPlatformBalance(balanceRes.balance);
        setPlatformWallet(balanceRes.platformWallet || '');
      }
      if (transfersRes.success) {
        setTransfers(transfersRes.transfers || []);
      }
    } catch (err) {
      console.error('Failed to fetch wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFundWallet = async () => {
    if (!fundAmount) return;
    alert(`Record funding of $${fundAmount} USDC from your Phantom wallet?\n\n(Actual on-chain transfer is signed via Phantom)`);
  };

  const handleDisburse = async () => {
    if (!selectedAgent || !disburseAmount) return;
    alert(`Disburse $${disburseAmount} USDC to agent ${selectedAgent}?\n\n(Requires Phantom signature)`);
  };

  const totalOutflow = transfers
    .filter(t => t.type === 'AGENT_PAYMENT')
    .reduce((sum, t) => sum + t.amountUsdc, 0);

  const totalInflow = transfers
    .filter(t => t.type === 'FUNDING')
    .reduce((sum, t) => sum + t.amountUsdc, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-[var(--warm-ink)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--sage)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-[var(--warm-ink)]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--sage)]/20 via-blue-600/20 to-[var(--dusty-rose)]/20 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[var(--sage)] via-blue-400 to-[var(--dusty-rose)] bg-clip-text text-transparent mb-4">
              Treasury & Wallet Funding
            </h1>
            <p className="text-lg text-[var(--warm-ink)] max-w-2xl mx-auto">
              Fund your platform wallet with USDC. Disburse to agent wallets. All signing happens client-side in Phantom.
            </p>
          </div>

          <div className="flex justify-center mb-8">
            {connected ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-[var(--warm-ink)] bg-[var(--warm-sand)] px-3 py-1 rounded-lg">
                  {platformWallet.slice(0, 8)}...
                </span>
                <button
                  onClick={() => setConnected(false)}
                  className="px-3 py-1 text-xs rounded-lg bg-[var(--terracotta)]/20 text-[var(--terracotta)] hover:bg-[var(--terracotta)]/30 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setConnected(true); alert('Connect your Privy wallet to fund the platform.'); }}
                className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'var(--clay)', color: 'var(--warm-ink)' }}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-16">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[var(--cream)]/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
            <p className="text-sm text-[var(--soft-stone)] mb-1">Platform USDC</p>
            <p className="text-3xl font-bold text-[var(--sage)]">${platformBalance.usdc.toLocaleString()}</p>
          </div>
          <div className="bg-[var(--cream)]/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
            <p className="text-sm text-[var(--soft-stone)] mb-1">Platform SOL</p>
            <p className="text-3xl font-bold text-[var(--dusty-rose)]">{platformBalance.sol.toFixed(4)}</p>
          </div>
          <div className="bg-[var(--cream)]/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
            <p className="text-sm text-[var(--soft-stone)] mb-1">Total Inflow</p>
            <p className="text-3xl font-bold text-[var(--sky-wash)]">${totalInflow.toLocaleString()}</p>
          </div>
          <div className="bg-[var(--cream)]/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
            <p className="text-sm text-[var(--soft-stone)] mb-1">Agent Payouts</p>
            <p className="text-3xl font-bold text-orange-400">${totalOutflow.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fund Wallet */}
          <div className="bg-[var(--cream)]/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-[var(--sage)]">Fund Platform Wallet</h2>
            <div className="mb-4">
              <label className="block text-sm text-[var(--soft-stone)] mb-2">Deposit Address</label>
              {platformWallet ? (
                <div className="flex flex-col items-center gap-3">
                  <QRCode value={platformWallet} size={160} label="Send USDC to this address" />
                  <code className="text-xs text-[var(--soft-stone)] bg-[var(--cream)] px-3 py-1 rounded break-all">
                    {platformWallet}
                  </code>
                </div>
              ) : (
                <p className="text-sm text-[var(--soft-stone)]">Set PLATFORM_WALLET_ADDRESS env var</p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm text-[var(--soft-stone)] mb-2">Record Funding Amount (USDC)</label>
              <input
                type="number"
                value={fundAmount}
                onChange={e => setFundAmount(e.target.value)}
                placeholder="Amount received"
                className="w-full px-4 py-2 bg-[var(--cream)] border border-slate-700 rounded-lg text-[var(--warm-ink)] placeholder-slate-500 focus:outline-none focus:border-[var(--sage)]"
              />
            </div>
            <button
              onClick={handleFundWallet}
              disabled={!connected || !fundAmount}
              className="w-full py-2 rounded-lg bg-[var(--sage)] hover:bg-[var(--sage)] disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              Record Funding
            </button>
          </div>

          {/* Disburse to Agent */}
          <div className="bg-[var(--cream)]/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-[var(--dusty-rose)]">Disburse to Agent</h2>
            <div className="mb-4">
              <label className="block text-sm text-[var(--soft-stone)] mb-2">Select Agent</label>
              <select
                value={selectedAgent}
                onChange={e => setSelectedAgent(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--cream)] border border-slate-700 rounded-lg text-[var(--warm-ink)] focus:outline-none focus:border-[var(--dusty-rose)]"
              >
                <option value="">Choose agent...</option>
                {agentWallets.map(w => (
                  <option key={w.agentId} value={w.agentId}>
                    {w.agentName} ({w.publicKey.slice(0, 8)}...)
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-[var(--soft-stone)] mb-2">Amount (USDC)</label>
              <input
                type="number"
                value={disburseAmount}
                onChange={e => setDisburseAmount(e.target.value)}
                placeholder="Amount to disburse"
                className="w-full px-4 py-2 bg-[var(--cream)] border border-slate-700 rounded-lg text-[var(--warm-ink)] placeholder-slate-500 focus:outline-none focus:border-[var(--dusty-rose)]"
              />
            </div>
            <button
              onClick={handleDisburse}
              disabled={!connected || !selectedAgent || !disburseAmount}
              className="w-full py-2 rounded-lg bg-[var(--dusty-rose)] hover:bg-[var(--dusty-rose)] disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              Build Transaction
            </button>
            <p className="text-xs text-[var(--soft-stone)] mt-2">
              Transaction will be built server-side and signed by Phantom.
            </p>
          </div>

          {/* Transfer History */}
          <div className="bg-[var(--cream)]/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-[var(--sky-wash)]">Treasury History</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {transfers.length === 0 ? (
                <p className="text-sm text-[var(--soft-stone)] text-center py-8">No transfers recorded yet</p>
              ) : (
                transfers.slice(0, 10).map(t => (
                  <div key={t.id} className="bg-[var(--cream)]/50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        t.type === 'FUNDING' ? 'bg-[var(--sage)]/20 text-[var(--sage)]' :
                        t.type === 'AGENT_PAYMENT' ? 'bg-[var(--dusty-rose)]/20 text-[var(--dusty-rose)]' :
                        'bg-[var(--cream)] text-[var(--warm-ink)]'
                      }`}>
                        {t.type}
                      </span>
                      <span className="text-sm font-semibold">${t.amountUsdc}</span>
                    </div>
                    <p className="text-xs text-[var(--soft-stone)] mt-1 font-mono">
                      {t.txHash.slice(0, 12)}...
                    </p>
                    <p className="text-xs text-[var(--soft-stone)]">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
