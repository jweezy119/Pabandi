import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { ClayBadge } from '../../../components/primitives/ClayBadge';
import { getAuthToken } from '../../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

type SubscriptionTier = 'starter' | 'pro' | 'business';

const TIERS: SubscriptionTier[] = ['starter', 'pro', 'business'];

const TIER_LABELS: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

const TIER_PRICES: Record<SubscriptionTier, number> = {
  starter: 29,
  pro: 49,
  business: 149,
};

export default function ContactSubscriptionPage() {
  const [searchParams] = useSearchParams();

  const [subscription, setSubscription] = useState<{ tier?: string; status?: string; priceCents?: number } | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [quotaState, setQuotaState] = useState<{ tier?: string; quota?: number; used?: number; remaining?: number; resetsAt?: string | null } | null>(null);
  const [tiers, setTiers] = useState<Record<string, { netAmount: number; creditApplied: number }>>({});
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [subRes, creditRes, quotaRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/billing/subscription`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/billing/credit-balance`, { headers: getHeaders() }),
        fetch(`${API_BASE}/api/v1/billing/mcp-quota`, { headers: getHeaders() }),
      ]);
      if (subRes.ok) setSubscription(await subRes.json().then((d) => d.data ?? d));
      if (creditRes.ok) {
        const d = await creditRes.json();
        setCreditBalance(d?.data?.saasCreditBalance ?? d?.saasCreditBalance ?? 0);
      }
      if (quotaRes.ok) {
        const d = await quotaRes.json();
        setQuotaState(d?.data ?? d);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Handle return from Square checkout.
  useEffect(() => {
    if (searchParams.get('paid') === 'true' && searchParams.get('invoice')) {
      setSuccess('Payment completed. Confirming your upgrade…');
      void confirmUpgrade(searchParams.get('invoice')!);
    } else if (searchParams.get('paid') === 'cancelled') {
      setError('Payment was cancelled. Your subscription was not changed.');
    }
  }, [searchParams]);

  const confirmUpgrade = async (invoiceId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/subscription/confirm`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ invoiceId }),
      });
      const d = await res.json();
      if (d.success) {
        setSuccess(`Upgraded to ${d.data.tier}! Your saas credit was applied.`);
        setSubscription((prev) => (prev ? { ...prev, tier: d.data.tier, status: 'active' } : prev));
        setCreditBalance(Math.max(0, creditBalance - (d.data.creditAppliedCents ?? 0) / 100));
      } else {
        setError(d.error || 'Confirm failed.');
      }
    } catch (err) {
      setError('Confirm failed.');
    } finally {
      setTimeout(() => setSuccess(null), 5000);
      setTimeout(() => setError(null), 5000);
    }
  };

  const computeNet = (tierPrice: number) => {
    const priceCents = Math.round(tierPrice * 100);
    const creditCents = Math.round(creditBalance * 100);
    const creditApplied = Math.min(creditCents, priceCents);
    return { netAmount: (priceCents - creditApplied) / 100, creditApplied: creditApplied / 100 };
  };

  useEffect(() => {
    const next: Record<string, { netAmount: number; creditApplied: number }> = {};
    for (const t of TIERS) {
      next[t] = computeNet(TIER_PRICES[t]);
    }
    setTiers(next);
  }, [creditBalance]);

  const currentTier = subscription?.tier ?? 'free';

  const handleUpgrade = async (tier: SubscriptionTier) => {
    setSubscribing(tier);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/subscribe`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetTier: tier }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.error || 'Upgrade failed.');
        setSubscribing(null);
        return;
      }
      const data = d.data;
      if (!data.paymentRequired) {
        setSuccess(data.message || `Upgraded to ${tier}!`);
        setSubscription((prev) => (prev ? { ...prev, tier, status: 'active' } : prev));
        setCreditBalance(Math.max(0, creditBalance - (data.creditAppliedCents ?? 0) / 100));
        setSubscribing(null);
        return;
      }
      // Redirect to Square checkout.
      window.location.href = data.paymentUrl;
    } catch (err) {
      setError('Upgrade failed.');
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
        <div className="max-w-5xl mx-auto py-12 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--clay)] border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const isFree = currentTier === 'free';
  const currentPrice = currentTier === 'free' ? 0 : TIER_PRICES[currentTier as SubscriptionTier] ?? 0;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="clay-heading pb-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Subscription & Billing</h1>
          <p className="text-sm text-[var(--soft-stone)] mt-0.5">
            Your plan, your saas credit, and your next invoice. Credit earned from escrow yield pays here first.
          </p>
        </div>

        {error && (
          <div className="rounded-xl p-4" style={{ background: 'var(--dusty-rose)/10', border: '1px solid var(--dusty-rose)/30' }}>
            <p className="text-sm text-[var(--dusty-rose)]">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-xl p-4" style={{ background: 'var(--sage)/10', border: '1px solid var(--sage)/30' }}>
            <p className="text-sm text-[var(--sage)]">{success}</p>
          </div>
        )}

        {/* Current plan + credit + MCP quota */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="lg" className="bg-[var(--warm-sand)]/30 border border-[var(--soft-stone)]/30">
            <h3 className="font-semibold text-[var(--warm-ink)] mb-1">Current plan</h3>
            <p className="text-xl font-bold text-[var(--clay)]">{currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}</p>
            <p className="text-xs text-[var(--soft-stone)]">
              {isFree ? 'Free tier' : `$${currentPrice}/month`} · {subscription?.status ?? 'active'}
            </p>
          </Card>
          <Card padding="lg" className="bg-white border border-[var(--soft-stone)]/30 shadow-[var(--shadow-soft)]">
            <h3 className="font-semibold text-[var(--warm-ink)] mb-1">SaaS credit balance</h3>
            <p className="text-2xl font-bold text-[var(--warm-ink)]">${creditBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-[var(--soft-stone)]">
              Earned from Solana escrow yield. Applied to your subscription before you pay.
            </p>
          </Card>
          <Card padding="lg" className="bg-white border border-[var(--soft-stone)]/30 shadow-[var(--shadow-soft)]">
            <h3 className="font-semibold text-[var(--warm-ink)] mb-1">MCP tool-call quota</h3>
            {quotaState ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)] mb-1">
                  Tier: {quotaState.tier ? quotaState.tier.charAt(0).toUpperCase() + quotaState.tier.slice(1) : '—'}
                </p>
                <div className="text-2xl font-bold text-[var(--warm-ink)]">
                  {quotaState.quota === 0 ? '∞' : quotaState.remaining ?? 0}
                </div>
                <p className="text-xs text-[var(--soft-stone)]">
                  {quotaState.quota === 0
                    ? 'Pay per call (0.001 USDC). Upgrade for a monthly quota.'
                    : `${quotaState.used ?? 0} of ${quotaState.quota?.toLocaleString() ?? 0} used this month`}
                </p>
                {quotaState.resetsAt && (
                  <p className="text-xs text-[var(--soft-stone)] mt-1">
                    Resets {new Date(quotaState.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </>
            ) : (
              <div className="h-8 w-8 rounded-full border-2 border-[var(--soft-stone)]/30 border-t-transparent animate-spin" />
            )}
          </Card>
        </div>

        {/* Upgrade tiers */}
        <div>
          <h3 className="font-bold text-[var(--warm-ink)] mb-4">Upgrade your plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TIERS.map((t) => {
              const isCurrent = t === currentTier;
              const { netAmount, creditApplied } = tiers[t] ?? { netAmount: TIER_PRICES[t], creditApplied: 0 };
              return (
                <Card
                  key={t}
                  padding="lg"
                  className={`cursor-pointer hover:shadow-md transition-shadow ${isCurrent ? 'bg-[var(--clay)]/20 border border-[var(--clay)]' : 'bg-white border border-[var(--soft-stone)]/30'}`}
                  onClick={isCurrent ? undefined : () => handleUpgrade(t)}
                  disabled={isCurrent}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-[var(--warm-ink)]">{TIER_LABELS[t]}</h3>
                    {isCurrent && (
                      <ClayBadge label="Current" variant="success" size="sm" />
                    )}
                  </div>
                  {isCurrent ? (
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-[var(--clay)]">${TIER_PRICES[t]}/mo</p>
                      <p className="text-xs text-[var(--soft-stone)]">You're on this plan.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-bold text-[var(--warm-ink)]">${netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-xs text-[var(--soft-stone)]">/mo</p>
                      </div>
                      {creditApplied > 0 && (
                        <p className="text-xs text-[var(--sage)] font-medium">
                          −${creditApplied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} saas credit
                        </p>
                      )}
                      <p className="text-xs text-[var(--soft-stone)]">
                        Full price ${TIER_PRICES[t]}/mo · credit applied first
                      </p>
                      <Button
                        variant="primary"
                        disabled={subscribing === t}
                        loading={subscribing === t}
                        className="w-full"
                        onClick={() => handleUpgrade(t)}
                      >
                        {subscribing === t ? 'Upgrading…' : netAmount === 0 ? 'Upgrade (free)' : 'Upgrade & pay'}
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-xl p-4" style={{ background: 'var(--warm-sand)/20', border: '1px solid var(--soft-stone)/30' }}>
          <h4 className="font-bold text-[var(--warm-ink)] mb-2">How it works</h4>
          <ul className="text-sm text-[var(--soft-stone)] space-y-1 list-disc pl-5">
            <li>Choose a tier. Your saas credit balance is applied first.</li>
            <li>Pay the remaining amount through Square (your card rails).</li>
            <li>Credit is deducted and your tier upgrades once payment confirms.</li>
            <li>No Stripe — payments go through Square or Solana Pay rails you already trust.</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
