import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Building2, CreditCard, ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import api from '../services/api';
import '../styles/pbn-tokens.css';

const PAKISTANI_BANKS = [
  'Meezan Bank',
  'Habib Bank Limited (HBL)',
  'Standard Chartered Bank',
  'Bank Alfalah',
  'MCB Bank',
  'Allied Bank Limited (ABL)',
  'Faysal Bank',
  'United Bank Limited (UBL)',
  'Askari Bank',
  'JazzCash Wallet',
  'Easypaisa Wallet',
  'Raast Direct Alias',
  'Other Pakistani Bank',
];

export default function VerifyPayoutPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [bankName, setBankName] = useState('Meezan Bank');
  const [customBank, setCustomBank] = useState('');
  const [accountRef, setAccountRef] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setFetching(true);
      const res = await api.get('/payout-verification/status');
      const data = res.data?.data;
      if (data) {
        setStatus(data);
        if (data.payoutAccountRef) {
          if (data.payoutAccountRef.includes(' - ')) {
            const parts = data.payoutAccountRef.split(' - ');
            setBankName(parts[0]);
            setAccountRef(parts[1] || '');
          } else {
            setAccountRef(data.payoutAccountRef);
          }
        }
      }
    } catch {
      // offline / first time
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountRef.trim()) {
      setMessage({ type: 'error', text: 'Please enter your Account Number, IBAN, or Raast ID.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const effectiveBank = bankName === 'Other Pakistani Bank' ? (customBank.trim() || 'Pakistani Bank') : bankName;
    const isWallet = effectiveBank.includes('Wallet') || effectiveBank.includes('Raast') || /^(03\d{9}|\+923\d{9})$/.test(accountRef.trim());

    try {
      const res = await api.post('/payout-verification', {
        payoutMethod: isWallet ? 'WALLET' : 'BANK_ESFCA',
        bankName: effectiveBank,
        accountRef: accountRef.trim(),
      });

      setStatus(res.data?.data || { isPayoutVerified: true, payoutAccountRef: `${effectiveBank} - ${accountRef.trim()}` });
      setMessage({
        type: 'success',
        text: 'Payout method saved! Your account is verified for instant Raast off-ramp settlements.',
      });

      const returnTo = params.get('return');
      if (returnTo) {
        setTimeout(() => navigate(returnTo), 1200);
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.error || err?.response?.data?.message || 'Failed to save payout method.',
      });
    } finally {
      setLoading(false);
    }
  };

  const returnTo = params.get('return');

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#f1f5f9] px-4 py-12 selection:bg-[var(--pbn-accent,#4fd1c5)]/30">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(returnTo || '/gigs')}
            className="text-xs font-semibold text-[#8a9aa8] hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border border-emerald-500/30 bg-emerald-950/40 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>SBP Raast &amp; ESFCA Compliant</span>
          </div>
        </div>

        {/* Current Verified Card (if already saved) */}
        {status?.isPayoutVerified && status?.payoutAccountRef && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Active Payout Route Verified</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                0% Raast Settlement Fee
              </span>
            </div>
            <div className="text-base font-bold font-mono text-white">
              {status.payoutAccountRef}
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-400">
                Funds released from milestones will be sent to this destination.
              </p>
              <Link
                to="/milestones"
                className="text-xs font-bold text-[var(--pbn-accent,#4fd1c5)] hover:underline inline-flex items-center gap-1"
              >
                <span>View Milestone Payouts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Main Payout Setup Form Card */}
        <div className="rounded-3xl border border-[#334155] bg-[#141e33] p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--pbn-accent,#4fd1c5)]/10 border border-[var(--pbn-accent,#4fd1c5)]/30 flex items-center justify-center text-[var(--pbn-accent,#4fd1c5)]">
              <Building2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Space_Grotesk',sans-serif] tracking-tight">
              Where should we send your PKR?
            </h1>
            <p className="text-sm text-[#94a3b8] leading-relaxed">
              When an international client approves your milestone in USDC, Pabandi's liquidity providers off-ramp directly into your Pakistani bank account or Raast ID within minutes.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-5">
            {/* Bank Name */}
            <div>
              <label className="block text-xs font-semibold uppercase font-mono tracking-wider text-[#94a3b8] mb-2">
                Bank Name *
              </label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-[#0a0e17] border border-[#334155] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[var(--pbn-accent,#4fd1c5)] min-h-[48px]"
              >
                {PAKISTANI_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {bankName === 'Other Pakistani Bank' && (
              <div>
                <label className="block text-xs font-semibold uppercase font-mono tracking-wider text-[#94a3b8] mb-2">
                  Specify Bank Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bank of Punjab, Soneri Bank"
                  value={customBank}
                  onChange={(e) => setCustomBank(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-[#334155] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[var(--pbn-accent,#4fd1c5)] min-h-[48px]"
                />
              </div>
            )}

            {/* Account Number / IBAN or Raast ID */}
            <div>
              <label className="block text-xs font-semibold uppercase font-mono tracking-wider text-[#94a3b8] mb-2">
                Account Number / IBAN or Raast ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PK36 MEZN 0000 0011 2345 6702 or 03001234567"
                value={accountRef}
                onChange={(e) => setAccountRef(e.target.value)}
                className="w-full bg-[#0a0e17] border border-[#334155] rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-[#5a6a78] focus:outline-none focus:border-[var(--pbn-accent,#4fd1c5)] min-h-[48px]"
              />
              <p className="text-[11px] text-[#8a9aa8] mt-1.5">
                Accepts Pakistani 24-character IBANs, standard bank account numbers, or 11-digit Raast mobile numbers.
              </p>
            </div>

            {/* Feedback Message */}
            {message && (
              <div
                className={`p-3.5 rounded-xl text-xs font-mono flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                    : 'bg-red-950/60 border border-red-500/40 text-red-400'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !accountRef.trim()}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pbn-accent,#4fd1c5)] px-6 py-3.5 text-sm font-bold text-slate-950 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-[var(--pbn-accent,#4fd1c5)]/20"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Save Payout Method</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Guaranteed SLA Info */}
          <div className="pt-4 border-t border-[#334155] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#94a3b8]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero FX Hidden Spread</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[var(--pbn-accent,#4fd1c5)] shrink-0" />
              <span>Instant Raast Settlement</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
