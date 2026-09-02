import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';

interface DashboardWidget {
  id: string;
  title: string;
  value: string | number;
  change?: string;
  icon: string;
  color: string;
  link?: string;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  time: string;
  icon: string;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading dashboard data
    setTimeout(() => {
      setWidgets([
        { id: '1', title: 'Properties', value: 12, change: '+2 this month', icon: '🏠', color: '#6366f1', link: '/property-manager' },
        { id: '2', title: 'Active Listings', value: 5, change: '+1 this week', icon: '📋', color: '#10b981', link: '/marketplace' },
        { id: '3', title: 'PAB Balance', value: '2,500', change: '+125 today', icon: '💰', color: '#f59e0b', link: '/token' },
        { id: '4', title: 'Trust Score', value: '73.8', change: '+2.1 this month', icon: '🛡️', color: '#ec4899', link: '/passport' },
        { id: '5', title: 'Open Escrows', value: 3, change: '$750 total', icon: '🔒', color: '#8b5cf6', link: '/escrow' },
        { id: '6', title: 'Pending Apps', value: 8, change: '2 need review', icon: '📝', color: '#ef4444', link: '/applications' },
      ]);

      setActivities([
        { id: '1', type: 'listing', message: 'New listing: "IKEA Sofa - Like New" viewed 12 times', time: '2 min ago', icon: '👁️' },
        { id: '2', type: 'escrow', message: 'Escrow #esc-123 funded — $250 locked', time: '15 min ago', icon: '🔒' },
        { id: '3', type: 'tenant', message: 'Tenant application received from Sarah M.', time: '1 hour ago', icon: '📋' },
        { id: '4', type: 'pab', message: 'Earned +15 PAB for completing a sale', time: '2 hours ago', icon: '💰' },
        { id: '5', type: 'screening', message: 'Background check completed for John D. — LOW risk', time: '3 hours ago', icon: '🔍' },
        { id: '6', type: 'maintenance', message: 'Maintenance request "Kitchen leak" assigned to Carlos R.', time: '5 hours ago', icon: '🔧' },
      ]);

      setLoading(false);
    }, 500);
  }, []);

  const quickActions = [
    { icon: '🏠', label: 'Add Property', link: '/property-manager' },
    { icon: '📋', label: 'Create Listing', link: '/marketplace' },
    { icon: '🔍', label: 'Screen Tenant', link: '/background-check' },
    { icon: '📝', label: 'Generate Lease', link: '/ai' },
    { icon: '🤖', label: 'Ask AI', link: '/ai/analyze' },
    { icon: '🔒', label: 'Open Escrow', link: '/escrow' },
  ];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 font-headline">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>
              Here's what's happening across your Pabandi ecosystem
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success">● Live</Badge>
            <Badge tone="info">v2.0</Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.link}>
              <Surface className="p-3 text-center hover:bg-white/5 transition-all cursor-pointer">
                <div className="text-xl mb-1">{action.icon}</div>
                <div className="text-xs font-semibold text-slate-300">{action.label}</div>
              </Surface>
            </Link>
          ))}
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[...Array(6)].map((_, i) => (
              <Surface key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                <div className="h-6 bg-white/10 rounded w-3/4" />
              </Surface>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {widgets.map((widget) => (
              <Link key={widget.id} to={widget.link || '#'}>
                <Surface className="p-4 hover:bg-white/5 transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{widget.icon}</span>
                    <span className="text-xs" style={{ color: tokens.color.muted }}>{widget.title}</span>
                  </div>
                  <div className="text-xl font-bold" style={{ color: widget.color }}>{widget.value}</div>
                  {widget.change && (
                    <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{widget.change}</div>
                  )}
                </Surface>
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <Surface className="p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-100">Recent Activity</h3>
              <Link to="/notifications" className="text-xs text-indigo-300 hover:text-indigo-200">View all →</Link>
            </div>
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
                  <div className="text-lg">{activity.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-300">{activity.message}</div>
                    <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          {/* Quick Stats */}
          <div className="space-y-4">
            <Surface className="p-4">
              <h3 className="text-base font-bold text-slate-100 mb-3">💰 PAB Economy</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: tokens.color.muted }}>Balance</span>
                  <span className="text-emerald-300 font-bold">2,500 $PAB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: tokens.color.muted }}>Staked</span>
                  <span className="text-amber-300 font-bold">500 $PAB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: tokens.color.muted }}>Tier</span>
                  <Badge tone="success">Silver</Badge>
                </div>
              </div>
              <Link to="/token"><Button size="sm" className="w-full mt-3">View Dashboard</Button></Link>
            </Surface>

            <Surface className="p-4">
              <h3 className="text-base font-bold text-slate-100 mb-3">🛡️ Trust Passport</h3>
              <div className="text-center mb-3">
                <div className="text-3xl font-black text-slate-100">73.8</div>
                <div className="text-xs" style={{ color: tokens.color.muted }}>Trust Score</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div><div className="font-bold text-slate-100">127</div><div style={{ color: tokens.color.muted }}>Transactions</div></div>
                <div><div className="font-bold text-emerald-300">98.4%</div><div style={{ color: tokens.color.muted }}>Success</div></div>
              </div>
              <Link to="/passport"><Button size="sm" className="w-full mt-3">View Passport</Button></Link>
            </Surface>

            <Surface className="p-4">
              <h3 className="text-base font-bold text-slate-100 mb-3">🤖 AI Tools</h3>
              <div className="space-y-2">
                <Link to="/ai/analyze" className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300">Property Valuation</Link>
                <Link to="/ai" className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300">Lease Analyzer</Link>
                <Link to="/ai" className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300">Maintenance Assistant</Link>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
