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
  BellIcon,
  VideoCameraIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../services/api';
import { Surface, Button, Badge, tokens } from '../design-system';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'notifications' | 'webhooks' | 'payments' | 'ai' | 'live-selling' | 'api-keys';
type DepositStrategy = 'FLAT' | 'PERCENTAGE' | 'AI_DYNAMIC';

type TapLinkGeneratorProps = {
  sellerId?: string;
};

const TapLinkGenerator = ({ sellerId }: TapLinkGeneratorProps) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USDC');

  const publicLink = sellerId
    ? `${window.location.origin}/t/pay/${sellerId}?amount=${encodeURIComponent(amount || '0')}&currency=${currency}`
    : '';

  const copyLink = async () => {
    if (!publicLink) return;
    await navigator.clipboard.writeText(publicLink);
  };

  return (
    <Surface className="space-y-4">
      <div>
        <h4 className="font-headline text-base font-bold text-white">Merchant Tap Link</h4>
        <p className="mt-1 text-xs text-white/70">Generate a shareable checkout link customers can use to pay directly on Pabandi through this business.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Amount</label>
          <input type="number" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" min="0" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Currency</label>
          <input type="text" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={currency} onChange={e => setCurrency(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={copyLink} disabled={!sellerId} variant="outline" className="w-full">Copy Public Link</Button>
        </div>
      </div>

      {publicLink ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1">
          <p className="text-xs font-bold text-white/70">Public checkout link</p>
          <p className="break-all text-xs font-mono text-white">{publicLink}</p>
        </div>
      ) : (
        <p className="text-xs text-white/70">Add and save a business record to enable your merchant Tap link.</p>
      )}
    </Surface>
  );
};

const CATEGORIES = [
  { value: 'ECOMMERCE', label: '🛍️ E-Commerce Platform' },
  { value: 'MARKETPLACE', label: '🤝 Online Marketplace' },
  { value: 'LIVE_SELLER', label: '🎥 Live Seller' },
  { value: 'RESTAURANT', label: '🍽️ Restaurant / Dining' },
  { value: 'SALON', label: '💇 Salon / Barbershop' },
  { value: 'SPA', label: '🧖 Spa / Wellness' },
  { value: 'CLINIC', label: '🏥 Clinic / Medical' },
  { value: 'HOSPITAL', label: '🏥 Hospital / Healthcare' },
  { value: 'FITNESS_CENTER', label: '🏋️ Fitness / Gym' },
  { value: 'EVENT_VENUE', label: '🎪 Event Venue / VIP' },
  { value: 'FREELANCE', label: '💻 Freelance / Gig Worker' },
  { value: 'OTHER', label: '📦 Other' },
];

export default function BusinessSettingsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
    reliabilityScore: 100,
  });

  const [aiSettings, setAiSettings] = useState({
    aiStrictness: 70,
    depositStrategy: 'PERCENTAGE' as DepositStrategy,
    flatDeposit$: 0,
    depositPercentage: 30,
    trustedCustomerThreshold: 80,
    autoRequireDeposit: false,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    sendWhatsAppReminders: true,
    notifyOwnerOnNewBooking: true,
    whatsappNumber: '',
    requestFeedbackAfterBooking: true,
  });

  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
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

  useEffect(() => {
    if (activeTab === 'api-keys' && bizRes?.id) {
      (async () => {
        try {
          const res = await apiClient.get(`/business/${bizRes.id}/api-keys`);
          if (res.data.success) setApiKeys(res.data.data.apiKeys);
        } catch (err) { console.error(err); }
      })();
    }
  }, [activeTab, bizRes?.id]);

  const handleConnectStripe = async () => {
    if (!bizRes?.id) return;
    try {
      const res = await apiClient.post(`/business/${bizRes.id}/stripe-connect`);
      if (res.data.success && res.data.data.url) {
        window.location.href = res.data.data.url;
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to connect to Stripe');
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(null);
    setGeneratedKey(null);
    if (!newKeyName.trim() || !bizRes?.id) return;
    try {
      const res = await apiClient.post(`/business/${bizRes.id}/api-keys`, { name: newKeyName });
      if (res.data.success) {
        setGeneratedKey(res.data.data.apiKey);
        setNewKeyName('');
        const keys = await apiClient.get(`/business/${bizRes.id}/api-keys`);
        if (keys.data.success) setApiKeys(keys.data.data.apiKeys);
      }
    } catch (err: any) {
      setKeyError(err.response?.data?.message || 'Failed to generate key');
    }
  };

  useEffect(() => {
    if (bizRes) {
      setBusinessData({
        name: bizRes.name || '',
        phone: bizRes.phone || '',
        address: bizRes.address || '',
        googlePlaceId: bizRes.googlePlaceId || '',
        category: bizRes.category || 'OTHER',
        reliabilityScore: bizRes.reliabilityScore ?? 100,
      });
      if (bizRes.settings) {
        setNotificationSettings({
          sendWhatsAppReminders: bizRes.settings.sendWhatsAppReminders ?? true,
          notifyOwnerOnNewBooking: bizRes.settings.notifyOwnerOnNewBooking ?? true,
          whatsappNumber: bizRes.settings.whatsappNumber || '',
          requestFeedbackAfterBooking: bizRes.settings.requestFeedbackAfterBooking ?? true,
        });
        setAiSettings(prev => ({
          ...prev,
          aiStrictness: 100 - (bizRes.settings.aiRiskThreshold || 30),
          autoRequireDeposit: bizRes.settings.autoRequireDeposit || false,
        }));
      }
    }
  }, [bizRes]);

  const saveMutation = useMutation(
    async (data: { profile?: any; settings?: any }) => {
      if (!bizRes?.id) throw new Error('No business found');
      const promises = [];
      if (data.profile) promises.push(businessService.updateBusiness(bizRes.id, data.profile));
      if (data.settings) promises.push(apiClient.put(`/businesses/${bizRes.id}`, data.settings));
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
        reliabilityScore: Number(businessData.reliabilityScore),
      },
    });
  };

  const handleSaveAI = () => {
    setSaveStatus('saving');
    saveMutation.mutate({
      settings: {
        depositAmount: aiSettings.depositStrategy === 'FLAT' ? aiSettings.flatDeposit$ : null,
        depositPercentage: aiSettings.depositStrategy === 'PERCENTAGE' ? aiSettings.depositPercentage / 100 : null,
        requireDeposit: aiSettings.autoRequireDeposit,
      },
      profile: { category: businessData.category },
    });
  };

  const handleSaveNotifications = () => {
    setSaveStatus('saving');
    saveMutation.mutate({ settings: { ...notificationSettings } });
  };

  const handleSaveWebhook = () => {
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 400);
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const SaveButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <Button onClick={onClick} disabled={saveStatus === 'saving'} variant="default" className="w-full items-center gap-2">
      {saveStatus === 'saving' && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error — Try Again' : label}
    </Button>
  );

  const depositPreview = () => {
    if (aiSettings.depositStrategy === 'FLAT') return `$ ${aiSettings.flatDeposit$.toLocaleString()} per booking`;
    if (aiSettings.depositStrategy === 'PERCENTAGE') return `${aiSettings.depositPercentage}% of service value`;
    return 'AI calculates per booking based on risk + service value';
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <Surface>
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <h3 className="text-lg font-bold text-white">Business Profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Business Name</label>
                  <input type="text" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={businessData.name} onChange={e => setBusinessData({ ...businessData, name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Phone Number</label>
                  <input type="text" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={businessData.phone} onChange={e => setBusinessData({ ...businessData, phone: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Address</label>
                  <input type="text" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={businessData.address} onChange={e => setBusinessData({ ...businessData, address: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Business Category</label>
                  <select className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={businessData.category} onChange={e => setBusinessData({ ...businessData, category: e.target.value })}>
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-white/70">Category affects how the AI calculates risk and deposit amounts.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Google Place ID</label>
                  <input type="text" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={businessData.googlePlaceId} onChange={e => setBusinessData({ ...businessData, googlePlaceId: e.target.value })} />
                  <p className="mt-1.5 text-xs text-white/70">Used to fetch your Google Reviews for the dashboard.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Reliability Score (Self-Market)</label>
                  <input type="number" min="0" max="100" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={businessData.reliabilityScore} onChange={e => setBusinessData({ ...businessData, reliabilityScore: Number(e.target.value) })} />
                  <p className="mt-1.5 text-xs text-white/70">Set your public reliability score (0-100) to market yourself better.</p>
                </div>
              </div>
              <SaveButton onClick={() => {}} label="Save Profile" />
            </form>
          </Surface>
        );

      case 'notifications':
        return (
          <Surface>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">WhatsApp Automations</h3>
                <p className="text-sm text-white/70">Configure automated WhatsApp messages for your customers and yourself.</p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer">
                  <input type="checkbox" checked={notificationSettings.sendWhatsAppReminders}
                    onChange={e => setNotificationSettings({ ...notificationSettings, sendWhatsAppReminders: e.target.checked })}
                    className="h-4 w-4 rounded border-white/25 text-indigo-500 focus:ring-indigo-500" />
                  <div>
                    <p className="text-sm font-bold text-white">Customer Reminders & Confirmations</p>
                    <p className="text-xs text-white/70">Send WhatsApp messages to customers when they book, and 24 hours before their reservation.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer">
                  <input type="checkbox" checked={notificationSettings.requestFeedbackAfterBooking}
                    onChange={e => setNotificationSettings({ ...notificationSettings, requestFeedbackAfterBooking: e.target.checked })}
                    className="h-4 w-4 rounded border-white/25 text-indigo-500 focus:ring-indigo-500" />
                  <div>
                    <p className="text-sm font-bold text-white">Post-Booking Review Requests</p>
                    <p className="text-xs text-white/70">Automatically ask customers for feedback on WhatsApp after their reservation is marked complete.</p>
                  </div>
                </label>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h4 className="mb-4 font-bold text-white">Business Owner Notifications</h4>
                
                <label className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer">
                  <input type="checkbox" checked={notificationSettings.notifyOwnerOnNewBooking}
                    onChange={e => setNotificationSettings({ ...notificationSettings, notifyOwnerOnNewBooking: e.target.checked })}
                    className="h-4 w-4 rounded border-white/25 text-indigo-500 focus:ring-indigo-500" />
                  <div>
                    <p className="text-sm font-bold text-white">Notify me on new bookings</p>
                    <p className="text-xs text-white/70">Get a WhatsApp ping immediately whenever a new reservation is created.</p>
                  </div>
                </label>

                {notificationSettings.notifyOwnerOnNewBooking && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Your WhatsApp Number</label>
                    <input type="text" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" placeholder="+923****4567"
                      value={notificationSettings.whatsappNumber}
                      onChange={e => setNotificationSettings({ ...notificationSettings, whatsappNumber: e.target.value })} />
                    <p className="mt-1.5 text-xs text-white/70">Include country code (e.g., +92).</p>
                  </div>
                )}
              </div>

              <SaveButton onClick={handleSaveNotifications} label="Save Notifications" />
            </div>
          </Surface>
        );

      case 'webhooks':
        return (
          <Surface>
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">CRM Webhook Integration</h3>
                  <p className="text-sm text-white/70">Send Pabandi reservation events to your external tools (like HubSpot or Zapier).</p>
                </div>
                <Badge tone="success" className="shrink-0"><span className="flex items-center gap-1"><CheckCircleIcon className="h-4 w-4" /> Active</span></Badge>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Target Webhook URL</label>
                <input type="url" className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={webhook.targetUrl} onChange={e => setWebhook({ ...webhook, targetUrl: e.target.value })} placeholder="https://hooks.zapier.com/hooks/catch/..." />
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Signing Secret</label>
                <div className="mb-4 flex gap-2">
                  <input type={webhook.showSecret ? 'text' : 'password'} readOnly className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white opacity-70" value={webhook.secret} />
                  <Button variant="outline" onClick={() => setWebhook({ ...webhook, showSecret: !webhook.showSecret })}>{webhook.showSecret ? 'Hide' : 'Reveal'}</Button>
                  <Button variant="outline" onClick={() => {}}>Rotate</Button>
                </div>
                <p className="mb-6 text-xs text-white/70">Use this secret to verify the HMAC-SHA256 signature in the `x-pabandi-signature` header of incoming requests.</p>

                <label className="mb-3 block text-xs font-bold uppercase tracking-wide text-white/70">Subscribed Events</label>
                <div className="space-y-3">
                  {Object.keys(webhook.events).map(event => (
                    <label key={event} className="flex items-center gap-3">
                      <input type="checkbox" checked={(webhook.events as any)[event]}
                        onChange={e => setWebhook({ ...webhook, events: { ...webhook.events, [event]: e.target.checked } })}
                        className="h-4 w-4 rounded border-white/25 text-indigo-500 focus:ring-indigo-500" />
                      <span className="font-mono text-sm text-white">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <SaveButton onClick={handleSaveWebhook} label="Save Webhook" />
            </div>
          </Surface>
        );

      case 'payments':
        return (
          <Surface>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">Payments & Escrow</h3>
                <p className="text-sm text-white/70">Configure how you receive deposits and payments. All deposits are credited toward the customer's total bill.</p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="font-bold text-white">Stripe Checkout & Connect</h4>
                  {bizRes?.stripeAccountId ? (
                     <Badge tone="success">Connected</Badge>
                  ) : (
                     <Button variant="default" onClick={handleConnectStripe}>Connect Stripe</Button>
                  )}
                </div>
                <p className="mt-2 text-sm text-white/70">Connect your Stripe account to automatically route customer payments to your bank account (minus the Pabandi fee).</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="success">💳 Cards</Badge>
                  <Badge tone="success">🍎 Apple Pay</Badge>
                  <Badge tone="success">🤖 Google Pay</Badge>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="font-bold text-white">◎ Solana · $PAB Payouts</h4>
                  <Badge tone="info">Phantom</Badge>
                </div>
                <p className="mt-2 text-sm text-white/70">Connect Phantom to receive business $PAB rewards on Solana. You earn tokens for honored bookings and no-show protection.</p>
                <a href="/wallet" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-sm">Connect Phantom Wallet →</a>
              </div>

              <TapLinkGenerator sellerId={bizRes?.id} />

              <div className="flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <ShieldCheckIcon className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400" />
                <p className="text-sm text-white/90">
                  <strong>Deposits go toward the total purchase.</strong> When a customer pays a deposit, it's automatically deducted from their final bill. No extra charge — just protection.
                </p>
              </div>
            </div>
          </Surface>
        );

      case 'ai':
        return (
          <Surface>
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">AI No-Show Protection</h3>
                  <p className="text-sm text-white/70">Configure how the AI protects your business from missed appointments.</p>
                </div>
                <CpuChipIcon className="h-8 w-8 text-indigo-400" />
              </div>

              <div className="flex gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                <InformationCircleIcon className="h-5 w-5 shrink-0 mt-0.5 text-indigo-300" />
                <p className="text-sm text-white/80">
                  Your business is categorized as <strong>{CATEGORIES.find(c => c.value === businessData.category)?.label || businessData.category}</strong>.
                  The AI uses industry-specific risk models — e-commerce weighs COD rejections, restaurants weigh group size,
                  salons focus on service duration and value, event venues track capacity and VIP bookings.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-bold text-white">Risk Threshold Strictness</label>
                  <span className="text-sm font-bold text-indigo-400">{aiSettings.aiStrictness}%</span>
                </div>
                <input type="range" min="0" max="100" value={aiSettings.aiStrictness}
                  onChange={e => setAiSettings({ ...aiSettings, aiStrictness: parseInt(e.target.value) })}
                  className="h-2 w-full rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                <div className="mt-2 flex justify-between text-xs text-white/50">
                  <span>Lenient (More Bookings)</span>
                  <span>Strict (More Deposits)</span>
                </div>
                <div className="mt-4 flex gap-3 rounded-xl bg-indigo-500/10 p-4 text-indigo-300">
                  <InformationCircleIcon className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm">
                    At <strong>{aiSettings.aiStrictness}%</strong> strictness, the AI will require a deposit for any booking whose risk score exceeds <strong>{100 - aiSettings.aiStrictness}%</strong>.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <label className="mb-3 block text-sm font-bold text-white">Deposit Strategy</label>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {([
                    { id: 'AI_DYNAMIC', label: 'AI Dynamic', desc: 'AI decides per booking' },
                    { id: 'FLAT', label: 'Flat Amount', desc: 'Fixed $ per booking' },
                    { id: 'PERCENTAGE', label: 'Percentage', desc: '% of service value' },
                  ] as const).map(s => (
                    <button key={s.id} type="button"
                      onClick={() => setAiSettings({ ...aiSettings, depositStrategy: s.id })}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        aiSettings.depositStrategy === s.id
                          ? 'border-indigo-500/60 bg-indigo-500/15 ring-1 ring-indigo-500'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}>
                      <p className="text-sm font-bold text-white">{s.label}</p>
                      <p className="mt-0.5 text-[10px] text-white/70">{s.desc}</p>
                    </button>
                  ))}
                </div>

                {aiSettings.depositStrategy === 'FLAT' && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-bold text-white/70">Flat Deposit Amount ($)</label>
                    <input type="number" className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" min="500" step="50"
                      value={aiSettings.flatDeposit$}
                      onChange={e => setAiSettings({ ...aiSettings, flatDeposit$: parseInt(e.target.value) || 500 })} />
                  </div>
                )}

                {aiSettings.depositStrategy === 'PERCENTAGE' && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-bold text-white/70">Deposit Percentage (%)</label>
                    <input type="number" className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" min="10" max="50" step="5"
                      value={aiSettings.depositPercentage}
                      onChange={e => setAiSettings({ ...aiSettings, depositPercentage: parseInt(e.target.value) || 20 })} />
                  </div>
                )}

                <p className="mt-3 text-xs text-white/70">
                  Preview: <strong className="text-white">{depositPreview()}</strong>. Deposits are applied toward the customer's total bill.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-bold text-white">Trusted Customer Threshold</label>
                  <span className="text-sm font-bold text-emerald-400">{aiSettings.trustedCustomerThreshold}+</span>
                </div>
                <input type="range" min="50" max="100" value={aiSettings.trustedCustomerThreshold}
                  onChange={e => setAiSettings({ ...aiSettings, trustedCustomerThreshold: parseInt(e.target.value) })}
                  className="h-2 w-full rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                <div className="mt-2 flex justify-between text-xs text-white/50">
                  <span>50 (Lenient)</span>
                  <span>100 (Very Strict)</span>
                </div>
                <p className="mt-3 text-xs text-white/70">
                  Customers with a Pabandi reliability score above <strong>{aiSettings.trustedCustomerThreshold}</strong> will have their deposit waived automatically — rewarding loyal, reliable customers.
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <input type="checkbox" checked={aiSettings.autoRequireDeposit}
                  onChange={e => setAiSettings({ ...aiSettings, autoRequireDeposit: e.target.checked })}
                  className="h-4 w-4 rounded border-white/25 text-indigo-500 focus:ring-indigo-500" />
                <div>
                  <p className="text-sm font-bold text-white">Auto-Require Deposits</p>
                  <p className="text-xs text-white/70">Let the AI automatically enforce deposits on risky bookings via Card, PayPal, Apple Pay, or escrow.</p>
                </div>
              </label>

              <SaveButton onClick={handleSaveAI} label="Save AI Settings" />
            </div>
          </Surface>
        );

      case 'live-selling':
        return (
          <Surface>
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Live Selling</h3>
                  <p className="text-sm text-white/70">Connect your show platform, publish a schedule, and share your universal seller link.</p>
                </div>
                <VideoCameraIcon className="h-7 w-7 text-indigo-400" />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
                <p className="text-xs text-white/70">Category check</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">
                    Business category: {CATEGORIES.find(c => c.value === businessData.category)?.label || businessData.category}
                  </p>
                  {businessData.category !== 'LIVE_SELLER' ? (
                    <button type="button" onClick={() => setActiveTab('profile')} className="text-xs font-semibold text-indigo-400">Update in Profile</button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-400">Live-seller ready</span>
                  )}
                </div>
                <p className="text-xs text-white/70">Set category to <span className="font-mono text-white">LIVE_SELLER</span> in Business Profile so buyers find you from the live-selling vertical.</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h4 className="mb-3 font-bold text-white">Connect platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Connect TikTok', href: '/integrations/livesell/connect/tiktok-live', bg: 'bg-[#ff0050] text-white' },
                    { label: 'Connect YouTube', href: '/integrations/livesell/connect/youtube-shopping', bg: 'bg-red-600 text-white' },
                    { label: 'Connect Shopify', href: '/integrations/livesell/connect/shopify-live', bg: 'bg-[#95BF47] text-black' },
                    { label: 'Connect Whatnot', href: '/integrations/livesell/connect/whatnot-live', bg: 'bg-yellow-400 text-black' },
                    { label: 'Connect Instagram', href: '/integrations/livesell/connect/instagram-live', bg: 'bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white' },
                    { label: 'Connect Amazon', href: '/integrations/livesell/connect/amazon-live', bg: 'bg-[#ff9900] text-black' },
                    { label: 'Custom Web', href: '/integrations/livesell/connect/custom-web', bg: 'bg-slate-700 text-white' },
                  ].map(p => (
                    <a key={p.label} href={p.href} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 ${p.bg}`}>{p.label}</a>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-[#0064d2]/20 bg-[#0064d2]/10 p-4">
                  <h5 className="mb-1 flex items-center gap-2 font-bold text-white"><span className="text-indigo-400">eBay</span> Integration</h5>
                  <p className="mb-3 text-xs leading-relaxed text-white/80">
                    eBay restricts off-platform checkout in buyer-seller messaging. Treat eBay as a traffic source. Add this to your listings: <strong>"Escrow-backed checkout available — message 'PABANDI' for link"</strong>. When buyers DM you, send your Pabandi checkout link.
                  </p>
                  <button type="button" onClick={() => {}} className="rounded-lg bg-[#0064d2] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity">Enable eBay Mode</button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h4 className="mb-1 font-bold text-white">Your seller link</h4>
                <p className="mb-3 text-xs text-white/70">Share this universal booking link anywhere: TikTok bio, YouTube description, WhatsApp, or SMS.</p>
                <div className="flex gap-2">
                  <input readOnly className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-white opacity-90" value={`${window.location.origin}/s/${bizRes?.id || ''}`} />
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/s/${bizRes?.id || ''}`)}>Copy</Button>
                </div>
              </div>

              <SaveButton onClick={() => setSaveStatus('saved')} label="Save Live Selling Status" />
            </div>
          </Surface>
        );

      case 'api-keys':
        return (
          <Surface>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">Developer API Keys</h3>
                <p className="mt-1 text-sm text-white/70">Generate API keys to interact with the Pabandi Trust & Escrow infrastructure programmatically.</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h4 className="font-semibold text-white">Create New Key</h4>
                <form onSubmit={handleGenerateKey} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">Key Name</label>
                    <input type="text" required className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" placeholder="e.g. Production Live Seller Backend" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={!newKeyName.trim()} variant="default">Generate</Button>
                </form>

                {keyError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                    {keyError}
                  </div>
                )}

                {generatedKey && (
                  <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex gap-2 text-emerald-400">
                      <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <h5 className="text-sm font-semibold">Key Generated Successfully</h5>
                        <p className="mt-1 text-xs text-emerald-300">Please copy this key now. You will not be able to see it again.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-black/30 p-3">
                      <code className="flex-1 overflow-hidden text-ellipsis text-sm font-mono text-emerald-300">{generatedKey}</code>
                      <Button variant="outline" onClick={() => navigator.clipboard.writeText(generatedKey)}>Copy</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-white">Active Keys</h4>
                {apiKeys.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-white/70">No API keys generated yet.</div>
                ) : (
                  <div className="grid gap-3">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-white">
                            {k.name}
                            {!k.isActive && <Badge tone="danger" className="text-[10px] uppercase">Revoked</Badge>}
                          </div>
                          <div className="mt-1 text-xs text-white/70 font-mono">
                            Tier: {k.tier} • Usage: {k.callsUsed}/{k.callsLimit} • Created: {new Date(k.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Surface>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pb-24 font-body" style={{ background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-headline text-3xl font-black text-white">Settings</h1>
          <p className="mt-1 text-sm text-white/70">Manage your business profile, integrations, and preferences.</p>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <div className="w-full space-y-1 md:w-64 md:shrink-0">
            {([
              { id: 'profile', label: 'Business Profile', icon: UserCircleIcon },
              { id: 'notifications', label: 'Notifications & WhatsApp', icon: BellIcon },
              { id: 'webhooks', label: 'Integrations & Webhooks', icon: GlobeAltIcon },
              { id: 'payments', label: 'Payments & Escrow', icon: CurrencyDollarIcon },
              { id: 'ai', label: 'AI Configuration', icon: CpuChipIcon },
              { id: 'live-selling', label: 'Live Selling', icon: VideoCameraIcon },
              { id: 'api-keys', label: 'Developer API Keys', icon: CommandLineIcon },
            ] as const).map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${activeTab === item.id ? 'bg-white/10 text-indigo-300 shadow-sm' : 'text-white/70 hover:bg-white/10'}`}>
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 shadow-sm backdrop-blur-xl">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
