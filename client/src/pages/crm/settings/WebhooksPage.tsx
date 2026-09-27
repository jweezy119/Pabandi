import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';

const navItems = [
  { path: '/contact/settings', label: 'Back to Settings', icon: 'arrow_back' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function WebhooksPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) loadWebhooks();
  }, [businessId]);

  const loadWebhooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/webhooks?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) setWebhooks(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const addWebhook = async () => {
    const url = prompt('Enter webhook target URL:');
    if (!url) return;
    try {
      await fetch(`${API_BASE}/api/v1/webhooks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ businessId, data: { targetUrl: url, subscribedEvents: ['*'] } })
      });
      loadWebhooks();
    } catch (err) {
      console.error(err);
      alert('Error adding webhook');
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await fetch(`${API_BASE}/api/v1/webhooks/${id}`, { method: 'DELETE', headers: getHeaders() });
      loadWebhooks();
    } catch (err) {
      console.error(err);
      alert('Error deleting webhook');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Webhooks</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Subscribe to system events</p>
          </div>
          <Button variant="primary" icon="add" onClick={addWebhook}>Add Endpoint</Button>
        </div>

        <Card padding="lg">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--warm-sand)]">
                <th className="pb-3 font-semibold text-[var(--soft-stone)]">URL</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)]">Events</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)]">Status</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--warm-sand)]/50">
              {webhooks.map((w) => (
                <tr key={w.id}>
                  <td className="py-4 font-medium text-[var(--warm-ink)]">{w.targetUrl}</td>
                  <td className="py-4 text-sm text-[var(--soft-stone)]">{w.subscribedEvents.join(', ')}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${w.isActive ? 'bg-[var(--sage)]/10 text-[var(--sage)]' : 'bg-[var(--rose)]/10 text-[var(--rose)]'}`}>
                      {w.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <Button variant="ghost" onClick={() => deleteWebhook(w.id)}>
                      <span className="material-symbols-outlined text-[var(--rose)]">delete</span>
                    </Button>
                  </td>
                </tr>
              ))}
              {webhooks.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--soft-stone)] italic">No webhooks configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
