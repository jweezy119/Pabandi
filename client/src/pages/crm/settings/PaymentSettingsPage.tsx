import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { DigitalDollarsSetupCard } from '../../../components/DigitalDollarsSetupCard';
import { getAuthToken } from '../../../utils/authToken';
import { useAuthStore } from '../../../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';
const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken() || ''}`,
});

const TRADITIONAL_RAILS: Record<
  string,
  { label: string; fieldLabel: string; placeholder: string }
> = {
  square: {
    label: 'Square (Credit/Debit Card — 2.9% + 30¢)',
    fieldLabel: 'Your Square payment link',
    placeholder: 'https://square.link/u/...',
  },
  bank: {
    label: 'US Bank Transfer (ACH / Wire)',
    fieldLabel: 'Your bank payout details',
    placeholder: 'Account holder name, bank name, ABA routing & account number',
  },
  paypal: {
    label: 'PayPal',
    fieldLabel: 'Your PayPal.me link',
    placeholder: 'paypal.me/yourbusiness',
  },
};

const RAIL_LABELS: Record<string, string> = {
  solana: 'Digital Dollars (Solana Pay / USDC — 0% Fee)',
  square: 'Square (Card)',
  paypal: 'PayPal',
  bank: 'Bank Transfer (ACH / Wire)',
};

export function PaymentSettingsPage() {
  const { user } = useAuthStore();
  const businessId =
    (user as any)?.business?.id ||
    (user as any)?.businessId ||
    localStorage.getItem('businessId') ||
    '';

  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTraditional, setSavingTraditional] = useState(false);

  // Traditional payment method form
  const [railId, setRailId] = useState('square');
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (businessId) {
      loadMethods();
    } else {
      setLoading(false);
    }
  }, [businessId]);

  const loadMethods = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/payment-methods?businessId=${businessId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMethods(data.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveSolanaAddress = async (solanaAddress: string) => {
    if (!businessId) {
      throw new Error('Finish setting up your business workspace first so we can save your payout method.');
    }
    const res = await fetch(`${API_BASE}/api/v1/payment-methods`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ businessId, railId: 'solana', target: solanaAddress }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Could not save digital dollar payout method');
    }
    toast.success('Self-custodial Solana Pay / USDC payouts enabled at 0% fee!');
    await loadMethods();
  };

  const handleAddTraditional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      toast.error('Please finish setting up your business first.');
      return;
    }
    setSavingTraditional(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/payment-methods`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ businessId, railId, target: target.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Could not save payment method');
        return;
      }
      toast.success(`${RAIL_LABELS[railId] || railId} added!`);
      setTarget('');
      await loadMethods();
    } catch {
      toast.error('Could not add payment method');
    } finally {
      setSavingTraditional(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/payment-methods/${id}/default`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ businessId }),
      });
      if (res.ok) {
        toast.success('Default payout method updated');
        loadMethods();
      }
    } catch {
      toast.error('Could not update default method');
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this payment method?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/payment-methods/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        toast.success('Payment method removed');
        loadMethods();
      }
    } catch {
      toast.error('Could not remove payment method');
    }
  };

  const existingSolana = methods.find((m) => m.railId === 'solana');
  const activeRail = TRADITIONAL_RAILS[railId] || TRADITIONAL_RAILS.bank;

  if (loading) return <div className="p-8">Loading payment settings…</div>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="clay-heading pb-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>
            Get Paid Your Way
          </h1>
          <p className="text-sm text-[var(--soft-stone)] mt-0.5">
            Connect your own self-custodial Phantom wallet for 0% fee USDC settlement, or offer Square &amp; ACH alongside it.
          </p>
        </div>

        {/* Zero-Friction Solana Digital Dollars Onboarding */}
        <DigitalDollarsSetupCard
          existingAddress={existingSolana?.target || null}
          onSaveAddress={saveSolanaAddress}
        />

        {/* Traditional Payment Methods */}
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--warm-ink)]">Other Ways to Get Paid</h2>
            <p className="text-xs text-[var(--soft-stone)]">
              Add a bank account or payment link for clients who prefer traditional checkout.
            </p>
          </div>
          <form onSubmit={handleAddTraditional} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--warm-ink)]">Payment Method</label>
              <select
                value={railId}
                onChange={(e) => setRailId(e.target.value)}
                className="px-3 py-2.5 border border-[var(--warm-sand)] rounded-xl bg-white text-sm text-[var(--warm-ink)]"
              >
                {Object.entries(TRADITIONAL_RAILS).map(([id, cfg]) => (
                  <option key={id} value={id}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--warm-ink)]">
                {activeRail.fieldLabel}
              </label>
              {railId === 'bank' ? (
                <textarea
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={activeRail.placeholder}
                  className="px-3 py-2.5 border border-[var(--warm-sand)] rounded-xl w-full h-24 text-sm text-[var(--warm-ink)]"
                  required
                />
              ) : (
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={activeRail.placeholder}
                  className="px-3 py-2.5 border border-[var(--warm-sand)] rounded-xl w-full text-sm text-[var(--warm-ink)]"
                  required
                />
              )}
            </div>
            <Button variant="primary" type="submit" disabled={savingTraditional}>
              {savingTraditional ? 'Saving…' : 'Save Payment Method'}
            </Button>
          </form>
        </Card>

        {/* Saved Payout Methods */}
        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--warm-ink)]">Your Active Payout Methods</h2>
          {methods.length === 0 ? (
            <div className="p-8 text-center bg-[#F5EFE6] rounded-xl text-[var(--soft-stone)] text-sm">
              No payout methods saved yet — turn on Instant Digital Dollars above or add a bank/card link.
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-[var(--warm-sand)] rounded-xl gap-4"
                >
                  <div>
                    <div className="font-bold flex items-center gap-2 text-[var(--warm-ink)] text-sm">
                      <span>{RAIL_LABELS[m.railId] || m.railId}</span>
                      {m.isDefault && (
                        <span className="px-2 py-0.5 text-[11px] rounded-full bg-[#E9F4EC] text-[#2D6A4F] font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--soft-stone)] font-mono mt-1 break-all">
                      {m.target}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!m.isDefault && (
                      <Button variant="ghost" onClick={() => handleSetDefault(m.id)}>
                        Set Default
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => handleRemove(m.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default PaymentSettingsPage;
