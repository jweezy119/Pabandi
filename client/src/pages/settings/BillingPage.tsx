import { useState, useEffect } from 'react';
import { CreditCard, Zap, CheckCircle, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function BillingPage() {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v1/billing/subscription', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) setSubscription(data.data);
      });
  }, []);

  const handleUpgrade = async (tier: 'pro' | 'business') => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.success && (data.url || data.checkoutUrl)) {
        window.location.href = data.url || data.checkoutUrl;
      } else {
        alert('Failed to create checkout session');
      }
    } catch (error) {
      console.error(error);
      alert('Error processing upgrade');
    } finally {
      setLoading(false);
    }
  };

  const tier = subscription?.tier || 'free';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--warm-ink)] mb-2">Billing & Subscription</h1>
        <p className="text-[var(--soft-stone)]">Manage your subscription and billing</p>
      </div>

      <div className="p-6 bg-white rounded-xl border border-[rgba(191,179,163,0.3)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--warm-ink)] capitalize">{tier} Plan</h2>
            <p className="text-sm text-[var(--soft-stone)]">
              {tier === 'free' && '$0/month'}
              {tier === 'pro' && '$49/month'}
              {tier === 'business' && '$149/month'}
            </p>
          </div>
          <span className="px-3 py-1 bg-[var(--sage)]/10 text-[var(--sage)] rounded-full text-sm font-semibold">
            {subscription?.status || 'active'}
          </span>
        </div>
      </div>

      {tier === 'free' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-white rounded-xl border border-[rgba(191,179,163,0.3)]">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-6 h-6 text-[var(--clay)]" />
              <h3 className="text-xl font-bold text-[var(--warm-ink)]">PRO</h3>
            </div>
            <div className="text-3xl font-bold text-[var(--warm-ink)] mb-4">
              $49<span className="text-lg text-[var(--soft-stone)]">/mo</span>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-[var(--warm-ink)]"><CheckCircle className="w-4 h-4 text-green-500" />Unlimited clients & invoices</li>
              <li className="flex items-center gap-2 text-sm text-[var(--warm-ink)]"><CheckCircle className="w-4 h-4 text-green-500" />5 team members</li>
              <li className="flex items-center gap-2 text-sm text-[var(--warm-ink)]"><CheckCircle className="w-4 h-4 text-green-500" />SMS reminders & Analytics</li>
              <li className="flex items-center gap-2 text-sm text-[var(--warm-ink)]"><CheckCircle className="w-4 h-4 text-green-500" />Priority support</li>
            </ul>
            <button onClick={() => handleUpgrade('pro')} disabled={loading} className="w-full px-6 py-3 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg hover:bg-[var(--terracotta)] flex items-center justify-center gap-2">
              <CreditCard className="w-5 h-5" />Upgrade to PRO<ExternalLink className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 bg-gradient-to-br from-[var(--clay)]/10 to-[var(--terracotta)]/10 rounded-xl border border-[var(--clay)]/30">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-6 h-6 text-[var(--clay)]" />
              <h3 className="text-xl font-bold text-[var(--warm-ink)]">Business</h3>
            </div>
            <div className="text-3xl font-bold text-[var(--warm-ink)] mb-4">
              $149<span className="text-lg text-[var(--soft-stone)]">/mo</span>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-[var(--warm-ink)]"><CheckCircle className="w-4 h-4 text-green-500" />Everything in PRO</li>
              <li className="flex items-center gap-2 text-sm text-[var(--warm-ink)]"><CheckCircle className="w-4 h-4 text-green-500" />20 team members</li>
              <li className="flex items-center gap-2 text-sm text-[var(--warm-ink)]"><CheckCircle className="w-4 h-4 text-green-500" />M2M API Access</li>
              <li className="flex items-center gap-2 text-sm text-[var(--warm-ink)]"><CheckCircle className="w-4 h-4 text-green-500" />Webhooks & White label</li>
            </ul>
            <button onClick={() => handleUpgrade('business')} disabled={loading} className="w-full px-6 py-3 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg hover:bg-[var(--terracotta)] flex items-center justify-center gap-2">
              <CreditCard className="w-5 h-5" />Upgrade to Business<ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
