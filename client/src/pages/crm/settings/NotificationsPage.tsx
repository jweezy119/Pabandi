import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { getAuthToken } from '../../../utils/authToken';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function NotificationsPage() {
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
      alert('Notification settings saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving notification settings');
    }
  };

  const getNotifs = () => {
    return config.enabledFeatures?.notifications || [
      { event: 'New Job Booked', email: true, sms: false, inApp: true },
      { event: 'Invoice Paid', email: true, sms: true, inApp: true },
      { event: 'Trust Score Drop', email: true, sms: false, inApp: true },
    ];
  };

  const updateNotif = (index: number, key: string, value: boolean) => {
    const notifs = [...getNotifs()];
    notifs[index][key] = value;
    const updated = { ...config };
    if (!updated.enabledFeatures) updated.enabledFeatures = {};
    updated.enabledFeatures.notifications = notifs;
    setConfig(updated);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  const notifs = getNotifs();

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Notification Preferences</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage how you receive alerts</p>
          </div>
          <Button variant="primary" onClick={() => saveConfig(config)}>Save Changes</Button>
        </div>

        <Card padding="lg" className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--warm-sand)]">
                <th className="pb-3 font-semibold text-[var(--soft-stone)]">Event</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)] text-center">Email</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)] text-center">SMS</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)] text-center">In-App</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--warm-sand)]/50">
              {notifs.map((n: any, idx: number) => (
                <tr key={n.event}>
                  <td className="py-4 font-medium text-[var(--warm-ink)]">{n.event}</td>
                  <td className="py-4 text-center">
                    <input type="checkbox" checked={n.email} onChange={e => updateNotif(idx, 'email', e.target.checked)} className="w-4 h-4 cursor-pointer" />
                  </td>
                  <td className="py-4 text-center">
                    <input type="checkbox" checked={n.sms} onChange={e => updateNotif(idx, 'sms', e.target.checked)} className="w-4 h-4 cursor-pointer" />
                  </td>
                  <td className="py-4 text-center">
                    <input type="checkbox" checked={n.inApp} onChange={e => updateNotif(idx, 'inApp', e.target.checked)} className="w-4 h-4 cursor-pointer" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
