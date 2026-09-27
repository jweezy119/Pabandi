import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';

const navItems = [
  { path: '/contact/settings', label: 'Back to Settings', icon: 'arrow_back' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function ApiKeysPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) loadKeys();
  }, [businessId]);

  const loadKeys = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/api-keys?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) setKeys(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/api-keys`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ businessId, data: { name: 'New API Key' } })
      });
      loadKeys();
    } catch (err) {
      console.error(err);
      alert('Error generating key');
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this key? It will immediately stop working.')) return;
    try {
      await fetch(`${API_BASE}/api/v1/api-keys/${id}`, { method: 'DELETE', headers: getHeaders() });
      loadKeys();
    } catch (err) {
      console.error(err);
      alert('Error revoking key');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>API Keys</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage access to your CRM via API</p>
          </div>
          <Button variant="primary" icon="add" onClick={generateKey}>Generate Key</Button>
        </div>

        <Card padding="lg">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--warm-sand)]">
                <th className="pb-3 font-semibold text-[var(--soft-stone)]">Name</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)]">Key Prefix</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)]">Status</th>
                <th className="pb-3 font-semibold text-[var(--soft-stone)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--warm-sand)]/50">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="py-4 font-medium text-[var(--warm-ink)]">{k.name}</td>
                  <td className="py-4 text-[var(--soft-stone)] font-mono text-sm">{k.key.substring(0, 10)}...</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${k.isActive ? 'bg-[var(--sage)]/10 text-[var(--sage)]' : 'bg-[var(--rose)]/10 text-[var(--rose)]'}`}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    {k.isActive && (
                      <Button variant="ghost" onClick={() => revokeKey(k.id)}>Revoke</Button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--soft-stone)] italic">No API keys generated yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
