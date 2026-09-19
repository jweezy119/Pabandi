import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';
import { CRM_CONFIG, BusinessType } from '../config/crmConfig';
import { crmService } from '../services/api';

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

export const EnhancedDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType | 'ALL'>('ALL');
  const [businessCounts, setBusinessCounts] = useState<Record<BusinessType, number>>({
    PROPERTY_MANAGEMENT: 0,
    SALES: 0,
    SERVICE: 0,
    FREELANCE: 0,
    GENERAL: 0,
  });
  const [crmPipeline, setCrmPipeline] = useState<any[]>([]);
  const [crmDeals, setCrmDeals] = useState<any[]>([]);
  const [crmTasks, setCrmTasks] = useState<any[]>([]);

  useEffect(() => {
    // Load initial dashboard data
    loadDashboardData();
  }, [selectedBusinessType]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const counts: Record<BusinessType, number> = {
        PROPERTY_MANAGEMENT: 0,
        SALES: 0,
        SERVICE: 0,
        FREELANCE: 0,
        GENERAL: 0,
      };
      setBusinessCounts(counts);

      const [pipelineRes, dealsRes, tasksRes] = await Promise.all([
        crmService.pipeline().catch(() => ({ data: { data: { pipeline: [] } } })),
        crmService.deals().catch(() => ({ data: { data: [] } })),
        crmService.tasks().catch(() => ({ data: { data: [] } })),
      ]);
      setCrmPipeline(pipelineRes.data?.data?.pipeline || []);
      setCrmDeals(dealsRes.data?.data || []);
      setCrmTasks(tasksRes.data?.data || []);

      const allWidgets: DashboardWidget[] = [
        // Property Management Widgets
        { id: '1', title: 'Properties', value: counts.PROPERTY_MANAGEMENT, change: '+1 this month', icon: '🏠', color: '#6366f1', link: '/property-manager' },
        { id: '2', title: 'Active Listings', value: counts.SALES, change: '+2 this week', icon: '📋', color: '#10b981', link: '/marketplace' },
        { id: '3', title: 'PAB Balance', value: '2,500', change: '+125 today', icon: '💰', color: '#f59e0b', link: '/token' },
        { id: '4', title: 'Trust Score', value: '73.8', change: '+2.1 this month', icon: '🛡️', color: '#ec4899', link: '/passport' },
        { id: '5', title: 'Open Escrows', value: 3, change: '$750 total', icon: '🔒', color: '#8b5cf6', link: '/escrow' },
        { id: '6', title: 'Pending Apps', value: 8, change: '2 need review', icon: '📝', color: '#ef4444', link: '/applications' },
      ];

      // Filter widgets based on selected business type
      const filteredWidgets = selectedBusinessType === 'ALL' 
        ? allWidgets 
        : allWidgets.filter(widget => {
            const widgetType = widget.title === 'Properties' ? 'PROPERTY_MANAGEMENT' :
                              widget.title === 'Active Listings' ? 'SALES' :
                              widget.title === 'PAB Balance' ? 'GENERAL' :  // PAB applies to all
                              widget.title === 'Trust Score' ? 'ALL' :
                              widget.title === 'Open Escrows' ? 'ALL' :
                              widget.title === 'Pending Apps' ? 'ALL' : 'GENERAL';
            return widgetType === selectedBusinessType || widgetType === 'ALL';
          });

      setWidgets(filteredWidgets);

      setActivities([
        { id: '1', type: 'listing', message: 'New rental property "Downtown 2BR" added to listings', time: '2 min ago', icon: '🏠' },
        { id: '2', type: 'sale', message: 'iPhone 14 Pro sold - $899', time: '15 min ago', icon: '📱' },
        { id: '3', type: 'escrow', message: 'Property lease escrow #esc-123 funded — $1,500 locked', time: '1 hour ago', icon: '🔒' },
        { id: '4', type: 'pab', message: 'Earned +15 PAB for completing rental agreement', time: '2 hours ago', icon: '💰' },
        { id: '5', type: 'screening', message: 'Tenant background check completed for Sarah M. — LOW risk', time: '3 hours ago', icon: '🔍' },
        { id: '6', type: 'maintenance', message: 'Apartment maintenance request "Leaking faucet" assigned', time: '5 hours ago', icon: '🔧' },
      ]);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Fallback to mock data if AI service fails
      setBusinessCounts({
        PROPERTY_MANAGEMENT: 3,
        SALES: 5,
        SERVICE: 2,
        FREELANCE: 8,
        GENERAL: 4,
      });
      
      const mockWidgets: DashboardWidget[] = [
        { id: '1', title: 'Properties', value: 3, change: '+1 this month', icon: '🏠', color: '#6366f1', link: '/property-manager' },
        { id: '2', title: 'Active Listings', value: 5, change: '+2 this week', icon: '📋', color: '#10b981', link: '/marketplace' },
        { id: '3', title: 'PAB Balance', value: '2,500', change: '+125 today', icon: '💰', color: '#f59e0b', link: '/token' },
        { id: '4', title: 'Trust Score', value: '73.8', change: '+2.1 this month', icon: '🛡️', color: '#ec4899', link: '/passport' },
        { id: '5', title: 'Open Escrows', value: 3, change: '$750 total', icon: '🔒', color: '#8b5cf6', link: '/escrow' },
        { id: '6', title: 'Pending Apps', value: 8, change: '2 need review', icon: '📝', color: '#ef4444', link: '/applications' },
      ];
      setWidgets(mockWidgets);

      setActivities([
        { id: '1', type: 'listing', message: 'New rental property "Downtown 2BR" added to listings', time: '2 min ago', icon: '🏠' },
        { id: '2', type: 'sale', message: 'iPhone 14 Pro sold - $899', time: '15 min ago', icon: '📱' },
        { id: '3', type: 'escrow', message: 'Property lease escrow #esc-123 funded — $1,500 locked', time: '1 hour ago', icon: '🔒' },
        { id: '4', type: 'pab', message: 'Earned +15 PAB for completing rental agreement', time: '2 hours ago', icon: '💰' },
        { id: '5', type: 'screening', message: 'Tenant background check completed for Sarah M. — LOW risk', time: '3 hours ago', icon: '🔍' },
        { id: '6', type: 'maintenance', message: 'Apartment maintenance request "Leaking faucet" assigned', time: '5 hours ago', icon: '🔧' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { icon: '🏠', label: 'Add Property', link: '/property-manager' },
    { icon: '📋', label: 'Create Listing', link: '/marketplace' },
    { icon: '🔍', label: 'Screen Tenant', link: '/background-check' },
    { icon: '📝', label: 'Generate Contract', link: '/ai/lease-anomaly' },
    { icon: '🤖', label: 'Ask AI', link: '/ai/analyze' },
    { icon: '🔒', label: 'Open Escrow', link: '/escrow' },
  ];

  const businessTypeOptions = [
    { value: 'ALL', label: 'All Business', icon: '📊' },
    { value: 'PROPERTY_MANAGEMENT', label: 'Properties', icon: '🏠' },
    { value: 'SALES', label: 'Sales', icon: '🛍️' },
    { value: 'SERVICE', label: 'Services', icon: '🔧' },
    { value: 'FREELANCE', label: 'Freelance', icon: '💻' },
    { value: 'GENERAL', label: 'General', icon: '📝' },
  ];

  const getBusinessTypeConfig = (type: BusinessType) => CRM_CONFIG[type];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header with Business Type Selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 font-headline">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.textDim }}>
              Managing multiple business types: {Object.entries(businessCounts).filter(([_, count]) => count > 0).map(([type, count]) => `${CRM_CONFIG[type as BusinessType].label.split(' ')[0]} (${count})`).join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success">● Live</Badge>
            <Badge tone="info">v2.0</Badge>
          </div>
        </div>

        {/* Business Type Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {businessTypeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedBusinessType(option.value as BusinessType | 'ALL')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm touch-target
                ${selectedBusinessType === option.value
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'bg-dark-800/50 text-slate-400 hover:bg-dark-700/50 hover:text-slate-200 border border-transparent'}
              `}
            >
              <span>{option.icon}</span>
              <span>{option.label}</span>
              {selectedBusinessType !== 'ALL' && option.value !== 'ALL' && businessCounts[option.value as BusinessType] > 0 && (
                <span className="bg-brand-500/30 text-brand-300 text-xs px-2 py-0.5 rounded-full ml-1">
                  {businessCounts[option.value as BusinessType]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Selected Business Type Info */}
        {selectedBusinessType !== 'ALL' && (
          <div className="mb-4 p-4 bg-brand-500/10 border border-brand-500/20 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getBusinessTypeConfig(selectedBusinessType as BusinessType).icon}</span>
              <div>
                <h3 className="font-bold text-slate-200">{getBusinessTypeConfig(selectedBusinessType as BusinessType).label}</h3>
                <p className="text-sm text-slate-400 mt-1">{getBusinessTypeConfig(selectedBusinessType as BusinessType).description}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-500">Active entities</p>
                <p className="text-lg font-bold text-brand-400">{businessCounts[selectedBusinessType as BusinessType]}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.link}>
              <Surface className="p-3 text-center hover:bg-white/5 transition-all cursor-pointer group">
                <div className="text-xl mb-1 group-hover:scale-110 transition-transform">{action.icon}</div>
                <div className="text-xs font-semibold text-slate-300 group-hover:text-brand-400">{action.label}</div>
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
                <Surface className="p-4 hover:bg-white/5 transition-all cursor-pointer group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg group-hover:scale-110 transition-transform">{widget.icon}</span>
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-brand-400">{widget.title}</span>
                  </div>
                  <div className="text-xl font-bold group-hover:text-brand-400" style={{ color: widget.color }}>{widget.value}</div>
                  {widget.change && (
                    <div className="text-xs mt-1 text-slate-500 group-hover:text-brand-300">{widget.change}</div>
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
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="text-lg">{activity.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-300 font-medium">{activity.message}</div>
                    <div className="text-xs mt-1 text-slate-500">{activity.time}</div>
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
                  <span style={{ color: tokens.color.textDim }}>Balance</span>
                  <span className="text-emerald-300 font-bold">2,500 $PAB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: tokens.color.textDim }}>Staked</span>
                  <span className="text-amber-300 font-bold">500 $PAB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: tokens.color.textDim }}>Tier</span>
                  <Badge tone="success">Silver</Badge>
                </div>
              </div>
              <Link to="/token"><Button size="sm" className="w-full mt-3">View Dashboard</Button></Link>
            </Surface>

            <Link to="/sales-crm">
              <Surface className="p-4 hover:bg-white/10 transition-colors cursor-pointer">
                <h3 className="text-base font-bold text-slate-100 mb-3">📈 Sales CRM</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: tokens.color.textDim }}>Pipeline</span>
                    <span className="text-indigo-300 font-bold">${crmPipeline.reduce((sum, p) => sum + p.value, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: tokens.color.textDim }}>Deals</span>
                    <span className="text-slate-100 font-bold">{crmDeals.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: tokens.color.textDim }}>Open Tasks</span>
                    <span className="text-amber-300 font-bold">{crmTasks.filter((t: any) => t.status !== 'COMPLETED').length}</span>
                  </div>
                </div>
                <Button size="sm" className="w-full mt-3">Open CRM</Button>
              </Surface>
            </Link>

            <Surface className="p-4">
              <h3 className="text-base font-bold text-slate-100 mb-3">🛡️ Trust Passport</h3>
              <div className="text-center mb-3">
                <div className="text-3xl font-black text-slate-100">73.8</div>
                <div className="text-xs" style={{ color: tokens.color.textDim }}>Trust Score</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div><div className="font-bold text-slate-100">127</div><div style={{ color: tokens.color.textDim }}>Transactions</div></div>
                <div><div className="font-bold text-emerald-300">98.4%</div><div style={{ color: tokens.color.textDim }}>Success</div></div>
              </div>
              <Link to="/passport"><Button size="sm" className="w-full mt-3">View Passport</Button></Link>
            </Surface>

            <Surface className="p-4">
              <h3 className="text-base font-bold text-slate-100 mb-3">🤖 AI Tools</h3>
              <div className="space-y-2">
                <Link to="/ai/analyze" className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300">Property Valuation</Link>
                <Link to="/ai/lease-anomaly" className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300">Lease Analyzer</Link>
                <Link to="/ai/lease-anomaly" className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300">Maintenance Assistant</Link>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDashboardPage;
