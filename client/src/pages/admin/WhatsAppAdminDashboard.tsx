// @ts-nocheck
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Clock,
  Shield,
  Zap,
  Settings,
  Smartphone,
  Calendar,
  Share2,
  UserCheck,
  Activity,
  ChevronRight,
  Layers
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getAuthToken } from '../../utils/authToken';

export default function WhatsAppAdminDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'pairing' | 'plugins' | 'marketing' | 'sandbox'>('overview');

  // Stats & Health
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // QR Pairing State
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pairingTimer, setPairingTimer] = useState<number>(30);

  // Marketing Links
  const [marketingData, setMarketingData] = useState<any>(null);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Plugins
  const [plugins, setPlugins] = useState<any[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  // Interactive Sandbox
  const [sandboxPhone, setSandboxPhone] = useState('');
  const [sandboxMessage, setSandboxMessage] = useState('Salam! This is a test confirmation from your verified WhatsApp bot.');
  const [sandboxSending, setSandboxSending] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const authHeaders = { Authorization: `Bearer ${getAuthToken()}` };

      const [statsRes, healthRes, pluginsRes] = await Promise.all([
        axios.get('/api/v1/openwa/stats', { headers: authHeaders }).catch(() => ({ data: { data: null } })),
        axios.get('/api/v1/openwa/health', { headers: authHeaders }).catch(() => ({ data: { data: { status: 'standby' } } })),
        axios.get('/api/v1/openwa/plugins/available', { headers: authHeaders }).catch(() => ({ data: { data: [] } }))
      ]);

      setStats(statsRes.data?.data || null);
      setHealth(healthRes.data?.data || null);
      setPlugins(pluginsRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load initial OpenWA dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQrCode = async () => {
    try {
      setQrLoading(true);
      setPairingTimer(30);
      const authHeaders = { Authorization: `Bearer ${getAuthToken()}` };
      const res = await axios.get('/api/v1/whatsapp/advanced/connect-qr?sessionId=default', {
        headers: authHeaders
      });
      setQrData(res.data?.data || res.data);
    } catch (err: any) {
      setQrData({
        status: 'error',
        error: err.response?.data?.message || err.message || 'Gateway unreachable on port 2785'
      });
    } finally {
      setQrLoading(false);
    }
  };

  const fetchMarketingLinks = async () => {
    try {
      setMarketingLoading(true);
      const authHeaders = { Authorization: `Bearer ${getAuthToken()}` };
      const res = await axios.get('/api/v1/whatsapp/advanced/marketing-links', {
        headers: authHeaders
      });
      setMarketingData(res.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch marketing links', err);
    } finally {
      setMarketingLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const togglePlugin = async (id: string, currentlyActive: boolean) => {
    try {
      setToggling(id);
      const authHeaders = { Authorization: `Bearer ${getAuthToken()}` };
      await axios.post(
        `/api/v1/openwa/plugins/${id}/activate`,
        { active: !currentlyActive },
        { headers: authHeaders }
      );
      setPlugins(prev => prev.map(p => p.id === id ? { ...p, status: !currentlyActive ? 'active' : 'inactive' } : p));
    } catch (err) {
      console.error('Failed to toggle plugin', err);
    } finally {
      setToggling(null);
    }
  };

  const sendSandboxButtons = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxPhone) return;
    try {
      setSandboxSending(true);
      setSandboxResult(null);
      const authHeaders = { Authorization: `Bearer ${getAuthToken()}` };
      const res = await axios.post('/api/v1/whatsapp/advanced/send-buttons', {
        to: sandboxPhone,
        text: sandboxMessage,
        title: 'Pabandi Smart Booking Test',
        buttons: [
          { id: 'btn_confirm_test', text: '✅ Confirm Slot' },
          { id: 'btn_reschedule_test', text: '🔄 Change Time' },
          { id: 'btn_support_test', text: '👤 Talk to Human' }
        ]
      }, { headers: authHeaders });

      setSandboxResult({
        success: true,
        message: 'Interactive button payload dispatched successfully to WhatsApp!'
      });
    } catch (err: any) {
      setSandboxResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to dispatch'
      });
    } finally {
      setSandboxSending(false);
    }
  };

  const isConnected = stats?.activeSessions > 0 || health?.status === 'connected';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-mono">
              <span className="text-emerald-400 font-semibold">PABANDI ADMIN</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">WHATSAPP & OPENWA ENGINE</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <MessageCircle className="w-8 h-8 text-emerald-500" />
              <span>WhatsApp Admin & Bot Operations</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Zero-Meta onboarding, real-time Baileys gateway monitor, interactive quick-replies, and booking bot controls.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/book/glamour-salon"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-2"
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Test Booking Experience</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>

            <a
              href="http://localhost:2785/api-docs"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-500/30 transition flex items-center gap-1.5"
            >
              <span>Swagger Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Live Status KPI Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Gateway Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-lg font-bold text-white">
                  {isConnected ? 'Connected (Live)' : 'Standby / Unpaired'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl text-slate-400">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Sessions</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats?.activeSessions ?? 0} <span className="text-xs text-slate-500 font-normal">/ {stats?.totalSessions ?? 1}</span>
              </p>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl text-slate-400">
              <Smartphone className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Escrow Platform Take</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">5.0%</p>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl text-slate-400">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Human Co-Pilot</p>
              <span className="inline-flex items-center px-2 py-0.5 mt-2 rounded-full text-xs font-semibold bg-purple-900/50 text-purple-300 border border-purple-700/50">
                Auto-Pause 45m
              </span>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl text-slate-400">
              <UserCheck className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Health', icon: Activity },
            { id: 'pairing', label: '30-Sec QR Pairing', icon: QrCode },
            { id: 'plugins', label: 'Bot Capabilities & Plugins', icon: Layers },
            { id: 'marketing', label: 'Click-to-Chat & QR Standees', icon: Share2 },
            { id: 'sandbox', label: 'Interactive Sandbox', icon: Send },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'pairing' && !qrData) fetchQrCode();
                  if (tab.id === 'marketing' && !marketingData) fetchMarketingLinks();
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW & HEALTH */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
            <div className="md:col-span-2 space-y-6">
              
              {/* Strategy Highlights Card */}
              <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 shadow-md">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <Zap className="w-4 h-4" />
                  <span>Maverick Architecture Active</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Zero-Meta WhatsApp Engine for SME & Agent Settlement
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Pabandi links directly with existing business WhatsApp numbers via self-hosted OpenWA / Baileys. No Meta Business API application, no Facebook verification, and no per-conversation utility charges.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
                    <p className="font-semibold text-white text-xs mb-1">Interactive Button Responses</p>
                    <p className="text-xs text-slate-400">1-tap slot confirmation without typing friction.</p>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
                    <p className="font-semibold text-white text-xs mb-1">Human Co-Pilot Guard</p>
                    <p className="text-xs text-slate-400">Automatically pauses bot when owner texts manually.</p>
                  </div>
                </div>
              </div>

              {/* Gateway Diagnostics */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-bold text-white text-base mb-4 flex items-center justify-between">
                  <span>OpenWA Transport Configuration</span>
                  <button
                    onClick={fetchInitialData}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </h3>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-800">
                    <span className="text-slate-400">Gateway Base URL</span>
                    <span className="text-emerald-400 font-bold">http://localhost:2785/api</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800">
                    <span className="text-slate-400">Alternate Evolution API</span>
                    <span className="text-blue-400">http://localhost:8080</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800">
                    <span className="text-slate-400">Active Webhook URL</span>
                    <span className="text-slate-200">/api/v1/openwa/webhook</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400">No-Show Recovery Platform Fee</span>
                    <span className="text-emerald-400 font-bold">20% (TreasuryPosition Operating)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Pair Callout */}
            <div className="space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-emerald-400" />
                    <span>Quick Device Pairing</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Pair your salon, clinic, or shop WhatsApp number in 30 seconds to start automating customer bookings.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('pairing');
                    fetchQrCode();
                  }}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan Pairing QR Code</span>
                </button>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span>Booking Flow Next Step</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Once your number is paired, customers can book directly through conversation or using your embedded booking checkout.
                </p>
                <Link
                  to="/book/glamour-salon"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition text-xs flex items-center justify-center gap-2 border border-slate-700"
                >
                  <span>Launch Booking Experience</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 30-SEC QR PAIRING */}
        {activeTab === 'pairing' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 animate-in fade-in duration-200">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 mb-3">
                <QrCode className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Link Your Business Phone</h2>
              <p className="text-slate-400 text-xs mt-1">
                Scan with WhatsApp on your phone to turn it into an automated booking assistant.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-8 bg-slate-950 border border-slate-800 rounded-2xl mb-6 min-h-[300px]">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-mono">Initializing OpenWA session & QR stream...</p>
                </div>
              ) : qrData?.qr || qrData?.qrCodeUrl || qrData?.raw ? (
                <div className="flex flex-col items-center">
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img
                      src={
                        qrData.qrCodeUrl ||
                        qrData.qr ||
                        `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrData.raw || '')}`
                      }
                      alt="OpenWA Pairing QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Session: default &bull; Ready to scan</span>
                  </div>
                </div>
              ) : (
                <div className="text-center max-w-sm">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-white mb-1">Gateway Standby</p>
                  <p className="text-xs text-slate-400 mb-4">
                    The local OpenWA gateway at <code className="text-emerald-400">http://localhost:2785</code> is not currently streaming a QR code. Click Refresh to request a fresh session.
                  </p>
                  <button
                    onClick={fetchQrCode}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition inline-flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate Fresh QR</span>
                  </button>
                </div>
              )}
            </div>

            {/* Instruction Steps */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 mb-6">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">3 Steps to Link:</h4>
              <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                <li>Open WhatsApp on your business phone.</li>
                <li>Tap <strong>Settings / Menu &rarr; Linked Devices &rarr; Link a Device</strong>.</li>
                <li>Point your camera at the QR code above. Done in 30 seconds!</li>
              </ol>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={fetchQrCode}
                disabled={qrLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-2 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                <span>Refresh QR Code</span>
              </button>
              <button
                onClick={() => setActiveTab('overview')}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition"
              >
                Done / Connected
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: BOT CAPABILITIES & PLUGINS */}
        {activeTab === 'plugins' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Bot Automation Modules</h2>
                <p className="text-xs text-slate-400">Toggle capabilities on and off without restarting your session.</p>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-3 py-1 rounded-full">
                {plugins.length} Modules Available
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plugins.map((plugin) => {
                const isActive = plugin.status === 'active' || plugin.id === 'pabandi-openwa-bridge';
                const isRequired = plugin.id === 'pabandi-openwa-bridge';

                return (
                  <div
                    key={plugin.id}
                    className={`bg-slate-900 border ${isActive ? 'border-emerald-500/50' : 'border-slate-800'} rounded-2xl p-6 flex flex-col justify-between transition hover:border-slate-700`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-slate-800 rounded-xl text-emerald-400">
                          <Zap className="w-5 h-5" />
                        </div>
                        <button
                          onClick={() => !isRequired && togglePlugin(plugin.id, isActive)}
                          disabled={isRequired || toggling === plugin.id}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isActive ? 'bg-emerald-500' : 'bg-slate-700'
                          } ${isRequired ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <h3 className="text-base font-bold text-white mb-1">{plugin.name}</h3>
                      <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                        {plugin.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                        v{plugin.version || '1.0.0'}
                      </span>
                      <span className={`text-xs font-semibold ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {isRequired ? 'Core Bridge' : isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: MARKETING LINKS & QR STANDEES */}
        {activeTab === 'marketing' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-1">Click-to-WhatsApp Marketing Hub</h2>
              <p className="text-xs text-slate-400 mb-6">
                Direct customers from Instagram, TikTok, Google Maps, and physical tables straight into your WhatsApp booking flow.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* wa.me link card */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span>Direct WhatsApp Chat Link</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Use this link in your Instagram bio, Linktree, or Google Business profile:
                  </p>
                  <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 break-all">
                    <span>{marketingData?.waMeUrl || 'https://wa.me/?text=Book'}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(marketingData?.waMeUrl || 'https://wa.me/?text=Book', 'wame')}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5"
                  >
                    {copiedKey === 'wame' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'wame' ? 'Copied to Clipboard!' : 'Copy wa.me Link'}</span>
                  </button>
                </div>

                {/* Counter standee card */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-2">
                      <QrCode className="w-4 h-4 text-blue-400" />
                      <span>Physical Reception / Table Standee</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Print this QR code for your counter standee so customers can scan to book or order in seconds.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <img
                      src={marketingData?.qrCodeUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://pabandi.com'}
                      alt="Counter Standee QR"
                      className="w-20 h-20 bg-white p-1 rounded-lg"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">Scan to Book on WhatsApp</p>
                      <p className="text-[11px] text-slate-400">Pre-fills appointment greeting automatically.</p>
                      <a
                        href={marketingData?.qrCodeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-400 hover:underline font-semibold inline-flex items-center gap-1 pt-1"
                      >
                        <span>Download Print Size</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: INTERACTIVE SANDBOX */}
        {activeTab === 'sandbox' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-in fade-in duration-200">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              <span>Interactive Button Sandbox</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Test sending real interactive quick-reply buttons directly to any mobile number to verify formatting and OpenWA delivery.
            </p>

            <form onSubmit={sendSandboxButtons} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Destination WhatsApp Number (with country code)
                </label>
                <input
                  type="text"
                  placeholder="+923001234567 or +14155552671"
                  value={sandboxPhone}
                  onChange={(e) => setSandboxPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  value={sandboxMessage}
                  onChange={(e) => setSandboxMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Payload Buttons Attached:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-lg font-mono">
                    [ ✅ Confirm Slot ]
                  </span>
                  <span className="px-2.5 py-1 bg-slate-800 text-blue-400 border border-blue-500/30 rounded-lg font-mono">
                    [ 🔄 Change Time ]
                  </span>
                  <span className="px-2.5 py-1 bg-slate-800 text-purple-400 border border-purple-500/30 rounded-lg font-mono">
                    [ 👤 Talk to Human ]
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={sandboxSending || !sandboxPhone}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {sandboxSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Send WhatsApp Test Buttons</span>
              </button>
            </form>

            {sandboxResult && (
              <div
                className={`mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
                  sandboxResult.success
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                }`}
              >
                {sandboxResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{sandboxResult.message}</span>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

