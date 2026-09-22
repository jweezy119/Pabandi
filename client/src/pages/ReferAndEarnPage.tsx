import React, { useState, useEffect, useCallback } from 'react';
import { referralService } from '../services/api';

interface MeResponse {
  id: string;
  referralCode: string;
  status: string;
}
interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  currency: string;
  createdAt: string;
  businessId?: string | null;
  reservationId?: string | null;
}
interface ReferralGroup {
  businesses: { id: string; name: string; createdAt: string; isVerified: boolean; bountyPaid: boolean }[];
  users: { id: string; firstName: string; lastName: string; createdAt: string }[];
}

const REFERRAL_BASE = typeof window !== 'undefined' ? `${window.location.origin}/r/` : 'https://pabandi.com/r/';

export const ReferAndEarnPage: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [referrals, setReferrals] = useState<ReferralGroup>({ businesses: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [payoutState, setPayoutState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [payoutMsg, setPayoutMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [me, led, ref] = await Promise.all([
        referralService.getMe(),
        referralService.getLedger(),
        referralService.getReferrals(),
      ]);
      setCode((me.data as MeResponse)?.referralCode || '');
      setLedger((led.data as LedgerEntry[]) || []);
      setReferrals((ref.data as ReferralGroup) || { businesses: [], users: [] });
    } catch (e: any) {
      // Not a partner yet — show the explainer state instead of an error.
      if (e?.response?.status === 404) {
        setCode('');
      } else {
        setError('Could not load your referral dashboard.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalEarned = ledger.reduce((s, l) => s + (l.amount || 0), 0);
  const shareUrl = code ? `${REFERRAL_BASE}${code}` : '';

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard may be blocked; ignore */ }
  };

  const requestPayout = async () => {
    setPayoutState('working');
    setPayoutMsg('');
    try {
      const res = await referralService.requestPayout();
      const d = res.data || {};
      if (d.total > 0) {
        setPayoutState('done');
        setPayoutMsg(`Payout of ${d.total.toFixed(2)} PAB requested (${d.entries} entries).`);
        load();
      } else {
        setPayoutState('error');
        setPayoutMsg(d.error || 'Nothing to pay out yet.');
      }
    } catch (e: any) {
      setPayoutState('error');
      setPayoutMsg(e?.response?.data?.error || 'Payout request failed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--soft-stone)]">Loading your referral dashboard…</div>
    );
  }

  if (!code) {
    return (
      <div className="min-h-screen bg-[var(--cream)] text-[var(--warm-ink)] px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-headline text-3xl font-bold bg-gradient-to-r from-[var(--clay)] to-[var(--dusty-rose)] bg-clip-text text-transparent">
            Refer &amp; Earn
          </h1>
          <p className="mt-4 text-[var(--soft-stone)]">
            Turn your network into PAB. Refer businesses and customers to Pabandi and earn
            signup bounties plus a share of platform fees on every booking they make.
          </p>
          <div className="mt-8 rounded-2xl border border-[var(--clay)]/20 bg-[var(--cream)]/60 p-6 text-left">
            <p className="text-[var(--warm-ink)]">
              Your account isn't a partner yet. Partners get a unique referral code and a live
              earnings ledger — and earn PAB on every booking from people they refer.
            </p>
            <button
              onClick={async () => {
                try {
                  await referralService.enroll();
                  load();
                } catch (e: any) {
                  setError(e?.response?.data?.error || 'Could not enroll. Try again.');
                }
              }}
              className="mt-4 rounded-xl bg-gradient-to-r from-[var(--clay)] to-[var(--dusty-rose)] px-5 py-3 font-semibold text-[var(--warm-ink)] hover:opacity-90"
            >
              Become a partner & get my code
            </button>
            {error && <p className="mt-3 text-sm text-[var(--terracotta)]">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--warm-ink)] px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="font-headline text-3xl font-bold bg-gradient-to-r from-[var(--clay)] to-[var(--dusty-rose)] bg-clip-text text-transparent">
            Refer &amp; Earn
          </h1>
          <p className="text-[var(--soft-stone)] mt-1">Earn PAB every time someone you refer books on Pabandi.</p>
        </header>

        {/* Share card */}
        <section className="rounded-2xl border border-[var(--clay)]/20 bg-[var(--cream)]/60 p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--soft-stone)]">Your referral code</div>
              <div className="font-headline text-2xl font-bold text-[var(--warm-ink)]">{code}</div>
            </div>
            <button
              onClick={copy}
              className="bg-gradient-to-r from-[var(--clay)] to-[var(--dusty-rose)] text-[var(--warm-ink)] text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              {copied ? 'Copied!' : 'Copy share link'}
            </button>
          </div>
          <div className="mt-3 text-sm text-[var(--soft-stone)] break-all">{shareUrl}</div>
        </section>

        {/* Marketplace embed snippet — turn any listing into a secured sale */}
        <section className="rounded-2xl border border-[var(--clay)]/20 bg-[var(--cream)]/60 p-6">
          <div className="font-semibold text-[var(--warm-ink)]">Secure marketplace listings</div>
          <div className="text-sm text-[var(--soft-stone)] mt-1">
            Drop this on any Facebook Marketplace, OfferUp, or Craigslist listing. Buyers and sellers
            meet verified, and you earn commission on every secured sale.
          </div>
          <pre className="mt-3 text-xs text-[var(--clay)] bg-[var(--warm-ink)]/40 border border-[rgba(191,179,163,0.2)] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
{`<iframe src="https://pabandi.com/embed/marketplace?code=${code}" width="320" height="360" frameborder="0" style="border:0;border-radius:14px;"></iframe>`}
          </pre>
          <button
            onClick={() => navigator.clipboard?.writeText(`<iframe src="https://pabandi.com/embed/marketplace?code=${code}" width="320" height="360" frameborder="0" style="border:0;border-radius:14px;"></iframe>`)}
            className="mt-2 bg-gradient-to-r from-[var(--clay)] to-[var(--dusty-rose)] text-[var(--warm-ink)] text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Copy embed code
          </button>
          <div className="mt-3">
            <a href="/partners/marketplace" target="_blank" rel="noopener noreferrer" className="text-[var(--clay)] hover:underline text-sm">
              See the full marketplace partner page →
            </a>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Stat label="Total earned" value={`${totalEarned.toFixed(2)} PAB`} />
          <Stat label="Businesses referred" value={String(referrals.businesses.length)} />
          <Stat label="Customers referred" value={String(referrals.users.length)} />
        </section>

        {/* Payout */}
        <section className="rounded-2xl border border-[var(--clay)]/20 bg-[var(--cream)]/60 p-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold text-[var(--warm-ink)]">Cash out your commissions</div>
            <div className="text-sm text-[var(--soft-stone)]">
              {payoutMsg || 'Bundle your unbilled ledger entries into a payout request.'}
            </div>
          </div>
          <button
            onClick={requestPayout}
            disabled={payoutState === 'working'}
            className="bg-gradient-to-r from-[var(--clay)] to-[var(--dusty-rose)] text-[var(--warm-ink)] text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {payoutState === 'working' ? 'Requesting…' : 'Request payout'}
          </button>
        </section>

        {/* Earnings ledger */}
        <section>
          <h2 className="font-headline text-lg font-semibold text-[var(--warm-ink)] mb-3">Earnings ledger</h2>
          {ledger.length === 0 ? (
            <div className="text-[var(--soft-stone)] text-sm">No earnings yet. Share your code to start.</div>
          ) : (
            <div className="rounded-2xl border border-[rgba(191,179,163,0.2)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--cream)]/70 text-[var(--soft-stone)]">
                  <tr>
                    <th className="text-left font-medium p-3">Type</th>
                    <th className="text-left font-medium p-3">Amount</th>
                    <th className="text-left font-medium p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id} className="border-t border-[rgba(191,179,163,0.15)]">
                      <td className="p-3">{l.type === 'SIGNUP_BOUNTY' ? 'Signup bounty' : 'Booking commission'}</td>
                      <td className="p-3 text-[var(--sage)] font-semibold">+{l.amount.toFixed(2)} {l.currency}</td>
                      <td className="p-3 text-[var(--soft-stone)]">{new Date(l.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Referrals */}
        <section>
          <h2 className="font-headline text-lg font-semibold text-[var(--warm-ink)] mb-3">Referrals</h2>
          {referrals.businesses.length === 0 && referrals.users.length === 0 ? (
            <div className="text-[var(--soft-stone)] text-sm">No referrals yet.</div>
          ) : (
            <div className="space-y-2">
              {referrals.businesses.map((b) => (
                <div key={b.id} className="rounded-xl border border-[rgba(191,179,163,0.2)] bg-[var(--cream)]/40 p-3 flex items-center justify-between">
                  <span className="text-[var(--warm-ink)]">{b.name}</span>
                  <span className="text-xs text-[var(--soft-stone)]">
                    {b.bountyPaid ? 'Bounty paid' : 'Pending'} · {new Date(b.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {referrals.users.map((u) => (
                <div key={u.id} className="rounded-xl border border-[rgba(191,179,163,0.2)] bg-[var(--cream)]/40 p-3 flex items-center justify-between">
                  <span className="text-[var(--warm-ink)]">{u.firstName} {u.lastName}</span>
                  <span className="text-xs text-[var(--soft-stone)]">{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && <div className="text-[var(--terracotta)] text-sm">{error}</div>}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-[rgba(191,179,163,0.2)] bg-[var(--cream)]/50 p-4">
    <div className="text-xs uppercase tracking-wider text-[var(--soft-stone)]">{label}</div>
    <div className="font-headline text-xl font-bold text-[var(--warm-ink)] mt-1">{value}</div>
  </div>
);

export default ReferAndEarnPage;
