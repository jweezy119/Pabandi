import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircleIcon, GiftIcon, ShieldCheckIcon, ArrowRightIcon,
  PhoneIcon, WalletIcon, StarIcon, BuildingStorefrontIcon,
  LinkIcon, LockClosedIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';

// ─── Trust Score Criteria (max 22,500 PAB) ───────────────────────────────────
const CRITERIA = [
  { id: 'account_created',   label: 'Account Created',            points: 1000, icon: <CheckCircleIcon className="w-5 h-5" />, color: '#10b981' },
  { id: 'phone_verified',    label: 'Phone Number Verified',       points: 1500, icon: <PhoneIcon className="w-5 h-5" />,        color: '#06b6d4' },
  { id: 'google_linked',     label: 'Google Account Linked',       points: 2000, icon: <LinkIcon className="w-5 h-5" />,         color: '#ea4335' },
  { id: 'twitter_linked',    label: 'X / Twitter Linked',          points: 2000, icon: <LinkIcon className="w-5 h-5" />,         color: '#1DA1F2' },
  { id: 'wallet_connected',  label: 'Web3 Wallet Connected',       points: 2500, icon: <WalletIcon className="w-5 h-5" />,       color: '#9945FF' },
  { id: 'wallet_age_6m',    label: 'Wallet Age > 6 Months',       points: 2500, icon: <ShieldCheckIcon className="w-5 h-5" />,  color: '#f59e0b' },
  { id: 'wallet_age_1y',    label: 'Wallet Age > 1 Year (+bonus)',  points: 2500, icon: <ShieldCheckIcon className="w-5 h-5" />,  color: '#d97706' },
  { id: 'first_booking',    label: 'Completed First Booking',      points: 3000, icon: <CheckCircleIcon className="w-5 h-5" />, color: '#10b981' },
  { id: 'has_review',       label: 'Left a Review',                points: 2000, icon: <StarIcon className="w-5 h-5" />,         color: '#f59e0b' },
  { id: 'business_verified', label: 'Verified Business Partner',   points: 5000, icon: <BuildingStorefrontIcon className="w-5 h-5" />, color: '#8b5cf6' },
];
const MAX_PAB = CRITERIA.reduce((s, c) => s + c.points, 0); // 24,500

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export const AirdropPage: React.FC = () => {
  const { isAuthenticated, token } = useAuthStore();
  const [eligibility, setEligibility] = useState<Record<string, boolean>>({});
  const [totalPab, setTotalPab] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [totalClaimed, setTotalClaimed] = useState(2743);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/airdrop/stats`)
      .then(r => r.json()).then(d => { if (d.claimed) setTotalClaimed(d.claimed); }).catch(() => {});
  }, []);

  const fetchEligibility = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    setFetching(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/airdrop/eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEligibility(data.criteria || {});
        setTotalPab(data.totalPab || 0);
        if (data.alreadyClaimed) setAlreadyClaimed(true);
      }
    } catch { /* silent */ } finally { setFetching(false); }
  }, [isAuthenticated, token]);

  useEffect(() => { fetchEligibility(); }, [fetchEligibility]);

  const handleClaim = async () => {
    if (!isAuthenticated) { window.location.href = '/register?redirect=/airdrop'; return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/airdrop/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) { setClaimed(true); setTotalClaimed(s => s + 1); }
      else if (res.status === 409) setAlreadyClaimed(true);
      else setError(data.message || 'Something went wrong. Please try again.');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const earnedPab = isAuthenticated ? totalPab : 1000; // base for anonymous preview
  const pctOfMax = Math.round((earnedPab / MAX_PAB) * 100);

  return (
    <div className="min-h-screen bg-[#020817] text-white relative overflow-hidden">
      {/* Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-emerald-500 rounded-full blur-[200px] opacity-[0.07] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-600 rounded-full blur-[150px] opacity-[0.05] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto border-b border-white/5">
        <Link to="/" className="flex items-center gap-2 text-white font-black text-xl tracking-tight">
          <img src="/logo-company.jpg" alt="Pabandi" className="w-8 h-8 rounded-full object-cover" />
          Pabandi
        </Link>
        {!isAuthenticated
          ? <Link to="/register?redirect=/airdrop" className="text-sm font-bold px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">Sign Up to Check Score →</Link>
          : <Link to="/wallet" className="text-sm font-semibold text-white/50 hover:text-white transition-colors">My Wallet</Link>
        }
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-14 pb-24">

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8">
            <GiftIcon className="w-4 h-4" />
            Merit-Based Genesis Airdrop · 100M $PAB Budget
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-5 leading-[1.05]">
            Your Trust Score =<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Your $PAB Airdrop
            </span>
          </h1>
          <p className="text-lg text-white/55 max-w-xl mx-auto leading-relaxed">
            No fixed cap on participants. <strong className="text-white">Everyone can join.</strong> The more you prove your reliability — verified accounts, Web3 wallet age, bookings, reviews — the more $PAB you earn. Up to <strong className="text-emerald-400">{MAX_PAB.toLocaleString()} $PAB</strong> per user.
          </p>
          <p className="mt-4 text-xs text-white/30">{totalClaimed.toLocaleString()} wallets have already claimed · 100M $PAB total pool</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── Left: Criteria List ── */}
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
            <h2 className="font-bold text-white mb-1 text-lg">How Your Score Is Calculated</h2>
            <p className="text-white/40 text-sm mb-6">Complete actions to increase your $PAB allocation. Each criterion is checked automatically.</p>
            <div className="space-y-3">
              {CRITERIA.map(c => {
                const done = isAuthenticated ? (eligibility[c.id] ?? false) : false;
                return (
                  <div key={c.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${done ? 'bg-white/[0.06] border-white/10' : 'border-white/5 opacity-60'}`}>
                    <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${c.color}20`, color: c.color, border: `1px solid ${c.color}30` }}>
                      {done ? <CheckCircleIcon className="w-5 h-5" style={{ color: c.color }} /> : <LockClosedIcon className="w-4 h-4 text-white/30" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{c.label}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-black" style={{ color: done ? c.color : 'rgba(255,255,255,0.3)' }}>+{c.points.toLocaleString()}</span>
                      <span className="text-[10px] text-white/30 ml-0.5">$PAB</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Your Score & Claim ── */}
          <div className="space-y-6 sticky top-8">

            {/* Score Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
              <p className="text-white/40 text-xs uppercase font-bold tracking-widest mb-3">Your Current Allocation</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  {fetching ? '...' : earnedPab.toLocaleString()}
                </span>
                <span className="text-emerald-400 font-bold text-xl mb-1">$PAB</span>
              </div>
              <p className="text-white/30 text-xs mb-4">
                {pctOfMax}% of max possible ({MAX_PAB.toLocaleString()} $PAB)
              </p>
              <ScoreBar value={earnedPab} max={MAX_PAB} color="linear-gradient(90deg, #10b981, #06b6d4)" />

              {!isAuthenticated && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-semibold">
                  ⚠️ Sign in to see your real Trust Score and eligibility.
                </div>
              )}
            </div>

            {/* How to Maximize */}
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
              <h3 className="font-bold text-white mb-3 text-sm">How to Maximize Your Airdrop</h3>
              <ol className="space-y-2 text-white/50 text-xs leading-relaxed list-decimal list-inside">
                <li>Create and verify your Pabandi account (+1,000)</li>
                <li>Verify your phone number (+1,500)</li>
                <li>Link your Google or X (Twitter) account (+2,000 each)</li>
                <li>Connect your Phantom Web3 wallet (+2,500)</li>
                <li>If your wallet is 6+ months old, earn an extra bonus (+2,500–5,000)</li>
                <li>Complete your first Pabandi booking (+3,000)</li>
                <li>Leave a review for a business (+2,000)</li>
                <li>Register and verify your business (+5,000 bonus)</li>
              </ol>
            </div>

            {/* CTA */}
            {claimed ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 text-center">
                <CheckCircleIcon className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-xl font-black text-white mb-1">Airdrop Claimed! 🎉</h2>
                <p className="text-white/50 text-sm mb-4"><strong className="text-emerald-400">{earnedPab.toLocaleString()} $PAB</strong> credited to your Vault.</p>
                <p className="text-white/30 text-xs mb-5">You can increase your score at any time — we'll top up your allocation if you complete more actions before the pool closes.</p>
                <Link to="/wallet" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors">
                  View My Wallet <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            ) : alreadyClaimed ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 text-center">
                <CheckCircleIcon className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h2 className="text-xl font-black text-white mb-1">Already Claimed ✅</h2>
                <p className="text-white/50 text-sm mb-4">You've already claimed your Genesis Airdrop. Keep completing Trust actions to earn a top-up before the pool closes.</p>
                <Link to="/wallet" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors">
                  Go to Wallet <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {error && <p className="text-red-400 text-sm font-medium text-center">{error}</p>}
                <button
                  id="claim-airdrop-btn"
                  onClick={handleClaim}
                  disabled={loading || (!isAuthenticated ? false : earnedPab === 0)}
                  className="w-full inline-flex items-center justify-center gap-3 px-8 py-5 rounded-2xl text-base font-black text-black bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:opacity-90 transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_40px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading
                    ? <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    : <GiftIcon className="w-5 h-5" />
                  }
                  {loading
                    ? 'Claiming...'
                    : isAuthenticated
                      ? `Claim ${earnedPab.toLocaleString()} $PAB`
                      : 'Sign Up to Calculate & Claim'
                  }
                </button>
                <p className="text-center text-white/25 text-xs">No SOL required. No network fees. Instant credit to your Vault.</p>
              </div>
            )}
          </div>
        </div>

        {/* Fine print */}
        <p className="mt-16 text-center text-xs text-white/20">
          Airdrop tokens are credited to your off-chain Pabandi Vault. On-chain withdrawal to your Solana wallet will be enabled when the Raydium liquidity pool goes live.<br />
          $PAB Contract: <span className="font-mono">Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ</span>
        </p>
      </div>
    </div>
  );
};

export default AirdropPage;
