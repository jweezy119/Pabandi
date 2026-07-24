// @ts-nocheck
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, MessageCircle, Clock, Zap, Settings, Activity } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const PluginManagerPage = () => {
  const { user } = useAuthStore();
  const [plugins, setPlugins] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pluginsRes, statsRes] = await Promise.all([
        axios.get('/api/v1/openwa/plugins/available', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        axios.get('/api/v1/openwa/stats', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      ]);
      setPlugins(pluginsRes.data.data || []);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Failed to load plugin manager data', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePlugin = async (id: string, currentlyActive: boolean) => {
    try {
      setToggling(id);
      await axios.post(
        `/api/v1/openwa/plugins/${id}/activate`,
        { active: !currentlyActive },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
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
    if (keywords.includes('chat') || keywords.includes('whatsapp')) return <MessageCircle className="w-6 h-6 text-emerald-500" />;
    if (keywords.includes('after-hours') || keywords.includes('offline')) return <Clock className="w-6 h-6 text-purple-500" />;
    return <Zap className="w-6 h-6 text-blue-500" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            WhatsApp Plugin Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Customize your Pabandi business experience by toggling AI and automation plugins for WhatsApp.
          </p>
        </div>
        
        {stats && (
          <div className="flex space-x-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm text-gray-500">Active Sessions</p>
              <p className="text-xl font-semibold">{stats.activeSessions} / {stats.totalSessions}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Delivery Rate</p>
              <p className="text-xl font-semibold text-emerald-500">{(stats.messageDeliveryRate * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Uptime</p>
              <p className="text-xl font-semibold">{stats.uptime}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plugins.map((plugin) => {
          // Derive visual state. For the purpose of the demo, we assume status 'active' is toggled on.
          // Note: OpenWA bridge is usually always on.
          const isActive = plugin.status === 'active' || plugin.id === 'pabandi-openwa-bridge';
          const isRequired = plugin.id === 'pabandi-openwa-bridge';

          return (
            <div 
              key={plugin.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border ${isActive ? 'border-emerald-500/50' : 'border-gray-200 dark:border-gray-700'} p-6 transition-all duration-200 hover:shadow-md`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  {getIcon(plugin.keywords)}
                </div>
                <div>
                  <button
                    onClick={() => !isRequired && togglePlugin(plugin.id, isActive)}
                    disabled={isRequired || toggling === plugin.id}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'} ${isRequired ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {plugin.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 h-10">
                {plugin.description}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md">
                  v{plugin.version}
                </span>
                
                <button className="text-sm text-blue-500 hover:text-blue-600 font-medium flex items-center">
                  <Settings className="w-4 h-4 mr-1" />
                  Configure
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
