import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Send, CheckCircle, Clock, AlertCircle, BarChart3,
  Shield, Zap, Users, TrendingUp, Plus, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

interface Analytics {
  tasks: { total: number; completed: number; rate: number };
  bookings: { total: number; active: number };
  trust: { score: number };
  earnings: { total: number };
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface Message {
  id: string;
  senderAgentId: string;
  recipientAgentId: string;
  message: string;
  createdAt: string;
}

export default function AgentDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'messages' | 'consent'>('overview');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' });
  const [newMessage, setNewMessage] = useState({ recipientAgentId: '', message: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const [analyticsRes, tasksRes, messagesRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/agent-comm/analytics`, { headers }),
        fetch(`${API_BASE}/api/v1/agent-comm/tasks`, { headers }),
        fetch(`${API_BASE}/api/v1/agent-comm/messages`, { headers }),
      ]);
      if (analyticsRes.ok) setAnalytics((await analyticsRes.json()).data);
      if (tasksRes.ok) setTasks((await tasksRes.json()).data || []);
      if (messagesRes.ok) setMessages((await messagesRes.json()).data || []);
    } catch (err) {
      console.error('Failed to load agent data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent-comm/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        toast.success('Task created');
        setNewTask({ title: '', description: '', priority: 'medium' });
        loadData();
      }
    } catch (err) {
      toast.error('Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.recipientAgentId || !newMessage.message) { toast.error('Recipient and message required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent-comm/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(newMessage),
      });
      if (res.ok) {
        toast.success('Message sent');
        setNewMessage({ recipientAgentId: '', message: '' });
        loadData();
      }
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent-comm/task/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (res.ok) {
        toast.success('Task completed');
        loadData();
      }
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--clay)]/20 border-t-[var(--clay)] rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'tasks' as const, label: 'Tasks', icon: CheckCircle },
    { id: 'messages' as const, label: 'Messages', icon: MessageSquare },
    { id: 'consent' as const, label: 'Consent', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[var(--clay)]/10 flex items-center justify-center">
            <Bot size={24} className="text-[var(--clay)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">Agent Dashboard</h1>
            <p className="text-sm text-[var(--soft-stone)]">Manage your AI agent operations</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-[var(--clay)] text-white' : 'bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-[var(--sage)]" />
                  <span className="text-xs font-medium text-[var(--soft-stone)]">Tasks</span>
                </div>
                <p className="text-2xl font-bold text-[var(--warm-ink)]">{analytics.tasks.completed}/{analytics.tasks.total}</p>
                <p className="text-xs text-[var(--soft-stone)]">{analytics.tasks.rate}% completion</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-[var(--clay)]" />
                  <span className="text-xs font-medium text-[var(--soft-stone)]">Bookings</span>
                </div>
                <p className="text-2xl font-bold text-[var(--warm-ink)]">{analytics.bookings.active}</p>
                <p className="text-xs text-[var(--soft-stone)]">{analytics.bookings.total} total</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-[var(--sage)]" />
                  <span className="text-xs font-medium text-[var(--soft-stone)]">Trust Score</span>
                </div>
                <p className="text-2xl font-bold text-[var(--warm-ink)]">{Math.round(analytics.trust.score)}</p>
                <p className="text-xs text-[var(--soft-stone)]">reliability</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-[var(--muted-ochre)]" />
                  <span className="text-xs font-medium text-[var(--soft-stone)]">Earnings</span>
                </div>
                <p className="text-2xl font-bold text-[var(--warm-ink)]">${analytics.earnings.total.toFixed(2)}</p>
                <p className="text-xs text-[var(--soft-stone)]">total earned</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">Agent Capabilities</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Bot, label: 'Autonomous Booking', desc: 'Book services on behalf of users' },
                  { icon: Users, label: 'CRM Management', desc: 'Manage contacts, deals, and pipelines' },
                  { icon: MessageSquare, label: 'Agent Communication', desc: 'Message and collaborate with other agents' },
                  { icon: Shield, label: 'Trust Verification', desc: 'Verify identity and reputation offline' },
                ].map((cap, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--cream)]">
                    <cap.icon size={18} className="text-[var(--clay)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--warm-ink)]">{cap.label}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{cap.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
              <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-3">Create Task</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title..."
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                />
                <input
                  type="text"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Description..."
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                />
                <div className="flex gap-2">
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <button
                    onClick={handleCreateTask}
                    disabled={saving}
                    className="flex-1 py-2 rounded-xl bg-[var(--clay)] text-white text-sm font-medium hover:bg-[var(--terracotta)]"
                  >
                    {saving ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)] text-center">
                  <CheckCircle size={32} className="mx-auto text-[var(--soft-stone)] mb-2" />
                  <p className="text-sm text-[var(--soft-stone)]">No tasks yet</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
                    <div className={`w-2 h-2 rounded-full ${
                      task.status === 'completed' ? 'bg-[var(--sage)]' :
                      task.priority === 'high' ? 'bg-[var(--dusty-rose)]' :
                      task.priority === 'medium' ? 'bg-[var(--muted-ochre)]' : 'bg-[var(--soft-stone)]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--warm-ink)] truncate">{task.title}</p>
                      <p className="text-xs text-[var(--soft-stone)]">{task.description}</p>
                    </div>
                    {task.status !== 'completed' && (
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--sage)]/10 text-[var(--sage)] hover:bg-[var(--sage)]/20"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
              <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-3">Send Message</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newMessage.recipientAgentId}
                  onChange={e => setNewMessage({ ...newMessage, recipientAgentId: e.target.value })}
                  placeholder="Recipient agent ID..."
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                />
                <textarea
                  value={newMessage.message}
                  onChange={e => setNewMessage({ ...newMessage, message: e.target.value })}
                  placeholder="Message..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm resize-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={saving}
                  className="w-full py-2 rounded-xl bg-[var(--clay)] text-white text-sm font-medium hover:bg-[var(--terracotta)]"
                >
                  {saving ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {messages.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)] text-center">
                  <MessageSquare size={32} className="mx-auto text-[var(--soft-stone)] mb-2" />
                  <p className="text-sm text-[var(--soft-stone)]">No messages yet</p>
                </div>
              ) : (
                messages.slice(0, 10).map(msg => (
                  <div key={msg.id} className="p-3 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
                    <p className="text-sm text-[var(--warm-ink)]">{msg.message}</p>
                    <p className="text-xs text-[var(--soft-stone)] mt-1">
                      {msg.senderAgentId === localStorage.getItem('userId') ? 'Sent' : 'Received'} • {new Date(msg.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'consent' && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.2)]">
              <h3 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-2">Agent Consent</h3>
              <p className="text-sm text-[var(--soft-stone)] mb-4">
                Grant agents permission to act on your behalf. You can revoke access at any time.
              </p>
              <div className="p-4 rounded-xl bg-[var(--sage)]/5 border border-[var(--sage)]/15">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-[var(--sage)]" />
                  <span className="text-sm font-medium text-[var(--warm-ink)]">How it works</span>
                </div>
                <ul className="text-xs text-[var(--soft-stone)] space-y-1">
                  <li>• Agents request specific permissions (scopes)</li>
                  <li>• You approve or deny each request</li>
                  <li>• Consent expires after 24 hours by default</li>
                  <li>• You can revoke access instantly</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
