import { useState, useEffect } from 'react';
import { CreditCard, Zap, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function BillingSettings() {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState({ clients: 12, invoices: 45 });
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
      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.url) {
        window.location.href = data.url;
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">Billing</h2>
        <p className="text-sm text-[var(--soft-stone)]">Manage your subscription and usage</p>
      </div>

      <div className="p-6 bg-white rounded-xl border border-[rgba(191,179,163,0.3)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--warm-ink)] capitalize">{tier} Plan</h3>
            <p className="text-sm text-[var(--soft-stone)]">
              {tier === 'free' ? '$0/month' : tier === 'pro' ? '$49/month' : '$149/month'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-[var(--warm-ink)]">Clients used</span>
              <span className="text-[var(--soft-stone)]">{usage.clients}/50</span>
            </div>
            <div className="w-full bg-[var(--warm-sand)] rounded-full h-2">
              <div className="bg-[var(--clay)] h-2 rounded-full" style={{ width: '24%' }} />
            </div>
          </div>
        </div>

        {tier === 'free' && (
          <button
            onClick={() => handleUpgrade('pro')}
            disabled={loading}
            className="mt-4 px-6 py-2 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg hover:bg-[var(--terracotta)] transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Upgrade to PRO
          </button>
        )}
      </div>

      {tier === 'free' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 bg-white rounded-xl border border-[rgba(191,179,163,0.3)]">
            <h4 className="font-bold text-[var(--warm-ink)] mb-2">PRO - $49/mo</h4>
            <ul className="space-y-1 mb-3 text-sm">
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" />Unlimited clients</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" />SMS reminders</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" />Analytics</li>
            </ul>
            <button onClick={() => handleUpgrade('pro')} className="w-full px-4 py-2 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg text-sm">Upgrade to PRO</button>
          </div>
          <div className="p-5 bg-white rounded-xl border border-[rgba(191,179,163,0.3)]">
            <h4 className="font-bold text-[var(--warm-ink)] mb-2">Business - $149/mo</h4>
            <ul className="space-y-1 mb-3 text-sm">
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" />Everything in PRO</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" />M2M API Access</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" />Webhooks</li>
            </ul>
            <button onClick={() => handleUpgrade('business')} className="w-full px-4 py-2 bg-[var(--clay)] text-[var(--warm-ink)] rounded-lg text-sm">Upgrade to Business</button>
          </div>
        </div>
      )}
    </div>
  );
}
