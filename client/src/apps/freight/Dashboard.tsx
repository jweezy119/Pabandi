import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { freightService } from '../../services/api';
import { Button, Chip, Surface } from '../../design-system';
import { FiPackage, FiUsers, FiCheckCircle, FiDollarSign, FiPlus, FiTrendingUp, FiTruck, FiActivity, FiFileText, FiShield, FiBarChart2, FiList } from 'react-icons/fi';

const statCards = [
  { label: 'Active Loads', value: '0', icon: FiPackage, color: 'text-blue-400', bg: 'bg-blue-500/10', key: 'activeLoads' },
  { label: 'Verified Carriers', value: '0', icon: FiUsers, color: 'text-emerald-400', bg: 'bg-emerald-500/10', key: 'verifiedCarriers' },
  { label: 'Completed', value: '0', icon: FiCheckCircle, color: 'text-indigo-400', bg: 'bg-indigo-500/10', key: 'completedLoads' },
  { label: 'Revenue', value: '$0', icon: FiDollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10', key: 'totalRevenue' },
];

const quickActions = [
  { path: '/freight/post', label: 'Post a Load', icon: FiPlus, desc: 'Get instant bids from carriers', color: 'from-orange-500 to-red-500' },
  { path: '/freight/loads', label: 'Browse Loads', icon: FiPackage, desc: 'Find available freight', color: 'from-blue-500 to-indigo-500' },
  { path: '/freight/carriers', label: 'Find Carriers', icon: FiTruck, desc: 'Verified transport partners', color: 'from-emerald-500 to-teal-500' },
  { path: '/freight/analytics', label: 'View Analytics', icon: FiBarChart2, desc: 'Performance insights', color: 'from-purple-500 to-pink-500' },
];

export const FreightDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = React.useState<any>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await freightService.getStats();
        setStats(res.data?.data || {});
      } catch (e) {
        console.error('Failed to load stats:', e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const displayStats = [
    { ...statCards[0], value: stats.activeLoads || 0 },
    { ...statCards[1], value: stats.verifiedCarriers || 0 },
    { ...statCards[2], value: stats.completedLoads || 0 },
    { ...statCards[3], value: `$${((stats.totalRevenue || 0) / 1000).toFixed(1)}K` },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back, {user?.firstName || 'Shipper'}. Here's your freight overview.</p>
        </div>
        <Link to="/freight/post">
          <Button size="lg" className="gap-2">
            <FiPlus size={18} /> Post Load
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {displayStats.map((stat) => (
          <Surface key={stat.key} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="text-2xl lg:text-3xl font-black text-white mt-1">
                  {loading ? (
                    <span className="animate-pulse bg-white/10 h-8 w-24 inline-block rounded" />
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} aria-hidden="true" />
              </div>
            </div>
          </Surface>
        ))}
      </div>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-lg font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.path} to={action.path}>
              <Surface className={`p-5 hover:border-orange-400/30 transition-all group ${action.color.replace('from-', 'bg-gradient-to-br from-').replace('to-', ' to-')}`} style={{ opacity: 0.15 }}>
                <div className="text-3xl mb-3">
                  <action.icon size={32} className="text-white" aria-hidden="true" />
                </div>
                <p className="font-bold text-white group-hover:text-orange-300 transition-colors">{action.label}</p>
                <p className="text-sm text-slate-400 mt-1">{action.desc}</p>
              </Surface>
            </Link>
          ))}
        </div>
      </section>

      {/* Module Status */}
      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="text-lg font-bold text-white mb-4">FreightOS Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Load Board', desc: 'Browse and bid on available loads', icon: FiPackage, path: '/freight/loads', badge: 'Public' },
            { title: 'My Loads', desc: 'Manage your posted shipments', icon: FiList, path: '/freight/my-loads', badge: 'Shipper' },
            { title: 'My Bids', desc: 'Track and manage your bids', icon: FiActivity, path: '/freight/bids', badge: 'Carrier' },
            { title: 'Tracking', desc: 'Real-time GPS tracking', icon: FiActivity, path: '/freight/tracking', badge: 'All' },
            { title: 'Documents', desc: 'BOL, POD, and compliance docs', icon: FiFileText, path: '/freight/documents', badge: 'All' },
            { title: 'Escrow', desc: 'Secure payment holding', icon: FiShield, path: '/freight/escrow', badge: 'All' },
            { title: 'Insurance', desc: 'Cargo protection policies', icon: FiShield, path: '/freight/insurance', badge: 'All' },
            { title: 'Analytics', desc: 'Revenue and performance metrics', icon: FiTrendingUp, path: '/freight/analytics', badge: 'All' },
            { title: 'Carrier Profile', desc: 'Manage your fleet and rates', icon: FiTruck, path: '/freight/carriers', badge: 'Carrier' },
          ].map((module) => (
            <Link key={module.title} to={module.path}>
              <Surface className="p-5 hover:border-orange-400/30 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center">
                    <module.icon size={24} className="text-orange-400" aria-hidden="true" />
                  </div>
                  <Chip tone="info" className="text-xs">{module.badge}</Chip>
                </div>
                <h3 className="font-bold text-white group-hover:text-orange-300 transition-colors">{module.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{module.desc}</p>
              </Surface>
            </Link>
          ))}
        </div>
      </section>

      {/* Getting Started */}
      {!stats.activeLoads && !stats.verifiedCarriers && (
        <Surface className="p-8 text-center border-orange-500/20 bg-orange-500/5">
          <FiTruck size={48} className="mx-auto text-orange-400 mb-4" aria-hidden="true" />
          <h3 className="text-xl font-bold text-white mb-2">Welcome to FreightOS!</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Start by posting your first load or browsing available freight. Load demo data to see how it all works.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/freight/post">
              <Button size="lg" className="w-full sm:w-auto">
                <FiPlus size={18} /> Post Your First Load
              </Button>
            </Link>
            <Link to="/freight/loads">
              <Button variant="ghost" size="lg" className="w-full sm:w-auto">
                Browse Load Board
              </Button>
            </Link>
          </div>
        </Surface>
      )}
    </div>
  );
};

export default FreightDashboard;