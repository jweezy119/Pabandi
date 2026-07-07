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
  LockClosedIcon,
  KeyIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../services/api';
import BusinessServicesManager from '../components/BusinessServicesManager';

type Tab = 'profile' | 'notifications' | 'webhooks' | 'payments' | 'ai' | 'e2ee' | 'services';
type DepositStrategy = 'FLAT' | 'PERCENTAGE' | 'AI_DYNAMIC';

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
  const [e2eeStatus, setE2eeStatus] = useState({ enabled: false, hasPublicKey: false });

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [exportedSecret, setExportedSecret] = useState('');
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch business data
  const { data: bizRes } = useQuery('my-business-settings', async () => {
    const res = await businessService.getMyBusiness().catch(() => null);
    return res?.data?.data?.business || null;
  });

  // Fetch wallet data
  const { data: walletData } = useQuery('my-wallet-balances', async () => {
    const res = await apiClient.get('/wallet/balances').catch(() => null);
    return res?.data?.data || null;
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
    aiStrictness: 75,
    depositStrategy: 'AI_DYNAMIC' as DepositStrategy,
    flatDepositPKR: 1000,
    depositPercentage: 25,
    trustedCustomerThreshold: 80,
    autoRequireDeposit: true,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    sendWhatsAppReminders: true,
    notifyOwnerOnNewBooking: true,
    whatsappNumber: '',
    requestFeedbackAfterBooking: true,
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
        setE2eeStatus({
          enabled: bizRes.settings.isE2eeEnabled || false,
          hasPublicKey: !!bizRes.settings.e2eePublicKey
        });
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
        reliabilityScore: Number(businessData.reliabilityScore),
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

  const handleSaveNotifications = () => {
    setSaveStatus('saving');
    saveMutation.mutate({
      settings: {
        ...notificationSettings,
      },
    });
  };

  const handleSaveWebhook = () => {
    setSaveStatus('saving');
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleExportSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);
    setExportError('');
    try {
      const res = await apiClient.post('/wallet/export-secret', { password });
      setExportedSecret(res.data.data.secretKey);
    } catch (err: any) {
      setExportError(err.response?.data?.error || 'Failed to export secret key');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGeneratePKI = async () => {
    try {
      setSaveStatus('saving');
      // Generate RSA Keypair
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['encrypt', 'decrypt']
      );

      // Export Public Key to SPKI Base64
      const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      const spkiBase64 = btoa(String.fromCharCode(...new Uint8Array(spkiBuffer)));

      // Export Private Key to PKCS8 Base64 (for download)
      const pkcs8Buffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      const pkcs8Base64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8Buffer)));

      const pemHeader = '-----BEGIN PRIVATE KEY-----\\n';
      const pemFooter = '\\n-----END PRIVATE KEY-----';
      const pem = pemHeader + pkcs8Base64.match(/.{1,64}/g)?.join('\\n') + pemFooter;

      // Trigger download
      const blob = new Blob([pem], { type: 'application/x-pem-file' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'pabandi-private-key.pem';
      link.click();

      // Save public key to server
      await apiClient.put(`/businesses/${bizRes.id}`, {
        isE2eeEnabled: true,
        e2eePublicKey: spkiBase64
      });

      setE2eeStatus({ enabled: true, hasPublicKey: true });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    }
  };

  const toggleE2ee = async (enabled: boolean) => {
    try {
      await apiClient.put(`/businesses/${bizRes.id}`, { isE2eeEnabled: enabled });
      setE2eeStatus(prev => ({ ...prev, enabled }));
    } catch (err) {
      console.error(err);
    }
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
    if (activeTab === 'services' && bizRes?.id) {
      return (
        <div className="animate-fade-in">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white">Services Catalog</h2>
            <p className="text-gray-400 mt-1">Manage the specific services or items your customers can book.</p>
          </div>
          <BusinessServicesManager businessId={bizRes.id} />
        </div>
      );
    }

    switch (activeTab) {
      case 'profile':
        return (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <h3 className="text-lg font-bold text-[#e8e8e8]">Business Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Business Name</label>
                <input type="text" className="input-field" value={businessData.name} onChange={e => setBusinessData({ ...businessData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Phone Number</label>
                <input type="text" className="input-field" value={businessData.phone} onChange={e => setBusinessData({ ...businessData, phone: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Address</label>
                <input type="text" className="input-field" value={businessData.address} onChange={e => setBusinessData({ ...businessData, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Business Category</label>
                <select className="input-field" value={businessData.category} onChange={e => setBusinessData({ ...businessData, category: e.target.value })}>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-[#757575]">Category affects how the AI calculates risk and deposit amounts.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Google Place ID</label>
                <input type="text" className="input-field" value={businessData.googlePlaceId} onChange={e => setBusinessData({ ...businessData, googlePlaceId: e.target.value })} />
                <p className="mt-1.5 text-xs text-[#757575]">Used to fetch your Google Reviews for the dashboard.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Reliability Score (Self-Market)</label>
                <input type="number" min="0" max="100" className="input-field" value={businessData.reliabilityScore} onChange={e => setBusinessData({ ...businessData, reliabilityScore: Number(e.target.value) })} />
                <p className="mt-1.5 text-xs text-[#757575]">Set your public reliability score (0-100) to market yourself better.</p>
              </div>
            </div>
            <SaveButton onClick={() => {}} label="Save Profile" />
          </form>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[#e8e8e8]">WhatsApp Automations</h3>
              <p className="text-sm text-[#757575]">Configure automated WhatsApp messages for your customers and yourself.</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#ffffff15] space-y-4">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-[#ffffff15] bg-[#181818] cursor-pointer">
                <input type="checkbox" checked={notificationSettings.sendWhatsAppReminders}
                  onChange={e => setNotificationSettings({ ...notificationSettings, sendWhatsAppReminders: e.target.checked })}
                  className="w-4 h-4 rounded border-[#ffffff25] text-[#10b981] focus:ring-emerald-500" />
                <div>
                  <p className="text-sm font-bold text-[#e8e8e8]">Customer Reminders & Confirmations</p>
                  <p className="text-xs text-[#757575]">Send WhatsApp messages to customers when they book, and 24 hours before their reservation.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-[#ffffff15] bg-[#181818] cursor-pointer">
                <input type="checkbox" checked={notificationSettings.requestFeedbackAfterBooking}
                  onChange={e => setNotificationSettings({ ...notificationSettings, requestFeedbackAfterBooking: e.target.checked })}
                  className="w-4 h-4 rounded border-[#ffffff25] text-[#10b981] focus:ring-emerald-500" />
                <div>
                  <p className="text-sm font-bold text-[#e8e8e8]">Post-Booking Review Requests</p>
                  <p className="text-xs text-[#757575]">Automatically ask customers for feedback on WhatsApp after their reservation is marked complete.</p>
                </div>
              </label>
            </div>

            <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#ffffff15]">
              <h4 className="font-bold text-[#e8e8e8] mb-4">Business Owner Notifications</h4>
              
              <label className="flex items-center gap-3 p-3 mb-4 rounded-xl border border-[#ffffff15] bg-[#181818] cursor-pointer">
                <input type="checkbox" checked={notificationSettings.notifyOwnerOnNewBooking}
                  onChange={e => setNotificationSettings({ ...notificationSettings, notifyOwnerOnNewBooking: e.target.checked })}
                  className="w-4 h-4 rounded border-[#ffffff25] text-[#0ea5e9] focus:ring-blue-500" />
                <div>
                  <p className="text-sm font-bold text-[#e8e8e8]">Notify me on new bookings</p>
                  <p className="text-xs text-[#757575]">Get a WhatsApp ping immediately whenever a new reservation is created.</p>
                </div>
              </label>

              {notificationSettings.notifyOwnerOnNewBooking && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Your WhatsApp Number</label>
                  <input type="text" className="input-field" placeholder="+923001234567"
                    value={notificationSettings.whatsappNumber}
                    onChange={e => setNotificationSettings({ ...notificationSettings, whatsappNumber: e.target.value })} />
                  <p className="text-xs text-[#757575] mt-1.5">Include country code (e.g., +92).</p>
                </div>
              )}
            </div>

            <SaveButton onClick={handleSaveNotifications} label="Save Notifications" />
          </div>
        );

      case 'webhooks':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-[#e8e8e8]">CRM Webhook Integration</h3>
                <p className="text-sm text-[#757575]">Send Pabandi reservation events to your external tools (like HubSpot or Zapier).</p>
              </div>
              <span className="px-3 py-1 bg-[#10b98125] text-[#10b981] text-xs font-bold rounded-full flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4" /> Active
              </span>
            </div>
            <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#ffffff15]">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Target Webhook URL</label>
              <input type="url" className="input-field mb-4 bg-[#181818]" value={webhook.targetUrl} onChange={e => setWebhook({ ...webhook, targetUrl: e.target.value })} placeholder="https://hooks.zapier.com/hooks/catch/..." />

              <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Signing Secret</label>
              <div className="flex gap-2 mb-4">
                <input type={webhook.showSecret ? 'text' : 'password'} readOnly className="input-field bg-[#1a1a1a] opacity-70" value={webhook.secret} />
                <button onClick={() => setWebhook({ ...webhook, showSecret: !webhook.showSecret })}
                  className="px-4 py-2 bg-[#181818] border border-[#ffffff25] rounded-xl text-sm font-semibold hover:bg-slate-50 text-[#9e9e9e]">
                  {webhook.showSecret ? 'Hide' : 'Reveal'}
                </button>
                <button className="px-4 py-2 bg-[#181818] border border-[#ffffff25] rounded-xl text-sm font-semibold hover:bg-slate-50 text-[#9e9e9e]">Rotate</button>
              </div>
              <p className="text-xs text-[#757575] mb-6">Use this secret to verify the HMAC-SHA256 signature in the `x-pabandi-signature` header of incoming requests.</p>

              <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-3">Subscribed Events</label>
              <div className="space-y-3">
                {Object.keys(webhook.events).map(event => (
                  <label key={event} className="flex items-center gap-3">
                    <input type="checkbox" checked={(webhook.events as any)[event]}
                      onChange={e => setWebhook({ ...webhook, events: { ...webhook.events, [event]: e.target.checked } })}
                      className="w-4 h-4 rounded border-[#ffffff25] text-[#0ea5e9] focus:ring-blue-500" />
                    <span className="text-sm text-[#e8e8e8] font-mono bg-[#1a1a1a] px-2 py-0.5 rounded">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            {(businessData.category === 'HOTEL' || businessData.category === 'PROPERTY_RENTAL') && (
              <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#ffffff15] mt-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-[#e8e8e8]">Channel Manager (Airbnb, Booking.com)</h4>
                    <p className="text-xs text-[#757575] mt-1">
                      Powered by Channex. Sync your Pabandi availability automatically with major OTAs.
                    </p>
                  </div>
                  {bizRes?.channexPropertyId ? (
                    <span className="px-3 py-1 bg-[#10b98125] text-[#10b981] text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircleIcon className="h-4 w-4" /> Connected
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-full">Not Connected</span>
                  )}
                </div>

                {!bizRes?.channexPropertyId && (
                  <button
                    onClick={async () => {
                      try {
                        setSaveStatus('saving');
                        await apiClient.post(`/businesses/${bizRes?.id}/channex-connect`);
                        qc.invalidateQueries('my-business-settings');
                        setSaveStatus('saved');
                        setTimeout(() => setSaveStatus('idle'), 2500);
                      } catch (err) {
                        setSaveStatus('error');
                      }
                    }}
                    disabled={saveStatus === 'saving'}
                    className="w-full py-3 bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                  >
                    Connect to Airbnb
                  </button>
                )}
                {bizRes?.channexPropertyId && (
                  <div className="p-3 bg-[#181818] rounded-xl border border-[#ffffff15]">
                    <p className="text-xs text-[#9e9e9e] uppercase tracking-wider font-bold mb-1">Channex Property ID</p>
                    <p className="text-sm font-mono text-[#e8e8e8]">{bizRes.channexPropertyId}</p>
                  </div>
                )}
              </div>
            )}
            
            <SaveButton onClick={handleSaveWebhook} label="Save Webhook" />
          </div>
        );

      case 'payments':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[#e8e8e8]">Payments & Web3 Escrow</h3>
              <p className="text-sm text-[#757575]">Configure how you receive deposits and payments. All deposits are credited toward the customer's total bill.</p>
            </div>

            <div className="p-5 rounded-2xl border border-[#ffffff15] bg-[#181818]">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-[#e8e8e8]">Safepay Integration (Fiat)</h4>
                <span className="px-3 py-1 bg-[#10b98125] text-[#10b981] text-xs font-bold rounded-full">Connected</span>
              </div>
              <p className="text-sm text-[#757575] mb-4">Safepay is configured globally via the backend. Customers can pay via Debit/Credit Card, JazzCash, and EasyPaisa.</p>
              <div className="flex gap-3">
                <span className="px-3 py-1.5 bg-[#10b98115] text-[#10b981] text-xs font-bold rounded-lg border border-[#10b98133]">💳 Cards</span>
                <span className="px-3 py-1.5 bg-[#ef444415] text-[#ef4444] text-xs font-bold rounded-lg border border-[#ef444433]">📱 JazzCash</span>
                <span className="px-3 py-1.5 bg-[#0ea5e915] text-[#0ea5e9] text-xs font-bold rounded-lg border border-[#0ea5e933]">📱 EasyPaisa</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[#8b5cf633] bg-gradient-to-br from-purple-50 to-emerald-50">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-[#e8e8e8]">◎ Web3 Wallet · Solana</h4>
                <span className="px-3 py-1 bg-[#8b5cf625] text-[#8b5cf6] text-xs font-bold rounded-full">Custodial</span>
              </div>
              <p className="text-sm text-[#757575] mb-4">
                Your automatically generated Solana wallet. You receive $PAB rewards here for honored bookings and no-show protection.
              </p>
              
              {walletData?.solanaWalletAddress ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#757575] mb-1.5">Your Solana Address</label>
                    <div className="flex items-center gap-2">
                      <input type="text" readOnly value={walletData.solanaWalletAddress} className="input-field bg-white/50 text-slate-900 flex-1 font-mono text-sm" />
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">PAB Balance</p>
                      <p className="text-xl font-black text-slate-900 mt-1">{walletData.totalBalance?.toLocaleString()} PAB</p>
                    </div>
                  </div>

                  <div className="pt-4 mt-2 border-t border-black/5">
                    <p className="text-xs text-slate-600 mb-3">Want full custody over your funds outside of Pabandi?</p>
                    <button 
                      onClick={() => setExportModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
                      <LockClosedIcon className="w-4 h-4" /> Export Private Key
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-slate-600">Generating wallet...</p>
              )}
            </div>

            {/* Deposit credit notice */}
            <div className="flex gap-3 p-4 bg-[#10b98115] text-emerald-800 rounded-xl border border-[#10b98133]">
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
                <h3 className="text-lg font-bold text-[#e8e8e8]">AI No-Show Protection</h3>
                <p className="text-sm text-[#757575]">Configure how the AI protects your business from missed appointments.</p>
              </div>
              <CpuChipIcon className="w-8 h-8 text-blue-500" />
            </div>

            {/* Category-aware notice */}
            <div className="flex gap-3 p-4 rounded-xl border"
              style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.15)' }}>
              <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#8b5cf6]" />
              <p className="text-sm text-[#9e9e9e]">
                Your business is categorized as <strong>{CATEGORIES.find(c => c.value === businessData.category)?.label || businessData.category}</strong>.
                The AI uses industry-specific risk models — e-commerce weighs COD rejections, restaurants weigh group size,
                salons focus on service duration and value, event venues track capacity and VIP bookings.
              </p>
            </div>

            {/* Risk Threshold */}
            <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#ffffff15]">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-[#e8e8e8]">Risk Threshold Strictness</label>
                <span className="text-sm font-bold text-[#0ea5e9]">{aiSettings.aiStrictness}%</span>
              </div>
              <input
                type="range" min="0" max="100"
                value={aiSettings.aiStrictness}
                onChange={e => setAiSettings({ ...aiSettings, aiStrictness: parseInt(e.target.value) })}
                className="w-full h-2 bg-[#242424] rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-[#616161] mt-2">
                <span>Lenient (More Bookings)</span>
                <span>Strict (More Deposits)</span>
              </div>
              <div className="mt-4 flex gap-3 p-4 bg-[#0ea5e915] text-[#0ea5e9] rounded-xl">
                <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  At <strong>{aiSettings.aiStrictness}%</strong> strictness, the AI will require a deposit for any booking whose risk score exceeds <strong>{100 - aiSettings.aiStrictness}%</strong>.
                </p>
              </div>
            </div>

            {/* Deposit Strategy */}
            <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#ffffff15]">
              <label className="text-sm font-bold text-[#e8e8e8] mb-3 block">Deposit Strategy</label>
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
                        ? 'border-[#0ea5e955] bg-[#0ea5e915] ring-1 ring-blue-500'
                        : 'border-[#ffffff15] bg-[#181818] hover:bg-slate-50'
                    }`}>
                    <p className="text-sm font-bold text-[#e8e8e8]">{s.label}</p>
                    <p className="text-[10px] text-[#757575] mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>

              {aiSettings.depositStrategy === 'FLAT' && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-[#9e9e9e] mb-1 block">Flat Deposit Amount (PKR)</label>
                  <input type="number" className="input-field w-48" min="500" step="50"
                    value={aiSettings.flatDepositPKR}
                    onChange={e => setAiSettings({ ...aiSettings, flatDepositPKR: parseInt(e.target.value) || 500 })} />
                </div>
              )}

              {aiSettings.depositStrategy === 'PERCENTAGE' && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-[#9e9e9e] mb-1 block">Deposit Percentage (%)</label>
                  <input type="number" className="input-field w-48" min="10" max="50" step="5"
                    value={aiSettings.depositPercentage}
                    onChange={e => setAiSettings({ ...aiSettings, depositPercentage: parseInt(e.target.value) || 20 })} />
                </div>
              )}

              <p className="text-xs text-[#757575] mt-3">
                Preview: <strong>{depositPreview()}</strong>. Deposits are applied toward the customer's total bill.
              </p>
            </div>

            {/* Trusted Customer Threshold */}
            <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#ffffff15]">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-[#e8e8e8]">Trusted Customer Threshold</label>
                <span className="text-sm font-bold text-[#10b981]">{aiSettings.trustedCustomerThreshold}+</span>
              </div>
              <input
                type="range" min="50" max="100"
                value={aiSettings.trustedCustomerThreshold}
                onChange={e => setAiSettings({ ...aiSettings, trustedCustomerThreshold: parseInt(e.target.value) })}
                className="w-full h-2 bg-[#242424] rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-[#616161] mt-2">
                <span>50 (Lenient)</span>
                <span>100 (Very Strict)</span>
              </div>
              <p className="text-xs text-[#757575] mt-3">
                Customers with a Pabandi reliability score above <strong>{aiSettings.trustedCustomerThreshold}</strong> will have their deposit waived automatically — rewarding loyal, reliable customers.
              </p>
            </div>

            {/* Auto-require toggle */}
            <label className="flex items-center gap-3 p-4 rounded-xl border border-[#ffffff15] bg-[#181818] cursor-pointer">
              <input type="checkbox" checked={aiSettings.autoRequireDeposit}
                onChange={e => setAiSettings({ ...aiSettings, autoRequireDeposit: e.target.checked })}
                className="w-4 h-4 rounded border-[#ffffff25] text-[#0ea5e9] focus:ring-blue-500" />
              <div>
                <p className="text-sm font-bold text-[#e8e8e8]">Auto-Require Deposits</p>
                <p className="text-xs text-[#757575]">Let the AI automatically enforce deposits on risky bookings via JazzCash, EasyPaisa, or Card.</p>
              </div>
            </label>

            <SaveButton onClick={handleSaveAI} label="Save AI Settings" />
          </div>
        );
        
      case 'e2ee':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-[#e8e8e8]">End-to-End Encryption (PKI)</h3>
                <p className="text-sm text-[#757575]">Secure customer requests using military-grade RSA cryptography.</p>
              </div>
              <LockClosedIcon className="w-8 h-8 text-emerald-500" />
            </div>

            <div className="flex gap-3 p-4 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
              <ShieldCheckIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Zero-Knowledge Architecture</p>
                <p className="text-xs mt-1 text-emerald-500/80">
                  When enabled, customer special requests are encrypted in their browser using your Public Key. Pabandi's servers only see ciphertext. You must use your Private Key to read the notes in your CRM.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#ffffff15]">
              <h4 className="font-bold text-[#e8e8e8] mb-4">Key Management</h4>
              
              {!e2eeStatus.hasPublicKey ? (
                <div className="text-center py-6">
                  <KeyIcon className="w-12 h-12 text-[#757575] mx-auto mb-3" />
                  <p className="text-sm text-[#e8e8e8] mb-4">You don't have a PKI keypair configured.</p>
                  <button onClick={handleGeneratePKI} disabled={saveStatus === 'saving'}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm transition-colors">
                    {saveStatus === 'saving' ? 'Generating Keys...' : 'Generate RSA Keypair'}
                  </button>
                  <p className="text-xs text-[#757575] mt-3 max-w-xs mx-auto">
                    This will generate a 2048-bit RSA keypair. Your browser will prompt you to download the private key. <strong>Keep it safe!</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-[#ffffff15] rounded-xl bg-[#181818]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <KeyIcon className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#e8e8e8]">RSA-OAEP 2048-bit Public Key</p>
                        <p className="text-xs text-[#757575]">Stored securely on Pabandi servers.</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Active</span>
                  </div>

                  <label className="flex items-center justify-between p-3 border border-[#ffffff15] rounded-xl bg-[#181818] cursor-pointer">
                    <div>
                      <p className="text-sm font-bold text-[#e8e8e8]">Enable E2E Encryption for Bookings</p>
                      <p className="text-xs text-[#757575]">Encrypt all new customer booking notes.</p>
                    </div>
                    <input type="checkbox" checked={e2eeStatus.enabled}
                      onChange={e => toggleE2ee(e.target.checked)}
                      className="w-5 h-5 rounded border-[#ffffff25] text-emerald-500 focus:ring-emerald-500 bg-[#242424]" />
                  </label>

                  <div className="pt-4 mt-4 border-t border-[#ffffff15]">
                    <button onClick={handleGeneratePKI} disabled={saveStatus === 'saving'}
                      className="text-xs font-bold text-red-500 hover:text-red-400">
                      Rotate Keys (Generate New)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#e8e8e8]">Settings</h1>
          <p className="mt-1 text-sm text-[#757575]">Manage your business profile, integrations, and preferences.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">

          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 flex-shrink-0 space-y-1">
            <button onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'profile' ? 'bg-[#181818] shadow-sm text-[#0ea5e9] border border-[#ffffff15]' : 'text-[#757575] hover:bg-slate-100 hover:text-slate-900'}`}>
              <UserCircleIcon className="w-5 h-5" /> Business Profile
            </button>
            <button onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'notifications' ? 'bg-[#181818] shadow-sm text-[#0ea5e9] border border-[#ffffff15]' : 'text-[#757575] hover:bg-slate-100 hover:text-slate-900'}`}>
              <BellIcon className="w-5 h-5" /> Notifications & WhatsApp
            </button>
            <button onClick={() => setActiveTab('services')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'services' ? 'bg-[#181818] shadow-sm text-[#0ea5e9] border border-[#ffffff15]' : 'text-[#757575] hover:bg-slate-100 hover:text-slate-900'}`}>
              <BriefcaseIcon className="w-5 h-5" /> Services Catalog
            </button>
            <button onClick={() => setActiveTab('webhooks')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'webhooks' ? 'bg-[#181818] shadow-sm text-[#0ea5e9] border border-[#ffffff15]' : 'text-[#757575] hover:bg-slate-100 hover:text-slate-900'}`}>
              <GlobeAltIcon className="w-5 h-5" /> Integrations & Webhooks
            </button>
            <button onClick={() => setActiveTab('payments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'payments' ? 'bg-[#181818] shadow-sm text-[#0ea5e9] border border-[#ffffff15]' : 'text-[#757575] hover:bg-slate-100 hover:text-slate-900'}`}>
              <CurrencyDollarIcon className="w-5 h-5" /> Payments & Escrow
            </button>
            <button onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'ai' ? 'bg-[#181818] shadow-sm text-[#0ea5e9] border border-[#ffffff15]' : 'text-[#757575] hover:bg-slate-100 hover:text-slate-900'}`}>
              <CpuChipIcon className="w-5 h-5" /> AI Configuration
            </button>
            <button onClick={() => setActiveTab('e2ee')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'e2ee' ? 'bg-[#181818] shadow-sm text-emerald-500 border border-[#ffffff15]' : 'text-[#757575] hover:bg-slate-100 hover:text-slate-900'}`}>
              <LockClosedIcon className="w-5 h-5" /> Security & PKI
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-[#181818] rounded-2xl p-6 shadow-sm border border-[#ffffff15]">
              {renderTabContent()}
            </div>
          </div>
        </div>

      </div>

      {exportModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#181818] border border-[#ffffff15] p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-black text-white mb-2">Export Private Key</h2>
            <p className="text-sm text-red-400 mb-6 font-semibold">
              WARNING: Anyone with this key has full access to your funds. Never share this with anyone, including Pabandi staff.
            </p>

            {exportedSecret ? (
              <div className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-500 font-bold uppercase tracking-wide mb-2">Your Solana Secret Key</p>
                  <p className="font-mono text-sm text-white break-all">{exportedSecret}</p>
                </div>
                <button onClick={() => { setExportModalOpen(false); setExportedSecret(''); setPassword(''); }} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold">
                  I have copied it safely. Close.
                </button>
              </div>
            ) : (
              <form onSubmit={handleExportSecret} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#9e9e9e] mb-1.5">Enter Password to Confirm</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field" 
                    placeholder="••••••••" 
                    required
                  />
                </div>
                {exportError && <p className="text-sm text-red-500">{exportError}</p>}
                
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setExportModalOpen(false)} className="flex-1 py-3 border border-[#ffffff25] text-white rounded-xl font-bold">
                    Cancel
                  </button>
                  <button type="submit" disabled={isExporting} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold">
                    {isExporting ? 'Verifying...' : 'Reveal Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
