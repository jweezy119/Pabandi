import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { tokens, Surface, Button } from '../design-system';
import apiClient from '../services/api';

interface RaastPayment {
  id: string;
  reference: string;
  amount: number;
  status: string;
  createdAt: string;
  screenshotUrl: string | null;
  verificationResult: { isValid: boolean; confidence: number; fields: any } | null;
  reservation: { date: string; time: string; guests: number; name: string } | null;
  customer: { name: string; email: string; phone: string } | null;
}

export default function RaastConfirmPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedPayment, setSelectedPayment] = useState<RaastPayment | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery(
    'raast-pending',
    async () => {
      const res = await apiClient.get('/payments/raast/pending');
      return res.data?.data || [];
    },
    { refetchInterval: 10000 }
  );

  const confirmMutation = useMutation(
    async (reference: string) => {
      const res = await apiClient.post(`/payments/raast/${reference}/confirm`);
      return res.data;
    },
    {
      onSuccess: () => {
        qc.invalidateQueries('raast-pending');
        setSelectedPayment(null);
      },
    }
  );

  const rejectMutation = useMutation(
    async ({ reference, reason }: { reference: string; reason: string }) => {
      const res = await apiClient.post(`/payments/raast/${reference}/reject`, { reason });
      return res.data;
    },
    {
      onSuccess: () => {
        qc.invalidateQueries('raast-pending');
        setSelectedPayment(null);
        setRejectReason('');
      },
    }
  );

  const payments: RaastPayment[] = data || [];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,123,90,0.06) 0%, transparent 60%)' }} />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[var(--soft-stone)] hover:text-[var(--warm-ink)] mb-3 text-sm">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Back
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--warm-ink)]">Raast Payments</h1>
          <p className="text-sm text-[var(--soft-stone)] mt-1">Review and confirm customer Raast transfers</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Surface className="p-3 text-center">
            <p className="text-2xl font-bold text-[var(--clay)]">{payments.length}</p>
            <p className="text-[10px] text-[var(--soft-stone)]">Pending</p>
          </Surface>
          <Surface className="p-3 text-center">
            <p className="text-2xl font-bold text-[var(--sage)]">
              ${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
            </p>
            <p className="text-[10px] text-[var(--soft-stone)]">Total Amount</p>
          </Surface>
          <Surface className="p-3 text-center">
            <p className="text-2xl font-bold text-[var(--muted-ochre)]">
              {payments.filter(p => p.verificationResult?.isValid).length}
            </p>
            <p className="text-[10px] text-[var(--soft-stone)]">AI Verified</p>
          </Surface>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-[var(--soft-stone)] text-sm">Loading...</div>
        ) : payments.length === 0 ? (
          <Surface className="p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-[var(--soft-stone)] mb-3">check_circle</span>
            <p className="text-[var(--warm-ink)] font-semibold">No pending payments</p>
            <p className="text-xs text-[var(--soft-stone)] mt-1">Raast payments will appear here when customers book with Raast</p>
          </Surface>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <Surface
                key={payment.id}
                className={`p-4 cursor-pointer transition-all hover:border-[var(--clay)]/30 ${selectedPayment?.id === payment.id ? 'border-[var(--clay)]/50' : ''}`}
                onClick={() => setSelectedPayment(selectedPayment?.id === payment.id ? null : payment)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--sky-wash)]/15 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[var(--sky-wash)] text-lg">account_balance</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--warm-ink)]">{payment.customer?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-[var(--soft-stone)]">{payment.reference}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[var(--sage)]">${payment.amount.toFixed(2)}</p>
                    <p className="text-[10px] text-[var(--soft-stone)]">
                      {payment.verificationResult?.isValid ? '✅ AI Verified' : '⏳ Manual review'}
                    </p>
                  </div>
                </div>

                {/* Expanded details */}
                {selectedPayment?.id === payment.id && (
                  <div className="mt-4 pt-4 border-t border-[rgba(191,179,163,0.2)] space-y-3" onClick={e => e.stopPropagation()}>
                    {/* Customer info */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[var(--soft-stone)]">Customer</p>
                        <p className="text-[var(--warm-ink)]">{payment.customer?.name}</p>
                      </div>
                      <div>
                        <p className="text-[var(--soft-stone)]">Phone</p>
                        <p className="text-[var(--warm-ink)]">{payment.customer?.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[var(--soft-stone)]">Reservation</p>
                        <p className="text-[var(--warm-ink)]">
                          {payment.reservation?.date ? new Date(payment.reservation.date).toLocaleDateString() : 'N/A'} at {payment.reservation?.time}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--soft-stone)]">Guests</p>
                        <p className="text-[var(--warm-ink)]">{payment.reservation?.guests || 'N/A'}</p>
                      </div>
                    </div>

                    {/* AI verification result */}
                    {payment.verificationResult && (
                      <div className={`p-3 rounded-xl ${payment.verificationResult.isValid ? 'bg-[var(--sage)]/10 border border-[var(--sage)]/20' : 'bg-[var(--muted-ochre)]/10 border border-amber-500/20'}`}>
                        <p className="text-xs font-semibold text-[var(--warm-ink)] mb-1">
                          AI Verification: {payment.verificationResult.isValid ? 'Passed' : 'Needs Review'}
                        </p>
                        <p className="text-[10px] text-[var(--soft-stone)]">
                          Confidence: {(payment.verificationResult.confidence * 100).toFixed(0)}%
                          {payment.verificationResult.fields?.recipient && ` · Recipient: ${payment.verificationResult.fields.recipient}`}
                        </p>
                      </div>
                    )}

                    {/* Screenshot */}
                    {payment.screenshotUrl && (
                      <div>
                        <p className="text-xs text-[var(--soft-stone)] mb-1">Payment Screenshot</p>
                        <img
                          src={payment.screenshotUrl}
                          alt="Payment proof"
                          className="w-full max-w-sm rounded-xl border border-[rgba(191,179,163,0.2)]"
                        />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => confirmMutation.mutate(payment.reference)}
                        disabled={confirmMutation.isLoading}
                        className="flex-1 bg-[var(--sage)] hover:bg-[var(--sage)]"
                      >
                        {confirmMutation.isLoading ? 'Processing...' : '✓ Confirm & Release'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (rejectReason || window.prompt('Reason for rejection:')) {
                            rejectMutation.mutate({
                              reference: payment.reference,
                              reason: rejectReason || window.prompt('Reason for rejection:') || 'Payment not verified',
                            });
                          }
                        }}
                        disabled={rejectMutation.isLoading}
                        className="text-[var(--terracotta)] hover:text-[var(--terracotta)]"
                      >
                        ✕ Reject
                      </Button>
                    </div>
                  </div>
                )}
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
