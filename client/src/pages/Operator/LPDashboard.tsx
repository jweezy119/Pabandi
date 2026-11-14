import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Building2,
  DollarSign,
  Upload,
  RefreshCw,
  Loader2,
  Clock,
  ExternalLink,
  AlertCircle,
  FileCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/pbn-tokens.css';

interface OfframpIntentRow {
  id: string;
  freelancerName: string;
  customerWallet: string;
  pkrAmount: number;
  usdcAmount: number;
  rate: number;
  bankDetails: string;
  destinationType: string;
  status: 'PENDING_LP' | 'PENDING_OFFRAMP' | 'SENT_BY_LP' | 'PROOF_SUBMITTED' | 'SETTLED' | 'PENDING_MANUAL_REVIEW';
  lockedTxHash?: string;
  requestedAt: string;
  settledAt?: string;
}

export default function LPDashboard() {
  const [intents, setIntents] = useState<OfframpIntentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'pending' | 'all'>('pending');
  const [cleaning, setCleaning] = useState(false);

  // Upload modal / state
  const [selectedIntent, setSelectedIntent] = useState<OfframpIntentRow | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string>('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchIntents();
    const interval = setInterval(fetchIntents, 10000); // Polling every 10s for live LP view
    return () => clearInterval(interval);
  }, [viewMode]);

  const fetchIntents = async () => {
    try {
      setRefreshing(true);
      const url = viewMode === 'all' ? '/offramp/operator/intents?all=true' : '/offramp/operator/intents';
      const res = await api.get(url);
      const list = res.data?.data?.intents || res.data?.intents || [];
      setIntents(list);
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCleanTestData = async () => {
    if (!window.confirm('Are you sure you want to clean up demo and expired test records? This will permanently delete test rows with 03001234567 or REFUNDED status.')) return;
    setCleaning(true);
    try {
      const res = await api.post('/offramp/operator/clean-test-intents', {});
      alert(res.data?.data?.message || 'Demo test records cleaned up!');
      fetchIntents();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to clean test data');
    } finally {
      setCleaning(false);
    }
  };

  const handleMarkSent = async (intentId: string) => {
    try {
      await api.post(`/offramp/operator/${intentId}/mark-sent`, {});
      fetchIntents();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to mark as sent');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const b64String = reader.result as string;
      setReceiptPreview(b64String);
      // Strip data:image/...;base64,
      const cleanB64 = b64String.replace(/^data:image\/[a-z]+;base64,/, '');
      setReceiptBase64(cleanB64);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadReceipt = async () => {
    if (!selectedIntent || !receiptBase64) return;
    setUploading(true);
    setErrorMsg(null);
    setUploadResult(null);

    try {
      const res = await api.post(`/offramp/operator/${selectedIntent.id}/upload-receipt`, {
        imageBase64: receiptBase64,
      });

      const data = res.data?.data || res.data;
      setUploadResult(data);
      fetchIntents();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          'Failed to verify receipt OCR. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#f1f5f9] px-4 py-10 selection:bg-[var(--pbn-accent,#4fd1c5)]/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Operator View
              </span>
              <span className="text-xs font-mono text-[#8a9aa8]">@PabanBot LP Settlement Terminal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Space_Grotesk',sans-serif] tracking-tight">
              Liquidity Provider (LP) Off-Ramp Desk
            </h1>
            <p className="text-xs text-[#94a3b8]">
              Manage live PKR fiat disbursements. Send funds via Raast/1LINK, mark as sent, and upload receipts for instant OCR escrow release to Treasury.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCleanTestData}
              disabled={cleaning}
              className="px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/30 text-xs font-mono text-red-300 hover:text-white hover:bg-red-900/60 flex items-center gap-1.5 transition-colors"
              title="Delete old demo / expired test records (03001234567 / REFUNDED)"
            >
              <span>{cleaning ? 'Purging...' : '🗑 Purge Demo Records'}</span>
            </button>

            <button
              onClick={fetchIntents}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-[#141e33] border border-[#334155] text-xs font-mono text-[#8a9aa8] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <Link
              to="/coordinator"
              className="px-4 py-2 rounded-xl bg-[var(--pbn-accent,#4fd1c5)]/10 border border-[var(--pbn-accent,#4fd1c5)]/30 text-xs font-mono font-bold text-[var(--pbn-accent,#4fd1c5)] hover:bg-[var(--pbn-accent,#4fd1c5)]/20 transition-colors"
            >
              Coordinator Hub →
            </Link>
          </div>
        </div>

        {/* Live Requests Table */}
        <div className="rounded-3xl border border-[#334155] bg-[#141e33] overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Building2 className="w-4 h-4 text-[var(--pbn-accent,#4fd1c5)]" />
                <span>
                  {viewMode === 'pending' ? 'Pending Active Orders' : 'All Off-Ramp History'} ({intents.length})
                </span>
              </div>

              {/* View filter buttons */}
              <div className="inline-flex rounded-lg bg-[#0a0e17] p-0.5 border border-[#334155] text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setViewMode('pending')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === 'pending' ? 'bg-[var(--pbn-accent,#4fd1c5)] text-slate-900 font-bold' : 'text-[#8a9aa8] hover:text-white'}`}
                >
                  Pending Action
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === 'all' ? 'bg-[var(--pbn-accent,#4fd1c5)] text-slate-900 font-bold' : 'text-[#8a9aa8] hover:text-white'}`}
                >
                  All History
                </button>
              </div>
            </div>
            <span className="text-xs font-mono text-[#8a9aa8]">Rate: 1 USDC = 279.50 PKR</span>
          </div>

          {loading ? (
            <div className="p-16 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--pbn-accent,#4fd1c5)]" />
            </div>
          ) : intents.length === 0 ? (
            <div className="p-16 text-center text-xs font-mono text-[#8a9aa8] space-y-2">
              <p className="text-3xl">🌴</p>
              <p className="font-semibold text-white">No pending off-ramp orders right now.</p>
              <p>When freelancers click "Instant Withdraw to Raast", orders appear here in real time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#0a0e17]/80 text-[#8a9aa8] uppercase tracking-wider text-[10px] border-b border-[#334155]">
                  <tr>
                    <th className="py-3.5 px-4">Claim ID</th>
                    <th className="py-3.5 px-4">Freelancer</th>
                    <th className="py-3.5 px-4">PKR Amount</th>
                    <th className="py-3.5 px-4">USDC Reward</th>
                    <th className="py-3.5 px-4">Bank Details / IBAN</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60">
                  {intents.map((row) => {
                    const isPendingAction = row.status === 'PENDING_LP' || row.status === 'PENDING_OFFRAMP';
                    const isSentPendingReceipt = row.status === 'SENT_BY_LP' || row.status === 'PENDING_MANUAL_REVIEW';
                    const isSettled = row.status === 'SETTLED';
                    const isRefunded = row.status === 'REFUNDED';

                    return (
                      <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          {row.id.slice(0, 12)}...
                        </td>
                        <td className="py-3.5 px-4 text-slate-200">
                          {row.freelancerName}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400 text-sm">
                          Rs. {row.pkrAmount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-white">
                          ${row.usdcAmount.toFixed(2)} USDC
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate" title={row.bankDetails}>
                          {row.bankDetails}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSettled
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : row.status === 'SENT_BY_LP'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : row.status === 'PENDING_MANUAL_REVIEW'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : isRefunded
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {isRefunded ? 'EXPIRED (SLA)' : row.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {isPendingAction && (
                            <button
                              onClick={() => handleMarkSent(row.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-[11px] transition-all"
                            >
                              Mark as Sent
                            </button>
                          )}

                          {isSentPendingReceipt && (
                            <button
                              onClick={() => {
                                setSelectedIntent(row);
                                setReceiptBase64('');
                                setReceiptPreview(null);
                                setUploadResult(null);
                                setErrorMsg(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all inline-flex items-center gap-1"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Upload Receipt</span>
                            </button>
                          )}

                          {isSettled && (
                            <span className="text-[11px] text-emerald-400 font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Released</span>
                            </span>
                          )}

                          {isRefunded && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Cancelled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Receipt Upload & OCR Verification */}
        {selectedIntent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-[#141e33] border border-[#334155] rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-[#334155] pb-4">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold font-['Space_Grotesk',sans-serif]">
                    Upload Raast Payment Receipt
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedIntent(null)}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] text-[#8a9aa8] hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Order Context */}
              <div className="bg-[#0a0e17] rounded-xl p-3.5 border border-[#334155] font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8a9aa8]">Claim ID:</span>
                  <span className="text-white font-bold">{selectedIntent.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8a9aa8]">Required Transfer:</span>
                  <span className="text-emerald-400 font-bold">Rs. {selectedIntent.pkrAmount.toLocaleString()} PKR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8a9aa8]">Recipient Bank:</span>
                  <span className="text-slate-300 font-bold">{selectedIntent.bankDetails}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8a9aa8]">USDC to Release:</span>
                  <span className="text-white font-bold">${selectedIntent.usdcAmount.toFixed(2)} USDC</span>
                </div>
              </div>

              {/* Upload Input */}
              <div className="space-y-3">
                <label className="block text-xs font-mono uppercase text-[#8a9aa8]">
                  Select Screenshot (Bank / Raast Transfer Slip)
                </label>

                <div className="border-2 border-dashed border-[#334155] hover:border-emerald-500/60 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-[#0a0e17]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white cursor-pointer"
                  />
                </div>

                {receiptPreview && (
                  <div className="max-h-48 overflow-hidden rounded-xl border border-[#334155]">
                    <img src={receiptPreview} alt="Receipt preview" className="w-full object-contain max-h-48" />
                  </div>
                )}
              </div>

              {/* Error Display */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl text-xs font-mono bg-red-950/60 border border-red-500/40 text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Success Result */}
              {uploadResult && (
                <div className="p-4 rounded-xl text-xs font-mono bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Receipt Verified by OCR! Escrow Released.</span>
                  </div>
                  <div>RRN / STAN: {uploadResult.rrn}</div>
                  <div>Released to Treasury: ${uploadResult.releasedUsdc} USDC</div>
                  <div className="text-[10px] text-slate-400">Ledger Reference: {uploadResult.ledgerTxId}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIntent(null)}
                  className="flex-1 py-3 rounded-xl border border-[#334155] text-xs font-bold text-[#8a9aa8] hover:text-white"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleUploadReceipt}
                  disabled={uploading || !receiptBase64}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying OCR &amp; RRN...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify &amp; Release USDC</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

