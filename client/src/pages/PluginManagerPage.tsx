// @ts-nocheck
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, MessageCircle, Clock, Zap, Settings, Activity, QrCode, RefreshCw, Send, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { tokens } from '../design-system';
import { getAuthToken } from '../utils/authToken';

export const PluginManagerPage = () => {
  const { user } = useAuthStore();
  const [plugins, setPlugins] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // QR & WhatsApp Pairing state
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pluginsRes, statsRes] = await Promise.all([
        axios.get('/api/v1/openwa/plugins/available', { headers: { Authorization: `Bearer ${getAuthToken()}` } }).catch(() => ({ data: { data: [] } })),
        axios.get('/api/v1/openwa/stats', { headers: { Authorization: `Bearer ${getAuthToken()}` } }).catch(() => ({ data: { data: null } }))
      ]);
      setPlugins(pluginsRes.data.data || []);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Failed to load plugin manager data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQrCode = async () => {
    try {
      setQrLoading(true);
      setShowQrModal(true);
      const res = await axios.get('/api/v1/whatsapp/advanced/connect-qr?sessionId=default', {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      setQrData(res.data);
    } catch (err: any) {
      setQrData({
        success: false,
        error: err.response?.data?.message || err.message || 'Failed to fetch WhatsApp pairing QR code'
      });
    } finally {
      setQrLoading(false);
    }
  };

  const sendTestPing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;
    try {
      setTestSending(true);
      setTestResult(null);
      const res = await axios.post('/api/v1/whatsapp/advanced/send-buttons', {
        to: testPhone,
        text: '👋 Salam! This is a test message from your Pabandi WhatsApp Bot.',
        title: 'Pabandi Trust Verification',
        buttons: [
          { id: 'btn_confirm', text: '✅ Confirm Booking' },
          { id: 'btn_support', text: '👤 Talk to Receptionist' }
        ]
      }, {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      setTestResult({ success: true, message: 'Test message sent successfully!' });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to send'
      });
    } finally {
      setTestSending(false);
    }
  };

  const togglePlugin = async (id: string, currentlyActive: boolean) => {
    try {
      setToggling(id);
      await axios.post(
        `/api/v1/openwa/plugins/${id}/activate`,
        { active: !currentlyActive },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      );
      // Optimistic update
      setPlugins(prev => prev.map(p => p.id === id ? { ...p, status: !currentlyActive ? 'active' : 'inactive' } : p));
    } catch (err) {
      console.error('Failed to toggle plugin', err);
    } finally {
      setToggling(null);
    }
  };

  const getIcon = (keywords: string[]) => {
    if (!keywords) return <Zap className="w-6 h-6 text-blue-500" />;
    if (keywords.includes('trust')) return <Shield className="w-6 h-6 text-green-500" />;
    if (keywords.includes('chat') || keywords.includes('whatsapp')) return <MessageCircle className="w-6 h-6 text-[var(--sage)]" />;
    if (keywords.includes('after-hours') || keywords.includes('offline')) return <Clock className="w-6 h-6 text-purple-500" />;
    return <Zap className="w-6 h-6 text-blue-500" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--sage)]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" style={{ background: 'var(--cream)', color: 'var(--warm-ink)' }}>
      {/* Top Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              OpenWA & Baileys Gateway
            </span>
            <span className="text-xs text-slate-500 font-mono">Port 2785 / 8080</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--warm-ink)] mb-2">
            WhatsApp Admin & Plugin Manager
          </h1>
          <p className="text-[var(--soft-stone)]">
            Manage your OpenWA gateway sessions, scan QR codes to pair business devices, and toggle bot automation plugins.
          </p>
        </div>
        
        {stats && (
          <div className="flex space-x-6 bg-white bg-[var(--warm-sand)] p-4 rounded-xl shadow-[var(--shadow-soft)] border border-[rgba(191,179,163,0.3)]">
            <div>
              <p className="text-xs text-[var(--soft-stone)] uppercase font-semibold">Active Sessions</p>
              <p className="text-xl font-bold text-slate-900">{stats.activeSessions} / {stats.totalSessions}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--soft-stone)] uppercase font-semibold">Delivery Mode</p>
              <p className="text-xl font-bold text-emerald-600">
                {stats.messageDeliveryRate != null ? `${(stats.messageDeliveryRate * 100).toFixed(1)}%` : 'Direct P2P'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--soft-stone)] uppercase font-semibold">Gateway Status</p>
              <p className="text-xl font-bold text-slate-900">{stats.uptime || 'Online'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Banner: Pair Device + Send Test Message */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-sm">
              <QrCode className="w-5 h-5" />
              <span>Strategy 1: 30-Second QR Scan (Zero Meta Setup)</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Link Your Existing WhatsApp Business Phone</h2>
            <p className="text-slate-300 text-sm max-w-xl mb-4">
              Connect in 30 seconds using OpenWA. No Meta Business API fees, no Facebook verification, and your customers receive messages directly from your official phone number.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={fetchQrCode}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Connect WhatsApp (Show QR Code)</span>
            </button>
            <a
              href="http://localhost:2785/api-docs"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-700"
            >
              <span>Swagger API Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Quick Test Ping Box */}
        <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-soft)] border border-[rgba(191,179,163,0.3)] flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <span>Test Interactive Buttons</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Send a real interactive WhatsApp button payload to verify gateway dispatch.
            </p>
            <form onSubmit={sendTestPing} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="+923001234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={testSending || !testPhone}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {testSending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                <span>Send WhatsApp Ping</span>
              </button>
            </form>
          </div>
          {testResult && (
            <div className={`mt-3 p-2 rounded-lg text-xs ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <span>Pair Business WhatsApp</span>
              </h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-slate-600 mb-4 space-y-1">
              <p>1. Open WhatsApp on your business phone.</p>
              <p>2. Tap <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong>.</p>
              <p>3. Point your camera at this QR code.</p>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl mb-4 min-h-[260px]">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-xs text-slate-500">Generating pairing session...</p>
                </div>
              ) : qrData?.qrCodeUrl || qrData?.data?.qr || qrData?.data?.raw || qrData?.qr ? (
                <div className="flex flex-col items-center">
                  <img
                    src={qrData.qrCodeUrl || qrData.data?.qr || qrData.qr || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData.data?.raw || '')}`}
                    alt="Scan to link WhatsApp"
                    className="w-52 h-52 object-contain bg-white p-2 rounded-lg border border-slate-300 shadow-sm"
                  />
                  <p className="text-xs text-emerald-600 font-semibold mt-3 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Session: {qrData?.sessionId || 'default'} (QR Ready)</span>
                  </p>
                </div>
              ) : (
                <div className="text-center p-4">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-700 font-semibold mb-1">
                    {qrData?.message || qrData?.error || 'OpenWA Gateway is in stand-by'}
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Gateway URL: <code className="bg-slate-200 px-1 py-0.5 rounded">http://localhost:2785</code>.
                    Make sure the OpenWA container or process is running.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={fetchQrCode}
                disabled={qrLoading}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                <span>Refresh QR</span>
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog & Plugin Grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Active Bot Plugins & Capabilities</h2>
        <span className="text-xs text-slate-500">{plugins.length} Plugins Configured</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plugins.map((plugin) => {
          const isActive = plugin.status === 'active' || plugin.id === 'pabandi-openwa-bridge';
          const isRequired = plugin.id === 'pabandi-openwa-bridge';

          return (
            <div 
              key={plugin.id}
              className={`bg-white rounded-[var(--radius-card)] shadow-[var(--shadow-soft)] border ${isActive ? 'border-emerald-500/50' : 'border-slate-200'} p-6 transition-all duration-200 hover:shadow-md flex flex-col justify-between`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-slate-100 rounded-xl">
                    {getIcon(plugin.keywords)}
                  </div>
                  <div>
                    <button
                      onClick={() => !isRequired && togglePlugin(plugin.id, isActive)}
                      disabled={isRequired || toggling === plugin.id}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? 'bg-emerald-600' : 'bg-slate-300'} ${isRequired ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {plugin.name}
                </h3>
                <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                  {plugin.description}
                </p>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  v{plugin.version || '1.0.0'}
                </span>
                
                <span className={`text-xs font-semibold ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {isRequired ? 'Core Engine' : isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
