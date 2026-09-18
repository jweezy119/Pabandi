/**
 * SolanaEscrowPage.tsx
 * ─────────────────────────────────────────────
 * Full page for Solana on-chain USDC escrow:
 * - Create escrow form
 * - Fund escrow flow
 * - Escrow detail view
 * - Escrow history
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SolanaEscrowPayment from '../components/SolanaEscrowPayment';

// ── Types ────────────────────────────────────────────────────────────────────

interface EscrowListItem {
  id: string;
  escrowPda: string;
  reference: string;
  amount: number;
  status: string;
  createdAt: string;
  buyer: { firstName: string; lastName: string };
  seller: { firstName: string; lastName: string };
  business?: { name: string } | null;
}

// ── Component ────────────────────────────────────────────────────────────────

const SolanaEscrowPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [escrows, setEscrows] = useState<EscrowListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    sellerId: '',
    amount: '',
    reference: '',
    businessId: '',
  });

  // Fetch escrow list
  const fetchEscrows = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user?.id) return;

      const response = await fetch(`/api/v1/solana-escrow/list/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setEscrows(data.data.escrows);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      setView('detail');
    } else {
      setView('list');
      fetchEscrows();
    }
  }, [id]);

  // Create escrow handler
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const response = await fetch('/api/v1/solana-escrow/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sellerId: createForm.sellerId,
          amount: parseFloat(createForm.amount),
          reference: createForm.reference,
          businessId: createForm.businessId || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setView('list');
        setCreateForm({ sellerId: '', amount: '', reference: '', businessId: '' });
        fetchEscrows();
      } else {
        setError(data.error || 'Failed to create escrow');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (view === 'detail' && id) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <button
            onClick={() => setView('list')}
            className="mb-4 text-sm text-purple-600 hover:text-purple-800"
          >
            ← Back to escrows
          </button>
          <SolanaEscrowPayment escrowId={id} />
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <button
            onClick={() => setView('list')}
            className="mb-4 text-sm text-purple-600 hover:text-purple-800"
          >
            ← Cancel
          </button>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Solana Escrow</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seller ID *
                </label>
                <input
                  type="text"
                  value={createForm.sellerId}
                  onChange={(e) => setCreateForm({ ...createForm, sellerId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="User ID of the seller"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (USDC) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="100.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference (Order ID) *
                </label>
                <input
                  type="text"
                  value={createForm.reference}
                  onChange={(e) => setCreateForm({ ...createForm, reference: e.target.value })}
                  required
                  maxLength={64}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="order-12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business ID (optional)
                </label>
                <input
                  type="text"
                  value={createForm.businessId}
                  onChange={(e) => setCreateForm({ ...createForm, businessId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Link to a business"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Escrow'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Solana Escrows</h1>
          <button
            onClick={() => setView('create')}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            + New Escrow
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading && escrows.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Loading escrows...</div>
        ) : escrows.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 mb-4">No escrows yet</p>
            <button
              onClick={() => setView('create')}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Create your first escrow
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {escrows.map((escrow) => (
              <div
                key={escrow.id}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => (window.location.href = `/solana-escrow/${escrow.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{escrow.reference}</p>
                    <p className="text-sm text-gray-500">
                      {escrow.buyer.firstName} → {escrow.seller.firstName}
                      {escrow.business && ` · ${escrow.business.name}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${escrow.amount.toFixed(2)}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                        escrow.status === 'CREATED'
                          ? 'bg-blue-100 text-blue-800'
                          : escrow.status === 'FUNDED'
                          ? 'bg-yellow-100 text-yellow-800'
                          : escrow.status === 'RELEASED'
                          ? 'bg-green-100 text-green-800'
                          : escrow.status === 'REFUNDED'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {escrow.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SolanaEscrowPage;
