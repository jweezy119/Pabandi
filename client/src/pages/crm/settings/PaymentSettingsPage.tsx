import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { getAuthToken } from '../../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function PaymentSettingsPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New method form
  const [railId, setRailId] = useState('solana');
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (businessId) loadMethods();
  }, [businessId]);

  const loadMethods = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/payment-methods?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMethods(data.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/v1/payment-methods`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ businessId, railId, target })
      });
      const data = await res.json();
      if (!data.success) {
        alert('Error: ' + data.error);
        return;
      }
      setTarget('');
      loadMethods();
    } catch (err) {
      alert('Error adding payment method');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/payment-methods/${id}/default`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ businessId })
      });
      loadMethods();
    } catch (err) {
      alert('Error setting default');
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`${API_BASE}/api/v1/payment-methods/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      loadMethods();
    } catch (err) {
      alert('Error removing payment method');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const placeholders: Record<string, string> = {
    solana: 'Solana Wallet Address',
    square: 'Square Payment Link URL',
    paypal: 'paypal.me/username',
    safepay: 'SafePay Link URL',
    bank: 'Bank details (e.g. Routing/Account or IBAN)',
  };

  const railLabels: Record<string, string> = {
    solana: 'Solana USDC',
    square: 'Square',
    paypal: 'PayPal',
    safepay: 'SafePay',
    bank: 'Bank Transfer'
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="clay-heading pb-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Payment Methods</h1>
          <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage how you receive payments</p>
        </div>

        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--warm-ink)]">Add a payment method</h2>
          <form onSubmit={handleAddMethod} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--warm-ink)]">Payment Rail</label>
              <select 
                value={railId} 
                onChange={e => setRailId(e.target.value)}
                className="px-3 py-2 border border-[var(--warm-sand)] rounded-lg bg-white"
              >
                <option value="solana">Solana USDC</option>
                <option value="square">Square</option>
                <option value="paypal">PayPal</option>
                <option value="safepay">SafePay</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--warm-ink)]">Target</label>
              {railId === 'bank' ? (
                <textarea 
                  value={target} 
                  onChange={e => setTarget(e.target.value)} 
                  placeholder={placeholders[railId]}
                  className="px-3 py-2 border border-[var(--warm-sand)] rounded-lg w-full h-24"
                  required
                />
              ) : (
                <input 
                  type="text" 
                  value={target} 
                  onChange={e => setTarget(e.target.value)} 
                  placeholder={placeholders[railId]}
                  className="px-3 py-2 border border-[var(--warm-sand)] rounded-lg w-full"
                  required
                />
              )}
            </div>
            <Button variant="primary" type="submit">Add Method</Button>
          </form>
        </Card>

        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--warm-ink)]">Your payment methods</h2>
          {methods.length === 0 ? (
            <div className="p-8 text-center bg-[#F5EFE6] rounded-xl text-[var(--soft-stone)]">
              Add your first payment method to receive payments
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map(m => (
                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-[var(--warm-sand)] rounded-xl gap-4">
                  <div>
                    <div className="font-bold flex items-center gap-2 text-[var(--warm-ink)]">
                      <span className="px-2 py-0.5 bg-[var(--clay)] text-white text-xs rounded">{railLabels[m.railId] || m.railId}</span>
                      {m.displayName}
                    </div>
                    <div className="text-sm text-[var(--soft-stone)] truncate max-w-sm mt-1">
                      {m.railId === 'bank' ? m.target.substring(0, 30) + '...' : m.target}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input 
                        type="radio" 
                        name="defaultMethod" 
                        checked={m.isDefault} 
                        onChange={() => handleSetDefault(m.id)}
                      />
                      Default
                    </label>
                    <Button variant="ghost" onClick={() => handleRemove(m.id)}>Remove</Button>
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
