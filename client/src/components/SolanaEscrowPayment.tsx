/**
 * SolanaEscrowPayment.tsx
 * ─────────────────────────────────────────────
 * React component for Solana on-chain USDC escrow.
 * Uses Privy embedded wallet (auto-created for email users) and external
 * wallet connectors for users who prefer Phantom/Solflare/Backpack.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';

// ── Types ────────────────────────────────────────────────────────────────────

interface EscrowStatus {
  status: 'CREATED' | 'FUNDED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';
  label: string;
  color: string;
}

const ESCROW_STATUSES: Record<string, EscrowStatus> = {
  CREATED: { status: 'CREATED', label: 'Created', color: 'bg-blue-100 text-blue-800' },
  FUNDED: { status: 'FUNDED', label: 'Funded', color: 'bg-yellow-100 text-yellow-800' },
  RELEASED: { status: 'RELEASED', label: 'Released', color: 'bg-green-100 text-green-800' },
  REFUNDED: { status: 'REFUNDED', label: 'Refunded', color: 'bg-gray-100 text-gray-800' },
  DISPUTED: { status: 'DISPUTED', label: 'Disputed', color: 'bg-red-100 text-red-800' },
};

interface Escrow {
  id: string;
  escrowPda: string;
  reference: string;
  amount: number;
  mint: string;
  status: string;
  createdAt: string;
  txCreate?: string;
  txFund?: string;
  txRelease?: string;
  txRefund?: string;
}

interface WalletState {
  connected: boolean;
  address: string | null;
  usdcBalance: number | null;
  connecting: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

const SolanaEscrowPayment: React.FC<{
  escrowId?: string;
  onStatusChange?: (status: string) => void;
}> = ({ escrowId, onStatusChange }) => {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    usdcBalance: null,
    connecting: false,
  });
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Check for Phantom/Solflare wallet
  const getProvider = useCallback(() => {
    // Try external wallet injection first (Phantom, Solflare, Backpack)
    if ('solana' in window) {
      const provider = (window as any).solana
      if (provider.isPhantom || provider.isSolflare || provider.isBackpack) {
        return { ...provider, type: 'external' as const }
      }
    }
    // Fall back to Privy embedded wallet
    return { type: 'privy' as const }
  }, [])

  // Connect wallet
  const connectWallet = async () => {
    setWallet((prev) => ({ ...prev, connecting: true }));
    try {
      const provider = getProvider();
      if (!provider) {
        setError('No Solana wallet found. Install Phantom, Solflare, or Backpack.');
        setWallet((prev) => ({ ...prev, connecting: false }));
        return;
      }
      await provider.connect();
      const address = provider.publicKey?.toString();

      // Fetch USDC balance (simplified)
      setWallet({
        connected: true,
        address: address || null,
        usdcBalance: null, // Would fetch from on-chain
        connecting: false,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      setWallet((prev) => ({ ...prev, connecting: false }));
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    const provider = getProvider();
    provider?.disconnect?.();
    setWallet({
      connected: false,
      address: null,
      usdcBalance: null,
      connecting: false,
    });
  };

  // Fetch escrow state
  const fetchEscrowState = useCallback(async () => {
    if (!escrowId) return;
    try {
      const response = await fetch(`/api/v1/solana-escrow/${escrowId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setEscrow(data.data);
        onStatusChange?.(data.data.status);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [escrowId, onStatusChange]);

  // Poll for status updates
  useEffect(() => {
    if (!escrowId || !polling) return;
    const interval = setInterval(fetchEscrowState, 5000);
    return () => clearInterval(interval);
  }, [escrowId, polling, fetchEscrowState]);

  // Initial fetch
  useEffect(() => {
    fetchEscrowState();
    setPolling(true);
  }, [fetchEscrowState]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const fundEscrow = async () => {
    if (!escrowId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/solana-escrow/${escrowId}/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        await fetchEscrowState();
      } else {
        setError(data.error || 'Failed to fund escrow');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const releaseFunds = async () => {
    if (!escrowId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/solana-escrow/${escrowId}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        await fetchEscrowState();
      } else {
        setError(data.error || 'Failed to release funds');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refundFunds = async () => {
    if (!escrowId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/solana-escrow/${escrowId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        await fetchEscrowState();
      } else {
        setError(data.error || 'Failed to refund');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const raiseDispute = async () => {
    if (!escrowId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/solana-escrow/${escrowId}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        await fetchEscrowState();
      } else {
        setError(data.error || 'Failed to raise dispute');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentStatus = escrow ? ESCROW_STATUSES[escrow.status] : null;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Solana USDC Escrow</h2>
        {currentStatus && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentStatus.color}`}>
            {currentStatus.label}
          </span>
        )}
      </div>

      {/* Wallet Connection */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Wallet</p>
            {wallet.connected && wallet.address ? (
              <p className="font-mono text-sm text-gray-900">
                {wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}
              </p>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
            {wallet.usdcBalance !== null && (
              <p className="text-sm text-gray-600 mt-1">
                USDC Balance: <span className="font-semibold">{wallet.usdcBalance.toFixed(2)}</span>
              </p>
            )}
          </div>
          {wallet.connected ? (
            <button
              onClick={disconnectWallet}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={connectWallet}
              disabled={wallet.connecting}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {wallet.connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Escrow Details */}
      {escrow && (
        <div className="mb-6 space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Reference</span>
            <span className="font-medium">{escrow.reference}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Amount</span>
            <span className="font-medium">${escrow.amount.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Escrow PDA</span>
            <span className="font-mono text-xs text-gray-500">
              {escrow.escrowPda.slice(0, 12)}...{escrow.escrowPda.slice(-8)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Created</span>
            <span className="text-sm">{new Date(escrow.createdAt).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Transaction History */}
      {escrow && (escrow.txCreate || escrow.txFund || escrow.txRelease || escrow.txRefund) && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Transaction History</h3>
          <div className="space-y-2">
            {escrow.txCreate && (
              <div className="flex items-center text-xs">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span className="text-gray-600">Created:</span>
                <span className="ml-2 font-mono text-gray-500">{escrow.txCreate}</span>
              </div>
            )}
            {escrow.txFund && (
              <div className="flex items-center text-xs">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                <span className="text-gray-600">Funded:</span>
                <span className="ml-2 font-mono text-gray-500">{escrow.txFund}</span>
              </div>
            )}
            {escrow.txRelease && (
              <div className="flex items-center text-xs">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                <span className="text-gray-600">Released:</span>
                <span className="ml-2 font-mono text-gray-500">{escrow.txRelease}</span>
              </div>
            )}
            {escrow.txRefund && (
              <div className="flex items-center text-xs">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                <span className="text-gray-600">Refunded:</span>
                <span className="ml-2 font-mono text-gray-500">{escrow.txRefund}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context-Aware Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {escrow?.status === 'CREATED' && (
          <button
            onClick={fundEscrow}
            disabled={loading || !wallet.connected}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Fund Escrow'}
          </button>
        )}
        {escrow?.status === 'FUNDED' && (
          <>
            <button
              onClick={releaseFunds}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Release to Seller
            </button>
            <button
              onClick={refundFunds}
              disabled={loading}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              Refund to Buyer
            </button>
            <button
              onClick={raiseDispute}
              disabled={loading}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Raise Dispute
            </button>
          </>
        )}
        {(escrow?.status === 'CREATED' || escrow?.status === 'FUNDED') && (
          <button
            onClick={raiseDispute}
            disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Raise Dispute
          </button>
        )}
      </div>

      {/* Status Visual State Machine */}
      {currentStatus && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            {(['CREATED', 'FUNDED', 'RELEASED', 'REFUNDED', 'DISPUTED'] as const).map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full ${
                    escrow?.status === s ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                />
                {i < 4 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">Created</span>
            <span className="text-xs text-gray-500">Funded</span>
            <span className="text-xs text-gray-500">Released</span>
            <span className="text-xs text-gray-500">Refunded</span>
            <span className="text-xs text-gray-500">Disputed</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolanaEscrowPayment;
