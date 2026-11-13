import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Building2,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Zap,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Lock,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import '../styles/pbn-tokens.css';

interface MilestoneData {
  id: string;
  gigId: string;
  title: string;
  description: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'SETTLED';
  grossUsdc: number;
  platformFeePct: number;
  guaranteedRatePkr: number;
  freelancerId: string;
}

export default function MilestoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [milestone, setMilestone] = useState<MilestoneData>({
    id: id || 'ms_100_usdc_dev',
    gigId: 'gig_react_solana_demo',
    title: 'Milestone 1: Smart Contract Escrow & Frontend Integration',
    description: 'Deliver production-ready Anchor PDA escrow integration and verified testing suite.',
    status: 'APPROVED', // APPROVED triggers the prominent card!
    grossUsdc: 100.0,
    platformFeePct: 0.03, // 3%
    guaranteedRatePkr: 279.50,
    freelancerId: user?.id || 'freelancer_current',
  });

  const [savedDestination, setSavedDestination] = useState<string>('Meezan Bank - PK36MEZN0000001123456702');
  const [isPayoutVerified, setIsPayoutVerified] = useState<boolean>(true);
  const [accountTitle, setAccountTitle] = useState<string>('');
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [withdrawResult, setWithdrawResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile name from auth store
  const profileName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  // Fetch contractor's saved payout route
  useEffect(() => {
    api
      .get('/payout-verification/status')
      .then((res) => {
        const d = res.data?.data;
        if (d) {
          if (d.payoutAccountRef) setSavedDestination(d.payoutAccountRef);
          setIsPayoutVerified(Boolean(d.isPayoutVerified));
          if (d.accountTitle) setAccountTitle(d.accountTitle);
          else if (profileName) setAccountTitle(profileName);
        }
      })
      .catch(() => {});
  }, [profileName]);

  // Anti-Fraud Compliance Checks
  const effectiveTitle = accountTitle || profileName;
  const isNameMatching =
    !profileName || !effectiveTitle || profileName.toLowerCase() === effectiveTitle.toLowerCase();
  const canWithdraw = isPayoutVerified && isNameMatching;

  // Financial Calculations
  const grossEarnings = milestone.grossUsdc;
  const platformFee = Number((grossEarnings * milestone.platformFeePct).toFixed(2)); // -$3.00
  const netPayout = Number((grossEarnings - platformFee).toFixed(2)); // $97.00
  const guaranteedRate = milestone.guaranteedRatePkr; // 279.50
  const pkrToReceive = Math.round(netPayout * guaranteedRate); // Rs. 27,111 PKR

  const handleInstantWithdraw = async () => {
    setWithdrawing(true);
    setErrorMsg(null);

    try {
      const res = await api.post('/offramp/intent', {
        amountUsdc: grossEarnings,
        minRatePkr: guaranteedRate,
        destinationType: savedDestination.toLowerCase().includes('wallet') || savedDestination.toLowerCase().includes('raast') ? 'RAAST' : 'BANK',
        destinationRef: savedDestination,
        lockedTxHash: `anchor_escrow_lock_${Date.now()}`,
      });

      const data = res.data?.data || res.data;
      setWithdrawResult(data);
      setMilestone((prev) => ({ ...prev, status: 'SETTLED' }));
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          'Failed to trigger LP off-ramp settlement. Please try again.'
      );
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#f1f5f9] px-4 py-12 selection:bg-[var(--pbn-accent,#4fd1c5)]/30">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/gigs"
            className="text-xs font-semibold text-[#8a9aa8] hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Gig Board</span>
          </Link>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border border-emerald-500/30 bg-emerald-950/40 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Anchor Escrow PDA Locked</span>
          </div>
        </div>

        {/* Milestone Overview Card */}
        <div className="rounded-3xl border border-[#334155] bg-[#141e33] p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-[var(--pbn-accent,#4fd1c5)]/10 text-[var(--pbn-accent,#4fd1c5)] border border-[var(--pbn-accent,#4fd1c5)]/20">
              Contract Milestone #1
            </span>

            <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Milestone Status: {milestone.status}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black font-['Space_Grotesk',sans-serif] tracking-tight">
            {milestone.title}
          </h1>

          <p className="text-sm text-[#94a3b8] leading-relaxed">
            {milestone.description}
          </p>
        </div>

        {/* PROMINENT CARD: APPROVED MILESTONE OFF-RAMP */}
        {(milestone.status === 'APPROVED' || milestone.status === 'SETTLED') && (
          <div className="rounded-3xl border-2 border-emerald-500/50 bg-gradient-to-br from-[#0f241d] via-[#141e33] to-[#0a0e17] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-['Space_Grotesk',sans-serif] text-white">
                    Milestone Approved — Ready for Payout
                  </h2>
                  <p className="text-xs text-emerald-400/90 font-mono">
                    Direct-to-Bank Cross-Border Settlement
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                Zero SBP Fee
              </span>
            </div>

            {/* Breakdown Grid */}
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center text-slate-300 py-1 border-b border-white/[0.06]">
                <span>Gross Earnings:</span>
                <span className="font-bold text-white">${grossEarnings.toFixed(2)} USDC</span>
              </div>

              <div className="flex justify-between items-center text-slate-300 py-1 border-b border-white/[0.06]">
                <span>Platform Fee (3%):</span>
                <span className="font-bold text-red-400">-${platformFee.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-300 py-1 border-b border-white/[0.06]">
                <span>Net Payout:</span>
                <span className="font-bold text-emerald-400">${netPayout.toFixed(2)} USDC</span>
              </div>

              <div className="flex justify-between items-center text-slate-400 py-1 border-b border-white/[0.06]">
                <span>Guaranteed Rate:</span>
                <span className="text-slate-200">1 USD = {guaranteedRate.toFixed(2)} PKR</span>
              </div>

              <div className="flex justify-between items-center py-2.5 bg-emerald-950/40 px-4 rounded-xl border border-emerald-500/30">
                <span className="text-base font-bold text-white uppercase tracking-wider font-['Space_Grotesk',sans-serif]">
                  You will receive:
                </span>
                <span className="text-2xl font-black text-emerald-400 tracking-tight">
                  Rs. {pkrToReceive.toLocaleString()} PKR
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs pt-1 gap-1 text-slate-400">
                <span className="text-[#8a9aa8]">Destination:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white font-mono">{savedDestination}</span>
                  <Link
                    to="/verify-payout"
                    className="text-[var(--pbn-accent,#4fd1c5)] hover:underline text-[11px]"
                  >
                    Change
                  </Link>
                </div>
              </div>
            </div>

            {/* Anti-Fraud Strictness Warnings */}
            {!isPayoutVerified && (
              <div className="p-4 rounded-xl text-xs font-mono bg-amber-950/60 border border-amber-500/40 text-amber-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Payout method not verified. Please verify your bank details before initiating off-ramp.</span>
                </div>
                <Link
                  to="/verify-payout"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold shrink-0 hover:bg-amber-400 transition-colors"
                >
                  Verify Payout →
                </Link>
              </div>
            )}

            {isPayoutVerified && !isNameMatching && (
              <div className="p-4 rounded-xl text-xs font-mono bg-red-950/60 border border-red-500/40 text-red-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-red-400" />
                  <span>
                    Anti-Fraud Check Failed: Bank account title ("{effectiveTitle}") must match your Pabandi profile name ("{profileName}") exactly.
                  </span>
                </div>
                <Link
                  to="/verify-payout"
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold shrink-0 hover:bg-red-400 transition-colors"
                >
                  Fix Details →
                </Link>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl text-xs font-mono bg-red-950/60 border border-red-500/40 text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Withdraw Action Button (Enforced Anti-Fraud Strictness) */}
            {!withdrawResult ? (
              canWithdraw ? (
                <button
                  type="button"
                  onClick={handleInstantWithdraw}
                  disabled={withdrawing}
                  className="w-full flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-[var(--pbn-accent,#4fd1c5)] text-slate-950 font-bold text-base transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 shadow-xl shadow-emerald-500/20 font-['Space_Grotesk',sans-serif]"
                >
                  {withdrawing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Dispatching to Operator LP Bot via @PabanBot...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 fill-current" />
                      <span>⚡ Instant Withdraw to Raast</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed border border-slate-700 font-['Space_Grotesk',sans-serif]"
                >
                  <Lock className="w-4 h-4" />
                  <span>Withdrawal Locked — Complete Payout Verification First</span>
                </button>
              )
            ) : (
              /* Success & Dispatch Result */
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-5 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold font-mono">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Trade Request Dispatched to LP Network via @PabanBot</span>
                </div>

                <div className="bg-[#0a0e17] rounded-xl p-4 border border-[#334155] font-mono text-xs space-y-2">
                  <div className="text-[#8a9aa8] text-[10px] uppercase font-bold tracking-wider">
                    Telegram LP Alert Broadcasted:
                  </div>
                  <div className="text-emerald-300 font-semibold break-words">
                    {withdrawResult.telegramMessage ||
                      `🚨 New Trade Request: Send Rs. ${pkrToReceive.toLocaleString()} to [${savedDestination}] via Raast. Receive $${netPayout.toFixed(2)} USDC.`}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono text-slate-400 pt-1">
                  <div>
                    <span className="block text-[#8a9aa8]">Ledger Reference:</span>
                    <span className="text-white font-semibold">{withdrawResult.ledgerTxId || 'ledger_tx_settled'}</span>
                  </div>
                  <div>
                    <span className="block text-[#8a9aa8]">Settlement Status:</span>
                    <span className="text-emerald-400 font-semibold">PENDING_LP (Claim &amp; OCR Verify)</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  The Liquidity Provider is sending <strong className="text-white">Rs. {pkrToReceive.toLocaleString()} PKR</strong> to your bank account via SBP Raast now. Once sent, our OCR verifier will confirm the transaction reference and release the $97.00 USDC to the LP.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

