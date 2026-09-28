import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function PaymentSettingsPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) loadConfig();
  }, [businessId]);

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/config?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) setConfig(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: any) => {
    try {
      await fetch(`${API_BASE}/api/v1/settings/config`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ businessId, data: { enabledFeatures: newConfig.enabledFeatures } })
      });
      setConfig(newConfig);
      alert('Payment settings saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving payment settings');
    }
  };

  const getPaymentConfig = () => {
    return config.enabledFeatures?.payment || { requireDeposit: false, depositPercent: 20, escrowThreshold: 1000, defaultDueDays: 14 };
  };

  const updatePaymentConfig = (key: string, value: any) => {
    const updated = { ...config };
    if (!updated.enabledFeatures) updated.enabledFeatures = {};
    if (!updated.enabledFeatures.payment) updated.enabledFeatures.payment = { requireDeposit: false, depositPercent: 20, escrowThreshold: 1000, defaultDueDays: 14 };
    updated.enabledFeatures.payment[key] = value;
    setConfig(updated);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  const payment = getPaymentConfig();

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Payment & Escrow</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Configure deposit and invoicing rules</p>
          </div>
          <Button variant="primary" onClick={() => saveConfig(config)}>Save Changes</Button>
        </div>

        <Card padding="lg" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--warm-ink)]">Require Deposit</div>
              <div className="text-sm text-[var(--soft-stone)]">Automatically require deposits on new jobs</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={payment.requireDeposit} onChange={e => updatePaymentConfig('requireDeposit', e.target.checked)} />
              <div className="w-11 h-6 bg-[var(--soft-stone)]/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--clay)]"></div>
            </label>
          </div>

          {payment.requireDeposit && (
            <div className="flex justify-between items-center bg-[var(--warm-sand)]/20 p-4 rounded-lg">
              <div className="text-sm font-semibold text-[var(--warm-ink)]">Deposit Percentage</div>
              <div className="flex items-center gap-2">
                <input type="number" className="w-20 px-3 py-2 border rounded-lg text-right" value={payment.depositPercent} onChange={e => updatePaymentConfig('depositPercent', parseInt(e.target.value) || 0)} min="1" max="100" />
                <span className="text-[var(--soft-stone)]">%</span>
              </div>
            </div>
          )}

          <hr className="border-[var(--warm-sand)]" />

          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--warm-ink)]">Escrow Threshold</div>
              <div className="text-sm text-[var(--soft-stone)]">Require escrow for jobs above this amount</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--soft-stone)]">$</span>
              <input type="number" className="w-24 px-3 py-2 border rounded-lg text-right" value={payment.escrowThreshold} onChange={e => updatePaymentConfig('escrowThreshold', parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <hr className="border-[var(--warm-sand)]" />

          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--warm-ink)]">Default Invoice Due</div>
              <div className="text-sm text-[var(--soft-stone)]">Days until invoice is due after creation</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className="w-20 px-3 py-2 border rounded-lg text-right" value={payment.defaultDueDays} onChange={e => updatePaymentConfig('defaultDueDays', parseInt(e.target.value) || 0)} />
              <span className="text-[var(--soft-stone)]">days</span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
