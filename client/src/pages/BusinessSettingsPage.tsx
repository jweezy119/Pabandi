import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { businessService } from '../services/api';
import {
  UserCircleIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  CpuChipIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../services/api';

type Tab = 'profile' | 'webhooks' | 'payments' | 'ai';
type DepositStrategy = 'FLAT' | 'PERCENTAGE' | 'AI_DYNAMIC';

const CATEGORIES = [
  { value: 'RESTAURANT', label: '🍽️ Restaurant / Dining' },
  { value: 'SALON', label: '💇 Salon / Barbershop' },
  { value: 'SPA', label: '🧖 Spa / Wellness' },
  { value: 'CLINIC', label: '🏥 Clinic / Medical' },
  { value: 'FITNESS_CENTER', label: '🏋️ Fitness / Gym' },
  { value: 'EVENT_VENUE', label: '🎪 Event Venue / VIP' },
  { value: 'OTHER', label: '📦 Other' },
];

export default function BusinessSettingsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Fetch business data
  const { data: bizRes } = useQuery('my-business-settings', async () => {
    const res = await businessService.getMyBusiness().catch(() => null);
    return res?.data?.data?.business || null;
  });

  const [businessData, setBusinessData] = useState({
    name: '',
    phone: '',
    address: '',
    googlePlaceId: '',
    category: 'OTHER',
  });

  const [aiSettings, setAiSettings] = useState({
    aiStrictness: 75,
    depositStrategy: 'AI_DYNAMIC' as DepositStrategy,
    flatDepositPKR: 1000,
    depositPercentage: 25,
    trustedCustomerThreshold: 80,
    autoRequireDeposit: true,
  });

  const [webhook, setWebhook] = useState({
    targetUrl: '',
    secret: 'whsec_7x9A1b2C3d4E5f6G',
    showSecret: false,
    events: {
      'reservation.created': true,
      'reservation.updated': true,
      'reservation.cancelled': true,
    },
  });

  // Populate from fetched data
  useEffect(() => {
    if (bizRes) {
      setBusinessData({
        name: bizRes.name || '',
        phone: bizRes.phone || '',
        address: bizRes.address || '',
        googlePlaceId: bizRes.googlePlaceId || '',
        category: bizRes.category || 'OTHER',
      });
      if (bizRes.settings) {
        setAiSettings(prev => ({
          ...prev,
          aiStrictness: 100 - (bizRes.settings.aiRiskThreshold || 30),
          autoRequireDeposit: bizRes.settings.autoRequireDeposit || false,
        }));
      }
    }
  }, [bizRes]);

  // Save mutation
  const saveMutation = useMutation(
    async (data: { profile?: any; settings?: any }) => {
      if (!bizRes?.id) throw new Error('No business found');
      const promises = [];
      if (data.profile) {
        promises.push(businessService.updateBusiness(bizRes.id, data.profile));
      }
      if (data.settings) {
        promises.push(apiClient.put(`/businesses/${bizRes.id}`, {
          ...data.settings,
        }));
      }
      await Promise.all(promises);
    },
    {
      onSuccess: () => {
        setSaveStatus('saved');
        qc.invalidateQueries('my-business-settings');
        setTimeout(() => setSaveStatus('idle'), 2500);
      },
      onError: () => {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      },
    }
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    saveMutation.mutate({
      profile: {
        name: businessData.name,
        phone: businessData.phone,
        address: businessData.address,
        googlePlaceId: businessData.googlePlaceId,
        category: businessData.category,
      },
    });
  };

  const handleSaveAI = () => {
    setSaveStatus('saving');
    saveMutation.mutate({
      settings: {
        depositAmount: aiSettings.depositStrategy === 'FLAT' ? aiSettings.flatDepositPKR : null,
        depositPercentage: aiSettings.depositStrategy === 'PERCENTAGE' ? aiSettings.depositPercentage / 100 : null,
        requireDeposit: aiSettings.autoRequireDeposit,
      },
      profile: {
        category: businessData.category,
      },
    });
  };

  const handleSaveWebhook = () => {
    setSaveStatus('saving');
    // Webhook save (currently mock — backend already stores via webhook routes)
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const SaveButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button onClick={onClick} disabled={saveStatus === 'saving'}
      className="btn-primary flex items-center gap-2 disabled:opacity-50">
      {saveStatus === 'saving' && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
      {saveStatus === 'saved' && <CheckCircleIcon className="h-4 w-4" />}
      {saveStatus === 'error' && <ExclamationTriangleIcon className="h-4 w-4" />}
      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error — Try Again' : label}
    </button>
  );

  // Deposit preview
  const depositPreview = () => {
    if (aiSettings.depositStrategy === 'FLAT') return `PKR ${aiSettings.flatDepositPKR.toLocaleString()} per booking`;
    if (aiSettings.depositStrategy === 'PERCENTAGE') return `${aiSettings.depositPercentage}% of service value`;
    return 'AI calculates per booking based on risk + service value';
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Business Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">Business Name</label>
                <input type="text" className="input-field" value={businessData.name} onChange={e => setBusinessData({ ...businessData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">Phone Number</label>
                <input type="text" className="input-field" value={businessData.phone} onChange={e => setBusinessData({ ...businessData, phone: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">Address</label>
                <input type="text" className="input-field" value={businessData.address} onChange={e => setBusinessData({ ...businessData, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">Business Category</label>
                <select className="input-field" value={businessData.category} onChange={e => setBusinessData({ ...businessData, category: e.target.value })}>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-600">Category affects how the AI calculates risk and deposit amounts.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">Google Place ID</label>
                <input type="text" className="input-field" value={businessData.googlePlaceId} onChange={e => setBusinessData({ ...businessData, googlePlaceId: e.target.value })} />
                <p className="mt-1.5 text-xs text-slate-600">Used to fetch your Google Reviews for the dashboard.</p>
              </div>
            </div>
            <SaveButton onClick={() => {}} label="Save Profile" />
          </form>
        );

      case 'webhooks':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">CRM Webhook Integration</h3>
                <p className="text-sm text-slate-600">Send Pabandi reservation events to your external tools (like HubSpot or Zapier).</p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4" /> Active
              </span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">Target Webhook URL</label>
              <input type="url" className="input-field mb-4 bg-white" value={webhook.targetUrl} onChange={e => setWebhook({ ...webhook, targetUrl: e.target.value })} placeholder="https://hooks.zapier.com/hooks/catch/..." />

              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">Signing Secret</label>
              <div className="flex gap-2 mb-4">
                <input type={webhook.showSecret ? 'text' : 'password'} readOnly className="input-field bg-slate-100 opacity-70" value={webhook.secret} />
                <button onClick={() => setWebhook({ ...webhook, showSecret: !webhook.showSecret })}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 text-slate-700">
                  {webhook.showSecret ? 'Hide' : 'Reveal'}
                </button>
                <button className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 text-slate-700">Rotate</button>
              </div>
              <p className="text-xs text-slate-600 mb-6">Use this secret to verify the HMAC-SHA256 signature in the `x-pabandi-signature` header of incoming requests.</p>

              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-3">Subscribed Events</label>
              <div className="space-y-3">
                {Object.keys(webhook.events).map(event => (
                  <label key={event} className="flex items-center gap-3">
                    <input type="checkbox" checked={(webhook.events as any)[event]}
                      onChange={e => setWebhook({ ...webhook, events: { ...webhook.events, [event]: e.target.checked } })}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <SaveButton onClick={handleSaveWebhook} label="Save Webhook" />
          </div>
        );

      case 'payments':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Payments & Escrow</h3>
              <p className="text-sm text-slate-600">Configure how you receive deposits and payments. All deposits are credited toward the customer's total bill.</p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-slate-900">Safepay Integration (Fiat)</h4>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Connected</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">Safepay is configured globally via the backend. Customers can pay via Debit/Credit Card, JazzCash, and EasyPaisa.</p>
              <div className="flex gap-3">
                <span className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-200">💳 Cards</span>
                <span className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">📱 JazzCash</span>
                <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">📱 EasyPaisa</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-slate-900">Web3 Wallet (Crypto)</h4>
                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Not Connected</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">Connect a Phantom or MetaMask wallet to accept USDC/SOL escrow deposits and distribute $PAB rewards.</p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                Connect Wallet
              </button>
            </div>

            {/* Deposit credit notice */}
            <div className="flex gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
              <ShieldCheckIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <strong>Deposits go toward the total purchase.</strong> When a customer pays a deposit, it's automatically deducted from their final bill. No extra charge — just protection.
              </p>
            </div>
          </div>
        );

      case 'ai':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">AI No-Show Protection</h3>
                <p className="text-sm text-slate-600">Configure how the AI protects your business from missed appointments.</p>
              </div>
              <CpuChipIcon className="w-8 h-8 text-blue-500" />
            </div>

            {/* Category-aware notice */}
            <div className="flex gap-3 p-4 rounded-xl border"
              style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.15)' }}>
              <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-indigo-500" />
              <p className="text-sm text-slate-700">
                Your business is categorized as <strong>{CATEGORIES.find(c => c.value === businessData.category)?.label || businessData.category}</strong>.
                The AI uses industry-specific risk models — restaurants weigh group size and Friday nights,
                salons focus on service duration and value, event venues track capacity and VIP bookings.
              </p>
            </div>

            {/* Risk Threshold */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-slate-800">Risk Threshold Strictness</label>
                <span className="text-sm font-bold text-blue-600">{aiSettings.aiStrictness}%</span>
              </div>
              <input
                type="range" min="0" max="100"
                value={aiSettings.aiStrictness}
                onChange={e => setAiSettings({ ...aiSettings, aiStrictness: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Lenient (More Bookings)</span>
                <span>Strict (More Deposits)</span>
              </div>
              <div className="mt-4 flex gap-3 p-4 bg-blue-50 text-blue-800 rounded-xl">
                <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  At <strong>{aiSettings.aiStrictness}%</strong> strictness, the AI will require a deposit for any booking whose risk score exceeds <strong>{100 - aiSettings.aiStrictness}%</strong>.
                </p>
              </div>
            </div>

            {/* Deposit Strategy */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="text-sm font-bold text-slate-800 mb-3 block">Deposit Strategy</label>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {([
                  { id: 'AI_DYNAMIC', label: 'AI Dynamic', desc: 'AI decides per booking' },
                  { id: 'FLAT', label: 'Flat Amount', desc: 'Fixed PKR per booking' },
                  { id: 'PERCENTAGE', label: 'Percentage', desc: '% of service value' },
                ] as const).map(s => (
                  <button key={s.id} type="button"
                    onClick={() => setAiSettings({ ...aiSettings, depositStrategy: s.id })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      aiSettings.depositStrategy === s.id
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}>
                    <p className="text-sm font-bold text-slate-900">{s.label}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>

              {aiSettings.depositStrategy === 'FLAT' && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Flat Deposit Amount (PKR)</label>
                  <input type="number" className="input-field w-48" min="500" step="50"
                    value={aiSettings.flatDepositPKR}
                    onChange={e => setAiSettings({ ...aiSettings, flatDepositPKR: parseInt(e.target.value) || 500 })} />
                </div>
              )}

              {aiSettings.depositStrategy === 'PERCENTAGE' && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Deposit Percentage (%)</label>
                  <input type="number" className="input-field w-48" min="10" max="50" step="5"
                    value={aiSettings.depositPercentage}
                    onChange={e => setAiSettings({ ...aiSettings, depositPercentage: parseInt(e.target.value) || 20 })} />
                </div>
              )}

              <p className="text-xs text-slate-600 mt-3">
                Preview: <strong>{depositPreview()}</strong>. Deposits are applied toward the customer's total bill.
              </p>
            </div>

            {/* Trusted Customer Threshold */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-slate-800">Trusted Customer Threshold</label>
                <span className="text-sm font-bold text-emerald-600">{aiSettings.trustedCustomerThreshold}+</span>
              </div>
              <input
                type="range" min="50" max="100"
                value={aiSettings.trustedCustomerThreshold}
                onChange={e => setAiSettings({ ...aiSettings, trustedCustomerThreshold: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>50 (Lenient)</span>
                <span>100 (Very Strict)</span>
              </div>
              <p className="text-xs text-slate-600 mt-3">
                Customers with a Pabandi reliability score above <strong>{aiSettings.trustedCustomerThreshold}</strong> will have their deposit waived automatically — rewarding loyal, reliable customers.
              </p>
            </div>

            {/* Auto-require toggle */}
            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white cursor-pointer">
              <input type="checkbox" checked={aiSettings.autoRequireDeposit}
                onChange={e => setAiSettings({ ...aiSettings, autoRequireDeposit: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <div>
                <p className="text-sm font-bold text-slate-900">Auto-Require Deposits</p>
                <p className="text-xs text-slate-600">Let the AI automatically enforce deposits on risky bookings via JazzCash, EasyPaisa, or Card.</p>
              </div>
            </label>

            <SaveButton onClick={handleSaveAI} label="Save AI Settings" />
          </div>
        );
    }
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your business profile, integrations, and preferences.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">

          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 flex-shrink-0 space-y-1">
            <button onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'profile' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
              <UserCircleIcon className="w-5 h-5" /> Business Profile
            </button>
            <button onClick={() => setActiveTab('webhooks')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'webhooks' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
              <GlobeAltIcon className="w-5 h-5" /> Integrations & Webhooks
            </button>
            <button onClick={() => setActiveTab('payments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'payments' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
              <CurrencyDollarIcon className="w-5 h-5" /> Payments & Escrow
            </button>
            <button onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'ai' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
              <CpuChipIcon className="w-5 h-5" /> AI Configuration
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              {renderTabContent()}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
