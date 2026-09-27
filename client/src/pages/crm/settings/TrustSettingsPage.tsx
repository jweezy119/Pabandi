import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';

const navItems = [
  { path: '/contact/settings', label: 'Back to Settings', icon: 'arrow_back' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function TrustSettingsPage() {
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
      alert('Trust settings saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving trust settings');
    }
  };

  const getTrustConfig = () => {
    return config.enabledFeatures?.trust || { minScoreForBooking: 50, requireEscrowBelowScore: 70, flagEscalationsAbove: 3 };
  };

  const updateTrustConfig = (key: string, value: any) => {
    const updated = { ...config };
    if (!updated.enabledFeatures) updated.enabledFeatures = {};
    if (!updated.enabledFeatures.trust) updated.enabledFeatures.trust = { minScoreForBooking: 50, requireEscrowBelowScore: 70, flagEscalationsAbove: 3 };
    updated.enabledFeatures.trust[key] = value;
    setConfig(updated);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  const trust = getTrustConfig();

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Trust Settings</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage trust thresholds and requirements</p>
          </div>
          <Button variant="primary" onClick={() => saveConfig(config)}>Save Changes</Button>
        </div>

        <Card padding="lg" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--warm-ink)]">Minimum Score for Booking</div>
              <div className="text-sm text-[var(--soft-stone)]">Clients below this score cannot book directly</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className="w-20 px-3 py-2 border rounded-lg text-center" value={trust.minScoreForBooking} onChange={e => updateTrustConfig('minScoreForBooking', parseInt(e.target.value) || 0)} min="0" max="100" />
            </div>
          </div>

          <hr className="border-[var(--warm-sand)]" />

          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--warm-ink)]">Require Escrow Below Score</div>
              <div className="text-sm text-[var(--soft-stone)]">Force escrow deposits for lower-score clients</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className="w-20 px-3 py-2 border rounded-lg text-center" value={trust.requireEscrowBelowScore} onChange={e => updateTrustConfig('requireEscrowBelowScore', parseInt(e.target.value) || 0)} min="0" max="100" />
            </div>
          </div>

          <hr className="border-[var(--warm-sand)]" />

          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--warm-ink)]">Flag Escalations</div>
              <div className="text-sm text-[var(--soft-stone)]">Alert if trust drops below threshold</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className="w-20 px-3 py-2 border rounded-lg text-center" value={trust.flagEscalationsAbove} onChange={e => updateTrustConfig('flagEscalationsAbove', parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
