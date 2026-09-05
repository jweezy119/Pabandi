import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, Legend
} from 'recharts';
import {
  Users, TrendingUp, DollarSign, Target,
  Search, Plus, MoreVertical, Phone,
  Mail, Calendar, Zap, Brain, Sparkles, ArrowUpRight,
  ArrowDownRight, Clock, AlertCircle,
  UserPlus, FileText, Activity,
  ChevronRight, RefreshCw, Download, Send,
  Filter, CheckCircle2, XCircle, Eye,
  Bell,
  CalendarDays, Timer, CheckSquare, AlertTriangle,
  MailOpen, MousePointerClick, UserCheck, Building2,
  Layers, Flame, ThumbsUp
} from 'lucide-react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  value: number;
  stage: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  score: number;
  lastContact: string;
  source: string;
  temperature: 'hot' | 'warm' | 'cold';
}

interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'deal' | 'task';
  title: string;
  description: string;
  time: string;
  contact: string;
}

interface AIInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'suggestion' | 'prediction' | 'action';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
}

interface Task {
  id: string;
  title: string;
  due: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  completed: boolean;
}

interface Deal {
  id: string;
  company: string;
  value: number;
  stage: string;
  probability: number;
  closeDate: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockLeads: Lead[] = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@techcorp.io', phone: '+1 555-0142', company: 'TechCorp', value: 45000, stage: 'qualified', score: 87, lastContact: '2 hours ago', source: 'Website', temperature: 'hot' },
  { id: '2', name: 'Marcus Johnson', email: 'marcus@buildco.com', phone: '+1 555-0198', company: 'BuildCo', value: 120000, stage: 'proposal', score: 92, lastContact: '1 day ago', source: 'Referral', temperature: 'hot' },
  { id: '3', name: 'Elena Rodriguez', email: 'elena@design.studio', phone: '+1 555-0267', company: 'Design Studio', value: 28000, stage: 'new', score: 64, lastContact: '3 days ago', source: 'LinkedIn', temperature: 'warm' },
  { id: '4', name: 'James Park', email: 'james@finance.io', phone: '+1 555-0334', company: 'Finance.io', value: 85000, stage: 'negotiation', score: 78, lastContact: '5 hours ago', source: 'Cold Outreach', temperature: 'hot' },
  { id: '5', name: 'Aisha Patel', email: 'aisha@health.co', phone: '+1 555-0411', company: 'HealthCo', value: 67000, stage: 'won', score: 95, lastContact: '1 week ago', source: 'Trade Show', temperature: 'warm' },
  { id: '6', name: 'David Kim', email: 'david@retail.biz', phone: '+1 555-0589', company: 'RetailBiz', value: 34000, stage: 'qualified', score: 71, lastContact: '4 days ago', source: 'Website', temperature: 'warm' },
  { id: '7', name: 'Lisa Thompson', email: 'lisa@edu.org', phone: '+1 555-0667', company: 'EduOrg', value: 52000, stage: 'proposal', score: 83, lastContact: '6 hours ago', source: 'Referral', temperature: 'hot' },
  { id: '8', name: 'Robert Walsh', email: 'robert@logistics.com', phone: '+1 555-0745', company: 'LogisticsPro', value: 93000, stage: 'lost', score: 45, lastContact: '2 weeks ago', source: 'Cold Outreach', temperature: 'cold' },
];

const mockActivities: Activity[] = [
  { id: '1', type: 'call', title: 'Discovery Call Completed', description: 'Spoke with Sarah about Q4 expansion plans', time: '2 hours ago', contact: 'Sarah Chen' },
  { id: '2', type: 'email', title: 'Proposal Sent', description: 'Sent BuildCo proposal for enterprise package', time: '5 hours ago', contact: 'Marcus Johnson' },
  { id: '3', type: 'meeting', title: 'Demo Scheduled', description: 'Product demo with Finance.io team', time: 'Tomorrow 2pm', contact: 'James Park' },
  { id: '4', type: 'deal', title: 'Deal Closed!', description: 'HealthCo signed $67K annual contract', time: '1 day ago', contact: 'Aisha Patel' },
  { id: '5', type: 'note', title: 'Follow-up Required', description: 'Send case study to Design Studio', time: '3 days ago', contact: 'Elena Rodriguez' },
  { id: '6', type: 'task', title: 'Task Completed', description: 'Updated CRM records for Q3 review', time: '4 hours ago', contact: 'You' },
];

const mockInsights: AIInsight[] = [
  { id: '1', type: 'opportunity', title: 'Upsell Signal Detected', description: 'BuildCo engagement up 340% this week. Recommend enterprise tier proposal.', confidence: 91, impact: 'high' },
  { id: '2', type: 'risk', title: 'Churn Risk: LogisticsPro', description: 'No contact in 14 days. Competitor activity detected in their region.', confidence: 78, impact: 'high' },
  { id: '3', type: 'suggestion', title: 'Optimal Contact Window', description: 'Finance.io team most responsive Tue-Thu 10am-12pm EST.', confidence: 85, impact: 'medium' },
  { id: '4', type: 'prediction', title: 'Q4 Revenue Forecast', description: 'Pipeline suggests $342K closings this quarter (+23% vs Q3).', confidence: 72, impact: 'high' },
  { id: '5', type: 'action', title: 'Send Follow-up Sequence', description: '3 leads haven\'t been contacted in 7+ days. Auto-sequence recommended.', confidence: 88, impact: 'medium' },
];

const revenueData = [
  { month: 'Jan', revenue: 42000, target: 40000, forecast: 41000 },
  { month: 'Feb', revenue: 48000, target: 42000, forecast: 46000 },
  { month: 'Mar', revenue: 55000, target: 45000, forecast: 52000 },
  { month: 'Apr', revenue: 51000, target: 48000, forecast: 53000 },
  { month: 'May', revenue: 62000, target: 50000, forecast: 58000 },
  { month: 'Jun', revenue: 68000, target: 55000, forecast: 64000 },
  { month: 'Jul', revenue: 72000, target: 60000, forecast: 70000 },
  { month: 'Aug', revenue: 79000, target: 65000, forecast: 76000 },
  { month: 'Sep', revenue: 85000, target: 70000, forecast: 82000 },
];

const leadSourceData = [
  { name: 'Website', value: 35, color: '#818cf8' },
  { name: 'Referral', value: 28, color: '#c084fc' },
  { name: 'LinkedIn', value: 20, color: '#38bdf8' },
  { name: 'Cold Outreach', value: 12, color: '#fbbf24' },
  { name: 'Trade Show', value: 5, color: '#22c55e' },
];

const pipelineData = [
  { stage: 'New', count: 12, value: 156000 },
  { stage: 'Qualified', count: 8, value: 234000 },
  { stage: 'Proposal', count: 5, value: 189000 },
  { stage: 'Negotiation', count: 3, value: 145000 },
  { stage: 'Won', count: 7, value: 412000 },
];

const conversionData = [
  { stage: 'Visit', rate: 100 },
  { stage: 'Lead', rate: 45 },
  { stage: 'Qualified', rate: 28 },
  { stage: 'Proposal', rate: 15 },
  { stage: 'Negotiation', rate: 8 },
  { stage: 'Won', rate: 5 },
];

const teamPerformance = [
  { name: 'You', deals: 12, revenue: 285000, quota: 85 },
  { name: 'Alex', deals: 9, revenue: 210000, quota: 72 },
  { name: 'Sam', deals: 11, revenue: 245000, quota: 80 },
  { name: 'Jordan', deals: 7, revenue: 175000, quota: 62 },
];

const tasksData: Task[] = [
  { id: '1', title: 'Follow up with BuildCo on proposal', due: 'Today', priority: 'urgent', completed: false },
  { id: '2', title: 'Send case study to Elena', due: 'Today', priority: 'high', completed: false },
  { id: '3', title: 'Prepare Finance.io demo deck', due: 'Tomorrow', priority: 'high', completed: false },
  { id: '4', title: 'Update pipeline forecast', due: 'This week', priority: 'medium', completed: false },
  { id: '5', title: 'Review lost deal feedback', due: 'This week', priority: 'low', completed: true },
];

const engagementData = [
  { day: 'Mon', emails: 45, calls: 12, meetings: 3 },
  { day: 'Tue', emails: 62, calls: 18, meetings: 5 },
  { day: 'Wed', emails: 58, calls: 15, meetings: 4 },
  { day: 'Thu', emails: 71, calls: 22, meetings: 6 },
  { day: 'Fri', emails: 48, calls: 14, meetings: 3 },
];

const recentDeals: Deal[] = [
  { id: '1', company: 'HealthCo', value: 67000, stage: 'Closed Won', probability: 100, closeDate: '2026-09-01' },
  { id: '2', company: 'TechCorp', value: 45000, stage: 'Negotiation', probability: 75, closeDate: '2026-09-15' },
  { id: '3', company: 'BuildCo', value: 120000, stage: 'Proposal', probability: 60, closeDate: '2026-09-22' },
  { id: '4', company: 'Finance.io', value: 85000, stage: 'Qualified', probability: 40, closeDate: '2026-10-01' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const stageColors: Record<string, string> = {
  new: '#38bdf8',
  qualified: '#818cf8',
  proposal: '#c084fc',
  negotiation: '#fbbf24',
  won: '#22c55e',
  lost: '#ef4444',
};

const stageLabels: Record<string, string> = {
  new: 'New',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const formatCurrency = (val: number) =>
  val >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val}`;

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase();

const priorityColors: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#fbbf24',
  low: '#22c55e',
};

// ─── Components ──────────────────────────────────────────────────────────────

function KPICard({ title, value, change, icon: Icon, color, positive, subtitle }: {
  title: string; value: string; change: string; icon: any; color: string; positive: boolean; subtitle?: string;
}) {
  return (
    <Surface className="p-5 group hover:scale-[1.02] transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.color.muted }}>
            {title}
          </p>
          <p className="text-2xl font-black mt-1" style={{ color: tokens.color.text }}>{value}</p>
          {subtitle && (
            <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>{subtitle}</p>
          )}
          <div className="flex items-center gap-1 mt-2">
            {positive ? (
              <ArrowUpRight size={14} className="text-emerald-400" />
            ) : (
              <ArrowDownRight size={14} className="text-rose-400" />
            )}
            <span className={`text-xs font-bold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {change}
            </span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${color}20` }}>
          <Icon size={22} style={{ color }} />
        </div>
      </div>
    </Surface>
  );
}

function LeadRow({ lead, onSelect }: { lead: Lead; onSelect: (lead: Lead) => void }) {
  const tempIcon = lead.temperature === 'hot' ? '🔥' : lead.temperature === 'warm' ? '☀️' : '❄️';
  return (
    <tr
      className="border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors cursor-pointer"
      onClick={() => onSelect(lead)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: stageColors[lead.stage] }}
            >
              {getInitials(lead.name)}
            </div>
            <span className="absolute -top-0.5 -right-0.5 text-[10px]">{tempIcon}</span>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: tokens.color.text }}>{lead.name}</p>
            <p className="text-xs" style={{ color: tokens.color.muted }}>{lead.company}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <Badge tone={lead.stage === 'won' ? 'success' : lead.stage === 'lost' ? 'danger' : 'info'}>
          {stageLabels[lead.stage]}
        </Badge>
      </td>
      <td className="py-3 px-4 text-sm font-semibold" style={{ color: tokens.color.text }}>
        {formatCurrency(lead.value)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${lead.score}%`,
                backgroundColor: lead.score >= 80 ? '#22c55e' : lead.score >= 60 ? '#fbbf24' : '#ef4444',
              }}
            />
          </div>
          <span className="text-xs font-bold" style={{ color: tokens.color.muted }}>{lead.score}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-xs" style={{ color: tokens.color.muted }}>
        {lead.lastContact}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Call">
            <Phone size={12} style={{ color: tokens.color.muted }} />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Email">
            <Mail size={12} style={{ color: tokens.color.muted }} />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="More">
            <MoreVertical size={12} style={{ color: tokens.color.muted }} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function AIInsightCard({ insight }: { insight: AIInsight }) {
  const typeConfig = {
    opportunity: { icon: Zap, color: '#22c55e', label: 'Opportunity', bg: '#22c55e10' },
    risk: { icon: AlertCircle, color: '#ef4444', label: 'Risk', bg: '#ef444410' },
    suggestion: { icon: Brain, color: '#818cf8', label: 'Suggestion', bg: '#818cf810' },
    prediction: { icon: Sparkles, color: '#c084fc', label: 'Prediction', bg: '#c084fc10' },
    action: { icon: CheckSquare, color: '#38bdf8', label: 'Action', bg: '#38bdf810' },
  };

  const config = typeConfig[insight.type];
  const Icon = config.icon;

  return (
    <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: config.bg }}>
          <Icon size={16} style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: config.color, backgroundColor: config.bg }}>
              {config.label}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-bold" style={{ color: tokens.color.muted }}>
              {insight.confidence}% conf
            </span>
            {insight.impact === 'high' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                High Impact
              </span>
            )}
          </div>
          <p className="text-sm font-semibold" style={{ color: tokens.color.text }}>{insight.title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: tokens.color.muted }}>{insight.description}</p>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const typeConfig = {
    call: { icon: Phone, color: '#22c55e' },
    email: { icon: Mail, color: '#38bdf8' },
    meeting: { icon: Calendar, color: '#c084fc' },
    note: { icon: FileText, color: '#fbbf24' },
    deal: { icon: DollarSign, color: '#818cf8' },
    task: { icon: CheckSquare, color: '#22c55e' },
  };

  const config = typeConfig[activity.type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${config.color}20` }}>
        <Icon size={14} style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: tokens.color.text }}>{activity.title}</p>
        <p className="text-xs mt-0.5" style={{ color: tokens.color.muted }}>{activity.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-bold" style={{ color: tokens.color.muted }}>{activity.contact}</span>
          <span className="text-[10px]" style={{ color: tokens.color.muted }}>•</span>
          <span className="text-[10px]" style={{ color: tokens.color.muted }}>{activity.time}</span>
        </div>
      </div>
    </div>
  );
}

function TaskItem({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
      <button
        onClick={() => onToggle(task.id)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
          task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 hover:border-white/40'
        }`}
      >
        {task.completed && <CheckCircle2 size={12} className="text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.completed ? 'line-through opacity-50' : ''}`} style={{ color: tokens.color.text }}>
          {task.title}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: tokens.color.muted }}>{task.due}</p>
      </div>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: priorityColors[task.priority], backgroundColor: `${priorityColors[task.priority]}20` }}>
        {task.priority}
      </span>
    </div>
  );
}

// ─── Main CRM Page ───────────────────────────────────────────────────────────

export default function CRMPage() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'analytics' | 'ai' | 'tasks'>('overview');
  const [tasks, setTasks] = useState<Task[]>(tasksData);
  const [showNotifications, setShowNotifications] = useState(false);

  const filteredLeads = useMemo(() => {
    return mockLeads.filter(lead => {
      const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStage = selectedStage === 'all' || lead.stage === selectedStage;
      return matchesSearch && matchesStage;
    });
  }, [searchQuery, selectedStage]);

  const kpiData = useMemo(() => ({
    totalLeads: mockLeads.length,
    totalValue: mockLeads.reduce((sum, l) => sum + l.value, 0),
    avgDealSize: Math.round(mockLeads.reduce((sum, l) => sum + l.value, 0) / mockLeads.length),
    winRate: Math.round((mockLeads.filter(l => l.stage === 'won').length / mockLeads.length) * 100),
    activePipeline: mockLeads.filter(l => !['won', 'lost'].includes(l.stage)).length,
    forecastedRevenue: 342000,
  }), []);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse(null);

    setTimeout(() => {
      const responses: Record<string, string> = {
        default: `Based on your CRM data analysis:\n\n• Your pipeline has **$${(kpiData.totalValue / 1000).toFixed(0)}K** total value across **${kpiData.totalLeads}** active leads\n• **Marcus Johnson (BuildCo)** shows highest close probability at 92% — prioritize follow-up this week\n• **LogisticsPro** hasn't been contacted in 14 days — immediate re-engagement recommended\n• Q4 forecast: **$342K** projected closings (+23% vs Q3)\n\n**Recommended actions:**\n1. Send BuildCo enterprise proposal by EOD\n2. Schedule LogisticsPro recovery call\n3. Move Finance.io to negotiation stage after tomorrow's demo`,
      };
      setAiResponse(responses.default);
      setAiLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 backdrop-blur-2xl border-b border-white/[0.07]" style={{ backgroundColor: `${tokens.color.background}dd` }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-black tracking-tight flex items-center gap-2" style={{ color: tokens.color.text }}>
                  <Layers size={22} className="text-indigo-400" />
                  Command Center
                </h1>
                <p className="text-xs" style={{ color: tokens.color.muted }}>
                  Welcome back{user?.firstName ? `, ${user.firstName}` : ''} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => setShowNotifications(!showNotifications)} className="relative">
                  <Bell size={16} />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">3</span>
                </Button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/[0.07] bg-[#0f172a] shadow-2xl p-4 z-50">
                    <h4 className="text-sm font-bold mb-3" style={{ color: tokens.color.text }}>Notifications</h4>
                    <div className="space-y-2">
                      <div className="p-2 rounded-lg bg-white/[0.03]">
                        <p className="text-xs font-semibold" style={{ color: tokens.color.text }}>BuildCo opened proposal</p>
                        <p className="text-[10px]" style={{ color: tokens.color.muted }}>2 min ago</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03]">
                        <p className="text-xs font-semibold" style={{ color: tokens.color.text }}>Finance.io demo in 1 hour</p>
                        <p className="text-[10px]" style={{ color: tokens.color.muted }}>58 min ago</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03]">
                        <p className="text-xs font-semibold" style={{ color: tokens.color.text }}>New lead: StartupXYZ</p>
                        <p className="text-[10px]" style={{ color: tokens.color.muted }}>3 hours ago</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                <RefreshCw size={14} />
                Sync
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                <Download size={14} />
                Export
              </Button>
              <Button size="sm">
                <Plus size={14} />
                <span className="hidden sm:inline">New Lead</span>
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
            {(['overview', 'leads', 'analytics', 'ai', 'tasks'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-semibold capitalize transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab ? 'border-indigo-400 text-indigo-300' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'ai' && <Sparkles size={14} className="inline mr-1.5 -mt-0.5" />}
                {tab === 'tasks' && <CheckSquare size={14} className="inline mr-1.5 -mt-0.5" />}
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        {/* ─── Overview Tab ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <KPICard
                title="Total Leads"
                value={String(kpiData.totalLeads)}
                change="+3 this week"
                icon={Users}
                color="#818cf8"
                positive={true}
              />
              <KPICard
                title="Pipeline Value"
                value={formatCurrency(kpiData.totalValue)}
                change="+12% vs LM"
                icon={DollarSign}
                color="#22c55e"
                positive={true}
              />
              <KPICard
                title="Avg Deal Size"
                value={formatCurrency(kpiData.avgDealSize)}
                change="+8% vs LM"
                icon={Target}
                color="#c084fc"
                positive={true}
              />
              <KPICard
                title="Win Rate"
                value={`${kpiData.winRate}%`}
                change="-2% vs LM"
                icon={TrendingUp}
                color="#fbbf24"
                positive={false}
              />
              <KPICard
                title="Active Deals"
                value={String(kpiData.activePipeline)}
                change="6 in progress"
                icon={Flame}
                color="#f97316"
                positive={true}
              />
              <KPICard
                title="Forecast"
                value={formatCurrency(kpiData.forecastedRevenue)}
                change="+23% vs Q3"
                icon={Sparkles}
                color="#38bdf8"
                positive={true}
                subtitle="AI projected"
              />
            </div>

            {/* Main Grid Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue Chart */}
              <Surface className="p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: tokens.color.text }}>Revenue vs Target</h3>
                    <p className="text-xs mt-0.5" style={{ color: tokens.color.muted }}>Monthly performance with AI forecast</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="success">+23% YoY</Badge>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={revenueData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}K`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                      labelStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#818cf8" fill="url(#revenueGrad)" strokeWidth={2.5} name="Revenue" />
                    <Area type="monotone" dataKey="target" stroke="#38bdf8" fill="none" strokeWidth={1.5} strokeDasharray="5 5" name="Target" />
                    <Line type="monotone" dataKey="forecast" stroke="#22c55e" strokeWidth={2} strokeDasharray="3 3" dot={false} name="AI Forecast" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Surface>

              {/* Lead Sources + Conversion */}
              <Surface className="p-5">
                <h3 className="text-base font-bold mb-1" style={{ color: tokens.color.text }}>Lead Sources</h3>
                <p className="text-xs mb-3" style={{ color: tokens.color.muted }}>Where your leads come from</p>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={leadSourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {leadSourceData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {leadSourceData.map(source => (
                    <div key={source.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: source.color }} />
                        <span className="text-xs" style={{ color: tokens.color.muted }}>{source.name}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: tokens.color.text }}>{source.value}%</span>
                    </div>
                  ))}
                </div>
              </Surface>
            </div>

            {/* Main Grid Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pipeline */}
              <Surface className="p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold" style={{ color: tokens.color.text }}>Sales Pipeline</h3>
                  <Button variant="ghost" size="sm">View All <ChevronRight size={14} /></Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {pipelineData.map(stage => (
                    <div key={stage.stage} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors cursor-pointer">
                      <p className="text-2xl font-black" style={{ color: tokens.color.text }}>{stage.count}</p>
                      <p className="text-xs font-semibold mt-1" style={{ color: tokens.color.muted }}>{stage.stage}</p>
                      <p className="text-xs font-bold mt-1" style={{ color: '#818cf8' }}>{formatCurrency(stage.value)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-white/5">
                  {pipelineData.map(stage => (
                    <div
                      key={stage.stage}
                      className="h-full transition-all hover:opacity-80"
                      style={{
                        width: `${(stage.value / pipelineData.reduce((s, p) => s + p.value, 0)) * 100}%`,
                        backgroundColor: stageColors[stage.stage.toLowerCase()] || '#818cf8',
                      }}
                    />
                  ))}
                </div>
                {/* Recent Deals Table */}
                <div className="mt-6">
                  <h4 className="text-sm font-bold mb-3" style={{ color: tokens.color.text }}>Recent Deals</h4>
                  <div className="space-y-2">
                    {recentDeals.map(deal => (
                      <div key={deal.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                          <Building2 size={14} className="text-indigo-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: tokens.color.text }}>{deal.company}</p>
                          <p className="text-[10px]" style={{ color: tokens.color.muted }}>{deal.stage} • {deal.closeDate}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-400">{formatCurrency(deal.value)}</p>
                          <p className="text-[10px]" style={{ color: tokens.color.muted }}>{deal.probability}% prob</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Surface>

              {/* AI Insights + Activity */}
              <div className="space-y-6">
                <Surface className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold" style={{ color: tokens.color.text }}>AI Insights</h3>
                    <Badge tone="info">Live</Badge>
                  </div>
                  <div className="space-y-2">
                    {mockInsights.slice(0, 3).map(insight => (
                      <AIInsightCard key={insight.id} insight={insight} />
                    ))}
                  </div>
                </Surface>

                <Surface className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold" style={{ color: tokens.color.text }}>Activity</h3>
                    <Activity size={16} style={{ color: tokens.color.muted }} />
                  </div>
                  <div className="space-y-1">
                    {mockActivities.slice(0, 4).map(activity => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))}
                  </div>
                </Surface>
              </div>
            </div>
          </div>
        )}

        {/* ─── Leads Tab ─── */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: tokens.color.muted }} />
                <input
                  type="text"
                  placeholder="Search leads by name, company, or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border border-white/[0.07] bg-white/[0.03] focus:outline-none focus:border-indigo-400/50 transition-colors"
                  style={{ color: tokens.color.text }}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <Filter size={14} />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
                <div className="flex gap-1 overflow-x-auto">
                  {['all', 'hot', 'warm', 'cold'].map(temp => (
                    <button
                      key={temp}
                      className="px-3 py-2 rounded-lg text-xs font-bold capitalize whitespace-nowrap bg-white/[0.03] text-slate-400 border border-white/[0.07] hover:bg-white/[0.06]"
                    >
                      {temp === 'hot' ? '🔥' : temp === 'warm' ? '☀️' : temp === 'cold' ? '❄️' : ''} {temp}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stage Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['all', 'new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map(stage => (
                <button
                  key={stage}
                  onClick={() => setSelectedStage(stage)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${
                    selectedStage === stage
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                      : 'bg-white/[0.03] text-slate-400 border border-white/[0.07] hover:bg-white/[0.06]'
                  }`}
                >
                  {stage} {stage !== 'all' && `(${mockLeads.filter(l => l.stage === stage).length})`}
                </button>
              ))}
            </div>

            {/* Leads Table */}
            <Surface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.07]">
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Contact</th>
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Stage</th>
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Value</th>
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Score</th>
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Last Contact</th>
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Source</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map(lead => (
                      <LeadRow key={lead.id} lead={lead} onSelect={setSelectedLead} />
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredLeads.length === 0 && (
                <div className="py-12 text-center">
                  <Users size={32} className="mx-auto mb-3" style={{ color: tokens.color.muted }} />
                  <p className="text-sm" style={{ color: tokens.color.muted }}>No leads match your filters</p>
                </div>
              )}
            </Surface>

            {/* Lead Detail Modal */}
            {selectedLead && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
                <div className="w-full max-w-lg rounded-2xl border border-white/[0.07] bg-[#0f172a] p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                        style={{ backgroundColor: stageColors[selectedLead.stage] }}
                      >
                        {getInitials(selectedLead.name)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold" style={{ color: tokens.color.text }}>{selectedLead.name}</h3>
                        <p className="text-sm" style={{ color: tokens.color.muted }}>{selectedLead.company}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedLead(null)} className="p-1 rounded-lg hover:bg-white/10">
                      <XCircle size={20} style={{ color: tokens.color.muted }} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xs" style={{ color: tokens.color.muted }}>Deal Value</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(selectedLead.value)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xs" style={{ color: tokens.color.muted }}>Lead Score</p>
                      <p className="text-lg font-bold" style={{ color: '#818cf8' }}>{selectedLead.score}/100</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xs" style={{ color: tokens.color.muted }}>Temperature</p>
                      <p className="text-lg font-bold">{selectedLead.temperature === 'hot' ? '🔥' : selectedLead.temperature === 'warm' ? '☀️' : '❄️'}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm" style={{ color: tokens.color.text }}>
                      <Mail size={14} style={{ color: tokens.color.muted }} />
                      {selectedLead.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm" style={{ color: tokens.color.text }}>
                      <Phone size={14} style={{ color: tokens.color.muted }} />
                      {selectedLead.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm" style={{ color: tokens.color.text }}>
                      <Clock size={14} style={{ color: tokens.color.muted }} />
                      Last contact: {selectedLead.lastContact}
                    </div>
                    <div className="flex items-center gap-2 text-sm" style={{ color: tokens.color.text }}>
                      <UserPlus size={14} style={{ color: tokens.color.muted }} />
                      Source: {selectedLead.source}
                    </div>
                  </div>

                  {/* AI Suggestion for this lead */}
                  <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-400/20 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={12} className="text-indigo-300" />
                      <span className="text-[10px] font-bold text-indigo-300 uppercase">AI Recommendation</span>
                    </div>
                    <p className="text-xs" style={{ color: tokens.color.muted }}>
                      {selectedLead.score >= 80 ? 'High close probability — move to next stage this week' :
                       selectedLead.score >= 60 ? 'Moderate engagement — send personalized follow-up' :
                       'Low engagement — consider automated nurture sequence'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1">
                      <Phone size={14} /> Call
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Mail size={14} /> Email
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Calendar size={14} /> Schedule
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Analytics Tab ─── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend */}
              <Surface className="p-5">
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.color.text }}>Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}K`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#revGrad2)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </Surface>

              {/* Pipeline by Stage */}
              <Surface className="p-5">
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.color.text }}>Pipeline by Stage</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pipelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}K`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {pipelineData.map((_, index) => (
                        <Cell key={index} fill={['#38bdf8', '#818cf8', '#c084fc', '#fbbf24', '#22c55e'][index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Surface>

              {/* Conversion Funnel */}
              <Surface className="p-5">
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.color.text }}>Conversion Funnel</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={conversionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <YAxis type="category" dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="rate" fill="#818cf8" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Surface>

              {/* Engagement by Day */}
              <Surface className="p-5">
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.color.text }}>Engagement by Day</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
                    <Legend />
                    <Bar dataKey="emails" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="calls" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="meetings" fill="#c084fc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Surface>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Surface className="p-4 text-center">
                <p className="text-3xl font-black" style={{ color: '#818cf8' }}>4.2</p>
                <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Avg. Touchpoints to Close</p>
              </Surface>
              <Surface className="p-4 text-center">
                <p className="text-3xl font-black" style={{ color: '#22c55e' }}>18d</p>
                <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Avg. Sales Cycle</p>
              </Surface>
              <Surface className="p-4 text-center">
                <p className="text-3xl font-black" style={{ color: '#c084fc' }}>68%</p>
                <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Email Open Rate</p>
              </Surface>
              <Surface className="p-4 text-center">
                <p className="text-3xl font-black" style={{ color: '#fbbf24' }}>32%</p>
                <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Meeting Conversion</p>
              </Surface>
            </div>

            {/* Team Performance */}
            <Surface className="p-5">
              <h3 className="text-base font-bold mb-4" style={{ color: tokens.color.text }}>Team Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.07]">
                      <th className="py-2 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Rep</th>
                      <th className="py-2 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Deals Closed</th>
                      <th className="py-2 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Revenue</th>
                      <th className="py-2 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Quota %</th>
                      <th className="py-2 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: tokens.color.muted }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPerformance.map(rep => (
                      <tr key={rep.name} className="border-b border-white/[0.05] hover:bg-white/[0.03]">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
                              {rep.name[0]}
                            </div>
                            <span className="text-sm font-semibold" style={{ color: tokens.color.text }}>{rep.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm" style={{ color: tokens.color.text }}>{rep.deals}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-emerald-400">{formatCurrency(rep.revenue)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${rep.quota}%`, backgroundColor: rep.quota >= 80 ? '#22c55e' : rep.quota >= 60 ? '#fbbf24' : '#ef4444' }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color: tokens.color.muted }}>{rep.quota}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge tone={rep.quota >= 80 ? 'success' : rep.quota >= 60 ? 'warning' : 'danger'}>
                            {rep.quota >= 80 ? 'Exceeding' : rep.quota >= 60 ? 'On Track' : 'Behind'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          </div>
        )}

        {/* ─── AI Tab ─── */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Assistant */}
            <div className="space-y-4">
              <Surface className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Brain size={20} className="text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: tokens.color.text }}>AI Sales Assistant</h3>
                    <p className="text-xs" style={{ color: tokens.color.muted }}>Ask about your pipeline, leads, or strategy</p>
                  </div>
                </div>

                <form onSubmit={handleAISubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="e.g., What's my best opportunity this week?"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm border border-white/[0.07] bg-white/[0.03] focus:outline-none focus:border-indigo-400/50"
                    style={{ color: tokens.color.text }}
                  />
                  <Button type="submit" disabled={aiLoading}>
                    <Send size={14} />
                  </Button>
                </form>

                {aiLoading && (
                  <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                      <span className="text-xs ml-2" style={{ color: tokens.color.muted }}>Analyzing your data...</span>
                    </div>
                  </div>
                )}

                {aiResponse && (
                  <div className="mt-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-400/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-indigo-300" />
                      <span className="text-xs font-bold text-indigo-300">AI Analysis</span>
                    </div>
                    <div className="text-sm whitespace-pre-line leading-relaxed" style={{ color: tokens.color.text }}>
                      {aiResponse}
                    </div>
                  </div>
                )}
              </Surface>

              {/* Quick AI Actions */}
              <Surface className="p-5">
                <h4 className="text-sm font-bold mb-3" style={{ color: tokens.color.text }}>Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Score All Leads', icon: Target, desc: 'AI lead scoring' },
                    { label: 'Find At-Risk Deals', icon: AlertCircle, desc: 'Churn detection' },
                    { label: 'Draft Follow-ups', icon: Mail, desc: 'Email templates' },
                    { label: 'Forecast Revenue', icon: TrendingUp, desc: 'Q4 projection' },
                    { label: 'Competitor Intel', icon: Eye, desc: 'Market analysis' },
                    { label: 'Deal Insights', icon: Brain, desc: 'Close optimization' },
                  ].map(action => (
                    <button
                      key={action.label}
                      className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-400/30 transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <action.icon size={14} className="text-indigo-300" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold block" style={{ color: tokens.color.text }}>{action.label}</span>
                        <span className="text-[10px]" style={{ color: tokens.color.muted }}>{action.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </Surface>

              {/* AI-Generated Email */}
              <Surface className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MailOpen size={16} className="text-indigo-300" />
                  <h4 className="text-sm font-bold" style={{ color: tokens.color.text }}>AI Email Draft</h4>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs" style={{ color: tokens.color.muted }}>
                  <p className="font-semibold mb-1" style={{ color: tokens.color.text }}>Subject: Quick follow-up on our proposal</p>
                  <p className="leading-relaxed">Hi Marcus, I wanted to follow up on the enterprise proposal we discussed. Based on BuildCo's growth trajectory, I believe our platform can deliver 3x ROI within the first quarter. Would you be open to a 15-minute call this Thursday?</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1"><Send size={12} /> Send</Button>
                  <Button size="sm" variant="ghost"><RefreshCw size={12} /> Regenerate</Button>
                </div>
              </Surface>
            </div>

            {/* AI Insights */}
            <div className="space-y-4">
              <Surface className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-300" />
                    <h3 className="text-base font-bold" style={{ color: tokens.color.text }}>AI Insights Feed</h3>
                  </div>
                  <Badge tone="info">Live</Badge>
                </div>
                <div className="space-y-3">
                  {mockInsights.map(insight => (
                    <AIInsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </Surface>

              {/* Predictive Score */}
              <Surface className="p-5">
                <h4 className="text-sm font-bold mb-3" style={{ color: tokens.color.text }}>Deal Predictions</h4>
                <div className="space-y-3">
                  {mockLeads.filter(l => !['won', 'lost'].includes(l.stage)).slice(0, 5).map(lead => (
                    <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: stageColors[lead.stage] }}
                      >
                        {getInitials(lead.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: tokens.color.text }}>{lead.name}</p>
                        <p className="text-xs" style={{ color: tokens.color.muted }}>{lead.company} • {formatCurrency(lead.value)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{
                          color: lead.score >= 80 ? '#22c55e' : lead.score >= 60 ? '#fbbf24' : '#ef4444'
                        }}>{lead.score}%</p>
                        <p className="text-[10px]" style={{ color: tokens.color.muted }}>close prob.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>

              {/* Sentiment Analysis */}
              <Surface className="p-5">
                <h4 className="text-sm font-bold mb-3" style={{ color: tokens.color.text }}>Email Sentiment</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-xs" style={{ color: tokens.color.text }}>BuildCo (Marcus)</span>
                    <div className="flex items-center gap-1">
                      <ThumbsUp size={12} className="text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-400">Positive</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-xs" style={{ color: tokens.color.text }}>Finance.io (James)</span>
                    <div className="flex items-center gap-1">
                      <Eye size={12} className="text-amber-400" />
                      <span className="text-xs font-bold text-amber-400">Curious</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-xs" style={{ color: tokens.color.text }}>LogisticsPro (Robert)</span>
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={12} className="text-red-400" />
                      <span className="text-xs font-bold text-red-400">At Risk</span>
                    </div>
                  </div>
                </div>
              </Surface>
            </div>
          </div>
        )}

        {/* ─── Tasks Tab ─── */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Task List */}
              <Surface className="p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold" style={{ color: tokens.color.text }}>Tasks & Reminders</h3>
                  <Button size="sm"><Plus size={14} /> Add Task</Button>
                </div>
                <div className="space-y-1">
                  {tasks.map(task => (
                    <TaskItem key={task.id} task={task} onToggle={toggleTask} />
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/[0.07]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: tokens.color.muted }}>
                      {tasks.filter(t => t.completed).length} of {tasks.length} completed
                    </span>
                    <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${(tasks.filter(t => t.completed).length / tasks.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Surface>

              {/* Calendar Placeholder */}
              <Surface className="p-5">
                <h3 className="text-base font-bold mb-4" style={{ color: tokens.color.text }}>Upcoming</h3>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-400/20">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays size={14} className="text-indigo-300" />
                      <span className="text-xs font-bold text-indigo-300">Today</span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: tokens.color.text }}>Finance.io Demo</p>
                    <p className="text-xs" style={{ color: tokens.color.muted }}>2:00 PM - 3:00 PM EST</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays size={14} style={{ color: tokens.color.muted }} />
                      <span className="text-xs font-bold" style={{ color: tokens.color.muted }}>Tomorrow</span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: tokens.color.text }}>BuildCo Proposal Review</p>
                    <p className="text-xs" style={{ color: tokens.color.muted }}>10:00 AM - 11:00 AM EST</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays size={14} style={{ color: tokens.color.muted }} />
                      <span className="text-xs font-bold" style={{ color: tokens.color.muted }}>Sep 8</span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: tokens.color.text }}>Team Pipeline Review</p>
                    <p className="text-xs" style={{ color: tokens.color.muted }}>9:00 AM - 9:30 AM EST</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays size={14} style={{ color: tokens.color.muted }} />
                      <span className="text-xs font-bold" style={{ color: tokens.color.muted }}>Sep 10</span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: tokens.color.text }}>Q4 Planning Session</p>
                    <p className="text-xs" style={{ color: tokens.color.muted }}>11:00 AM - 12:00 PM EST</p>
                  </div>
                </div>
              </Surface>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Surface className="p-4 text-center">
                <Timer size={24} className="mx-auto mb-2" style={{ color: '#f97316' }} />
                <p className="text-2xl font-black" style={{ color: '#f97316' }}>3</p>
                <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Overdue Tasks</p>
              </Surface>
              <Surface className="p-4 text-center">
                <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: '#22c55e' }} />
                <p className="text-2xl font-black" style={{ color: '#22c55e' }}>12</p>
                <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Completed This Week</p>
              </Surface>
              <Surface className="p-4 text-center">
                <MousePointerClick size={24} className="mx-auto mb-2" style={{ color: '#818cf8' }} />
                <p className="text-2xl font-black" style={{ color: '#818cf8' }}>24</p>
                <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Actions Logged</p>
              </Surface>
              <Surface className="p-4 text-center">
                <UserCheck size={24} className="mx-auto mb-2" style={{ color: '#c084fc' }} />
                <p className="text-2xl font-black" style={{ color: '#c084fc' }}>8</p>
                <p className="text-xs mt-1" style={{ color: tokens.color.muted }}>Follow-ups Done</p>
              </Surface>
            </div>
          </div>
        )}
      </div>

      {/* ─── Mobile Bottom Nav ─── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0f172a]/90 border-t border-white/5 safe-area-pb">
        <div className="flex justify-around items-center px-2 py-2">
          {[
            { id: 'overview', icon: '📊', label: 'Overview' },
            { id: 'leads', icon: '👥', label: 'Leads' },
            { id: 'analytics', icon: '📈', label: 'Analytics' },
            { id: 'ai', icon: '✨', label: 'AI' },
            { id: 'tasks', icon: '✅', label: 'Tasks' },
          ].map((nav) => (
            <button
              key={nav.id}
              onClick={() => setActiveTab(nav.id as any)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === nav.id ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-500'
              }`}
            >
              <span className="text-lg">{nav.icon}</span>
              <span className="text-[10px] font-medium">{nav.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
