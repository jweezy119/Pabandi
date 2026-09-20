import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { tokens, Surface, Button, Badge } from '../design-system';
import { protocolService } from '../services/protocolService';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  FUNDED: '#818cf8',
  COMPLETED: '#22c55e',
  DISPUTED: '#ef4444',
  CANCELLED: '#64748b',
};

export const EscrowInterface: React.FC = () => {
  const [userEmail, setUserEmail] = useState('');
  const [formData, setFormData] = useState({
    itemTitle: '',
    amount: '',
    sellerEmail: '',
    buyerEmail: '',
    releaseTime: '',
  });
  const queryClient = useQueryClient();

  const { data: escrowsData } = useQuery(
    ['escrows', userEmail],
    async () => {
      const res = await protocolService.listEscrows(userEmail);
      return res?.data?.data;
    },
    { enabled: !!userEmail, refetchInterval: 10000 }
  );

  const escrows = escrowsData || [];

  const createMutation = useMutation(
    (payload: any) => protocolService.createEscrow(payload),
    { onSuccess: () => { queryClient.invalidateQueries(['escrows', userEmail]); } }
  );

  const releaseMutation = useMutation(
    (id: string) => protocolService.releaseEscrow(id),
    { onSuccess: () => { queryClient.invalidateQueries(['escrows', userEmail]); } }
  );

  const disputeMutation = useMutation(
    (id: string) => protocolService.disputeEscrow(id),
    { onSuccess: () => { queryClient.invalidateQueries(['escrows', userEmail]); } }
  );

  const fundMutation = useMutation(
    (id: string) => protocolService.fundEscrow(id),
    { onSuccess: () => { queryClient.invalidateQueries(['escrows', userEmail]); } }
  );

  const activeEscrows = escrows.filter((e: any) => ['PENDING', 'FUNDED'].includes(e.status));
  const completedEscrows = escrows.filter((e: any) => ['COMPLETED', 'DISPUTED', 'CANCELLED'].includes(e.status));

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="text-center mb-8">
          <Badge tone="warning" className="mb-3">Escrow</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100">
            Secure Escrow
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Create and manage escrow agreements secured by Pabandi protocol.
          </p>
        </div>

        {/* Email Filter */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-3">View Your Escrows</h3>
          <input
            type="email"
            placeholder="Enter your email to view escrows"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
          />
        </Surface>

        {/* Create Escrow Form */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-4">Create New Escrow</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Item Title"
              value={formData.itemTitle}
              onChange={(e) => setFormData({ ...formData, itemTitle: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              placeholder="Amount (USD)"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              placeholder="Seller Email"
              value={formData.sellerEmail}
              onChange={(e) => setFormData({ ...formData, sellerEmail: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              placeholder="Buyer Email (optional)"
              value={formData.buyerEmail}
              onChange={(e) => setFormData({ ...formData, buyerEmail: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={() => createMutation.mutate({
                itemTitle: formData.itemTitle,
                amount: parseFloat(formData.amount),
                sellerEmail: formData.sellerEmail,
                buyerEmail: formData.buyerEmail || undefined,
              })}
              loading={createMutation.isLoading}
            >
              Create Escrow
            </Button>
          </div>
        </Surface>

        {/* Active Escrows */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-4">Active Escrows ({activeEscrows.length})</h3>
          {activeEscrows.length === 0 ? (
            <div className="text-center py-8" style={{ color: tokens.color.textDim }}>
              No active escrows. Create one above or enter your email to view existing.
            </div>
          ) : (
            <div className="space-y-3">
              {activeEscrows.map((escrow: any) => (
                <div key={escrow.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold text-slate-100">{escrow.itemTitle || 'Untitled'}</div>
                      <div className="text-xs" style={{ color: tokens.color.textDim }}>
                        {Number(escrow.amount).toLocaleString()} {escrow.currency || 'USD'}
                      </div>
                    </div>
                    <Badge tone={escrow.status === 'FUNDED' ? 'info' : 'warning'}>
                      {escrow.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs mb-3" style={{ color: tokens.color.textDim }}>
                    <span>Seller: {escrow.sellerEmail}</span>
                    {escrow.buyerEmail && <span>• Buyer: {escrow.buyerEmail}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {escrow.status === 'PENDING' && (
                      <Button size="sm" variant="ghost" onClick={() => fundMutation.mutate(escrow.id)} loading={fundMutation.isLoading}>
                        Fund
                      </Button>
                    )}
                    {escrow.status === 'FUNDED' && (
                      <>
                        <Button size="sm" variant="primary" onClick={() => releaseMutation.mutate(escrow.id)} loading={releaseMutation.isLoading}>
                          Release
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => disputeMutation.mutate(escrow.id)} loading={disputeMutation.isLoading}>
                          Dispute
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>

        {/* Escrow History */}
        {completedEscrows.length > 0 && (
          <Surface className="p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4">History ({completedEscrows.length})</h3>
            <div className="space-y-2">
              {completedEscrows.map((escrow: any) => (
                <div key={escrow.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[escrow.status] || '#666' }} />
                    <div>
                      <div className="text-sm text-slate-200">{escrow.itemTitle || 'Untitled'}</div>
                      <div className="text-xs" style={{ color: tokens.color.textDim }}>
                        {Number(escrow.amount).toLocaleString()} {escrow.currency || 'USD'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold" style={{ color: STATUS_COLORS[escrow.status] || '#666' }}>
                    {escrow.status}
                  </span>
                </div>
              ))}
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default EscrowInterface;
