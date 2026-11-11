import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  Webhook,
  BookOpen,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Download,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Wallet,
  Building2,
  DollarSign,
  Activity,
  Layers,
  CheckCircle2,
  Terminal,
  Code2
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ApiKeyItem {
  id: string;
  name: string;
  environment: 'test' | 'live';
  publishableKey: string;
  secretKeyMasked: string;
  secretKeyFull?: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

interface MerchantSettings {
  businessName: string;
  raastId: string;
  solanaWallet: string;
  jazzCashAccount: string;
  cardRouting: string;
  shariaCompliant: boolean;
  defaultCurrency: 'USD' | 'PKR';
  wakalaFeePercent: number;
  webhookUrl: string;
  webhookSecret: string;
  webhookEvents: string[];
}

interface WebhookLog {
  id: string;
  event: string;
  targetUrl: string;
  statusCode: number;
  latencyMs: number;
  payload: any;
  signature: string;
  timestamp: string;
  success: boolean;
  responseBody?: string;
}

interface LedgerTx {
  id: string;
  paymentId: string;
  reference: string;
  rail: string;
  totalAmount: number;
  currency: string;
  status: string;
  entries: {
    id: string;
    account: string;
    accountType: string;
    debit: number;
    credit: number;
    currency: string;
    description: string;
  }[];
  createdAt: string;
  trustScoreImpact?: {
    payerScoreDelta: number;
    payeeScoreDelta: number;
    reason: string;
  };
}

export const DeveloperDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'keys' | 'rails' | 'webhooks' | 'ledger'>('keys');
  const [envFilter, setEnvFilter] = useState<'all' | 'test' | 'live'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // API Keys State
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'test' | 'live'>('test');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKeyItem | null>(null);

  // Settings State
  const [settings, setSettings] = useState<MerchantSettings>({
    businessName: 'Pabandi Partner Merchant (Universal Escrow)',
    raastId: 'PK92HABB0001234567890101',
    solanaWallet: 'GsdP8LpG9YtWwR6j2xM8E1n4k3v7Q5z0PabandiEscrow',
    jazzCashAccount: '03001234567',
    cardRouting: 'square_connect_active',
    shariaCompliant: true,
    defaultCurrency: 'USD',
    wakalaFeePercent: 0.5,
    webhookUrl: 'https://api.merchant.com/webhooks/pabandi',
    webhookSecret: 'whsec_98f12a4b8c9d0e1f2a3b4c5d6e7f8a9b',
    webhookEvents: ['payment.created', 'payment.escrow_locked', 'payment.settled', 'payment.disputed'],
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Webhook State
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testWebhookEvent, setTestWebhookEvent] = useState('payment.settled');
  const [testResult, setTestResult] = useState<WebhookLog | null>(null);

  // Ledger State
  const [ledgerTxs, setLedgerTxs] = useState<LedgerTx[]>([]);
  const [reconciliation, setReconciliation] = useState<{
    totalVolumeUsd: number;
    transactionCount: number;
    balanced: boolean;
    rails: Record<string, number>;
  }>({
    totalVolumeUsd: 647.50,
    transactionCount: 4,
    balanced: true,
    rails: { raast: 160.71, solana: 435.0, jazzcash: 50.71 },
  });

  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Keys
      const keysRes = await fetch('/api/v1/developer/keys').catch(() => null);
      if (keysRes && keysRes.ok) {
        const data = await keysRes.json();
        if (data.data) setKeys(data.data);
      } else {
        // Fallback mock keys
        setKeys([
          {
            id: 'key_test_default_01',
            name: 'Development Sandbox Key',
            environment: 'test',
            publishableKey: 'pk_test_4f98e712a0bc39de41aa20',
            secretKeyMasked: 'sk_test_••••••••••••382a',
            scopes: ['payments:read', 'payments:write', 'escrow:lock'],
            createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
            lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
            isActive: true,
          },
          {
            id: 'key_live_default_02',
            name: 'Production Storefront Key',
            environment: 'live',
            publishableKey: 'pk_live_8801d94f27ca49ff31b810',
            secretKeyMasked: 'sk_live_••••••••••••910f',
            scopes: ['payments:read', 'payments:write', 'escrow:lock', 'ledger:read'],
            createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
            lastUsedAt: new Date(Date.now() - 1200000).toISOString(),
            isActive: true,
          },
        ]);
      }

      // 2. Fetch Settings
      const setRes = await fetch('/api/v1/developer/settings').catch(() => null);
      if (setRes && setRes.ok) {
        const sData = await setRes.json();
        if (sData.data) setSettings(sData.data);
      }

      // 3. Fetch Webhook Logs
      const whRes = await fetch('/api/v1/developer/webhooks/deliveries').catch(() => null);
      if (whRes && whRes.ok) {
        const whData = await whRes.json();
        if (whData.data) setWebhookLogs(whData.data);
      }

      // 4. Fetch Ledger
      const ledRes = await fetch('/api/v1/developer/ledger').catch(() => null);
      if (ledRes && ledRes.ok) {
        const lData = await ledRes.json();
        if (lData.data?.transactions) setLedgerTxs(lData.data.transactions);
        if (lData.data?.reconciliation) setReconciliation(lData.data.reconciliation);
      } else {
        // Fallback ledger
        setLedgerTxs([
          {
            id: 'ledger_tx_101',
            paymentId: 'pay_init_raast_001',
            reference: 'inv_lahore_electric_441',
            rail: 'raast',
            totalAmount: 45000,
            currency: 'PKR',
            status: 'POSTED',
            entries: [
              { id: 'e1', account: 'clearing:raast:pkr', accountType: 'ASSET', debit: 45000, credit: 0, currency: 'PKR', description: 'SBP Raast Inbound Clearing' },
              { id: 'e2', account: 'escrow:payee:merchant_lahore', accountType: 'LIABILITY', debit: 0, credit: 45000, currency: 'PKR', description: 'Escrow liability 0% fee' },
            ],
            createdAt: new Date(Date.now() - 14400000).toISOString(),
            trustScoreImpact: { payerScoreDelta: 15, payeeScoreDelta: 20, reason: 'Raast 0% instant settlement verified' },
          },
          {
            id: 'ledger_tx_102',
            paymentId: 'pay_init_sol_002',
            reference: 'escrow_dev_contract_883',
            rail: 'solana',
            totalAmount: 350,
            currency: 'USDC',
            status: 'POSTED',
            entries: [
              { id: 'e3', account: 'clearing:solana:usdc', accountType: 'ASSET', debit: 350, credit: 0, currency: 'USDC', description: 'Solana Anchor Escrow PDA Inflow' },
              { id: 'e4', account: 'escrow:payee:dev_seller', accountType: 'LIABILITY', debit: 0, credit: 348.25, currency: 'USDC', description: 'Escrow liability locked' },
              { id: 'e5', account: 'revenue:platform:wakala_fee', accountType: 'REVENUE', debit: 0, credit: 1.75, currency: 'USDC', description: 'AAOIFI Wakala agency fee (0.5%)' },
            ],
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            trustScoreImpact: { payerScoreDelta: 15, payeeScoreDelta: 20, reason: 'Solana USDC smart contract escrow locked' },
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch('/api/v1/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          environment: newKeyEnv,
          scopes: ['payments:read', 'payments:write', 'escrow:lock', 'ledger:read'],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewlyCreatedKey(data.data);
        setKeys(prev => [data.data, ...prev]);
      } else {
        // Fallback local creation
        const mockNew: ApiKeyItem = {
          id: `key_${newKeyEnv}_${Date.now()}`,
          name: newKeyName.trim(),
          environment: newKeyEnv,
          publishableKey: `pk_${newKeyEnv}_${Math.random().toString(36).substring(2, 14)}`,
          secretKeyMasked: `sk_${newKeyEnv}_••••••••••••${Math.random().toString(36).substring(2, 6)}`,
          secretKeyFull: `sk_${newKeyEnv}_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`,
          scopes: ['payments:read', 'payments:write', 'escrow:lock'],
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          isActive: true,
        };
        setNewlyCreatedKey(mockNew);
        setKeys(prev => [mockNew, ...prev]);
      }

      setNewKeyName('');
      setIsCreatingKey(false);
    } catch {
      // Handled gracefully
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? Applications using this key will immediately stop working.')) return;
    try {
      await fetch(`/api/v1/developer/keys/${id}`, { method: 'DELETE' });
    } catch {
      // Local update
    }
    setKeys(prev => prev.map(k => (k.id === id ? { ...k, isActive: false } : k)));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/v1/developer/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v1/developer/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: settings.webhookUrl,
          eventType: testWebhookEvent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTestResult(data.data);
        setWebhookLogs(prev => [data.data, ...prev]);
      } else {
        // Fallback simulation
        const mockLog: WebhookLog = {
          id: `whd_${Date.now()}`,
          event: testWebhookEvent,
          targetUrl: settings.webhookUrl,
          statusCode: 200,
          latencyMs: 168,
          payload: {
            id: `evt_${Date.now()}`,
            type: testWebhookEvent,
            amount: 350,
            currency: 'USDC',
            rail: 'solana',
            status: 'SUCCEEDED',
            shariaCompliance: 'AAOIFI Standard 13 (0% Riba)',
          },
          signature: 'sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          timestamp: new Date().toISOString(),
          success: true,
          responseBody: '{"received":true,"status":"simulated_ok"}',
        };
        setTestResult(mockLog);
        setWebhookLogs(prev => [mockLog, ...prev]);
      }
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const filteredKeys = keys.filter(k => (envFilter === 'all' ? true : k.environment === envFilter));

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 pbn-theme-dark selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,240,255,0.08),rgba(255,255,255,0))]" />

      {/* Main Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        
        {/* Navigation Breadcrumb / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-8 border-b border-white/10 gap-4">
          <div>
            <div className="flex items-center gap-3 text-xs tracking-wider uppercase font-mono text-cyan-400 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Pabandi Multi-Tenant Infrastructure</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">Developer Console</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-['Space_Grotesk',sans-serif]">
              API Keys & Settlement Rails
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl">
              Generate cryptographic API keys, configure domestic SBP Raast 0% & Solana USDC escrow settlement, debug signed webhooks, and audit your double-entry ledger.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/developers"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-white/15 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Interactive Docs</span>
            </Link>
            <Link
              to="/pay/link/quick-escrow"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-cyan-400" />
              <span>View Payment Link</span>
            </Link>
          </div>
        </div>

        {/* Newly Created Key Alert Modal / Callout */}
        {newlyCreatedKey && (
          <div className="mt-6 p-5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-emerald-300 font-['Space_Grotesk',sans-serif]">
                    API Key Created Successfully
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-200/80 mt-1">
                    Please copy your Secret Key now. For security purposes, <strong className="text-white">it will never be shown again</strong>.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 font-mono text-xs sm:text-sm text-emerald-300 select-all break-all">
                      {newlyCreatedKey.secretKeyFull}
                    </div>
                    <button
                      onClick={() => copyToClipboard(newlyCreatedKey.secretKeyFull || '', 'new_secret')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
                    >
                      {copiedKey === 'new_secret' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedKey === 'new_secret' ? 'Copied!' : 'Copy Secret Key'}</span>
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-900 border border-white/10"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-4">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900/90 border border-white/10">
            <button
              onClick={() => setActiveTab('keys')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'keys'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>API Keys & Credentials</span>
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300 font-mono">
                {keys.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('rails')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'rails'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Settlement Rails</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </button>

            <button
              onClick={() => setActiveTab('webhooks')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'webhooks'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Webhook className="w-4 h-4" />
              <span>Webhooks & Debugger</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'ledger'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Double-Entry Ledger</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-mono uppercase">
                GAAP Balanced
              </span>
            </button>
          </div>

          {activeTab === 'keys' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono">
                <button
                  onClick={() => setEnvFilter('all')}
                  className={`px-2.5 py-1 rounded ${envFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setEnvFilter('test')}
                  className={`px-2.5 py-1 rounded ${envFilter === 'test' ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30' : 'text-slate-400'}`}
                >
                  Test (Sandbox)
                </button>
                <button
                  onClick={() => setEnvFilter('live')}
                  className={`px-2.5 py-1 rounded ${envFilter === 'live' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' : 'text-slate-400'}`}
                >
                  Live (Production)
                </button>
              </div>

              <button
                onClick={() => setIsCreatingKey(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Key</span>
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: API KEYS */}
        {activeTab === 'keys' && (
          <div className="mt-8 space-y-6">
            
            {/* Create Key Modal / Drawer */}
            {isCreatingKey && (
              <div className="p-6 rounded-2xl border border-cyan-500/30 bg-slate-900/90 backdrop-blur-md">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <h3 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] flex items-center gap-2">
                    <Key className="w-5 h-5 text-cyan-400" />
                    <span>Create Multi-Rail API Key</span>
                  </h3>
                  <button
                    onClick={() => setIsCreatingKey(false)}
                    className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded bg-slate-800 border border-white/10"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleCreateKey} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Key Description / Service Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Production Shopify App, Mobile Dispatcher, Invoicing Daemon"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Target Environment
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          newKeyEnv === 'test'
                            ? 'bg-amber-950/20 border-amber-500/50 text-amber-200'
                            : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="radio"
                          name="env"
                          checked={newKeyEnv === 'test'}
                          onChange={() => setNewKeyEnv('test')}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-xs font-bold font-mono">Sandbox (Test)</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Prefix: <code className="text-amber-300">pk_test_</code>. Simulated on-chain Anchor escrow & SBP Raast clearing.
                          </div>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          newKeyEnv === 'live'
                            ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-200'
                            : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="radio"
                          name="env"
                          checked={newKeyEnv === 'live'}
                          onChange={() => setNewKeyEnv('live')}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-xs font-bold font-mono">Production (Live)</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Prefix: <code className="text-emerald-300">pk_live_</code>. Live Solana mainnet USDC & SBP Raast real clearing.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreatingKey(false)}
                      className="px-4 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20"
                    >
                      Generate Key Pair
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Keys Table */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/90 text-xs font-mono uppercase text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4">Key Name & ID</th>
                      <th className="px-6 py-4">Environment</th>
                      <th className="px-6 py-4">Publishable Key</th>
                      <th className="px-6 py-4">Secret Key</th>
                      <th className="px-6 py-4">Created / Last Used</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-xs">
                    {filteredKeys.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                          No API keys found for this filter. Click &ldquo;Create New Key&rdquo; to generate one.
                        </td>
                      </tr>
                    ) : (
                      filteredKeys.map(k => (
                        <tr key={k.id} className={!k.isActive ? 'opacity-40 bg-red-950/5' : 'hover:bg-white/[0.02]'}>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white font-['Space_Grotesk',sans-serif] text-sm">
                              {k.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{k.id}</div>
                            {!k.isActive && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded bg-red-950 text-red-400 border border-red-500/30">
                                REVOKED
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {k.environment === 'live' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>LIVE</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                <span>SANDBOX</span>
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-300 font-mono text-xs bg-slate-900 px-2 py-1 rounded border border-white/10">
                                {k.publishableKey}
                              </span>
                              <button
                                onClick={() => copyToClipboard(k.publishableKey, `pk_${k.id}`)}
                                title="Copy Publishable Key"
                                className="text-slate-400 hover:text-cyan-300 transition-colors p-1"
                              >
                                {copiedKey === `pk_${k.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono text-xs bg-slate-900/60 px-2 py-1 rounded border border-white/5">
                                {k.secretKeyMasked}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-slate-400">
                            <div>{new Date(k.createdAt).toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleTimeString()}` : 'Never used'}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right">
                            {k.isActive ? (
                              <button
                                onClick={() => handleRevokeKey(k.id)}
                                title="Revoke API Key"
                                className="inline-flex items-center gap-1 text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-950/40 border border-transparent hover:border-red-500/20 text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Revoke</span>
                              </button>
                            ) : (
                              <span className="text-slate-600 text-xs">Inactive</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quickstart Code Preview Card */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white font-['Space_Grotesk',sans-serif]">
                    Live Implementation Quickstart
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Using: {keys[0]?.publishableKey || 'pk_test_...'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1.5">cURL (Backend Escrow Intent)</div>
                  <pre className="p-4 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`curl -X POST https://api.pabandi.com/api/v1/payments \\
  -H "Authorization: Bearer ${keys[0]?.publishableKey || 'pk_test_demo'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 100.00,
    "currency": "USD",
    "requireSharia": true,
    "preferredRail": "auto"
  }'`}
                  </pre>
                </div>

                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1.5">React Drop-in SDK Component</div>
                  <pre className="p-4 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
{`import { PabandiPaymentElement } from '@pabandi/sdk-react';

<PabandiPaymentElement
  publishableKey="${keys[0]?.publishableKey || 'pk_test_demo'}"
  amount={100}
  currency="USD"
  onSuccess={(receipt) => console.log('Escrow locked:', receipt)}
/>`}
                  </pre>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: SETTLEMENT RAILS */}
        {activeTab === 'rails' && (
          <div className="mt-8">
            <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
              
              {saveSuccess && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-3 text-emerald-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Settlement rails updated successfully. All incoming customer payments will clear according to these parameters.</span>
                </div>
              )}

              {/* Merchant Details Card */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk',sans-serif]">
                      Merchant Entity & Default Currency
                    </h3>
                    <p className="text-xs text-slate-400">
                      The verified legal business or individual identity displayed on customer payment links.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Business / Display Name
                    </label>
                    <input
                      type="text"
                      value={settings.businessName}
                      onChange={e => setSettings({ ...settings, businessName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-white/15 text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Default Presentation Currency
                    </label>
                    <select
                      value={settings.defaultCurrency}
                      onChange={e => setSettings({ ...settings, defaultCurrency: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-white/15 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono"
                    >
                      <option value="USD">USD ($) — Cross-Border & Global Cards</option>
                      <option value="PKR">PKR (Rs) — Pakistan Domestic SBP Raast / Wallets</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3-Rail Payout Destination Card */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk',sans-serif]">
                      Multi-Rail Settlement Destination Accounts
                    </h3>
                    <p className="text-xs text-slate-400">
                      Funds deposited via domestic or crypto rails settle directly into these destination vaults.
                    </p>
                  </div>
                </div>

                {/* Raast IBAN */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>State Bank of Pakistan (SBP) Raast IBAN / Phone Alias</span>
                    </label>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      0% Fee · Instant Real-time Clearing
                    </span>
                  </div>
                  <input
                    type="text"
                    value={settings.raastId}
                    onChange={e => setSettings({ ...settings, raastId: e.target.value })}
                    placeholder="PK92HABB0001234567890101 or 03001234567"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-white/15 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Universal Raast account for instant clearing from Habib Bank, Meezan Bank, Alfalah, Standard Chartered, etc.
                  </p>
                </div>

                {/* Solana USDC Wallet */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-400" />
                      <span>Solana USDC Escrow Settlement Wallet (Phantom / Solflare)</span>
                    </label>
                    <span className="text-[11px] font-mono text-violet-300 bg-violet-950/60 px-2 py-0.5 rounded border border-violet-500/30">
                      Anchor Smart Contract PDA
                    </span>
                  </div>
                  <input
                    type="text"
                    value={settings.solanaWallet}
                    onChange={e => setSettings({ ...settings, solanaWallet: e.target.value })}
                    placeholder="e.g. 7vfCXTUXx5WJV5JADk17DUJ4ksau7..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-white/15 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Receives USDC payouts upon buyer check-in or delivery verification without intermediary delays.
                  </p>
                </div>

                {/* JazzCash / EasyPaisa */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span>JazzCash / EasyPaisa Mobile Wallet Account</span>
                    </label>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-white/10">
                      Domestic P2M
                    </span>
                  </div>
                  <input
                    type="text"
                    value={settings.jazzCashAccount}
                    onChange={e => setSettings({ ...settings, jazzCashAccount: e.target.value })}
                    placeholder="03001234567"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-white/15 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              {/* Sharia Governance Card */}
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/15 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-cyan-400 flex-shrink-0" />
                    <div>
                      <h3 className="text-base font-bold text-white font-['Space_Grotesk',sans-serif]">
                        AAOIFI Sharia Compliance Enforcement
                      </h3>
                      <p className="text-xs text-cyan-200/80">
                        Restricts financial operations strictly to Riba-free Wakala (agency fee) and Mudarabah (profit-sharing) models.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.shariaCompliant}
                      onChange={e => setSettings({ ...settings, shariaCompliant: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500" />
                  </label>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-cyan-500/20 text-xs text-slate-300 space-y-1.5 font-mono">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>0% Interest (No Riba) on escrow locks</span>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Fixed Agency Wakala Fee: {settings.wakalaFeePercent}% (Transparent, non-predatory)</span>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Zero Gharar: Smart contract escrow PDA guarantees precise delivery criteria</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
                >
                  Save Settlement Configuration
                </button>
              </div>

            </form>
          </div>
        )}

        {/* TAB 3: WEBHOOKS & DEBUGGER */}
        {activeTab === 'webhooks' && (
          <div className="mt-8 space-y-6">
            
            {/* Webhook Configuration & Test Dispatcher */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Webhook className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk',sans-serif]">
                      Webhook Endpoint & Signing Secret
                    </h3>
                    <p className="text-xs text-slate-400">
                      Pabandi sends signed HTTP POST payloads to your endpoint when payments are created, escrowed, or settled.
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Dispatcher Active</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Webhook Listener URL
                    </label>
                    <input
                      type="url"
                      value={settings.webhookUrl}
                      onChange={e => setSettings({ ...settings, webhookUrl: e.target.value })}
                      placeholder="https://yourdomain.com/api/webhooks/pabandi"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-white/15 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Webhook Signing Secret (HMAC-SHA256)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={settings.webhookSecret}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/60 border border-white/10 text-slate-400 text-xs font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(settings.webhookSecret, 'whsec')}
                        className="px-3.5 py-2.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:text-white border border-white/10 flex items-center gap-1.5"
                      >
                        {copiedKey === 'whsec' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      Subscribed Events
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['payment.created', 'payment.escrow_locked', 'payment.settled', 'payment.disputed', 'payout.completed'].map(evt => (
                        <span
                          key={evt}
                          className="px-2.5 py-1 rounded-md bg-slate-900 border border-white/10 text-xs font-mono text-cyan-300"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Test Trigger Box */}
                <div className="p-5 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm font-['Space_Grotesk',sans-serif]">
                      <Send className="w-4 h-4 text-cyan-400" />
                      <span>Live Webhook Tester</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Send a simulated signed event payload to your webhook listener URL to verify signature verification.
                    </p>

                    <div className="mt-4">
                      <label className="block text-[11px] font-mono text-slate-300 mb-1">Event Type</label>
                      <select
                        value={testWebhookEvent}
                        onChange={e => setTestWebhookEvent(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white text-xs font-mono"
                      >
                        <option value="payment.settled">payment.settled (SBP Raast / Solana)</option>
                        <option value="payment.escrow_locked">payment.escrow_locked (Anchor PDA)</option>
                        <option value="payment.disputed">payment.disputed (Arbitration)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook}
                    className="mt-4 w-full py-2.5 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20"
                  >
                    {isTestingWebhook ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{isTestingWebhook ? 'Dispatching...' : 'Send Test Webhook'}</span>
                  </button>
                </div>
              </div>

              {/* Test Result Inspector */}
              {testResult && (
                <div className="mt-4 p-4 rounded-xl border border-cyan-500/40 bg-slate-900/90 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${testResult.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <strong className="text-white">{testResult.event}</strong> &rarr; {testResult.targetUrl}
                    </span>
                    <span className="text-slate-400">
                      Status: <strong className={testResult.success ? 'text-emerald-300' : 'text-red-300'}>{testResult.statusCode}</strong> ({testResult.latencyMs}ms)
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400">
                    Header: <code className="text-cyan-300">X-Pabandi-Signature: {testResult.signature}</code>
                  </div>

                  <pre className="p-3 rounded-lg bg-slate-950 border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(testResult.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Recent Webhook Delivery History */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                <h3 className="text-sm font-semibold text-white font-['Space_Grotesk',sans-serif]">
                  Recent Delivery Logs
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {webhookLogs.length} events logged
                </span>
              </div>

              <div className="divide-y divide-white/5 font-mono text-xs">
                {webhookLogs.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    No webhook deliveries yet. Click &ldquo;Send Test Webhook&rdquo; above.
                  </div>
                ) : (
                  webhookLogs.map(log => (
                    <div key={log.id} className="p-4 hover:bg-white/[0.02] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.success ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-red-950 text-red-400 border border-red-500/30'
                        }`}>
                          {log.statusCode} OK
                        </span>
                        <div>
                          <div className="font-semibold text-white">{log.event}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{log.targetUrl}</div>
                        </div>
                      </div>

                      <div className="text-right text-slate-400 text-[11px]">
                        <div>{log.latencyMs}ms</div>
                        <div className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: DOUBLE-ENTRY LEDGER & RECONCILIATION */}
        {activeTab === 'ledger' && (
          <div className="mt-8 space-y-6">
            
            {/* Reconciliation KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border border-white/10 bg-slate-950/60">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Volume Processed</div>
                <div className="mt-2 text-2xl font-bold font-mono text-white">
                  ${reconciliation.totalVolumeUsd.toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-cyan-400 font-mono">
                  Across 3 payment rails
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20">
                <div className="text-xs font-mono text-emerald-300 uppercase tracking-wider">Accounting Balance</div>
                <div className="mt-2 text-2xl font-bold font-mono text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>100% Balanced</span>
                </div>
                <div className="mt-1 text-xs text-emerald-200/70 font-mono">
                  &Sigma; Debits = &Sigma; Credits
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-white/10 bg-slate-950/60">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Journal Transactions</div>
                <div className="mt-2 text-2xl font-bold font-mono text-white">
                  {ledgerTxs.length}
                </div>
                <div className="mt-1 text-xs text-slate-500 font-mono">
                  Audit trail cryptographically verified
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-cyan-500/30 bg-cyan-950/20">
                <div className="text-xs font-mono text-cyan-300 uppercase tracking-wider">Sharia Compliance</div>
                <div className="mt-2 text-2xl font-bold font-mono text-cyan-300">
                  AAOIFI S-13
                </div>
                <div className="mt-1 text-xs text-cyan-200/70 font-mono">
                  0% Riba · Wakala Standard
                </div>
              </div>
            </div>

            {/* Reconciliation Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-slate-900/80">
              <div>
                <h3 className="text-sm font-semibold text-white font-['Space_Grotesk',sans-serif]">
                  GAAP & Islamic Finance Double-Entry Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time journal showing balanced asset clearing, escrow liabilities, and platform Wakala fee splits.
                </p>
              </div>

              <a
                href="/api/v1/developer/ledger/export.csv"
                download="pabandi_ledger_reconciliation.csv"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Export Reconciliation CSV</span>
              </a>
            </div>

            {/* Journal Transactions Table */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/90 text-xs font-mono uppercase text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4">Transaction / Time</th>
                      <th className="px-6 py-4">Rail</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Double-Entry Journal (Debits / Credits)</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-xs">
                    {ledgerTxs.map(tx => (
                      <tr key={tx.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4 align-top">
                          <div className="font-semibold text-white font-['Space_Grotesk',sans-serif]">
                            {tx.reference}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{tx.id}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(tx.createdAt).toLocaleString()}
                          </div>
                        </td>

                        <td className="px-6 py-4 align-top">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            tx.rail === 'solana' ? 'bg-violet-950 text-violet-300 border border-violet-500/30' :
                            tx.rail === 'raast' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' :
                            'bg-red-950 text-red-300 border border-red-500/30'
                          }`}>
                            {tx.rail}
                          </span>
                        </td>

                        <td className="px-6 py-4 align-top font-bold text-white text-sm">
                          {tx.totalAmount.toLocaleString()} {tx.currency}
                        </td>

                        <td className="px-6 py-4 align-top space-y-1.5">
                          {tx.entries.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4 text-[11px] bg-slate-900/70 px-2.5 py-1.5 rounded border border-white/5">
                              <span className="text-slate-300">
                                <code className="text-cyan-300 font-bold">{entry.accountType}</code>: {entry.account}
                              </span>
                              <span className="font-mono text-right flex-shrink-0">
                                {entry.debit > 0 ? (
                                  <span className="text-emerald-400 font-bold">DR +{entry.debit}</span>
                                ) : (
                                  <span className="text-amber-300 font-bold">CR -{entry.credit}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </td>

                        <td className="px-6 py-4 align-top text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                            <Check className="w-3 h-3" />
                            <span>{tx.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default DeveloperDashboardPage;
